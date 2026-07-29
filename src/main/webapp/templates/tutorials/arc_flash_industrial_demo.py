# -*- coding: utf-8 -*-
"""
Electrisim pandapower import — industrial plant Arc Flash (IEEE 1584) demo.

Small radial network designed to showcase Simulate → Arc Flash (IEEE 1584):

    Utility_20kV ── Line ── Plant_HV_20kV ── Trafo 0.63 MVA 20/0.4 kV
                                                    │
                                              MainSWG_0.4kV
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     │                              │                              │
               MCC_Near_0.4                   MCC_Mid_0.4                  Panel_Far_0.4
               (~20 m cable)                  (~60 m cable)                (~150 m cable)
               higher IE                      medium IE                    lower IE

What you should see after Arc Flash:
- 20 kV buses → Ralph Lee method (outside IEEE 1584 voltage range), flagged on results.
- 0.4 kV buses → IEEE 1584-2018; incident energy falls as cable length increases
  (bolted fault current drops along the feeder).

Suggested Arc Flash dialog defaults for this model:
- Electrode configuration: VCB (typical MCC / switchgear)
- Working distance: 455 mm (LV)
- Conductor gap: 25 mm
- Enclosure: 508 × 508 × 508 mm
- Clearing time: 0.20 s (try 0.05 s vs 0.50 s to show PPE category change)

Import: File → Import in Electrisim and select this ``.py`` file
(POST contents to ``/import-pandapower``).

Electrisim runs this script with ``pandapower`` available as ``pp``.
You MUST leave a variable named ``net`` in scope.
"""

import pandapower as pp

# --- Network (variable ``net`` is required for Electrisim import) ---
net = pp.create_empty_network(name="arc_flash_industrial_demo", f_hz=50, sn_mva=10)

# --- Buses (geodata: x rightward, y downward — readable on canvas) ---
b_grid = pp.create_bus(net, vn_kv=20.0, name="Utility_20kV", geodata=(0.0, 0.0))
b_hv = pp.create_bus(net, vn_kv=20.0, name="Plant_HV_20kV", geodata=(0.0, -2.0))
b_msb = pp.create_bus(net, vn_kv=0.4, name="MainSWG_0.4kV", geodata=(0.0, -5.0))
b_mcc_near = pp.create_bus(net, vn_kv=0.4, name="MCC_Near_0.4kV", geodata=(-4.0, -8.0))
b_mcc_mid = pp.create_bus(net, vn_kv=0.4, name="MCC_Mid_0.4kV", geodata=(0.0, -8.0))
b_panel_far = pp.create_bus(net, vn_kv=0.4, name="Panel_Far_0.4kV", geodata=(4.0, -8.0))

# --- Utility (strong industrial infeed — SC params required for short-circuit / arc flash) ---
pp.create_ext_grid(
    net,
    bus=b_grid,
    vm_pu=1.0,
    va_degree=0.0,
    s_sc_max_mva=500.0,
    s_sc_min_mva=250.0,
    rx_max=0.1,
    rx_min=0.1,
    name="Utility_Grid",
)

# --- 20 kV plant connection ---
pp.create_line_from_parameters(
    net,
    from_bus=b_grid,
    to_bus=b_hv,
    length_km=0.5,
    r_ohm_per_km=0.206,
    x_ohm_per_km=0.120,
    c_nf_per_km=240.0,
    max_i_ka=0.35,
    name="Line_Utility_to_Plant_20kV",
)

# --- Main distribution transformer ---
pp.create_transformer(
    net,
    hv_bus=b_hv,
    lv_bus=b_msb,
    std_type="0.63 MVA 20/0.4 kV",
    name="Trafo_Main_0.63MVA_20_0.4",
    tap_pos=0,
)

# --- LV feeders (NAYY-style; length drives Ikss / IE contrast) ---
# Near MCC: ~20 m — highest LV fault current / incident energy
pp.create_line(
    net,
    from_bus=b_msb,
    to_bus=b_mcc_near,
    length_km=0.02,
    std_type="NAYY 4x150 SE",
    name="Cable_to_MCC_Near_20m",
)

# Mid MCC: ~60 m
pp.create_line(
    net,
    from_bus=b_msb,
    to_bus=b_mcc_mid,
    length_km=0.06,
    std_type="NAYY 4x120 SE",
    name="Cable_to_MCC_Mid_60m",
)

# Remote panel: ~150 m — lowest LV fault current / incident energy
pp.create_line(
    net,
    from_bus=b_msb,
    to_bus=b_panel_far,
    length_km=0.15,
    std_type="NAYY 4x50 SE",
    name="Cable_to_Panel_Far_150m",
)

# Thermal limit for SC / thermal current studies (if used elsewhere)
if "endtemp_degree" not in net.line.columns:
    net.line["endtemp_degree"] = 250.0
else:
    net.line["endtemp_degree"] = net.line["endtemp_degree"].fillna(250.0)

# --- Loads (steady-state plant demand; arc flash uses SC, not load flow) ---
pp.create_load(net, bus=b_mcc_near, p_mw=0.12, q_mvar=0.04, name="Load_MCC_Near")
pp.create_load(net, bus=b_mcc_mid, p_mw=0.08, q_mvar=0.03, name="Load_MCC_Mid")
pp.create_load(net, bus=b_panel_far, p_mw=0.04, q_mvar=0.015, name="Load_Panel_Far")
pp.create_load(net, bus=b_msb, p_mw=0.03, q_mvar=0.01, name="Load_MainSWG_Aux")

if __name__ == "__main__":
    print("Arc Flash industrial demo — buses:", list(net.bus.name))
    print("Lines:", list(net.line.name))
    print("Trafos:", list(net.trafo.name))

    try:
        pp.runpp(net)
        print("runpp OK — bus voltages [pu]:")
        print(net.res_bus.vm_pu.round(4).to_string())
    except Exception as exc:
        print("runpp skipped/failed (topology still valid for import):", exc)

    try:
        import pandapower.shortcircuit as sc

        sc.calc_sc(net, fault="3ph", case="max")
        print("\n3ph max Ikss [kA]:")
        for idx, row in net.bus.iterrows():
            ik = float(net.res_bus_sc.at[idx, "ikss_ka"])
            print(f"  {row['name']:20s}  V={row['vn_kv']:5.1f} kV  Ikss={ik:8.3f} kA")
    except Exception as exc:
        print("calc_sc skipped/failed:", exc)

    try:
        import sys
        from pathlib import Path

        # Optional local check of Electrisim arc-flash module (same folder parent)
        backend_root = Path(__file__).resolve().parents[1]
        if str(backend_root) not in sys.path:
            sys.path.insert(0, str(backend_root))
        import arcflash_electrisim
        import json

        payload = json.loads(
            arcflash_electrisim.arcflash(
                net,
                {
                    "electrode_config": "VCB",
                    "working_distance_mm": 455,
                    "conductor_gap_mm": 25,
                    "enclosure_height_mm": 508,
                    "enclosure_width_mm": 508,
                    "enclosure_depth_mm": 508,
                    "clearing_time_s": 0.2,
                    "clearing_time_min_s": 0.2,
                },
            )
        )
        print("\nArc flash preview (VCB, 455 mm, 0.2 s):")
        for row in payload.get("arc_flash", []):
            print(
                f"  {row.get('name'):20s}  IE={row.get('incident_energy_cal_cm2')} cal/cm2  "
                f"AFB={row.get('arc_flash_boundary_mm')} mm  PPE={row.get('ppe_category')}  "
                f"method={row.get('method')}"
            )
        if payload.get("warnings"):
            print("Warnings:", *payload["warnings"], sep="\n  ")
    except Exception as exc:
        print("arcflash preview skipped:", exc)
