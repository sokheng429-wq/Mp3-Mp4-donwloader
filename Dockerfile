FROM node:22-alpine

# Install yt-dlp and ffmpeg
RUN apk add --no-cache ffmpeg python3 py3-pip
RUN pip3 install yt-dlp --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Create downloads folder
RUN mkdir -p downloads

EXPOSE 3000
CMD ["npm", "start"]