const express = require("express");
const router = express.Router();
const pexelsController = require("../controllers/pexelsController");
const auth = require("../middleware/authMiddleware");

router.get("/videos", auth, pexelsController.searchVideos);
router.post("/download", auth, pexelsController.downloadVideo);

module.exports = router;