```javascript
const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const ffmpeg = require("ffmpeg-static");
const youtubedl = require("youtube-dl-exec");

const app = express();
const PORT = process.env.PORT || 3000;

const WORK_DIR = path.join(os.tmpdir(), "vidluk");

fs.mkdirSync(WORK_DIR, {
  recursive: true
});

app.use(express.json({
  limit: "1mb"
}));

app.use(express.static(__dirname));


// -----------------------------
// HOME
// -----------------------------

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});


// -----------------------------
// PROCESS VIDEO
// -----------------------------

app.post("/api/process", async (req, res) => {

  const url = String(
    req.body?.url || ""
  ).trim();

  if (!url) {
    return res.status(400).json({
      error: "Please enter a video URL."
    });
  }

  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({
      error: "The video URL must start with http:// or https://."
    });
  }

  const jobId = crypto.randomUUID();

  const jobDir = path.join(
    WORK_DIR,
    jobId
  );

  fs.mkdirSync(jobDir, {
    recursive: true
  });

  const inputFile = path.join(
    jobDir,
    "source.mp4"
  );

  try {

    // -----------------------------
    // DOWNLOAD PUBLIC VIDEO
    // -----------------------------

    console.log("Downloading video...");

    await youtubedl(url, {
      output: inputFile,
      format: "bestvideo+bestaudio/best",
      mergeOutputFormat: "mp4",
      noPlaylist: true,
      noWarnings: true
    });


    // -----------------------------
    // VERIFY DOWNLOAD
    // -----------------------------

    if (!fs.existsSync(inputFile)) {

      throw new Error(
        "The video could not be downloaded."
      );

    }


    // -----------------------------
    // GET VIDEO LENGTH
    // -----------------------------

    const duration = await getDuration(
      inputFile
    );

    console.log(
      "Video duration:",
      duration
    );


    if (!duration || duration <= 0) {

      throw new Error(
        "Could not determine video duration."
      );

    }


    // -----------------------------
    // CREATE CLIP TIMES
    // -----------------------------

    const clipLength = Math.min(
      30,
      Math.max(
        10,
        duration / 5
      )
    );

    const starts = [

      0,

      Math.max(
        0,
        (duration - clipLength) / 2
      ),

      Math.max(
        0,
        duration - clipLength
      )

    ];


    const clips = [];


    // -----------------------------
    // CREATE CLIPS
    // -----------------------------

    for (
      let i = 0;
      i < starts.length;
      i++
    ) {

      const start = starts[i];

      const filename = `clip-${i + 1}.mp4`;

      const outputFile =
        path.join(
          jobDir,
          filename
        );


      console.log(
        `Creating clip ${i + 1}...`
      );


      await createClip(
        inputFile,
        outputFile,
        start,
        clipLength
      );


      clips.push({

        name:
          `Clip ${i + 1}`,

        start:
          Math.round(start),

        duration:
          Math.round(clipLength),

        url:
          `/api/files/${jobId}/${filename}`

      });

    }


    // -----------------------------
    // RESPONSE
    // -----------------------------

    res.json({

      success: true,

      message:
        "Clips generated successfully.",

      clips

    });


  } catch (error) {

    console.error(
      "VidLuk error:",
      error
    );

    res.status(500).json({

      error:
        error.message ||
        "Video processing failed."

    });

  }

});


// -----------------------------
// VIDEO DOWNLOAD
// -----------------------------

app.get(
  "/api/files/:job/:file",
  (req, res) => {

    const job =
      path.basename(
        req.params.job
      );

    const file =
      path.basename(
        req.params.file
      );

    const filePath =
      path.join(
        WORK_DIR,
        job,
        file
      );


    if (!fs.existsSync(filePath)) {

      return res.status(404).send(
        "Clip not found."
      );

    }


    res.download(
      filePath
    );

  }
);


// -----------------------------
// VIDEO DURATION
// -----------------------------

function getDuration(file) {

  return new Promise(
    (resolve, reject) => {

      const { spawn } =
        require("child_process");

      const process =
        spawn(
          ffmpeg,
          [
            "-i",
            file
          ]
        );

      let output = "";


      process.stderr.on(
        "data",
        data => {

          output +=
            data.toString();

        }
      );


      process.on(
        "close",
        () => {

          const match =
            output.match(
              /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i
            );


          if (!match) {

            return reject(
              new Error(
                "Could not read video duration."
              )
            );

          }


          const hours =
            Number(match[1]);

          const minutes =
            Number(match[2]);

          const seconds =
            Number(match[3]);


          resolve(
            hours * 3600 +
            minutes * 60 +
            seconds
          );

        }
      );

    }
  );

}


// -----------------------------
// CREATE CLIP
// -----------------------------

function createClip(
  input,
  output,
  start,
  duration
) {

  return new Promise(
    (resolve, reject) => {

      const { spawn } =
        require("child_process");


      const process =
        spawn(
          ffmpeg,
          [
            "-y",

            "-ss",
            String(start),

            "-i",
            input,

            "-t",
            String(duration),

            "-c:v",
            "libx264",

            "-c:a",
            "aac",

            "-movflags",
            "+faststart",

            output
          ]
        );


      let errorOutput = "";


      process.stderr.on(
        "data",
        data => {

          errorOutput +=
            data.toString();

        }
      );


      process.on(
        "error",
        error => {

          reject(error);

        }
      );


      process.on(
        "close",
        code => {

          if (code === 0) {

            resolve();

          } else {

            reject(
              new Error(
                errorOutput.slice(-2000) ||
                "FFmpeg failed to create the clip."
              )
            );

          }

        }
      );

    }
  );

}


// -----------------------------
// START SERVER
// -----------------------------

app.listen(
  PORT,
  () => {

    console.log(
      `VidLuk running on port ${PORT}`
    );

  }
);
```
