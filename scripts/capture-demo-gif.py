#!/usr/bin/env python3
"""Capture Playground demo frames into docs/assets/demo.gif (zero-key smoke + panel open)."""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

try:
    from PIL import Image
    from playwright.sync_api import sync_playwright
except ImportError as exc:
    print(f"Missing dependency: {exc}. Run: pip install pillow playwright", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "assets" / "demo.gif"
PLAYGROUND_URL = os.environ.get("AI_DEMO_PLAYGROUND_URL", "http://localhost:5173")


def capture_frames() -> list[Image.Image]:
    frames: list[Image.Image] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 760, "height": 520})
        page.goto(f"{PLAYGROUND_URL.rstrip('/')}/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1200)

        for _ in range(2):
            frames.append(screenshot(page))
            page.wait_for_timeout(400)

        # Wait for smoke checklist (if backend reachable)
        try:
            page.wait_for_selector(".smoke-check.pass", timeout=20000)
        except Exception:
            pass
        frames.append(screenshot(page))

        fab = page.locator(".ai-fab").first
        if fab.count():
            fab.click()
            page.wait_for_timeout(800)
            frames.append(screenshot(page))
            page.wait_for_timeout(600)
            frames.append(screenshot(page))

        browser.close()
    return frames


def screenshot(page) -> Image.Image:
    png = page.screenshot(type="png", full_page=False)
    return Image.open(io.BytesIO(png)).convert("P", palette=Image.ADAPTIVE, colors=128)


def main() -> None:
    frames = capture_frames()
    if len(frames) < 2:
        raise SystemExit("Need at least 2 frames for demo.gif")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=450,
        loop=0,
        optimize=True,
    )
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {len(frames)} frames)")


if __name__ == "__main__":
    main()
