const path = require("path");
const os = require("os");
const fs = require("fs");
const fsp = fs.promises;
const https = require("https");
const util = require("util");
const stream = require("stream");
const pipeline = util.promisify(stream.pipeline);

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

const videoModel = require("../models/videoModel");
const storageS3 = require("../services/storageS3"); // ➜ 統一路徑，所有 S3 操作走這裡
const { enqueueTranscodeJob } = require("../aws/sqs");

// 小工具：把 presigned URL 下載到本機檔案
async function downloadUrlToFile(url, outPath) {
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const ws = fs.createWriteStream(outPath);
      pipeline(res, ws).then(resolve).catch(reject);
    }).on("error", reject);
  });
}

exports.upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file" });

    // 1) 上傳到 S3（本機暫存檔來自 multer.diskStorage）
    const key = `raw/${req.user.username}/${Date.now()}-${req.file.originalname}`;
    await storageS3.putFileFromDisk({
      localPath: req.file.path,
      key,
      contentType: req.file.mimetype,
    });

    // 2) 存 metadata（path/rawKey 都記 S3 key）
    const video = await videoModel.save(
      {
        originalname: req.file.originalname,
        filename: path.basename(key),
        path: key,
        rawKey: key,
      },
      req.user.username
    );
    await videoModel.updateStatus(video.id, "uploaded", req.user.username);

    console.log("[upload] ok:", { id: video.id, key });

    res.json({ success: true, data: video });
  } catch (e) {
    console.error("[upload] error:", e);
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
      videos = videos.filter((v) => (v.format || "").toLowerCase() === req.query.format.toLowerCase());
    }

    // source filter
    const source = (req.query.source || "").toLowerCase();
    if (source) {
      if (source === "local") {
        videos = videos.filter((v) => !v.metadata?.source || v.metadata?.source === "local");
      } else {
        videos = videos.filter((v) => (v.metadata?.source || "").toLowerCase() === source);
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
      meta: { total: videos.length, page, limit },
    });
  } catch (e) {
    console.error("[list] error:", e);
    res.status(500).json({ success: false, message: "List failed" });
  }
};

exports.listAll = async (req, res) => {
  try {
    const videos = await videoModel.findAll(req.query);
    let returnVideos = Array.isArray(videos) ? videos.slice() : [];

    if (req.query.sort === "createdAt") {
      returnVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (req.query.format) {
      returnVideos = returnVideos.filter((v) => v.format === req.query.format);
    }

    if (req.query.source) {
      const s = req.query.source.toLowerCase();
      if (s === "local") {
        returnVideos = returnVideos.filter((v) => !v.metadata?.source || v.metadata?.source === "local");
      } else if (s === "pexels") {
        returnVideos = returnVideos.filter((v) => (v.metadata?.source || "").toLowerCase() === "pexels");
      }
    }

    if (req.query.page && req.query.limit) {
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const startIndex = limit * (page - 1);
      const endIndex = limit * page;
      returnVideos = returnVideos.slice(startIndex, endIndex);
    }

    res.json({ success: true, data: returnVideos });
  } catch (e) {
    console.error("[listAll] error:", e);
    res.status(500).json({ success: false, message: "Failed to list videos" });
  }
};

exports.download = async (req, res) => {
  try {
    const id = req.params.id;
    const video = await videoModel.findById(id, req.user.username);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });

    // 已轉檔優先
    const key = video.transcodedKey || video.transcoded || video.rawKey || video.path;
    console.log("[download] key:", key, "video.id:", id);
    if (!key) return res.status(404).json({ success: false, message: "No object key" });

    await storageS3.streamToResponse({
      key,
      res,
      downloadName: video.original,
    });
    videoModel.incrementDownloads(id, req.user.username).catch(() => {});
  } catch (e) {
    console.error("[download] error:", e);
    res.status(500).json({ success: false, message: "Download failed" });
  }
};

exports.getPresignedDownload = async (req, res) => {
  try {
    const id = req.params.id;
    const video = await videoModel.findById(id, req.user.username);
    if (!video) return res.status(404).json({ success: false });

    const key = video.transcodedKey || video.rawKey || video.path;
    console.log("[presign] key:", key, "video.id:", id);
    if (!key) return res.status(400).json({ success: false, message: "No key" });

    const url = await storageS3.getPresignedUrl(key, 3600);
    res.json({ success: true, url });
  } catch (e) {
    console.error("[presign] error:", e);
    res.status(500).json({ success: false, message: "Presign failed" });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const video = await videoModel.findById(id, req.user.username);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });

    if (video.rawKey) await storageS3.deleteObject(video.rawKey);
    if (video.transcodedKey) await storageS3.deleteObject(video.transcodedKey);

    await videoModel.removeById(id, req.user.username);

    res.json({ success: true, message: "Video deleted" });
  } catch (e) {
    console.error("[remove] error:", e);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

exports.transcode = async (req, res) => {
  try {
    const videoId = req.params.id;
    const { resolution = "720p", format = "mp4" } = req.body || {};

    // 1) 找影片 metadata，確認存在 & 使用者擁有
    const video = await videoModel.findById(videoId, req.user.username);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found or not owned by this user",
      });
    }

    // 2) 更新狀態成 "queued"（可寫回 DynamoDB，optional 但加分）
    await videoModel.updateStatus(videoId, "queued", req.user.username);

    // 3) 建立要送給 worker 的 job payload
    // worker 看到這包資料以後會：
    //   - 從 S3 下載 video.rawKey
    //   - ffmpeg -> 新檔
    //   - 上傳結果到 S3 (transcoded/...)
    //   - updateTranscoded(...) / updateStatus(...)
    const job = {
      action: "transcode",
      videoId,
      owner: req.user.username,
      srcKey: video.rawKey || video.path,    // S3 source
      filename: video.filename,              // 用來命名輸出
      resolution,
      format,
    };

    // 4) 丟進 SQS
    await enqueueTranscodeJob(job);

    // 5) 回應給 client：排隊中
    res.json({
      success: true,
      message: "Transcode job queued",
      data: {
        id: videoId,
        requested: { resolution, format },
        status: "queued",
      },
    });
  } catch (err) {
    console.error("API transcode enqueue error:", err);
    res.status(500).json({ success: false, message: "Failed to enqueue transcode job" });
  }
};

// exports.transcode = async (req, res) => {
//   const id = req.params.id;
//   const { resolution = "720p", format = "mp4" } = req.body || {};

//   try {
//     const video = await videoModel.findById(id, req.user.username);
//     if (!video) return res.status(404).json({ success: false, message: "Video not found" });

//     // 來源 key（優先 rawKey）
//     const srcKey = video.rawKey || video.path;
//     if (!srcKey) return res.status(400).json({ success: false, message: "No source key" });
//     console.log("[transcode] srcKey:", srcKey, "format:", format, "resolution:", resolution);

//     // 取得可讀取的 URL，下載到 /tmp
//     const inputUrl = await storageS3.getPresignedUrl(srcKey, 3600);
//     const tempDir = os.tmpdir();
//     const base = path.basename(video.filename, path.extname(video.filename) || ".mp4");
//     const inLocal = path.join(tempDir, `in-${id}-${Date.now()}${path.extname(video.filename) || ".mp4"}`);
//     const outLocal = path.join(tempDir, `out-${id}-${Date.now()}.${format}`);

//     await downloadUrlToFile(inputUrl, inLocal);
//     console.log("[transcode] downloaded to:", inLocal);

//     // 決定輸出解析度
//     let size;
//     if (resolution === "1080p") size = "1920x1080";
//     else if (resolution === "720p") size = "1280x720";
//     else size = "640x480";

//     // 跑 ffmpeg
//     await new Promise((resolve, reject) => {
//       let cmd = ffmpeg(inLocal)
//         .size(size)
//         .toFormat(format)
//         .outputOptions(["-y"]) // 覆寫輸出
//         .on("start", (c) => {
//           console.log("[ffmpeg] start:", c);
//           videoModel.updateStatus(id, "processing", req.user.username).catch(() => {});
//         })
//         .on("stderr", (line) => console.log("[ffmpeg]", line))
//         .on("end", resolve)
//         .on("error", reject);

//       if (format === "mp4") {
//         cmd = cmd.videoCodec("libx264").outputOptions(["-preset veryfast", "-crf 26", "-movflags +faststart"]);
//       } else if (format === "webm") {
//         cmd = cmd.videoCodec("libvpx-vp9").outputOptions(["-b:v 0", "-crf 33"]);
//       } else if (format === "gif") {
//         cmd = cmd.duration(5); // gif 建議限制長度
//       }

//       cmd.save(outLocal);
//     });

//     console.log("[transcode] ffmpeg done, outLocal:", outLocal);

//     // 上傳輸出檔
//     const body = await fsp.readFile(outLocal);
//     const outKey = `transcoded/${req.user.username}/${base}-${Date.now()}.${format}`;
//     const contentType = format === "mp4" ? "video/mp4" : format === "webm" ? "video/webm" : "image/gif";
//     console.log("[transcode] outKey:", outKey, "contentType:", contentType);

//     await storageS3.putBuffer({ key: outKey, body, contentType });

//     // 清理暫存檔
//     fsp.unlink(inLocal).catch(() => {});
//     fsp.unlink(outLocal).catch(() => {});

//     // 更新 metadata 與計數
//     await videoModel.updateTranscoded(id, outKey, format, "done", req.user.username);
//     videoModel.incrementTranscodes(id, req.user.username).catch(() => {});

//     res.json({
//       success: true,
//       message: "Transcoding completed",
//       data: { id, transcodedKey: outKey, format },
//     });
//   } catch (e) {
//     console.error("[transcode] error:", e);
//     try {
//       await videoModel.updateStatus(id, "error", req.user.username);
//     } catch {}
//     res.status(500).json({ success: false, message: "Transcode failed" });
//   }
// };

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
      transcoded: video.transcoded || video.transcodedKey || null,
      createdAt: video.createdAt,
    },
  });
};