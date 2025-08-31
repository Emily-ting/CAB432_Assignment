const pexelsService = require("../services/pexelsService");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const videoModel = require("../models/videoModel");

exports.searchVideos = async (req, res) => {
  const { query = "nature" } = req.query;

  const videos = await pexelsService.searchVideos(query, 2);

  // only return some part of information
  const results = videos.map(v => ({
    id: v.id,
    url: v.url,
    duration: v.duration,
    user: v.user.name,
    video_files: v.video_files.map(f => ({
      quality: f.quality,
      link: f.link
    }))
  }));

  res.json({ success: true, data: results });
};

exports.downloadVideo = async (req, res) => {
  const { url } = req.body;
  const owner = req.user.username; // get user name from JWT

  if (!url) {
    return res.status(400).json({ success: false, message: "Missing video url" });
  }

  try {
    // make sure directer is exist
    fs.mkdirSync("downloads", { recursive: true });

    const filename = `pexels-${Date.now()}.mp4`;
    const filePath = path.join("downloads", filename);

    // download video
    const response = await axios.get(url, { responseType: "stream" });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      // save by videoModel
      const video = videoModel.save(
        { 
          originalname: filename,
          filename,
          path: filePath
        },
        owner,
        { source: "Pexels", url } // save metadata for Pexel video
      );

      res.json({ success: true, data: video });
    });

    writer.on("error", err => {
      console.error("File save error:", err);
      res.status(500).json({ success: false, message: "File save failed" });
    });

  } catch (err) {
    console.error("Pexels download error:", err.message);
    res.status(500).json({ success: false, message: "Failed to download video" });
  }
};