# Clipchamp assets — Arc Flash (IEEE 1584) tutorial

Branded intro/theory slides matching [electrisim.com](https://electrisim.com/) colours (`#2f5bea` primary, `#10b981` accent, Josefin Sans + Nunito fonts) — same system as PowerFactory comparison and BESS weak-grid tutorials.

## Files

| File | Use in Clipchamp |
|------|------------------|
| [`arc_flash_title.png`](arc_flash_title.png) | **Title card** — drag directly (5–8 s) |
| [`arc_flash_theory1.png`](arc_flash_theory1.png) | **Theory 1** — Ibf→Iarc→IE→AFB→PPE (25–35 s) |
| [`arc_flash_theory2.png`](arc_flash_theory2.png) | **Theory 2** — IEEE inputs / electrodes (25–35 s) |
| [`arc_flash_tutorial_intro.html`](arc_flash_tutorial_intro.html) | Source **1920×1080** HTML (re-screenshot if you edit copy) |
| [`../ARC_FLASH_VIDEO_SCRIPT.md`](../ARC_FLASH_VIDEO_SCRIPT.md) | Full timed voice-over + recording checklist |
| [`../arc_flash_industrial_demo.py`](../arc_flash_industrial_demo.py) | Pandapower model to import in Electrisim |

## Suggested Clipchamp timeline (~6–8 min)

| Time | Asset / action |
|------|----------------|
| 0:00–0:08 | HTML slide 1 — Title |
| 0:08–0:40 | HTML slide 2 — What is arc flash |
| 0:40–1:15 | HTML slide 3 — IEEE 1584 inputs |
| 1:15–7:00 | Screen recording of Electrisim (import → run → discuss) |
| 7:00–7:20 | Optional end: title slide again or app.electrisim.com card |

## How to capture slides

1. Open `arc_flash_tutorial_intro.html` in Chrome or Edge (ideally on a **1920×1080** display).
2. Press **F11** for fullscreen. Each `<section class="slide">` is exactly 1920×1080 — scroll so one slide fills the viewport.
3. Capture with **Win + Shift + S** or Snipping Tool → save as PNG.
4. Import PNGs into Clipchamp as **Images** (5–8 s title, ~25–35 s each theory slide).

Logo loads from `https://electrisim.com/assets/img/logo_Electrisim_removebg-preview.png` (internet required when opening HTML).

## Brand reference

- Primary blue: `#2f5bea`
- Green (IEEE / success): `#10b981` → `#059669`
- Headings: Josefin Sans · Body: Nunito
- Badge: **Tutorial · Electrisim · Arc Flash**
- Footer: **Electrisim • electrisim.com**

## Demo dialog defaults (for live segment)

- Electrode: **VCB**
- Working distance: **455 mm**
- Gap: **25 mm**
- Enclosure: **508 × 508 × 508 mm**
- Clearing time: **0.2 s** (both)
