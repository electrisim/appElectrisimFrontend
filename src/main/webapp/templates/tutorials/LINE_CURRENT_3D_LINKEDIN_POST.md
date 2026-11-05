⚡ New in Electrisim: see the highest current in every cable across your whole Grid Code P-Q and U-Q study — in 3D

A grid code compliance study runs hundreds of load flows: every active-power step, every PCC voltage, both edges of the reactive-power capability. The P-Q chart tells you whether the plant is compliant. It doesn't tell you which export cable carries the most current, or in which operating point it goes above its rating.

So I added two things to the Grid Code Compliance (P-Q) and (U-Q) results in Electrisim:

🔹 Line current 3D
Pick one or more cables and see their current in every load flow of the study, on a rotatable 3D chart:
• X = Q at the point of connection, Y = P at the point of connection, vertical = PCC voltage (or switch it to loading or current)
• Colour = loading against the cable rating: green well inside it, orange close to it, red only above 100 % — or colour by current in kA
• Each cable's highest current is circled and labelled, with the operating point where it happens
• Click any point to open that exact load flow on the single-line diagram
• Set your own axis ranges, export everything to CSV

🔹 Check overloads
Every line and transformer in every analysed case, with the worst case of each element and how many cases exceed the limit — and a clear summary of what was checked.

Both read the load flows the study has already solved, so they add zero simulation time. Run the study once, then explore.

In the video: the 450 MW offshore wind farm model (30 × 15 MW, 66 / 275 / 400 kV, STATCOM, Park Controller and Plant Supervisory Controller). The P-Q chart says compliant, but the 3D view shows the onshore 275 kV cable reaching about 1.17 kA against a 1.15 kA rating — just above 100 % — at 0.9 pu grid voltage. The offshore 275 kV cable carries even more current (1.20 kA) but stays at 75 % of its higher rating. Current and loading tell different stories, which is exactly why you want to see both.

Compliance at the point of connection is only half of the answer. The other half is whether the equipment behind it can carry what compliance asks for.

▶️ Short demo in the video below
🌐 Try it in the browser, free and open source: https://electrisim.com
📥 Offshore wind farm model: https://electrisim.com/model-offshorewind

#PowerSystems #GridCode #OffshoreWind #ReactivePower #CableRating #LoadFlow #PowerSystemAnalysis #pandapower #OpenSource #Electrisim
