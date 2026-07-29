# Video script — Arc Flash (IEEE 1584) in Electrisim

**Model:** `arc_flash_industrial_demo.py`  
**Slides:** [`clipchamp/arc_flash_tutorial_intro.html`](clipchamp/arc_flash_tutorial_intro.html)  
**Target length:** ~6–8 minutes  
**Tone:** educational, calm, engineering-first (matches LinkedIn educational angle)

---

## Suggested Clipchamp timeline

| Time | Visual | Audio |
|------|--------|--------|
| 0:00–0:08 | **Slide 1 — Title** | Hook + title |
| 0:08–0:40 | **Slide 2 — Theory 1** | What arc flash is + pipeline |
| 0:40–1:15 | **Slide 3 — Theory 2** | IEEE 1584 inputs / electrodes |
| 1:15–2:00 | Electrisim — import model | Import walkthrough |
| 2:00–3:00 | Electrisim — walk the SLD | Explain topology |
| 3:00–4:30 | Electrisim — run Arc Flash | Dialog + calculate |
| 4:30–6:30 | Electrisim — discuss results | IE / PPE contrast |
| 6:30–7:00 | Optional: change clearing time | Sensitivity tip |
| 7:00–7:20 | End card / app URL | CTA |

---

## Voice-over script

### 0:00–0:08 · Title slide

> Most engineers can run a short-circuit study.  
> Far fewer turn that number into a PPE decision.  
> In this Electrisim tutorial, we calculate arc flash with IEEE 1584 — from bolted fault current to incident energy and PPE category — directly on the diagram.

### 0:08–0:40 · Theory slide 1

> An arc flash is not just a large fault. When insulation fails, the air ionizes into plasma, and thermal energy reaches the worker in milliseconds.  
>
> What matters for clothing is **incident energy** at the working distance — measured in calories per square centimetre.  
>
> IEEE 1584 turns a short-circuit study into five steps: bolted fault current, arcing current, incident energy, arc-flash boundary, and PPE category.  
>
> Clearing time is critical: longer arcs mean higher energy. The standard also requires checking a reduced arcing current — because a slower trip there is often the worst case.

### 0:40–1:15 · Theory slide 2

> IEEE 1584-2018 applies from 208 volts to 15 kilovolts. Above 15 kV, Electrisim falls back to the Ralph Lee method and clearly flags it.  
>
> In the dialog you set electrode configuration — VCB is typical for MCC and switchgear — plus working distance, gap, enclosure size, and clearing times.  
>
> On each bus you get incident energy, arc-flash boundary, PPE category, and the arcing and bolted currents.  
>
> Watch the LV feeders in our demo: longer cable means lower fault current — and usually lower PPE.

### 1:15–2:00 · Import the model *(screen: Electrisim)*

> Open Electrisim in the browser.  
> Go to **File → Import**, and select `arc_flash_industrial_demo.py`.  
> Electrisim builds the pandapower network onto the canvas — utility at 20 kV, main transformer 0.63 MVA down to 400 volts, then three LV feeders.

**On-screen cue:** zoom to fit; name labels visible.

### 2:00–3:00 · Walk the topology *(screen: diagram)*

> At the top: **Utility_20kV** and **Plant_HV_20kV** — medium voltage, outside the IEEE 1584 voltage range.  
> Through the transformer we reach **MainSWG_0.4kV** — the main LV switchboard.  
>
> Three feeders leave that bus:
> - **MCC Near** — about 20 metres of cable — highest LV fault level  
> - **MCC Mid** — about 60 metres  
> - **Panel Far** — about 150 metres — lowest fault level  
>
> That length difference is intentional: it makes the arc-flash gradient obvious.

### 3:00–4:30 · Run Arc Flash *(screen: Simulate menu + dialog)*

> Open the green **Simulate** menu and choose **Arc Flash (IEEE 1584)**.  
>
> For this plant, use:
> - Electrode configuration: **VCB**  
> - Working distance: **455 mm** — typical LV  
> - Conductor gap: **25 mm**  
> - Enclosure: **508 × 508 × 508 mm**  
> - Clearing time: **0.2 seconds** at both Iarc and Iarc-min  
>
> Click **Calculate**. Electrisim runs a three-phase maximum short-circuit, then IEEE 1584 at every bus in range.

**On-screen cue:** wait for result boxes; pan across LV buses.

### 4:30–6:30 · Discuss results *(screen: result boxes)*

> Look at the **20 kV** buses first. Method shows **Ralph Lee** — IEEE 1584 does not apply above 15 kV. Treat those as a conservative flag, not a PPE label for LV work.  
>
> Now the **400 V** buses — IEEE 1584-2018:
>
> - **Main switchboard** — highest LV incident energy; expect around PPE Category **2**  
> - **MCC Near** — still Category **2**, slightly lower energy than the main board  
> - **MCC Mid** — drops toward Category **1**  
> - **Panel Far** — often below 1.2 cal/cm² → Category **0**  
>
> Same voltage level, same clearing time — only feeder impedance changed. That is the practical lesson: cable length and fault level drive PPE as much as the transformer size.

**Talking points if numbers differ slightly after edits:**
- PPE boundaries are fixed (1.2 / 4 / 8 / 25 / 40).  
- AFB is the distance where energy falls to 1.2 cal/cm².  
- Always read method tag on HV buses.

### 6:30–7:00 · Optional sensitivity *(screen: re-run dialog)*

> Re-open Arc Flash and change clearing time from **0.2 s to 0.05 s**.  
> Incident energy drops roughly with time — PPE categories often improve.  
> Then try **0.5 s**: energy rises, categories worsen.  
>
> When the TCC is uncertain, document the clearing-time assumption. That single input often dominates the PPE decision.

### 7:00–7:20 · Close

> That is Arc Flash analysis in Electrisim: one diagram, short-circuit plus IEEE 1584, results on the canvas.  
> Try the industrial demo yourself at **app.electrisim.com** — import the Python file and run Simulate → Arc Flash.

---

## On-screen text overlays (optional Clipchamp captions)

| When | Text |
|------|------|
| Title | Arc Flash · IEEE 1584-2018 |
| Theory 1 | Ibf → Iarc → IE → AFB → PPE |
| Import | File → Import → arc_flash_industrial_demo.py |
| Dialog | VCB · 455 mm · 0.2 s |
| Results | Near cable ↑ IE · Far cable ↓ IE |
| End | app.electrisim.com |

---

## Recording checklist

- [ ] Import `arc_flash_industrial_demo.py` once before recording (or record the import live)
- [ ] Browser zoom so bus names and result boxes are readable (125–150% if needed)
- [ ] Hide unrelated chat/toolbars; show Simulate menu clearly
- [ ] After calculation, pause 1–2 s on each LV bus result box
- [ ] If subscription modal appears, be logged in with active plan before recording
- [ ] Capture title + 2 theory slides from the HTML (F11 / Win+Shift+S) before editing in Clipchamp

---

## Expected result order of magnitude  
*(VCB, 455 mm, 0.2 s — for your own QA; say “around” on camera, not exact decimals)*

| Bus | Method | Approx. PPE |
|-----|--------|-------------|
| Utility / Plant HV 20 kV | Ralph Lee | Flagged (not IEEE 1584) |
| MainSWG 0.4 kV | IEEE 1584 | Cat 2 |
| MCC Near | IEEE 1584 | Cat 2 |
| MCC Mid | IEEE 1584 | Cat 1 |
| Panel Far | IEEE 1584 | Cat 0 |
