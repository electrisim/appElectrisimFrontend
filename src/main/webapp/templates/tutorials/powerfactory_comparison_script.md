# Video Script — Validating Electrisim against PowerFactory

**Target length:** ~8–10 minutes  
**Solver:** Pandapower (Electrisim load flow)  
**Template:** File → New → **Testing with other software** → **Comparing PowerFactory**  
**Tabs:** Test-1, Test-2, Test-3, Test-4

---

## Model overview

| Tab | Topology |
|-----|----------|
| **Test-1** | External grid → line → load *(no transformer)* |
| **Test-2** | External grid → line → **2-winding transformer** → load |
| **Test-3** | External grid → line → **3-winding transformer** → two 33 kV loads |
| **Test-4** | Same as Test-3, but **loads replaced by static generators** (export to grid) |

---

## On-screen text (intro slides)

**Title slide (5–8 s)**  
- Badge: `TUTORIAL · ELECTRISIM ↔ POWERFACTORY`  
- Headline: **Validating Electrisim against PowerFactory**  
- Subtitle: Four transmission models · pandapower load flow  

**Agenda slide (8–10 s)**  
1. Test-1 — Grid · line · load (no transformer)  
2. Test-2 — Grid · line · 2W trafo · load  
3. Test-3 — Grid · line · 3W trafo · two 33 kV loads  
4. Test-4 — Same as Test-3 · static generators (export)  

---

## 0:00 — 0:45 · Introduction

**[Show title slide, then Electrisim File → New dialog]**

**Narration:**

> In this tutorial we compare Electrisim load-flow results with DIgSILENT PowerFactory on four transmission test models. Electrisim uses the pandapower backend for load flow. Each tab in our template has a matching PowerFactory case.
>
> To follow along, open Electrisim, go to **File → New**, select **Testing with other software**, and choose **Comparing PowerFactory**. You get four diagram tabs: Test-1 through Test-4.

**[Show agenda slide briefly]**

**On-screen callout:** `File → New → Testing with other software → Comparing PowerFactory`

---

## 0:45 — 2:00 · Test-1 — Grid, line, and load

**[Switch to Test-1 tab. Show single-line diagram.]**

**Narration:**

> Test-1 is the simplest case: a 132 kilovolt external grid, a transmission cable, and a load — **no transformer**. This validates line flows and bus voltages before adding transformer complexity.
>
> Open **Simulate → Load Flow**, then **Calculate**. Check result labels at the grid, on the line, and at the load bus: active and reactive power, current, and voltage.

**[Run load flow. Pause on result labels.]**

> Compare the same quantities in PowerFactory on the identical network. Grid injection, line loading, and load-bus voltage should agree within rounding.

**On-screen takeaway:** `Baseline case — grid · line · load`

**[Optional: Download Pandapower Results (.txt) briefly]**

---

## 2:00 — 3:45 · Test-2 — Two-winding transformer

**[Switch to Test-2 tab.]**

**Narration:**

> Test-2 adds a **two-winding transformer**: external grid, line, 90 MVA 132/33 kV transformer, and an 80 megawatt load with 20 megavar.
>
> Run load flow and review transformer loading plus voltages on the high-voltage and low-voltage sides.

**[Run load flow. Highlight trafo and load results.]**

**On-screen comparison table — Test-2:**

| Quantity | PowerFactory | Electrisim |
|----------|--------------|------------|
| Grid P [MW] | 80.517 | 80.517 |
| Grid Q [MVAr] | −5.230 | −5.231 |
| Load P [MW] | 80.000 | 80.000 |
| LV voltage [kV] | 31.467 | 31.468 |
| LV angle [°] | −37.96 | −37.959 |
| Trafo loading [%] | 96.1 | 96.1 |
| Line loading [%] | 39.3 | 39.3 |

> After aligning vector group, line rating, and transformer parameters, active power, currents, voltages, and loadings match to three decimal places.

**On-screen takeaway:** `2W trafo — P, Q, I, U match within rounding`

---

## 3:45 — 5:45 · Test-3 — Three-winding transformer, two loads

**[Switch to Test-3 tab.]**

**Narration:**

> Test-3 introduces a **three-winding transformer**. The grid feeds a cable line; the transformer supplies **two 33 kilovolt buses**, each with a 40 megawatt load and 10 megavar.
>
> Run load flow. Both low-voltage buses should show identical voltages and angles.

**[Run load flow. Highlight both LV buses.]**

**On-screen comparison table — Test-3:**

| Quantity | PowerFactory | Electrisim |
|----------|--------------|------------|
| Grid P [MW] | 80.405 | 80.405 |
| Line P_to [MW] | 80.156 | 80.156 |
| Line I_to [kA] | 0.387 | 0.387 |
| LV voltage [kV] | 30.888 | 30.877 |
| LV angle [°] | −10.51 | −10.527 |
| Trafo loss [kW] | ~156 | ~156 |

**[Optional 15 s — show loss-mapping slide or 3W dialog]**

> For three-winding units, map PowerFactory **copper losses in kilowatts** to Electrisim **vkr_hv_percent**, **vkr_mv_percent**, and **vkr_lv_percent**. Set **pfe_kw** to zero if PowerFactory has no iron losses.

**On-screen formula:** `vkr [%] = P_cu [kW] / (10 × S_ref [MVA])`

**[Open Three Winding Transformer dialog → Load Flow tab; point to vkr fields]**

---

## 5:45 — 7:45 · Test-4 — Static generators (same network as Test-3)

**[Switch to Test-4 tab.]**

**Narration:**

> Test-4 uses the **same topology as Test-3** — external grid, line, and three-winding transformer — but the two 33 kilovolt **loads are replaced by static generators**. Total in-service generation is 30 megawatts; power flows through the transformer and line to the 132 kilovolt grid.
>
> Run load flow. The external grid shows **negative** active power: export from the network.

**[Run load flow. Highlight sgen P/Q and negative grid P.]**

**On-screen comparison table — Test-4:**

| Quantity | PowerFactory | Electrisim |
|----------|--------------|------------|
| Grid P [MW] | −29.920 | −29.919 |
| Grid Q [MVAr] | −46.748 | −46.749 |
| Total generation [MW] | 30.000 | 30.000 |
| Line loss [kW] | 61 | 61 |
| Trafo loss [kW] | 19 | 20 |
| LV voltage [pu] | 1.028 | 1.028 |
| LV angle [°] | 3.511 | 3.511 |

> Export power, line flows, and low-voltage voltages agree within one kilowatt. The generation case validates the same 3W model as Test-3.

**On-screen takeaway:** `Test-4 = Test-3 with static generators — ΔP_grid ≈ 0.001 MW`

---

## 7:45 — 8:15 · Closing

**[Show outro slide]**

**Narration:**

> We validated four models against PowerFactory: a line-only case, a two-winding transformer, a three-winding transformer with dual loads, and the same network with static generator export.
>
> Open the template under **Testing with other software**. For 3W transformers, map PowerFactory copper losses to **vkr** and iron losses to **pfe_kw**. Try it at **app.electrisim.com**.

**On-screen CTA:** `app.electrisim.com` · Template: **Comparing PowerFactory**

---

## Recording checklist

- [ ] Pre-run load flow on all four tabs before recording  
- [ ] Prepare PowerFactory screenshots for picture-in-picture overlay (~5 s per model)  
- [ ] Show `.txt` results export once (Test-1 or Test-2)  
- [ ] Show 3W transformer dialog on Test-3 segment  
- [ ] Import title + agenda PNGs from `templates/tutorials/clipchamp/`  
- [ ] Total runtime target: 8–10 minutes  

---

## Parameter reference (3W copper losses — Test-3 / Test-4)

Example for 90 / 45 / 45 MVA transformer with PowerFactory copper losses:

| PF pair | P_cu [kW] | Electrisim field | Value [%] |
|---------|-----------|------------------|-----------|
| HV–MV | 55 | vkr_hv_percent | 0.122 |
| MV–LV | 20 | vkr_mv_percent | 0.044 |
| LV–HV | 55 | vkr_lv_percent | 0.122 |

Also set: `pfe_kw = 0`, `i0_percent = 0` when PowerFactory has no iron-loss data.
