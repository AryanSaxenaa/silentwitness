import os
from dotenv import load_dotenv

load_dotenv()

VECTORAI_HOST = os.getenv("VECTORAI_HOST", "localhost")
VECTORAI_PORT = int(os.getenv("VECTORAI_PORT", "50051"))

FOOTAGE_DIR = os.getenv("FOOTAGE_DIR", "./footage")
DATA_DIR = os.getenv("DATA_DIR", "./data")
THUMBNAILS_DIR = os.path.join(DATA_DIR, "thumbnails")

FRAME_RATE = float(os.getenv("FRAME_RATE", "1"))          # fps to sample
MOTION_THRESHOLD = int(os.getenv("MOTION_THRESHOLD", "25"))  # pixel diff threshold

CLIP_MODEL = "clip-ViT-B-32"
CLIP_DIM = 512

COLLECTION_NAME = "security_frames"

os.makedirs(THUMBNAILS_DIR, exist_ok=True)
os.makedirs(FOOTAGE_DIR, exist_ok=True)
