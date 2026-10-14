# Video script — Short-circuit comparison, Electrisim and PowerFactory

**Model:** File → New → **onshore wind farm short circuit** (publish this diagram as that template before you record)  
**Study:** Simulate → Short Circuit → Pandapower → **IEC 60909**, maximum, all busbars, voltage factor **c = 1.10**  
**Slides (HTML):** [`clipchamp/sc_powerfactory_comparison_intro.html`](clipchamp/sc_powerfactory_comparison_intro.html)  
**Slides (PNG, 1920×1080):** `clipchamp/sc_powerfactory_comparison_01_title.png`, `clipchamp/sc_powerfactory_comparison_02_agenda.png`  
**Target length:** ~6–8 minutes  
**Tone:** side-by-side result check on one wind-farm diagram. Distinct from the **33 MW short-circuit** video (that one is IEC versus OpenDSS on a different template).

**Clipchamp text to speech:** paste [`SHORT_CIRCUIT_POWERFACTORY_CLIPCHAMP.txt`](SHORT_CIRCUIT_POWERFACTORY_CLIPCHAMP.txt). Spoken words only. Do not paste this markdown file into text to speech.

Electrisim currents are the 14 October exports with turbine negative-sequence reactance **x2 = 1 pu** (three-phase `13-42-31`, two-phase `13-42-06`, single-phase `13-42-14`). Speech rounds them to two decimal places. Do not quote peak current.

Do not put a PowerFactory logo or PowerFactory screenshots on the title and agenda slides. You may show PowerFactory result tables on your own recording if you already have them.

---

## Clipchamp — import the PNG slides

| Slide | File | Duration |
|-------|------|----------|
| 1 Title | [`clipchamp/sc_powerfactory_comparison_01_title.png`](clipchamp/sc_powerfactory_comparison_01_title.png) | 6–8 s |
| 2 Agenda | [`clipchamp/sc_powerfactory_comparison_02_agenda.png`](clipchamp/sc_powerfactory_comparison_02_agenda.png) | 8–10 s |

---

## Suggested timeline

| Time | Visual | Audio |
|------|--------|--------|
| 0:00–0:15 | **Slide 1 — Title** | Hook: same IEC study, initial current only |
| 0:15–0:32 | **Slide 2 — Agenda** | Six steps |
| 0:32–1:20 | Electrisim — open the template | File → New |
| 1:20–2:40 | Electrisim — walk the diagram | PoC, 40 MVA, 20 kV, seven turbines, capacitor out |
| 2:40–3:20 | Wind turbine Short Circuit tab | 20 kV reference, the three initial currents, x2 = 1 |
| 3:20–4:30 | Three-phase run and five result boxes | Table below |
| 4:30–5:40 | Two-phase run | Buses, then transformer and Cable Grid |
| 5:40–6:50 | Single-phase run | Same five places, plus wind infeed |
| 6:50–7:10 | Freeze on the diagram | Close — electrisim.com |

---

## Numbers to read (PowerFactory, then Electrisim)

### Three-phase

| Location | PowerFactory | Electrisim |
|----------|-------------:|-----------:|
| Bus PoC, 110 kV | 5.36 | 5.36 |
| Busbar 20 kV substation | 6.75 | 6.75 |
| Wind-farm busbar | 6.65 | 6.65 |
| 40 MVA into the 20 kV bus | 6.14 | 6.14 |
| Cable Grid | 6.04 | 6.04 |

### Two-phase (phases B and C)

| Location | PowerFactory | Electrisim |
|----------|-------------:|-----------:|
| Bus PoC, 110 kV | 4.64 | 4.64 |
| Busbar 20 kV substation | 5.85 | 5.86 |
| Wind-farm busbar | 5.76 | 5.77 |
| 40 MVA into the 20 kV bus | 5.32 | 5.54 |
| Cable Grid | 5.23 | 5.46 |

### Single-phase to ground (phase A)

| Location | PowerFactory | Electrisim |
|----------|-------------:|-----------:|
| Bus PoC, 110 kV | 5.34 | 5.39 |
| Busbar 20 kV substation | 10.13 | 10.23 |
| Wind-farm busbar | 9.88 | 10.03 |
| 40 MVA into the 20 kV bus | 9.52 | 9.60 |
| Cable Grid | 9.27 | 9.40 |
| Wind farm into the 20 kV bus | 0.61 | 0.63 |

Point at the **bus** result box for Bus PoC. Do not split that box into a grid share and a return from the 20 kV side.

---

## Recording checklist

- [ ] Import the two PNGs
- [ ] Template is published as **onshore wind farm short circuit**, or change that one sentence in the text-to-speech file to the title you actually ship
- [ ] Capacitor out of service
- [ ] Every turbine: reference voltage **20 kV**, initial current **0.0866 / 0.0433 / 0.0866 kA**, **x2 = 1 pu**
- [ ] Three runs: three-phase, two-phase, single-phase to ground. Maximum. All busbars. Clearing time 1 second
- [ ] Read initial current only. Do not read peak current
- [ ] Quote the live boxes if they differ from the table; the table is the 14 October export
- [ ] No PowerFactory logo on the Electrisim slides
- [ ] This is not the 33 MW / 30 kV / OpenDSS tutorial

## Model card

| Item | Value |
|------|--------|
| Point of connection | Bus PoC, 110 kV |
| External grid | 1000 MVA, R/X = 0.1, X0/X = 1, R0/X0 = 0.1 |
| Main transformer | 40 MVA, 110/20 kV, Dyn, uk = 17.2% |
| Collector | 20 kV substation, Cable Grid, wind-farm busbar |
| Turbines | 7 × about 2.5 MW, fully rated converters, unit transformers to 0.69 kV |
| Turbine initial current | 0.0866 kA three-phase, 0.0433 kA two-phase, 0.0866 kA single-phase, at 20 kV |
| Negative sequence | x2 = 1 pu, r2 = 0 |
| Capacitor | Out of service |
