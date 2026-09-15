# BESS Preliminary Design (utility-scale HV POC)

This tutorial walks through the **Simulate → BESS Studies → BESS Preliminary Design** workflow.

## Steps

1. Open a blank diagram or the template **Utility-scale BESS (HV POC)**.
2. Run **BESS Preliminary Design** and enter:
   - POC active power Pn and grid-code power factor (Q = Pn × tan(acos(PF)); tick **Specify Q directly** only if you have a Q in Mvar)
   - HV and MV voltages, PCS count and ratings, Battery DC Pmax (tighter AC Storage P cap; shown as a DC rack on the SLD)
   - Optional: **Use PCS P–Q capability curve**
   - Optional: three-winding MV skid (2 or 4 inverters per 690 V winding)
   - POC transformer OLTC range, MV cables, auxiliary load
3. Click **Generate / Update SLD**. The wizard hides so you can inspect:
   `Grid → POC (HV) → HV/MV transformer → MV bus → N× (cable → MV/LV trafo → PCS inverter → DC bus → Battery)`
4. Click **Run Study** (progress log while it runs).
5. In results:
   - Click a **case name** to fill SLD result boxes (default Unom_Export_Capacitive)
   - Click a **limiting element** to select it on the canvas (results window minimizes)
   - **Export PDF Summary** minimizes the results window, then opens the report dialog
6. Wizard inputs are kept in the browser and on the POC bus for the next run.

## Notes

- PCS is modelled as the **Storage** element (`sn_mva` + optional Q capability curve). The SLD uses an inverter symbol for that element (AC above, DC below); the battery rack is a separate Source DC on the DC bus.
- Storage sign: `p_mw > 0` = charge, `p_mw < 0` = discharge.
- POC results are **export-positive**: P > 0 delivers into the grid, Q > 0 is capacitive.
- Named-case P setpoints are capped at the Pn you entered.
- Battery DC Pmax tightens the AC Storage P limit and is checked in the rating table. The SLD shows a PCS inverter, DC bus, and battery rack per string; the AC load-flow does not solve a coupled DC network.
- Re-run after editing diagram parameters without regenerating the SLD unless topology changed.
