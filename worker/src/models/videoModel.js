const fs = require('fs');
const path = require('path');
const { ddoc } = require("../aws/clients");
const { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE = process.env.DDB_TABLE;
const QUT  = process.env.QUT_USERNAME;
const SK   = "sk";

function makeSk(owner, id) {
  return `video#${owner}#${id}`;
}

exports.save = (file, owner) => {
  const id = Date.now().toString();
  const item = {
    "qut-username": QUT,
    [SK]: makeSk(owner, id),
    id: id,
    original: file.originalname,
    filename: file.filename,
    path: file.path,
    rawKey: file.path || file.rawKey || file.key,
    transcodedKey: file.transcoded || file.transcodedKey,
    owner,
    status: "uploaded",
    format: "mp4",
    createdAt: new Date().toISOString(),
    counts: { downloads: 0, transcodes: 0 },
    metadata: file.metadata || {}   // save information from Pexels or other source
  };
  return ddoc.send(new PutCommand({ TableName: TABLE, Item: item })).then(() => item);
};

exports.findByOwner = async (owner, query) => {
  const prefix = `video#${owner}#`;
  const res = await ddoc.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "#pk = :me AND begins_with(#sk, :prefix)",
    ExpressionAttributeNames:  { "#pk": "qut-username", "#sk": SK },
    ExpressionAttributeValues: { ":me": QUT, ":prefix": prefix },
    Limit: Number(query.limit || 50)
  }));
  // 簡單排序：createdAt desc（若你 sk 含 createdAt 就不用 sort）
  const items = (res.Items || []).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  // const items = res.Items || [];
  return items;
};

exports.findById = async (id, owner) => {
  const r = await ddoc.send(new GetCommand({
    TableName: TABLE,
    Key: { "qut-username": QUT, [SK]: makeSk(owner, id) }
  }));
  return r.Item || null;
};

exports.findAll = async (query) => {
  const res = await ddoc.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression: "begins_with(#sk, :prefix)",
      ExpressionAttributeNames: { "#sk": "sk" },
      ExpressionAttributeValues: { ":prefix": "video#" },
      Limit: Number(query.limit || 100), // 這裡可以加 limit，避免拉太多
    })
  );
  return res.Items || [];
};

exports.removeById = async (id, owner) => {
  await ddoc.send(new DeleteCommand({
    TableName: TABLE,
    Key: { "qut-username": QUT, [SK]: makeSk(owner, id) }
  }));
  return { deleted: true };
};

exports.updateTranscoded = async (id, newKey, format, status, owner) => {
  await ddoc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { "qut-username": QUT, [SK]: makeSk(owner, id) },
    UpdateExpression: "SET transcodedKey = :k, #f = :f, #s = :s",
    ExpressionAttributeNames:  { "#f": "format", "#s": "status" },
    ExpressionAttributeValues: { ":k": newKey, ":f": format, ":s": status }
  }));
};

exports.updateStatus = async (id, status, owner) => {
  await ddoc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { "qut-username": QUT, [SK]: makeSk(owner, id) },
    UpdateExpression: "SET #s = :s",
    ExpressionAttributeNames:  { "#s": "status" },
    ExpressionAttributeValues: { ":s": status }
  }));
};

exports.incrementDownloads = async (id, owner) => {
  await ddoc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { "qut-username": QUT, [SK]: makeSk(owner, id) },
    UpdateExpression: `ADD counts.downloads :one`,
    ExpressionAttributeValues: { ":one": 1 }
  }));
};

exports.incrementTranscodes = async (id, owner) => {
  await ddoc.send(new UpdateCommand({
    TableName: TABLE,
    Key: { "qut-username": QUT, [SK]: makeSk(owner, id) },
    UpdateExpression: `ADD counts.transcodes :one`,
    ExpressionAttributeValues: { ":one": 1 }
  }));
};