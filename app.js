require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());
const VERSION = "v1";
const videosRouter = require("./src/routes/videos");
app.use(`/api/${VERSION}/auth`, require("./src/routes/auth"));
app.use(`/api/${VERSION}/videos`, require("./src/routes/videos"));
app.use(`/api/${VERSION}/pexels`, require("./src/routes/pexels"));
// app.use(`/api/${VERSION}/transcode`, require("./src/routes/transcode"));

// console.log(`/api/${VERSION}/videos`, videosRouter);

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
