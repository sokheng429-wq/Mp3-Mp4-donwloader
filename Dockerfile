FROM node:22-alpine

RUN apk add --no-cache ffmpeg python3 py3-pip
RUN pip3 install yt-dlp --break-system-packages

# Make sure yt-dlp is findable
RUN which yt-dlp || ln -s /usr/local/bin/yt-dlp /usr/bin/yt-dlp

ENV YT_DLP_PATH=/usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p downloads

EXPOSE 3000
CMD ["npm", "start"]