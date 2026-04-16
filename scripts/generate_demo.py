"""
Generate a synthetic demo video for testing SilentWitness without real security footage.
Creates a 3-minute video with labeled "events" at specific timestamps.
Requires: pip install opencv-python numpy
"""
import cv2
import numpy as np
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'footage')
os.makedirs(OUTPUT_DIR, exist_ok=True)

WIDTH, HEIGHT = 1280, 720
FPS = 25
DURATION_SEC = 180  # 3 minutes

# Events to embed: (start_sec, end_sec, label, background_color)
EVENTS = [
    (10, 20,  "Person entering through door",     (20, 20, 60)),
    (35, 50,  "Two people talking near counter",   (20, 40, 20)),
    (70, 85,  "Someone leaving a bag",             (60, 20, 20)),
    (100,115, "Person running across frame",       (40, 20, 60)),
    (130,145, "Car parked in restricted zone",     (20, 50, 50)),
    (160,175, "Suspicious activity near exit",     (60, 40, 20)),
]


def get_event_at(t_sec):
    for start, end, label, color in EVENTS:
        if start <= t_sec < end:
            return label, color
    return None, (10, 10, 10)


def draw_frame(frame_idx, t_sec, label, bg_color):
    frame = np.full((HEIGHT, WIDTH, 3), bg_color, dtype=np.uint8)

    # Add noise for texture
    noise = np.random.randint(-15, 15, frame.shape, dtype=np.int16)
    frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # Camera overlay
    cv2.rectangle(frame, (0, 0), (WIDTH, 30), (0, 0, 0), -1)
    cv2.putText(frame, f"CAM1 | {t_sec//60:02d}:{t_sec%60:02d} | demo_footage.mp4",
                (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

    # Event label
    if label:
        # Motion indicator
        cv2.circle(frame, (WIDTH - 30, 15), 6, (0, 0, 255), -1)

        # Event description box
        text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)[0]
        box_x = WIDTH // 2 - text_size[0] // 2 - 20
        box_y = HEIGHT // 2 - 40
        cv2.rectangle(frame, (box_x, box_y), (box_x + text_size[0] + 40, box_y + 60),
                      (0, 0, 0), -1)
        cv2.putText(frame, label,
                    (box_x + 20, box_y + 42),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

        # Simulated bounding box (person/object)
        bx = WIDTH // 2 - 80 + int(20 * np.sin(t_sec * 2))
        by = HEIGHT // 2 + 20
        cv2.rectangle(frame, (bx, by), (bx + 160, by + 200), (0, 255, 100), 2)
    else:
        cv2.putText(frame, "No significant activity",
                    (WIDTH // 2 - 140, HEIGHT // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (60, 60, 60), 1)

    # Grid overlay (simulates camera lens)
    for x in range(0, WIDTH, 80):
        cv2.line(frame, (x, 0), (x, HEIGHT), (30, 30, 30), 1)
    for y in range(0, HEIGHT, 80):
        cv2.line(frame, (0, y), (WIDTH, y), (30, 30, 30), 1)

    return frame


def generate():
    output_path = os.path.join(OUTPUT_DIR, 'cam1_20260413_100000.mp4')
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(output_path, fourcc, FPS, (WIDTH, HEIGHT))

    total_frames = DURATION_SEC * FPS
    print(f"Generating {DURATION_SEC}s demo video ({total_frames} frames)...")

    for frame_idx in range(total_frames):
        t_sec = frame_idx // FPS
        label, bg_color = get_event_at(t_sec)
        frame = draw_frame(frame_idx, t_sec, label, bg_color)
        writer.write(frame)

        if frame_idx % (FPS * 10) == 0:
            print(f"  {t_sec}s / {DURATION_SEC}s")

    writer.release()
    print(f"\nDemo video saved: {output_path}")
    print("Events embedded:")
    for start, end, label, _ in EVENTS:
        print(f"  {start:3d}s–{end:3d}s: {label}")


if __name__ == '__main__':
    generate()
