const cognito = require("../services/cognito");

exports.signup = async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password || !email) {
      return res.status(400).json({ success: false, message: "username, password, email required" });
    }
    const r = await cognito.signUp({ username, password, email });
    res.json({ success: true, data: { userConfirmed: r.UserConfirmed, userSub: r.UserSub } });
  } catch (e) {
    console.error("signup error:", e);
    res.status(400).json({ success: false, message: e.message || "signup failed" });
  }
};

exports.confirm = async (req, res) => {
  try {
    const { username, code } = req.body || {};
    if (!username || !code) {
      return res.status(400).json({ success: false, message: "username, code required" });
    }
    await cognito.confirmSignUp({ username, code });
    res.json({ success: true, message: "confirmed" });
  } catch (e) {
    console.error("confirm error:", e);
    res.status(400).json({ success: false, message: e.message || "confirm failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "username, password required" });
    }
    const tokens = await cognito.login({ username, password });
    res.json({ success: true, tokens });
  } catch (e) {
    console.error("login error:", e);
    res.status(400).json({ success: false, message: e.message || "login failed" });
  }
};