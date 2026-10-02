# LinkedIn newsletter — copy pack (Short circuit · 33 MW tutorial)

**Do not paste this .md file into LinkedIn.** Markdown stays as plain text there.

## Easiest way

1. Open [`clipchamp/short_circuit_33mw_linkedin_newsletter.html`](clipchamp/short_circuit_33mw_linkedin_newsletter.html) in Chrome (double-click the file).
2. Copy the **title** from the blue box into LinkedIn’s **title** field.
3. Click **Copy article** → paste into the newsletter **body**.
4. When you publish, click **Copy announcement** for the short promo post.

UTM on links: `utm_campaign=short-circuit-33mw`

---

## Title (LinkedIn title field)

Short-circuit studies on a 33 MW wind farm: IEC 60909, OpenDSS, and vector group

---

## Body (plain-text backup — use the HTML copy button when possible)

Same single-line diagram. Two fault engines. One place to read ikss, ip, and ith.

Fault levels drive breaker ratings, cable sizing, and protection settings. On renewable connections, the interesting questions are not only how many kA at the POC, but which fault type governs the phase conductor versus the cable screen — and whether your transformer vector group lets zero-sequence current through to the collector.

In Electrisim you run short-circuit studies in the browser on the same diagram you use for load flow. The built-in 33 MW onshore wind farm template (ten turbines, 30 kV collectors, 40 MVA 110/30 kV transformer, 110 kV export) is a practical place to compare methods without building a model from scratch.

IEC 60909 (pandapower)

Open Simulate → Short Circuit, choose the Pandapower tab, and tick IEC 60909. A three-phase maximum study on all busbars gives symmetrical current ikss, peak ip, and thermal equivalent ith for your clearing time — typically one second for conductor checks.

IEC fills buses, lines, transformers, and the external grid. That is the path you want for grid-code style studies and IEC-rated equipment.

Which current sizes what?

- Phase conductors: use three-phase ith (adiabatic / I²t, IEC 60949).
- Metallic screens and sheaths: earth-return duty — run single-phase (phase-to-earth). Two-phase-to-earth (Ik2E) is the companion case in IEC practice; the dialog’s Two phase option is phase-to-phase without earth.
- If single-phase ik exceeds three-phase on a solidly earthed bus, check the phase conductor against that earth fault too.

Vector group is not cosmetic

On the main 110/30 kV transformer, change vector group (Dyn, YNd, Yy, …) and angle shift for the clock. Three-phase ikss barely moves — positive sequence dominates. Single-phase ikss changes because grounded star, delta, and neutral paths control zero sequence. Rotating angle shift alone changes current angle, not a shortcut to lower three-phase duty.

OpenDSS FaultStudy on the same diagram

The OpenDSS tab runs a native fault study (50 Hz in Europe). Bus results use the same labels, but the method is not IEC 60909: different voltage factor, different wind-turbine contribution, fixed peak factor, and branch currents only on the IEC path. Treat OpenDSS as a useful Y-bus cross-check — not a substitute for IEC submission figures.

Try it

In the editor: File → New → onshore wind farm 33MW, then Simulate → Short Circuit.

https://app.electrisim.com/?utm_source=linkedin&utm_medium=newsletter&utm_campaign=short-circuit-33mw&utm_content=try_editor

https://electrisim.com/short-circuit-33mw-onshore-wind?utm_source=linkedin&utm_medium=newsletter&utm_campaign=short-circuit-33mw&utm_content=article

https://electrisim.com/pricing?utm_source=linkedin&utm_medium=newsletter&utm_campaign=short-circuit-33mw&utm_content=subscribe

North American projects can tick ANSI/IEEE C37 (beta) on the Pandapower tab — a separate standard from IEC 60909.

---

## Announcement post (when LinkedIn publishes the issue)

New tutorial walkthrough: short-circuit calculations on our 33 MW onshore wind template — IEC 60909 and OpenDSS on one diagram, plus why vector group changes earth-fault current but not three-phase duty.

Try the template: File → New → onshore wind farm 33MW, then Simulate → Short Circuit.

https://app.electrisim.com/?utm_source=linkedin&utm_medium=newsletter&utm_campaign=short-circuit-33mw&utm_content=announce

#PowerSystems #RenewableEnergy #WindPower #ShortCircuit #OpenSource
