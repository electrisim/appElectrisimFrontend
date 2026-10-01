# -*- coding: utf-8 -*-
"""
Electrisim import — Dickert LV network, middle C&OHL, multiple customers, bad case.

Benchmark low-voltage feeder from J. Dickert, M. Domagk, and P. Schegner, Benchmark low voltage distribution networks based on cluster analysis of actual grid properties, IEEE PowerTech, Grenoble, 2013. Feeder length middle, line type C&OHL, multiple customers, supply case bad. Load powers use Dickert and Schegner's coincidence model (c_inf = 0.1, P_max1 = 10 kW, power factor 0.95 inductive). The transformer is the pandapower default 0.4 MVA 20/0.4 kV type.
https://pandapower.readthedocs.io/en/latest/networks/dickert_lv_networks.html

Import this file with File -> Import from -> Device…
When asked what system you are importing, choose Transmission.
That keeps the bus coordinates stored in this file.

Load flow was checked with the Electrisim defaults: Newton-Raphson,
voltage angles Auto, initialization Auto. It converges.
Run it in the app with Simulate -> Load Flow -> Calculate.
"""
import json
import math
from collections import deque

import pandapower as pp
from pandapower.networks import create_dickert_lv_network

net = create_dickert_lv_network(feeders_range="middle", linetype="C&OHL", customer="multiple", case="bad")


def _xy_from_geo(val):
    if isinstance(val, dict):
        coords = val.get("coordinates")
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            x, y = float(coords[0]), float(coords[1])
            if math.isfinite(x) and math.isfinite(y):
                return x, y
    if isinstance(val, str) and val.strip().startswith("{"):
        try:
            return _xy_from_geo(json.loads(val))
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
    return None


def _link(adj, a, b):
    a, b = int(a), int(b)
    if a in adj and b in adj and a != b:
        adj[a].add(b)
        adj[b].add(a)


def _layered_fill(net, xs, ys):
    """Place buses that have no coordinates as a feeder, starting at the slack."""
    adj = {i: set() for i in net.bus.index}
    if len(net.line):
        ins = net.line.in_service if "in_service" in net.line.columns else [True] * len(net.line)
        for a, b, on in zip(net.line.from_bus, net.line.to_bus, ins):
            if on:
                _link(adj, a, b)
    if hasattr(net, "trafo") and len(net.trafo):
        ins = net.trafo.in_service if "in_service" in net.trafo.columns else [True] * len(net.trafo)
        for a, b, on in zip(net.trafo.hv_bus, net.trafo.lv_bus, ins):
            if on:
                _link(adj, a, b)

    depth = {}
    queue = deque()
    roots = []
    if len(net.ext_grid):
        roots = [int(b) for b in net.ext_grid.bus if int(b) in adj]
    if not roots:
        roots = [int(net.bus.index[0])]
    for root in roots:
        if root not in depth:
            depth[root] = 0
            queue.append(root)
    while queue:
        bus = queue.popleft()
        for other in adj[bus]:
            if other not in depth:
                depth[other] = depth[bus] + 1
                queue.append(other)
    stray = 0
    for idx in net.bus.index:
        key = int(idx)
        if key not in depth:
            depth[key] = stray
            stray += 1

    layers = {}
    for idx, level in depth.items():
        layers.setdefault(level, []).append(idx)
    missing = [idx for idx in net.bus.index if idx not in xs]
    if not missing:
        return
    # A pure line is folded into rows so the diagram stays on one page.
    if max(len(nodes) for nodes in layers.values()) == 1 and len(missing) > 12:
        order = []
        for level in sorted(layers):
            order.extend(layers[level])
        cols = 8
        slot = 0
        for idx in order:
            if idx not in xs:
                xs[idx] = float((slot % cols) * 2.4)
                ys[idx] = float((slot // cols) * 2.2)
                slot += 1
        return
    origin_x = (max(xs.values()) + 3.0) if xs else 0.0
    for level, nodes in layers.items():
        for slot, idx in enumerate(nodes):
            if idx not in xs:
                xs[idx] = origin_x + slot * 2.4
                ys[idx] = float(level) * 2.2


def _prepare_electrisim_net(net):
    xs, ys = {}, {}
    if "geo" in net.bus.columns:
        for idx in net.bus.index:
            xy = _xy_from_geo(net.bus.at[idx, "geo"])
            if xy:
                xs[idx] = xy[0]
                ys[idx] = xy[1]
    if len(xs) < len(net.bus):
        _layered_fill(net, xs, ys)

    seen = {}
    for idx in list(xs):
        key = (round(xs[idx], 4), round(ys[idx], 4))
        dup = seen.get(key, 0)
        seen[key] = dup + 1
        if dup:
            xs[idx] += 0.45 * dup
            ys[idx] += 0.2 * ((dup % 3) - 1)

    if max(xs.values()) - min(xs.values()) < 1e-6:
        for slot, idx in enumerate(xs):
            xs[idx] = slot * 2.0
    if max(ys.values()) - min(ys.values()) < 1e-6:
        for slot, idx in enumerate(ys):
            ys[idx] = (slot % 6) * 2.0

    dx = max(xs.values()) - min(xs.values())
    dy = max(ys.values()) - min(ys.values()) or 1.0
    aspect = dx / dy
    if aspect > 3.6:
        mid = sum(ys.values()) / len(ys)
        grow = aspect / 2.2
        for idx in ys:
            ys[idx] = mid + (ys[idx] - mid) * grow
    elif aspect < (1.0 / 3.6):
        mid = sum(xs.values()) / len(xs)
        grow = (1.0 / aspect) / 2.2
        for idx in xs:
            xs[idx] = mid + (xs[idx] - mid) * grow

    for idx in net.bus.index:
        net.bus.at[idx, "geo"] = {
            "type": "Point",
            "coordinates": [float(xs[idx]), float(ys[idx])],
        }


_prepare_electrisim_net(net)

pp.set_user_pf_options(
    net,
    algorithm="nr",
    calculate_voltage_angles="auto",
    init="auto",
)
