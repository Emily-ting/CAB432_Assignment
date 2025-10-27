// worker-service/worker.js

// --- imports & setup ---
const os = require("os");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

// reuse your helpers (copied into worker-service/src)
const { getParam } = require("./src/aws/ssm");           // must exist in worker-service
const videoModel = require("./src/models/videoModel");  // must exist in worker-service
const storageS3 = require("./src/services/storageS3");  // must exist in worker-service

// cache config + AWS clients
let REGION;
let BUCKET;
let QUEUE_URL;
let sqs;
let s3;

// 1. Load config from SSM Parameter Store and init AWS SDK clients
async function initConfig() {
  if (!REGION) {
    REGION = await getParam("/n11530430/app/REGION");
  }
  if (!BUCKET) {
    BUCKET = await getParam("/n11530430/app/S3_BUCKET");
  }
  if (!QUEUE_URL) {
    QUEUE_URL = await getParam("/n11530430/app/SQS_QUEUE_URL");
  }
  if (!sqs) {
    sqs = new SQSClient({ region: REGION });
  }
  if (!s3) {
    s3 = new S3Client({ region: REGION });
  }

  console.log("[worker:init] REGION:", REGION);
  console.log("[worker:init] BUCKET:", BUCKET);
  console.log("[worker:init] QUEUE_URL:", QUEUE_URL);
}

// helper: download S3 object (srcKey) to local file
async function downloadS3ToFile(srcKey, localPath) {
  console.log("[worker] downloading from S3:", srcKey, "=>", localPath);

  const resp = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: srcKey,
  }));

  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(localPath);
    resp.Body.on("error", reject).pipe(ws)
      .on("error", reject)
      .on("finish", resolve);
  });

  console.log("[worker] download complete:", localPath);
}

// helper: run ffmpeg to transcode
async function runFfmpeg(inFile, outFile, resolution, format) {
  console.log("[worker] ffmpeg start", { inFile, outFile, resolution, format });

  // pick size by resolution
  let size;
  if (resolution === "1080p") size = "1920x1080";
  else if (resolution === "720p") size = "1280x720";
  else size = "640x480";

  await new Promise((resolve, reject) => {
    let cmd = ffmpeg(inFile)
      .size(size)
      .toFormat(format)
      .outputOptions(["-y"]) // overwrite output if exists
      .on("start", (c) => {
        console.log("[ffmpeg] cmd:", c);
      })
      .on("stderr", (line) => {
        console.log("[ffmpeg]", line);
      })
      .on("end", () => {
        console.log("[worker] ffmpeg done:", outFile);
        resolve();
      })
      .on("error", (err) => {
        console.error("[ffmpeg] error:", err);
        reject(err);
      });

    if (format === "mp4") {
      cmd = cmd
        .videoCodec("libx264")
        .outputOptions(["-preset veryfast", "-crf 26", "-movflags +faststart"]);
    } else if (format === "webm") {
      cmd = cmd
        .videoCodec("libvpx-vp9")
        .outputOptions(["-b:v 0", "-crf 33"]);
    } else if (format === "gif") {
      // keep short to limit CPU
      cmd = cmd.duration(5);
    }

    cmd.save(outFile);
  });
}

// helper: handle one SQS message (one job)
async function processJobMessage(message) {
  // 1) Parse job
  let job;
  try {
    job = JSON.parse(message.Body);
  } catch (err) {
    console.error("[worker] invalid message body, not JSON:", message.Body);
    throw err;
  }

  console.log("[worker] got job:", job);

  // we only handle action === "transcode"
  if (job.action !== "transcode") {
    console.warn("[worker] unsupported action:", job.action);
    return;
  }

  const { videoId, owner, srcKey, filename, resolution, format } = job;
  if (!videoId || !owner || !srcKey) {
    throw new Error("job missing required fields (videoId/owner/srcKey)");
  }

  // mark status "processing"
  await videoModel.updateStatus(videoId, "processing", owner);

  // 2) prep temp paths
  const tempDir = os.tmpdir();
  const baseName = path.basename(filename || "video", path.extname(filename || ".mp4"));
  const inLocal = path.join(tempDir, `in-${videoId}-${Date.now()}${path.extname(filename || ".mp4")}`);
  const outLocal = path.join(tempDir, `out-${videoId}-${Date.now()}.${format || "mp4"}`);

  // 3) download source from S3
  await downloadS3ToFile(srcKey, inLocal);

  // 4) run ffmpeg transcode
  await runFfmpeg(inLocal, outLocal, resolution || "720p", format || "mp4");

  // 5) upload back to S3 under /transcoded/<owner>/
  const outKey = `transcoded/${owner}/${baseName}-${Date.now()}.${format || "mp4"}`;
  const fileBuf = await fsp.readFile(outLocal);
  const contentType =
    format === "mp4"
      ? "video/mp4"
      : format === "webm"
      ? "video/webm"
      : format === "gif"
      ? "image/gif"
      : "application/octet-stream";

  await storageS3.putBuffer({
    key: outKey,
    body: fileBuf,
    contentType,
  });

  console.log("[worker] uploaded transcoded file to:", outKey);

  // 6) cleanup /tmp files
  fsp.unlink(inLocal).catch(() => {});
  fsp.unlink(outLocal).catch(() => {});

  // 7) update DynamoDB metadata
  //    - set transcodedKey
  //    - set status "done"
  await videoModel.updateTranscoded(videoId, outKey, format || "mp4", "done", owner);

  // 8) bump transcode count
  await videoModel.incrementTranscodes(videoId, owner);

  console.log("[worker] job complete for", videoId);
}

// helper: delete message after successful processing
async function deleteMessage(receiptHandle) {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle,
    })
  );
}

// main polling loop
async function pollLoop() {
  await initConfig();

  console.log("[worker] starting poll loop...");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Long poll SQS for up to 1 message at a time.
      // You can increase MaxNumberOfMessages to let one worker batch multiple jobs.
      const resp = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 10, // long polling
          VisibilityTimeout: 60, // seconds to "lock" the message while processing
        })
      );

      const messages = resp.Messages || [];
      if (messages.length === 0) {
        // no work, idle
        continue;
      }

      for (const msg of messages) {
        console.log("[worker] received SQS message:", msg.MessageId);
        try {
          await processJobMessage(msg);
          await deleteMessage(msg.ReceiptHandle);
          console.log("[worker] message", msg.MessageId, "done+deleted");
        } catch (jobErr) {
          console.error("[worker] failed processing message", msg.MessageId, jobErr);
          // IMPORTANT:
          // do NOT delete the message on error.
          // SQS will make it visible again after VisibilityTimeout,
          // so it can be retried or end up in DLQ if you configure redrive.
        }
      }
    } catch (loopErr) {
      console.error("[worker] pollLoop error:", loopErr);
      // short sleep to avoid tight error loop
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// kick it off
pollLoop().catch((e) => {
  console.error("[worker] fatal error in pollLoop:", e);
  process.exit(1);
});