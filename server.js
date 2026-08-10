const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ffmpeg = require("ffmpeg-static");
const ytDlp = require("youtube-dl-exec");

const app = express();

const PORT = process.env.PORT || 3000;

const WORK_DIR = path.join(
  os.tmpdir(),
  "vidluk"
);

fs.mkdirSync(WORK_DIR, {
  recursive: true
});

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.static(__dirname)
);


/* -----------------------------
   WEBSITE
----------------------------- */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );
});


/* -----------------------------
   RUN COMMAND
----------------------------- */

function runCommand(
  command,
  args
) {
  return new Promise(
    (resolve, reject) => {

      const child =
        spawn(
          command,
          args
        );

      let stderr = "";

      child.stderr.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        (code) => {

          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              stderr.slice(-5000) ||
              "Command failed."
            )
          );

        }
      );

    }
  );
}


/* -----------------------------
   VIDEO DURATION
----------------------------- */

function getVideoDuration(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const child =
        spawn(
          ffmpeg,
          ["-i", file]
        );

      let output = "";

      child.stderr.on(
        "data",
        (data) => {
          output +=
            data.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        () => {

          const match =
            output.match(
              /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i
            );

          if (!match) {

            reject(
              new Error(
                "Could not determine video duration."
              )
            );

            return;
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


/* -----------------------------
   CREATE CLIP
----------------------------- */

function createClip(
  input,
  output,
  start,
  duration
) {

  return runCommand(
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
}


/* -----------------------------
   DOWNLOAD PUBLIC VIDEO
----------------------------- */

async function downloadVideo(
  url,
  output
) {

  const options = {

    output: output,

    /*
      Generic format for many
      yt-dlp supported websites.
    */
    format:
      "bv*+ba/b",

    /*
      Try to produce MP4.
    */
    mergeOutputFormat:
      "mp4",

    /*
      Don't download playlists.
    */
    noPlaylist: true,

    /*
      yt-dlp web extraction
      components.
    */
    remoteComponents:
      "ejs:npm",

    /*
      Explicitly don't use
      cookies.
    */
    noCookies: true
  };


  /*
    Use Deno if installed.
  */

  const denoPath =
    process.env.DENO_PATH ||
    path.join(
      process.env.HOME || "",
      ".deno",
      "bin",
      "deno"
    );


  if (
    fs.existsSync(
      denoPath
    )
  ) {

    options.jsRuntimes =
      "deno:" +
      denoPath;

  }


  console.log(
    "Downloading public video..."
  );


  await ytDlp(
    url,
    options
  );

}


/* -----------------------------
   PROCESS VIDEO
----------------------------- */

app.post(
  "/api/process",
  async (req, res) => {

    const url =
      String(
        req.body?.url || ""
      ).trim();


    if (!url) {

      return res
        .status(400)
        .json({
          error:
            "Please enter a public video URL."
        });

    }


    if (
      !/^https?:\/\//i.test(
        url
      )
    ) {

      return res
        .status(400)
        .json({
          error:
            "The URL must start with http:// or https://."
        });

    }


    const jobId =
      crypto.randomUUID();


    const jobDir =
      path.join(
        WORK_DIR,
        jobId
      );


    fs.mkdirSync(
      jobDir,
      {
        recursive: true
      }
    );


    const inputFile =
      path.join(
        jobDir,
        "source.mp4"
      );


    try {

      /*
        STEP 1
        Download source video.
      */

      await downloadVideo(
        url,
        inputFile
      );


      if (
        !fs.existsSync(
          inputFile
        )
      ) {

        throw new Error(
          "The video could not be downloaded."
        );

      }


      /*
        STEP 2
        Find duration.
      */

      const duration =
        await getVideoDuration(
          inputFile
        );


      if (
        !duration ||
        duration <= 0
      ) {

        throw new Error(
          "Could not read the video duration."
        );

      }


      /*
        STEP 3
        Create three clips.

        Maximum:
        30 seconds each.

        Minimum:
        10 seconds when possible.
      */

      const clipLength =
        Math.min(
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
          (duration -
            clipLength) / 2
        ),

        Math.max(
          0,
          duration -
            clipLength
        )

      ];


      const clips = [];


      /*
        STEP 4
        Render clips.
      */

      for (
        let i = 0;
        i < starts.length;
        i++
      ) {

        const start =
          starts[i];


        const filename =
          "clip-" +
          (i + 1) +
          ".mp4";


        const outputFile =
          path.join(
            jobDir,
            filename
          );


        console.log(
          "Creating " +
          filename
        );


        await createClip(
          inputFile,
          outputFile,
          start,
          clipLength
        );


        clips.push({

          name:
            "Clip " +
            (i + 1),

          start:
            Math.round(
              start
            ),

          duration:
            Math.round(
              clipLength
            ),

          url:
            "/api/files/" +
            jobId +
            "/" +
            filename

        });

      }


      /*
        STEP 5
        Send results to website.
      */

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


      let message =
        error.message ||
        "Video processing failed.";


      /*
        Friendly messages for
        common site restrictions.
      */

      if (
        message.includes(
          "429"
        ) ||
        message.includes(
          "Too Many Requests"
        ) ||
        message.includes(
          "Sign in to confirm"
        ) ||
        message.includes(
          "not a bot"
        ) ||
        message.includes(
          "LOGIN_REQUIRED"
        ) ||
        message.includes(
          "Access denied"
        )
      ) {

        message =
          "This video site is blocking the free server request. " +
          "No cookies or account information were used. " +
          "Try Computer mode or another public video URL.";

      }


      res
        .status(500)
        .json({
          error: message
        });

    }

  }
);


/* -----------------------------
   DOWNLOAD GENERATED CLIP
----------------------------- */

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


    if (
      !fs.existsSync(
        filePath
      )
    ) {

      return res
        .status(404)
        .send(
          "Clip not found."
        );

    }


    res.download(
      filePath
    );

  }
);


/* -----------------------------
   START SERVER
----------------------------- */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "VidLuk running on port " +
      PORT
    );

  }
);
