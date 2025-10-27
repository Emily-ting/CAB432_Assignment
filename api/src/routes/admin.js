const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { requireGroup } = require("../middleware/authorize");
const groups = require("../services/cognitoGroups");

// 建群組
router.post("/groups/:name", auth, requireGroup("Admin"), async (req, res) => {
  try {
    const r = await groups.createGroup(req.params.name, req.body?.description || "");
    res.json({ success: true, data: r });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// 加入群組
router.post("/groups/:name/users/:username", auth, requireGroup("Admin"), async (req, res) => {
  try {
    await groups.addUserToGroup(req.params.username, req.params.name);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

// 從群組移除
router.delete("/groups/:name/users/:username", auth, requireGroup("Admin"), async (req, res) => {
  try {
    await groups.removeUserFromGroup(req.params.username, req.params.name);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

module.exports = router;