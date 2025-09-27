const cognito = require("../services/cognito");

exports.signup = async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email)
      return res.status(400).json({ success: false, message: "username, password, email required" });

    const resp = await cognito.signUp({ username, password, email });
    res.json({ success: true, data: { userConfirmed: resp.UserConfirmed, username: resp.UserSub } });
  } catch (e) {
    console.error("signup error:", e);
    res.status(400).json({ success: false, message: e.message || "signup failed" });
  }
};

exports.confirm = async (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code)
      return res.status(400).json({ success: false, message: "username, code required" });

    await cognito.confirmSignUp({ username, code });
    res.json({ success: true, message: "confirmed" });
  } catch (e) {
    console.error("confirm error:", e);
    res.status(400).json({ success: false, message: e.message || "confirm failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: "username, password required" });

    const result = await cognito.login({ username, password });
    // 你可以選擇只回 IdToken，或全回
    res.json({
      success: true,
      tokens: {
        idToken: result.IdToken,
        accessToken: result.AccessToken,
        refreshToken: result.RefreshToken,
        expiresIn: result.ExpiresIn,
        tokenType: result.TokenType,
      },
    });
  } catch (e) {
    console.error("login error:", e);
    res.status(400).json({ success: false, message: e.message || "login failed" });
  }
};