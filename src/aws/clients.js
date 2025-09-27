require('dotenv').config();
const { S3Client } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const region = process.env.AWS_REGION || "ap-southeast-2";
const s3 = new S3Client({ region });
const ddb = new DynamoDBClient({ region });
const ddoc = DynamoDBDocumentClient.from(ddb);

module.exports = { s3, ddb, ddoc };