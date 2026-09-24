# IEEE 300-bus transmission benchmark

Public **IEEE 300-bus** system from pandapower (`case300`, MATPOWER/PYPOWER origin). Use it for load flow, contingency, and screening on a **realistic transmission size** without a utility CEII model.

This case is **not** MMWG, WECC, ERCOT, or ISO. For interconnect work on official planning bases, import a pandapower `.py` or OpenDSS `.dss` supplied by the utility.

## Open the model

1. **File → Import from → Device…**
2. Select [`ieee300.py`](ieee300.py)
3. Choose **Vertical** layout (recommended) or **Horizontal**.

The import spreads buses so neighboring busbars do not sit on top of each other. The diagram is still large: pan and zoom, then run **Load Flow** to confirm convergence. Re-import this file if an older import still looks like one solid band.

## Typical studies

| Study | Notes |
|--------|--------|
| Load Flow | Base case should converge as shipped |
| Contingency Analysis | N-1 on lines, transformers, generators |
| Data Center Site Screening | Add one or more **Load** elements at candidate POI buses first |
| Short Circuit | Pandapower tab — IEC 60909 or ANSI/IEEE C37 (beta) |

## Data center pocket vs IEEE 300

| | [Data center pocket](data_center_interconnection_pocket.py) | IEEE 300-bus |
|--|--|--|
| Size | 3 buses, tutorial POI | ~300 buses |
| Purpose | End-to-end DC interconnect workflow demo | Large transmission benchmark |
| On-site gen/BESS | Preconfigured | Add manually if needed |

Documentation: [Data center interconnection workflow](https://electrisim.com/documentation.html#data-center-site-screening)
