⚡ Which operating point drives your export cable to its highest current? New in Electrisim: Line current 3D

A grid code P-Q or U-Q study is not one load flow. It is hundreds: every active-power step, every PCC voltage, both edges of the reactive-power capability. The compliance chart tells you whether the plant meets the grid code at the point of connection. It doesn't tell you what those operating points do to the equipment behind it.

Electrisim now reads every load flow the study has already solved and finds the highest current in each line, in zero extra simulation time.

🔹 What you see
• A 3D chart: Q and P at the point of connection on the floor, line current (kA) as the height
• Colour = loading against the line's rating: green well inside it, orange close to it, red above 100 %
• The rated current drawn as a red plane: every point above it is an operating point where the cable is overloaded
• The highest current ringed, dropped to the floor and labelled, and named above the chart with its exact operating point (U, P, Q and which capability curve)
• Click any point to load that exact case onto the single-line diagram
• Also in U-Q studies (PCC voltage on the floor), with filters, full-screen view and CSV export

🔹 What it showed on the offshore wind farm model
The plant passes the P-Q check. But the offshore 275 kV export cable reaches 1.146 kA against a 1.100 kA rating: 104 % loading, at full active power on the inductive edge of the capability. Only a handful of points sit above the red plane. Without plotting the whole study, that operating point is easy to miss.

So compliance at the point of connection is only half of the answer. The other half: can the cables and transformers carry what the grid code asks for, at every operating point?

▶️ Short demo below
🌐 Free and open source, in the browser: https://electrisim.com
📥 Offshore wind farm model: https://electrisim.com/model-offshorewind

#PowerSystems #GridCode #OffshoreWind #ReactivePower #CableRating #LoadFlow #PowerSystemAnalysis #pandapower #OpenSource #Electrisim
