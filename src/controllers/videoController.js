const videoModel = require("../models/videoModel");
const path = require("path");
const os = require("os");
const fs = require('fs');
const fsp = fs.promises;
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const storageS3 = require("../services/storageS3");
ffmpeg.setFfmpegPath(ffmpegPath);
const { s3 } = require("../aws/clients");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { ensureS3 } = require("../services/storageS3"); // 若你有這個 helper，否則可以直接用 s3

exports.upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file" });

    // 1) 先把本機暫存檔上傳 S3
    const key = `raw/${req.user.username}/${Date.now()}-${req.file.originalname}`;
    await storageS3.putFileFromDisk({
      localPath: req.file.path,
      key,
      contentType: req.file.mimetype
    });

    // 2) 存 metadata（現在先沿用你的 videoModel；之後會換 DynamoDB 版本）
    const video = await videoModel.save(
      { originalname: req.file.originalname, filename: path.basename(key), path: key, rawKey: key }, // 注意 path 改成 S3 key
      req.user.username
    );
    video.status = "uploaded";
    videoModel.updateStatus(video.id, "uploaded", req.user.username);
    console.log("upload:", video);

    res.json({ success: true, data: video });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

exports.list = async (req, res) => {
  try {
    const videosRaw = await videoModel.findByOwner(req.user.username, req.query);
    let videos = Array.isArray(videosRaw) ? videosRaw : [];

    // sort
    if ((req.query.sort || "").toLowerCase() === "createdat") {
      videos = videos.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }

    // format filter
    if (req.query.format) {
      videos = videos.filter(v => (v.format || "").toLowerCase() === req.query.format.toLowerCase());
    }

    // source filter
    const source = (req.query.source || "").toLowerCase();
    if (source) {
      if (source === "local") {
        videos = videos.filter(v => !v.metadata?.source || v.metadata?.source === "local");
      } else {
        videos = videos.filter(v => (v.metadata?.source || "").toLowerCase() === source);
      }
    }

    // pagination
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit || "50", 10), 1);
    const start = (page - 1) * limit;
    const end = start + limit;

    const pageItems = videos.slice(start, end);

    res.json({
      success: true,
      data: pageItems,
      meta: { total: videos.length, page, limit }
    });
  } catch (e) {
    console.error("List error:", e);
    res.status(500).json({ success: false, message: "List failed" });
  }
};

exports.listAll = async (req, res) => {
  try {
    // 這裡呼叫 model 層：取出所有 video item
    const videos = await videoModel.findAll(req.query);

    let returnVideos = videos;

    // 排序：createdAt desc
    if (req.query.sort === "createdAt") {
      returnVideos = returnVideos.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // 過濾格式
    if (req.query.format) {
      returnVideos = returnVideos.filter(v => v.format === req.query.format);
    }

    // 過濾來源（local vs Pexels）
    if (req.query.source) {
      if (req.query.source.toLowerCase() === "local") {
        returnVideos = returnVideos.filter(
          v => !v.metadata?.source || v.metadata?.source === "local"
        );
      } else if (req.query.source.toLowerCase() === "pexels") {
        returnVideos = returnVideos.filter(v => v.metadata?.source === "Pexels");
      }
    }

    // 分頁
    if (req.query.page && req.query.limit) {
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const startIndex = limit * (page - 1);
      const endIndex = limit * page;
      returnVideos = returnVideos.slice(startIndex, endIndex);
    }

    res.json({ success: true, data: returnVideos });
  } catch (e) {
    console.error("listAll error:", e);
    res.status(500).json({ success: false, message: "Failed to list videos" });
  }
};

exports.download = async (req, res) => {
  const id = req.params.id;
  const video = await videoModel.findById(id, req.user.username);
  if (!video) return res.status(404).json({ success: false, message: "Video not found" });

  // 若已轉碼則優先提供轉碼檔；否則提供原始檔
  const key = video.transcoded || video.transcodedKey || video.rawKey || video.path;
  console.log("download key:", key, video);
  if (!key) return res.status(404).json({ success: false, message: "No object key" });

  try {
    await storageS3.streamToResponse({
      key,
      res,
      downloadName: video.original
    });
    videoModel.incrementDownloads(id, req.user.username);
  } catch (e) {
    console.error("Download error:", e);
    res.status(500).json({ success: false, message: "Download failed" });
  }
};

exports.remove = async (req, res) => {
  const id = req.params.id;
  const video = await videoModel.findById(id, req.user.username);
  if (!video) return res.status(404).json({ success: false, message: "Video not found" });

  try {
    // 刪 S3 上的原檔
    if (video.rawKey) await storageS3.deleteObject(video.rawKey);
    // 刪 S3 上的轉碼檔（若有）
    if (video.transcodedKey) await storageS3.deleteObject(video.transcodedKey);

    // 刪 metadata
    videoModel.removeById(id, req.user.username);

    res.json({ success: true, message: "Video deleted" });
  } catch (e) {
    console.error("Remove error:", e);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

exports.getPresignedDownload = async (req, res) => {
  const id = req.params.id;
  const video = await videoModel.findById(id, req.user.username);
  if (!video) return res.status(404).json({ success: false });

  const key = video.transcodedKey || video.rawKey;
  console.log("getPresignedDownload key:", key, video);
  if (!key) return res.status(400).json({ success: false, message: "No key" });

  try {
    const url = await storageS3.getPresignedUrl(key, 3600);
    res.json({ success: true, url });
  } catch (e) {
    console.error("Presign error:", e);
    res.status(500).json({ success: false, message: "Presign failed" });
  }
};

exports.transcode = async (req, res) => {
  const id = req.params.id;
  const { resolution = "720p", format = "mp4" } = req.body || {};

  try {
    const video = await videoModel.findById(id, req.user.username);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });

    // 1) 來源 key：優先 rawKey
    const srcKey = video.rawKey || video.path;
    if (!srcKey) return res.status(400).json({ success: false, message: "No source key" });

    // 2) 下載到本機 /tmp
    await ensureS3?.(); // 若你沒有這個函式可刪掉
    const inExt = path.extname(video.filename) || ".mp4";
    const base = path.basename(video.filename, path.extname(video.filename));
    const tempDir = os.tmpdir();
    const inLocal = path.join(tempDir, `in-${id}-${Date.now()}${inExt}`);
    const outLocal = path.join(tempDir, `out-${id}-${Date.now()}.${format}`);

    // 下載 S3 物件
    const r = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: srcKey }));
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(inLocal);
      r.Body.on("error", reject).pipe(ws).on("error", reject).on("finish", resolve);
    });

    // 3) 決定輸出參數
    let size;
    if (resolution === "1080p") size = "1920x1080";
    else if (resolution === "720p") size = "1280x720";
    else size = "640x480";

    // 4) 執行 ffmpeg（用本機檔案）
    await new Promise((resolve, reject) => {
      let cmd = ffmpeg(inLocal)
        .size(size)
        .toFormat(format)
        .outputOptions(["-y"])              // 覆寫輸出檔
        .on("start", c => {
          console.log("FFmpeg started:", c);
          videoModel.updateStatus(id, "processing", req.user.username).catch(()=>{});
        })
        .on("stderr", line => console.log("ffmpeg:", line))
        .on("end", resolve)
        .on("error", reject);

      if (format === "mp4") {
        cmd = cmd.videoCodec("libx264")
                 .outputOptions(["-preset veryfast", "-crf 26", "-movflags +faststart"]);
      } else if (format === "webm") {
        cmd = cmd.videoCodec("libvpx-vp9").outputOptions(["-b:v 0", "-crf 33"]);
      } else if (format === "gif") {
        cmd = cmd.duration(5); // gif 限制秒數以防超吃 CPU
      }

      cmd.save(outLocal);
    });

    // 5) 上傳輸出檔到 S3
    const body = await fsp.readFile(outLocal);
    const outKey = `transcoded/${req.user.username}/${base}-${Date.now()}.${format}`;
    const contentType = format === "mp4" ? "video/mp4" : (format === "webm" ? "video/webm" : "image/gif");
    await storageS3.putBuffer({ key: outKey, body, contentType });

    // 6) 清理臨時檔
    fsp.unlink(inLocal).catch(()=>{});
    fsp.unlink(outLocal).catch(()=>{});

    // 7) 更新 metadata & 計數
    await videoModel.updateTranscoded(id, outKey, format, "done", req.user.username);
    videoModel.incrementTranscodes(id, req.user.username).catch(()=>{});

    res.json({
      success: true,
      message: "Transcoding completed",
      data: { id, transcodedKey: outKey, format }
    });
  } catch (e) {
    console.error("Transcode error:", e);
    try { await videoModel.updateStatus(id, "error", req.user.username); } catch {}
    res.status(500).json({ success: false, message: "Transcode failed" });
  }
};

exports.status = async (req, res) => {
  const id = req.params.id;
  const video = await videoModel.findById(id, req.user.username);

  if (!video) {
    return res.status(404).json({ success: false, message: "Video not found" });
  }

  res.json({
    success: true,
    data: {
      id: video.id,
      original: video.original,
      status: video.status || "unknown",
      format: video.format,
      transcoded: video.transcoded || null,
      createdAt: video.createdAt
    }
  });
};