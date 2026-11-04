🎥 New tutorial: Grid Code Compliance (P-Q and U-Q) of a 450 MW offshore wind farm — in the browser, open source

Is your offshore wind farm grid-code compliant at the point of connection — across the whole active-power range and at every grid voltage?

In this video I take the 450 MW offshore wind farm model in Electrisim (30 × 15 MW turbines, 66 / 275 / 400 kV, STATCOM ±200 Mvar, fixed and variable shunt reactors) and run both studies at the 400 kV POC:

🔹 P-Q capability — net P and Q at the POC after cable and transformer losses, against the ENTSO-E RfG PPM inner envelope at 0.90–1.05 pu
🔹 U-Q/Pmax capability — plant held at Pmax while the grid voltage is swept from 0.90 to 1.10 pu

What you will see:
✅ How the controllers share the work without fighting each other: transformer tap changer, reactor control on export-cable power, Park Controller (constant Q at 275 kV offshore) and the new Plant Supervisory Controller making the final Q(P) correction at the POC with the STATCOM and stepped reactors
✅ Red vs blue: when is the plant compliant, and why Pmax at the POC is below 450 MW
✅ Element Q: what each device group contributes on the capacitive and inductive edge
✅ Check overloads: every line and transformer above its limit in every analysed case — without re-running the study
✅ One click from any point on the chart to that load flow on the single-line diagram
✅ Report-ready charts with Copy image / Save image

💡 One lesson from the study: on the capacitive edge the supervisory controller switches its reactors to the lowest-absorbing step. If a reactor in your plant cannot really be switched off, leave it out of the controller — otherwise the capacitive capability looks larger than it is.

This video continues my newsletter on making the same 450 MW plant compliant with STATCOMs, wind turbines, shunt reactors and transformers — this time including the U-Q characteristic.

▶️ Watch the video: [VIDEO LINK]
📥 Free model: https://electrisim.com/model-offshorewind
📖 Documentation: https://electrisim.com/docs-grid-code
🌐 Try it in the browser: https://electrisim.com

#PowerSystems #GridCode #OffshoreWind #ReactivePower #STATCOM #ENTSOE #RenewableEnergy #PowerSystemAnalysis #pandapower #OpenSource #Electrisim
