// scaleWorker.js (Lambda handler)

const {
  ECSClient,
  DescribeServicesCommand,
  UpdateServiceCommand,
} = require("@aws-sdk/client-ecs");

const {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} = require("@aws-sdk/client-cloudwatch");

const REGION = "ap-southeast-2";
const CLUSTER_ARN = "arn:aws:ecs:ap-southeast-2:901444280953:cluster/11530430-assignmnet03";
const SERVICE_NAME = "11530430-worker-task02-service";
const QUEUE_NAME = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11530430-transcode-jobs"; // 你的 SQS queue 名稱
const MAX_TASKS = 3;
const MIN_TASKS = 1;

// backlog 高於這個值，我們想 scale out
const SCALE_OUT_THRESHOLD = 10;

// backlog 低於這個值，我們想 scale in
const SCALE_IN_THRESHOLD = 1;

const ecs = new ECSClient({ region: REGION });
const cw = new CloudWatchClient({ region: REGION });

exports.handler = async () => {
  // 1. 讀 SQS backlog metric from CloudWatch
  const metricRes = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: "AWS/SQS",
      MetricName: "ApproximateNumberOfMessagesVisible",
      Dimensions: [{ Name: "QueueName", Value: QUEUE_NAME }],
      StartTime: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
      EndTime: new Date(),
      Period: 60, // 60s buckets
      Statistics: ["Average"],
    })
  );

  if (!metricRes.Datapoints || metricRes.Datapoints.length === 0) {
    console.log("No datapoints found for SQS metric, aborting");
    return;
  }

  // 取最近一個點
  const latest = metricRes.Datapoints.sort(
    (a,b) => new Date(b.Timestamp) - new Date(a.Timestamp)
  )[0];
  const backlog = latest.Average;
  console.log("Current backlog:", backlog);

  // 2. 讀目前 ECS service 的 desiredCount
  const desc = await ecs.send(
    new DescribeServicesCommand({
      cluster: CLUSTER_ARN,
      services: [SERVICE_NAME],
    })
  );

  const svc = desc.services && desc.services[0];
  if (!svc) {
    console.error("Service not found?");
    return;
  }

  let desired = svc.desiredCount;
  console.log("Current desiredCount:", desired);

  // 3. 決定要不要 scale
  let newDesired = desired;

  if (backlog >= SCALE_OUT_THRESHOLD && desired < MAX_TASKS) {
    newDesired = desired + 1;
  } else if (backlog <= SCALE_IN_THRESHOLD && desired > MIN_TASKS) {
    newDesired = desired - 1;
  }

  if (newDesired === desired) {
    console.log("No scaling action needed.");
    return;
  }

  console.log(`Updating desiredCount ${desired} -> ${newDesired}`);

  // 4. 更新 ECS service desiredCount
  await ecs.send(
    new UpdateServiceCommand({
      cluster: CLUSTER_ARN,
      service: SERVICE_NAME,
      desiredCount: newDesired,
    })
  );

  console.log("Scaling action complete.");
};