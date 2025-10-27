const fs = require("fs");
const fsp = fs.promises;
const util = require("util");
const stream = require("stream");
const pipeline = util.promisify(stream.pipeline);

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// 從 Parameter Store 取值
const { getParam } = require("../aws/ssm");

// 你在 SSM 放的參數名稱（依你的命名調整）
const PARAM_REGION = "/n11530430/app/REGION";
const PARAM_BUCKET = "/n11530430/app/S3_BUCKET";

let s3 = null;
let REGION = null;
let BUCKET = null;

async function ensureS3() {
  if (s3 && REGION && BUCKET) return { s3, REGION, BUCKET };

  // 只在第一次呼叫時讀取，之後快取
  REGION = await getParam(PARAM_REGION);
  BUCKET = await getParam(PARAM_BUCKET);

  if (!REGION) throw new Error(`SSM param ${PARAM_REGION} is empty`);
  if (!BUCKET) throw new Error(`SSM param ${PARAM_BUCKET} is empty`);

  s3 = new S3Client({ region: REGION });
  console.log("[S3] ready via SSM. REGION:", REGION, "BUCKET:", BUCKET);
  return { s3, BUCKET };
}

async function putFileFromDisk({ localPath, key, contentType }) {
  const { s3, BUCKET } = await ensureS3();
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fs.createReadStream(localPath),
    ContentType: contentType || "application/octet-stream",
  }));
}

async function putBuffer({ key, body, contentType }) {
  const { s3, BUCKET } = await ensureS3();
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || "application/octet-stream",
  }));
}

async function streamToResponse({ key, res, downloadName }) {
  const { s3, BUCKET } = await ensureS3();
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  res.setHeader("Content-Type", r.ContentType || "application/octet-stream");
  if (downloadName) res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  await pipeline(r.Body, res);
}

async function deleteObject(key) {
  const { s3, BUCKET } = await ensureS3();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function getPresignedUrl(key, expiresInSec = 3600) {
  const { s3, BUCKET } = await ensureS3();
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

module.exports = {
  ensureS3,
  putFileFromDisk,
  putBuffer,
  streamToResponse,
  deleteObject,
  getPresignedUrl,
};