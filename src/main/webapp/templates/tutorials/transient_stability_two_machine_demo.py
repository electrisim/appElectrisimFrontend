# -*- coding: utf-8 -*-
"""
Electrisim pandapower import — Two-machine transient / small-signal stability demo.

Classic teaching network for Simulate → Transient Stability (ANDES) and
Simulate → Eigenvalue Analysis (ANDES):

    Area A                          Area B
    GenA_Slack (BusA_230)           GenB (BusB_230)
         │                               │
      LoadA                           LoadB
         │                               │
         └──────── Tie_Line_AB ──────────┘

Suggested Transient Stability dialog settings for this model:
- Frequency: 60 Hz
- System base: 100 MVA
- tf: 10 s
- Fault bus: BusB_230
- Fault apply / clear: 1.0 s / 1.10 s
- Line outage: (none) — or trip Tie_Line_AB at t=2.0 s as a second scenario

What you should see:
- TDS: GenA and GenB speeds (ω) swing after the fault, then settle if clearing is fast enough
- EIG: eigenvalues in the left half-plane; one poorly damped oscillatory mode from the tie

Import: File → Import in Electrisim and select this ``.py`` file
(POST contents to ``/import-pandapower``).

Electrisim runs this script with ``pandapower`` available as ``pp``.
You MUST leave a variable named ``net`` in scope.

After import, open each Generator → Dynamics tab if you want custom GENROU / EXDC2 / TGOV1
parameters. Empty dynamics fields use Electrisim/ANDES textbook defaults.
"""

import pandapower as pp

# --- Network (variable ``net`` is required for Electrisim import) ---
net = pp.create_empty_network(name="transient_stability_two_machine_demo", f_hz=60, sn_mva=100)

# --- Buses (geodata: x rightward, y downward — readable on canvas) ---
# Area A (left) · Area B (right)
b_a = pp.create_bus(net, vn_kv=230.0, name="BusA_230", geodata=(0.0, 0.0))
b_b = pp.create_bus(net, vn_kv=230.0, name="BusB_230", geodata=(8.0, 0.0))

# --- Generators (synchronous machines → ANDES SynGen when Dynamics/defaults apply) ---
# GenA is the slack; GenB is a PV machine. Net transfer A→B across the weak tie.
pp.create_gen(
    net,
    bus=b_a,
    p_mw=800.0,
    vm_pu=1.03,
    sn_mva=900.0,
    vn_kv=230.0,
    slack=True,
    name="GenA_Slack",
    min_p_mw=0.0,
    max_p_mw=900.0,
)

pp.create_gen(
    net,
    bus=b_b,
    p_mw=700.0,
    vm_pu=1.01,
    sn_mva=900.0,
    vn_kv=230.0,
    slack=False,
    name="GenB",
    min_p_mw=0.0,
    max_p_mw=900.0,
)

# --- Area loads (≈1500 MW total ≈ gen setpoints; slack absorbs losses) ---
pp.create_load(net, bus=b_a, p_mw=400.0, q_mvar=50.0, name="LoadA")
pp.create_load(net, bus=b_b, p_mw=1100.0, q_mvar=100.0, name="LoadB")
# LoadB > GenB → power flows Area A → Area B on Tie_Line_AB (receiving-end fault is stressful).

# --- Weak tie line (long AC corridor) — fault / outage target for TDS ---
# Z roughly 0.01 + j0.10 pu on 100 MVA / 230 kV → Zbase ≈ 529 Ω
# r ≈ 0.01*529/100 km ≈ 0.053 Ω/km, x ≈ 0.53 Ω/km for 100 km
pp.create_line_from_parameters(
    net,
    from_bus=b_a,
    to_bus=b_b,
    length_km=100.0,
    r_ohm_per_km=0.053,
    x_ohm_per_km=0.530,
    c_nf_per_km=8.0,
    max_i_ka=1.5,
    name="Tie_Line_AB",
)

# Optional: verify power flow locally before import
# pp.runpp(net)
# print(net.res_bus)
# print(net.res_line)
