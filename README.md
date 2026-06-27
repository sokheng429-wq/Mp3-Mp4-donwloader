# 🎵 Loader — Next.js Media Downloader

A clean, ad-free Next.js app to download MP3 and MP4. Built with Next.js App Router + yt-dlp.

---

## Requirements

- **Node.js** 18+ → https://nodejs.org
- **yt-dlp** → https://github.com/yt-dlp/yt-dlp/releases
- **FFmpeg** (for MP3 conversion) → https://ffmpeg.org/download.html

### Install yt-dlp
- **Windows**: Download `yt-dlp.exe` and place it in a folder on your PATH (e.g. `C:\Windows\System32\`)
- **Mac**: `brew install yt-dlp`
- **Linux**: `sudo apt install yt-dlp` or `pip install yt-dlp`

### Install FFmpeg
- **Windows**: `winget install ffmpeg` in Command Prompt
- **Mac**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg`

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Run in development
npm run dev
```

Open http://localhost:3000

---

## Build for production

```bash
npm run build
npm start
```

---

## How to use

1. Paste a URL (YouTube, TikTok, Facebook, Instagram, etc.)
2. Choose **MP3** (audio only) or **MP4** (video)
3. Click **Start Download**
4. Watch the progress bar
5. Click **Save File** when done

Downloaded files are saved to the `downloads/` folder in the project root.

---

## Project structure

```
app/
  page.tsx                    ← UI (the downloader page)
  layout.tsx                  ← Root layout
  globals.css                 ← Styles
  api/
    start/route.ts            ← POST /api/start  → starts download job
    status/[jobId]/route.ts   ← GET  /api/status/:id → poll progress
    download/[jobId]/route.ts ← GET  /api/download/:id → serve file
downloads/                    ← where files are saved
```
"# Mp3-Mp4-donwloader" 
"# Mp3-Mp4-donwloader" 
