const { S3Client } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const region = process.env.AWS_REGION;
module.exports.s3 = new S3Client({ region });
module.exports.ddb = new DynamoDBClient({ region });