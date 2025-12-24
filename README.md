# Episode Professing API from HLS Link

A lightweight API built with **Elysia** that provides automated video screenshot capture and GIF generation using **FFmpeg**. Perfect for quickly extracting key frames or creating GIF previews from video files.

---

## Features

- Capture screenshots at specific points in a video (beginning, quarter, midpoint, three-quarters, end).
- Generate GIFs from any segment of a video with customizable duration, frame rate (FPS), and width.
- Temporarily cache screenshots for quick access (10-minute automatic cleanup).
- Handles base64-encoded video URLs for secure transmission.
- Error handling for invalid parameters, unsupported video formats, and short videos.

---

## Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/shimizudev/episodes
   cd episodes
    ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Ensure FFmpeg is installed**
   The API relies on `ffmpeg` and `ffprobe` available in your system path.

   ```bash
   ffmpeg -version
   ffprobe -version
   ```

4. **Start the server**

   ```bash
   bun run start
   ```

   By default, the server listens on port `3000`. You can override with the `PORT` environment variable:

   ```bash
   PORT=8080 bun run start
   ```

---

## API Endpoints

### 1. **Capture a single screenshot**

**GET** `/api/screenshot?url=<base64_encoded_url>`

* Captures a screenshot at 75% of the video duration.
* **Response**: `image/png`
* **Errors**: Invalid URL, inaccessible video, or FFmpeg failure.

---

### 2. **Generate a GIF**

**GET** `/api/gif?url=<base64_encoded_url>&duration=10&fps=10&width=480`

* Parameters:

  * `duration` (seconds, default: 10, range: 1–30)
  * `fps` (frames per second, default: 10, range: 5–30)
  * `width` (pixels, default: 480, range: 240–1920)
* **Response**: `image/gif`
* **Headers** include video duration, GIF start time, FPS, width, and GIF duration.
* **Errors**: Video shorter than requested GIF duration, invalid parameters, FFmpeg failure.

---

### 3. **Capture multiple screenshots**

**GET** `/api/screenshots?url=<base64_encoded_url>`

* Captures screenshots at key positions:

  * Beginning (5 seconds)
  * First quarter
  * Midpoint
  * Three-quarters
  * End (5 seconds before completion)
* **Response**: JSON with screenshot metadata including:

  * `id` (unique identifier)
  * `position`
  * `description`
  * `timestamp`
  * `url` (endpoint to retrieve screenshot `/api/image?id=<id>`)
* Screenshots are cached for **10 minutes**.

---

### 4. **Retrieve a cached screenshot**

**GET** `/api/image?id=<screenshot_id>`

* Fetches a previously captured screenshot.
* **Response**: `image/png`
* **Errors**: Missing ID or expired screenshot.

---

## Utilities

* **Base64-encoded URLs**: All video URLs must be base64-encoded to prevent issues with URL special characters.
* **Time formatting**: Converts seconds into `HH:MM:SS` format.
* **Unique IDs**: Generated for screenshot caching using SHA-256 hashing of timestamp, position, and randomness.

---

## Development Notes

* **Periodic Cleanup**: Cached screenshots are cleared every 10 minutes to free memory.
* **Dependencies**:

  * `elysia` – Fast and minimal web framework
  * `child_process` – For spawning FFmpeg processes
  * `crypto` – For unique ID generation
* **Video Handling**: Fully relies on FFmpeg for screenshot and GIF extraction.

---

## Troubleshooting

* Ensure the video URL is accessible and properly encoded.
* Verify FFmpeg supports the video format.
* Ensure the video duration is sufficient for requested GIFs or screenshots.

---

Made by Sohom829