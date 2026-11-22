🎥 New tutorial: Will your data centre ride through a grid fault? STATCOM sizing and UPS behaviour — in the browser, open source

When the voltage dips, a data centre's UPS moves the servers to its battery. The grid suddenly loses hundreds of MW — and gets them back only seconds later, when the UPS walks the load back in. Grid operators now ask large loads to ride through: stay connected and get their power back quickly.

In this video I take a 300 MW data centre on a 138 kV utility pocket (new template in Electrisim: File → New → Tutorials → Data centre fault ride-through) and check it in two studies:

🔹 Grid-Forming STATCOM Sizing — the new fault ride-through duty: additional reactive current ΔIq = k·ΔU on the rated current of the data centre, checked against the converter's short-time current. Result: the k-factor requirement for a dip to 0 p.u. needs a 306 MVA converter; the installed ±150 Mvar STATCOM covers dips down to 0.86 p.u.
🔹 Transient Stability (ANDES) — the data centre is an IT part behind a UPS (transfer below 0.85 p.u., return delay, walk-in, hold-up time) plus cooling, and the STATCOM is a converter that injects reactive current in the dip.

What you will see:
✅ A remote fault: with the STATCOM the campus voltage stays at 0.88 p.u. and the UPS stays on the grid — PASS. Without it, the voltage dips to 0.84 p.u., 257 MW go to battery and come back 5.5 s later — FAIL.
✅ A bolted fault at the POI: every UPS transfers (no load draws power at 0 V), so what counts is how fast the power comes back. Default UPS settings: 5.5 s — FAIL. Return delay 0.2 s and walk-in 0.5 s: 0.7 s — PASS.
✅ A clear verdict against the ride-through curve and the power-recovery time, plus the power the data centre draws from the grid, the STATCOM reactive current, and CSV export.

💡 Lesson: inside the ride-through curve a short UPS transfer is unavoidable for close-in faults — the UPS return delay and walk-in decide whether the grid sees a 150 ms dip or a 5-second load loss.

▶️ Watch the video: [VIDEO LINK]
📥 Free template: Electrisim → File → New → Tutorials → Data centre fault ride-through
📖 Documentation: https://electrisim.com/docs-stability#data-centre-ride-through
🌐 Try it in the browser: https://electrisim.com

#PowerSystems #DataCenters #FaultRideThrough #STATCOM #UPS #GridConnection #LargeLoads #PowerSystemAnalysis #ANDES #pandapower #OpenSource #Electrisim
