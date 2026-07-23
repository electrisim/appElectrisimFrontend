# -*- coding: utf-8 -*-
"""
Electrisim pandapower import — medium-scale container terminal port infrastructure.

Representative European medium hub container terminal electrical network for PhD /
research case studies (steady-state baseline, ~30–50 MW peak).

Topology (110 kV utility → 20 kV MV → functional zone feeders)::

    Grid_110 ── Term_HV_110 ── MainTrafo (63 MVA 110/20 kV) ── Term_MV_20
         │                              │
         │                              ├── Feed_Quay_20   → Load_STS_Quay
         │                              ├── Feed_Yard_20   → Load_RTG_Yard
         │                              ├── Feed_Reefer_20 → Load_Reefer_Racks
         │                              ├── Feed_Aux_20    → Load_Aux + Load_ColdStorage
         │                              ├── Feed_Shore_20  → Load_ShorePower
         │                              ├── Feed_BESS_20   → BESS_PeakShaving
         │                              └── PV_Rooftop (sgen on Term_MV_20)

Import: File → Import in Electrisim and select this ``.py`` file
(POST contents to ``/import-pandapower`` on the backend).

Electrisim runs this script with ``pandapower`` available as ``pp``.
You MUST leave a variable named ``net`` in scope.

Load aggregation philosophy:
- STS (ship-to-shore) cranes, RTG/RMG yard cranes, reefer racks, shore power,
  and auxiliary loads are modelled as separate zone loads (not individual cranes).
- Use Electrisim Time Series Simulation to attach daily/ hourly profiles later.
- BESS is idle (P=0) in the base case; enable dispatch for OPF / peak-shaving studies.

Companion guide: ``container_terminal_port_infrastructure.md``
"""

import pandapower as pp

# --- Network (variable ``net`` is required for Electrisim import) ---
net = pp.create_empty_network(name="container_terminal_demo", f_hz=50)

pp.set_user_pf_options(
    net,
    init_vm_pu="flat",
    init_va_degree="dc",
    calculate_voltage_angles=True,
)

# --- Buses (9 buses — MV radial from main busbar) ---
b_grid = pp.create_bus(net, vn_kv=110, name="Grid_110")
b_hv = pp.create_bus(net, vn_kv=110, name="Term_HV_110")
b_mv = pp.create_bus(net, vn_kv=20, name="Term_MV_20")
b_quay = pp.create_bus(net, vn_kv=20, name="Feed_Quay_20")
b_yard = pp.create_bus(net, vn_kv=20, name="Feed_Yard_20")
b_reefer = pp.create_bus(net, vn_kv=20, name="Feed_Reefer_20")
b_aux = pp.create_bus(net, vn_kv=20, name="Feed_Aux_20")
b_shore = pp.create_bus(net, vn_kv=20, name="Feed_Shore_20")
b_bess = pp.create_bus(net, vn_kv=20, name="Feed_BESS_20")

# --- External grid (utility connection at 110 kV) ---
pp.create_ext_grid(
    net,
    bus=b_grid,
    vm_pu=1.05,
    va_degree=0.0,
    s_sc_max_mva=2000,
    s_sc_min_mva=1000,
    rx_max=0.1,
    rx_min=0.1,
    name="Utility_Grid_110kV",
)

# --- HV grid connection and main transformer ---
pp.create_line(
    net,
    from_bus=b_grid,
    to_bus=b_hv,
    length_km=5.0,
    std_type="149-AL1/24-ST1A 110.0",
    name="Line_GridConnection_110kV",
)

pp.create_transformer(
    net,
    hv_bus=b_hv,
    lv_bus=b_mv,
    std_type="63 MVA 110/20 kV",
    name="MainTrafo_63MVA_110_20",
)

# --- MV zone feeders (20 kV) ---
_mv_std = "184-AL1/30-ST1A 20.0"
_feeders = [
    (b_mv, b_quay, 0.8, "Line_Feeder_Quay"),
    (b_mv, b_yard, 1.0, "Line_Feeder_Yard"),
    (b_mv, b_reefer, 0.6, "Line_Feeder_Reefer"),
    (b_mv, b_aux, 0.5, "Line_Feeder_Aux"),
    (b_mv, b_shore, 1.2, "Line_Feeder_ShorePower"),
    (b_mv, b_bess, 0.4, "Line_Feeder_BESS"),
]
_line_indices = []
for from_bus, to_bus, length_km, name in _feeders:
    idx = pp.create_line(
        net,
        from_bus=from_bus,
        to_bus=to_bus,
        length_km=length_km,
        std_type=_mv_std,
        name=name,
    )
    _line_indices.append(idx)

# --- MV sectionalizing switches (N-1 / contingency studies) ---
# Switch at MV busbar side of quay, yard, and reefer feeders.
for line_idx, switch_name in zip(
    _line_indices[:3],
    ("Switch_Feeder_Quay", "Switch_Feeder_Yard", "Switch_Feeder_Reefer"),
):
    pp.create_switch(
        net,
        bus=b_mv,
        element=line_idx,
        et="l",
        closed=True,
        type="CB",
        name=switch_name,
    )

# --- Zone loads (aggregated by terminal function) ---
pp.create_load(
    net,
    bus=b_quay,
    p_mw=12.0,
    q_mvar=7.45,
    name="Load_STS_Quay",
    scaling=1.0,
)
pp.create_load(
    net,
    bus=b_yard,
    p_mw=6.0,
    q_mvar=3.72,
    name="Load_RTG_Yard",
    scaling=1.0,
)
pp.create_load(
    net,
    bus=b_reefer,
    p_mw=8.0,
    q_mvar=3.87,
    name="Load_Reefer_Racks",
    scaling=1.0,
)
pp.create_load(
    net,
    bus=b_aux,
    p_mw=2.0,
    q_mvar=0.97,
    name="Load_Aux_Office_HVAC",
    scaling=1.0,
)
pp.create_load(
    net,
    bus=b_aux,
    p_mw=3.0,
    q_mvar=1.55,
    name="Load_ColdStorage",
    scaling=1.0,
)
pp.create_load(
    net,
    bus=b_shore,
    p_mw=6.0,
    q_mvar=1.97,
    name="Load_ShorePower_ColdIroning",
    scaling=1.0,
)

# --- Distributed generation and storage ---
pp.create_sgen(
    net,
    bus=b_mv,
    p_mw=1.0,
    q_mvar=0.0,
    name="PV_Rooftop",
    scaling=1.0,
    type="PV",
)

pp.create_storage(
    net,
    bus=b_bess,
    p_mw=0.0,
    q_mvar=0.0,
    sn_mva=5.0,
    max_e_mwh=10.0,
    min_e_mwh=0.0,
    soc_percent=50.0,
    scaling=1.0,
    name="BESS_PeakShaving",
    max_p_mw=5.0,
    min_p_mw=-5.0,
    max_q_mvar=2.5,
    min_q_mvar=-2.5,
)

# --- Single-line diagram layout (bus index → x, y) ---
_layout = {
    b_grid: (0, 0),
    b_hv: (2, 0),
    b_mv: (4, 0),
    b_quay: (6, -3),
    b_yard: (6, -1),
    b_reefer: (6, 1),
    b_aux: (6, 3),
    b_shore: (8, -2),
    b_bess: (8, 2),
}
for idx, (x, y) in _layout.items():
    net.bus.at[idx, "geo"] = {"type": "Point", "coordinates": [float(x), float(y)]}


if __name__ == "__main__":
    total_p = float(net.load.p_mw.sum())
    print("Buses:", len(net.bus.index))
    print("Loads:", len(net.load.index), "— total P [MW]:", total_p)
    print("Switches:", len(net.switch.index))
    try:
        pp.runpp(net, algorithm="nr", calculate_voltage_angles=True)
        print("runpp OK")
        print("  MV bus voltage [pu]:", float(net.res_bus.at[b_mv, "vm_pu"]))
        print("  Main trafo loading [%]:", float(net.res_trafo.loading_percent.iloc[0]))
        print("  Max line loading [%]:", float(net.res_line.loading_percent.max()))
    except Exception as exc:
        print("runpp skipped/failed (topology still valid for import):", exc)
