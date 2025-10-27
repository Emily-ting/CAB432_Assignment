#!/bin/bash
set -e

#####################################
# CONFIG (請依自己情況調整下面變數)
#####################################

AWS_REGION="ap-southeast-2"

# ECR repository names
API_REPO="11530430-assignment03-api"
WORKER_REPO="11530430-assignment03-worker"

# Local build contexts (Dockerfile 路徑所在資料夾)
API_CONTEXT="./api"
WORKER_CONTEXT="./worker"

# Local image tags after build
API_LOCAL_TAG="api:latest"
WORKER_LOCAL_TAG="worker:latest"


#####################################
# DO NOT EDIT BELOW UNLESS NEEDED
#####################################

echo "=== Getting AWS Account ID ==="
ACCOUNT_ID="901444280953"
if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ 無法取得 AWS Account ID，請先確認你有 aws configure / sso login"
  exit 1
fi
echo "Account: $ACCOUNT_ID"

API_REMOTE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_REPO}:latest"
WORKER_REMOTE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WORKER_REPO}:latest"

echo
echo "=== [Step 1] 確認 ECR repositories 存在 (如果沒有會建立) ==="

aws ecr describe-repositories \
  --repository-names "${API_REPO}" \
  --region "${AWS_REGION}" >/dev/null 2>&1 || {
    echo " -> 建立 ${API_REPO}"
    aws ecr create-repository \
      --repository-name "${API_REPO}" \
      --region "${AWS_REGION}" \
      --tags Key=qut-username,Value=n11530430@qut.edu.au Key=purpose,Value=a3
  }

aws ecr describe-repositories \
  --repository-names "${WORKER_REPO}" \
  --region "${AWS_REGION}" >/dev/null 2>&1 || {
    echo " -> 建立 ${WORKER_REPO}"
    aws ecr create-repository \
      --repository-name "${WORKER_REPO}" \
      --region "${AWS_REGION}" \
      --tags Key=qut-username,Value=n11530430@qut.edu.au Key=purpose,Value=a3
  }

echo
echo "=== [Step 2] Docker build ==="

echo " -> Building API service (${API_LOCAL_TAG}) from ${API_CONTEXT}"
docker build -t "${API_LOCAL_TAG}" "${API_CONTEXT}"

echo " -> Building Worker service (${WORKER_LOCAL_TAG}) from ${WORKER_CONTEXT}"
docker build -t "${WORKER_LOCAL_TAG}" "${WORKER_CONTEXT}"

echo
echo "=== [Step 3] Login to ECR ==="
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo
echo "=== [Step 4] Tag images for ECR ==="

echo " -> Tagging API service ${API_LOCAL_TAG} as ${API_REMOTE}"
docker tag "${API_LOCAL_TAG}" "${API_REMOTE}"

echo " -> Tagging Worker service ${WORKER_LOCAL_TAG} as ${WORKER_REMOTE}"
docker tag "${WORKER_LOCAL_TAG}" "${WORKER_REMOTE}"

echo
echo "=== [Step 5] Push to ECR ==="

echo " -> Pushing ${API_REMOTE}"
docker push "${API_REMOTE}"

echo " -> Pushing ${WORKER_REMOTE}"
docker push "${WORKER_REMOTE}"

echo
echo "✅ Done! All images built & pushed successfully."
echo "   API image:    ${API_REMOTE}"
echo "   Worker image: ${WORKER_REMOTE}"