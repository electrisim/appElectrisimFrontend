# Tutorial: BESS Overvoltage in Weak Grids (OpenDSS)

This tutorial demonstrates how a Battery Energy Storage System (BESS) can cause overvoltage when connected to a **weak grid**, and how **inverter control modes** (fixed Q, fixed PF, Q-V droop) mitigate the problem.

**Solver:** OpenDSS (recommended for inverter Volt-VAR / InvControl studies).

**Template file:** Open this guide while building the network in Electrisim, or **import the ready-made OpenDSS file**:

| File | Purpose |
|------|---------|
| [`bess_weak_grid_overvoltage.dss`](bess_weak_grid_overvoltage.dss) | Import via **File → Import** (`.dss` / OpenDSS) — builds Grid, Feeder, POC transformer, and BESS (Case 2 baseline) |
| [`clipchamp/bess_weak_grid_intro.html`](clipchamp/bess_weak_grid_intro.html) | **Clipchamp intro slides** (1920×1080, Electrisim branding) — see [`clipchamp/CLIPCHAMP_README.md`](clipchamp/CLIPCHAMP_README.md) |
| [`soh_capability.py`](soh_capability.py) | **SOH-aware reactive capability** — shrinks the inverter's usable `q_avail_mvar` from battery State-of-Health / R_int before you trust the Volt-VAR headroom (see *SOH-aware reactive capability* below) |
| This `.md` file | Step-by-step parameter changes for Cases 1–5 |

### Import the `.dss` template

1. In Electrisim: **File → Import** and select `bess_weak_grid_overvoltage.dss`
2. The diagram is placed on the canvas with:
   - **External Grid** at `Grid` (weak: ~800 MVA, R/X = 8)
   - **Line** `Feeder` (25 km, high X/R)
   - **Transformer** `POC_TR` (110 / 33 kV, 100 MVA)
   - **Storage** `BESS` (40 MW export, 50 MVA, 100 MWh)
3. Run **OpenDSS Load Flow** — expect POC voltage **> 1.05 pu** (overvoltage)
4. Follow Cases 3–5 below by editing Storage / External Grid parameters

---

## Network topology

```
External Grid (weak) ── Line ── Transformer ── POC Bus ── BESS Storage
```

| Element | Name | Key parameters |
|---------|------|----------------|
| External Grid | `Grid` | `vn_kv` = 110, `vm_pu` = 1.0 |
| Line | `Feeder` | `length_km` = 15–30, `r_ohm_per_km` = 0.1, `x_ohm_per_km` = 0.4 (high X/R) |
| Transformer | `POC_TR` | 110/33 kV, `sn_mva` = 100 |
| Bus (POC) | `POC` | `vn_kv` = 33 |
| Storage (BESS) | `BESS` | `sn_mva` = 50, `max_e_mwh` = 100 |

Connect: Grid → Feeder → POC_TR (HV/LV) → POC → BESS.

---

## OpenDSS load flow settings

Use **OpenDSS Load Flow** (not pandapower) for all scenarios:

| Parameter | Value |
|-----------|-------|
| Solution Mode | Snapshot |
| Solution Algorithm | Newton (if convergence issues) |
| Control Mode | **Time** (required for Q-V droop; auto-set when InvControl is used) |

---

## Five comparison scenarios

Run each scenario, then use **Scenario Compare** (baseline = Case 2) to review the **Overvoltage mitigation** panel.

### Case 1 — Stiff grid baseline

**Goal:** Normal voltages with BESS exporting power.

| Element | Parameter | Value |
|---------|-----------|-------|
| External Grid | `s_sc_max_mva` | 10000 |
| External Grid | `rx_max` | 0 |
| Storage | `p_mw` | -40 (discharging / exporting) |
| Storage | `q_mvar` | 0 |
| Storage | Inverter Control | NONE |

**Expected:** POC voltage ≈ 1.0 pu, no overvoltage.

---

### Case 2 — Weak grid, no inverter support (overvoltage)

**Goal:** Demonstrate overvoltage caused by BESS export on a weak grid.

| Element | Parameter | Value |
|---------|-----------|-------|
| External Grid | `s_sc_max_mva` | **800** |
| External Grid | `rx_max` | **8** |
| Storage | `p_mw` | -40 |
| Storage | `q_mvar` | 0 |
| Storage | Inverter Control | NONE |

**Expected:** POC voltage **> 1.05 pu** (overvoltage). Pin this run as baseline for Cases 3–5.

---

### Case 3 — Manual Q absorption (fixed Q control)

**Goal:** Partial mitigation by manually absorbing reactive power.

| Element | Parameter | Value |
|---------|-----------|-------|
| (same weak grid as Case 2) | | |
| Storage | `q_mvar` | **+15** (absorbing / inductive) |
| Storage | Inverter Control | **FIXED_Q** |

**Expected:** Voltage drops vs Case 2; may still be > 1.05 pu depending on grid strength.

---

### Case 4 — Constant PF control

**Goal:** Mitigation via fixed **lagging** power factor (absorbing vars while exporting P).

| Element | Parameter | Value |
|---------|-----------|-------|
| (same weak grid as Case 2) | | |
| Storage | `p_mw` | -40 |
| Storage | Inverter Control | **FIXED_PF** |
| Storage | `pf` | **0.95** (magnitude; Electrisim maps this to lagging/absorbing vars while discharging) |

**Expected:** `Q[MVar]` **positive** (~13 MVar at 40 MW export, similar magnitude to Case 3). Lower voltage than Case 2; compare Q absorption vs Case 3 in Scenario Compare.

**Note:** OpenDSS uses **negative pf** internally when discharging to absorb vars. Enter **0.95** in the UI (not −0.95) — the backend applies the correct sign automatically.

---

### Case 5 — Q-V droop (Volt-VAR / InvControl)

**Goal:** Automatic overvoltage mitigation per IEEE 1547-style Volt-VAR curve.

| Element | Parameter | Value |
|---------|-----------|-------|
| (same weak grid as Case 2) | | |
| Storage | `p_mw` | -40 |
| Storage | `sn_mva` | 50 |
| Storage | Inverter Control | **VOLTVAR** |
| Storage | Volt-VAR preset | **IEEE_1547** (default curve) |
| Load Flow | Control Mode | **Time** |

OpenDSS commands generated (for reference):

```text
New XYCurve.BESS_VV npts=4 xarray=[0.92 0.98 1.02 1.08] yarray=[0.44 0 -0.44 -0.44]
New InvControl.BESS_InvCtrl Mode=VOLTVAR DERList=[Storage.BESS] VVC_Curve1=BESS_VV RefReactivePower=VARMAX
Set ControlMode=Time
```

**Expected:** BESS automatically absorbs Q when voltage exceeds ~1.02 pu; POC voltage reduced vs Case 2. Scenario Compare shows **Fully mitigated** buses and **BESS reactive response**.

> **Reality check (Volt-VAR is a first layer, not a verdict):** Unity PF removes the *reactive* exchange, **not** the voltage sensitivity — on a weak feeder the `R·P` term still lifts POC voltage (that is exactly why Case 2 overvolts with `q_mvar = 0`). Reactive absorption only helps in proportion to the local **X/R**, and fixed Q / fixed PF can overcorrect or consume inverter kVA headroom as the operating point moves. The InvControl curve also assumes the requested Q is *physically deliverable* — which depends on the battery state (see **SOH-aware reactive capability** below). Treat Cases 3–5 as the quasi-static mechanism, then size the real envelope with the checks in **Verification scope** below.

---

## SOH-aware reactive capability (battery-state honesty)

OpenDSS **InvControl** assumes the reactive headroom is bounded only by the inverter **kVA rating**. It does **not** shrink that headroom when the battery ages. But the Q you count on at the POC is only as honest as the **State-of-Health (SOH)** model underneath it: as cells degrade, internal resistance `R_int` rises, the DC-link voltage sags under load, the modulation ceiling drops, and the **deliverable** `q_avail_mvar` shrinks. If the SOH estimate is **inflated** (common when ML pipelines leak information across a cell's own charge/discharge cycles), the grid-code check can **pass on paper and fail in the field**.

Use the helper script [`soh_capability.py`](soh_capability.py) to compute the realistic envelope **before** trusting the Volt-VAR result. It maps `R_int → V_dc → modulation/current-limit → Q_avail` for a given operating point.

```bash
python soh_capability.py
```

Representative result (3.45 MVA inverter class, `Q_req = 1.5 MVar`):

| P (MW) | Q required | Q (honest SOH 80%) | Q (inflated SOH 95%) | Verdict flips? |
|--------|-----------|--------------------|----------------------|----------------|
| 2.5 | 1.5 | 1.78 | 2.09 | no |
| **2.8** | **1.5** | **1.15 → FAIL** | **1.62 → PASS** | **YES** |
| 3.0 | 1.5 | 0.11 | 1.17 | no (both fail) |

At **P = 2.8 MW** the inflated model reports **1.62 MVar** available (compliant), while the honest aged battery delivers only **1.15 MVar** — a **0.35 MVar shortfall** exactly when voltage support is needed.

**Workflow to fold this into the OpenDSS study:**

1. Run `soh_capability.py` with your **aged-battery** datasheet (`R_int`, `OCV`, SOH) and inverter specs, at your worst-case export `P`.
2. Take the resulting **`q_avail_mvar`** (honest case) as the inverter's effective reactive limit.
3. In Electrisim, cap the BESS accordingly before re-running Case 5 — e.g. lower **`sn_mva`** so `√(P² + Q_req²) ≤ S_avail`, or scale the **Volt-VAR Y-array** so its maximum Q does not exceed `q_avail_mvar`.
4. Re-run **OpenDSS Load Flow** and **Scenario Compare** with the honest limit vs the nameplate limit — if the mitigation verdict flips, the overvoltage is **not** actually mitigated at end-of-life.

> **Scope of the SOH model:** instantaneous (grid-stability timescale). It does **not** model SOC energy depletion over multi-hour load flows, thermal derating, control-loop dynamics, or harmonic limits — validate the SOH estimator itself with **leakage-free, cell-independent** train/test splits before its output is allowed near a POC voltage assumption.

Source / joint collaboration: Electrisim (Adam Kierad) × VolMax Studio Lab (Ivan Nestorov) — [electrisim-soh-capability-demo](https://github.com/VolMax-Studio/electrisim-soh-capability-demo) (Apache-2.0).

---

## Verification scope (what this quasi-static study does *not* cover)

A snapshot OpenDSS load flow demonstrates the **mechanism** and sizes the steady-state reactive support. It is **not** a connection study. For a real weak-grid / low-SCR POC, complement it with:

| Check | Why it matters on a weak grid |
|-------|-------------------------------|
| **Volt-Watt curtailment** | Backstop when Volt-VAR saturates — active-power reduction is sometimes the only lever once Q headroom is exhausted |
| **Tap / regulator interaction** | OLTC and Volt-VAR can hunt or fight each other; check control time constants and hysteresis |
| **Inverter capability curve** | Real P–Q limits, PF/Watt-priority behaviour, and the **SOH-shrunk** envelope above |
| **Worst-case minimum load (and max export)** | Highest overvoltage risk usually occurs at light load with full export |
| **Dynamic / EMT checks** | PLL stability at low SCR, current limiting, LVRT/HVRT ride-through, control interaction / sub-synchronous resonance, protection coordination, and harmonics |

OpenDSS gives the quasi-static envelope; the dynamic/EMT behaviour is where low-SCR connections are actually won or lost.

---

## Using Scenario Compare

1. Run **Case 2** → save/pin as baseline.
2. Run **Case 3, 4, or 5** with the same diagram (change only Storage / inverter settings).
3. Open **Scenario Compare** and review:
   - **Overvoltage mitigation (weak grid / BESS)** section
   - Max bus voltage delta
   - BESS Q change (MVar)
   - Buses moved from warn/danger → good

---

## Weak-grid parameter guidance

| `s_sc_max_mva` | Grid strength | Typical use |
|----------------|---------------|-------------|
| > 5000 MVA | Stiff | Transmission connection |
| 1000–3000 MVA | Moderate | Strong sub-transmission |
| 200–800 MVA | **Weak** | EHV BESS POC studies |
| < 200 MVA | Very weak | Islanded / long radial |

Set `rx_max` = 5–10 for realistic R/X at the POC (Thevenin equivalent at External Grid).

**SCR proxy:** SCR ≈ `s_sc_max_mva / BESS_MVA`. Values below ~5 indicate weak-grid conditions where overvoltage risk is elevated.

---

## Pandapower note

Pandapower in Electrisim supports BESS as fixed P/Q, OPF dispatch, and BESS sizing — but **not** automatic Q-V droop or InvControl. Use OpenDSS for this tutorial.

---

## References

- [OpenDSS InvControl](https://opendss.epri.com/InvControl.html)
- [OpenDSS Storage](https://opendss.epri.com/Storage.html)
- [Smart inverter function calculation](https://opendss.epri.com/Calculationofthesmartinverterfun.html)
- [SOH-aware reactive capability demo (VolMax × Electrisim)](https://github.com/VolMax-Studio/electrisim-soh-capability-demo) — `soh_capability.py`
