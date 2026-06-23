# Clipchamp assets — BESS Weak Grid tutorial

Branded intro/outro slides matching [electrisim.com](https://electrisim.com/) colours (`#2f5bea` primary, `#10b981` accent, Josefin Sans + Nunito fonts).

## Files

| File | Use in Clipchamp |
|------|------------------|
| [`bess_weak_grid_clipchamp_intro.png`](bess_weak_grid_clipchamp_intro.png) | **Ready-made title card** — drag directly into Clipchamp (5–8 s) |
| [`bess_weak_grid_intro.html`](bess_weak_grid_intro.html) | Three **1920×1080** HTML slides (title, 5 scenarios, outro) — screenshot if you need exact brand match |

## How to add to Clipchamp

### Option A — Screenshot (quickest)

1. Open `bess_weak_grid_intro.html` in Chrome or Edge (double-click the file).
2. Press **F11** for fullscreen, or zoom until each slide fills the screen.
3. Each `<section class="slide">` is exactly **1920×1080 px** — on a 1920×1080 monitor, one slide = one screen.
4. Capture each slide:
   - **Windows:** `Win + Shift + S` → full screen, or Snipping Tool.
   - Import PNGs into Clipchamp as **Images**.
5. Suggested timeline:
   - **Slide 1 (title):** 5–8 seconds, optional fade-in
   - **Slide 2 (5 scenarios):** 8–12 seconds (or split into chapter cards)
   - **Slide 3 (outro):** 4–6 seconds at end of video

### Option B — Screen record

1. Open the HTML file in the browser.
2. Scroll between slides (or use three separate browser windows cropped to each slide).
3. Record with Clipchamp **Screen & camera** or OBS, then trim.

### Option C — Print to PDF (multi-page)

1. Open the HTML file → **Ctrl+P** → Save as PDF.
2. Import PDF pages into Clipchamp if your plan supports PDF assets, or export pages to PNG via a PDF tool.

## Brand reference

- Primary blue: `#2f5bea` (buttons, accents — same as electrisim.com `.default-btn`)
- Green (OpenDSS / success): `#10b981` → `#059669`
- Headings: Josefin Sans
- Body: Nunito
- Logo: loaded from `https://electrisim.com/assets/img/logo_Electrisim_removebg-preview.png` (requires internet when opening HTML)

## Voice-over hook (optional)

> "In this Electrisim tutorial we model a battery plant on a weak grid, show how export causes overvoltage at the point of connection, and compare inverter countermeasures — fixed reactive power, power factor control, and Q-V droop using OpenDSS InvControl, which is implemented in open source Electrisim software available at your web-browser."
