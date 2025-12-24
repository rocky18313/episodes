import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { spawn } from "child_process";
import { createHash, randomBytes } from "crypto";

const screenshotStore = new Map();
const CLEANUP_INTERVAL = 10 * 60 * 1000;

setInterval(() => {
  screenshotStore.clear();
  console.log("Screenshot store cleared - periodic maintenance completed");
}, CLEANUP_INTERVAL);

const generateUniqueId = (position) => {
  const timestamp = Date.now().toString();
  const random = randomBytes(8).toString("hex");
  const hash = createHash("sha256")
    .update(`${timestamp}_${position}_${random}`)
    .digest("hex")
    .substring(0, 16);
  return hash;
};

const getVideoDuration = (url) => {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      url,
    ]);

    let output = "";

    ffprobe.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(duration);
      } else {
        reject(
          new Error(
            "Failed to retrieve video duration. The video file may be corrupted or inaccessible."
          )
        );
      }
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });
  });
};

const captureScreenshot = (url, timestamp) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-ss",
      timestamp,
      "-i",
      url,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "pipe:1",
    ]);

    const chunks = [];

    ffmpeg.stdout.on("data", (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(
          new Error(
            "Screenshot capture failed. Unable to extract frame from video at the specified timestamp."
          )
        );
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const createGif = (
  url,
  startTimestamp,
  duration = 10,
  fps = 10,
  width = 480
) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-ss",
      startTimestamp,
      "-t",
      duration.toString(),
      "-i",
      url,
      "-vf",
      `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      "-loop",
      "0",
      "-f",
      "gif",
      "pipe:1",
    ]);

    const chunks = [];

    ffmpeg.stdout.on("data", (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(
          new Error(
            "GIF creation failed. Unable to extract and convert video segment to GIF format."
          )
        );
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const app = new Elysia({ prefix: "/api" })
  .use(cors())
  .get("/screenshot", async ({ query, set }) => {
    if (!query.url) {
      set.status = 400;
      return {
        error: "Missing required parameter",
        message:
          'The "url" query parameter is required. Please provide a base64-encoded video URL.',
        example: "/api/screenshot?url=<base64_encoded_url>",
      };
    }

    let url;
    try {
      url = atob(query.url);
    } catch (err) {
      set.status = 400;
      return {
        error: "Invalid parameter format",
        message:
          "The provided URL parameter is not valid base64-encoded data. Please ensure the URL is properly encoded.",
        details: err instanceof Error ? err.message : "Decoding error",
      };
    }

    if (!url) {
      set.status = 400;
      return {
        error: "Invalid parameter value",
        message:
          "The decoded URL is empty. Please provide a valid base64-encoded video URL.",
      };
    }

    try {
      const duration = await getVideoDuration(url);
      const threeQuartersTime = duration * 0.75;
      const timestamp = formatTime(threeQuartersTime);

      const image = await captureScreenshot(url, timestamp);
      set.headers = { "Content-Type": "image/png" };
      return image;
    } catch (err) {
      set.status = 500;
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        error: "Internal server error",
        message: "Failed to process video screenshot request.",
        details: errorMessage,
        troubleshooting:
          "Please verify that the video URL is accessible and the file format is supported by FFmpeg.",
      };
    }
  })

  .get("/gif", async ({ query, set }) => {
    if (!query.url) {
      set.status = 400;
      return {
        error: "Missing required parameter",
        message:
          'The "url" query parameter is required. Please provide a base64-encoded video URL.',
        example:
          "/api/gif?url=<base64_encoded_url>&duration=10&fps=10&width=480",
      };
    }

    let url;
    try {
      url = atob(query.url);
    } catch (err) {
      set.status = 400;
      return {
        error: "Invalid parameter format",
        message:
          "The provided URL parameter is not valid base64-encoded data. Please ensure the URL is properly encoded.",
        details: err instanceof Error ? err.message : "Decoding error",
      };
    }

    if (!url) {
      set.status = 400;
      return {
        error: "Invalid parameter value",
        message:
          "The decoded URL is empty. Please provide a valid base64-encoded video URL.",
      };
    }

    const duration = query.duration ? parseFloat(query.duration) : 10;
    const fps = query.fps ? parseInt(query.fps) : 10;
    const width = query.width ? parseInt(query.width) : 480;

    if (duration < 1 || duration > 30) {
      set.status = 400;
      return {
        error: "Invalid parameter value",
        message: "Duration must be between 1 and 30 seconds.",
        provided: duration,
      };
    }

    if (fps < 5 || fps > 30) {
      set.status = 400;
      return {
        error: "Invalid parameter value",
        message: "FPS must be between 5 and 30.",
        provided: fps,
      };
    }

    if (width < 240 || width > 1920) {
      set.status = 400;
      return {
        error: "Invalid parameter value",
        message: "Width must be between 240 and 1920 pixels.",
        provided: width,
      };
    }

    try {
      const videoDuration = await getVideoDuration(url);

      if (videoDuration < duration) {
        set.status = 400;
        return {
          error: "Invalid request",
          message: "Video duration is shorter than the requested GIF duration.",
          videoDuration: formatTime(videoDuration),
          requestedDuration: `${duration} seconds`,
        };
      }

      const midPoint = videoDuration / 2;
      const startTime = Math.max(0, midPoint - duration / 2);
      const startTimestamp = formatTime(startTime);

      const gif = await createGif(url, startTimestamp, duration, fps, width);

      set.headers = {
        "Content-Type": "image/gif",
        "X-Video-Duration": videoDuration.toString(),
        "X-GIF-Start-Time": startTimestamp,
        "X-GIF-Duration": duration.toString(),
        "X-GIF-FPS": fps.toString(),
        "X-GIF-Width": width.toString(),
      };
      return gif;
    } catch (err) {
      set.status = 500;
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        error: "Internal server error",
        message: "Failed to process GIF creation request.",
        details: errorMessage,
        troubleshooting:
          "Please verify that the video URL is accessible, the file format is supported by FFmpeg, and the video has sufficient duration for GIF extraction.",
      };
    }
  })

  .get("/screenshots", async ({ query, set }) => {
    if (!query.url) {
      set.status = 400;
      return {
        error: "Missing required parameter",
        message:
          'The "url" query parameter is required. Please provide a base64-encoded video URL.',
        example: "/api/screenshots?url=<base64_encoded_url>",
      };
    }

    let url;
    try {
      url = atob(query.url);
    } catch (err) {
      set.status = 400;
      return {
        error: "Invalid parameter format",
        message:
          "The provided URL parameter is not valid base64-encoded data. Please ensure the URL is properly encoded.",
        details: err instanceof Error ? err.message : "Decoding error",
      };
    }

    if (!url) {
      set.status = 400;
      return {
        error: "Invalid parameter value",
        message:
          "The decoded URL is empty. Please provide a valid base64-encoded video URL.",
      };
    }

    try {
      const duration = await getVideoDuration(url);

      const positions = [
        {
          name: "beginning",
          time: 5,
          description: "Opening scene (5 seconds in)",
        },
        {
          name: "quarter",
          time: duration * 0.25,
          description: "First quarter of video",
        },
        { name: "mid", time: duration * 0.5, description: "Midpoint of video" },
        {
          name: "three-quarters",
          time: duration * 0.75,
          description: "Third quarter of video",
        },
        {
          name: "end",
          time: Math.max(duration - 5, duration * 0.95),
          description: "Final scene (5 seconds before end)",
        },
      ];

      const screenshots = await Promise.all(
        positions.map(async (pos) => {
          const timestamp = formatTime(pos.time);
          const data = await captureScreenshot(url, timestamp);

          const id = generateUniqueId(pos.name);
          screenshotStore.set(id, data);

          return {
            id,
            position: pos.name,
            description: pos.description,
            timestamp,
            timeInSeconds: pos.time,
            url: `/api/image?id=${id}`,
          };
        })
      );

      return {
        success: true,
        message: "Successfully generated screenshots from video",
        videoDuration: formatTime(duration),
        videoDurationSeconds: duration,
        screenshotCount: screenshots.length,
        screenshots,
        notes:
          "Screenshot image data is temporarily cached and will be cleared after 10 minutes of inactivity.",
      };
    } catch (err) {
      set.status = 500;
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        error: "Internal server error",
        message: "Failed to process video screenshots request.",
        details: errorMessage,
        troubleshooting:
          "Please verify that the video URL is accessible, the file format is supported by FFmpeg, and the video has sufficient duration for multiple screenshots.",
      };
    }
  })

  .get("/image", ({ query, set }) => {
    if (!query.id) {
      set.status = 400;
      return {
        error: "Missing required parameter",
        message:
          'The "id" query parameter is required. Please provide a valid screenshot identifier.',
        example: "/api/image?id=<screenshot_id>",
      };
    }

    const image = screenshotStore.get(query.id);

    if (!image) {
      set.status = 404;
      return {
        error: "Resource not found",
        message: "The requested screenshot could not be found.",
        details:
          "The screenshot may have expired (cached for 10 minutes) or the provided ID is invalid.",
        suggestion:
          "Please generate a new screenshot using the /api/screenshots endpoint.",
      };
    }

    set.headers = { "Content-Type": "image/png" };
    return image;
  });

app.listen(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
console.log(`App started on PORT ${process.env.PORT ?? "3000"}`);
