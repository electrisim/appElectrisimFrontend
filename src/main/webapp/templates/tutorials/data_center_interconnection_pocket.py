# -*- coding: utf-8 -*-
"""
Electrisim pandapower import — utility pocket for data-center interconnection screening.

Topology (138 kV utility → POI → 34.5 kV campus)::

    Utility_138 ── Line_A / Line_B ── POI_138 ── POI_Transformer ── Campus_34.5
                                        │                              │
                                   Remote_Gen                    DataCenter_Load (300 MW default)
                                        │                              ├── Backup_Gen (optional, out for pre-SC)
                                        └── POI_CB (Switch ratings)    └── Campus_BESS (optional)

Import: File → Import from → Device… and select this ``.py`` file.

Suggested studies (Simulate menu):
- Load Flow — base case with DataCenter_Load at 300 MW (scale ``p_mw`` up to 1000 for sizing).
- Data Center Site Screening — compare POI headroom and N-1 / N-1-1 at 300, 500, 1000 MW.
- Short Circuit (ANSI/IEEE C37) — enable pre/post project comparison; project elements:
  DataCenter_Load, Backup_Gen, Campus_BESS.
- Transient Stability (ANDES) — fault at POI_138, optional generator trip on Remote_Gen;
  set POI bus and ride-through on DataCenter_Load (Computational load tab).

Companion guide: ``data_center_interconnection.md``
"""

import math

import pandapower as pp

net = pp.create_empty_network(name="data_center_utility_pocket", f_hz=60, sn_mva=100)

pp.set_user_pf_options(
    net,
    init_vm_pu="flat",
    init_va_degree="dc",
    calculate_voltage_angles=True,
)

# --- Buses (geo x rightward, geo y upward — campus sits under the POI on the canvas) ---
b_util = pp.create_bus(net, vn_kv=138.0, name="Utility_138", geodata=(0.0, 4.0))
b_poi = pp.create_bus(net, vn_kv=138.0, name="POI_138", geodata=(8.0, 4.0))
b_campus = pp.create_bus(net, vn_kv=34.5, name="Campus_34.5", geodata=(8.0, 0.0))

# --- Utility equivalent ---
pp.create_ext_grid(
    net,
    bus=b_util,
    vm_pu=1.02,
    va_degree=0.0,
    s_sc_max_mva=8000,
    s_sc_min_mva=4000,
    rx_max=0.1,
    rx_min=0.1,
    r0x0_max=0.1,
    x0x_max=1.0,
    r0x0_min=0.1,
    x0x_min=1.0,
    name="Utility_Grid",
)

# --- Parallel 138 kV corridors ---
for lname, length_km in (("Line_A", 12.0), ("Line_B", 14.0)):
    pp.create_line_from_parameters(
        net,
        from_bus=b_util,
        to_bus=b_poi,
        length_km=length_km,
        r_ohm_per_km=0.05,
        x_ohm_per_km=0.42,
        c_nf_per_km=12.0,
        max_i_ka=1.8,
        name=lname,
    )

# --- Remote synchronous plant (contingency + dynamics trip target) ---
pp.create_gen(
    net,
    bus=b_poi,
    p_mw=120.0,
    vm_pu=1.01,
    sn_mva=150.0,
    vn_kv=138.0,
    slack=False,
    name="Remote_Gen",
    min_p_mw=0.0,
    max_p_mw=150.0,
    xdss_pu=0.18,
    rdss_pu=0.01,
)

# --- POI step-down (parameters, not a library std_type — 138/34.5 kV is not in pandapower) ---
pp.create_transformer_from_parameters(
    net,
    hv_bus=b_poi,
    lv_bus=b_campus,
    sn_mva=250.0,
    vn_hv_kv=138.0,
    vn_lv_kv=34.5,
    vk_percent=12.0,
    vkr_percent=0.4,
    pfe_kw=80.0,
    i0_percent=0.1,
    shift_degree=30.0,
    name="POI_Transformer",
)

# --- Data-center load at campus (POI-side load block; scale for 300 MW–1 GW studies) ---
pf = 0.95
p_dc = 300.0
q_dc = p_dc * math.tan(math.acos(pf))
pp.create_load(
    net,
    bus=b_campus,
    p_mw=p_dc,
    q_mvar=q_dc,
    name="DataCenter_Load",
    const_z_percent=10.0,
    const_i_percent=5.0,
    scaling=1.0,
)

# --- On-site backup generator (subtransient data for ANSI SC post-project) ---
pp.create_gen(
    net,
    bus=b_campus,
    p_mw=0.0,
    vm_pu=1.0,
    sn_mva=50.0,
    vn_kv=34.5,
    slack=False,
    name="Backup_Gen",
    min_p_mw=0.0,
    max_p_mw=50.0,
    xdss_pu=0.12,
    rdss_pu=0.01,
    in_service=True,
)

# --- Campus BESS (static generator for SC contribution) ---
pp.create_sgen(
    net,
    bus=b_campus,
    p_mw=0.0,
    q_mvar=0.0,
    sn_mva=100.0,
    name="Campus_BESS",
    k=1.0,
    rx=0.1,
    max_ik_ka=2.5,
    in_service=True,
)

# --- POI breaker (ANSI duty check — increase load / add BESS to see margin shrink) ---
pp.create_switch(
    net,
    bus=b_poi,
    element=net.line.index[0],
    et="l",
    closed=True,
    type="CB",
    name="POI_CB_LineA",
    interrupting_rating_ka=40.0,
    momentary_rating_ka=50.0,
)
