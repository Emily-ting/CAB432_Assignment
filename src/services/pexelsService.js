const axios = require("axios");

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_BASE_URL = "https://api.pexels.com";

console.log("api kek: ", PEXELS_API_KEY);

const headers = {
  Authorization: PEXELS_API_KEY
};

async function searchPhotos(query, perPage = 5) {
  try {
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