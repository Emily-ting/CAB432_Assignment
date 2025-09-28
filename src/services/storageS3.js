const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getParam } = require("../aws/ssm");
const stream = require("stream");
const util = require("util");
const fs = require("fs");
const path = require("path");

let s3, BUCKET, REGION;

async function ensureS3() {
  if (s3 && BUCKET && REGION) return;
  REGION = await getParam("/n11530430/app/REGION");
  BUCKET = await getParam("/n11530430/app/S3_BUCKET");
  console.log("REGION:", REGION, ", BUCKET:", BUCKET);
  s3 = new S3Client({ region: REGION });
}
exports.ensureS3 = ensureS3;

exports.getPresignedUrl = async (key, expiresIn = 3600) => {
  await ensureS3();
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
};

exports.putBuffer = async ({ key, body, contentType }) => {
  await ensureS3();
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return { bucket: BUCKET, key };
};

exports.putFileFromDisk = async ({ localPath, key, contentType }) => {
  await ensureS3();
  const Body = fs.createReadStream(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body, ContentType: contentType || "application/octet-stream"
  }));
  // 上傳成功後，可刪掉本地暫存
  try { fs.unlinkSync(localPath); } catch {}
  return { bucket: BUCKET, key };
};

exports.streamToResponse = async ({ key, res, downloadName }) => {
  await ensureS3();
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  res.setHeader('Content-Type', out.ContentType || 'application/octet-stream');
  if (downloadName) res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  const pipeline = util.promisify(stream.pipeline);
  await pipeline(r.Body, res);
};

exports.deleteObject = async (key) => {
  await ensureS3();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};