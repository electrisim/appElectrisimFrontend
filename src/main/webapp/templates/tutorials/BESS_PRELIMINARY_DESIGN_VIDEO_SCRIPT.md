# Video script — BESS Preliminary Design (utility-scale POC)

**Model:** Blank diagram (or **Utility-scale BESS (HV POC)** template if you prefer a head start)  
**Menu:** Simulate → **BESS Studies** → **BESS Preliminary Design**  
**Slides (HTML):** [`clipchamp/bess_preliminary_design_intro.html`](clipchamp/bess_preliminary_design_intro.html)  
**Slides (PNG, 1920×1080):** `clipchamp/bess_preliminary_design_01_title.png` … `bess_preliminary_design_02_agenda.png`  
**Target length:** ~8–10 minutes  
**Tone:** solution-manager / early-design walkthrough — parameters, auto-generated SLD, optional HV cable and MV POC, pandapower study

**Clipchamp text to speech:** paste [`BESS_PRELIMINARY_DESIGN_CLIPCHAMP.txt`](BESS_PRELIMINARY_DESIGN_CLIPCHAMP.txt). That file is spoken words only. Do not paste this markdown file into text to speech. The asterisks here are notes for you, not words for the voice.

## Demo numbers (say these on camera)

| Input | Value |
|-------|--------|
| POC active power Pn | 50 MW |
| Grid-code power factor | 0.95 |
| POC / HV voltage | 132 kV |
| MV collection | 33 kV |
| PCS units | 4 |
| Umin / Unom / Umax | 0.95 / 1.00 / 1.05 pu |
| Aux load | 0.5 MW (default is fine) |

Leave ratings on **auto-size** until you deliberately show a typed override or **Reset ratings to auto-size**.

---

This is Electrisim’s **BESS Preliminary Design** wizard — not the park-controller load-flow video, not Grid Code (P-Q) on a wind farm, not Battery Sizing on a hand-drawn diagram. Do not use competitor slides, logos, or UI.

---

## Clipchamp — import the PNG slides

Drag these 1920×1080 PNGs onto the timeline (source HTML is kept if you need to edit text later):

| Slide | File | Duration |
|-------|------|----------|
| 1 Title | [`clipchamp/bess_preliminary_design_01_title.png`](clipchamp/bess_preliminary_design_01_title.png) | 6–8 s |
| 2 Agenda | [`clipchamp/bess_preliminary_design_02_agenda.png`](clipchamp/bess_preliminary_design_02_agenda.png) | 8–10 s |

---

## Suggested Clipchamp timeline

| Time | Visual | Audio |
|------|--------|--------|
| 0:00–0:12 | **Slide 1 — Title** | Hook: POC power → diagram → study |
| 0:12–0:28 | **Slide 2 — Agenda** | Six live steps |
| 0:28–2:30 | Electrisim — wizard parameters | Pn, PF, voltages, auto-sized PCS and trafos |
| 2:30–3:45 | Electrisim — Generate SLD | Walk HV-connected plant |
| 3:45–4:45 | Electrisim — HV cable option | POC_HV → cable → BESS_HV |
| 4:45–5:30 | Electrisim — MV POC option | No HV/MV transformer, POC_MV |
| 5:30–7:45 | Electrisim — Run Study + results | Named case, P/Q chart, SLD paint |
| 7:45–8:10 | *(optional)* voice only | CTA — electrisim.com |

---

## Voice-over for Clipchamp

Do not paste this section. Open [`BESS_PRELIMINARY_DESIGN_CLIPCHAMP.txt`](BESS_PRELIMINARY_DESIGN_CLIPCHAMP.txt) and paste that file into Clipchamp text to speech.

The markdown file keeps timing and on-screen cues. The text file is the same narration without asterisks, arrows, or quote marks, so the voice does not read formatting aloud.

### 0:00–0:12 · Title slide

On screen: title PNG.

### 0:12–0:28 · Agenda slide

On screen: agenda PNG.

### 0:28–2:30 · Wizard parameters

On screen: Simulate, BESS Studies, BESS Preliminary Design. Fill 50 MW, 0.95, 132 kV, 33 kV, 4 units. Point at the auto-filled PCS ratings without typing.

### 2:30–3:45 · Generate the diagram

On screen: Generate or Update SLD. Slow pan from the grid, through POC HV and the transformer, to one string.

### 3:45–4:45 · HV cable

On screen: tick the HV cable, regenerate, show POC HV, the cable, and BESS HV.

### 4:45–5:30 · Direct MV connection

On screen: untick Include HV to MV transformer, set about 20 kV, show POC MV, then turn the HV transformer back on before the study.

### 5:30–7:45 · Run the study

On screen: Run Study, click a named case so the diagram fills, then the P Q chart.

### 7:45–8:10 · Close

On screen: freeze on the diagram or the results window.

---

## Recording checklist

- [ ] Import PNG slides `bess_preliminary_design_01_title.png` and `bess_preliminary_design_02_agenda.png` into Clipchamp
- [ ] Subscription / backend running if your environment requires it for **Run Study**
- [ ] Blank diagram or BESS template; wizard draft not stale from an old topology test
- [ ] Demo: 50 MW, PF 0.95, 132 kV, 33 kV, 4 PCS — auto-sized ratings
- [ ] Generate SLD; pan full HV → MV → one string
- [ ] HV cable on → regenerate → show POC_HV, HV_Cable, BESS_HV (then off for main run if preferred)
- [ ] HV transformer off → POC_MV → restore HV layout before study
- [ ] Run Study; click named case; show P/Q chart and POC vs PCS narration
- [ ] Mic quiet; hide bookmarks; zoom so bus names and result boxes are readable
- [ ] No competitor UI, slides, or logos

## Quick reference

| Item | Value |
|------|--------|
| Menu | Simulate → BESS Studies → BESS Preliminary Design |
| Engine | pandapower (Newton–Raphson) |
| POC sign | Export-positive: P > 0 into grid, Q > 0 capacitive |
| Storage sign | p_mw > 0 charge, p_mw < 0 discharge |
| HV cable | Optional; P/Q envelope stays at POC_HV |
| MV POC | Untick Include HV/MV transformer; bus POC_MV |
| Written steps | [`bess_preliminary_design.md`](bess_preliminary_design.md) |
| Product docs | electrisim.com → BESS Preliminary Design |
