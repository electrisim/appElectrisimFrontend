# Tutorial: ANDES IBR / Wind Dynamics

## Goal
Attach WECC-style renewable dynamics (REGCA1 + REECA1 + REPCA1) or a wind plant chain to a Static Generator and run Transient Stability.

## Steps
1. Place Bus, External Grid (or sync Generator), Line/Transformer, Load, and a **Static Generator** at the renewable POC.
2. Open Static Generator → **Dynamics**:
   - Plant kind: `IBR` (generic) or `Wind` (adds WTDTA1 / WTARA1 / WTPTA1 / WTTQA1), or `PVD1` / `ESD1` for distributed models.
3. Optionally expand a synchronous Generator → Dynamics with EXST1 / IEEEG1 / IEEEST for a mixed sync+IBR case.
4. Simulate → **Transient Stability (ANDES)** — apply a bus fault or line toggle.
5. Review voltage / frequency / renewable P–Q trajectories in the results dialog.

## Notes
- Empty numeric dynamics fields use backend textbook defaults (`defaults_applied` in results).
- External-Grid-only networks still cannot run TDS/EIG; you need at least one SynGen or renewable dynamic plant.
