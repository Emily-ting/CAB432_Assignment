FROM node:20

WORKDIR /usr/src/app

RUN apt-get clean && apt-get update -y && apt-get install -y ffmpeg

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]