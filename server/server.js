const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// FFmpeg.wasm needs SharedArrayBuffer in modern browsers.
app.use((req,res,next)=>{
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  next();
});

app.get('/health', (req,res)=>res.json({ok:true, app:'VidLuk Free', processing:'browser', ffmpeg:'local'}));

// Serve FFmpeg packages from this Render deployment instead of a public CDN.
app.use('/ffmpeg/ffmpeg', express.static(
  path.join(__dirname,'node_modules','@ffmpeg','ffmpeg','dist','esm')
));
app.use('/ffmpeg/util', express.static(
  path.join(__dirname,'node_modules','@ffmpeg','util','dist','esm')
));
app.use('/ffmpeg/core', express.static(
  path.join(__dirname,'node_modules','@ffmpeg','core','dist','umd')
));

app.use(express.static(path.join(__dirname,'public'), {extensions:['html']}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`VidLuk Free running on port ${PORT}`));
