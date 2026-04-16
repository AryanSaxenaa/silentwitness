# SilentWitness 👁

> **Offline, privacy-first semantic search for security footage.**
> Describe what you're looking for. Land on the exact frame. No scrubbing. No cloud.

Built for the [Actian VectorAI DB Build Challenge](https://dorahacks.io/hackathon/2097/detail).

---

## What it does

Instead of scrubbing through hours of security footage, you type a natural language description:

- *"person leaving a bag near the counter"*
- *"two people arguing near the exit"*
- *"car parked in a restricted area"*

SilentWitness returns the exact frames — ranked by semantic relevance, grouped into events, filtered by camera, time, and motion activity.

**Your footage never leaves your machine.** No cloud API calls. Works fully offline.

---

## How it works

```
Video footage
     │
     ▼
Motion detection (OpenCV)
Only frames with activity are processed — empty hallways are skipped.
     │
     ▼
CLIP ViT-B/32 embedding (sentence-transformers, local)
Each frame becomes a 512-dimensional vector capturing visual meaning.
Text queries are embedded in the same space — enabling cross-modal search.
     │
     ▼
Actian VectorAI DB (local Docker, gRPC)
HNSW index — sub-15ms queries across millions of frames.
Filter DSL: scope by camera, date, hour, motion score before vector search.
     │
     ▼
DBSF score fusion
Combines CLIP semantic score + motion activity score into a single ranking.
High-motion frames are boosted — finding action, not empty rooms.
     │
     ▼
Event clustering
Consecutive frames within 10 seconds are grouped into "incidents."
You see events, not isolated frames.
     │
     ▼
React UI
Clean, dark-mode interface. Frame thumbnails. Event timeline. Modal detail view.
```

### Why Actian VectorAI DB is architecturally irreplaceable

| Feature | How SilentWitness uses it |
|---|---|
| CLIP multimodal embeddings | Places frame images and text queries in the same vector space — the core of cross-modal search |
| HNSW index (sub-15ms) | Makes interactive search viable — results appear as fast as typing |
| Filter DSL | Scopes search to camera, time window, and motion level before vector comparison runs |
| Real-time indexing | New footage is searchable immediately after ingestion, no batch re-index jobs |
| Edge/offline deployment | Entire stack runs on-device — Raspberry Pi 5, laptop, air-gapped server |
| ARM64 Docker image | Runs natively on Apple Silicon, Raspberry Pi, ARM industrial PCs |
| VDE snapshots | Index state can be snapshotted, ported, and restored across machines |

---

## Quick start

### Prerequisites
- Docker + Docker Compose
- Python 3.10+ (for running indexer directly)
- OR: just Docker Compose for the full stack

### 1. Clone and set up

```bash
git clone https://github.com/AryanSaxenaa/silentwitness.git
cd silentwitness
cp .env.example .env
mkdir -p footage data
```

### 2. Add footage

Drop your `.mp4` / `.avi` / `.mkv` files into the `footage/` folder.

**No real footage? Generate a synthetic demo:**
```bash
pip install opencv-python numpy
python scripts/generate_demo.py
# Creates footage/cam1_20260413_100000.mp4 with labeled events
```

### 3. Start everything

```bash
docker compose up
```

This starts:
- **VectorAI DB** on port 50051 (gRPC)
- **FastAPI backend** on port 8000
- **React frontend** on port 3000

### 4. Index your footage

Open http://localhost:3000 → click **"Index footage"** → **"Scan folder"**

Or via API:
```bash
curl -X POST http://localhost:8000/api/index/scan
```

Watch the job status:
```bash
curl http://localhost:8000/api/index/jobs
```

### 5. Search

Open http://localhost:3000 and type what you're looking for.

Or via API:
```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "person leaving a bag near the counter", "limit": 10}'
```

---

## Running without Docker (development)

### Backend

```bash
cd backend
pip install -r requirements.txt

# Install Actian VectorAI DB Python SDK
pip install ../actian_vectorai-0.1.0b2-py3-none-any.whl

# Start VectorAI DB separately (Docker)
docker run -d --name vectoraidb \
  -v ./data/vectorai:/data \
  -p 50051:50051 \
  williamimoh/actian-vectorai-db:latest

# Start backend
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## API reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/search` | POST | Semantic search with filters |
| `/api/search?q=...` | GET | Quick search via query param |
| `/api/index/upload` | POST | Upload + index a video file |
| `/api/index/scan` | POST | Index all videos in footage/ |
| `/api/index/jobs` | GET | Indexing job status |
| `/api/cameras` | GET | List indexed camera IDs |
| `/api/footage` | GET | List video files in footage/ |
| `/api/status` | GET | DB connection + frame count |
| `/thumbnails/{id}.jpg` | GET | Serve frame thumbnail |

### Search request body

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

---

## Architecture

```
silentwitness/
├── docker-compose.yml          # VectorAI DB + backend + frontend
├── backend/
│   ├── main.py                 # FastAPI app + API routes
│   ├── config.py               # Environment config
│   ├── db.py                   # VectorAI DB client + collection setup
│   ├── motion.py               # OpenCV motion detection + frame extraction
│   ├── indexer.py              # CLIP embedding + VectorAI DB upsert pipeline
│   ├── searcher.py             # Search pipeline + Filter DSL + DBSF fusion
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx             # Main app shell
│       ├── api.js              # API client
│       └── components/
│           ├── SearchBar.jsx   # Query input + example queries
│           ├── FilterPanel.jsx # Camera / date / time / motion filters
│           ├── ResultsGrid.jsx # Event cards + frame grid
│           ├── FrameModal.jsx  # Frame detail modal
│           ├── IndexPanel.jsx  # Upload + scan + job status
│           └── StatusBar.jsx   # DB status + frame count
├── scripts/
│   └── generate_demo.py       # Synthetic demo video generator
└── .env.example
```

---

## Demo script (for judges)

1. **Show the footage folder** — a real (or synthetic) video file, nothing else
2. **Click "Scan folder"** — watch the indexing progress show frames being embedded
3. **Disconnect from the internet** (pull the ethernet cable, enable airplane mode)
4. **Type:** `"person leaving a bag near the counter"` — hit Search
5. **Show the results** — frames grouped into events, ranked by match score
6. **Apply a filter** — restrict to `10am–2pm`, watch results update instantly
7. **Click an event** — show the detail modal with timestamp and video filename
8. **Open network monitor** — show zero bytes sent to any external server
9. **Key line:** *"This footage never left the building."*

---

## Bonus points checklist

- [x] **Runs locally without cloud dependency** — entire stack in Docker, zero external API calls
- [x] **Works offline** — no connectivity required after initial Docker image pull
- [x] **ARM support** — VectorAI DB Docker image is multi-arch (linux/arm64), tested on Apple Silicon

---

## Built with

- [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/) — vector database, edge-first
- [CLIP ViT-B/32](https://huggingface.co/sentence-transformers/clip-ViT-B-32) — multimodal embeddings
- [FastAPI](https://fastapi.tiangolo.com/) — Python backend
- [React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/) — frontend
- [OpenCV](https://opencv.org/) — motion detection + frame extraction
- [sentence-transformers](https://www.sbert.net/) — CLIP inference

---

*Built for the Actian VectorAI DB Build Challenge, April 2026.*
