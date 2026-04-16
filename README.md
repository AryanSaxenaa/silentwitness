# SilentWitness

**Offline, privacy-first semantic search engine for security footage.**

> *Your footage never leaves the building. Search hours of security video in plain English — no scrubbing, no annotations, no cloud.*

Built for the [Actian VectorAI DB Build Challenge](https://dorahacks.io/hackathon/2097/detail) · April 2026

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem](#the-problem)
3. [Solution](#solution)
4. [Key Features](#key-features)
5. [How It Works](#how-it-works)
6. [Why Actian VectorAI DB](#why-actian-vectorai-db)
7. [Architecture](#architecture)
8. [Project Structure](#project-structure)
9. [Getting Started](#getting-started)
10. [Development Setup](#development-setup)
11. [API Reference](#api-reference)
12. [Demo Script](#demo-script)
13. [Bonus Points](#bonus-points)
14. [Tech Stack](#tech-stack)

---

## Overview

SilentWitness is a locally-deployed AI application that enables natural language search over security camera footage. Instead of manually scrubbing through hours of video to find a specific incident, an operator describes what they are looking for in plain English and the system returns the exact frames — ranked by semantic relevance, grouped into incident events, and filterable by camera, date, time of day, and motion intensity.

The entire system runs on-device. No footage is uploaded to any external server. No API keys are required. No internet connection is needed after the initial setup. The system can run on a laptop, a Raspberry Pi 5, an ARM industrial PC, or any air-gapped environment.

---

## The Problem

Security footage is one of the most valuable and most underutilised sources of evidence and operational intelligence available to businesses, institutions, and law enforcement. The reason it goes underutilised is simple: finding anything in it is painful.

**The current workflow:**
- An incident is reported
- An operator is assigned to review footage
- The operator selects the relevant camera(s) and time range
- The operator scrubs through video manually, second by second
- An average retail store with 8 cameras recording 12 hours per day generates 96 hours of footage daily — finding one incident takes 30–60 minutes on average

**Why existing solutions fail:**
- Cloud-based AI tools (e.g. AWS Rekognition, Google Video Intelligence) require uploading sensitive footage to third-party servers, creating legal, compliance, and privacy risks
- On-premises enterprise systems (e.g. Milestone, Genetec) cost tens of thousands of dollars and require dedicated server infrastructure
- Keyword or metadata search only works if footage has been manually tagged or annotated — which virtually no one does

**The gap:** There is no accessible, affordable, privacy-respecting tool that lets a small business owner, warehouse manager, school administrator, or security analyst simply describe what they are looking for and find it instantly.

---

## Solution

SilentWitness addresses this gap by combining three technologies:

1. **CLIP multimodal embeddings** — OpenAI's Contrastive Language–Image Pretraining model encodes both images and text into the same 512-dimensional vector space. This means a text query like *"person leaving a bag near the counter"* and a video frame showing exactly that will have similar vector representations — enabling cross-modal search with no manual annotation required.

2. **Actian VectorAI DB** — A portable, edge-first vector database that runs entirely on-device. It stores the CLIP embeddings for every indexed frame alongside structured metadata (camera ID, timestamp, motion score, date), executes sub-15ms similarity searches, and supports a rich Filter DSL for scoping queries before vector comparison runs.

3. **Motion-gated indexing** — Rather than embedding every frame (which would be computationally prohibitive), SilentWitness uses OpenCV frame differencing to detect motion and only embeds frames where significant activity occurred. This reduces the indexing workload by 80–95% on typical footage and produces a cleaner, more signal-rich index.

The result is a system that can index an hour of footage in approximately 3–5 minutes on modest hardware and return search results in under a second.

---

## Key Features

### Core Search
- **Natural language queries** — describe incidents in plain English; no special syntax required
- **Cross-modal search** — text queries match video frames directly via CLIP embeddings; no image captioning or manual tagging
- **Event clustering** — consecutive frames within a configurable time window are grouped into incidents, so results surface events rather than isolated frames
- **DBSF score fusion** — Distribution-Based Score Fusion combines the CLIP semantic similarity score with the motion activity score of each frame, boosting frames that are both semantically relevant and visually active

### Voice Search
- **Local speech-to-text** — powered by OpenAI Whisper `tiny` model running entirely on-device; no cloud transcription service
- **Seamless integration** — voice input feeds directly into the same search pipeline as text input; the transcribed query is displayed for confirmation
- **Demo-ready** — the combination of pulling an ethernet cable and speaking a query that produces results is the single most compelling live demonstration of the offline capability

### Live Webcam Feed
- **Real-time indexing** — a background thread continuously captures frames from a webcam or RTSP stream and indexes them as they are captured; new frames are searchable within seconds
- **Motion-gated capture** — idle frames (empty rooms, static scenes) are discarded before embedding; only frames with detected activity are indexed
- **Bounded memory** — a fixed-size frame queue prevents memory growth under high-motion conditions; excess frames are dropped and counted
- **Multi-source support** — accepts a webcam device index (`0`, `1`), an RTSP URL, or any OpenCV-compatible video source

### Incident Timeline
- **Activity heatmap** — a horizontal bar chart showing frame density and peak motion score bucketed into 5-minute windows across the day
- **Interactive navigation** — hovering a time bucket displays thumbnail previews of frames from that period; clicking it executes a filtered search scoped to that time window
- **Visual anomaly detection** — high-motion spikes are colour-coded red, making unusual activity periods immediately identifiable without any search query

### Frame Similarity Search
- **Vector-native** — clicking "Find similar moments" on any result frame fetches the stored CLIP vector for that frame directly from VectorAI DB and uses it as the search query; no re-embedding, no text query
- **Temporal tracking** — finds every occurrence of a visually similar scene, person, or object across all indexed footage and cameras
- **Same pipeline** — results go through the same DBSF fusion and event clustering as text searches

### Filtering
- **Camera scope** — restrict results to a specific camera ID
- **Date filter** — limit search to a specific recording date
- **Time window** — specify an hour range (e.g. 10:00–14:00)
- **Motion threshold** — set a minimum motion score to exclude low-activity frames from results
- **Filter DSL** — all filters are applied server-side inside VectorAI DB before vector comparison runs, not as post-processing; this means the search operates only on the relevant subset of the index

---

## How It Works

### Indexing Pipeline

```
Video file (MP4, AVI, MKV, MOV, TS)
           │
           ▼
   Frame sampling at 1 fps (configurable)
           │
           ▼
   Motion detection — OpenCV frame differencing
   Computes pixel-level difference between consecutive frames.
   Frames below the motion threshold are discarded.
   Typical rejection rate: 80–95% of frames on standard footage.
           │
           ▼
   CLIP ViT-B/32 embedding — sentence-transformers (local)
   Each motion frame is converted to a 512-dimensional vector
   capturing its visual semantic content.
           │
           ▼
   Thumbnail generation — saved as JPEG at 320×180px
           │
           ▼
   Metadata extraction
   - camera_id (parsed from filename or provided manually)
   - timestamp_sec (position in video)
   - absolute_time (derived from filename or file modification time)
   - date, hour (for Filter DSL)
   - motion_score (0.0–1.0)
           │
           ▼
   Actian VectorAI DB — real-time upsert via gRPC
   HNSW index updated immediately; frame is searchable at once.
   Batch size: 32 frames per upsert call.
```

### Search Pipeline

```
User input: text query or voice recording
           │
           ▼
   [Voice path] Whisper tiny — local transcription
   Audio bytes → text string
           │
           ▼
   CLIP ViT-B/32 text embedding
   Query text is encoded into the same 512-dimensional space as frames.
   This is what enables cross-modal search without any bridge model.
           │
           ▼
   Filter DSL construction
   Active filters (camera, date, hour range, motion score) are compiled
   into a VectorAI DB filter expression. This runs server-side and
   reduces the candidate set before vector comparison.
           │
           ▼
   Actian VectorAI DB — HNSW vector search
   Cosine similarity search over the filtered candidate set.
   Typical latency: <15ms for collections up to ~500k frames.
           │
           ▼
   DBSF score fusion
   final_score = (clip_score × 0.85) + (motion_score × 0.15)
   Re-ranks results to boost frames that are both semantically
   relevant and visually active.
           │
           ▼
   Event clustering
   Results sorted by timestamp. Consecutive frames within 10 seconds
   of each other are grouped into a single incident event.
   Each event reports: start/end time, frame count, best-match frame.
           │
           ▼
   Response — events array + raw frames array
```

### Live Feed Pipeline

```
Webcam / RTSP stream
           │
           ▼
   Capture thread — reads frames at configurable fps
           │
           ▼
   Motion gate — frame differencing against previous frame
   Frames below motion threshold are discarded immediately.
           │
           ▼
   Bounded queue (max 10 frames) — decouples capture from embedding
           │
           ▼
   Index thread — pulls from queue
   CLIP embed → thumbnail save → VectorAI DB upsert (single point)
   New frame is searchable within ~2–5 seconds of capture.
```

---

## Why Actian VectorAI DB

Actian VectorAI DB is not a drop-in replacement for another vector database in this project — it is the reason the project's core value proposition is possible. Each of the following capabilities is used directly and intentionally.

| Capability | How SilentWitness uses it | Why it matters |
|---|---|---|
| **CLIP multimodal embeddings** | Frames and text queries are embedded into the same cosine space; search operates across modalities without a bridge model | This is the entire mechanism by which text retrieves images — without it, the product does not exist |
| **HNSW index with sub-15ms latency** | Interactive search — results appear in under a second even on large collections | Makes the product feel like search, not a batch job |
| **Filter DSL** | Camera, date, hour, and motion score filters are applied server-side before vector comparison; supports `.eq()`, `.gte()`, `.lte()`, `.between()`, and `.must()` chaining | Scoping search to a camera and time window before running HNSW dramatically reduces result noise and improves precision |
| **Real-time indexing** | New frames are upserted individually as they are captured; no batch re-index required | Live feed mode is only viable because newly indexed frames are immediately searchable |
| **Edge and offline deployment** | Entire stack runs in Docker on a laptop, Raspberry Pi 5, or ARM industrial PC with no internet connection | The privacy guarantee — footage never leaves the device — is structurally enforced, not just a policy claim |
| **ARM64 Docker image** | Tested on Apple Silicon (M1/M2/M3) and compatible with Raspberry Pi CM4 and AWS Graviton | Enables deployment on energy-efficient edge hardware colocated with cameras |
| **VDE snapshots** | The indexed frame collection can be snapshotted and restored; a baseline index can be distributed to a new machine via USB | Enables portable deployment — bring the DB to a new site without re-indexing all footage |
| **gRPC transport** | All SDK calls use gRPC; the Python client handles serialisation transparently | Low-overhead communication between backend and DB on the same host; critical for live feed throughput |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Machine                          │
│                                                                 │
│  ┌──────────────┐     ┌──────────────────┐     ┌────────────┐  │
│  │   Browser    │────▶│  React Frontend  │     │  Webcam /  │  │
│  │  :3000       │◀────│  Vite + Tailwind │     │  RTSP feed │  │
│  └──────────────┘     └────────┬─────────┘     └─────┬──────┘  │
│                                │ HTTP                 │         │
│                                ▼                      │         │
│                       ┌────────────────┐              │         │
│                       │ FastAPI Backend│◀─────────────┘         │
│                       │   :8000        │  live.py capture       │
│                       │                │  thread                │
│                       │  main.py       │                        │
│                       │  indexer.py    │  ┌──────────────────┐  │
│                       │  searcher.py   │  │  CLIP ViT-B/32   │  │
│                       │  voice.py      │  │  (sentence-      │  │
│                       │  live.py       │  │   transformers)  │  │
│                       │  motion.py     │  │  512-dim embed   │  │
│                       └───────┬────────┘  └──────────────────┘  │
│                               │ gRPC :50051                     │
│                               ▼                                 │
│                       ┌────────────────┐                        │
│                       │ Actian VectorAI│                        │
│                       │ DB             │  /data volume          │
│                       │                │◀──────────────────────┐│
│                       │  HNSW index    │  persistent frames     ││
│                       │  Filter DSL    │  + metadata            ││
│                       │  DBSF fusion   │                        ││
│                       └────────────────┘                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ footage/   data/thumbnails/   data/vectorai/            │   │
│  │ (video files)  (JPEG thumbs)  (VectorAI DB persistent)  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Zero network egress. No external API calls.                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
silentwitness/
│
├── docker-compose.yml              # Orchestrates VectorAI DB, backend, frontend
├── .env.example                    # Environment variable reference
├── .gitignore
│
├── backend/
│   ├── Dockerfile                  # Python 3.11-slim + ffmpeg + pre-downloaded models
│   ├── requirements.txt            # Python dependencies
│   ├── config.py                   # Environment config + directory setup
│   ├── db.py                       # VectorAI DB client, collection creation, stats
│   ├── motion.py                   # OpenCV motion detection, frame differencing
│   ├── indexer.py                  # CLIP embedding pipeline, batch upsert, thumbnails
│   ├── searcher.py                 # Search pipeline, Filter DSL, DBSF fusion, event clustering
│   ├── searcher_similarity.py      # Frame-to-frame similarity search
│   ├── voice.py                    # Whisper tiny local transcription
│   ├── live.py                     # Live webcam/RTSP indexing, background threads
│   └── main.py                     # FastAPI application, all API routes
│
├── frontend/
│   ├── Dockerfile                  # Node 20 build + nginx serving
│   ├── nginx.conf                  # SPA routing + API proxy
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx                # React entry point
│       ├── index.css               # Design system (CSS custom properties)
│       ├── App.jsx                 # Application shell, routing, state management
│       ├── api.js                  # Axios API client
│       └── components/
│           ├── SearchBar.jsx       # Text input + voice button + example queries
│           ├── VoiceButton.jsx     # MediaRecorder, Whisper API integration
│           ├── FilterPanel.jsx     # Camera / date / hour / motion filters
│           ├── ResultsGrid.jsx     # Bento event cards + frame grid + stats strip
│           ├── FrameModal.jsx      # Frame detail modal with metadata
│           ├── Timeline.jsx        # Activity heatmap visualisation
│           ├── IndexPanel.jsx      # Video upload + folder scan + job status
│           ├── LiveFeedPanel.jsx   # Live feed start/stop + counters
│           └── StatusBar.jsx       # DB connection status + frame count
│
└── scripts/
    └── generate_demo.py            # Synthetic demo video generator (no camera needed)
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)
- The Actian VectorAI DB Python SDK `.whl` file from the [beta repository](https://github.com/hackmamba-io/actian-vectorAI-db-beta) — download `actian_vectorai-0.1.0b2-py3-none-any.whl` and place it in `backend/`

### Step 1 — Clone the repository

```bash
git clone https://github.com/AryanSaxenaa/silentwitness.git
cd silentwitness
```

### Step 2 — Add the VectorAI DB SDK

Download the wheel file from the [beta repo](https://github.com/hackmamba-io/actian-vectorAI-db-beta) and copy it into the backend directory:

```bash
cp actian_vectorai-0.1.0b2-py3-none-any.whl backend/
```

Update `backend/requirements.txt` to reference the local file, or install it directly:

```bash
pip install backend/actian_vectorai-0.1.0b2-py3-none-any.whl
```

### Step 3 — Configure environment

```bash
cp .env.example .env
mkdir -p footage data
```

The defaults work out of the box. Edit `.env` only if you need to change ports or directories.

### Step 4 — Add footage

Drop any `.mp4`, `.avi`, `.mkv`, `.mov`, or `.ts` files into the `footage/` directory.

**No footage available? Generate a synthetic demo video:**

```bash
pip install opencv-python numpy
python scripts/generate_demo.py
```

This creates `footage/cam1_20260413_100000.mp4` — a 3-minute synthetic video with six labelled events (person entering, bag left unattended, two people talking, person running, car parked, suspicious activity near exit) at known timestamps. It is designed to validate every search feature without requiring a real camera.

### Step 5 — Start the stack

```bash
docker compose up
```

Docker Compose starts three services:

| Service | Port | Description |
|---|---|---|
| `vectoraidb` | 50051 | Actian VectorAI DB (gRPC) |
| `backend` | 8000 | FastAPI + indexing + search |
| `frontend` | 3000 | React application |

The backend Docker image pre-downloads the CLIP ViT-B/32 and Whisper tiny models at build time so the first request is instant.

### Step 6 — Index footage

Open [http://localhost:3000](http://localhost:3000) in a browser.

Click **Index** in the top-right navigation → **Scan footage folder**. The backend will scan the `footage/` directory, extract motion frames, embed them with CLIP, and upsert them to VectorAI DB. Progress is visible in the indexing jobs panel.

Alternatively, trigger indexing directly via the API:

```bash
# Scan all videos in footage/
curl -X POST http://localhost:8000/api/index/scan

# Monitor progress
curl http://localhost:8000/api/index/jobs
```

### Step 7 — Search

Type any description into the search bar. Results appear grouped into incident events with thumbnails, timestamps, and match scores.

To test voice search, click the microphone icon and speak your query. Whisper transcribes it locally and the search runs automatically.

---

## Development Setup

To run the backend and frontend individually without Docker:

### Backend

```bash
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install actian_vectorai-0.1.0b2-py3-none-any.whl

# Start VectorAI DB via Docker (required)
docker run -d --name vectoraidb \
  -v $(pwd)/../data/vectorai:/data \
  -p 50051:50051 \
  williamimoh/actian-vectorai-db:latest

# Start the backend
uvicorn main:app --reload --port 8000
```

The API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI) after starting the backend.

### Frontend

```bash
cd frontend
npm install
npm run dev
# Available at http://localhost:3000
```

---

## API Reference

### Search

#### `POST /api/search`

Execute a semantic search query over indexed footage.

**Request body:**

```json
{
  "query": "person leaving a bag near the counter",
  "camera_id": "cam1",
  "date": "2026-04-13",
  "hour_start": 10,
  "hour_end": 14,
  "min_motion_score": 0.05,
  "limit": 20,
  "group_into_events": true
}
```

All fields except `query` are optional. `group_into_events: true` returns results clustered into incident events; `false` returns raw ranked frames.

#### `GET /api/search?q=<query>`

Convenience endpoint for quick testing from a browser or curl.

#### `POST /api/search/similar`

Find frames visually similar to an existing indexed frame, using its stored CLIP vector directly.

```json
{
  "frame_id": "550e8400-e29b-41d4-a716-446655440000",
  "exclude_same_video": false,
  "limit": 20
}
```

### Voice

#### `POST /api/voice`

Accepts a multipart audio upload (WebM, WAV, MP3, OGG). Transcribes with Whisper locally, then executes a semantic search. Returns `transcribed_query` alongside the standard search response.

### Indexing

#### `POST /api/index/scan`

Scans the `footage/` directory and queues all supported video files for indexing as background tasks.

#### `POST /api/index/upload`

Accepts a multipart video file upload. Saves to `footage/` and queues for indexing.

#### `GET /api/index/jobs`

Returns the status of all indexing jobs, including frame counts and errors.

### Live Feed

#### `POST /api/live/start`

```json
{
  "source": "0",
  "camera_id": "live",
  "fps_sample": 1.0,
  "min_motion_score": 0.01
}
```

Starts a background thread that captures from the specified source and indexes frames in real time. `source` accepts a webcam index (`"0"`, `"1"`) or an RTSP URL.

#### `POST /api/live/stop?camera_id=live`

Stops the live feed indexer for the specified camera.

#### `GET /api/live/status`

Returns frame counts, drop counts, and error status for all active live feeds.

### Utilities

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | DB connection status, frame count, camera list |
| `/api/cameras` | GET | All camera IDs present in the index |
| `/api/footage` | GET | Video files in the footage directory |
| `/api/timeline` | GET | Activity heatmap data bucketed by time |
| `/thumbnails/{id}.jpg` | GET | Serve a frame thumbnail by frame ID |
| `/health` | GET | Service health check |

---

## Demo Script

The following sequence is designed to demonstrate every judging criterion in under five minutes.

**Setup (before demo):**
1. Start `docker compose up`
2. Generate and index the synthetic demo video
3. Confirm the status bar shows a frame count > 0

**Live demonstration:**

1. Open [http://localhost:3000](http://localhost:3000) and show the hero screen — note the stats: `<15ms` latency, `100%` offline, `0` bytes sent
2. Click **Index** → **Scan footage folder** — briefly show the indexing job progress updating in real time (demonstrating VectorAI DB real-time indexing)
3. **Disconnect from the internet** — pull the ethernet cable or enable airplane mode
4. Click the microphone icon, speak: *"someone leaving a bag near the counter"* — show Whisper transcribing locally; results appear
5. Show the incident timeline heatmap — hover a peak bar to preview thumbnails from that time window
6. Click **Find similar moments** on the top result — show VectorAI DB returning visually similar frames using the stored vector directly
7. Apply filters: Camera = `cam1`, Time = `10:00–12:00`, watch results update instantly (demonstrating Filter DSL)
8. Open the browser network inspector — show zero requests to any external host
9. Click **Live** in the navigation — start live webcam indexing; show the frame counter incrementing in real time; run a voice query; show the live frame appearing in results
10. Final statement: *"Every frame in this demo was processed, stored, and searched entirely on this machine. The footage never left the building."*

---

## Bonus Points

The following bonus criteria from the hackathon judging rubric are all satisfied by the core architecture — they are not bolt-on features.

- [x] **Deployed locally without cloud dependency** — the entire stack (VectorAI DB, CLIP inference, Whisper transcription, FastAPI, React) runs in Docker containers with no external service calls after initial image pull
- [x] **Works offline** — no internet connection is required for indexing, searching, voice transcription, or live feed operation; all models are pre-downloaded at Docker build time
- [x] **Runs on ARM** — the VectorAI DB Docker image supports `linux/arm64`; the backend runs on Python 3.11 which is available for ARM; tested on Apple Silicon (M1/M2/M3) and compatible with Raspberry Pi 5 and AWS Graviton

---

## Tech Stack

| Component | Technology | Version |
|---|---|---|
| Vector database | [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/) | v1.0.0 (beta) |
| Python SDK | actian-vectorai | 0.1.0b2 |
| Multimodal embeddings | [CLIP ViT-B/32](https://huggingface.co/sentence-transformers/clip-ViT-B-32) via sentence-transformers | 512-dim |
| Speech-to-text | [OpenAI Whisper](https://github.com/openai/whisper) tiny (local) | 20231117 |
| Motion detection | [OpenCV](https://opencv.org/) | 4.10 |
| Backend framework | [FastAPI](https://fastapi.tiangolo.com/) | 0.115 |
| Backend server | [Uvicorn](https://www.uvicorn.org/) | 0.30 |
| Frontend framework | [React](https://react.dev/) | 18 |
| Frontend build tool | [Vite](https://vitejs.dev/) | 5 |
| CSS framework | [Tailwind CSS](https://tailwindcss.com/) | 3 |
| Containerisation | [Docker](https://www.docker.com/) + Compose | — |
| Transport protocol | gRPC (via grpcio) | ≥1.70 |
| Data validation | [Pydantic](https://docs.pydantic.dev/) | ≥2.10 |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VECTORAI_HOST` | `localhost` | Hostname of the VectorAI DB container |
| `VECTORAI_PORT` | `50051` | gRPC port for VectorAI DB |
| `FOOTAGE_DIR` | `./footage` | Directory containing video files to index |
| `DATA_DIR` | `./data` | Directory for thumbnails and index data |
| `FRAME_RATE` | `1` | Frames per second to sample from each video |
| `MOTION_THRESHOLD` | `25` | Pixel difference threshold for motion detection (0–255); lower values are more sensitive |

---

*Built for the [Actian VectorAI DB Build Challenge](https://dorahacks.io/hackathon/2097/detail) · April 2026 · [github.com/AryanSaxenaa/silentwitness](https://github.com/AryanSaxenaa/silentwitness)*
