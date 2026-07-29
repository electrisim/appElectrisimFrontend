# Clipchamp assets — ANDES Transient Stability & Eigenvalue tutorial

Branded intro/theory slides matching [electrisim.com](https://electrisim.com/) colours (`#2f5bea` primary, `#10b981` accent, Josefin Sans + Nunito fonts) — same system as Arc Flash and PowerFactory comparison tutorials.

## Files

| File | Use in Clipchamp |
|------|------------------|
| [`andes_stability_tutorial_intro.html`](andes_stability_tutorial_intro.html) | Source **1920×1080** HTML (4 slides) — screenshot to PNG |
| [`../ANDES_STABILITY_VIDEO_SCRIPT.md`](../ANDES_STABILITY_VIDEO_SCRIPT.md) | Full timed voice-over + recording checklist |
| [`../transient_stability_two_machine_demo.py`](../transient_stability_two_machine_demo.py) | Pandapower model to import in Electrisim |

Suggested PNG names after capture:

| Slide | Suggested PNG |
|-------|----------------|
| 1 Title | `andes_stability_title.png` |
| 2 TDS theory | `andes_stability_theory_tds.png` |
| 3 EIG theory | `andes_stability_theory_eig.png` |
| 4 Agenda | `andes_stability_agenda.png` |

## Suggested Clipchamp timeline (~8–10 min)

| Time | Asset / action |
|------|----------------|
| 0:00–0:10 | HTML slide 1 — Title |
| 0:10–0:50 | HTML slide 2 — Transient stability pipeline |
| 0:50–1:25 | HTML slide 3 — Eigenvalues / s-plane |
| 1:25–1:50 | HTML slide 4 — Live demo agenda |
| 1:50–8:50 | Screen recording of Electrisim (import → TDS → EIG) |
| 8:50–9:10 | Optional end: title slide again or app.electrisim.com |

## How to capture slides

1. Open `andes_stability_tutorial_intro.html` in Chrome or Edge (ideally on a **1920×1080** display).
2. Press **F11** for fullscreen. Each `<section class="slide">` is exactly 1920×1080 — scroll so one slide fills the viewport.
3. Capture with **Win + Shift + S** or Snipping Tool → save as PNG.
4. Import PNGs into Clipchamp as **Images** (8–10 s title, ~30–40 s each theory/agenda slide).

Logo loads from `https://electrisim.com/assets/img/logo_Electrisim_removebg-preview.png` (internet required when opening HTML).

## Brand reference

- Primary blue: `#2f5bea`
- Green (ANDES / success): `#10b981` → `#059669`
- Headings: Josefin Sans · Body: Nunito
- Badge: **Tutorial · Electrisim · ANDES**
- Footer: **Electrisim • electrisim.com**

## Demo dialog defaults (for live segment)

**Transient Stability (ANDES)**

- Frequency: **60 Hz**
- System base: **100 MVA**
- tf: **10 s**
- Fault bus: **BusB_230**
- Fault apply / clear: **1.0 / 1.10 s**
- Line outage: none (first run)

**Eigenvalue Analysis (ANDES)**

- Frequency: **60 Hz**
- System base: **100 MVA**
- Least-damped modes: **10**
