# Data center interconnection — utility pocket tutorial

Public **138 kV utility pocket** with a scalable data-center load block for Phase 1 site screening and Phase 2 interconnection studies.

## Open the model

1. **File → Import from → Device…**
2. Select [`data_center_interconnection_pocket.py`](data_center_interconnection_pocket.py)
3. Choose **Vertical** layout when prompted.

The canvas places `Utility_138` and `POI_138` on the upper row (two parallel lines between them), `Remote_Gen` on the POI, and `Campus_34.5` directly below the POI through `POI_Transformer`, with the data-center load, backup generator, and BESS on the campus bus.

## Network summary

| Element | Role |
|--------|------|
| `Utility_Grid` | Slack / short-circuit source |
| `Line_A`, `Line_B` | Parallel 138 kV corridors (N-1 candidates) |
| `Remote_Gen` | Remote synchronous plant (generator outage + trip scenario) |
| `POI_Transformer` | 250 MVA 138/34.5 kV |
| `DataCenter_Load` | **300 MW** default (edit `p_mw` up to **1000 MW**) |
| `Backup_Gen`, `Campus_BESS` | On-site sources for **post-project** short circuit |
| `POI_CB_LineA` | Breaker with interrupting / momentary ratings (ANSI duty) |

## Phase 1 — Site screening

1. Run **Load Flow** once to confirm convergence.
2. **Simulate → Data Center Site Screening**
3. Select load **`DataCenter_Load`** as the site POI load.
4. MW sizes: `300,500,1000` (comma-separated).
5. Power factor: **0.95**; enable **N-1-1** if desired.
6. Download the **comparison CSV** (headroom MW, worst N-1 / N-1-1, upgrade flag).

Import your own utility case with **pandapower `.py`** or **OpenDSS `.dss`** instead of this pocket. Electrisim does not ship MMWG / WECC / ISO copyrighted base cases.

## Phase 2 — Interconnection

- **Load flow / contingency** at final MW with Grid Code P-Q at the POI if required.
- **Computational load** (Load dialog → Computational load): IT vs cooling ZIP split, UPS hold-up, ride-through curve — used for **ride-through pass/fail** on transient results (not PSS/E CMLD/PERC1).
- **Transient Stability (ANDES)**: fault at `POI_138`, optional **generator trip** on `Remote_Gen`; POI bus for voltage metrics.
- **Short Circuit → ANSI/IEEE C37**: tick **Pre/post project comparison**; project elements = data-center load, backup gen, BESS.

## Standards note

- Steady-state: pandapower ZIP load (`const_z_percent`, `const_i_percent`).
- Short circuit: **IEC 60909** or **ANSI/IEEE C37 (beta)** on the Pandapower tab.
- Dynamics: **ANDES** RMS time-domain — not EMT (ParaEMT/dpsim is future work).
