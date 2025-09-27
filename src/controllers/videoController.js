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
    const video = videoModel.save(
      { originalname: req.file.originalname, filename: path.basename(key), path: key }, // 注意 path 改成 S3 key
      req.user.username
    );
    // 同時你也可以在 save() 改欄位名，例如新增 rawKey=S3 key
    video.path = key;   // S3 key
    video.rawKey = key; // 新欄位更語義化
    video.status = "uploaded";
    videoModel.updateStatus(video.id, "uploaded");

    res.json({ success: true, data: video });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

exports.list = (req, res) => {
  const videos = videoModel.findByOwner(req.user.username, req.query);
  returnVideos = videos;
  if (req.query.sort === "created_at") {
    returnVideos = videos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  if (req.query.format != null) {
    returnVideos = returnVideos.filter(v => v.format === req.query.format);
  }
  if (req.query.source.toLowerCase() === "local") {
    returnVideos = returnVideos.filter(v => !v.metadata?.source || v.metadata?.source === "local");
  } else {
    returnVideos = returnVideos.filter(v => v.metadata?.source === "Pexels");
  }
  if ((req.query.page != null) && (req.query.limit != null)) {
    startIndex = req.query.limit * (req.query.page - 1);
    endIndex = req.query.limit * req.query.page;
    returnVideos = returnVideos.slice(startIndex, endIndex);
  }
  res.json({ success: true, data: returnVideos });
};

exports.download = async (req, res) => {
  const id = req.params.id;
  const video = videoModel.findById(id);
  if (!video) return res.status(404).json({ success: false, message: "Video not found" });

  // 若已轉碼則優先提供轉碼檔；否則提供原始檔
  const key = video.transcoded || video.transcodedKey || video.rawKey || video.path;
  if (!key) return res.status(404).json({ success: false, message: "No object key" });

  try {
    await storageS3.streamToResponse({
      key,
      res,
      downloadName: video.original
    });
  } catch (e) {
    console.error("Download error:", e);
    res.status(500).json({ success: false, message: "Download failed" });
  }
};

exports.remove = async (req, res) => {
  const id = req.params.id;
  const video = videoModel.findById(id);
  if (!video) return res.status(404).json({ success: false, message: "Video not found" });

  try {
    // 刪 S3 上的原檔
    if (video.rawKey) await storageS3.deleteObject(video.rawKey);
    // 刪 S3 上的轉碼檔（若有）
    if (video.transcodedKey) await storageS3.deleteObject(video.transcodedKey);

    // 刪 metadata
    videoModel.removeById(id);

    res.json({ success: true, message: "Video deleted" });
  } catch (e) {
    console.error("Remove error:", e);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

exports.getPresignedDownload = async (req, res) => {
  const id = req.params.id;
  const video = videoModel.findById(id);
  if (!video) return res.status(404).json({ success: false });

  const key = video.transcodedKey || video.rawKey;
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

exports.transcode = (req, res) => {
  const id = req.params.id;
  const { resolution = "720p", format = "gif" } = req.body;

  const video = videoModel.findById(id);
  if (!video) {
    return res.status(404).json({ success: false, message: "Video not found" });
  }

  videoModel.incrementTranscodes(id);

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
      videoModel.updateTranscoded(id, outputPath, format, video.status);
    })
    .on("error", (err) => {
      console.error("FFmpeg error:", err.message);
      video.status = "error";
      videoModel.updateStatus(id, "error");
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

exports.status = (req, res) => {
  const id = req.params.id;
  const video = videoModel.findById(id);

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
      created_at: video.created_at
    }
  });
};