// src/services/queue.js
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { getParam } = require("../aws/ssm"); // 你已經有這個 for Parameter Store

let sqs;
let QUEUE_URL;

async function ensureQueue() {
  if (!sqs || !QUEUE_URL) {
    const region = await getParam("/n11530430/app/REGION");
    QUEUE_URL = await getParam("/n11530430/app/SQS_TRANSCODE_QUEUE_URL");
    sqs = new SQSClient({ region });
  }
}

// 呼叫這個來推一個轉碼任務
exports.enqueueTranscodeJob = async ({ videoId, owner, targetFormat, resolution }) => {
  await ensureQueue();

  const payload = {
    videoId,
    owner,
    targetFormat,
    resolution,
    requestedAt: new Date().toISOString()
  };

  const cmd = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(payload),
  });

  await sqs.send(cmd);
  return { enqueued: true };
};