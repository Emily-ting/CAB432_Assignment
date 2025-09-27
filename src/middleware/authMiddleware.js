const cognito = require("../services/cognito");

module.exports = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return res.status(401).json({ success: false, message: "Missing Bearer token" });

    const token = auth.slice(7).trim();
    const payload = await cognito.verifyIdToken(token);

    req.user = {
      sub: payload.sub,
      username: payload["cognito:username"],
      email: payload.email,
      groups: Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"] : [],
    };
    next();
  } catch (e) {
    console.error("auth middleware error:", e);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};