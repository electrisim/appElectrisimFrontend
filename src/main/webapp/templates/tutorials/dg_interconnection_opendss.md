# Tutorial: DG Interconnection Screening (OpenDSS)

## Goal
Screen a proposed PV (or Storage) interconnection for voltage rise and thermal limits, compare Volt-VAR mitigation, and estimate hosting capacity.

## Steps
1. Build a weak radial feeder in Electrisim (External Grid → Line → Bus → Load; add **PVSystem** at the POC bus).
2. Set PVSystem → **Inverter Control** to `NONE` for the baseline (or leave as-is; the study disables InvControl for the baseline run).
3. Simulate → **DG Interconnection Screening (OpenDSS)**.
4. Select the POC bus and PVSystem, set proposed kW (e.g. 500–2000), enable **hosting-capacity search** and **Volt-VAR compare**.
5. Interpret results:
   - Baseline fail on `voltage_max` with InvControl off is expected on weak feeders.
   - With Volt-VAR, overall may pass or improve.
   - Hosting capacity kW is the largest size that still passes limits (with InvControl if it helped).

## Tips
- For Q-V droop on Storage or PV outside this study, set InvControl modes and run OpenDSS Load Flow with **Control Mode = Time**.
- Use **RegControl** / **CapControl** from the OpenDSS Controls palette as feeder mitigations.
- Cross-check reactive capability with pandapower **Grid Code Compliance (P-Q & U-Q)**.
