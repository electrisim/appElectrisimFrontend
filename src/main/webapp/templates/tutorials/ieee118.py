# -*- coding: utf-8 -*-
"""
Electrisim pandapower import — IEEE 118-bus test case (public MATPOWER/PYPOWER data).

This is the standard ``pandapower.networks.case118()`` transmission benchmark (118 buses).
It is **not** an MMWG, WECC, ERCOT, or ISO planning base case; use your utility's pandapower
``.py`` or OpenDSS ``.dss`` for interconnect studies on real models.

Import: File → Import from → Device… and select this file.
Choose **Vertical** layout when prompted.

Reference: https://pandapower.readthedocs.io/en/latest/networks/power_system_test_cases.html#case-118
Washington / Illinois notes: https://icseg.iti.illinois.edu/ieee-118-bus-system/

Suggested studies: Load Flow, Contingency Analysis, Data Center Site Screening (after adding
candidate POI loads), Short Circuit (IEC 60909 or ANSI/IEEE C37 beta).

Companion guide: ``ieee118.md``
"""

import pandapower as pp
from pandapower.networks import case118

net = case118()

# case118 may ship with bus ``geo``. Only call create_generic_coordinates when igraph is
# present — otherwise pandapower clears geo and then raises ImportError.
try:
    import igraph  # noqa: F401
    from pandapower.plotting import create_generic_coordinates

    missing = True
    if "geo" in net.bus.columns:
        missing = net.bus.geo.isna().any()
    if missing:
        create_generic_coordinates(net, respect_switches=True, overwrite=False)
except ImportError:
    pass

pp.set_user_pf_options(
    net,
    init_vm_pu="flat",
    calculate_voltage_angles=True,
)
