const cognito = require("../services/cognito");

module.exports = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing Bearer token" });
    }
    const token = auth.slice(7).trim();
    const payload = await cognito.verifyIdToken(token);

    // 這裡把 Cognito 的資訊塞進 req.user，供你現有程式使用
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