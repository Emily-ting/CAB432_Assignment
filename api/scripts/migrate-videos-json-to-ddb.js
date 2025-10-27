require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const region = process.env.AWS_REGION || 'ap-southeast-2';
const TABLE  = process.env.DDB_TABLE;
const QUT    = process.env.QUT_USERNAME;
const SK     = 'sk';

const ddoc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

function makeSk(owner, id) {
  return `video#${owner}#${id}`;
}

async function main() {
  const jsonPath = path.join(__dirname, '../src/data/videos.json');
  if (!fs.existsSync(jsonPath)) return console.log('No local videos.json to migrate');

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  for (const v of items) {
    const owner = v.owner || 'unknown';
    const id    = String(v.id || Date.now());
    const item = {
      "qut-username": QUT,
      [SK]: makeSk(owner, id),
      id,
      owner,
      original: v.original,
      filename: v.filename,
      path: v.path,
      rawKey:   v.rawKey || v.path,             // 你之前可能把 S3 key 存在 path
      transcodedKey: v.transcoded || v.transcodedKey,
      status:  v.status || 'uploaded',
      format:  v.format || 'mp4',
      createdAt: v.created_at || v.createdAt || new Date().toISOString(),
      counts: v.counts || { downloads: 0, transcodes: 0 },
      metadata: v.metadata || {}
    };
    await ddoc.send(new PutCommand({ TableName: TABLE, Item: item }));
    console.log('Migrated:', id);
  }
  console.log('Done.');
}
main();
