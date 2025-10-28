require("dotenv").config();
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const ssm = new SSMClient({ region: REGION });

// 簡單 in-memory cache：key -> { value, expireAt }
const cache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 分鐘

async function getParam(name, { withDecryption = false, ttlMs = DEFAULT_TTL_MS } = {}) {
  const now = Date.now();
  const hit = cache.get(name);
  if (hit && hit.expireAt > now) return hit.value;

  const resp = await ssm.send(new GetParameterCommand({
    Name: name,
    WithDecryption: withDecryption
  }));
  const value = resp?.Parameter?.Value;
  cache.set(name, { value, expireAt: now + ttlMs });
  return value;
}

module.exports = { getParam };