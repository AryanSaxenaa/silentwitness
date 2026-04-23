# SilentWitness

Offline semantic search for security footage.

SilentWitness turns recorded CCTV-style video into a searchable local investigation tool. It indexes motion-relevant frames, stores vectors and metadata in Actian VectorAI DB, and lets you search footage in plain English, filter by metadata, inspect activity over time, and pivot from any frame into visually similar moments.

Built with [Actian VectorAI DB](https://github.com/hackmamba-io/actian-vectorAI-db-beta), FastAPI, React, OpenCV, CLIP, Whisper, and Docker.

## Highlights

- Natural-language search over indexed footage
- Metadata filters for camera, date, hour range, and minimum motion score
- Event clustering for grouping nearby frame hits into incident-style windows
- Visual similarity search from any indexed frame
- Activity timeline for time-based review
- Local voice queries through Whisper
- Optional live capture mode for webcam or RTSP sources
- Fully local runtime path with no cloud dependency during indexing or retrieval

## How It Works

### Indexing

1. Sample frames from a video at a configurable rate.
2. Use motion detection to keep only activity-relevant frames.
3. Generate CLIP embeddings for the remaining frames.
4. Save thumbnails and metadata such as camera ID, date, hour, timestamp, and motion score.
5. Upsert vectors and payloads into Actian VectorAI DB.

### Search

1. Convert the text query into a CLIP text embedding.
2. Apply optional metadata filters.
3. Run vector search in Actian VectorAI DB.
4. Apply a lightweight motion-aware fusion step to balance semantic relevance with scene activity.
5. Group nearby results into clustered event windows when requested.

### Similarity Search

1. Fetch the stored vector for an indexed frame.
2. Use that vector directly as the query.
3. Return visually similar frames and clustered moments from the indexed collection.

## Why Actian VectorAI DB

Actian VectorAI DB is the core retrieval layer in this project.

- It stores frame embeddings and structured metadata together.
- It powers semantic vector search over indexed footage.
- It supports server-side filtering for metadata-constrained retrieval.
- It runs locally in Docker, which fits the privacy and ownership goals of the app.

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
├── frontend/
├── footage/
├── data/
├── scripts/
│   ├── generate_demo.py
│   └── smoke_test.py
├── docker-compose.yml
└── LICENSE
```

## Setup

### Prerequisites

- Docker Desktop or Docker Engine with Compose

### Actian Beta Dependency

This repository expects the official Actian VectorAI DB beta wheel to be present locally during backend build.

Before building:

1. Clone or download the official beta repository:
   [hackmamba-io/actian-vectorAI-db-beta](https://github.com/hackmamba-io/actian-vectorAI-db-beta)
2. Locate the beta wheel from that repo or release bundle.
3. Copy it to:

```text
backend/actian_vectorai-0.1.0b2-py3-none-any.whl
```

### Start the stack

```bash
git clone https://github.com/AryanSaxenaa/silentwitness.git
cd silentwitness
docker compose build
docker compose up -d
```

Services:

- `frontend` on `http://localhost:3000`
- `backend` on `http://localhost:8000`
- `vectoraidb` on `localhost:50051`

The first backend build can take longer because model assets are preloaded.

## Usage

### Add footage

Place supported files in `footage/`.

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

### Index footage

Open `http://localhost:3000`, go to the indexing panel, and run `Scan footage folder`.

You can also use the API:

```bash
curl -X POST http://localhost:8000/api/index/scan
curl http://localhost:8000/api/index/jobs
```

### Search footage

Example queries:

- `person entering store`
- `person near shelves`
- `person walking in the store`
- `two people in frame`

To narrow results, apply filters such as:

- `camera_id = cam2`
- `date = 2026-04-22`
- `hour range = 19 to 20`
- `min motion score = 0.05`

Then open a returned frame and run similarity search to find related moments.

## Evaluation Snapshot

Representative checks were run against the real store-footage clip:
`cam2_store_20260422_190000.mp4`

| Check | Filters | Observed outcome |
| --- | --- | --- |
| `person entering store` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `9` frames across `6` clustered events, including entry-like moments around `19:00:13-19:00:16` and `19:03:05-19:03:15`. |
| `person near shelves` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `5` frames across `5` events, including shelf-adjacent moments around `19:00:18`, `19:00:44`, `19:01:13`, `19:01:55`, and `19:03:05`. |
| `two people in frame` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `9` frames across `4` events, with the strongest clustered window around `19:02:58-19:03:16`. |
| `person walking in the store` | `cam2`, `2026-04-22`, hour `19-20`, min motion `0.05` | Returned `20` frames across `7` events, including broader movement windows around `19:00:10-19:00:35` and `19:03:03-19:03:05`. |
| `person near shelves` with stricter motion filter | `cam2`, `2026-04-22`, hour `19-19`, min motion `0.10` | Narrowed to `1` event at `19:03:05`, showing that metadata filters materially change retrieval. |
| Similarity search from a real indexed frame | current `cam2` dataset | Returned non-zero similar results and passed the automated smoke test. |

### Smoke test

The repository includes an end-to-end smoke test for:

1. rebuild index
2. semantic search
3. frame similarity search

Run it with:

```bash
python scripts/smoke_test.py --base-url http://localhost:8000
```

## API

### Health

- `GET /health`

### Status

- `GET /api/status`

Returns database connection state, collection stats, indexed cameras, and runtime health.

### Search

- `POST /api/search`
- `GET /api/search?q=...`

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

### Similarity Search

- `POST /api/search/similar`

### Voice Search

- `POST /api/voice`

### Indexing

- `POST /api/index/scan`
- `POST /api/index/upload`
- `POST /api/index/rebuild`
- `GET /api/index/jobs`

### Timeline

- `GET /api/timeline`

### Live Feed

- `POST /api/live/start`
- `POST /api/live/stop`
- `GET /api/live/status`

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

### Development utilities

`scripts/generate_demo.py` creates a synthetic clip for local development when no sample footage is available. It is optional and not required for normal use of the project.

## Tech Stack

- Actian VectorAI DB
- Python FastAPI
- React + Vite
- OpenCV
- sentence-transformers CLIP ViT-B/32
- OpenAI Whisper `tiny`
- Docker Compose

## License

MIT. See [LICENSE](./LICENSE).

## Acknowledgements

- [Actian VectorAI DB beta repo](https://github.com/hackmamba-io/actian-vectorAI-db-beta)
- [sentence-transformers CLIP ViT-B/32](https://huggingface.co/sentence-transformers/clip-ViT-B-32)
- [OpenAI Whisper](https://github.com/openai/whisper)
