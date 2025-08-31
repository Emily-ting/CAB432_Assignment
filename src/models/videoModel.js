const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, './../data/videos.json');

function readVideos() {
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

function writeVideos(videos) {
  fs.writeFileSync(filePath, JSON.stringify(videos, null, 2));
}

exports.save = (file, owner, metadata = {}) => {
  const videos = readVideos();
  const newVideo = {
    id: Date.now(),
    original: file.originalname,
    filename: file.filename,
    path: file.path,
    owner,
    status: "uploaded",
    format: "mp4",
    created_at: new Date().toISOString(),
    downloads: 0,       // download counter
    transcodes: 0,      // transcode counter
    metadata   // save information from Pexels or other source
  };
  videos.push(newVideo);
  writeVideos(videos);
  return newVideo;
};

exports.findByOwner = (owner, query) => {
  const videos = readVideos();
  if (owner === "admit") {
    return videos;
  }
  return videos.filter(v => v.owner === owner);
};

exports.findById = (id) => {
  const videos = readVideos();
  return videos.find(v => v.id == id);
};

exports.removeById = (id) => {
  const videos = readVideos();
  const filtered = videos.filter(v => v.id != id);
  const deleted = filtered.length < videos.length; // check is delete successful
  writeVideos(filtered);
  return { deleted };
};

exports.updateTranscoded = (id, newPath, format, status) => {
  const videos = readVideos();
  const index = videos.findIndex(v => v.id == id);
  if (index !== -1) {
    videos[index].transcoded = newPath;
    videos[index].format = format;
    videos[index].status = status;
    writeVideos(videos);
  }
};

exports.updateStatus = (id, status) => {
  const videos = readVideos();
  const index = videos.findIndex(v => v.id == id);
  if (index !== -1) {
    videos[index].status = status;
    writeVideos(videos);
  }
};

exports.incrementDownloads = (id) => {
  const videos = readVideos();
  const index = videos.findIndex(v => v.id == id);
  if (index !== -1) {
    videos[index].downloads = (videos[index].downloads || 0) + 1;
    writeVideos(videos);
  }
};

exports.incrementTranscodes = (id) => {
  const videos = readVideos();
  const index = videos.findIndex(v => v.id == id);
  if (index !== -1) {
    videos[index].transcodes = (videos[index].transcodes || 0) + 1;
    writeVideos(videos);
  }
};