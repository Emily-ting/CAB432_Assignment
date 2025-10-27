# worker-service/Dockerfile
FROM node:20-bullseye

WORKDIR /usr/src/app

# Install system ffmpeg (for fluent-ffmpeg to call)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy package metadata and install deps
COPY package*.json ./
RUN npm install --only=production

# Copy the rest of the worker code
COPY . .

# The worker doesn't expose HTTP. It just runs forever.
CMD ["node", "worker.js"]