const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3 } = require("../aws/clients");
const fs = require("fs");
const path = require("path");

const BUCKET = process.env.S3_BUCKET;

exports.putFileFromDisk = async ({ localPath, key, contentType }) => {
  const Body = fs.createReadStream(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body, ContentType: contentType || "application/octet-stream"
  }));
  // 上傳成功後，可刪掉本地暫存
  try { fs.unlinkSync(localPath); } catch {}
  return { bucket: BUCKET, key };
};

exports.streamToResponse = async ({ key, res, downloadName }) => {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  res.setHeader('Content-Type', out.ContentType || 'application/octet-stream');
  if (downloadName) res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  out.Body.pipe(res);
};

exports.deleteObject = async (key) => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};