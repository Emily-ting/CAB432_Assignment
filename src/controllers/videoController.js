const videoModel = require("../models/videoModel");
const path = require("path");
const fs = require('fs');
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

exports.upload = (req, res) => {
  const video = videoModel.save(req.file, req.user.username);
  res.json({ success: true, data: video });
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

exports.download = (req, res) => {
  const id = req.params.id;
  const video = videoModel.findById(id);

  if (!video) {
    return res.status(404).json({ success: false, message: "Video not found" });
  }

  const absolutePath = path.resolve(video.path);
  res.download(absolutePath, video.original, (err) => {
    if (err) {
      console.error("Download error:", err);
      return res.status(500).json({ success: false, message: "Download failed" });
    }
  });

  videoModel.incrementDownloads(id);
};

exports.remove = (req, res) => {
  const id = req.params.id;
  const video = videoModel.findById(id);

  if (!video) {
    return res.status(404).json({ success: false, message: "Video not found" });
  }

  // path of file
  const filePath = path.resolve(video.path); // assume model.save() save the path of file

  // delete file
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("File deletion error:", err);
      return res.status(500).json({ success: false, message: "File deletion failed" });
    }

    // remove data from database
    videoModel.removeById(id);

    res.json({ success: true, message: "Video deleted successfully" });
  });
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