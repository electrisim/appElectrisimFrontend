# Tutorial: Monte Carlo Load Flow (OpenDSS)

## Goal
Run OpenDSS M1 / M2 / M3 probabilistic power flow and inspect bus voltage percentile bands.

## Steps
1. Build an OpenDSS-ready feeder with loads (for Gaussian M1, assign yearly loadshapes where OpenDSS requires them).
2. Simulate → OpenDSS Load Flow.
3. Set **Solution Mode** to `M1` (per-load random multipliers), `M2` (random LoadMult over daily), or `M3` (random LoadMult at a given hour).
4. Set **Number** of samples (e.g. 100) and **Random** = Uniform or Gaussian.
5. Calculate — the Monte Carlo results dialog shows bus V min/mean/max/percentiles and line loading stats.

## Notes
- Control Mode may still apply if InvControl / RegControl / CapControl are present; prefer Static for pure load-uncertainty screening unless you intend to co-simulate controls.
- Snapshot / Daily / Yearly modes are unchanged for deterministic studies.
