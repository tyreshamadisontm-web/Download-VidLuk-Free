# VidLuk Free — GitHub + Render

This rebuild is intentionally **browser-processing first**. Render hosts the website; your computer does the heavy video work in the browser. That avoids paid AI/video APIs and avoids putting API keys on GitHub.

## What it does
- Upload a local video directly in the browser
- Detects candidate moments using browser audio energy
- Optional browser speech recognition transcript (Chrome/Edge support varies)
- Scores clips using hook/emotion/curiosity/completeness heuristics
- Preview clips
- Render real MP4 clips in the browser with ffmpeg.wasm
- 9:16, 16:9 and 1:1 output
- Optional burned-in captions when speech recognition produced a transcript
- Download MP4 files directly
- No OpenAI, Runware, Shotstack, Anthropic or paid API key
- Uploaded video is not sent to this app server

## Render
1. Put the contents of this folder in a GitHub repository.
2. In Render create a **Web Service** connected to that repository.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. No environment variables are required.

Render's free hosting limits can change. This design keeps processing on the user's device, so the Render service is mainly serving the app.

## Important
This is free software, but browser processing still uses your computer's CPU/RAM. Large/long videos can take time. The ffmpeg.wasm runtime is downloaded by the browser from jsDelivr on first render.

## Privacy
The selected video stays in the browser for processing. The app does not upload it to a backend. Browser speech recognition, when enabled by your browser, may use the browser's speech service; this is controlled by the browser, not this app.
