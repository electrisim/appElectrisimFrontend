# BESS Preliminary Design (utility-scale HV POC)

This tutorial walks through the **Simulate → BESS Studies → BESS Preliminary Design** workflow.

## Steps

1. Open a blank diagram or the template **Utility-scale BESS (HV POC)** (a two-string HV plant).
2. Run **BESS Preliminary Design** and enter:
   - POC active/reactive power (or power factor)
   - HV and MV voltages, PCS count and ratings
   - Optional: tick **Use PCS P–Q capability curve** to constrain Q from the Storage curve instead of a circular MVA rating
   - POC transformer OLTC range
   - MV cable and string transformer data
   - Auxiliary load on the MV bus
3. Click **Generate / Update SLD** to build or resize:
   `Grid → POC (HV) → HV/MV transformer → MV bus → N× (cable → MV/LV trafo → Storage)`
4. Click **Run Study** to execute:
   - Requested vs achieved P/Q at the POC (aux and losses included)
   - Named load-flow cases at Umin, Unom, Umax (discharge, charge, Qmax)
   - Per-bus voltage profile and rating / loading verification (including PCS nameplate)
   - P/Q capability envelope at the POC with the limiting element at each point
   - Tap-position sweep: internal voltages and available Qmax/Qmin
5. Review results and export a PDF summary.

## Notes

- PCS is modeled as the **Storage** element (`sn_mva` + optional Q capability curve).
- Storage sign: `p_mw > 0` = charge, `p_mw < 0` = discharge (Electrisim / pandapower).
- POC results are **export-positive**: P > 0 delivers into the grid, Q > 0 is capacitive.
- Re-run the study after editing any diagram parameter without regenerating the SLD.
- The template is tagged with `bessPlantRole`, so the wizard updates it instead of duplicating it.
