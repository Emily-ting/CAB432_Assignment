const axios = require("axios");
const { getSecretJSON } = require("../aws/secrets");
const { getParam } = require("../aws/ssm");

const SECRET_ID = "n11530430/pexels";

let secret, PEXELS_BASE_URL, headers;

async function ensurePexels() {
  // 允許本機用 .env 覆蓋（開發方便）
  if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY;
  secret = await getSecretJSON(SECRET_ID);
  PEXELS_BASE_URL = await getParam("/n11530430/app/PEXELS_BASE_URL");
  console.log("api key: ", secret.PEXELS_API_KEY);
  console.log("pexels base url: ", PEXELS_BASE_URL);
  headers = { Authorization: PEXELS_API_KEY };
  return secret.PEXELS_API_KEY;
}

async function searchPhotos(query, perPage = 5) {
  try {
    await ensurePexels();
    const res = await axios.get(`${PEXELS_BASE_URL}/v1/search`, {
      headers,
      params: { query, per_page: perPage }
    });
    return res.data.photos || [];
  } catch (err) {
    console.error("Pexels Photo API error:", err.message);
    return [];
  }
}

async function searchVideos(query, perPage = 3) {
  try {
    await ensurePexels();
    const res = await axios.get(`${PEXELS_BASE_URL}/videos/search`, {
      headers,
      params: { query, per_page: perPage }
    });
    return res.data.videos || [];
  } catch (err) {
    console.error("Pexels Video API error:", err.message);
    return [];
  }
}

module.exports = { searchPhotos, searchVideos };