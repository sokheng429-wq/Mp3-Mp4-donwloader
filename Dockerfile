FROM node:22-alpine

# ffmpeg is required to merge video+audio (mp4) and to convert audio (mp3).
# python3/pip are needed to install yt-dlp.
RUN apk add --no-cache ffmpeg python3 py3-pip

# Install yt-dlp. On Alpine, pip places the console script in /usr/bin.
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Guarantee yt-dlp is resolvable from PATH under both common locations,
# so a bare "yt-dlp" spawn works regardless of where pip put it.
RUN YT=$(command -v yt-dlp) \
    && ln -sf "$YT" /usr/local/bin/yt-dlp \
    && ln -sf "$YT" /usr/bin/yt-dlp \
    && yt-dlp --version

ENV YT_DLP_PATH=/usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p downloads

EXPOSE 3000
# Render provides $PORT; bind Next.js to it (defaults to 3000 locally).
CMD ["sh", "-c", "npm start -- -p ${PORT:-3000}"]
