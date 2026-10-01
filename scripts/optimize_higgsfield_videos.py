"""Ajusta los cinco MP4 a las duraciones y al peso del demo."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    "menu_loop.mp4": (0.0, 10.0),
    "intro.mp4": (0.0, 8.0),
    "jumpscare_lucia.mp4": (1.5, 3.0),
    "jumpscare_daniela.mp4": (0.0, 2.0),
    "ending_gym.mp4": (0.0, 6.0),
}


def probe(path: Path) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def main() -> None:
    for name, (start, duration) in SPECS.items():
        path = ROOT / "public" / "assets" / "video" / name
        metadata = probe(path)
        streams = metadata["streams"]
        video = next(stream for stream in streams if stream["codec_type"] == "video")
        actual = float(metadata["format"]["duration"])
        if (
            video["width"] == 1920
            and video["height"] == 1080
            and not any(stream["codec_type"] == "audio" for stream in streams)
            and abs(actual - duration) < 0.2
        ):
            print(f"{name}: already optimized", flush=True)
            continue
        filters = ["fps=24"]
        if video["width"] != 1920 or video["height"] != 1080:
            filters.append("scale=1080:1080:flags=lanczos")
            filters.append("pad=1920:1080:420:0:black")
        temp = path.with_suffix(".optimized.mp4")
        command = ["ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path), "-t", str(duration), "-an", "-vf", ",".join(filters), "-c:v", "libx264", "-preset", "slow", "-crf", "29", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(temp), "-y"]
        subprocess.run(command, check=True)
        checked = probe(temp)
        output_video = next(stream for stream in checked["streams"] if stream["codec_type"] == "video")
        if output_video["width"] != 1920 or output_video["height"] != 1080:
            raise ValueError(f"Unexpected dimensions for {name}")
        if any(stream["codec_type"] == "audio" for stream in checked["streams"]):
            raise ValueError(f"Audio remains in {name}")
        temp.replace(path)
        print(f"{name}: {path.stat().st_size:,} bytes, {checked['format']['duration']} s", flush=True)


if __name__ == "__main__":
    main()
