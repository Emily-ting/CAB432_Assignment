const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const videoController = require("../controllers/videoController");
const auth = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // save originalname and basename
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, baseName + "-" + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

router.post("/upload", auth, upload.single("video"), videoController.upload);
router.get("/", auth, videoController.list);
router.get("/download/:id", auth, videoController.download);
router.get("/:id/presign", auth, videoController.getPresignedDownload);
router.delete("/remove/:id", auth, videoController.remove);
router.post("/transcode/:id", auth, videoController.transcode);
router.get("/transcode/status/:id", auth, videoController.status);

module.exports = router;