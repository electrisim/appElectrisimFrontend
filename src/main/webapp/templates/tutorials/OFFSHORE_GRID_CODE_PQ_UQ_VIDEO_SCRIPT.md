# Video script — Grid Code Compliance (P-Q and U-Q) on the 450 MW offshore wind farm

**Model:** File → New → **offshore wind farm** (rev 7) — [`templates/renewables/offshore wind 1GW 100km rev7.drawio`](../renewables/offshore%20wind%201GW%20100km%20rev7.drawio)
**Voice-over (Clipchamp text to speech):** [`OFFSHORE_GRID_CODE_PQ_UQ_CLIPCHAMP.txt`](OFFSHORE_GRID_CODE_PQ_UQ_CLIPCHAMP.txt) — paste the whole file
**Slides (PNG, 1920×1080):** `clipchamp/offshore_gridcode_pq_uq_01_title.png`, `clipchamp/offshore_gridcode_pq_uq_02_agenda.png`
**Slides (HTML source):** [`clipchamp/offshore_gridcode_pq_uq_intro.html`](clipchamp/offshore_gridcode_pq_uq_intro.html)
**Target length:** about 8–9 minutes of voice (≈1,100 words)
**Background reading:** LinkedIn newsletter “STATCOMs, wind turbines, shunt reactors, transformers…” (450 MW compliance edition)

## Clipchamp — import the slides

| Slide | File | On screen |
|-------|------|-----------|
| 1 Title | [`clipchamp/offshore_gridcode_pq_uq_01_title.png`](clipchamp/offshore_gridcode_pq_uq_01_title.png) | During paragraph 1 (intro), 8–12 s |
| 2 Agenda | [`clipchamp/offshore_gridcode_pq_uq_02_agenda.png`](clipchamp/offshore_gridcode_pq_uq_02_agenda.png) | During paragraph 2 (“Six steps…”), 10–14 s |

To change slide text, edit the HTML and re-render each `<section class="slide">` at 1920×1080 (headless Chrome screenshot, or the `_export_offshore_gridcode_slides.mjs` script once puppeteer is reinstalled in `%TEMP%\slide-export`).

## Shot list (one row per voice-over paragraph)

| # | Voice-over starts with | Show in Electrisim |
|---|------------------------|--------------------|
| 1 | “Today we check grid code compliance…” | Title slide |
| 2 | “Six steps.” | Agenda slide |
| 3 | “Step one. Open Electrisim…” | File → New → Renewables → *offshore wind farm* → Create |
| 4 | “Step two, the plant.” | Pan the SLD: turbine strings (66 kV) → offshore substations (66/275 kV) → 275 kV export cables → onshore 275/400 kV transformer, variable shunt reactor, STATCOM on 275 kV → 400 kV POC |
| 5 | “Step three, the controllers.” | Open in turn: transformer tap control, the shunt reactor (Line P → shunt step), Park Controller (Const. Q −150 Mvar at *Bus 275kV offshore*), Plant Supervisory Controller (Devices tab: STATCOM + reactors; Control tab: Q(P) at the 400 kV bus, from the template) |
| 6 | “Step four, the P Q study.” | Simulate → Grid Code Compliance (P-Q); fill the dialog as narrated; Calculate; show the progress window |
| 7 | “Step five, read the results.” | Results window (maximized), hover red vs blue, point at Pmax at PCC and the COMPLIANT badge |
| 8 | “Click any red point…” | Click a Q max point → diagram result boxes → *Back to PQ diagram* |
| 9 | “Now turn on Element Q.” | Element Q **On**, then Edge **Capacitive** / **Inductive**; point at the reactor at 0 Mvar on the capacitive edge |
| 10 | “Next, click Check overloads.” | Footer → Check overloads; expand the table; *Show on diagram* on the worst row |
| 11 | “Step six, the U Q study.” | Simulate → Grid Code Compliance (U-Q); same settings; Park Controller as configured + PSC; U-Q template; Calculate |
| 12 | “The red curves show…” | U-Q chart and table; Element Q On; Check overloads |
| 13 | “Finally, the report.” | Copy image (paste into a doc), Save image, Download CSV |
| 14 | “That is grid code compliance…” | Back to the title slide, or electrisim.com model page |

## Numbers in the voice-over — check against your recording

These come from runs of the rev 7 model with the settings above. If your run differs, edit the sentence in the `.txt` before generating the voice.

- **P-Q** (Park Controller as configured, PSC, 0.90 / 0.95 / 1.00 / 1.05 pu, ENTSO-E PPM inner): compliant at every level; Pmax at PCC ≈ 431 MW.
- **Overload check** (loading limit off): worst element is the 500/500/15 MVA 400/275/15 kV transformer, ≈ 128 % at 0.9 pu on the inductive edge at full P.
- **U-Q** (P = 100 %, 0.90–1.10 pu, ENTSO-E RfG – PPM U-Q/Pmax):

| U (pu) | Q max (Mvar) | Q min (Mvar) |
|---|---|---|
| 0.90 | 338.8 | −351.7 |
| 0.95 | 349.2 | −306.7 |
| 1.00 | 370.0 | −290.1 |
| 1.05 | 372.4 | −278.8 |
| 1.10 | 386.7 | −272.0 |

  Requirement ±147.9 Mvar → compliant at every voltage.

## Pronunciation notes for text to speech

Written out so the voice reads them correctly: “megawatt”, “megavar”, “kilovolt”, “per unit”, “P Q”, “U Q”, “U Q over P max”, “electrisim dot com”. Keep “STATCOM” as one word.
