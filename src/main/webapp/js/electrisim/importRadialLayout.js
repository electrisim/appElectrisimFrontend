/**
 * Radial single-line layout for distribution / plant imports.
 * Grid and collector sit at the top. Each feeder chain runs horizontally
 * (left and right). Step-up LV buses hang under the MV bus they belong to.
 * Returns {x, y, w, leaf} per bus index. x/y are the busbar cell origin.
 */
export function layoutRadialSld(busRows, lineRows, trafoRows, extRows, originX, originY) {
    const n = busRows.length;
    const lineAdj = Array.from({ length: n }, () => []);
    const trafoDown = Array.from({ length: n }, () => []);
    (lineRows || []).forEach((r) => {
        const a = Number(r[2]);
        const b = Number(r[3]);
        if (a >= 0 && b >= 0 && a < n && b < n && a !== b) {
            lineAdj[a].push(b);
            lineAdj[b].push(a);
        }
    });
    (trafoRows || []).forEach((r) => {
        const hv = Number(r[2]);
        const lv = Number(r[3]);
        if (hv >= 0 && lv >= 0 && hv < n && lv < n) trafoDown[hv].push(lv);
    });

    let root = 0;
    if (extRows && extRows[0]) {
        const b = parseInt(String(extRows[0][1]), 10);
        if (Number.isFinite(b) && b >= 0 && b < n) root = b;
    }

    const parent = new Array(n).fill(-1);
    const queue = [root];
    parent[root] = root;
    while (queue.length) {
        const u = queue.shift();
        const nbrs = lineAdj[u].concat(trafoDown[u]);
        for (let i = 0; i < nbrs.length; i++) {
            const v = nbrs[i];
            if (parent[v] >= 0) continue;
            parent[v] = u;
            queue.push(v);
        }
    }

    const lineChildren = (u) => lineAdj[u].filter((v) => parent[v] === u);
    const trafoChildren = (u) => trafoDown[u].filter((v) => parent[v] === u);

    const spine = [root];
    let cur = root;
    const guard = new Set([root]);
    while (lineChildren(cur).length === 1 && trafoChildren(cur).length === 0) {
        cur = lineChildren(cur)[0];
        if (guard.has(cur)) break;
        guard.add(cur);
        spine.push(cur);
    }
    const collector = spine[spine.length - 1];
    const feeders = lineChildren(collector);
    const sideTrafos = trafoChildren(collector);

    const positions = new Array(n);
    const cx = originX;
    let y = originY;
    spine.forEach((b, i) => {
        const w = i === spine.length - 1 ? 280 : 200;
        positions[b] = { x: cx - w / 2, y, w, leaf: false };
        y += 170;
    });

    const collectorPos = positions[collector];
    const rowY = collectorPos.y + 280;
    const STEP = 280;
    const BW = 120;
    const LVW = 110;
    const DROP = 190;
    const colHalf = collectorPos.w / 2;

    const placeHorizontal = (start, dir, lane) => {
        let u = start;
        let step = 1;
        const seen = new Set();
        const yRow = rowY + lane * (DROP + 220);
        while (u != null && !seen.has(u)) {
            seen.add(u);
            const x = cx + dir * (colHalf * 0.55 + (step - 1) * STEP) - BW / 2;
            if (!positions[u]) positions[u] = { x, y: yRow, w: BW, leaf: false };
            const tcs = trafoChildren(u);
            tcs.forEach((lv, k) => {
                if (!positions[lv]) {
                    positions[lv] = {
                        x: x + (BW - LVW) / 2,
                        y: yRow + DROP + k * 30,
                        w: LVW,
                        leaf: true,
                    };
                }
            });
            const next = lineChildren(u);
            if (!next.length) {
                if (positions[u] && tcs.length === 0) positions[u].leaf = true;
                break;
            }
            for (let k = 1; k < next.length; k++) {
                if (!positions[next[k]]) {
                    positions[next[k]] = {
                        x: x + dir * (k + 1) * 40,
                        y: yRow + DROP + 160,
                        w: BW,
                        leaf: false,
                    };
                }
            }
            u = next[0];
            step += 1;
        }
    };

    const left = [];
    const right = [];
    if (feeders.length <= 1) {
        feeders.forEach((f) => right.push(f));
    } else {
        feeders.forEach((f, i) => (i % 2 === 0 ? left : right).push(f));
    }
    left.forEach((start, lane) => placeHorizontal(start, -1, lane));
    right.forEach((start, lane) => placeHorizontal(start, 1, lane));

    sideTrafos.forEach((lv, k) => {
        if (positions[lv]) return;
        const base = positions[collector];
        positions[lv] = {
            x: base.x + base.w + 150 + k * 240,
            y: base.y,
            w: 120,
            leaf: true,
            side: true,
        };
    });

    let uy = rowY + DROP + 280;
    for (let i = 0; i < n; i++) {
        if (!positions[i]) {
            positions[i] = { x: cx - 100, y: uy, w: 200, leaf: true };
            uy += 180;
        }
    }
    return positions;
}

export function suggestImportSystem(model) {
    try {
        const buses = JSON.parse(model._object.bus._object).data || [];
        const lines = JSON.parse(model._object.line._object).data || [];
        const trafos = model._object.trafo ? (JSON.parse(model._object.trafo._object).data || []) : [];
        const n = buses.length;
        const m = lines.length + trafos.length;
        const extra = m - Math.max(0, n - 1);
        if (n > 60 || extra > Math.max(4, Math.round(n * 0.12))) return 'vertical';
        return 'radial';
    } catch (e) {
        return 'vertical';
    }
}
