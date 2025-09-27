const videoModel = require("../models/videoModel");
const path = require("path");
const fs = require('fs');
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const storageS3 = require("../services/storageS3");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3 } = require("../aws/clients");
const BUCKET = process.env.S3_BUCKET;
ffmpeg.setFfmpegPath(ffmpegPath);

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
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ success: true, url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
};

exports.transcode = async (req, res) => {
  const id = req.params.id;
  const { resolution = "720p", format = "gif" } = req.body;

  const video = await videoModel.findById(id, req.user.username);
  console.log("transcode:", video);
  if (!video) {
    return res.status(404).json({ success: false, message: "Video not found" });
  }

  videoModel.incrementTranscodes(id, req.user.username);

  // source path
  const inputPath = path.resolve(video.path);
  console.log("inputPath:", inputPath);

  // output file name
  const outputName = `${path.basename(video.filename, path.extname(video.filename))}-${Date.now()}.${format}`;
  const outputPath = path.join("output", outputName);

  // choose parameter by resolution
  let size;
  if (resolution === "720p") size = "1280x720";
  else if (resolution === "1080p") size = "1920x1080";
  else size = "640x480"; // default: 480p

  // call ffmpeg
  ffmpeg(inputPath)
    .duration(5)
    .size(size)
    .toFormat(format)
    .videoCodec("libx264")
    .outputOptions([
      "-vsync 2",
      "-fflags +genpts",
      "-preset veryslow",
      "-crf 28"
    ])
    .on("start", (cmd) => {
      console.log("FFmpeg started:", cmd);
      video.status = "processing";
    })
    .on("stderr", (line) => {
      console.log("FFmpeg stderr:", line);
    })
    .on("end", () => {
      console.log("FFmpeg finished:", outputPath);
      video.status = "done";
      video.transcoded = outputPath; // save transcode file into database
      videoModel.updateTranscoded(id, outputPath, format, video.status, req.user.username);
    })
    .on("error", (err) => {
      console.error("FFmpeg error:", err.message);
      video.status = "error";
      videoModel.updateStatus(id, "error", req.user.username);
    })
    .save(outputPath);

  // reply immediately (asynchronous processing)
  res.json({
    success: true,
    message: "Transcoding started",
    data: {
      id: video.id,
      original: video.original,
      requested: { resolution, format }
    }
  });
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