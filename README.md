# SilentWitness

Offline, privacy-first semantic search for security footage.

> Your footage never leaves the building. Search video in plain English, jump to the right moment, and stay fully local.

Built with [Actian VectorAI DB](https://github.com/hackmamba-io/actian-vectorAI-db-beta), CLIP, Whisper, FastAPI, React, and Docker.

## What It Does

SilentWitness turns CCTV-style footage into a searchable local investigation tool.

Instead of manually scrubbing through video, you can ask:

- `person entering store`
- `person near shelves`
- `two people in frame`
- `person walking in the store`

The app returns ranked moments, groups nearby frames into events, shows thumbnails and timestamps, and lets you pivot into visually similar frames from any result.

Everything runs on-device:

- vector storage and search in Actian VectorAI DB
- local CLIP embeddings for text-to-frame retrieval
- local Whisper transcription for voice queries
- no cloud dependency during indexing or search

## Why This Exists

Reviewing security footage is still mostly manual. Even when the footage exists, finding the useful moment is slow:

- operators scrub through long recordings by hand
- most footage is not tagged or annotated
- cloud tools introduce privacy, compliance, and data ownership concerns
- enterprise VMS search products are expensive and heavy for smaller teams

SilentWitness is a simpler alternative: local semantic retrieval over recorded footage with no external video upload.

## Core Capabilities

- Natural-language video search
  Search indexed footage with plain English queries.

- Event clustering
  Nearby frames are grouped into incident-like result clusters instead of being shown only as isolated hits.

- Visual similarity search
  Click a frame and search for visually similar moments using the stored frame vector directly.

- Activity timeline
  Browse indexed activity by time window and jump straight into interesting periods.

- Metadata filters
  Narrow search by camera, date, hour range, and minimum motion score.

- Voice search
  Record a spoken query and run the same retrieval pipeline locally through Whisper.

- Live feed mode
  Start a webcam or RTSP source and index motion-gated frames in near real time.

## How It Works

### Indexing

1. Sample frames from a video at a configurable rate.
2. Use OpenCV frame differencing to keep only motion-relevant frames.
3. Generate CLIP embeddings for the remaining frames.
4. Save thumbnails and metadata such as camera ID, timestamp, date, hour, and motion score.
5. Upsert vectors plus payload into Actian VectorAI DB.

### Search

1. Convert the text query into a CLIP text embedding.
2. Build optional metadata filters for camera, date, hour, and motion threshold.
3. Run vector search in Actian VectorAI DB.
4. Apply a lightweight motion-aware score fusion step to balance semantic relevance with scene activity.
5. Cluster nearby hits into event-style results.

### Similarity Search

1. Fetch the stored vector for an indexed frame.
2. Use that vector as the query.
3. Return visually similar moments from the indexed footage.

## Why Actian VectorAI DB Matters Here

Actian VectorAI DB is central to the project, not a replaceable detail.

- It stores the CLIP embeddings and structured frame metadata together.
- It powers low-latency semantic search over indexed footage.
- It supports server-side filtering before search results are returned.
- It works locally in Docker, which is critical to the privacy story.
- It supports the same app architecture across laptop-style local deployment and edge-style deployment.

For this project, VectorAI DB is the retrieval layer that makes plain-English investigation practical on-device.

## Architecture

```text
Browser UI
   |
   v
React + Vite frontend (:3000)
   |
   v
FastAPI backend (:8000)
   |
   +--> CLIP embeddings
   +--> Whisper transcription
   +--> OpenCV motion detection
   |
   v
Actian VectorAI DB (:50051)

Local volumes:
- footage/           input videos
- data/index/        thumbnails and local artifacts
- data/vectorai/     VectorAI DB data
```

## Project Structure

```text
silentwitness/
├── backend/
│   ├── config.py
│   ├── db.py
│   ├── indexer.py
│   ├── live.py
│   ├── main.py
│   ├── motion.py
│   ├── searcher.py
│   ├── searcher_similarity.py
│   └── voice.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── components/
│   ├── Dockerfile
│   └── nginx.conf
├── footage/
├── data/
├── scripts/
│   ├── generate_demo.py
│   └── smoke_test.py
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Compose

### Official Actian Beta Setup

This repository intentionally does **not** include the Actian beta wheel in git.

That matches the organizer guidance in Discord: do not push `actian_vectorai-0.1.0b2-py3-none-any.whl` to your public repo.

Before building the backend, do this once:

1. Clone or download the official beta repo:
   [hackmamba-io/actian-vectorAI-db-beta](https://github.com/hackmamba-io/actian-vectorAI-db-beta)
2. Locate the official beta wheel from that repo or release bundle.
3. Copy the wheel into:

```text
backend/actian_vectorai-0.1.0b2-py3-none-any.whl
```

The backend Docker build expects that file locally. Without it, `docker compose build` will fail.

### 1. Clone

```bash
git clone https://github.com/AryanSaxenaa/silentwitness.git
cd silentwitness
```

### 2. Add footage

Put supported video files into `footage/`.

Supported formats:

- `.mp4`
- `.avi`
- `.mkv`
- `.mov`
- `.m4v`
- `.ts`

Recommended naming format:

```text
cam2_store_20260422_190000.mp4
cam3_street_20260422_190100.mp4
```

This helps the app infer camera and recording time more cleanly.

For the strongest real-world demo, use actual short CCTV-style footage rather than the synthetic generator.

### 3. Start the stack

```bash
docker compose build
docker compose up -d
```

Services:

- `frontend` on `http://localhost:3000`
- `backend` on `http://localhost:8000`
- `vectoraidb` on `localhost:50051`

Note:

- the first backend build is slow because it preloads models
- after that, normal restarts are much faster
- after a fresh backend start, give it a short warm-up window before the first search

### 4. Index footage

Open `http://localhost:3000`, click `Index`, then click `Scan footage folder`.

You can also trigger indexing through the API:

```bash
curl -X POST http://localhost:8000/api/index/scan
curl http://localhost:8000/api/index/jobs
```

### 5. Search

Try queries like:

- `person entering store`
- `person near shelves`
- `person walking in the store`
- `two people in frame`

Then click a result and use `Find similar moments`.

## Demo Flow

This is the cleanest current live demo flow for a store CCTV-style clip.

### Suggested sequence

1. Show the status bar and confirm the system is local.
2. Open `Index` and show that footage was indexed into Actian VectorAI DB.
3. Search `person entering store`.
4. Search `person near shelves`.
5. Search `two people in frame`.
6. Open one result and run visually similar search.
7. Show the timeline and jump to an active window.

### Show the required advanced Actian usage

The hackathon requires going beyond plain similarity search. SilentWitness satisfies that through **filtered search**.

In the demo, do not stop at free-text search alone. Show at least one filtered run such as:

- `camera_id = cam2`
- `date = 2026-04-22`
- `hour range = 19 to 20`
- `min motion score = 0.05`

Then run:

- `person entering store`
- `person near shelves`

This makes it obvious that Actian VectorAI DB is handling both vector retrieval and structured metadata filtering in the same workflow.

### Suggested narration

“SilentWitness is a local semantic search tool for security footage. I indexed this store video into Actian VectorAI DB, and now I can search for events like `person entering store` or `person near shelves` in plain English. The system returns clustered moments with timestamps, and I can pivot from any frame into visually similar moments. Everything here runs locally without sending footage to the cloud.”

## Evaluation

The table below records representative checks run against the current real store-footage clip:
`cam2_store_20260422_190000.mp4`

All rows below were tested against the live API on the indexed `cam2` dataset.

| Check | Filters | Observed outcome |
| --- | --- | --- |
| `person entering store` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `9` frames across `6` clustered events, including entry-like moments around `19:00:13-19:00:16` and `19:03:05-19:03:15`. |
| `person near shelves` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `5` frames across `5` events, including shelf-adjacent moments around `19:00:18`, `19:00:44`, `19:01:13`, `19:01:55`, and `19:03:05`. |
| `two people in frame` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `9` frames across `4` events, with the strongest clustered window around `19:02:58-19:03:16`. |
| `person walking in the store` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `20` frames across `7` events, including broader movement windows around `19:00:10-19:00:35` and `19:03:03-19:03:05`. |
| `person at entrance` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `15` frames across `6` events, strongest near `19:03:05` and multiple early entry-area frames around `19:00:10-19:00:22`. |
| `customer moving through aisle` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `17` frames across `8` events, showing aisle traversal windows around `19:00:10-19:00:35` and `19:03:04`. |
| `person near shelves` with stricter motion filter | `cam2`, `2026-04-22`, hour `19-19`, min motion `0.10` | Narrowed to `1` event at `19:03:05`, demonstrating that motion and time filters materially change retrieval. |
| Similarity search from a real indexed frame | source frame from current `cam2` dataset | Returned non-zero similar results and passes the automated smoke test. |

### Automated smoke test

The repo also includes a small end-to-end smoke test for:

1. rebuild index
2. semantic search
3. frame similarity search

Run it with:

```bash
python scripts/smoke_test.py --base-url http://localhost:8000
```

This is useful before demoing or submitting.

## API Reference

### Health

`GET /health`

Basic service health check.

### Status

`GET /api/status`

Returns:

- DB connection state
- collection stats
- indexed camera IDs

### Search

`POST /api/search`

Example body:

```json
{
  "query": "person near shelves",
  "camera_id": "cam2",
  "date": "2026-04-22",
  "hour_start": 19,
  "hour_end": 20,
  "min_motion_score": 0.05,
  "limit": 20,
  "group_into_events": true
}
```

`GET /api/search?q=person%20near%20shelves`

Convenience GET form for quick testing.

### Similarity Search

`POST /api/search/similar`

Example body:

```json
{
  "frame_id": "550e8400-e29b-41d4-a716-446655440000",
  "exclude_same_video": false,
  "limit": 20
}
```

### Voice Search

`POST /api/voice`

Multipart audio upload. Whisper transcribes locally, then the backend runs search with the transcribed text.

### Indexing

`POST /api/index/scan`

Queue all supported files in `footage/` for indexing.

`POST /api/index/upload`

Upload a video file directly and queue it for indexing.

`GET /api/index/jobs`

Return indexing job state.

### Timeline

`GET /api/timeline`

Returns activity buckets for the indexed footage.

### Live Feed

`POST /api/live/start`

Start indexing a webcam or RTSP source.

`POST /api/live/stop`

Stop a live source.

`GET /api/live/status`

Return current live indexing state.

## Development

### Frontend

```bash
cd frontend
npm install
npm run build
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

You still need VectorAI DB running separately for backend development.

### Development utilities

`scripts/generate_demo.py` is a local development helper that creates a synthetic clip for testing the pipeline when no footage is available.

It is **not** part of the recommended hackathon demo path. For submission and presentation, use real CCTV-style footage.

## Notes

- This project uses motion-gated frame indexing rather than embedding every frame.
- The current reranking step is a custom motion-aware fusion over semantic similarity plus motion score.
- The app is designed for local use first, with Docker-based deployment as the default path.
- If you place files directly into `footage/`, prefer `Scan footage folder` rather than upload.

## Tech Stack

- Actian VectorAI DB
- Python FastAPI
- React + Vite
- OpenCV
- sentence-transformers CLIP ViT-B/32
- OpenAI Whisper `tiny`
- Docker Compose

## License

No license file is currently included in this repository.

## Acknowledgements

- [Actian VectorAI DB beta repo](https://github.com/hackmamba-io/actian-vectorAI-db-beta)
- [sentence-transformers CLIP ViT-B/32](https://huggingface.co/sentence-transformers/clip-ViT-B-32)
- [OpenAI Whisper](https://github.com/openai/whisper)
