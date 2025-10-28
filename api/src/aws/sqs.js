// /api-service/src/aws/sqs.js
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { getParam } = require("./ssm"); // 你現有的 helper，用來從 Parameter Store 拿參數

// 例如你在 Parameter Store 裡存： /n11530430/app/SQS_QUEUE_URL
const SQS_PARAM_NAME = "/n11530430/app/SQS_TRANSCODE_QUEUE_URL";

let sqsClient;
let queueUrlCache;

async function ensureSqsClient() {
  if (!sqsClient) {
    const region = await getParam("/n11530430/app/REGION");
    sqsClient = new SQSClient({ region });
  }
  if (!queueUrlCache) {
    queueUrlCache = await getParam(SQS_PARAM_NAME);
  }
}

async function enqueueTranscodeJob(payloadObj) {
  await ensureSqsClient();

  const params = {
    QueueUrl: queueUrlCache,
    MessageBody: JSON.stringify(payloadObj),
  };

  await sqsClient.send(new SendMessageCommand(params));
}

module.exports = {
  enqueueTranscodeJob,
};