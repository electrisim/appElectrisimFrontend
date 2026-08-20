# Video script — Onshore Wind Farm Grid Compliance in open-source Electrisim software — Park Controller

**Model:** File → New → **onshore wind farm 33MW**  
[`templates/renewables/reactive_power_onshore_WF_33MW.drawio`](../renewables/reactive_power_onshore_WF_33MW.drawio)  
**Slides (HTML):** [`clipchamp/onshore_33mw_intro.html`](clipchamp/onshore_33mw_intro.html)  
**Slides (PNG, 1920×1080):** `clipchamp/onshore_33mw_01_title.png` … `onshore_33mw_08_outro.png`  
**Target length:** ~6–8 minutes  
**Tone:** engineering walkthrough of a finished farm, then a short expansion demo

This is Electrisim’s own 10-turbine onshore example (leading / **U = 1.1 pu** snapshot). Do not use DIgSILENT slides, logos, or UI.

---

## Clipchamp — import the PNG slides

Drag these 1920×1080 PNGs onto the timeline (source HTML is kept if you need to edit text later):

| Slide | File | Duration |
|-------|------|----------|
| 1 Title | [`clipchamp/onshore_33mw_01_title.png`](clipchamp/onshore_33mw_01_title.png) | 6–8 s |
| 2 Agenda | [`clipchamp/onshore_33mw_02_agenda.png`](clipchamp/onshore_33mw_02_agenda.png) | 8–10 s |
| 3 Network | [`clipchamp/onshore_33mw_03_network.png`](clipchamp/onshore_33mw_03_network.png) | 8–10 s |
| 4 Wind turbine | [`clipchamp/onshore_33mw_04_wind_turbine.png`](clipchamp/onshore_33mw_04_wind_turbine.png) | 4–6 s |
| 5 Park controller | [`clipchamp/onshore_33mw_05_park_controller.png`](clipchamp/onshore_33mw_05_park_controller.png) | 4–6 s |
| 6 Load flow | [`clipchamp/onshore_33mw_06_load_flow.png`](clipchamp/onshore_33mw_06_load_flow.png) | 4–6 s |
| 7 Expand | [`clipchamp/onshore_33mw_07_expand.png`](clipchamp/onshore_33mw_07_expand.png) | 4–6 s |
| 8 Outro | [`clipchamp/onshore_33mw_08_outro.png`](clipchamp/onshore_33mw_08_outro.png) | 5–6 s |

---

## Suggested Clipchamp timeline

| Time | Visual | Audio |
|------|--------|--------|
| 0:00–0:12 | **Slide 1 — Title** | Hook: 33 MW, POC, 1.1 pu |
| 0:12–0:28 | **Slide 2 — Agenda** | Six live steps |
| 0:28–0:48 | **Slide 3 — Network** | Topology + who owns the POC |
| 0:48–0:55 | **Slide 4 — Wind turbine** | Section card |
| 0:55–1:50 | Electrisim — open template + walk SLD | File → New; zoom the farm |
| 1:50–2:35 | Electrisim — one WTG dialog | P curve + Q capability |
| 2:35–2:40 | **Slide 5 — Park controller** | Section card |
| 2:40–3:25 | Electrisim — Park controller | PF at POC, cosφ(P), Distribution |
| 3:25–3:30 | **Slide 6 — Load flow** | Section card |
| 3:30–4:20 | Electrisim — run load flow | 24.28 MW / 8.80 Mvar / 0.94 |
| 4:20–4:28 | **Slide 7 — Expand** | Section card |
| 4:28–6:20 | Electrisim — 11th turbine | Drop, Q=0, attach, stretch curve |
| 6:20–6:40 | **Slide 8 — Outro** | CTA |

---

## Voice-over script

### 0:00–0:12 · Title slide

> Today we look at a **33 megawatt onshore wind farm** in Electrisim, and how it controls reactive power at the **110 kilovolt point of connection**.  
> This is a **high-voltage case** — grid voltage **1.1 per unit** — so the farm runs **underexcited**. We will walk the network, open the station controller, run a load flow, and then add an eleventh turbine.

### 0:12–0:28 · Agenda slide

> Six steps. Open the template. Walk the single-line. Check one turbine’s PQ limits. Set the park controller at the POC. Run load flow. Then expand the farm and keep the controller in sync.

### 0:28–0:48 · Network slide

> Ten turbines, **3.3 MVA** each, on two **30 kilovolt** collector strings. Each machine has its own **3.75 MVA** padmount transformer.  
> A **40 MVA 110/30 kilovolt** transformer steps the farm up. A **five-kilometre 110 kilovolt cable** reaches the grid operator’s bus — that bus is the **POC**.  
> A **shunt reactor** sits on the **110 kilovolt substation bus**, farm-side of the POC. Everything on the grid side of that point belongs to the TSO. Everything else is ours to control.

### 0:48–0:55 · Section card — Wind turbine

> First, the machine.

### 0:55–1:50 · Open the template and walk the SLD *(screen: Electrisim)*

> Open Electrisim in the browser.  
> Go to **File → New**, open the **renewables** templates, and choose **onshore wind farm 33MW**.  
>
> Zoom to fit. You should see **ten wind turbines** in two strings of five. Follow one string: **0.69 kilovolt** turbine bus, padmount, **30 kilovolt** collector, then the **110/30 kilovolt** substation.  
> From the substation, the **110 kilovolt cable** runs to **Point of connection — 110 kV**, with the **external grid** beyond it.  
> Point out the **shunt reactor** on the 110 kilovolt substation bus.

**On-screen cue:** File → New → onshore wind farm 33MW. Zoom to fit. Hover POC, main transformer, one collector string, reactor.

### 1:50–2:35 · One turbine *(screen: Wind Turbine dialog)*

> Double-click **Wind Turbine 1**.  
> Rated apparent power is **3.3 MVA**. In the load-flow tab, active power comes from a **wind-speed power curve**. This case is **12 metres per second**, which gives **2.5 megawatts**. You can load your own curve or use an Electrisim preset.  
>
> Under **Operational Limits**, open the **reactive-power capability curve**. At this active power the machine can supply or absorb about **1.43 megavars**. That envelope is the hard limit — the station controller must not request more than the converter can physically deliver.

**On-screen cue:** stay on Turbine 1; show wind speed / P, then the PQ capability plot.

### 2:35–2:40 · Section card — Park controller

> Now the station controller.

### 2:40–3:25 · Park controller *(screen: ParkController dialog)*

> Open **ParkController (steady-state)**. All **ten** turbines are on the machine list.  
>
> Control mode is **Power Factor Control**, and the measurement bus is the **POC** — not each turbine.  
> Characteristic type is **cos phi of P**. For this high-voltage case we use the **underexcited** branch: **power factor 0.94 at 24 megawatts**.  
>
> Switch to the **Distribution** tab. Reactive power is split **according to rated power**. All ten machines are 3.3 MVA, so the share is even.

**On-screen cue:** Machines tab → General (PF, cosφ(P) UE 0.94 @ 24 MW, control bus = POC) → Distribution.

### 3:25–3:30 · Section card — Load flow

> Run it.

### 3:30–4:20 · Load flow results *(screen: diagram + results)*

> Run **Load Flow**. With all ten turbines online we generate **25 megawatts**. After cable and transformer losses, **24.28 megawatts** reaches the POC.  
>
> Each turbine absorbs **0.743 megavars**. At the external grid you should see about **8.80 megavars** absorbed and a power factor of **0.94** — right on the characteristic at this output.  
>
> Substation **110 kilovolt** sits at **1.101 per unit**. The **30 kilovolt** collector is about **1.07 to 1.08 per unit**. Main transformer loading is about **60 percent**.  
>
> This is **one** operating point — leading, high voltage — not a full P-Q/Pmax sweep. The farm is holding the underexcited power factor the controller asked for.

**On-screen cue:** highlight External Grid P/Q/PF, then one WTG Q, then POC voltage.

### 4:20–4:28 · Section card — Expand the farm

> Now we grow the farm.

### 4:28–6:20 · Add an 11th turbine *(screen: diagram + dialogs)*

> Tap a new connection off one **30 kilovolt** collector and drop in an **eleventh turbine** with its padmount transformer — same 3.3 MVA template as the others.  
>
> Open its parameter dialog. Active power should still be **2.5 megawatts** at 12 metres per second. Reactive power is **zero**, because this machine is still on **local control** — it is not on the park-controller list yet.  
>
> Run load flow. Farm output climbs toward **27.5 megawatts**, but the new turbine contributes **no megavars** while the original ten keep sharing the POC target. It is not participating.  
>
> Open the park controller, add **Wind Turbine 11** to the machine list, and run load flow again. It should fall in line — same megavar output as its neighbours.  
>
> One last change. The farm can now put out close to **27.5 megawatts**, but the **cos phi of P** curve still keys off **24 megawatts**. Stretch the **underexcited** breakpoint toward the new farm output so the controller is not working from an outdated capacity assumption. Save, and you are done.

**On-screen cue:** draw/connect 11th WTG + transformer; show Q = 0; add to park list; re-run; edit UE P from 24 MW toward ~27 MW.

### 6:20–6:40 · Outro

> That is reactive-power control for an onshore wind farm in Electrisim — turbine PQ limits, a coordinated park controller at the 110 kilovolt POC, and scaling the farm without leaving the controller behind.  
> The model is in Electrisim under **File → New → onshore wind farm 33MW**, or build your own from scratch at **electrisim.com**.

---

## Recording checklist

- [ ] Import PNG slides `onshore_33mw_01_title.png` … `onshore_33mw_08_outro.png` into Clipchamp
- [ ] Open **File → New → onshore wind farm 33MW** (rev3 topology: 10 WTGs, 30 kV, 5 km 110 kV, shunt reactor)
- [ ] Confirm park controller: PF control, cosφ(P) **UE 0.94 @ 24 MW**, bus = **Point of connection — 110kV**, all 10 machines
- [ ] First load flow should match: POC **24.28 MW**, **8.80 Mvar**, **PF 0.94**; each WTG **2.50 MW / −0.743 Mvar**; grid **U = 1.1 pu**
- [ ] Do **not** call this a full NC RfG P-Q/Pmax pass — it is the **U = 1.1 pu** snapshot
- [ ] 11th turbine: show Q = 0 before attaching; then attach; then stretch the 24 MW breakpoint
- [ ] Mic quiet; hide bookmarks; zoom so bus names are readable
- [ ] No competitor UI, slides, or logos

## Quick reference (this snapshot)

| Quantity | Value |
|----------|--------|
| WTGs | 10 × 3.3 MVA, 2.5 MW @ 12 m/s |
| Padmount | 3.75 MVA 30/0.65 kV |
| Main transformer | 40 MVA 110/30 kV (~59.9% loaded) |
| Export cable | 5 km, 110 kV |
| Shunt | Reactor at substation 110 kV |
| Grid U | 1.100 pu |
| POC P / Q / PF | 24.28 MW export / 8.80 Mvar absorbed / 0.94 UE |
| WTG Q | −0.743 Mvar each |
| Park controller | PF control, cosφ(P) UE 0.94 @ 24 MW, split by Sn |
