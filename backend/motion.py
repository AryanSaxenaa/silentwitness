"""
Motion detection using background subtraction plus frame differencing.

This keeps the indexing path lightweight while improving over raw frame diff:
- MOG2 handles gradual lighting change and moving foreground better
- frame differencing still helps capture sudden scene changes
"""

import cv2
import numpy as np
from config import MOTION_THRESHOLD


def _normalize_mask(mask: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(mask, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 220, 255, cv2.THRESH_BINARY)
    kernel = np.ones((3, 3), np.uint8)
    opened = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    return cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)


def compute_motion_score(
    prev_frame_gray: np.ndarray | None,
    curr_frame_gray: np.ndarray,
    subtractor=None,
) -> float:
    """
    Returns a 0.0-1.0 motion score for the current frame.

    The score is a weighted blend of:
    - foreground mask area from MOG2
    - absolute frame difference versus the previous sampled frame
    """
    fg_mask = None
    fg_score = 0.0
    if subtractor is not None:
        fg_mask = subtractor.apply(curr_frame_gray)
        fg_mask = _normalize_mask(fg_mask)
        fg_ratio = float(np.sum(fg_mask > 0)) / float(fg_mask.size)
        fg_score = min(1.0, fg_ratio * 10.0)

    diff_score = 0.0
    if prev_frame_gray is not None:
        diff = cv2.absdiff(prev_frame_gray, curr_frame_gray)
        _, diff_mask = cv2.threshold(diff, MOTION_THRESHOLD, 255, cv2.THRESH_BINARY)
        diff_ratio = float(np.sum(diff_mask > 0)) / float(diff_mask.size)
        diff_score = min(1.0, diff_ratio * 12.0)

    score = (fg_score * 0.35) + (diff_score * 0.65)
    return round(score, 4)


def extract_motion_frames(
    video_path: str,
    fps_sample: float = 1.0,
    min_motion_score: float = 0.02,
):
    """
    Yield (frame_index, timestamp_sec, frame_bgr, motion_score) for sampled frames
    that pass the motion gate.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(video_fps / fps_sample))
    subtractor = cv2.createBackgroundSubtractorMOG2(
        history=120,
        varThreshold=max(MOTION_THRESHOLD, 16),
        detectShadows=False,
    )

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
            score = compute_motion_score(prev_gray, curr_gray, subtractor=subtractor)

            if prev_gray is None or score >= min_motion_score:
                yield sampled_idx, timestamp_sec, frame, score if prev_gray is not None else 0.0
                sampled_idx += 1

            prev_gray = curr_gray

        frame_idx += 1

    cap.release()
