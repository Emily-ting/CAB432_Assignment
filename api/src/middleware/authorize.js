exports.requireGroup = (...groups) => (req, res, next) => {
  const userGroups = req.user?.groups || [];
  const ok = groups.some(g => userGroups.includes(g));
  if (!ok) return res.status(403).json({ success: false, message: "Forbidden" });
  next();
};

// 擁有者或某群組（例如 Admin）均可
exports.requireOwnerOrGroup = (getOwnerFn, ...groups) => async (req, res, next) => {
  try {
    const isGroupOk = (req.user?.groups || []).some(g => groups.includes(g));
    if (isGroupOk) return next();
    const owner = await getOwnerFn(req, res); // 回傳字串（owner username）
    if (owner && owner === req.user?.username) return next();
    return res.status(403).json({ success: false, message: "Forbidden" });
  } catch (e) {
    console.error("requireOwnerOrGroup", e);
    return res.status(500).json({ success: false, message: "Auth check failed" });
  }
};