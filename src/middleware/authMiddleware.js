const cognito = require("../services/cognito");

module.exports = async function (req, res, next) {
  try {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing Bearer token" });
    }
    const token = h.slice("Bearer ".length).trim();
    const payload = await cognito.verifyIdToken(token);

    // 你可以選擇用 email 或 cognito:username 當作 app 的 username
    req.user = {
      sub: payload.sub,
      username: payload["cognito:username"],
      email: payload.email,
    };
    return next();
  } catch (e) {
    console.error("auth middleware error:", e);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};