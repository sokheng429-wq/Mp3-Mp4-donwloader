FROM node:22-alpine

# ffmpeg is required to merge video+audio (mp4) and to convert audio (mp3).
# python3/pip are needed to install yt-dlp.
RUN apk add --no-cache ffmpeg python3 py3-pip

# Install yt-dlp. pip places the console script on PATH (e.g. /usr/local/bin),
# so a bare "yt-dlp" spawn resolves it. Verify the install at build time.
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp \
    && yt-dlp --version

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p downloads

EXPOSE 3000
# Render provides $PORT; bind Next.js to it (defaults to 3000 locally).
CMD ["sh", "-c", "npm start -- -p ${PORT:-3000}"]
