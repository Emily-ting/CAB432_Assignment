const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const SECRET = process.env.JWT_SECRET || "secret123";

// hardcode
const users = [
  { username: "admit", password: "123" },
  { username: "user", password: "456" }
];

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  // sign JWT
  const token = jwt.sign({ username: user.username }, SECRET, { expiresIn: "1h" });

  res.json({ success: true, token });
});

module.exports = router;