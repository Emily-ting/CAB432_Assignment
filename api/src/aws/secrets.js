require("dotenv").config();
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const sm = new SecretsManagerClient({ region: REGION });

const cache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

async function getSecretJSON(secretId, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const now = Date.now();
  const hit = cache.get(secretId);
  if (hit && hit.expireAt > now) return hit.value;

  const r = await sm.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = r.SecretString ? JSON.parse(r.SecretString) : {};
  cache.set(secretId, { value, expireAt: now + ttlMs });
  return value;
}

module.exports = { getSecretJSON };