"""
Smoke test for SilentWitness live API.

Flow:
1. Ensure footage exists
2. Rebuild the index
3. Wait for indexing to complete
4. Verify runtime retrieval sanity is healthy
5. Run a semantic search
6. Run a similarity search from a returned frame

Usage:
    python scripts/smoke_test.py
    python scripts/smoke_test.py --base-url http://localhost:8000
"""

from __future__ import annotations

import argparse
import http.client
import json
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_QUERY = "person entering store"


def request_json(
    method: str,
    url: str,
    payload: dict | None = None,
    retries: int = 3,
    retry_delay_sec: int = 2,
) -> dict:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    last_error = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            TimeoutError,
            http.client.RemoteDisconnected,
            ConnectionAbortedError,
            socket.timeout,
            OSError,
        ) as exc:
            last_error = exc
            if attempt == retries - 1:
                break
            time.sleep(retry_delay_sec)

    raise RuntimeError(f"Request failed for {method} {url}: {last_error}")


def wait_for_service(base_url: str, timeout_sec: int = 120) -> None:
    deadline = time.time() + timeout_sec
    last_error = None
    while time.time() < deadline:
        try:
            health = request_json("GET", f"{base_url}/health", retries=1)
            if health.get("status") == "ok":
                return
        except RuntimeError as exc:
            last_error = exc
        time.sleep(3)

    raise RuntimeError(f"Timed out waiting for backend health. Last error: {last_error}")


def wait_for_jobs(base_url: str, timeout_sec: int = 900) -> dict:
    deadline = time.time() + timeout_sec
    last = {}
    while time.time() < deadline:
        last = request_json("GET", f"{base_url}/api/index/jobs")
        if last and all(job.get("status") in {"done", "error"} for job in last.values()):
            return last
        time.sleep(5)
    raise RuntimeError(f"Timed out waiting for indexing jobs. Last state: {last}")


def wait_for_retrieval_sanity(base_url: str, timeout_sec: int = 180) -> dict:
    deadline = time.time() + timeout_sec
    last = {}
    while time.time() < deadline:
        status = request_json("GET", f"{base_url}/api/status")
        last = (status.get("runtime_health") or {}).get("retrieval_sanity") or {}
        if last.get("ok"):
            return last
        time.sleep(5)
    raise RuntimeError(f"Timed out waiting for retrieval sanity. Last state: {last}")


def extract_frame_id(search_result: dict) -> str | None:
    events = search_result.get("events") or []
    if events and events[0].get("frames"):
        return events[0]["frames"][0].get("frame_id")

    frames = search_result.get("frames") or []
    if frames:
        return frames[0].get("frame_id")

    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--query", default=DEFAULT_QUERY)
    parser.add_argument("--job-timeout-sec", type=int, default=900)
    parser.add_argument("--sanity-timeout-sec", type=int, default=180)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    try:
        wait_for_service(base_url)
        print("[0/6] Backend health check passed")

        footage = request_json("GET", f"{base_url}/api/footage")
        files = footage.get("files") or []
        if not files:
            raise RuntimeError("No footage files found in shared footage directory.")

        print(f"[1/6] Footage files found: {len(files)}")

        rebuild = request_json("POST", f"{base_url}/api/index/rebuild")
        print(f"[2/6] Rebuild queued: {rebuild.get('queued', 0)} job(s)")

        jobs = wait_for_jobs(base_url, timeout_sec=args.job_timeout_sec)
        errors = {job_id: job for job_id, job in jobs.items() if job.get("status") == "error"}
        if errors:
            raise RuntimeError(f"Index rebuild failed: {errors}")
        print(f"[3/6] Rebuild completed: {len(jobs)} job(s)")

        sanity = wait_for_retrieval_sanity(base_url, timeout_sec=args.sanity_timeout_sec)
        print(f"[4/6] Retrieval sanity healthy: {sanity.get('similar_results', 0)} similar match(es)")

        search_result = request_json(
            "POST",
            f"{base_url}/api/search",
            {
                "query": args.query,
                "camera_id": None,
                "date": None,
                "hour_start": None,
                "hour_end": None,
                "min_motion_score": None,
                "limit": 20,
                "group_into_events": True,
            },
        )
        total_results = int(search_result.get("total_results", 0) or 0)
        if total_results <= 0:
            raise RuntimeError(f"Semantic search returned no results for query: {args.query}")
        print(f"[5/6] Search returned {total_results} result(s)")

        frame_id = extract_frame_id(search_result)
        if not frame_id:
            raise RuntimeError("Could not extract a frame ID from search results for similarity search.")

        similar_result = request_json(
            "POST",
            f"{base_url}/api/search/similar",
            {
                "frame_id": frame_id,
                "camera_id": None,
                "date": None,
                "hour_start": None,
                "hour_end": None,
                "min_motion_score": None,
                "exclude_same_video": False,
                "limit": 5,
            },
        )
        similar_total = int(similar_result.get("total_results", 0) or 0)
        if similar_total <= 0:
            raise RuntimeError(f"Similarity search returned no results for frame: {frame_id}")
        print(f"[6/6] Similarity search returned {similar_total} result(s)")

        print("Smoke test passed.")
        return 0

    except (
        RuntimeError,
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        http.client.RemoteDisconnected,
        ConnectionAbortedError,
        socket.timeout,
        OSError,
    ) as exc:
        print(f"Smoke test failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
