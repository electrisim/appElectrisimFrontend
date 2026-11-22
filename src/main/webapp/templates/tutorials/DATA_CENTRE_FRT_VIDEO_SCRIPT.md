# Video script — Data centre fault ride-through (STATCOM and UPS)

**Model:** File → New → Tutorials → **Data centre fault ride-through (STATCOM and UPS)** — [`data_centre_fault_ride_through.drawio`](data_centre_fault_ride_through.drawio)
**Voice-over (Clipchamp text to speech):** [`DATA_CENTRE_FRT_CLIPCHAMP.txt`](DATA_CENTRE_FRT_CLIPCHAMP.txt) — paste the whole file
**Slides (PNG, 1920×1080):** `clipchamp/data_centre_frt_01_title.png`, `clipchamp/data_centre_frt_02_agenda.png`
**Slides (HTML source):** [`clipchamp/data_centre_frt_intro.html`](clipchamp/data_centre_frt_intro.html) (re-render with `clipchamp/_export_data_centre_frt_slides.mjs`)
**Target length:** about 6.5 minutes (≈ 950 words of voice)
**Documentation:** [electrisim.com/docs-stability#data-centre-ride-through](https://electrisim.com/docs-stability#data-centre-ride-through) · [docs-grid-forming-statcom](https://electrisim.com/docs-grid-forming-statcom)

## Clipchamp — import the slides

| Slide | File | On screen |
|-------|------|-----------|
| 1 Title | [`clipchamp/data_centre_frt_01_title.png`](clipchamp/data_centre_frt_01_title.png) | During paragraph 1 (intro), and again at the end |
| 2 Agenda | [`clipchamp/data_centre_frt_02_agenda.png`](clipchamp/data_centre_frt_02_agenda.png) | During paragraph 2 (“Six steps…”) |

The chart on the title slide is the power the data centre draws in the bolted POI fault, default UPS (red) and tuned UPS (green), from the Transient Stability runs below.

## Shot list (one row per voice-over paragraph)

| # | Voice-over starts with | Show in Electrisim |
|---|------------------------|--------------------|
| 1 | “Today we check whether a data centre rides through…” | Title slide |
| 2 | “Six steps.” | Agenda slide |
| 3 | “Step one. Open Electrisim…” | Create New Diagram (or File → New) → search *data centre* → card *Data centre fault ride-through (STATCOM and UPS)* → Create; point at Utility_Grid, the two 138 kV lines, POI_138, POI_Transformer, Campus_34.5, DataCenter_Load, Campus_STATCOM |
| 4 | “Step two, the data centre.” | Double-click DataCenter_Load → **Data center** tab; point at: Enable computational load model, IT share 85 %, UPS transfer 0.85, return 0.9, return delay 1 s, walk-in 5 s, Power back within 1 s, the ride-through curve; Cancel |
| 5 | “Step three, the STATCOM.” | Double-click Campus_STATCOM → **Dynamics (ANDES)** tab (voltage control, k-factor 2, deadband 10 %, current limit 1.0); Cancel; Simulate → Load Flow → Calculate; point at the STATCOM result (≈ 63 Mvar supplied) and Campus_34.5 (1.000 pu) |
| 6 | “Step four, size the STATCOM.” | Simulate → Grid-Forming STATCOM Sizing; STATCOM = Campus_STATCOM; Facility = *Load: DataCenter_Load*; Requirement set = *Data centre / demand facility*; scroll to Duty 5 (k = 2, retained voltage 0, up to 1 p.u., base facility); Calculate; point at *Reactive current in the dip 306 MVA*, *Converter rating needed 306 MVA*, *Deepest dip the installed converter covers 0.86 p.u.*; Close |
| 7 | “Step five, the time domain.” | Simulate → Transient Stability (ANDES): Frequency 60, tf 10, Fault Bus *Utility_138*, 1 → 1.15 s, Fault reactance 0.1, POI bus *POI_138*; Run; point at *Data-centre ride-through: PASS* and the green box (*rides through*) |
| 8 | “Now take the STATCOM out of service…” | Double-click Campus_STATCOM → untick In Service → Apply; same Transient Stability run; point at the red box (*drops 257 MW*), *Power back to 90 % after the voltage 5.5 s (1.00 s)*, the FAIL chip, the data-centre power chart |
| 9 | “Step six, a close-in fault.” | STATCOM In Service again; Transient Stability with Fault Bus *POI_138*, Fault reactance 0.0001; point at the FAIL result and the STATCOM reactive current chart (1.0 pu in the fault) |
| 10 | “The fix is in the U P S.” | Double-click DataCenter_Load → Data center tab: UPS return delay 0.2, walk-in 0.5 → Apply; same run; point at PASS, *0.70 s (1.00 s)*, the power chart, Export CSV |
| 11 | “That is fault ride-through…” | Title slide |

## Numbers in the voice-over — check against your recording

From runs of the template with the settings above (backend `andes_electrisim.py`, ANDES 2.0).

- **Load flow:** STATCOM supplies 62.8 Mvar; Campus_34.5 at 1.000 pu; POI_Transformer 75 % loaded.
- **Grid-Forming STATCOM Sizing** (data centre set, dip to 0 p.u.): ΔIq = 1.0 p.u. (limited) of 306 MVA; reactive current through the dip 306 MVA = 5.12 kA; converter needs 306 MVA; the installed 150 MVA covers dips down to 0.857 p.u.; no supercapacitors.
- **Transient Stability**, fault 1.0–1.15 s, 60 Hz, tf = 10 s, POI bus POI_138:

| Case | Campus voltage | UPS | Power back after the voltage | Verdict |
|------|----------------|-----|------------------------------|---------|
| Utility_138, xf 0.1, STATCOM in service | 1.00 → 0.876 pu | stays on the grid | 0 s | PASS |
| Utility_138, xf 0.1, STATCOM out of service | 0.966 → 0.840 pu | 257 MW to battery | 5.5 s | FAIL (power back too late) |
| POI_138, bolted, default UPS (1 s, 5 s) | 0 pu for 150 ms | 300 MW to battery | 5.5 s | FAIL (power back too late) |
| POI_138, bolted, UPS 0.2 s / 0.5 s | 0 pu for 150 ms | 300 MW to battery | 0.7 s | PASS |

## Pronunciation notes for text to speech

Written out so the voice reads them correctly: “U P S”, “I T”, “M V A”, “P O I”, “C S V”, “megavar”, “kilovolt”, “per unit”, “k factor”, “kilo amps”. Keep “STATCOM” as one word.

## Produced video

A finished cut was rendered with an open-source neural voice (Kokoro, male voice *am_michael*) from this text, with the screen recorded in the running app; subtitles (SRT) and YouTube chapters come with it. To use the usual Clipchamp voice instead, paste the `.txt` into Clipchamp text to speech and lay the paragraphs over the same shots.

## YouTube

**Title:** Data centre fault ride-through: STATCOM sizing and UPS behaviour in Electrisim (open source)

**Description:**

Will a 300 MW data centre ride through a grid fault? We size a STATCOM for the k-factor reactive current a voltage dip asks for, then simulate the UPS of the data centre in Transient Stability (ANDES): a remote fault with and without the STATCOM, and a close-in fault where the UPS return delay and walk-in decide the verdict.

Template: Electrisim → File → New → Tutorials → Data centre fault ride-through (STATCOM and UPS)
Documentation: https://electrisim.com/docs-stability#data-centre-ride-through

**Chapters** (from the produced cut; adjust if you re-time the voice):

```
0:00 Introduction
0:35 Agenda
0:55 Open the data centre template
1:29 The data centre and its UPS
2:18 The STATCOM and a load flow
2:48 Size the STATCOM for fault ride-through
3:34 Remote fault with the STATCOM
4:13 Remote fault without the STATCOM
4:50 Close-in fault, default UPS
5:24 Close-in fault, tuned UPS
6:01 Summary
```

**Subtitles:** [`DATA_CENTRE_FRT_SUBTITLES.srt`](DATA_CENTRE_FRT_SUBTITLES.srt) (timed to the produced cut)

