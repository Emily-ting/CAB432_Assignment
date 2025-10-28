FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY worker.js ./
COPY src ./src

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

CMD ["node", "worker.js"]