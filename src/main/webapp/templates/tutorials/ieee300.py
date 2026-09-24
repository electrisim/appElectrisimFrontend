# -*- coding: utf-8 -*-
"""
Electrisim pandapower import — IEEE 300-bus test case (public MATPOWER/PYPOWER data).

This is the standard ``pandapower.networks.case300()`` transmission benchmark (~300 buses).
It is **not** an MMWG, WECC, ERCOT, or ISO planning base case; use your utility's pandapower
``.py`` or OpenDSS ``.dss`` for interconnect studies on real models.

Import: File → Import from → Device… and select this file.
Choose **Vertical** or **Horizontal** layout when prompted (bus coordinates come from the case).

Reference: https://pandapower.readthedocs.io/en/latest/networks/power_system_test_cases.html#case-300

Suggested studies: Load Flow, Contingency Analysis, Data Center Site Screening (after adding
candidate POI loads), Short Circuit (IEC 60909 or ANSI/IEEE C37 beta).

Companion guide: ``ieee300.md``
"""

import pandapower as pp
from pandapower.networks import case300

net = case300()

# case300 ships with bus ``geo`` for canvas layout. Only call create_generic_coordinates when
# igraph is present — otherwise pandapower clears geo and then raises ImportError.
try:
    import igraph  # noqa: F401
    from pandapower.plotting import create_generic_coordinates

    create_generic_coordinates(net, respect_switches=True, overwrite=True)
except ImportError:
    pass

pp.set_user_pf_options(
    net,
    init_vm_pu="flat",
    calculate_voltage_angles=True,
)
