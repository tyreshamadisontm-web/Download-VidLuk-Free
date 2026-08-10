# VidLuk Free — GitHub + Render

Free-first VidLuk clipper for personal use.

## Render
- Build: `npm install`
- Start: `npm start`
- Plan: Free
- No API keys required.

The repository uses a root `server.js` and root `index.html` so Render's
`npm start` works with the uploaded GitHub layout.


## FFmpeg local deployment fix

VidLuk no longer loads FFmpeg or its worker from jsDelivr at runtime. The Render server serves the
`@ffmpeg/ffmpeg`, `@ffmpeg/util`, and `@ffmpeg/core` package files from the same origin under `/ffmpeg/*`.
Render installs these packages during `npm install`, and the browser loads the FFmpeg worker from the
VidLuk Render domain. Cross-origin isolation headers remain enabled for SharedArrayBuffer.
