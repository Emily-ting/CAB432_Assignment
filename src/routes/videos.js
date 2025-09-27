const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const videoController = require("../controllers/videoController");
const videoModel = require("../models/videoModel");
const auth = require("../middleware/authMiddleware");
const { requireGroup, requireOwnerOrGroup } = require("../middleware/authorize");

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
router.get("/all", auth, requireGroup("Admin"), videoController.listAll);
router.get("/download/:id", auth, videoController.download);
router.get("/:id/presign", auth, videoController.getPresignedDownload);
router.delete(
  "/remove/:id",
  auth,
  requireOwnerOrGroup(
    async (req) => {
      // 回傳這支影片的 owner（username）
      const v = await videoModel.findById(req.params.id, req.user.username);
      return v?.owner;
    },
    "Admin"
  ),
  videoController.remove
);
router.post("/transcode/:id", auth, videoController.transcode);
router.get("/transcode/status/:id", auth, videoController.status);

module.exports = router;