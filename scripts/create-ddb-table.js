// scripts/create-ddb-table.js
require("dotenv").config();
const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");

const region = process.env.AWS_REGION || "ap-southeast-2";
const tableName = process.env.DDB_TABLE || "n1234567-videos";

// 主鍵設計（課程要求 PK = qut-username；SK 我們用 sk）
const PK = "qut-username";
const SK = "sk";

async function createTableIfNotExists() {
  const client = new DynamoDBClient({ region });

  // 先檢查是否已存在
  try {
    const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table "${tableName}" already exists. Status: ${desc.Table?.TableStatus}`);
    return;
  } catch (e) {
    if (e.name !== "ResourceNotFoundException") {
      console.error("DescribeTable error:", e);
      process.exit(1);
    }
  }

  const command = new CreateTableCommand({
    TableName: tableName,
    AttributeDefinitions: [
      { AttributeName: PK, AttributeType: "S" }, // partition key: qut-username
      { AttributeName: SK, AttributeType: "S" }, // sort key: sk
    ],
    KeySchema: [
      { AttributeName: PK, KeyType: "HASH" },  // HASH = partition key
      { AttributeName: SK, KeyType: "RANGE" }, // RANGE = sort key
    ],
    // 課程示範使用預留型 1/1；也可改 On-Demand（需要用 BillingMode: "PAY_PER_REQUEST"）
    ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
  });

  try {
    const res = await client.send(command);
    console.log("CreateTable response:", res.TableDescription?.TableStatus || res);
    console.log(`Creating table "${tableName}" ...`);
  } catch (e) {
    console.error("CreateTable error:", e);
    process.exit(1);
  }
}

createTableIfNotExists();