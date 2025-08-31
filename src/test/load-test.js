const axios = require("axios");

const API_URL = "http://localhost:3000/api/v1/videos/transcode";
const VIDEO_ID = "1756350222023";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWl0IiwiaWF0IjoxNzU2NTM2MTgwLCJleHAiOjE3NTY1Mzk3ODB9.j4ELRsE6AcQVcqWWrnc09kUt_D-V4LsuQXltBdcwnbE"; // get JWT by login

const axiosInstance = axios.create({
  timeout: 30000, // 30 sec
});

// how many request will be sent at the same time
const CONCURRENCY = 1;

async function transcodeTask(i) {
  try {
    const res = await axiosInstance.post(
      `${API_URL}/${VIDEO_ID}`,
      { resolution: "1080p", format: "mp4", codec: "libx264", preset: "veryslow", crf: 28 },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(`Task ${i} started:`, res.data.message);
  } catch (err) {
    console.error(`Task ${i} error:`, err);
    // console.error(`Task ${i} error:`, err.response?.data || err.message);
  }
}

async function runLoadTest() {
  let count = 0;
  setInterval(async () => {
    const promises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      promises.push(transcodeTask(count++));
    }
    await Promise.all(promises);
  }, 2000); // 每 2 秒一批
}

// async function runLoadTest() {
//   let count = 0;
//   // send CONCURRENCY amount of request per sec
//   setInterval(() => {
//     for (let i = 0; i < CONCURRENCY; i++) {
//       transcodeTask(count++);
//     }
//   }, 1000);
// }

runLoadTest();