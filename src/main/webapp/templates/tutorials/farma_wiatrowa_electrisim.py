# -*- coding: utf-8 -*-
"""
Electrisim pandapower import — onshore wind farm "Farma wiatrowa" (15 MW).

Source: PowerFactory / Excel export tabs Line Type, Line Connections, Trafo,
Trafo Type, and Turbine. External Grid and Capacitor bank tabs were not in the
provided export; those elements use typical 20 kV PoC defaults (adjust in-app).

Topology (20 kV MV collector, two radial feeders, six WTGs @ 2.5 MW)::

    External_Grid @ Busbar PoC
         |
    Cable Grid (400 mm²)
         |
      Busbar ---- Trf Capacitor Bank ---- LV Cap (shunt compensation)
         |
         +--- Cable 1.1 --- MV 1.1 --- Trf 1.1 --- LV 1.1 --- WTG 1.1
         |                      |
         |                 Cable 1.2 --- MV 1.2 --- Trf 1.2 --- LV 1.2 --- WTG 1.2
         |
         +--- Cable 2.1 --- MV 2.1 --- Trf 2.1 --- LV 2.1 --- WTG 2.1
                              |
                         Cable 2.2 --- MV 2.2 --- Trf 2.2 --- LV 2.2 --- WTG 2.2
                              |
                         Cable 2.3 --- MV 2.3 --- Trf 2.3 --- LV 2.3 --- WTG 2.3
                              |
                         Cable 2.4 --- MV 2.4 --- Trf 2.4 --- LV 2.4 --- WTG 2.4

Import: File → Import in Electrisim and select this ``.py`` file.
Electrisim executes the script with ``pandapower`` available as ``pp``.
You MUST leave a variable named ``net`` in scope.
"""

import math

import pandapower as pp

# --- Network ---
net = pp.create_empty_network(name="farma_wiatrowa", f_hz=50, sn_mva=100)

# --- Custom cable standard types (Line Type tab) ---
_STD_400RM = "NA2XS(F)2Y 1x400RM 12/20kV ir"
_STD_150RM = "NA2XS(F)2Y 1x150RM 12/20kV it"

pp.create_std_type(
    net,
    {
        "r_ohm_per_km": 0.102,
        "x_ohm_per_km": 0.1671327,
        "c_nf_per_km": 368.0,  # 0.368 uF/km
        "max_i_ka": 0.565,
    },
    name=_STD_400RM,
    element="line",
)
pp.create_std_type(
    net,
    {
        "r_ohm_per_km": 0.211,
        "x_ohm_per_km": 0.122208,
        "c_nf_per_km": 254.0,  # 0.254 uF/km
        "max_i_ka": 0.32,
    },
    name=_STD_150RM,
    element="line",
)

pp.set_user_pf_options(
    net,
    init_vm_pu="flat",
    init_va_degree="dc",
    calculate_voltage_angles=True,
)

# --- Buses ---
b_poc = pp.create_bus(net, vn_kv=20.0, name="Busbar PoC")
b_mv = pp.create_bus(net, vn_kv=20.0, name="Busbar")
b_mv_11 = pp.create_bus(net, vn_kv=20.0, name="MV 1.1")
b_mv_12 = pp.create_bus(net, vn_kv=20.0, name="MV 1.2")
b_mv_21 = pp.create_bus(net, vn_kv=20.0, name="MV 2.1")
b_mv_22 = pp.create_bus(net, vn_kv=20.0, name="MV 2.2")
b_mv_23 = pp.create_bus(net, vn_kv=20.0, name="MV 2.3")
b_mv_24 = pp.create_bus(net, vn_kv=20.0, name="MV 2.4")
b_lv_cap = pp.create_bus(net, vn_kv=0.4, name="LV Cap")

_lv_buses = {}
for feeder, idx in ((1, 1), (1, 2), (2, 1), (2, 2), (2, 3), (2, 4)):
    _lv_buses[(feeder, idx)] = pp.create_bus(
        net, vn_kv=0.69, name=f"LV {feeder}.{idx}"
    )

# --- External grid (Busbar PoC — typical slack; adjust SC data in Electrisim) ---
pp.create_ext_grid(
    net,
    bus=b_poc,
    vm_pu=1.0,
    va_degree=0.0,
    s_sc_max_mva=1000.0,
    s_sc_min_mva=500.0,
    rx_max=0.1,
    rx_min=0.1,
    name="External Grid",
)

# --- MV cables (Line Connections tab) ---
_LINES = [
    ("Cable Grid", _STD_400RM, b_poc, b_mv, 0.2),
    ("Cable 1.1", _STD_150RM, b_mv, b_mv_11, 2.0),
    ("Cable 1.2", _STD_150RM, b_mv_11, b_mv_12, 0.8),
    ("Cable 2.1", _STD_150RM, b_mv, b_mv_21, 3.0),
    ("Cable 2.2", _STD_150RM, b_mv_21, b_mv_22, 1.1),
    ("Cable 2.3", _STD_150RM, b_mv_22, b_mv_23, 1.1),
    ("Cable 2.4", _STD_150RM, b_mv_23, b_mv_24, 1.5),
]
for name, std_type, from_bus, to_bus, length_km in _LINES:
    pp.create_line(
        net,
        from_bus=from_bus,
        to_bus=to_bus,
        length_km=length_km,
        std_type=std_type,
        name=name,
    )

# --- Transformer parameters (Trafo Type tab) ---
_TRAFO_COMMON = dict(
    sn_mva=2.8,
    vn_hv_kv=20.0,
    vk_percent=6.0,
    vkr_percent=0.7142857,
    pfe_kw=10.0,
    i0_percent=0.8,
    shift_degree=150.0,  # Dyn5, Ph.Shift * 30 deg = 5
    vector_group="Dyn5",
    tap_neutral=0,
    tap_min=-2,
    tap_max=2,
    tap_step_percent=2.5,
    tap_pos=0,
)

_WT_TRAFOS = [
    ("Trf 1.1", b_mv_11, (1, 1)),
    ("Trf 1.2", b_mv_12, (1, 2)),
    ("Trf 2.1", b_mv_21, (2, 1)),
    ("Trf 2.2", b_mv_22, (2, 2)),
    ("Trf 2.3", b_mv_23, (2, 3)),
    ("Trf 2.4", b_mv_24, (2, 4)),
]
for name, hv_bus, lv_key in _WT_TRAFOS:
    pp.create_transformer_from_parameters(
        net,
        hv_bus=hv_bus,
        lv_bus=_lv_buses[lv_key],
        vn_lv_kv=0.69,
        tap_side="hv",
        name=name,
        **_TRAFO_COMMON,
    )

pp.create_transformer_from_parameters(
    net,
    hv_bus=b_mv,
    lv_bus=b_lv_cap,
    vn_lv_kv=0.4,
    name="Trf Capacitor Bank",
    **_TRAFO_COMMON,
)

# --- Capacitor bank (Capacitor bank tab not provided — placeholder shunt) ---
pp.create_shunt(
    net,
    bus=b_lv_cap,
    q_mvar=-1.0,
    p_mw=0.0,
    vn_kv=0.4,
    name="Capacitor Bank",
)

# --- Wind turbines (Turbine tab: 2.5 MW, 0 Mvar, 2.778 MVA rated) ---
_WTG_P_MW = 2.5
_WTG_SN_MVA = 2.778
_WTG_Q_LIMIT = math.sqrt(max(_WTG_SN_MVA**2 - _WTG_P_MW**2, 0.0))

for feeder in (1, 2):
    for idx in (1, 2) if feeder == 1 else (1, 2, 3, 4):
        sgen_idx = pp.create_sgen(
            net,
            bus=_lv_buses[(feeder, idx)],
            p_mw=_WTG_P_MW,
            q_mvar=0.0,
            sn_mva=_WTG_SN_MVA,
            name=f"WTG {feeder}.{idx}",
            type="WP",
        )
        if "min_q_mvar" in net.sgen.columns:
            net.sgen.at[sgen_idx, "min_q_mvar"] = -_WTG_Q_LIMIT
            net.sgen.at[sgen_idx, "max_q_mvar"] = _WTG_Q_LIMIT

# --- Single-line diagram layout ---
_layout = {
    b_poc: (0, 0),
    b_mv: (2, 0),
    b_lv_cap: (2, -2),
    b_mv_11: (4, 2),
    b_mv_12: (6, 2),
    b_mv_21: (4, -1),
    b_mv_22: (6, -1),
    b_mv_23: (8, -1),
    b_mv_24: (10, -1),
    _lv_buses[(1, 1)]: (6, 3),
    _lv_buses[(1, 2)]: (8, 3),
    _lv_buses[(2, 1)]: (6, -2.5),
    _lv_buses[(2, 2)]: (8, -2.5),
    _lv_buses[(2, 3)]: (10, -2.5),
    _lv_buses[(2, 4)]: (12, -2.5),
}

for bus_idx, (x, y) in _layout.items():
    net.bus.at[bus_idx, "geo"] = {"type": "Point", "coordinates": [float(x), float(y)]}


if __name__ == "__main__":
    print("Buses:", len(net.bus.index))
    print("Lines:", len(net.line.index))
    print("Transformers:", len(net.trafo.index))
    print("Static generators:", len(net.sgen.index))
    print("Total WTG P [MW]:", float(net.sgen.p_mw.sum()))
    try:
        pp.runpp(net, algorithm="nr", calculate_voltage_angles=True)
        print("runpp OK")
        print("  PoC voltage [pu]:", float(net.res_bus.at[b_poc, "vm_pu"]))
        print("  MV busbar voltage [pu]:", float(net.res_bus.at[b_mv, "vm_pu"]))
        print("  Max line loading [%]:", float(net.res_line.loading_percent.max()))
        print("  Max trafo loading [%]:", float(net.res_trafo.loading_percent.max()))
    except Exception as exc:
        print("runpp skipped/failed (topology still valid for import):", exc)
