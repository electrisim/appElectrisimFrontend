# Tutorial: Container Terminal Port Infrastructure (Pandapower)

This tutorial provides a **medium-scale container terminal** electrical network template for port infrastructure research — including PhD case studies on load flow, contingency analysis, time-series simulation, and BESS peak shaving.

**Solver:** Pandapower (recommended for load flow, contingency, OPF, and time series in Electrisim).

**Template file:** Import the ready-made Pandapower script:

| File | Purpose |
|------|---------|
| [`container_terminal_port_infrastructure.py`](container_terminal_port_infrastructure.py) | Import via **File → Import** (`.py` / Pandapower) — builds the full terminal single-line diagram |
| This `.md` file | Network architecture, modeling approach, study scenarios, and extension guide |

---

## Introduction

Modern container terminals combine **high peak loads** (quay cranes, yard equipment), **continuous base loads** (reefer containers, cold storage), and increasingly **shore power (cold ironing)** for berthed vessels. This example models a representative **European medium hub terminal** connected at **110 kV**, with **20 kV** medium-voltage distribution to functional zones.

**Scope of this baseline model:**

- Steady-state AC load flow (Pandapower)
- Aggregated zone loads (not individual crane VFDs)
- Suitable starting point for time-series and contingency studies

**Out of scope (extend separately if needed):**

- Harmonics from variable-frequency drives (consider OpenDSS harmonic analysis)
- EMT / dynamic crane duty cycles
- Detailed protection coordination

---

## Import the `.py` template

1. In Electrisim: **File → Import** and select `container_terminal_port_infrastructure.py`
2. Choose **vertical** or **horizontal** layout when prompted
3. The diagram is placed on the canvas with:
   - **External Grid** at `Grid_110` (110 kV utility)
   - **Main transformer** `MainTrafo_63MVA_110_20` (63 MVA, 110/20 kV)
   - **MV busbar** `Term_MV_20` with six zone feeders
   - **Six aggregated loads**, rooftop **PV**, and **BESS**
4. Run **Simulate → Load Flow → Calculate** (Pandapower, Newton-Raphson)

---

## Network architecture

```
External Grid (110 kV)
    │
    │ Line_GridConnection_110kV (~5 km)
    │
Terminal HV Bus (110 kV)
    │
    │ MainTrafo_63MVA_110_20
    │
Terminal MV Busbar (20 kV) ──┬── Feed_Quay_20   → Load_STS_Quay (STS cranes)
                            ├── Feed_Yard_20   → Load_RTG_Yard (RTG/RMG cranes)
                            ├── Feed_Reefer_20 → Load_Reefer_Racks
                            ├── Feed_Aux_20    → Load_Aux + Load_ColdStorage
                            ├── Feed_Shore_20  → Load_ShorePower_ColdIroning
                            ├── Feed_BESS_20   → BESS_PeakShaving
                            └── PV_Rooftop (static generator on MV busbar)
```

### Voltage levels

| Level | Typical use in terminal |
|-------|-------------------------|
| **110 kV** | Utility grid connection, main substation HV side |
| **20 kV** | MV distribution to quay, yard, reefer, shore power, BESS |
| *(not modelled)* **0.4 kV** | LV reefer plugs, small crane substations — add when extending |

### Bus and element summary

| Element | Name | Key parameters |
|---------|------|----------------|
| External Grid | `Utility_Grid_110kV` | 110 kV, `vm_pu` = 1.05 |
| Line | `Line_GridConnection_110kV` | 5 km, 110 kV standard type |
| Transformer | `MainTrafo_63MVA_110_20` | 63 MVA, 110/20 kV |
| MV busbar | `Term_MV_20` | 20 kV |
| Zone feeders | `Line_Feeder_*` | 0.4–1.2 km, 20 kV |
| Switches | `Switch_Feeder_Quay/Yard/Reefer` | CB on MV feeders (contingency) |

### Load aggregation (base case)

| Load | P [MW] | cos φ | Typical source |
|------|--------|-------|----------------|
| `Load_STS_Quay` | 12 | 0.88 | 3–4 ship-to-shore cranes (aggregated) |
| `Load_RTG_Yard` | 6 | 0.85 | Rubber-tired / rail-mounted gantry cranes |
| `Load_Reefer_Racks` | 8 | 0.90 | Reefer container racks (relatively constant) |
| `Load_ColdStorage` | 3 | 0.88 | Warehouse refrigeration |
| `Load_Aux_Office_HVAC` | 2 | 0.90 | Offices, lighting, HVAC |
| `Load_ShorePower_ColdIroning` | 6 | 0.95 | Vessel at berth (cold ironing) |
| **Total** | **37** | | ~36 MW net after 1 MW PV |

| Generator / Storage | P [MW] | Notes |
|---------------------|--------|-------|
| `PV_Rooftop` | 1 | Static generator on MV busbar |
| `BESS_PeakShaving` | 0 (idle) | 5 MW / 10 MWh nameplate; dispatch for OPF studies |

**Typical literature ranges** (order of magnitude, for calibration):

- STS crane: 2–4 MW per unit (peaks higher during hoist)
- RTG/RMG: 0.5–1.5 MW per unit
- Reefer load: often 20–40% of terminal base load at large hubs
- Shore power: 1–10+ MW per vessel depending on class (IEC/ISO 80005 series)

References for further reading: IEC 80005 (shore power), IEEE guides on industrial and port power systems, IEA/EU port electrification reports.

---

## Modeling approach

### Why aggregated zone loads?

Individual crane modelling (each STS as a separate load with duty cycle) is valuable for **detailed time-domain studies** but adds complexity early in a PhD project. This template uses **one load per functional zone** so you can:

1. Validate network architecture and voltage profiles quickly
2. Attach **hourly profiles** per zone in Electrisim Time Series Simulation
3. Split zones into individual cranes later without changing the MV topology

### Static vs time-series

| Study type | Recommended approach |
|------------|------------------------|
| Architecture validation, N-1 contingency | Static load flow (this baseline) |
| Daily crane / reefer variability | Time Series Simulation with profiles on `Load_STS_Quay`, `Load_RTG_Yard`, `Load_Reefer_Racks` |
| Peak demand / BESS sizing | OPF or manual BESS dispatch on `BESS_PeakShaving` |
| Shore power on/off | Set `Load_ShorePower_ColdIroning` `in_service` or P = 0 |

### Shore power scenarios

- **Vessel at berth:** `Load_ShorePower_ColdIroning` in service, P = 6 MW (default)
- **Empty berth:** set `in_service = false` or P = 0 MW — reduces total load to ~31 MW

### BESS dispatch

Base case: BESS idle (`p_mw = 0`). For peak shaving:

- Set `p_mw` negative (discharging) to support MV bus during crane peaks
- Enable OPF with `BESS_PeakShaving` controllable for automated dispatch
- Limits: ±5 MW, ±2.5 Mvar, 10 MWh energy capacity

---

## Suggested study scenarios

### Scenario 1 — Base case load flow

**Goal:** Verify convergence and document voltage profile across zones.

| Setting | Value |
|---------|-------|
| All loads | Default (37 MW total) |
| BESS | Idle (P = 0) |
| PV | 1 MW |

**Expected:** Main transformer loading ~65–75%; MV bus voltage ~0.95–1.02 pu; highest line loading on quay or yard feeder.

---

### Scenario 2 — No shore power (idle berth)

**Goal:** Compare terminal load with and without vessel cold ironing.

| Element | Change |
|---------|--------|
| `Load_ShorePower_ColdIroning` | `in_service = false` OR `p_mw = 0` |

**Expected:** Total load drops by 6 MW; slightly lower trafo loading and feeder currents.

---

### Scenario 3 — N-1 MV feeder outage (contingency)

**Goal:** Assess redundancy of radial MV design.

1. Run **Simulate → Contingency Analysis**
2. Outage candidates: `Line_Feeder_Quay`, `Line_Feeder_Yard`, or `Line_Feeder_Reefer`
3. Alternatively, open `Switch_Feeder_Quay` manually and re-run load flow

**Expected:** Outaged feeder zone de-energized (radial topology); document which loads are lost and whether alternative paths exist (none in baseline — motivates ring-bus extension).

---

### Scenario 4 — Time series (crane and reefer profiles)

**Goal:** Daily energy and peak demand analysis.

1. Use **Simulate → Time Series Simulation**
2. Assign hourly profiles:
   - `Load_STS_Quay`: low overnight, peaks during vessel operations (08:00–18:00)
   - `Load_RTG_Yard`: intermittent daytime peaks
   - `Load_Reefer_Racks`: relatively flat 24 h profile
3. Run 24 h horizon

**Expected:** Peak demand exceeds base-case 37 MW during simultaneous crane activity; review charts and Excel export.

---

### Scenario 5 — BESS peak shaving (OPF)

**Goal:** Reduce MV peak load and trafo loading.

1. Increase `Load_STS_Quay` to 16 MW (peak case)
2. Set `BESS_PeakShaving` controllable; run **Optimal Power Flow**
3. Compare trafo loading with/without BESS dispatch

---

## How to extend the model

| Extension | How |
|-----------|-----|
| **Second main transformer** (N-1 redundancy) | Duplicate `MainTrafo_63MVA_110_20` from separate HV bus; split MV busbar |
| **MV ring bus** | Connect zone feeder ends; add sectionalizing switches |
| **20/0.4 kV reefer substations** | Add `trafo` + LV `load` off `Feed_Reefer_20` |
| **Individual cranes** | Replace aggregated load with multiple loads on sub-feeders |
| **Diesel backup generator** | Add `gen` at MV bus with `min_p_mw` / dispatch constraints |
| **Detailed shore power** | Model as `load` + optional `sgen` for reverse power flow when vessel generates |
| **Harmonics (VFD cranes)** | Rebuild or complement with OpenDSS harmonic analysis |

Use **Edit → Component Data** for bulk parameter edits across all elements.

---

## Limitations

- **No VFD harmonics** — aggregated loads hide harmonic injection from crane drives
- **No dynamic crane duty cycles** in the baseline — use time-series profiles as a first approximation
- **Radial MV only** — no redundancy until you extend to ring topology
- **Single main transformer** — no N-1 at HV/MV transformation in baseline
- **Pandapower** — inverter Volt-VAR / grid-forming controls require OpenDSS for advanced DER studies

---

## Pandapower load flow settings

| Parameter | Recommended value |
|-----------|-------------------|
| Algorithm | Newton-Raphson (`nr`) |
| Frequency | 50 Hz |
| Calculate voltage angles | Yes |

---

## References

- [Pandapower documentation](https://pandapower.readthedocs.io/)
- IEC 80005 series — Utility connections in port — Shore power supply systems
- IEA / EU port decarbonisation and shore-side electricity reports
- Electrisim documentation: [Importing Network Models](https://www.electrisim.com/documentation.html#importing-models)
