# Video script — Grid Code Compliance (P-Q) on the 33 MW onshore wind farm

**Model:** File → New → **onshore wind farm 33MW**  
[`templates/renewables/reactive_power_onshore_WF_33MW.drawio`](../renewables/reactive_power_onshore_WF_33MW.drawio)  
**Slides (HTML):** [`clipchamp/grid_code_pq_33mw_intro.html`](clipchamp/grid_code_pq_33mw_intro.html)  
**Slides (PNG, 1920×1080):** `clipchamp/grid_code_pq_33mw_01_title.png` … `grid_code_pq_33mw_09_outro.png`  
**Target length:** ~8–10 minutes  
**Tone:** engineering walkthrough of a finished farm, then a P-Q envelope at the point of connection

This is Electrisim’s own 10-turbine onshore example. Distinct from the published **park-controller / single load-flow** video and from **Grid Code Compliance (P-Q & U-Q)**. Do not use competitor slides, logos, or UI. This is a study walkthrough, not a TSO submission.

---

## Clipchamp — import the PNG slides

Drag these 1920×1080 PNGs onto the timeline (source HTML is kept if you need to edit text later):

| Slide | File | Duration |
|-------|------|----------|
| 1 Title | [`clipchamp/grid_code_pq_33mw_01_title.png`](clipchamp/grid_code_pq_33mw_01_title.png) | 6–8 s |
| 2 Introduction | [`clipchamp/grid_code_pq_33mw_02_intro.png`](clipchamp/grid_code_pq_33mw_02_intro.png) | 10–12 s |
| 3 Agenda | [`clipchamp/grid_code_pq_33mw_03_agenda.png`](clipchamp/grid_code_pq_33mw_03_agenda.png) | 8–10 s |
| 4 Network | [`clipchamp/grid_code_pq_33mw_04_network.png`](clipchamp/grid_code_pq_33mw_04_network.png) | 8–10 s |
| 5 Why P at the PoC | [`clipchamp/grid_code_pq_33mw_05_p_at_poc.png`](clipchamp/grid_code_pq_33mw_05_p_at_poc.png) | 8–10 s |
| 6 Dialog | [`clipchamp/grid_code_pq_33mw_06_dialog.png`](clipchamp/grid_code_pq_33mw_06_dialog.png) | 5–6 s |
| 7 Read the chart | [`clipchamp/grid_code_pq_33mw_07_chart.png`](clipchamp/grid_code_pq_33mw_07_chart.png) | 8–10 s |
| 8 Local Q vs Park | [`clipchamp/grid_code_pq_33mw_08_dispatch.png`](clipchamp/grid_code_pq_33mw_08_dispatch.png) | 5–6 s |
| 9 Outro | [`clipchamp/grid_code_pq_33mw_09_outro.png`](clipchamp/grid_code_pq_33mw_09_outro.png) | 5–6 s |

---

## Suggested Clipchamp timeline

| Time | Visual | Audio |
|------|--------|--------|
| 0:00–0:12 | **Slide 1 — Title** | Hook: P-Q at the 110 kV POC |
| 0:12–0:30 | **Slide 2 — Introduction** | What is new vs P-Q & U-Q |
| 0:30–0:46 | **Slide 3 — Agenda** | Six live steps |
| 0:46–1:06 | **Slide 4 — Network** | Same 33 MW farm |
| 1:06–1:22 | **Slide 5 — Why P at the PoC** | Sweep P vs net P at POC |
| 1:22–2:10 | Electrisim — open template + walk SLD | File → New; POC, park, reactor |
| 2:10–2:16 | **Slide 6 — Dialog** | Section card |
| 2:16–4:00 | Electrisim — Grid Code (P-Q) dialog | PCC, park, ENTSO-E inner, run |
| 4:00–4:12 | **Slide 7 — Read the chart** | Red vs blue |
| 4:12–6:20 | Electrisim — results | Pmax at PCC, compliance, click a point |
| 6:20–6:28 | **Slide 8 — Local Q vs Park** | Optional second run |
| 6:28–8:20 | Electrisim — Local Q (optional) | Same template, local dispatch |
| 8:20–8:40 | **Slide 9 — Outro** | CTA |

If you skip the Local Q rerun, jump from results to the outro (~6:20–6:40).

---

## Voice-over script

### 0:00–0:12 · Title slide

> Today we run **Grid Code Compliance, P-Q** in Electrisim — a **P-Q envelope at the point of connection**, on the **33 megawatt onshore wind farm**.  
> This is not a single load-flow snapshot, and it is not the P-Q and U-Q study. We will map plant capability at the **110 kilovolt POC**, and overlay the **ENTSO-E PPM inner envelope**.

### 0:12–0:30 · Introduction slide

> Four things are new. First, this study is **P-Q only** — there is no U-Q chart.  
> Second, plant Q can be **local on each turbine**, or **constant Q at the POC** through the **Park Controller**.  
> Third, the red curve is **net P and Q at the PCC** after collector and transformer losses — not generator-terminal P.  
> Fourth, the blue grid-code overlay is in **per-unit of Pmax at the PCC**, so both envelopes sit on the same connection-point axis.

### 0:30–0:46 · Agenda slide

> Six steps. Open the 33 megawatt template. Walk the single-line. Open **Simulate, Grid Code Compliance, P-Q**. Set the park controller and the ENTSO-E inner template. Run the sweep. Then read red versus blue — and, if we have time, rerun with local Q.

### 0:46–1:06 · Network slide

> Same farm as the park-controller video. Ten turbines, **3.3 MVA** each, on two **30 kilovolt** strings. A **40 MVA 110/30 kilovolt** transformer, a **five-kilometre 110 kilovolt cable**, and the **POC** at the grid-operator bus.  
> A **shunt reactor** sits on the **110 kilovolt substation bus**, farm-side of the POC. The **Park Controller** is already on the diagram and already lists all ten machines.

### 1:06–1:22 · Why P at the PoC

> The sweep still **dispatches active power on the turbines** — that is generator P, as a percent of Pn.  
> Grid codes specify the P-Q diagram **at the connection point**. After cable and transformer losses, **net P at the POC is a little lower** than the sum of the machines.  
> If we plotted generator P, the red envelope would sit on nameplate. We plot **POC P**, and we scale the **blue requirement to that same Pmax**. Installed P stays in the summary as the sweep reference.

### 1:22–2:10 · Open the template and walk the SLD *(screen: Electrisim)*

> Open Electrisim in the browser.  
> Go to **File → New**, open the **renewables** templates, and choose **onshore wind farm 33MW**.  
>
> Zoom to fit. Ten wind turbines, two collector strings, the **110/30 kilovolt** substation, the **export cable**, and **Point of connection — 110 kV** with the **external grid** beyond it.  
> Point out the **shunt reactor** and the **Park Controller**. We will use that park for the first run.

**On-screen cue:** File → New → onshore wind farm 33MW. Hover POC, main transformer, one string, reactor, Park Controller.

### 2:10–2:16 · Section card — Dialog

> Now the study dialog.

### 2:16–4:00 · Configure and run *(screen: Grid Code Compliance — P-Q)*

> Simulate → **Grid Code Compliance (P-Q)**.  
>
> **PCC bus:** Point of connection — 110 kV.  
> **External grid:** the grid at that bus.  
> Select **all ten wind turbines**.  
>
> **Plant Q dispatch:** Park Controller — constant Q at the point of connection. The park on the diagram should fill in automatically.  
> Leave **Pn at zero** so Electrisim uses the sum of the selected unit ratings.  
> Voltage levels: start with **1.0** for a short take. If time allows, use **0.9, 1.0, 1.1**.  
>
> **Grid code requirement:** ENTSO-E RfG – PPM Inner Envelope, EU minimum.  
> Leave **transformer tap** and **shunt** control **off** for the first envelope — we want a clean first chart.  
>
> Run. You can **Stop** from the progress overlay if you need to. Wait for the results window.

**On-screen cue:** fill PCC, ext grid, 10 WTGs, Park, Pn = 0, U = 1.0 (or 0.9 / 1.0 / 1.1), ENTSO-E inner, taps/shunt off, Calculate.

### 4:00–4:12 · Section card — Read the chart

> Red is what the plant can do at the POC. Blue is what the code asks for.

### 4:12–6:20 · Results *(screen: Grid Code Compliance — P-Q results)*

> The Y-axis is **Net P at PCC**. The X-axis is **Net Q at PCC**.  
>
> **Red** is the capability envelope from the load flows — Qmax solid, Qmin dashed — including collector and transformer losses. The top of the red area will sit a little **below installed P**.  
> **Blue** is the ENTSO-E inner envelope, scaled to **Pmax at the PCC**, not to generator Pn. The top of the blue trapezoid should line up with the top of the red envelope. Q over Pmax — for example 0.33 — uses that same Pmax.  
>
> The summary shows **Installed P** and **Pmax at PCC**. Compliance is **COMPLIANT** when red fully covers blue.  
>
> Click a **red point**. Electrisim applies that load flow on the diagram — voltages, flows, and machine Q for that operating point. Come back to the chart when you are done.  
>
> Switch **MW/Mvar** versus **p.u. of Pmax**, and generator versus load sign, if you want. Those toggles do not change which sweep points were calculated.

**On-screen cue:** hover Y-axis “Net P at PCC”; point at Pmax at PCC vs Installed P; show red covering blue; click one red point; return.

### 6:20–6:28 · Section card — Local Q vs Park *(optional)*

> Same farm, different Q dispatch.

### 6:28–8:20 · Local Q rerun *(optional, screen: dialog + results)*

> Open the study again. Set **Plant Q dispatch** to **Local Q on each static generator / wind turbine**.  
> The park is taken out of service so it cannot overwrite unit Q. Each turbine is set to its **P–Q capability** Qmax or Qmin at that sweep P.  
>
> Run. Compare the red envelope with the park run. Local Q is the machine-limit picture. Park Q is the **plant setpoint at the POC**, reduced if loading or voltage limits bind.  
>
> For a connection study, park dispatch is usually the one that matches how the farm is operated.

**On-screen cue:** radio Local Q; park row greys; Calculate; compare the two red envelopes briefly.

### 8:20–8:40 · Outro

> That is **Grid Code Compliance, P-Q** in Electrisim — a P-Q diagram at the **110 kilovolt POC**, red and blue on **net P at the connection point**, with optional **Park Controller** dispatch.  
> The model is under **File → New → onshore wind farm 33MW**. The study is **Simulate → Grid Code Compliance (P-Q)**. Or build your own farm at **electrisim.com**.

---

## Recording checklist

- [ ] Import PNG slides `grid_code_pq_33mw_01_title.png` … `grid_code_pq_33mw_09_outro.png` into Clipchamp
- [ ] Open **File → New → onshore wind farm 33MW** (10 WTGs, 30 kV, 5 km 110 kV, shunt reactor, Park Controller)
- [ ] Confirm park lists all **10** machines; we do **not** add an 11th turbine in this video
- [ ] First run: **Park Q**, Pn = **0**, ENTSO-E **PPM inner**, taps/shunt **off**, U = **1.0** (or 0.9 / 1.0 / 1.1)
- [ ] Point at **Net P at PCC** and **Pmax at PCC** — do not leave viewers thinking red is generator P
- [ ] Click one red point to apply load flow; then return to the results dialog
- [ ] Optional Local Q rerun only if time remains
- [ ] Do **not** call this a TSO or NC RfG submission — it is a study walkthrough
- [ ] Do **not** confuse the menu with **Grid Code Compliance (P-Q & U-Q)**
- [ ] Mic quiet; hide bookmarks; zoom so bus names are readable
- [ ] No competitor UI, slides, or logos

## Quick reference (this study)

| Quantity | Value |
|----------|--------|
| Template | File → New → onshore wind farm 33MW |
| WTGs | 10 × 3.3 MVA, 2.5 MW @ 12 m/s |
| Padmount | 3.75 MVA 30/0.65 kV |
| Main transformer | 40 MVA 110/30 kV |
| Export cable | 5 km, 110 kV |
| Shunt | Reactor at substation 110 kV (leave shunt control off on first run) |
| PCC | Point of connection — 110 kV |
| Study | Simulate → Grid Code Compliance (P-Q) |
| Q dispatch (first run) | Park Controller — constant Q at PoC |
| Pn | 0 = auto (sum of selected ratings) |
| Voltage levels | 1.0 (short); or 0.9, 1.0, 1.1 |
| Grid code | ENTSO-E RfG – PPM Inner Envelope (EU minimum) |
| Chart P / Q | Net P and Q at the PCC |
| Blue envelope | Template × Pmax at the PCC |
| Chart p.u. | p.u. of Pmax at the PCC |
