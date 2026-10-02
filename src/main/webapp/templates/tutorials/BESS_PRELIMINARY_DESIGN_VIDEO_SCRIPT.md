# Video script — BESS Preliminary Design (utility-scale POC)

**Model:** Blank diagram (or **Utility-scale BESS (HV POC)** template if you prefer a head start)  
**Menu:** Simulate → **BESS Studies** → **BESS Preliminary Design**  
**Slides (HTML):** [`clipchamp/bess_preliminary_design_intro.html`](clipchamp/bess_preliminary_design_intro.html)  
**Slides (PNG, 1920×1080):** `clipchamp/bess_preliminary_design_01_title.png` … `bess_preliminary_design_02_agenda.png`  
**Target length:** ~8–10 minutes  
**Tone:** solution-manager / early-design walkthrough — parameters, auto-generated SLD, optional HV cable and MV POC, pandapower study

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

## Voice-over script

### 0:00–0:12 · Title slide

> Today we use **BESS Preliminary Design** in open-source **Electrisim**.  
> You enter the agreed **active power at the point of connection** and the **grid-code power factor** — and Electrisim **builds the plant single-line diagram** for you, then runs **named load-flow cases**, **rating checks**, and a **P/Q capability envelope** at the POC.  
> We will also show two real site layouts: an **HV cable** between the DSO POC and the customer substation, and a **direct MV connection** when there is **no HV/MV transformer**.

### 0:12–0:28 · Agenda slide

> Six steps. Set **POC power and ratings**. **Generate the diagram**. Add an **HV cable** when the POC is not at the BESS site. Switch to **MV POC** without the HV transformer. **Run the study**. Then read one result that often surprises people — **POC megawatts are not the sum of the PCS**.

### 0:28–2:30 · Open the wizard and set parameters *(screen: Electrisim)*

> Open Electrisim in the browser. Start from a **blank diagram** — or open the **Utility-scale BESS** template if you already use it.  
> Go to **Simulate → BESS Studies → BESS Preliminary Design**.  
>
> Under **POC / Grid**, enter **50 megawatts** as **active power at POC / Pn** and **0.95** as the **grid-code power factor**. Reactive power at the POC is computed: **Q equals Pn times tan of arccos PF** — unless you tick **Specify Q directly** because the operator gave you Q in megavar.  
> Set **POC voltage** to **132 kilovolts** and **MV collection** to **33 kilovolts**. **Umin, Unom, and Umax** are the **grid operating voltages** for the study cases — for example **0.95, 1.00, and 1.05 per unit**. **Plant voltage min and max** — often **0.90 to 1.10** — control **pass/fail colours** on the diagram.  
>
> Under **PCS / BESS**, set **four** storage units. **PCS MVA, Pmax, the POC transformer, string transformers, and cable thermal rating** are **auto-sized** from Pn, power factor, unit count, Umin, aux load, and whether you use a **two-winding** or **three-winding skid** — until you type a value yourself. If you change Pn later, use **Reset ratings to auto-size** to hand control back to the auto-sizer.  
> **Battery DC Pmax** tightens the AC storage P limit on the diagram — it does **not** supply reactive power; **Q comes from the PCS MVA circle**.  
>
> Scroll to **HV/MV transformer**. Leave **Include HV/MV transformer** **ticked** for the first diagram. OLTC tap range and band are here; **Tap position sweep** is optional and off by default.  
> **HV cable to BESS site** stays **off** for now. **MV cables** and **auxiliary load** can stay at defaults for this demo.

**On-screen cue:** Simulate → BESS Studies → BESS Preliminary Design. Fill 50 MW, 0.95, 132 kV, 33 kV, 4 units. Point at auto-filled PCS MVA / Pmax without typing. Mention amber undersize note only if you deliberately under-size a field.

### 2:30–3:45 · Generate / Update SLD *(screen: diagram)*

> Click **Generate / Update SLD**. The wizard hides so you can inspect the canvas — use the restore chip to return to inputs.  
>
> Top to bottom: **External Grid** → **POC_HV** → **POC_Transformer** with **OLTC** → **MV collection bus** → auxiliary load → for each string an **MV cable**, **MV/LV transformer**, **LV bus**, **PCS inverter**, **DC bus**, and **battery rack**. The PCS is the **Storage** element for AC load-flow; the DC island is drawn but not coupled in pandapower.  
> Click **Generate** again after a small change — existing plant cells **update in place** using **bessPlantRole** tags; you are not redrawing from scratch.  
> **Zoom to fit** before you run the study.

**On-screen cue:** Generate / Update SLD. Slow pan: Grid, POC_HV, HV/MV trafo, MV_Collection, one string to PCS + battery.

### 3:45–4:45 · HV cable between DSO POC and plant *(screen: wizard + diagram)*

> Many projects have the **contractual POC at the DSO substation** and the **HV/MV transformer at the customer site**. Re-open the wizard.  
> Under **HV cable to BESS site**, tick **HV cable between grid POC and plant substation**. Set **length**, **R and X per kilometre**, and **thermal kA** — or accept the auto-sized kA from plant MVA and HV voltage. Generate again.  
>
> The chain becomes **POC_HV → HV_Cable → BESS_HV → POC_Transformer → MV collection**.  
> **Named cases and the P/Q envelope still refer to POC_HV** — the contractual POC. The cable is a real **line** in the pandapower model: you will see **loading** on **HV_Cable** and a **voltage difference** between **POC_HV** and **BESS_HV** under export.  
> For the main study demo, turn the HV cable **off** again and regenerate so the diagram stays compact — or keep it on if you want to show both buses in the voltage profile.

**On-screen cue:** Enable hv cable; regenerate; highlight vertical line and BESS_HV bar; optional: results voltage profile row for BESS_HV after a run.

### 4:45–5:30 · Direct MV POC — no HV/MV transformer *(screen: wizard + diagram)*

> Some BESS sites connect at **11 to 33 kilovolts** with **no step-up transformer** at the POC. Untick **Include HV/MV transformer**. Set **MV collection voltage** to your POC voltage — for example **20 kV**. Generate.  
>
> The topology is **External Grid → POC_MV** — the collection bus **is** the POC. There is **no HV transformer**, **no OLTC**, **no tap sweep**, and **no HV cable** option. The study still uses **POC_MV** for achieved P/Q and the envelope.  
> For the rest of the video, **tick the HV transformer back on** and regenerate the **132 kV / 33 kV** plant so results match what most utility-scale viewers expect.

**On-screen cue:** hvTrafoEnabled off; mvVoltage 20; POC_MV label; ext grid edge to MV bar only; then restore HV layout for study segment.

### 5:30–7:45 · Run Study and read results *(screen: progress + results dialog + SLD)*

> Click **Run Study**. The progress log walks through **named load-flow cases**, **rating verification**, and the **P/Q envelope**.  
>
> In the results window, open **named cases**. **Pass/fail** is thermal and voltage against your plant band — separate from whether the **POC target** is met. Click **Unom_Export_Capacitive** — or another row — and watch **result boxes** fill on the SLD. Click a **limiting element** or **bus name** to select it on the canvas.  
>
> Open the **P/Q chart**. The grey rectangle is your **grid-code PF band** at the PCS **±Pn** you sized for — the envelope can extend further where the plant P limit allows. On the **U–Q chart**, charge and discharge at full active power show whether the plant covers the **U–Q band** from your power factor.  
> Here is the insight: **POC P is export-positive into the grid** and includes **auxiliaries and losses**. It is **not** the sum of PCS discharge ratings. **Reactive power at the POC** is set by **inverter MVA**, transformer **vk**, cables, and aux — **raising battery DC power does not add Mvar** if the PCS is already on its **MVA circle**.  
> Optionally **zoom and pan** the charts, pick a **point on the envelope**, and compare **dispatch P at PCS** versus **P at POC** in the hover text.

**On-screen cue:** Run Study; KPI row; named case click → green POC box with P/Q; P/Q chart + one sentence on POC vs sum(PCS); optional U–Q band.

### 7:45–8:10 · Outro *(voice; freeze on diagram or results)*

> That is **BESS Preliminary Design** in Electrisim — from **POC power and power factor** to an **auto-generated SLD**, optional **HV cable** and **MV POC** layouts, and a **pandapower** early-design study with **ratings** and **P/Q capability** at the grid connection.  
> Documentation lives at **electrisim.com**. Build and iterate your own plant at **electrisim.com**.

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
