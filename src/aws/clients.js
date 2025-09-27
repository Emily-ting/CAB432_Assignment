const { S3Client } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const region = process.env.AWS_REGION || "ap-southeast-2";
module.exports.s3 = new S3Client({ region });
module.exports.ddb = new DynamoDBClient({ region });
module.exports.ddoc = DynamoDBDocumentClient.from(ddb);