# Video script — Transient Stability & Eigenvalue Analysis (ANDES) in Electrisim

**Model:** [`transient_stability_two_machine_demo.py`](transient_stability_two_machine_demo.py)  
**Slides:** [`clipchamp/andes_stability_tutorial_intro.html`](clipchamp/andes_stability_tutorial_intro.html)  
**Target length:** ~8–10 minutes  
**Tone:** educational, engineering-first (matches Arc Flash / PowerFactory tutorial style)

---

## Suggested Clipchamp timeline

| Time | Visual | Audio |
|------|--------|--------|
| 0:00–0:10 | **Slide 1 — Title** | Hook + title |
| 0:10–0:50 | **Slide 2 — Transient stability** | What TDS is + pipeline |
| 0:50–1:25 | **Slide 3 — Eigenvalues** | Small-signal / s-plane |
| 1:25–1:50 | **Slide 4 — Demo agenda** | What we will do live |
| 1:50–2:40 | Electrisim — import model | File → Import |
| 2:40–3:40 | Electrisim — walk the SLD | Area A / Area B / tie |
| 3:40–4:20 | Electrisim — Generator Dynamics | Defaults / optional edit |
| 4:20–5:40 | Electrisim — run Transient Stability | Dialog + charts |
| 5:40–7:00 | Electrisim — discuss TDS results | ω / δ / V recovery |
| 7:00–8:20 | Electrisim — run Eigenvalue Analysis | Verdict + s-plane |
| 8:20–8:50 | Optional: longer clearing time | Sensitivity tip |
| 8:50–9:10 | End card / app URL | CTA |

---

## Voice-over script

### 0:00–0:10 · Title slide

> Load flow tells you the steady state.  
> Transient stability asks: after a fault, do the machines stay in sync?  
> In this Electrisim tutorial we run **ANDES** time-domain simulation and eigenvalue analysis — from a two-machine network to rotor swings and the s-plane — without commercial TSA software.

### 0:10–0:50 · Theory slide 2 — Transient stability

> Transient stability is a **large-disturbance** study. Typical events: a three-phase bus fault, then clear; or a line trip.  
>
> Electrisim maps your diagram to **ANDES**: buses, lines, loads, and synchronous generators with GENROU (or GENCLS), plus default exciter and governor when Dynamics fields are empty.  
>
> After power flow converges, ANDES integrates the DAEs with the implicit trapezoidal method.  
>
> You watch generator speed ω, rotor angle δ, and bus voltage versus time. If clearing is fast enough, oscillations decay. If not, angles diverge — loss of synchronism.

### 0:50–1:25 · Theory slide 3 — Eigenvalues

> Small-signal stability is different. There is **no big fault**. We linearise around the operating point and compute eigenvalues of the state matrix.  
>
> Left half-plane: modes decay. Right half-plane: modes grow. The imaginary part sets oscillation frequency; the damping ratio ζ tells how quickly swings die out.  
>
> Electrisim highlights the least-damped modes and plots them on the s-plane — useful before you spend time on long TDS cases.

### 1:25–1:50 · Agenda slide

> Live demo plan: import the two-machine model, walk Area A and Area B, run Transient Stability with a fault on Bus B, discuss the swing curves, then run Eigenvalue Analysis on the same network.

### 1:50–2:40 · Import the model *(screen: Electrisim)*

> Open Electrisim in the browser.  
> Go to **File → Import**, and select `transient_stability_two_machine_demo.py`.  
> Electrisim builds the pandapower network on the canvas: two 230 kV buses, two generators, two loads, and one weak tie line.

**On-screen cue:** zoom to fit; show GenA_Slack left, GenB right, Tie_Line_AB between them.

### 2:40–3:40 · Walk the topology *(screen: diagram)*

> **Area A** on the left: **BusA_230**, **GenA_Slack** at about 800 MW, and **LoadA**.  
> **Area B** on the right: **BusB_230**, **GenB** at 700 MW, and a heavier **LoadB**.  
>
> Power flows from A to B across **Tie_Line_AB** — about a hundred kilometres of corridor.  
> That is intentional: a fault on the receiving end stresses the tie and makes the inter-area swing obvious.

### 3:40–4:20 · Generator Dynamics *(screen: Generator dialog)*

> Double-click **GenA_Slack** and open the **Dynamics** tab.  
> Machine model defaults to **GENROU**; exciter **EXDC2**; governor **TGOV1**.  
> Empty numeric fields mean Electrisim applies textbook defaults — they appear later under *defaults applied* in the results.  
> For this video we leave defaults; advanced users can set inertia M or droop R explicitly.

### 4:20–5:40 · Run Transient Stability *(screen: Simulate menu + dialog)*

> Open the green **Simulate** menu and choose **Transient Stability (ANDES)**.  
>
> For this model use:
> - Frequency: **60 Hz**  
> - System base: **100 MVA**  
> - End time **tf**: **10 s**  
> - Fault bus: **BusB_230**  
> - Fault apply / clear: **1.0 s** / **1.10 s**  
> - Line outage: none for the first run  
>
> Click **Run Simulation**. Electrisim solves power flow, applies the fault, clears it, and returns the time series.

**On-screen cue:** wait for results dialog; switch between ω, δ, and voltage charts.

### 5:40–7:00 · Discuss TDS results *(screen: results charts)*

> Look at **generator speed ω** first. At one second the fault hits Bus B — both machines accelerate or decelerate as electrical power changes. After clear at 1.1 seconds, you should see damped swings.  
>
> **Rotor angle δ** shows the relative swing between GenA and GenB — the classic two-machine story.  
>
> **Bus voltages** dip during the fault and recover after clearing.  
>
> If the clearing time were much longer, these swings would grow — that is the engineering takeaway: critical clearing time matters as much as steady-state loading.

### 7:00–8:20 · Eigenvalue Analysis *(screen: Simulate → Eigenvalue)*

> Close the TDS dialog. Open **Simulate → Eigenvalue Analysis (ANDES)**.  
> Keep 60 Hz and 100 MVA; highlight the **10** least-damped modes.  
>
> Run the study. You should see a **stable** (or marginally stable) verdict, a count of negative eigenvalues, and an s-plane scatter.  
>
> Point to the oscillatory modes closest to the imaginary axis — those dominate the swing you just watched in TDS.  
> Participation factors (if shown) link modes back to machine states.

### 8:20–8:50 · Optional sensitivity *(screen: TDS again)*

> Optional second run: same fault bus, clear at **1.3 s** or **1.5 s** instead of 1.1.  
> Compare whether ω still settles. That single change turns the tutorial into a critical-clearing discussion.

### 8:50–9:10 · End card

> Transient and small-signal stability in the browser, powered by ANDES.  
> Import the demo, run the studies, and explore Dynamics on every generator.  
> Try it at **app.electrisim.com** — documentation at electrisim.com.

---

## Recording checklist

- [ ] Backend running with `andes` installed (`pip install andes`)
- [ ] Import `transient_stability_two_machine_demo.py` successfully
- [ ] Load Flow once (optional sanity check) before TDS
- [ ] Capture Slide 1–4 PNGs from `andes_stability_tutorial_intro.html` (1920×1080, F11)
- [ ] Mic quiet; hide browser bookmarks; zoom diagram labels readable
- [ ] First TDS: fault BusB, 1.0 / 1.10 s, tf = 10
- [ ] EIG on same diagram without changing dispatch
- [ ] Mention Dynamics defaults / `defaults_applied` once

## Demo dialog defaults (quick reference)

| Study | Key settings |
|-------|----------------|
| Transient Stability | 60 Hz, 100 MVA, tf=10, fault **BusB_230**, 1.0 / 1.10 s |
| Eigenvalue | 60 Hz, 100 MVA, n_modes=10 |
