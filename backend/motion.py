"""
Motion detection using frame differencing.
Only frames with significant motion are indexed — this solves the
throughput problem and keeps the index meaningful.
"""
import cv2
import numpy as np
from config import MOTION_THRESHOLD


def compute_motion_score(prev_frame_gray: np.ndarray, curr_frame_gray: np.ndarray) -> float:
    """
    Returns a 0.0–1.0 motion score between two consecutive grayscale frames.
    Uses frame differencing + Gaussian blur to suppress noise.
    """
    diff = cv2.absdiff(prev_frame_gray, curr_frame_gray)
    blurred = cv2.GaussianBlur(diff, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, MOTION_THRESHOLD, 255, cv2.THRESH_BINARY)
    motion_pixels = np.sum(thresh > 0)
    total_pixels = thresh.shape[0] * thresh.shape[1]
    return round(motion_pixels / total_pixels, 4)


def has_motion(prev_frame_gray: np.ndarray, curr_frame_gray: np.ndarray, min_score: float = 0.005) -> bool:
    """Returns True if motion score exceeds the minimum threshold."""
    return compute_motion_score(prev_frame_gray, curr_frame_gray) >= min_score


def extract_motion_frames(
    video_path: str,
    fps_sample: float = 1.0,
    min_motion_score: float = 0.005,
):
    """
    Generator that yields (frame_index, timestamp_sec, frame_bgr, motion_score)
    for frames that pass the motion gate.

    Args:
        video_path: path to video file
        fps_sample: how many frames per second to sample (default 1)
        min_motion_score: minimum motion to include frame
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(video_fps / fps_sample))

    prev_gray = None
    frame_idx = 0
    sampled_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            timestamp_sec = frame_idx / video_fps

            if prev_gray is not None:
                score = compute_motion_score(prev_gray, curr_gray)
                if score >= min_motion_score:
                    yield sampled_idx, timestamp_sec, frame, score
                    sampled_idx += 1
            else:
                # Always include the very first frame as baseline
                yield sampled_idx, timestamp_sec, frame, 0.0
                sampled_idx += 1

            prev_gray = curr_gray

        frame_idx += 1

    cap.release()
