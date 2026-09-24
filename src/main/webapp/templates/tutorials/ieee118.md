# IEEE 118-bus transmission benchmark

Public **IEEE 118-bus** system from pandapower (`case118`, MATPOWER/PYPOWER origin). Use it as a smaller transmission benchmark than IEEE 300 before moving to a larger case.

This case is **not** MMWG, WECC, ERCOT, or ISO. For interconnect work on official planning bases, import a pandapower `.py` or OpenDSS `.dss` supplied by the utility.

## Open the model

1. **File → Import from → Device…**
2. Select [`ieee118.py`](ieee118.py)
3. Choose **Vertical** layout.

Choose **Vertical** so the import follows the case coordinates and the diagram stays two-dimensional instead of one long row. Generators sit above each busbar and loads below. Pan and zoom, then run **Load Flow** to confirm convergence.

## Typical studies

| Study | Notes |
|--------|--------|
| Load Flow | Base case should converge as shipped |
| Contingency Analysis | N-1 on lines, transformers, generators |
| Data Center Site Screening | Add one or more **Load** elements at candidate POI buses first |
| Short Circuit | Pandapower tab — IEC 60909 or ANSI/IEEE C37 (beta) |

Documentation: [Data center interconnection workflow](https://electrisim.com/documentation.html#data-center-site-screening)
