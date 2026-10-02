# Video script — Short-circuit calculations on the 33 MW onshore wind farm

**Model:** File → New → **onshore wind farm 33MW**  
[`templates/renewables/reactive_power_onshore_WF_33MW.drawio`](../renewables/reactive_power_onshore_WF_33MW.drawio)  
**Slides (HTML):** [`clipchamp/short_circuit_33mw_intro.html`](clipchamp/short_circuit_33mw_intro.html)  
**Slides (PNG, 1920×1080):** `clipchamp/short_circuit_33mw_01_title.png` … `short_circuit_33mw_03_cables.png`  
**Target length:** ~8–10 minutes  
**Tone:** engineering walkthrough — IEC 60909 and OpenDSS fault studies on the same diagram

## Copy for Clipchamp and LinkedIn

| Use | Open in browser (double-click) | Plain backup |
|-----|--------------------------------|--------------|
| **Clipchamp voice-over** | [`clipchamp/short_circuit_33mw_clipchamp_copy.html`](clipchamp/short_circuit_33mw_clipchamp_copy.html) — **Copy plain script** or **Copy with timestamps** | [`SHORT_CIRCUIT_33MW_CLIPCHAMP.txt`](SHORT_CIRCUIT_33MW_CLIPCHAMP.txt) |
| **LinkedIn newsletter** | [`clipchamp/short_circuit_33mw_linkedin_newsletter.html`](clipchamp/short_circuit_33mw_linkedin_newsletter.html) — **Copy article** + title box; **Copy announcement** when publishing | [`SHORT_CIRCUIT_33MW_LINKEDIN_NEWSLETTER.md`](SHORT_CIRCUIT_33MW_LINKEDIN_NEWSLETTER.md) |

Do not paste the `.md` files into LinkedIn — use the HTML copy buttons so headings and links paste cleanly.

---

This is Electrisim’s own 10-turbine onshore example. Distinct from the **park-controller load-flow**, **Grid Code (P-Q)**, and **Arc Flash** videos. Do not use competitor slides, logos, or UI. This is a study walkthrough, not a utility submission.

---

## Clipchamp — import the PNG slides

Drag these 1920×1080 PNGs onto the timeline (source HTML is kept if you need to edit text later):

| Slide | File | Duration |
|-------|------|----------|
| 1 Title | [`clipchamp/short_circuit_33mw_01_title.png`](clipchamp/short_circuit_33mw_01_title.png) | 6–8 s |
| 2 Agenda | [`clipchamp/short_circuit_33mw_02_agenda.png`](clipchamp/short_circuit_33mw_02_agenda.png) | 8–10 s |
| 3 Cables | [`clipchamp/short_circuit_33mw_03_cables.png`](clipchamp/short_circuit_33mw_03_cables.png) | 8–10 s |

---

## Suggested Clipchamp timeline

| Time | Visual | Audio |
|------|--------|--------|
| 0:00–0:12 | **Slide 1 — Title** | Hook: fault currents, two engines |
| 0:12–0:28 | **Slide 2 — Agenda** | Six live steps |
| 0:28–1:45 | Electrisim — open template + walk SLD | File → New; POC, transformer, strings |
| 1:45–3:30 | Electrisim — IEC 60909, three-phase | Dialog, run, read ikss / ip / ith |
| 3:30–3:42 | **Slide 3 — Cables** | Conductors vs metallic screens |
| 3:42–5:00 | Electrisim — IEC single-phase | Earth-fault currents |
| 5:00–6:45 | Electrisim — vector group | Main 110/30 kV transformer |
| 6:45–8:30 | Electrisim — OpenDSS tab | Compare bus Ikss with IEC |
| 8:30–8:50 | *(optional)* voice only | CTA — electrisim.com |

---

## Voice-over script

### 0:00–0:12 · Title slide

> Today we run **short-circuit calculations** in Electrisim on the **33 megawatt onshore wind farm**.  
> We will use **IEC 60909** through **pandapower**, and a second run with **OpenDSS FaultStudy** on the **same single-line diagram**.  
> Along the way we will see why **three-phase** currents size phase conductors, while **earth-fault** currents matter for **cable screens** — and how the **transformer vector group** steers zero-sequence current.

### 0:12–0:28 · Agenda slide

> Six steps. Open the template. Walk the network. Run **IEC 60909**, three-phase maximum, on all busbars. Read **ikss**, **ip**, and **ith**. Then single-phase for earth currents. Change the **vector group** on the main transformer and repeat. Finally, switch to the **OpenDSS** engine and compare.

### 0:28–1:45 · Open the template and walk the SLD *(screen: Electrisim)*

> Open Electrisim in the browser.  
> Go to **File → New**, open the **renewables** templates, and choose **onshore wind farm 33MW**.  
>
> Zoom to fit. Ten wind turbines on two **30 kilovolt** strings, each with a **3.75 MVA** padmount. A **40 MVA 110/30 kilovolt** substation transformer, a **five-kilometre 110 kilovolt** export cable, and **Point of connection — 110 kV** with the **external grid** beyond it. A **shunt reactor** sits on the farm-side **110 kilovolt** bus.  
>
> For short circuit, the **external grid** supplies the fault infeed from the TSO side. The **wind turbines** are modelled as **current sources** in IEC 60909 — type-four style machines, not synchronous generators.  
> Before faults, confirm the diagram already **load-flows** with pandapower if you can — same connectivity you will use for the study.

**On-screen cue:** File → New → onshore wind farm 33MW. Hover POC, 40 MVA transformer, one 30 kV string, one WTG, external grid, reactor.

### 1:45–3:30 · IEC 60909 — three-phase *(screen: Short Circuit dialog, Pandapower tab)*

> **Simulate → Short Circuit**. Stay on the **Pandapower** tab and tick **IEC 60909**.  
>
> **Fault:** Three Phase. **Case:** Maximum. **Fault location:** All busbars.  
> Leave **failure clearing time** at **one second** — that drives **ith**, the thermal equivalent current.  
> **Voltage tolerance** six percent is fine for this MV farm. Run **Calculate**.  
>
> Electrisim places a **fault marker** on each bus and writes result boxes. Read the labels: **ikss** is the initial symmetrical short-circuit current in kiloamperes. **ip** is the peak current. **ith** is the thermal current for the clearing time you set — that is what you use for an **adiabatic check** on the **phase conductor**, not the peak.  
>
> Compare three locations: the **110 kilovolt substation bus**, a **30 kilovolt collector bus**, and a **0.69 kilovolt** turbine bus. Levels and kA values come from your run — do not mix them with OpenDSS numbers yet.  
> Pandapower also fills **lines**, **transformers**, and the **external grid** with branch currents. That helps breaker and cable routing studies on the IEC path.

**On-screen cue:** Pandapower + IEC 60909; 3ph / max / all busbars; tk_s = 1; zoom result boxes at 110 kV, 30 kV, 0.69 kV; mention lines/trafo boxes briefly.

### 3:30–3:42 · Section card — Cables

> Which current for which part of the cable.

### 3:42–5:00 · Conductors vs screens + single-phase run *(screen: Short Circuit + slide context)*

> In practice, **three-phase fault** **ith** drives **cross-section of the phase conductors** — I squared t against the conductor’s thermal limit, IEC 60949 style. We are not picking a catalogue size here; we are showing **which result** Electrisim gives you.  
>
> **Metallic screens** and **sheaths** must carry the **earth-return** current. That is a **single-phase-to-earth** problem, and in IEC also **two-phase-to-earth**. In the dialog, **Single Phase** is the earth-fault run. **Two Phase** is **phase-to-phase without earth** — do not use that button when you mean earth return.  
>
> Open Short Circuit again. Still **IEC 60909**, **Maximum**, all busbars — but **Fault: Single Phase**. Calculate.  
> Compare **ikss** on the same buses as before. On a solidly earthed grid, if single-phase exceeds three-phase, the **phase conductor** must be checked against that earth fault as well. On this farm, the big lesson is often **by voltage level**: a **delta** winding blocks zero sequence, so **30 kilovolt** and **0.69 kilovolt** screens see a different story than **110 kilovolt** if the star point is earthed there.  
> For **two-phase-to-earth**, utilities often use **Ik2E** from the same IEC study family; Electrisim’s **Single Phase** button is the earth case we demonstrate live.

**On-screen cue:** 1ph / max / all busbars; compare ikss vs 3ph run on 110 kV and 30 kV; if 1ph looks empty, mention External Grid **Short Circuit** tab — min/max **R0/X0** and **X0/X** ratios.

### 5:00–6:45 · Vector group on the main transformer *(screen: Transformer dialog)*

> Double-click the **40 MVA 110/30 kilovolt** transformer. On **Load Flow**, find **Vector Group** — options like **Dyn**, **Yd**, **Yy**, **YNd**. The clock number is **Angle Shift** in degrees — for example **330 degrees** for Dyn11.  
>
> Note the group **already in the template**, then change the **letters**, not only the angle: try **YNd** versus **Dyn** — grounded star versus delta on one side changes **zero-sequence** paths. Apply.  
>
> Re-run **IEC 60909**, **Three Phase**, **Maximum**. **ikss** on the three-phase run should barely move — that fault is dominated by positive-sequence **vk** and the grid.  
> Now re-run **Single Phase**. **ikss** **does** move — because **N** in the group and **delta** windings decide whether zero sequence can circulate.  
> If you change **only Angle Shift**, you mainly rotate **current angle** in the network; RMS three-phase **ikss** stays essentially the same. Vector group is about **connections and earthing**, not a trick to lower three-phase duty.  
> Set the transformer back to the **template value** before you continue.

**On-screen cue:** Open trafo dialog; show vector_group + shift_degree; one YNd vs Dyn comparison on 1ph ikss at 30 kV; restore original group.

### 6:45–8:30 · OpenDSS FaultStudy *(screen: Short Circuit, OpenDSS tab)*

> Open **Short Circuit** again. Switch to the **OpenDSS** tab. **Base frequency 50 hertz**. Leave **Three Phase** and **All busbars**. Calculate.  
>
> You get the same style labels on **buses** — **ikss**, **ip**, **ith** — but OpenDSS is **not** a second IEC 60909 solver. It runs **FaultStudy**: snapshot voltage, then **Isc** from the nodal admittance. IEC applies voltage factor **c** near **1.1** on MV; OpenDSS uses about **1.0 per unit** prefault. IEC treats wind turbines as **IEC current sources**; OpenDSS maps generators with a **subtransient reactance** model — contributions differ. Peak **ip** in Electrisim uses a **fixed kappa 1.8** on the OpenDSS path, not IEC kappa from R/X. **ith** is copied from **ikss**, not the IEC thermal equivalent.  
>
> OpenDSS fills **bus** boxes only. **Lines**, **transformers**, and **turbines** show that branch SC is **not provided** — plan on **pandapower IEC** when you need line and transformer duties.  
> Compare **bus ikss** with your IEC run at the **110 kV** and **30 kV** buses. Numbers will differ; that is expected. For grid-code and IEC-rated gear, trust **IEC 60909**. Use OpenDSS as an independent **Y-bus fault check** on the same diagram.

**On-screen cue:** OpenDSS tab, 50 Hz, 3ph; compare one 110 kV and one 30 kV ikss side-by-side with IEC (split screen or memory); point at “not provided” on a line box.

### 8:30–8:50 · Outro *(voice; optional title card or freeze on diagram)*

> That is **short-circuit calculation** in Electrisim — **IEC 60909** with three-phase and single-phase faults, **vector group** effects on earth current, and **OpenDSS FaultStudy** on the **33 megawatt onshore** template.  
> The model is **File → New → onshore wind farm 33MW**. The study is **Simulate → Short Circuit**. For North American **ANSI/IEEE C37** duties, tick that option on the Pandapower tab — beta, typically **60 hertz** — on a different project. Build your own network at **electrisim.com**.

---

## Recording checklist

- [ ] Import PNG slides `short_circuit_33mw_01_title.png` … `short_circuit_33mw_03_cables.png` into Clipchamp
- [ ] Open **File → New → onshore wind farm 33MW** (10 WTGs, 30 kV, 40 MVA 110/30 kV, 5 km 110 kV, reactor, POC)
- [ ] Run load flow once if the diagram is fresh — verify connectivity
- [ ] IEC run 1: Pandapower tab, **IEC 60909**, **3ph**, **max**, **all busbars**, **tk_s = 1**
- [ ] Read **ikss / ip / ith** at 110 kV, 30 kV, and 0.69 kV — quote live values, not script numbers
- [ ] Show **Slide 3 — Cables** before or during the 1ph explanation
- [ ] IEC run 2: **1ph**, **max**, all busbars — compare to 3ph; clarify **Two Phase** ≠ earth fault
- [ ] Vector group demo on **40 MVA 110/30 kV** trafo; restore template setting after demo
- [ ] OpenDSS: **50 Hz**, **3ph**, all busbars — compare bus ikss only; mention bus-only branch results
- [ ] Do **not** present OpenDSS kA as IEC 60909 submission data
- [ ] Do **not** mix IEC-rated and ANSI-rated equipment narratives in one duty table
- [ ] Mic quiet; hide bookmarks; zoom so bus names and result boxes are readable
- [ ] No competitor UI, slides, or logos

## Quick reference (this study)

| Quantity | Value |
|----------|--------|
| Template | File → New → onshore wind farm 33MW |
| WTGs | 10 × 3.3 MVA (current-source SC model) |
| Padmount | 3.75 MVA 30/0.65 kV |
| Main transformer | 40 MVA 110/30 kV — vector group demo here |
| Export cable | 5 km, 110 kV |
| Shunt | Reactor at substation 110 kV |
| POC / grid | Point of connection — 110 kV + External Grid |
| Study menu | Simulate → Short Circuit |
| IEC engine | Pandapower tab → tick **IEC 60909** |
| IEC defaults (demo) | 3ph or 1ph, **max**, all busbars, tk_s = **1 s** |
| OpenDSS engine | OpenDSS tab, **50 Hz**, 3ph, all busbars |
| Phase conductor check | IEC **ith** from **3ph** (adiabatic / I²t) |
| Screen / sheath check | **1ph** earth-fault **ikss**; Ik2E named in narration |
| Vector group UI | Transformer → Load Flow → **vector_group**, **shift_degree** |
| Branch SC (IEC) | Buses, lines, transformers, ext grid |
| Branch SC (OpenDSS) | Buses only |
