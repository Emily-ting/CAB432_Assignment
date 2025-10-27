# /api-service/Dockerfile
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install deps first (better layer cache)
COPY package*.json ./
RUN npm install --only=production

# Copy the rest of the source
COPY . .

# Expose the port your Express server listens on
EXPOSE 3000

# Run the API
CMD ["node", "app.js"]