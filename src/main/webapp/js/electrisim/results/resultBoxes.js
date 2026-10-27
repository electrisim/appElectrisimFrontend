//-----CREATION OF RESULT PLACEHOLDERS for ALL ELEMENTS, INCLUDING BUS AND LINE-----


//Hook into edge insertion to create placeholder result boxes for components
//connected to buses (External Grid, Generator, Load, Motor, SSC, etc.)

// Deferred: preserve original and apply override when mxGraph is available
var originalGraphAddEdge = null;
var upgradedGraphs = typeof WeakSet !== 'undefined' ? new WeakSet() : {};

function runUpgradeOnce(graph) {
    if (!graph || !upgradeResultPlaceholderStyles) return;
    if (upgradedGraphs instanceof WeakSet) {
        if (upgradedGraphs.has(graph)) return;
        upgradedGraphs.add(graph);
    } else if (upgradedGraphs[graph.id]) return;
    else if (graph.id) upgradedGraphs[graph.id] = true;
    upgradeResultPlaceholderStyles(graph);
}

// Helper to extract custom Electrisim shape
function getShapeElxxx(style) {
    if (!style) return null;
    var match = style.match(/shapeELXXX=([^;]+)/);
    return match ? match[1] : null;
}

// Helper to detect Bus style (including DC Bus)
function isBusStyle(style) {
    if (!style) return false;
    return style.includes('shapeELXXX=Bus') ||
        style.includes('shapeELXXX=DC Bus') ||
        style.includes('shape=mxgraph.electrical.transmission.busbar');
}

// Create a result placeholder for Bus element when it is dropped onto the graph
// This placeholder will be updated with load flow results (vm_pu, va_degree, p_mw, q_mvar, etc.)
function createBusResultPlaceholder(graph, busCell) {
    if (!graph || !busCell) {
        console.warn('ELXXX: Cannot create Bus result placeholder - missing graph or busCell');
        return;
    }
    if (graph._elxxxSkipPlaceholders) return;
    runUpgradeOnce(graph);
    // Check if placeholder already exists
    var existingId = null;
    if (busCell.value && busCell.value.attributes) {
        var placeholderAttr = busCell.value.attributes.getNamedItem('placeholderId');
        if (placeholderAttr) {
            existingId = placeholderAttr.nodeValue;
        }
    }
    
    if (existingId) {
        console.log('ELXXX: Bus already has a result placeholder:', existingId);
        return;
    }

    var baseStyle = [
        'shape=rounded',
        'rounded=1',
        'arcSize=6',
        'fillColor=#F8F9FA',
        'strokeColor=#6C757D',
        'strokeWidth=1.5',
        'dashed=1',
        'dashPattern=5 5',
        'opacity=70',
        'whiteSpace=wrap',
        'html=1',
        'align=center',
        'verticalAlign=middle',
        'fontSize=7',
        'fontColor=#6C757D',
        'fontStyle=0',
        'spacing=3',
        'connectedTo=' + busCell.id
    ].join(';');

    var placeholderStyle = 'shapeELXXX=ResultBus;' + baseStyle;

    var boxWidth = 80;
    var boxHeight = 70;

    graph.model.beginUpdate();
    try {
        // Create placeholder as a child of the Bus cell with relative positioning
        // Positioned at left edge (x=0) to align with the "Bus" label
        var placeholder = graph.insertVertex(
            busCell,           // parent is the Bus cell
            null,              // id (auto-generated)
            'Click Simulate to generate results',
            0,                 // x position (relative, left-aligned with Bus label)
            1.0,               // y position (relative, below the bus - closer than before)
            boxWidth,
            boxHeight,
            placeholderStyle,
            true               // relative positioning
        );

        if (placeholder) {
            var geo = graph.model.getGeometry(placeholder);
            if (geo) {
                geo.relative = true;
                geo.x = 0;     // Left-aligned with Bus label
                geo.y = 1.0;   // Closer to the Bus line
                if (typeof mxPoint !== 'undefined') {
                    geo.offset = new mxPoint(0, 0);  // No horizontal offset, left-aligned
                }
                graph.model.setGeometry(placeholder, geo);
            }

            // Get the placeholder ID
            var placeholderId = placeholder.id;
            if (!placeholderId && placeholder.mxObjectId) {
                placeholderId = placeholder.mxObjectId.replace('#', '');
            }

            if (placeholderId) {
                // Add placeholderId to the style for traceability
                graph.model.setStyle(
                    placeholder,
                    placeholderStyle + ';placeholderId=' + placeholderId
                );

                // Store reference on the Bus cell so loadFlow.js can find it
                if (busCell.value && typeof busCell.value.setAttribute === 'function') {
                    busCell.value.setAttribute('placeholderId', placeholderId);
                    graph.model.setValue(busCell, busCell.value);
                } else {
                    busCell.placeholderId = placeholderId;
                }

                console.log('ELXXX: Created Bus result placeholder with ID:', placeholderId);
            }
            applyResultBoxPlacement(graph, placeholder, busCell, { width: boxWidth, height: boxHeight });
        }
    } catch (err) {
        console.error('ELXXX: Error creating Bus result placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

// Make the function globally available for app.min.js
if (typeof window !== 'undefined') {
    window.createBusResultPlaceholder = createBusResultPlaceholder;
}

// Shared result box style for loadFlow.js, loadflowOpenDss.js, shortCircuit.js
// Light grey dashed border, semi-transparent background, readable text
var RESULT_BOX_STYLE = 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';

// Gap between a symbol (or busbar / line) and its result box, in graph units.
var RESULT_BOX_GAP = 8;

// BEGIN_PLACEMENT_PURE
function busQuietSideFromCounts(above, below) {
    if (above > below) return 'below';
    if (below > above) return 'above';
    if (!above && !below) return 'below';
    return 'left';
}

function componentBoxSideFromBusy(busy) {
    if (busy === 'right') return 'left';
    if (busy === 'left') return 'right';
    return 'right';
}

function vertexBoxAnchor(side, bw, bh) {
    var gap = RESULT_BOX_GAP;
    if (side === 'right') return { x: 1, y: 0.5, ox: gap, oy: -bh / 2 };
    if (side === 'left') return { x: 0, y: 0.5, ox: -(bw + gap), oy: -bh / 2 };
    if (side === 'above') return { x: 0.5, y: 0, ox: -bw / 2, oy: -(bh + gap) };
    return { x: 0.5, y: 1, ox: -bw / 2, oy: gap };
}

function lineAnchorFromPoints(points, distanceFromStart) {
    if (!points || points.length < 2) return { geoX: 0, vertical: false };
    var segs = [];
    var total = 0;
    var i;
    for (i = 1; i < points.length; i++) {
        var dx = points[i].x - points[i - 1].x;
        var dy = points[i].y - points[i - 1].y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        segs.push({ len: len, dx: dx, dy: dy, start: total });
        total += len;
    }
    if (!segs.length || total <= 0) return { geoX: 0, vertical: false };
    var want = typeof distanceFromStart === 'number' ? distanceFromStart : total / 2;
    if (want < 12) want = 12;
    if (want > total - 8) want = Math.max(8, total / 2);
    var seg = segs[0];
    for (i = 0; i < segs.length; i++) {
        if (want <= segs[i].start + segs[i].len) { seg = segs[i]; break; }
        seg = segs[i];
    }
    var fraction = want / total;
    var geoX = (fraction - 0.5) * 2;
    if (geoX < -1) geoX = -1;
    if (geoX > 1) geoX = 1;
    return { geoX: geoX, vertical: Math.abs(seg.dy) >= Math.abs(seg.dx) };
}

function lineBoxAnchor(vertical, bw, bh) {
    var gap = RESULT_BOX_GAP;
    if (vertical) return { ox: gap, oy: -bh / 2 };
    return { ox: -bw / 2, oy: -(bh + gap) };
}

function resultRectsOverlap(a, b, pad) {
    pad = pad || 0;
    return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x
        && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

/**
 * Push overlapping result rectangles apart. Obstacles (symbols) stay put.
 * Each box moves only as far as it needs to clear what it covers.
 * Returns dx/dy from the original top-left, in the same units as the rects.
 */
function separateBoxRects(rects, obstacles, gap) {
    gap = gap == null ? 6 : gap;
    var placed = [];
    var i;
    for (i = 0; i < (obstacles || []).length; i++) {
        var o = obstacles[i];
        if (o && o.w > 2 && o.h > 2 && o.w < 2500 && o.h < 2500) placed.push(o);
    }
    var items = [];
    for (i = 0; i < rects.length; i++) {
        var r = rects[i];
        items.push({ i: i, x: r.x, y: r.y, w: r.w, h: r.h, ox: r.x, oy: r.y });
    }
    items.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    function free(rect) {
        var p;
        for (p = 0; p < placed.length; p++) {
            if (resultRectsOverlap(rect, placed[p], gap)) return false;
        }
        return true;
    }
    for (i = 0; i < items.length; i++) {
        var b = items[i];
        var stepX = b.w + gap;
        var stepY = b.h + gap;
        var chosen = null;
        var steps = [
            [0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1], [1, 2],
            [3, 0], [0, 3], [2, 2], [3, 1], [1, 3], [3, 2], [4, 0], [0, 4],
            [-1, 0], [0, -1], [-1, 1], [1, -1], [-1, 2], [2, -1]
        ];
        var s;
        for (s = 0; s < steps.length && !chosen; s++) {
            var cand = { x: b.ox + steps[s][0] * stepX, y: b.oy + steps[s][1] * stepY, w: b.w, h: b.h };
            if (free(cand)) chosen = cand;
        }
        if (!chosen) chosen = { x: b.ox, y: b.oy + (i + 1) * stepY, w: b.w, h: b.h };
        b.x = chosen.x;
        b.y = chosen.y;
        placed.push({ x: chosen.x, y: chosen.y, w: chosen.w, h: chosen.h });
    }
    var out = [];
    for (i = 0; i < rects.length; i++) out.push({ dx: 0, dy: 0 });
    for (i = 0; i < items.length; i++) {
        out[items[i].i] = { dx: items[i].x - items[i].ox, dy: items[i].y - items[i].oy };
    }
    return out;
}
// END_PLACEMENT_PURE

function cellAttr(cell, name) {
    try {
        if (cell && cell.value && typeof cell.value.getAttribute === 'function') {
            return cell.value.getAttribute(name);
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resultLayoutPinned(cell) {
    return !!cellAttr(cell, 'bessPlantRole');
}

function neighborCenters(graph, cell) {
    var geo = cell && cell.geometry;
    if (!geo || geo.relative) return [];
    var cx = geo.x + (geo.width || 0) / 2;
    var cy = geo.y + (geo.height || 0) / 2;
    var edges = (graph.getEdges && graph.getEdges(cell)) || cell.edges || [];
    var out = [];
    for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (!e) continue;
        var other = e.source === cell ? e.target : (e.target === cell ? e.source : null);
        if (!other || !other.geometry || other.geometry.relative) continue;
        var og = other.geometry;
        out.push({
            dx: (og.x + (og.width || 0) / 2) - cx,
            dy: (og.y + (og.height || 0) / 2) - cy
        });
    }
    return out;
}

function busQuietSide(graph, bus) {
    var geo = bus && bus.geometry;
    if (!geo || geo.relative) return 'below';
    var midY = geo.y + (geo.height || 0) / 2;
    var edges = (graph.getEdges && graph.getEdges(bus)) || bus.edges || [];
    var above = 0;
    var below = 0;
    for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (!e) continue;
        var other = e.source === bus ? e.target : (e.target === bus ? e.source : null);
        if (!other || !other.geometry || other.geometry.relative) continue;
        var oy = other.geometry.y + (other.geometry.height || 0) / 2;
        if (oy < midY - 8) above++;
        else if (oy > midY + 8) below++;
    }
    return busQuietSideFromCounts(above, below);
}

function componentBoxSide(graph, comp) {
    var pts = neighborCenters(graph, comp);
    if (!pts.length) return 'right';
    var sx = 0;
    var sy = 0;
    for (var i = 0; i < pts.length; i++) {
        sx += pts[i].dx;
        sy += pts[i].dy;
    }
    // Leads that cancel (transformer between two buses, series branch) stay on the right of the symbol.
    if (Math.abs(sx) < 40 && Math.abs(sy) < 40) return 'right';
    var busy = Math.abs(sx) >= Math.abs(sy) ? (sx >= 0 ? 'right' : 'left') : (sy >= 0 ? 'below' : 'above');
    return componentBoxSideFromBusy(busy);
}

function edgeModelPoints(graph, edge) {
    var view = graph && graph.view;
    var state = view && view.getState && view.getState(edge);
    if (state && state.absolutePoints && state.absolutePoints.length >= 2) {
        var sc = view.scale || 1;
        var tr = view.translate || { x: 0, y: 0 };
        var abs = [];
        for (var i = 0; i < state.absolutePoints.length; i++) {
            var p = state.absolutePoints[i];
            if (!p) continue;
            abs.push({ x: p.x / sc - tr.x, y: p.y / sc - tr.y });
        }
        if (abs.length >= 2) return abs;
    }
    var pts = [];
    function centerOf(cell) {
        if (!cell || !cell.geometry || cell.geometry.relative) return null;
        var g = cell.geometry;
        return { x: g.x + (g.width || 0) / 2, y: g.y + (g.height || 0) / 2 };
    }
    var a = centerOf(edge.source);
    var b = centerOf(edge.target);
    if (a) pts.push(a);
    var geo = edge.geometry;
    if (geo && geo.points) {
        for (var j = 0; j < geo.points.length; j++) {
            if (geo.points[j]) pts.push({ x: geo.points[j].x, y: geo.points[j].y });
        }
    }
    if (b) pts.push(b);
    return pts;
}

function setResultBoxGeometry(model, box, x, y, w, h, ox, oy) {
    var geo = model.getGeometry(box);
    if (!geo) return;
    var ng = geo.clone();
    ng.relative = true;
    ng.x = x;
    ng.y = y;
    ng.width = w;
    ng.height = h;
    if (typeof mxPoint !== 'undefined') ng.offset = new mxPoint(ox, oy);
    model.setGeometry(box, ng);
}

function connectedOwnerId(style) {
    var m = String(style || '').match(/connectedTo=([^;]+)/);
    return m ? String(m[1]).trim() : '';
}

function cellById(model, id) {
    if (!model || !model.getCell || id == null || id === '') return null;
    return model.getCell(String(id)) || null;
}

function resolveResultOwner(graph, box) {
    var model = graph.getModel ? graph.getModel() : graph.model;
    if (!model || !box) return null;
    var st = (model.getStyle && model.getStyle(box)) || box.style || '';
    var tagged = cellById(model, connectedOwnerId(st));
    if (tagged && !isResultPlaceholderStyle((model.getStyle && model.getStyle(tagged)) || tagged.style || '')) {
        return tagged;
    }
    var parent = model.getParent(box) || null;
    if (parent && parent.edge && !isLineStyle((model.getStyle && model.getStyle(parent)) || parent.style || '')) {
        var ends = [parent.source, parent.target];
        for (var i = 0; i < ends.length; i++) {
            var term = ends[i];
            if (!term || term.edge) continue;
            var termStyle = (model.getStyle && model.getStyle(term)) || term.style || '';
            if (!isBusStyle(termStyle)) return term;
        }
    }
    return parent;
}

function fittedResultBoxSize(text, w, h) {
    var lines = String(text || '').split('\n');
    var boxW = Math.max(72, Math.min(112, w || 90));
    var charsPerLine = Math.max(14, Math.floor((boxW - 8) / 4.1));
    var visual = 0;
    var any = false;
    for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (!t) continue;
        any = true;
        visual += Math.max(1, Math.ceil(t.length / charsPerLine));
    }
    if (!any) return { w: boxW, h: h || 36 };
    return { w: boxW, h: Math.max(h || 36, Math.min(150, visual * 11 + 8)) };
}

function styleOf(model, cell) {
    if (!cell) return '';
    return (model && model.getStyle && model.getStyle(cell)) || cell.style || '';
}

function busEquipmentFraction(graph, bus) {
    var geo = bus && bus.geometry;
    if (!geo || !geo.width) return 0;
    var edges = (graph.getEdges && graph.getEdges(bus)) || bus.edges || [];
    var sum = 0;
    var n = 0;
    for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (!e) continue;
        var other = e.source === bus ? e.target : (e.target === bus ? e.source : null);
        if (!other || other.edge || !other.geometry || other.geometry.relative) continue;
        var ost = other.style || '';
        if (isBusStyle(ost) || isLineStyle(ost)) continue;
        sum += other.geometry.x + (other.geometry.width || 0) / 2;
        n++;
    }
    if (!n) return 0;
    var frac = (sum / n - geo.x) / geo.width;
    if (frac < 0) frac = 0;
    if (frac > 1) frac = 1;
    return frac;
}

function lineLaneOf(edge) {
    var id = String(edge && edge.id != null ? edge.id : '');
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % 3;
    return h;
}

function compactNum(raw, digits) {
    var n = Number(raw);
    if (!isFinite(n)) return String(raw);
    return n.toFixed(digits);
}

function compactDiagramResult(text) {
    var lines = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length <= 2) return lines.join('\n');
    var head = lines[0].replace(/\s+/g, ' ');
    function wrapWords(text, maxChars) {
        var words = String(text).split(/\s+/);
        var out = [];
        var cur = '';
        var i;
        for (i = 0; i < words.length; i++) {
            var next = cur ? cur + ' ' + words[i] : words[i];
            if (cur && next.length > maxChars) {
                out.push(cur);
                cur = words[i];
            } else {
                cur = next;
            }
        }
        if (cur) out.push(cur);
        return out.length ? out : [''];
    }
    function find(re) {
        var i;
        for (i = 1; i < lines.length; i++) {
            var m = lines[i].match(re);
            if (m) return m[1];
        }
        return null;
    }
    var pu = find(/U\[pu\]:\s*([-\d.]+)/i);
    var kv = find(/U\[kV\]:\s*([-\d.]+)/i);
    var phv = find(/P_HV\[MW\]:\s*([-\d.]+)/i);
    var plv = find(/P_LV\[MW\]:\s*([-\d.]+)/i);
    var p = find(/P(?:_from)?\[MW\]:\s*([-\d.]+)/i) || find(/\(([-\d.]+)\s*MW\)/);
    var q = find(/Q(?:_from)?\[MVar\]:\s*([-\d.]+)/i) || find(/Q=\s*([-\d.]+)/);
    var load = find(/[Ll]oading(?:\[%\])?:\s*([-\d.]+)/);
    var bits = [];
    if (pu) bits.push(compactNum(pu, 3) + ' pu');
    if (kv) bits.push(compactNum(kv, 1) + ' kV');
    if (phv || plv) bits.push('HV ' + compactNum(phv || '0', 1) + ' / LV ' + compactNum(plv || '0', 1));
    else if (p) bits.push('P ' + compactNum(p, 1));
    if (q) bits.push('Q ' + compactNum(q, 1));
    if (load) bits.push(compactNum(load, 0) + '%');
    var stacked = wrapWords(head, 16);
    if (!bits.length) stacked = stacked.concat(lines.slice(1, 4));
    else bits.forEach(function (bit) { stacked = stacked.concat(wrapWords(bit, 16)); });
    return stacked.join('\n');
}

function styleKeyValue(style, key) {
    var parts = String(style || '').split(';');
    var i;
    for (i = 0; i < parts.length; i++) {
        var idx = parts[i].indexOf('=');
        if (idx > 0 && parts[i].slice(0, idx) === key) return parts[i].slice(idx + 1);
    }
    return '';
}

function encodeResultText(text) {
    try {
        return btoa(unescape(encodeURIComponent(String(text))));
    } catch (e) {
        return '';
    }
}

function decodeResultText(b64) {
    if (!b64) return '';
    try {
        return decodeURIComponent(escape(atob(b64)));
    } catch (e) {
        return '';
    }
}

function looksLikeFullResult(text) {
    var raw = String(text || '');
    if (/\[\+\]|\[–\]|\[-\]/.test(raw)) return false;
    return /U\[pu\]:|U\[kV\]:|P_HV\[MW\]:|P_LV\[MW\]:|P_from\[MW\]:|P\[MW\]:|Q\[MVar\]:|Q_from\[MVar\]:|Loading(?:\[%\])?:|i_from\[/.test(raw);
}

function readStoredFullResult(model, box) {
    return decodeResultText(styleKeyValue(model.getStyle(box) || '', 'elxxxFull'));
}

function writeResultBoxStyle(model, box, key, value) {
    var st = model.getStyle(box) || '';
    var next = (typeof mxUtils !== 'undefined' && mxUtils.setStyle)
        ? mxUtils.setStyle(st, key, value)
        : st;
    if (next === st && String(st).indexOf(key + '=') < 0) {
        next = st + (st && st.charAt(st.length - 1) !== ';' ? ';' : '') + key + '=' + value;
    }
    if (model.setStyle && next !== st) model.setStyle(box, next);
    return next;
}

function resultBoxIsOpen(model, box) {
    return styleKeyValue(model.getStyle(box) || '', 'elxxxOpen') === '1';
}

/** Blue [+] / [–]. pointer-events stays on so one click hits the mark, not the box behind it. */
function resultToggleMarker(open) {
    return '<span class="elxxx-result-toggle" style="color:#0b57d0;font-weight:600;cursor:pointer;pointer-events:auto;padding:1px 4px">' + (open ? '[–]' : '[+]') + '</span>';
}

function resultToggleMarkerNode(node) {
    var n = node;
    var guard = 0;
    if (n && n.nodeType === 3) n = n.parentNode;
    while (n && n.nodeType === 1 && guard < 5) {
        var mark = String(n.textContent || '').replace(/\s/g, '');
        if (mark === '[+]' || mark === '[–]' || mark === '[-]') return n;
        n = n.parentNode;
        guard++;
    }
    return null;
}

/** The label sits under pointer-events:none, so the + is found by its screen box. */
function resultToggleMarkerAtPoint(x, y) {
    var list = typeof document !== 'undefined' ? document.getElementsByClassName('elxxx-result-toggle') : [];
    var i;
    for (i = 0; i < list.length; i++) {
        var rect = list[i].getBoundingClientRect();
        if (x >= rect.left - 3 && x <= rect.right + 3 && y >= rect.top - 3 && y <= rect.bottom + 3) return list[i];
    }
    return null;
}

function resultCellForMarker(graph, marker) {
    if (!graph || !marker || !graph.getModel || !graph.view) return null;
    var model = graph.getModel();
    var root = model.getRoot && model.getRoot();
    if (!root) return null;
    var stack = [root];
    while (stack.length) {
        var cell = stack.pop();
        var n = model.getChildCount(cell);
        var i;
        for (i = 0; i < n; i++) stack.push(model.getChildAt(cell, i));
        var state = graph.view.getState(cell);
        if (state && state.text && state.text.node && state.text.node.contains && state.text.node.contains(marker)) return cell;
    }
    return null;
}

function resultBoxGraph() {
    var ui = null;
    try {
        if (typeof Editor !== 'undefined' && Editor.ui) ui = Editor.ui;
    } catch (e) { /* ignore */ }
    if (!ui && typeof window !== 'undefined' && window.App) {
        ui = window.App._editorUi || window.App._instance;
        if (!ui && window.App.main && window.App.main.editor) ui = window.App.main.editor.editorUi;
    }
    if (!ui && typeof document !== 'undefined') {
        var el = document.querySelector && document.querySelector('.geEditor');
        if (el && el._editorUi) ui = el._editorUi;
    }
    if (!ui && typeof window !== 'undefined') ui = window.editorUi;
    return ui && ui.editor && ui.editor.graph ? ui.editor.graph : null;
}

function resultCellAtEvent(graph, evt) {
    if (!graph || !evt || !graph.container || typeof mxUtils === 'undefined' || typeof mxEvent === 'undefined') return null;
    var pt = mxUtils.convertPoint(graph.container, mxEvent.getClientX(evt), mxEvent.getClientY(evt));
    return graph.getCellAt(pt.x, pt.y);
}

/** Bottom line of a result box, where the + / – mark is drawn. */
function resultClickInMarkerBand(graph, cell, evt) {
    if (!graph || !cell || !evt || !graph.view || !graph.container) return false;
    var state = graph.view.getState(cell);
    if (!state) return false;
    var host = graph.container.getBoundingClientRect();
    var scale = graph.view.scale || 1;
    var left = host.left + state.x;
    var top = host.top + state.y;
    var px = evt.clientX;
    var py = evt.clientY;
    if (px < left || px > left + state.width || py < top - 2 || py > top + state.height + 2) return false;
    var band = Math.max(14, 16 * scale);
    return py >= top + state.height - band;
}

/** The + / – mark under the pointer, including when the label ignores mouse events. */
function resultMarkerUnderPointer(graph, evt, cell) {
    if (!evt) return null;
    var x = evt.clientX;
    var y = evt.clientY;
    var direct = resultToggleMarkerNode(evt.target);
    if (direct) return direct;
    var byClass = resultToggleMarkerAtPoint(x, y);
    if (byClass) return byClass;
    if (!graph || !graph.view) return null;
    if (!cell) cell = resultCellAtEvent(graph, evt);
    if (!cell) return null;
    var state = graph.view.getState(cell);
    var node = state && state.text && state.text.node;
    if (!node || !node.getElementsByTagName) return null;
    var spans = node.getElementsByTagName('span');
    var i;
    for (i = 0; i < spans.length; i++) {
        var mark = String(spans[i].textContent || '').replace(/\s/g, '');
        if (mark !== '[+]' && mark !== '[–]' && mark !== '[-]') continue;
        var rect = spans[i].getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        if (x >= rect.left - 8 && x <= rect.right + 8 && y >= rect.top - 6 && y <= rect.bottom + 6) return spans[i];
    }
    return null;
}

function summaryBoxSize(text) {
    var lines = String(text || '').split('\n').filter(function (l) { return l.trim(); });
    var n = Math.max(lines.length, 3);
    var side = Math.max(68, Math.min(84, 18 + n * 11));
    return { w: side, h: side };
}

function freeGapsAround(graph, cell) {
    var far = 140;
    var result = { above: far, below: far };
    var g = cell && cell.geometry;
    if (!g || g.relative || !graph.getModel) return result;
    var model = graph.getModel();
    var top = g.y;
    var bottom = g.y + (g.height || 0);
    var cx = g.x + (g.width || 0) / 2;
    var parent = model.getParent(cell);
    var n = parent ? model.getChildCount(parent) : 0;
    var i;
    for (i = 0; i < n; i++) {
        var other = model.getChildAt(parent, i);
        if (!other || other === cell || other.edge) continue;
        var st = model.getStyle(other) || '';
        if (isResultPlaceholderStyle(st)) continue;
        var og = other.geometry;
        if (!og || og.relative) continue;
        if (Math.abs((og.x + (og.width || 0) / 2) - cx) > 100) continue;
        var oTop = og.y;
        var oBottom = og.y + (og.height || 0);
        if (oBottom <= top + 2) result.above = Math.min(result.above, top - oBottom);
        if (oTop >= bottom - 2) result.below = Math.min(result.below, oTop - bottom);
    }
    return result;
}

function fullBoxSize(text) {
    var lines = String(text || '').split('\n');
    var max = 0;
    var n = 0;
    var i;
    for (i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        n++;
        if (lines[i].length > max) max = lines[i].length;
    }
    return {
        w: Math.max(130, Math.min(240, Math.ceil(max * 4.4 + 16))),
        h: Math.max(72, Math.min(480, n * 14 + 18))
    };
}

function resultBoxUserMoved(graph, box) {
    var moved = graph && graph._elxxxUserMovedIds;
    return !!(moved && box && moved[String(box.id)]);
}

function looksLikeTransformerResult(text) {
    var raw = String(text || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
    if (/P_HV\[MW\]:|P_LV\[MW\]:/.test(raw)) return true;
    return /HV\s+[-\d.]+/.test(raw) && /LV/.test(raw);
}

function cellRotation(cell) {
    var m = String((cell && cell.style) || '').match(/(?:^|;)rotation=([-\d.]+)/);
    var deg = m ? parseFloat(m[1]) : 0;
    if (!isFinite(deg)) return 0;
    deg = ((deg % 360) + 360) % 360;
    return deg;
}

/** Rotated owner footprint as drawn: same centre, swapped sides at 90/270. */
function visualOwnerSize(owner) {
    var og = owner.geometry;
    var W = og.width || 0;
    var H = og.height || 0;
    var rad = cellRotation(owner) * Math.PI / 180;
    var c = Math.abs(Math.cos(rad));
    var s = Math.abs(Math.sin(rad));
    return { w: W * c + H * s, h: W * s + H * c };
}

function absoluteResultRect(owner, box) {
    var og = owner && owner.geometry;
    var bg = box && box.geometry;
    if (!og || !bg || og.relative || owner.edge) return null;
    var cx0 = og.x + (og.width || 0) / 2;
    var cy0 = og.y + (og.height || 0) / 2;
    var rot = cellRotation(owner);
    if (box === owner) {
        var vs = visualOwnerSize(owner);
        return { x: cx0 - vs.w / 2, y: cy0 - vs.h / 2, w: vs.w, h: vs.h };
    }
    var ox = bg.offset ? bg.offset.x : 0;
    var oy = bg.offset ? bg.offset.y : 0;
    if (bg.relative) {
        var rect = {
            x: og.x + (bg.x || 0) * (og.width || 0) + ox,
            y: og.y + (bg.y || 0) * (og.height || 0) + oy,
            w: bg.width || 0,
            h: bg.height || 0
        };
        if (rot) {
            // The view turns relative children around the parent centre with the parent.
            var rad = rot * Math.PI / 180;
            var dx = rect.x + rect.w / 2 - cx0;
            var dy = rect.y + rect.h / 2 - cy0;
            rect.x = cx0 + dx * Math.cos(rad) - dy * Math.sin(rad) - rect.w / 2;
            rect.y = cy0 + dx * Math.sin(rad) + dy * Math.cos(rad) - rect.h / 2;
        }
        return rect;
    }
    return { x: bg.x + ox, y: bg.y + oy, w: bg.width || 0, h: bg.height || 0 };
}

/**
 * Places a box at `side` of a vertex as it is drawn. Relative children are turned with a
 * rotated parent, so the offset is counter-rotated to keep the box on the requested side.
 */
function placeBoxBesideVertex(model, box, owner, side, w, h) {
    var anchor = vertexBoxAnchor(side, w, h);
    var rot = cellRotation(owner);
    var og = owner && owner.geometry;
    if (!rot || !og || og.relative) {
        setResultBoxGeometry(model, box, anchor.x, anchor.y, w, h, anchor.ox, anchor.oy);
        return;
    }
    var vs = visualOwnerSize(owner);
    var dx = anchor.x * vs.w + anchor.ox + w / 2 - vs.w / 2;
    var dy = anchor.y * vs.h + anchor.oy + h / 2 - vs.h / 2;
    var rad = rot * Math.PI / 180;
    var c = Math.cos(rad);
    var s = Math.sin(rad);
    var ux = dx * c + dy * s;
    var uy = -dx * s + dy * c;
    setResultBoxGeometry(model, box, 0.5, 0.5, w, h, ux - w / 2, uy - h / 2);
}

function transformerBoxIsBesideSymbol(owner, box) {
    var sym = absoluteResultRect(owner, owner);
    var rect = (owner && box && box.parent === owner) ? absoluteResultRect(owner, box) : null;
    if (!sym || !rect) return false;
    var cx = rect.x + rect.w / 2;
    return cx < sym.x - 2 || cx > sym.x + sym.w + 2;
}

function transformerOwnerForResult(graph, owner, box) {
    var model = graph.getModel ? graph.getModel() : graph.model;
    if (!model || !owner) return null;
    if (isTransformerStyle(styleOf(model, owner))) return owner;
    var tagged = cellById(model, connectedOwnerId((model.getStyle && model.getStyle(box)) || box.style || ''));
    if (tagged && tagged !== owner && isTransformerStyle(styleOf(model, tagged))) return tagged;
    var found = [];
    function consider(cell) {
        if (cell && found.indexOf(cell) < 0 && isTransformerStyle(styleOf(model, cell))) found.push(cell);
    }
    if (owner.edge) {
        consider(owner.source);
        consider(owner.target);
    }
    var edges = (graph.getEdges && graph.getEdges(owner)) || owner.edges || [];
    var i;
    for (i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (!e) continue;
        consider(e.source === owner ? e.target : e.source);
    }
    if (!found.length) return null;
    if (found.length === 1) return found[0];
    var rect = absoluteResultRect(owner, box);
    var best = found[0];
    var bestD = Infinity;
    if (!rect) return best;
    var cx = rect.x + rect.w / 2;
    var cy = rect.y + rect.h / 2;
    for (i = 0; i < found.length; i++) {
        var g = found[i].geometry;
        if (!g || g.relative) continue;
        var dx = (g.x + (g.width || 0) / 2) - cx;
        var dy = (g.y + (g.height || 0) / 2) - cy;
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = found[i]; }
    }
    return best;
}

function resultAnchorPoint(model, box) {
    var parent = model.getParent(box);
    var rect = absoluteResultRect(parent, box);
    if (rect) return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    var g = parent && parent.geometry;
    if (g && !g.relative && !parent.edge) {
        return { x: g.x + (g.width || 0) / 2, y: g.y + (g.height || 0) / 2 };
    }
    if (parent && parent.edge) {
        function mid(cell) {
            var cg = cell && cell.geometry;
            if (!cg || cg.relative) return null;
            return { x: cg.x + (cg.width || 0) / 2, y: cg.y + (cg.height || 0) / 2 };
        }
        var a = mid(parent.source);
        var b = mid(parent.target);
        if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return a || b;
    }
    return null;
}

function placeTransformerResultsBeside(graph) {
    if (!graph || !graph.getModel) return;
    var model = graph.getModel();
    var root = model.getRoot && model.getRoot();
    if (!root) return;
    var trafos = [];
    var boxes = [];
    var stack = [root];
    while (stack.length) {
        var cell = stack.pop();
        var n = model.getChildCount(cell);
        var i;
        for (i = 0; i < n; i++) stack.push(model.getChildAt(cell, i));
        var st = model.getStyle(cell) || '';
        if (!cell.edge && isTransformerStyle(st)) trafos.push(cell);
        else if (isResultPlaceholderStyle(st)) {
            var text = resultBoxPlainText(model, cell) || readStoredFullResult(model, cell);
            if (looksLikeTransformerResult(text)) boxes.push(cell);
        }
    }
    if (!trafos.length || !boxes.length) return;
    for (i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        var owner = resolveResultOwner(graph, box);
        var trafo = (owner && isTransformerStyle(styleOf(model, owner))) ? owner : null;
        if (!trafo && owner) trafo = transformerOwnerForResult(graph, owner, box);
        if (!trafo || !isTransformerStyle(styleOf(model, trafo))) {
            var point = resultAnchorPoint(model, box);
            var best = null;
            var bestD = Infinity;
            var t;
            for (t = 0; t < trafos.length; t++) {
                var tg = trafos[t].geometry;
                if (!tg || tg.relative) continue;
                var dx = (tg.x + (tg.width || 0) / 2) - (point ? point.x : 0);
                var dy = (tg.y + (tg.height || 0) / 2) - (point ? point.y : 0);
                var d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; best = trafos[t]; }
            }
            trafo = best;
        }
        if (!trafo) continue;
        if (model.getParent(box) === trafo && transformerBoxIsBesideSymbol(trafo, box)) continue;
        writeResultBoxStyle(model, box, 'connectedTo', String(trafo.id));
        if (model.getParent(box) !== trafo && model.add) model.add(trafo, box);
        var geo = model.getGeometry(box);
        var w = geo && geo.width ? geo.width : 72;
        var h = geo && geo.height ? geo.height : 72;
        placeBoxBesideVertex(model, box, trafo, 'right', w, h);
    }
}

function installResultBoxMoveMemory(graph) {
    if (!graph || graph._elxxxResultMoveMem || !graph.addListener || typeof mxEvent === 'undefined') return;
    graph._elxxxResultMoveMem = true;
    graph.addListener(mxEvent.CELLS_MOVED, function (sender, evt) {
        if (graph._elxxxPlacingResults) return;
        var cells = evt.getProperty('cells') || [];
        if (!graph._elxxxUserMovedIds) graph._elxxxUserMovedIds = Object.create(null);
        var i;
        for (i = 0; i < cells.length; i++) {
            var st = graph.getModel().getStyle(cells[i]) || '';
            if (isResultPlaceholderStyle(st)) graph._elxxxUserMovedIds[String(cells[i].id)] = 1;
        }
    });
}

function toggleResultBox(graph, box) {
    if (!graph || !box) return;
    var model = graph.getModel();
    var full = readStoredFullResult(model, box);
    if (!full) return;
    var open = !resultBoxIsOpen(model, box);
    model.beginUpdate();
    try {
        writeResultBoxStyle(model, box, 'elxxxOpen', open ? '1' : '0');
        var owner = resolveResultOwner(graph, box) || model.getParent(box);
        applyResultBoxPlacement(graph, box, owner, { fromToggle: true });
    } finally {
        model.endUpdate();
    }
    if (graph.view && graph.view.validate) {
        try { graph.view.validate(); } catch (e) { /* ignore */ }
    }
}

function installResultBoxToggle() {
    if (typeof mxGraph === 'undefined' || mxGraph.prototype._elxxxResultToggle) return;
    mxGraph.prototype._elxxxResultToggle = true;
    var prev = mxGraph.prototype.dblClick;
    mxGraph.prototype.dblClick = function (evt, cell) {
        var st = cell && this.getModel ? (this.getModel().getStyle(cell) || '') : '';
        if (cell && isResultPlaceholderStyle(st) && readStoredFullResult(this.getModel(), cell)) {
            if (this._elxxxMarkerClickAt && Date.now() - this._elxxxMarkerClickAt < 500) {
                if (evt && typeof mxEvent !== 'undefined' && mxEvent.consume) mxEvent.consume(evt);
                return;
            }
            toggleResultBox(this, cell);
            if (evt && typeof mxEvent !== 'undefined' && mxEvent.consume) mxEvent.consume(evt);
            return;
        }
        if (prev) prev.apply(this, arguments);
    };
    if (typeof document === 'undefined' || document._elxxxResultMarker) return;
    document._elxxxResultMarker = true;
    var lastMarkerClick = 0;
    function activateMarker(graph, evt, cell) {
        var marker = resultMarkerUnderPointer(graph, evt, cell);
        if (!cell) cell = (marker && resultCellForMarker(graph, marker)) || resultCellAtEvent(graph, evt);
        if (!marker && cell && isResultPlaceholderStyle((graph.getModel().getStyle(cell) || '')) && resultClickInMarkerBand(graph, cell, evt)) {
            marker = { textContent: resultBoxIsOpen(graph.getModel(), cell) ? '[–]' : '[+]' };
        }
        if (!marker || !graph || !graph.getModel) return false;
        var st = cell ? (graph.getModel().getStyle(cell) || '') : '';
        if (!cell || !isResultPlaceholderStyle(st)) return false;
        var now = Date.now();
        if (now - lastMarkerClick > 400) {
            lastMarkerClick = now;
            graph._elxxxMarkerClickAt = now;
            var mark = String(marker.textContent || '').replace(/\s/g, '');
            var open = resultBoxIsOpen(graph.getModel(), cell);
            if ((mark === '[+]' && !open) || (mark !== '[+]' && open)) toggleResultBox(graph, cell);
        }
        return true;
    }
    window.expandResultMarkerAtEvent = function (graph, evt, cell) {
        return activateMarker(graph, evt, cell);
    };
    document.addEventListener('mousemove', function (evt) {
        if (!evt) return;
        var graph = resultBoxGraph();
        if (!graph || !graph.container) return;
        if (resultMarkerUnderPointer(graph, evt, null)) {
            graph.container.style.cursor = 'pointer';
            return;
        }
        var cell = resultCellAtEvent(graph, evt);
        var st = cell && graph.getModel ? (graph.getModel().getStyle(cell) || '') : '';
        if (cell && isResultPlaceholderStyle(st) && resultClickInMarkerBand(graph, cell, evt)) {
            graph.container.style.cursor = 'pointer';
        }
    }, false);
    document.addEventListener('mousedown', function (evt) {
        if (!evt || evt.button !== 0) return;
        var graph = resultBoxGraph();
        if (!activateMarker(graph, evt, null)) return;
        if (typeof mxEvent !== 'undefined' && mxEvent.consume) mxEvent.consume(evt);
        if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
    }, true);
}

function resultBoxPlainText(model, box) {
    var v = model.getValue(box);
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (v && v.textContent) return String(v.textContent);
    return String(v);
}

/**
 * Pin a result box to the element it describes.
 * Buses sit on the quiet side of the bar. Lines sit beside the longest segment.
 * Every other element (generator, wind turbine, transformer, load, shunt, …)
 * keeps its box on the symbol, on the side opposite a horizontal lead.
 */
function applyResultBoxPlacement(graph, box, owner, opts) {
    if (!graph || !box || !owner || owner === box) return;
    if (resultLayoutPinned(owner)) return;
    var model = graph.getModel ? graph.getModel() : graph.model;
    if (!model || !model.getGeometry(box)) return;
    var geo = model.getGeometry(box);
    var text = resultBoxPlainText(model, box);
    var storedFull = readStoredFullResult(model, box);
    var full = (looksLikeFullResult(text) ? text : '') || storedFull || text;
    if (full && model.getStyle) {
        var encoded = encodeResultText(full);
        if (encoded) writeResultBoxStyle(model, box, 'elxxxFull', encoded);
    }
    var open = resultBoxIsOpen(model, box);
    var summary = compactDiagramResult(full);
    var canToggle = !!(full && summary !== full);
    var shown = open
        ? (full + (canToggle ? '\n' + resultToggleMarker(true) : ''))
        : (summary + (canToggle ? '\n' + resultToggleMarker(false) : ''));
    if (shown !== text && model.setValue) model.setValue(box, shown);
    text = shown;
    var sized = open ? fullBoxSize(full) : summaryBoxSize(canToggle ? summary + '\n[+]' : summary);
    var w = sized.w;
    var h = sized.h;
    var boxStyle = (model.getStyle && model.getStyle(box)) || box.style || '';
    if (model.setStyle && typeof mxUtils !== 'undefined' && mxUtils.setStyle) {
        boxStyle = mxUtils.setStyle(boxStyle, 'html', '1');
        boxStyle = mxUtils.setStyle(boxStyle, 'verticalAlign', 'middle');
        boxStyle = mxUtils.setStyle(boxStyle, 'align', 'center');
        boxStyle = mxUtils.setStyle(boxStyle, 'spacingTop', '2');
        boxStyle = mxUtils.setStyle(boxStyle, 'spacingLeft', '2');
        if (boxStyle.indexOf('overflow=visible') >= 0) boxStyle = boxStyle.replace('overflow=visible', 'overflow=hidden');
        else if (boxStyle.indexOf('overflow=hidden') < 0) boxStyle += ';overflow=hidden';
        model.setStyle(box, boxStyle);
    } else if (model.setStyle && boxStyle.indexOf('overflow=hidden') < 0) {
        model.setStyle(box, boxStyle + ';overflow=hidden');
    }
    var style = (model.getStyle && model.getStyle(owner)) || owner.style || '';
    if (isResultPlaceholderStyle(style)) return;

    if (looksLikeTransformerResult(full || text)) {
        var trafoOwner = transformerOwnerForResult(graph, owner, box);
        if (trafoOwner && trafoOwner !== owner) {
            writeResultBoxStyle(model, box, 'connectedTo', String(trafoOwner.id));
            applyResultBoxPlacement(graph, box, trafoOwner, {
                forcePlace: true,
                fromToggle: !!(opts && opts.fromToggle)
            });
            return;
        }
    }

    if (resultBoxUserMoved(graph, box) && !(opts && opts.forcePlace)) {
        var parkedBeside = isTransformerStyle(style) && transformerBoxIsBesideSymbol(owner, box);
        if (!isTransformerStyle(style) || parkedBeside) {
            if (opts && opts.fromToggle) {
                var kept = model.getGeometry(box);
                if (kept) {
                    var resized = kept.clone();
                    resized.width = w;
                    resized.height = h;
                    model.setGeometry(box, resized);
                }
            }
            return;
        }
    }

    if (isBusStyle(style)) {
        if (model.getParent(box) !== owner && model.add) model.add(owner, box);
        var busSide = busQuietSide(graph, owner);
        var frac = busEquipmentFraction(graph, owner);
        if (!open) {
            var gaps = freeGapsAround(graph, owner);
            var above = gaps.above >= gaps.below;
            var room = Math.max(44, Math.min(above ? gaps.above : gaps.below, 76) - 6);
            w = room;
            h = room + (canToggle ? 12 : 0);
            if (above) setResultBoxGeometry(model, box, frac, 0, w, h, 4, -(h + 4));
            else setResultBoxGeometry(model, box, frac, 1, w, h, 4, 4);
        } else if (busSide === 'below') {
            setResultBoxGeometry(model, box, frac, 1, w, h, 4, 4);
        } else {
            setResultBoxGeometry(model, box, frac, 0, w, h, 4, -(h + 4));
        }
        return;
    }

    if (owner.edge) {
        var comp = null;
        var taggedId = connectedOwnerId((model.getStyle && model.getStyle(box)) || box.style || '');
        var ends = [owner.source, owner.target];
        var ei;
        // A transformer result that was dropped on the lead (even a Line lead) belongs beside the symbol.
        for (ei = 0; ei < ends.length; ei++) {
            var term = ends[ei];
            if (!term || term.edge) continue;
            if (taggedId && taggedId === String(term.id) && isTransformerStyle(styleOf(model, term))) {
                comp = term;
                break;
            }
        }
        if (!comp && !isLineStyle(style)) {
            if (owner.source && !isBusStyle(styleOf(model, owner.source))) comp = owner.source;
            if (!comp && owner.target && !isBusStyle(styleOf(model, owner.target))) comp = owner.target;
        }
        if (comp && comp !== box && !comp.edge) {
            applyResultBoxPlacement(graph, box, comp, opts);
            return;
        }
        if (model.getParent(box) !== owner && model.add) model.add(owner, box);
        if (!open) {
            w = Math.min(w, 64);
            h = w + (canToggle ? 12 : 0);
        }
        var linePts = edgeModelPoints(graph, owner);
        var line = lineAnchorFromPoints(linePts);
        var lane = lineLaneOf(owner) * 10;
        if (line.vertical) {
            setResultBoxGeometry(model, box, line.geoX, 0, w, h, -(w + RESULT_BOX_GAP + lane), -h / 2);
        } else {
            setResultBoxGeometry(model, box, line.geoX, 0, w, h, -w / 2, -(h + RESULT_BOX_GAP + lane));
        }
        return;
    }

    if (model.getParent(box) !== owner && model.add) model.add(owner, box);
    if (!open && owner.geometry && !owner.geometry.relative) {
        var ownerSide = Math.max(48, Math.min(owner.geometry.height || 72, owner.geometry.width || 72, 80));
        w = ownerSide;
        h = ownerSide + (canToggle ? 12 : 0);
    }
    var side = componentBoxSide(graph, owner);
    // Transformers sit between two buses. Keep the card beside the windings, clear of both bars.
    if (isTransformerStyle(style) && side !== 'left') side = 'right';
    placeBoxBesideVertex(model, box, owner, side, w, h);
}

function isNewlyWrittenResult(model, box) {
    var text = String(resultBoxPlainText(model, box) || '').trim();
    if (!looksLikeFullResult(text)) return false;
    var stored = String(readStoredFullResult(model, box) || '').trim();
    return !stored || stored !== text;
}

function dedupeResultBoxes(graph, boxes) {
    var model = graph.getModel();
    var groups = {};
    var order = [];
    var i;
    for (i = 0; i < boxes.length; i++) {
        var owner = resolveResultOwner(graph, boxes[i]);
        if (owner && resultLayoutPinned(owner)) continue;
        var boxText = resultBoxPlainText(model, boxes[i]) || readStoredFullResult(model, boxes[i]);
        if (looksLikeTransformerResult(boxText)) {
            var trafoOwner = transformerOwnerForResult(graph, owner, boxes[i]);
            if (trafoOwner) owner = trafoOwner;
        }
        var key = owner && owner.id != null ? ('o:' + owner.id) : ('b:' + boxes[i].id);
        if (!groups[key]) {
            groups[key] = [];
            order.push(key);
        }
        groups[key].push(boxes[i]);
    }
    var drop = {};
    var k;
    for (k = 0; k < order.length; k++) {
        var list = groups[order[k]];
        if (list.length < 2) continue;
        var fresh = [];
        var j;
        for (j = 0; j < list.length; j++) {
            if (isNewlyWrittenResult(model, list[j])) fresh.push(list[j]);
        }
        var keep = fresh.length ? fresh[fresh.length - 1] : list[0];
        for (j = 0; j < list.length; j++) {
            if (list[j] !== keep) drop[String(list[j].id)] = list[j];
        }
    }
    var kept = [];
    for (i = 0; i < boxes.length; i++) {
        if (!drop[String(boxes[i].id)]) {
            kept.push(boxes[i]);
            continue;
        }
        try { model.remove(boxes[i]); } catch (e) { /* ignore */ }
    }
    return kept;
}

function repositionAllResultBoxes(graph) {
    if (!graph || !graph.getModel) return;
    var model = graph.getModel();
    var root = model.getRoot && model.getRoot();
    if (!root) return;
    repairMalformedTransformerStyles(graph);
    if (graph.view && graph.view.validate) {
        try { graph.view.validate(); } catch (e) { /* ignore */ }
    }
    var boxes = [];
    var stack = [root];
    while (stack.length) {
        var cell = stack.pop();
        var n = model.getChildCount(cell);
        var ci;
        for (ci = 0; ci < n; ci++) stack.push(model.getChildAt(cell, ci));
        var st = (model.getStyle(cell) || '');
        if (isResultPlaceholderStyle(st)) boxes.push(cell);
    }
    if (!boxes.length) return;
    installResultBoxToggle();
    installResultBoxMoveMemory(graph);

    graph._elxxxPlacingResults = true;
    model.beginUpdate();
    try {
        boxes = dedupeResultBoxes(graph, boxes);
        for (var i = 0; i < boxes.length; i++) {
            try {
                if (!resultBoxUserMoved(graph, boxes[i])) {
                    var bst = model.getStyle(boxes[i]) || '';
                    if (styleKeyValue(bst, 'elxxxUserPos') === '1') writeResultBoxStyle(model, boxes[i], 'elxxxUserPos', null);
                }
                var owner = resolveResultOwner(graph, boxes[i]);
                if (owner && resultLayoutPinned(owner)) continue;
                applyResultBoxPlacement(graph, boxes[i], owner, null);
            } catch (err) { /* one bad box must not drop the rest */ }
        }
        if (typeof graph.orderCells === 'function') {
            try { graph.orderCells(true, boxes); } catch (e2) { /* ignore */ }
        }
        placeTransformerResultsBeside(graph);
    } finally {
        model.endUpdate();
        graph._elxxxPlacingResults = false;
    }
    if (graph.view && graph.view.validate) {
        try { graph.view.validate(); } catch (e2) { /* ignore */ }
    }
}

function graphPointOfState(view, state) {
    var sc = (view && view.scale) || 1;
    var tr = (view && view.translate) || { x: 0, y: 0 };
    return {
        x: state.x / sc - tr.x,
        y: state.y / sc - tr.y,
        w: state.width / sc,
        h: state.height / sc
    };
}

function parentOrigin(model, cell) {
    var x = 0;
    var y = 0;
    var p = model.getParent(cell);
    var guard = 0;
    while (p && guard < 12) {
        var g = model.getGeometry(p);
        if (g && !g.relative) {
            x += g.x || 0;
            y += g.y || 0;
        }
        p = model.getParent(p);
        guard++;
    }
    return { x: x, y: y };
}

function pointAlongPolyline(points, fraction) {
    if (!points || points.length < 2) return null;
    var segs = [];
    var total = 0;
    var i;
    for (i = 1; i < points.length; i++) {
        var dx = points[i].x - points[i - 1].x;
        var dy = points[i].y - points[i - 1].y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        segs.push({ len: len, dx: dx, dy: dy, x: points[i - 1].x, y: points[i - 1].y, start: total });
        total += len;
    }
    if (!total) return { x: points[0].x, y: points[0].y };
    var dist = Math.max(0, Math.min(1, fraction)) * total;
    var seg = segs[segs.length - 1];
    for (i = 0; i < segs.length; i++) {
        if (dist <= segs[i].start + segs[i].len) { seg = segs[i]; break; }
    }
    var t = seg.len ? (dist - seg.start) / seg.len : 0;
    return { x: seg.x + seg.dx * t, y: seg.y + seg.dy * t };
}

function resultBoxModelRect(graph, box) {
    var model = graph.getModel();
    var geo = model.getGeometry(box);
    if (!geo) return null;
    var parent = model.getParent(box);
    var ox = geo.offset ? geo.offset.x : 0;
    var oy = geo.offset ? geo.offset.y : 0;
    if (parent && parent.edge) {
        var pt = pointAlongPolyline(edgeModelPoints(graph, parent), ((Number(geo.x) || 0) / 2) + 0.5);
        if (!pt) return null;
        return { x: pt.x + ox, y: pt.y + oy, w: geo.width || 70, h: geo.height || 40 };
    }
    var origin = parentOrigin(model, box);
    var pg = parent && model.getGeometry(parent);
    var pw = pg && !pg.relative ? (pg.width || 0) : 0;
    var ph = pg && !pg.relative ? (pg.height || 0) : 0;
    return {
        x: origin.x + (geo.relative ? (geo.x || 0) * pw : (geo.x || 0)) + ox,
        y: origin.y + (geo.relative ? (geo.y || 0) * ph : (geo.y || 0)) + oy,
        w: geo.width || 70,
        h: geo.height || 40
    };
}

function separatePlacedResultBoxes(graph, boxes) {
    if (!graph || !boxes || boxes.length < 2) return;
    var model = graph.getModel();
    var rects = [];
    var usable = [];
    var i;
    for (i = 0; i < boxes.length; i++) {
        var rect = resultBoxModelRect(graph, boxes[i]);
        if (!rect || rect.w < 2 || rect.h < 2) continue;
        rects.push(rect);
        usable.push(boxes[i]);
    }
    if (usable.length < 2) return;
    var obstacles = [];
    var root = model.getRoot && model.getRoot();
    var stack = root ? [root] : [];
    while (stack.length) {
        var cell = stack.pop();
        var n = model.getChildCount(cell);
        var ci;
        for (ci = 0; ci < n; ci++) stack.push(model.getChildAt(cell, ci));
        if (!cell || cell.edge) continue;
        var cst = model.getStyle(cell) || '';
        if (isResultPlaceholderStyle(cst)) continue;
        if (!isBusStyle(cst) && cst.indexOf('shapeELXXX=') < 0) continue;
        var sym = (function () {
            var g = model.getGeometry(cell);
            if (!g || g.relative) return null;
            var o = parentOrigin(model, cell);
            return { x: o.x + g.x, y: o.y + g.y, w: g.width || 0, h: g.height || 0 };
        })();
        if (!sym || sym.w < 4 || sym.h < 4) continue;
        if (isBusStyle(cst)) {
            sym.y += sym.h / 2 - 2;
            sym.h = 4;
        }
        obstacles.push(sym);
    }
    var shifts = separateBoxRects(rects, obstacles, 6);
    model.beginUpdate();
    try {
        for (i = 0; i < usable.length; i++) {
            var shift = shifts[i];
            if (!shift || (shift.dx === 0 && shift.dy === 0)) continue;
            var geo = model.getGeometry(usable[i]);
            if (!geo) continue;
            var ng = geo.clone();
            var ox = geo.offset ? geo.offset.x : 0;
            var oy = geo.offset ? geo.offset.y : 0;
            if (typeof mxPoint !== 'undefined') ng.offset = new mxPoint(ox + shift.dx, oy + shift.dy);
            model.setGeometry(usable[i], ng);
        }
    } finally {
        model.endUpdate();
    }
}

/**
 * Insert a result box with proper geometry and styling.
 * Used by loadflowOpenDss.js, shortCircuit.js (loadFlow.js has its own inline version).
 * @param {mxGraph} graph - The mxGraph instance
 * @param {mxCell} parent - Parent cell (vertex or edge)
 * @param {string} resultString - Content to display
 * @param {object} opts - { width, height, positionX, positionY, offsetXDelta, offsetYDelta, isLine }
 */
function insertResultBox(graph, parent, resultString, opts) {
    if (!graph || !parent) return null;
    var w = (opts && opts.width) || 70;
    var h = (opts && opts.height) || 50;
    var px = (opts && typeof opts.positionX === 'number') ? opts.positionX : -0.3;
    var py = (opts && typeof opts.positionY === 'number') ? opts.positionY : 0;
    var offsetXDelta = (opts && typeof opts.offsetXDelta === 'number') ? opts.offsetXDelta : 0;
    var offsetYDelta = (opts && typeof opts.offsetYDelta === 'number') ? opts.offsetYDelta : 0;
    var isLine = (opts && opts.isLine) || (px === 0.5 || px === 0.2);
    var offsetY = isLine ? -h / 2 - 10 + offsetYDelta : -h / 2 - 5 + offsetYDelta;
    var offsetX = -w / 2 + offsetXDelta;
    var boxStyle = RESULT_BOX_STYLE;
    if (opts && opts.connectedToId != null && opts.connectedToId !== '') {
        boxStyle = typeof mxUtils !== 'undefined' && mxUtils.setStyle
            ? mxUtils.setStyle(boxStyle, 'connectedTo', String(opts.connectedToId))
            : boxStyle + ';connectedTo=' + String(opts.connectedToId);
    }
    var cell = graph.insertVertex(parent, null, resultString, px, py, w, h, boxStyle, true);
    if (cell && typeof mxPoint !== 'undefined') {
        var model = graph.getModel();
        var geo = model.getGeometry(cell);
        if (geo) {
            geo.relative = true;
            geo.x = px;
            geo.y = py;
            geo.offset = new mxPoint(offsetX, offsetY);
            model.setGeometry(cell, geo);
        }
    }
    if (cell) {
        var owner = parent;
        if (opts && opts.ownerCell) owner = opts.ownerCell;
        else if (opts && opts.connectedToId != null && opts.connectedToId !== '' && graph.getModel) {
            var found = graph.getModel().getCell(String(opts.connectedToId));
            if (found) owner = found;
        }
        applyResultBoxPlacement(graph, cell, owner, { width: w, height: h });
    }
    return cell;
}

/**
 * Find existing result placeholder child of parentCell (from resultBoxes.js placeholders).
 * Used by loadFlow.js, loadflowOpenDss.js, shortCircuit.js - update in place instead of remove+insert.
 * @param {mxGraph} graph - The mxGraph instance
 * @param {mxCell} parentCell - Parent cell (vertex or edge) to search
 * @returns {mxCell|null} The placeholder cell or null
 */
function findResultPlaceholder(graph, parentCell) {
    if (!graph || !parentCell || !graph.getModel) return null;
    var model = graph.getModel();
    var childCount = model.getChildCount(parentCell);
    var isResultStyle = function(s) {
        return s && (s.indexOf('shapeELXXX=ResultBus') >= 0 || s.indexOf('shapeELXXX=Result') >= 0 || s.indexOf('shapeELXXX=ResultExternalGrid') >= 0);
    };
    var wantedOnEdge = function (style) {
        var id = connectedOwnerId(style);
        if (!id) return true;
        return id === String(parentCell.id);
    };
    for (var i = 0; i < childCount; i++) {
        var child = model.getChildAt(parentCell, i);
        if (!child || !isResultStyle(model.getStyle(child))) continue;
        var cst = model.getStyle(child) || '';
        if (parentCell.edge ? wantedOnEdge(cst) : (connectedOwnerId(cst) === '' || connectedOwnerId(cst) === String(parentCell.id))) {
            return child;
        }
    }
    // Boxes parented to the symbol are still found from the lead, but a bus box is not.
    if (parentCell.edge) {
        var ends = [parentCell.source, parentCell.target];
        for (var ei = 0; ei < ends.length; ei++) {
            var term = ends[ei];
            if (!term) continue;
            var termStyle = (model.getStyle && model.getStyle(term)) || term.style || '';
            if (isBusStyle(termStyle)) continue;
            var tn = model.getChildCount(term);
            for (var ti = 0; ti < tn; ti++) {
                var tchild = model.getChildAt(term, ti);
                if (!tchild || !isResultStyle(model.getStyle(tchild))) continue;
                var tst = model.getStyle(tchild) || '';
                var tid = connectedOwnerId(tst);
                if (!tid || tid === String(term.id)) return tchild;
            }
        }
    }
    return null;
}

/**
 * Result boxes created via createResultPlaceholder carry connectedTo=&lt;component id&gt;.
 * If placeholderId on a cell was copied from another element, getCell(placeholderId) can point
 * at the wrong box — reject unless connectedTo matches this component.
 */
function resultPlaceholderBelongsToComponent(placeholder, componentCell, model) {
    if (!placeholder || !componentCell || !model) return false;
    var st = model.getStyle(placeholder) || '';
    var isResult = st.indexOf('shapeELXXX=ResultBus') >= 0 || st.indexOf('shapeELXXX=Result') >= 0 || st.indexOf('shapeELXXX=ResultExternalGrid') >= 0;
    if (!isResult) return false;
    var m = st.match(/connectedTo=([^;]+)/);
    if (!m) return true;
    return String(m[1]).trim() === String(componentCell.id);
}

/**
 * Find result placeholder for a component with multiple edges (e.g. Transformer, Three Winding Transformer).
 * Searches by placeholderId first (most reliable), then iterates all edges.
 * @param {mxGraph} graph - The mxGraph instance
 * @param {mxCell} componentCell - The component cell (transformer, external grid, etc.)
 * @returns {mxCell|null} The placeholder cell or null
 */
function findResultPlaceholderForComponent(graph, componentCell) {
    if (!graph || !componentCell || !graph.getModel) return null;
    var model = graph.getModel();
    var placeholderId = null;
    if (componentCell.value && componentCell.value.attributes) {
        var attr = componentCell.value.attributes.getNamedItem('placeholderId');
        if (attr) placeholderId = attr.nodeValue;
    }
    if (!placeholderId && componentCell.placeholderId) placeholderId = componentCell.placeholderId;
    if (placeholderId) {
        var ph = model.getCell(placeholderId);
        if (ph && resultPlaceholderBelongsToComponent(ph, componentCell, model)) return ph;
    }
    var directCount = model.getChildCount(componentCell);
    for (var d = 0; d < directCount; d++) {
        var directChild = model.getChildAt(componentCell, d);
        if (directChild && resultPlaceholderBelongsToComponent(directChild, componentCell, model)) return directChild;
    }
    var edges = (graph.getEdges && graph.getEdges(componentCell)) || componentCell.edges || [];
    var legacy = null;
    var compId = String(componentCell.id);
    for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];
        if (!edge) continue;
        var en = model.getChildCount(edge);
        var ec;
        for (ec = 0; ec < en; ec++) {
            var echild = model.getChildAt(edge, ec);
            if (!echild) continue;
            var est = model.getStyle(echild) || '';
            if (connectedOwnerId(est) === compId && resultPlaceholderBelongsToComponent(echild, componentCell, model)) {
                return echild;
            }
        }
        var found = findResultPlaceholder(graph, edge);
        if (!found) continue;
        if (resultPlaceholderBelongsToComponent(found, componentCell, model)) return found;
        var fst = model.getStyle(found) || '';
        if (!/connectedTo=/.test(fst)) legacy = legacy || found;
    }
    return legacy;
}

/**
 * Collect every result placeholder tied to a component (direct child or on incident edges
 * via connectedTo=id). Line vertices often get one placeholder per stub edge from addEdge.
 */
function findAllResultPlaceholdersForComponent(graph, componentCell) {
    var found = [];
    if (!graph || !componentCell || !graph.getModel) return found;
    var model = graph.getModel();
    var compId = String(componentCell.id);
    var isResultStyle = function(s) {
        return s && (s.indexOf('shapeELXXX=ResultBus') >= 0 || s.indexOf('shapeELXXX=Result') >= 0 || s.indexOf('shapeELXXX=ResultExternalGrid') >= 0);
    };
    var matches = function(child, isDirectChild) {
        var st = model.getStyle(child) || '';
        if (!isResultStyle(st)) return false;
        var m = st.match(/connectedTo=([^;]+)/);
        // A direct child tagged for a different element must not be overwritten or deleted.
        if (m && String(m[1]).trim() !== compId) return false;
        if (isDirectChild) return true;
        return !!m;
    };
    var scan = function(parent, isDirectScan) {
        if (!parent) return;
        var n = model.getChildCount(parent);
        for (var i = 0; i < n; i++) {
            var child = model.getChildAt(parent, i);
            if (child && matches(child, isDirectScan)) {
                found.push({ placeholder: child, parent: parent });
            }
        }
    };
    scan(componentCell, true);
    var edges = (graph.getEdges && graph.getEdges(componentCell)) || componentCell.edges || [];
    for (var ei = 0; ei < edges.length; ei++) {
        scan(edges[ei], false);
    }
    return found;
}

/**
 * Update one result box for a component and remove duplicate placeholders.
 */
function updateOrCreateSinglePlaceholder(graph, componentCell, resultString, fallbackParent, opts) {
    if (!graph || !componentCell || !graph.getModel) return null;
    var model = graph.getModel();
    var all = findAllResultPlaceholdersForComponent(graph, componentCell);
    if (all.length > 0) {
        var keep = all[0].placeholder;
        model.setValue(keep, resultString);
        for (var i = 1; i < all.length; i++) {
            try { model.remove(all[i].placeholder); } catch (err) { /* ignore */ }
        }
        applyResultBoxPlacement(graph, keep, componentCell, opts);
        return keep;
    }
    var parent = fallbackParent || componentCell;
    return insertResultBox(graph, parent, resultString, {
        width: (opts && opts.width) || 70,
        height: (opts && opts.height) || 50,
        positionX: (opts && typeof opts.positionX === 'number') ? opts.positionX : 0.5,
        positionY: (opts && typeof opts.positionY === 'number') ? opts.positionY : 0,
        offsetXDelta: (opts && opts.offsetXDelta) || 0,
        offsetYDelta: (opts && opts.offsetYDelta) || 0,
        isLine: opts && opts.isLine,
        connectedToId: componentCell.id
    });
}

function cellStyleOf(model, cell) {
    if (!cell) return '';
    if (model && model.getStyle) {
        var s = model.getStyle(cell);
        if (s) return s;
    }
    if (cell.getStyle) {
        try {
            var gs = cell.getStyle();
            if (gs) return gs;
        } catch (e) { /* ignore */ }
    }
    return cell.style || '';
}

function indexStudyResultRows(rows) {
    var byId = {};
    var byName = {};
    function put(map, key, row) {
        if (key == null || key === '') return;
        var s = String(key);
        map[s] = row;
        map[s.replace(/#/g, '_')] = row;
        map[s.replace(/_/g, '#')] = row;
        map[s.toLowerCase()] = row;
    }
    if (!Array.isArray(rows)) return { byId: byId, byName: byName };
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row) continue;
        put(byId, row.id, row);
        put(byName, row.name, row);
        put(byName, row.dialogName, row);
        put(byName, row.userFriendlyName, row);
    }
    return { byId: byId, byName: byName };
}

function matchStudyRowToBus(busCell, index) {
    if (!busCell || !index) return null;
    var id = busCell.id != null ? String(busCell.id) : '';
    var mx = busCell.mxObjectId ? String(busCell.mxObjectId) : '';
    var mxU = mx.replace(/#/g, '_');
    var dn = '';
    try {
        if (busCell.value && busCell.value.attributes && busCell.value.attributes.getNamedItem) {
            var n = busCell.value.attributes.getNamedItem('name');
            if (n && n.nodeValue) dn = String(n.nodeValue).trim();
        }
    } catch (e) { /* ignore */ }
    return index.byId[id]
        || index.byName[mx]
        || index.byName[mxU]
        || index.byName[mx.replace(/_/g, '#')]
        || (dn ? (index.byName[dn] || index.byName[dn.toLowerCase()]) : null)
        || null;
}

function busCellForPlaceholder(model, placeholder) {
    if (!model || !placeholder) return null;
    var parent = model.getParent(placeholder);
    var pst = cellStyleOf(model, parent);
    if (parent && isBusStyle(pst)) return parent;
    var st = cellStyleOf(model, placeholder);
    var m = st.match(/connectedTo=([^;]+)/);
    if (m) {
        var bid = String(m[1]).trim();
        var bus = model.getCell(bid);
        if (bus && isBusStyle(cellStyleOf(model, bus))) return bus;
        var cells = model.cells || {};
        for (var ck in cells) {
            var c = cells[ck];
            if (c && String(c.id) === bid && isBusStyle(cellStyleOf(model, c))) return c;
        }
    }
    return null;
}

function setResultPlaceholderValue(graph, placeholder, text) {
    if (!graph || !placeholder) return;
    var model = graph.model || (graph.getModel && graph.getModel());
    if (!model || !model.setValue) return;
    model.setValue(placeholder, text);
    if (graph.view && graph.view.invalidate) {
        try { graph.view.invalidate(placeholder); } catch (e) { /* ignore */ }
    }
}

/**
 * Write study values onto existing bus ResultBus/Result placeholders (resultBoxes.js).
 * Walks the diagram placeholders first so the boxes the user sees are updated.
 *
 * @param {mxGraph} graph
 * @param {Array<object>} rows - backend bus result rows ({id, name, ...})
 * @param {function(row, busCell): string} formatText
 * @returns {{updated:number, created:number}}
 */
function applyBusPlaceholderResults(graph, rows, formatText) {
    var empty = { updated: 0, created: 0 };
    if (!graph || typeof formatText !== 'function') return empty;
    var model = graph.model || (graph.getModel && graph.getModel());
    if (!model) return empty;
    runUpgradeOnce(graph);
    var index = indexStudyResultRows(rows);
    var updated = 0;
    var created = 0;
    var busesTouched = {};

    function visit(cell) {
        if (!cell) return;
        var style = cellStyleOf(model, cell);
        if (isResultPlaceholderStyle(style)) {
            var bus = busCellForPlaceholder(model, cell);
            var row = matchStudyRowToBus(bus, index);
            if (row && bus) {
                setResultPlaceholderValue(graph, cell, formatText(row, bus));
                busesTouched[String(bus.id)] = true;
                updated++;
            }
        }
        var n = model.getChildCount(cell);
        for (var i = 0; i < n; i++) visit(model.getChildAt(cell, i));
    }
    var root = model.getRoot ? model.getRoot() : null;
    if (root) visit(root);

    if (Array.isArray(rows)) {
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (!row) continue;
            var bus = null;
            if (row.id != null) bus = model.getCell(row.id) || model.getCell(String(row.id));
            if ((!bus || !isBusStyle(cellStyleOf(model, bus))) && model.cells) {
                var wantName = row.name != null ? String(row.name).replace(/#/g, '_') : '';
                for (var ck in model.cells) {
                    var c = model.cells[ck];
                    if (!c || !isBusStyle(cellStyleOf(model, c))) continue;
                    if (row.id != null && String(c.id) === String(row.id)) { bus = c; break; }
                    var mx = c.mxObjectId ? String(c.mxObjectId).replace(/#/g, '_') : '';
                    if (wantName && mx === wantName) { bus = c; break; }
                }
            }
            if (!bus || !isBusStyle(cellStyleOf(model, bus))) continue;
            if (busesTouched[String(bus.id)]) continue;
            var ph = findResultPlaceholder(graph, bus);
            if (!ph) {
                createBusResultPlaceholder(graph, bus);
                ph = findResultPlaceholder(graph, bus);
            }
            if (ph) {
                setResultPlaceholderValue(graph, ph, formatText(row, bus));
                created++;
            }
        }
    }

    if (graph.view) {
        try {
            if (graph.view.validate) graph.view.validate();
            if (graph.view.refresh) graph.view.refresh();
        } catch (e) { /* ignore */ }
    }
    return { updated: updated, created: created };
}

if (typeof window !== 'undefined') {
    window.RESULT_BOX_STYLE = RESULT_BOX_STYLE;
    window.insertResultBox = insertResultBox;
    window.findResultPlaceholder = findResultPlaceholder;
    window.findResultPlaceholderForComponent = findResultPlaceholderForComponent;
    window.findAllResultPlaceholdersForComponent = findAllResultPlaceholdersForComponent;
    window.updateOrCreateSinglePlaceholder = updateOrCreateSinglePlaceholder;
    window.applyBusPlaceholderResults = applyBusPlaceholderResults;
    window.setResultPlaceholderValue = setResultPlaceholderValue;
    window.applyResultBoxPlacement = applyResultBoxPlacement;
    window.__elxxxResultBoxesBuild = 35;
    window.placeResultBoxBesideVertex = function (graph, box, owner, side) {
        var model = graph && graph.getModel ? graph.getModel() : null;
        var geo = model && box ? model.getGeometry(box) : null;
        if (!geo || !owner) return;
        placeBoxBesideVertex(model, box, owner, side || 'right', geo.width || 72, geo.height || 72);
    };
    window.repositionAllResultBoxes = repositionAllResultBoxes;
    window.placeTransformerResultsBeside = placeTransformerResultsBeside;
    window.toggleResultBox = toggleResultBox;
}

//=============================================================================
// COMPOSITE BLOCK SUPPORT
// Creates result placeholders for component-to-bus edges in composite blocks
// (e.g. BESS AC block) where edges are imported as a group and don't trigger addEdge
//=============================================================================

function createResultPlaceholdersForCompositeBlock(graph, cells) {
    if (!graph || !cells) return;
    for (var i = 0; i < cells.length; i++) {
        var edgeCell = cells[i];
        if (!edgeCell || !edgeCell.edge) continue;
        var src = edgeCell.source, tgt = edgeCell.target;
        if (!src || !tgt) continue;
        var srcStyle = src.style || '', tgtStyle = tgt.style || '';
        var srcIsBus = isBusStyle(srcStyle);
        var tgtIsBus = isBusStyle(tgtStyle);
        if (!(srcIsBus && !tgtIsBus) && !(tgtIsBus && !srcIsBus)) continue;

        var componentCell = srcIsBus ? tgt : src;
        var componentShape = getShapeElxxx(componentCell.style || '');
        if (!componentShape || componentShape === 'Line') continue;

        var hasPlaceholder = false;
        var childCount = graph.model.getChildCount(edgeCell);
        for (var j = 0; j < childCount; j++) {
            var child = graph.model.getChildAt(edgeCell, j);
            if (child && isResultPlaceholderStyle(child.style || '')) {
                hasPlaceholder = true;
                break;
            }
        }
        if (hasPlaceholder) continue;

        if (isTransformerShape(componentShape) && componentCell.edges) {
            for (var e = 0; e < componentCell.edges.length; e++) {
                var existingEdge = componentCell.edges[e];
                if (!existingEdge) continue;
                var ec = graph.model.getChildCount(existingEdge);
                for (var k = 0; k < ec; k++) {
                    var ech = graph.model.getChildAt(existingEdge, k);
                    if (ech && isResultPlaceholderStyle(ech.style || '')) {
                        hasPlaceholder = true;
                        break;
                    }
                }
                if (hasPlaceholder) break;
            }
            if (hasPlaceholder) continue;
        }

        var isExtGrid = (componentShape === 'External Grid' || componentShape === 'Source 1ph');
        var isBessTrafoOrStorage = (componentShape === 'Transformer' || componentShape === 'Transformer 1ph' || componentShape === 'Storage');
        createResultPlaceholder(graph, edgeCell, componentCell, {
            logicalShape: isExtGrid ? 'ResultExternalGrid' : 'Result',
            width: isExtGrid ? 95 : 70,
            height: isExtGrid ? 58 : 50,
            positionX: -0.3,
            offsetXDelta: isBessTrafoOrStorage ? 10 : 0,
            offsetYDelta: isBessTrafoOrStorage ? 10 : 0
        });
    }
}

if (typeof window !== 'undefined') {
    window.createResultPlaceholdersForCompositeBlock = createResultPlaceholdersForCompositeBlock;
}

//=============================================================================
// CLONING SUPPORT - Update placeholders when cells are cloned/duplicated
// Supports: Bus, Line, and all component result placeholders
// Compatible with: loadFlow.js, loadflowOpenDss.js, shortCircuit.js
//=============================================================================

/**
 * Helper to detect if a child cell is a result placeholder.
 * Handles all styles used by different analysis types:
 * - ResultBus: Created by resultBoxes.js for initial Bus placeholders
 * - Result: Used by loadFlow.js, loadflowOpenDss.js, and shortCircuit.js
 * - ResultExternalGrid: Used for External Grid components
 */
function isResultPlaceholderStyle(style) {
    if (!style) return false;
    return style.includes('shapeELXXX=ResultBus') ||
           style.includes('shapeELXXX=Result') ||
           style.includes('shapeELXXX=ResultExternalGrid');
}

/**
 * Upgrades result placeholders to dashed/transparent format (light grey dashed border, semi-transparent).
 * Converts solid-style placeholders to match the target format.
 */
function upgradeResultPlaceholderStyles(graph) {
    if (!graph || !graph.getModel) return;
    var model = graph.getModel();
    var upgraded = 0;
    function visit(cell) {
        if (!cell) return;
        var style = model.getStyle(cell) || '';
        if (isResultPlaceholderStyle(style) && (style.indexOf('fillColor=#FFFFFF') >= 0 || style.indexOf('dashed=0') >= 0)) {
            var newStyle = style
                .replace(/fillColor=#FFFFFF/g, 'fillColor=#F8F9FA')
                .replace(/strokeColor=#495057/g, 'strokeColor=#6C757D')
                .replace(/strokeWidth=1;/g, 'strokeWidth=1.5;')
                .replace(/dashed=0/g, 'dashed=1')
                .replace(/opacity=100/g, 'opacity=70');
            if (newStyle.indexOf('dashPattern=') < 0) newStyle = newStyle.replace('dashed=1', 'dashed=1;dashPattern=5 5');
            if (newStyle !== style) {
                model.setStyle(cell, newStyle);
                upgraded++;
            }
        }
        var childCount = model.getChildCount(cell);
        for (var i = 0; i < childCount; i++) visit(model.getChildAt(cell, i));
    }
    var root = model.getRoot();
    if (root) visit(root);
    if (upgraded > 0) console.log('ELXXX: Upgraded', upgraded, 'result placeholder(s) to dashed format');
}

/**
 * Helper to detect if a cell is a Line element
 */
function shapeElxxxName(style) {
    var m = String(style || '').match(/(?:^|;)shapeELXXX=([^;]+)/);
    if (!m) return '';
    return m[1].indexOf('Transformerrotation') === 0 ? 'Transformer' : m[1];
}

/** Older map imports wrote `shapeELXXX=Transformerrotation=180` (missing `;`). */
function repairMalformedTransformerStyles(graph) {
    if (!graph || !graph.getModel) return 0;
    var model = graph.getModel();
    var root = model.getRoot && model.getRoot();
    if (!root) return 0;
    var fixed = 0;
    var stack = [root];
    while (stack.length) {
        var cell = stack.pop();
        var n = model.getChildCount(cell);
        for (var i = 0; i < n; i++) stack.push(model.getChildAt(cell, i));
        var st = String(model.getStyle(cell) || '');
        if (st.indexOf('shapeELXXX=Transformerrotation') >= 0) {
            var repaired = st.replace('shapeELXXX=Transformerrotation', 'shapeELXXX=Transformer;rotation');
            if (model.setStyle) model.setStyle(cell, repaired);
            else cell.style = repaired;
            fixed++;
        }
    }
    return fixed;
}

function isLineStyle(style) {
    var name = shapeElxxxName(style);
    return name === 'Line' || name === 'Line 1ph';
}

function isTransformerStyle(style) {
    return isTransformerShape(shapeElxxxName(style));
}

/**
 * Helper to detect if a shape is a Transformer (2-winding, 3-winding, or OpenDSS 1ph)
 * Transformers should only have ONE result placeholder, not one per edge
 */
function isTransformerShape(shape) {
    if (!shape) return false;
    return shape === 'Transformer' || shape === 'Three Winding Transformer' || shape === 'Transformer 1ph';
}

/**
 * Updates the result placeholder for a cloned Bus cell.
 * When a Bus is cloned, its placeholder child is also cloned but with wrong IDs.
 * This function updates the cloned placeholder to properly reference the new bus.
 * 
 * Handles both ResultBus (initial placeholders) and Result (OpenDSS/ShortCircuit) styles.
 */
function updateClonedBusPlaceholder(graph, clonedBusCell) {
    if (!graph || !clonedBusCell) return;

    var busStyle = clonedBusCell.style || '';
    if (!isBusStyle(busStyle)) return;

    graph.model.beginUpdate();
    try {
        // Find all result placeholder children (ResultBus, Result, etc.)
        var childCount = graph.model.getChildCount(clonedBusCell);
        var placeholderChildren = [];
        var faultMarkers = [];
        
        for (var i = 0; i < childCount; i++) {
            var child = graph.model.getChildAt(clonedBusCell, i);
            var childStyle = child.style || '';
            if (isResultPlaceholderStyle(childStyle)) {
                placeholderChildren.push(child);
            } else if (childStyle.indexOf('shapeELXXX=FaultMarker') >= 0) {
                faultMarkers.push(child);
            }
        }
        for (var fm = 0; fm < faultMarkers.length; fm++) {
            graph.model.remove(faultMarkers[fm]);
        }

        if (placeholderChildren.length > 0) {
            // Update all placeholder children
            for (var j = 0; j < placeholderChildren.length; j++) {
                var placeholderChild = placeholderChildren[j];
                
                // Get the new placeholder ID
                var newPlaceholderId = placeholderChild.id;
                if (!newPlaceholderId && placeholderChild.mxObjectId) {
                    newPlaceholderId = placeholderChild.mxObjectId.replace('#', '');
                }

                // Update the placeholder style with new connectedTo and placeholderId
                var oldStyle = placeholderChild.style || '';
                var newStyle = oldStyle
                    .replace(/connectedTo=[^;]+/, 'connectedTo=' + clonedBusCell.id)
                    .replace(/placeholderId=[^;]+/, 'placeholderId=' + newPlaceholderId);
                
                // If connectedTo wasn't in the style, add it
                if (!newStyle.includes('connectedTo=')) {
                    newStyle += ';connectedTo=' + clonedBusCell.id;
                }
                // If placeholderId wasn't in the style, add it
                if (!newStyle.includes('placeholderId=')) {
                    newStyle += ';placeholderId=' + newPlaceholderId;
                }
                
                graph.model.setStyle(placeholderChild, newStyle);

                // Reset placeholder content to default message
                graph.model.setValue(placeholderChild, 'Click Simulate to generate results');

                console.log('ELXXX: Updated cloned Bus result placeholder - Bus ID:', clonedBusCell.id, 'Placeholder ID:', newPlaceholderId, 'Style type:', oldStyle.includes('ResultBus') ? 'ResultBus' : 'Result');
            }
            
            // Update the Bus cell's placeholderId attribute to point to the first placeholder
            // (This is the primary one that loadFlow.js will use)
            var primaryPlaceholderId = placeholderChildren[0].id;
            if (!primaryPlaceholderId && placeholderChildren[0].mxObjectId) {
                primaryPlaceholderId = placeholderChildren[0].mxObjectId.replace('#', '');
            }
            
            if (clonedBusCell.value && typeof clonedBusCell.value.setAttribute === 'function') {
                clonedBusCell.value.setAttribute('placeholderId', primaryPlaceholderId);
                graph.model.setValue(clonedBusCell, clonedBusCell.value);
            } else {
                clonedBusCell.placeholderId = primaryPlaceholderId;
            }
        } else {
            // No placeholder child found - create a new one
            console.log('ELXXX: No placeholder found for cloned Bus, creating new one');
            // Clear any old placeholderId attribute first
            if (clonedBusCell.value && typeof clonedBusCell.value.setAttribute === 'function') {
                clonedBusCell.value.removeAttribute('placeholderId');
                graph.model.setValue(clonedBusCell, clonedBusCell.value);
            } else {
                delete clonedBusCell.placeholderId;
            }
            createBusResultPlaceholder(graph, clonedBusCell);
        }
    } catch (err) {
        console.error('ELXXX: Error updating cloned Bus placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

/**
 * Updates the result placeholder for a cloned Line cell.
 * When a Line is cloned, its placeholder child is also cloned but with wrong IDs.
 * This function updates the cloned placeholder to properly reference the new line.
 */
function updateClonedLinePlaceholder(graph, clonedLineCell) {
    if (!graph || !clonedLineCell) return;

    var lineStyle = clonedLineCell.style || '';
    if (!isLineStyle(lineStyle)) return;

    graph.model.beginUpdate();
    try {
        // Find all result placeholder children
        var childCount = graph.model.getChildCount(clonedLineCell);
        var placeholderChildren = [];
        
        for (var i = 0; i < childCount; i++) {
            var child = graph.model.getChildAt(clonedLineCell, i);
            var childStyle = child.style || '';
            if (isResultPlaceholderStyle(childStyle)) {
                placeholderChildren.push(child);
            }
        }

        if (placeholderChildren.length > 0) {
            // Update all placeholder children
            for (var j = 0; j < placeholderChildren.length; j++) {
                var placeholderChild = placeholderChildren[j];
                
                // Get the new placeholder ID
                var newPlaceholderId = placeholderChild.id;
                if (!newPlaceholderId && placeholderChild.mxObjectId) {
                    newPlaceholderId = placeholderChild.mxObjectId.replace('#', '');
                }

                // Update the placeholder style with new connectedTo and placeholderId
                var oldStyle = placeholderChild.style || '';
                var newStyle = oldStyle
                    .replace(/connectedTo=[^;]+/, 'connectedTo=' + clonedLineCell.id)
                    .replace(/placeholderId=[^;]+/, 'placeholderId=' + newPlaceholderId);
                
                // If connectedTo wasn't in the style, add it
                if (!newStyle.includes('connectedTo=')) {
                    newStyle += ';connectedTo=' + clonedLineCell.id;
                }
                // If placeholderId wasn't in the style, add it
                if (!newStyle.includes('placeholderId=')) {
                    newStyle += ';placeholderId=' + newPlaceholderId;
                }
                
                graph.model.setStyle(placeholderChild, newStyle);

                // Reset placeholder content to default message
                graph.model.setValue(placeholderChild, 'Click Simulate to generate results');

                console.log('ELXXX: Updated cloned Line result placeholder - Line ID:', clonedLineCell.id, 'Placeholder ID:', newPlaceholderId);
            }
            
            // Update the Line cell's placeholderId attribute
            var primaryPlaceholderId = placeholderChildren[0].id;
            if (!primaryPlaceholderId && placeholderChildren[0].mxObjectId) {
                primaryPlaceholderId = placeholderChildren[0].mxObjectId.replace('#', '');
            }
            
            if (clonedLineCell.value && typeof clonedLineCell.value.setAttribute === 'function') {
                clonedLineCell.value.setAttribute('placeholderId', primaryPlaceholderId);
                graph.model.setValue(clonedLineCell, clonedLineCell.value);
            } else {
                clonedLineCell.placeholderId = primaryPlaceholderId;
            }
        } else {
            // No placeholder child found - clear any stale placeholderId
            console.log('ELXXX: No placeholder found for cloned Line, clearing stale ID');
            if (clonedLineCell.value && typeof clonedLineCell.value.setAttribute === 'function') {
                clonedLineCell.value.removeAttribute('placeholderId');
                graph.model.setValue(clonedLineCell, clonedLineCell.value);
            } else {
                delete clonedLineCell.placeholderId;
            }
        }
    } catch (err) {
        console.error('ELXXX: Error updating cloned Line placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

/**
 * Updates the result placeholder for a cloned component cell (connected via edge).
 * Handles ALL components connected to buses via edges, including:
 * - External Grid, Generator, Static Generator, Asymmetric Static Generator
 * - Load, Asymmetric Load, Motor, Storage
 * - Transformer, Three Winding Transformer
 * - Shunt Reactor, Capacitor
 * - Impedance, Ward, Extended Ward
 * - SVC, TCSC, SSC, DC Line
 * 
 * Note: Each edge of a component gets its own placeholder. Components with multiple edges
 * (e.g., Transformers with HV and LV edges) will have multiple placeholders updated.
 */
function updateClonedComponentPlaceholder(graph, clonedCell) {
    if (!graph || !clonedCell) return;

    var cellStyle = clonedCell.style || '';
    // Skip if it's a Bus or Line (handled separately) or has no Electrisim shape
    if (isBusStyle(cellStyle) || isLineStyle(cellStyle)) return;
    if (!cellStyle.includes('shapeELXXX=')) return;
    
    // Check if cell has edges (components are connected to buses via edges)
    if (!clonedCell.edges || clonedCell.edges.length === 0) return;

    graph.model.beginUpdate();
    try {
        var firstPlaceholderId = null;
        
        // Find result placeholders in the connected edges
        for (var e = 0; e < clonedCell.edges.length; e++) {
            var edge = clonedCell.edges[e];
            if (!edge) continue;
            
            var childCount = graph.model.getChildCount(edge);
            for (var i = 0; i < childCount; i++) {
                var child = graph.model.getChildAt(edge, i);
                if (!child) continue;
                // Use model API for consistency
                var childStyle = graph.model.getStyle(child) || '';
                
                // Check if this is a result placeholder
                if (isResultPlaceholderStyle(childStyle)) {
                    // Get the new placeholder ID
                    var newPlaceholderId = child.id;
                    if (!newPlaceholderId && child.mxObjectId) {
                        newPlaceholderId = child.mxObjectId.replace('#', '');
                    }

                    // Update the placeholder style with new connectedTo and placeholderId
                    var oldStyle = childStyle;
                    var newStyle = oldStyle
                        .replace(/connectedTo=[^;]+/, 'connectedTo=' + clonedCell.id)
                        .replace(/placeholderId=[^;]+/, 'placeholderId=' + newPlaceholderId);
                    
                    // If connectedTo wasn't in the style, add it
                    if (!newStyle.includes('connectedTo=')) {
                        newStyle += ';connectedTo=' + clonedCell.id;
                    }
                    // If placeholderId wasn't in the style, add it
                    if (!newStyle.includes('placeholderId=')) {
                        newStyle += ';placeholderId=' + newPlaceholderId;
                    }
                    
                    graph.model.setStyle(child, newStyle);

                    // Reset placeholder content to default message
                    graph.model.setValue(child, 'Click Simulate to generate results');

                    // Store the first placeholder ID for the component cell (for backward compatibility)
                    // Note: Components can have multiple edges, each with its own placeholder
                    if (!firstPlaceholderId) {
                        firstPlaceholderId = newPlaceholderId;
                    }

                    console.log('ELXXX: Updated cloned component placeholder - Cell ID:', clonedCell.id, 'Edge:', edge.id, 'Placeholder ID:', newPlaceholderId);
                }
            }
        }
        
        // Update the component cell's placeholderId attribute with the first placeholder found
        // (for backward compatibility, though each edge has its own placeholder)
        if (firstPlaceholderId) {
            if (clonedCell.value && typeof clonedCell.value.setAttribute === 'function') {
                clonedCell.value.setAttribute('placeholderId', firstPlaceholderId);
                graph.model.setValue(clonedCell, clonedCell.value);
            } else {
                clonedCell.placeholderId = firstPlaceholderId;
            }
        } else {
            // No placeholder found on existing edges - clear any stale placeholderId
            // A new placeholder will be created when a new edge is drawn
            if (clonedCell.value && typeof clonedCell.value.setAttribute === 'function') {
                clonedCell.value.removeAttribute('placeholderId');
                graph.model.setValue(clonedCell, clonedCell.value);
            } else {
                delete clonedCell.placeholderId;
            }
        }
    } catch (err) {
        console.error('ELXXX: Error updating cloned component placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

/**
 * Process an array of cells and update placeholders for all element types.
 * Handles: Bus, Line, and all component cells with result placeholders.
 */
function processClonedCellsForPlaceholders(graph, cells) {
    if (!graph || !cells || cells.length === 0) return;

    for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        if (!cell) continue;
        
        var style = cell.style || '';
        
        if (isBusStyle(style)) {
            updateClonedBusPlaceholder(graph, cell);
        } else if (isLineStyle(style)) {
            updateClonedLinePlaceholder(graph, cell);
        } else if (style.includes('shapeELXXX=')) {
            // Other components (External Grid, Generator, Load, etc.)
            updateClonedComponentPlaceholder(graph, cell);
        }
    }
}

// Keep the old function name for backward compatibility
function processClonedCellsForBusPlaceholders(graph, cells) {
    processClonedCellsForPlaceholders(graph, cells);
}

// Make these functions globally available
if (typeof window !== 'undefined') {
    window.isResultPlaceholderStyle = isResultPlaceholderStyle;
    window.isLineStyle = isLineStyle;
    window.isTransformerShape = isTransformerShape;
    window.updateClonedBusPlaceholder = updateClonedBusPlaceholder;
    window.updateClonedLinePlaceholder = updateClonedLinePlaceholder;
    window.updateClonedComponentPlaceholder = updateClonedComponentPlaceholder;
    window.processClonedCellsForPlaceholders = processClonedCellsForPlaceholders;
    window.processClonedCellsForBusPlaceholders = processClonedCellsForBusPlaceholders; // backward compatibility
}

//=============================================================================
// OVERRIDE duplicateCells to handle placeholder updates for cloned cells
// Supports: Bus, Line, and all component result placeholders
//=============================================================================

// Store original duplicateCells (wait for Graph to be defined)
var _originalDuplicateCells = null;

function initDuplicateCellsOverride() {
    if (typeof Graph !== 'undefined' && Graph.prototype.duplicateCells && !_originalDuplicateCells) {
        _originalDuplicateCells = Graph.prototype.duplicateCells;
        
        Graph.prototype.duplicateCells = function(cells, append) {
            var result = _originalDuplicateCells.apply(this, arguments);
            
            // Process cloned cells for all placeholder types (Bus, Line, Components)
            if (result && result.length > 0) {
                try {
                    processClonedCellsForPlaceholders(this, result);
                } catch (err) {
                    console.error('ELXXX: Error processing cloned cells for placeholders:', err);
                }
            }
            
            return result;
        };
        
        console.log('ELXXX: duplicateCells override installed for placeholder support (Bus, Line, Components)');
    }
}

//=============================================================================
// OVERRIDE mxClipboard.paste to handle placeholder updates for pasted cells
// Supports: Bus, Line, and all component result placeholders
//=============================================================================

var _originalClipboardPaste = null;

function initClipboardPasteOverride() {
    if (typeof mxClipboard !== 'undefined' && mxClipboard.paste && !_originalClipboardPaste) {
        _originalClipboardPaste = mxClipboard.paste;
        
        mxClipboard.paste = function(graph) {
            var result = _originalClipboardPaste.apply(this, arguments);
            
            // Process pasted cells for all placeholder types (Bus, Line, Components)
            if (result && result.length > 0 && graph) {
                try {
                    processClonedCellsForPlaceholders(graph, result);
                } catch (err) {
                    console.error('ELXXX: Error processing pasted cells for placeholders:', err);
                }
            }
            
            return result;
        };
        
        console.log('ELXXX: mxClipboard.paste override installed for placeholder support (Bus, Line, Components)');
    }
}

// Initialize overrides when the page loads
if (typeof window !== 'undefined') {
    // Try to initialize immediately
    initDuplicateCellsOverride();
    initClipboardPasteOverride();
    
    // Also try after a delay (in case Graph/mxClipboard aren't defined yet)
    setTimeout(function() {
        initDuplicateCellsOverride();
        initClipboardPasteOverride();
    }, 1000);
    
    // Also try on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initDuplicateCellsOverride();
            initClipboardPasteOverride();
        });
    }
}

// Helper to create a professional placeholder box
function createResultPlaceholder(graph, parentEdge, componentCell, opts) {
    if (graph && graph._elxxxSkipPlaceholders) return;
    runUpgradeOnce(graph);
    var externalId = componentCell.id;

    var baseStyle = [
        'shape=rounded',
        'rounded=1',
        'arcSize=6',
        'fillColor=#F8F9FA',
        'strokeColor=#6C757D',
        'strokeWidth=1.5',
        'dashed=1',
        'dashPattern=5 5',
        'opacity=70',
        'whiteSpace=wrap',
        'html=1',
        'overflow=hidden',
        'align=center',
        'verticalAlign=middle',
        'fontSize=7',
        'fontColor=#6C757D',
        'fontStyle=0',
        'spacing=3',
        'connectedTo=' + externalId
    ].join(';');

    // Allow overriding the logical Electrisim result shape (for External Grid)
    var logicalShape = opts && opts.logicalShape
        ? 'shapeELXXX=' + opts.logicalShape
        : 'shapeELXXX=Result';

    var placeholderStyle = logicalShape + ';' + baseStyle;

    var boxWidth = (opts && opts.width) || 60;
    var boxHeight = (opts && opts.height) || 40;
    var positionX = (opts && typeof opts.positionX === 'number') ? opts.positionX : -0.3;
    // For all positions, ensure consistent relative positioning
    var positionY = (opts && typeof opts.positionY === 'number') ? opts.positionY : 0;
    var offsetXDelta = (opts && typeof opts.offsetXDelta === 'number') ? opts.offsetXDelta : 0;
    var offsetYDelta = (opts && typeof opts.offsetYDelta === 'number') ? opts.offsetYDelta : 0;
    // Offset to position box above the line - adjusted for better centering
    // positionX of 0.2 gives the middle of the line for Line/NotEditableLine elements
    var isLineMiddle = (positionX === 0.2 || positionX === 0.5);
    var offsetY = isLineMiddle ? -boxHeight / 2 - 10 : -boxHeight / 2 - 5;

    graph.model.beginUpdate();
    try {
        var placeholder = graph.insertVertex(
            parentEdge,
            null,
            'Click Simulate to generate results',
            positionX,
            positionY,
            boxWidth,
            boxHeight,
            placeholderStyle,
            true
        );

        if (placeholder) {
            var geo = graph.model.getGeometry(placeholder);
            if (geo) {
                geo.relative = true;
                geo.x = positionX;
                geo.y = positionY;
                if (typeof mxPoint !== 'undefined') {
                    geo.offset = new mxPoint(-boxWidth / 2 + offsetXDelta, offsetY + offsetYDelta);
                }
                graph.model.setGeometry(placeholder, geo);
            }

            // Get the placeholder ID - prefer the actual cell id, fallback to mxObjectId without '#' prefix
            var placeholderId = placeholder.id;
            if (!placeholderId && placeholder.mxObjectId) {
                // mxObjectId format is typically '#mxCell-123', we need to strip the '#' for getCell to work
                placeholderId = placeholder.mxObjectId.replace('#', '');
            }
            if (placeholderId) {
                // Make placeholder traceable
                graph.model.setStyle(
                    placeholder,
                    placeholderStyle + ';placeholderId=' + placeholderId
                );

                // Store reference on the component cell itself so results logic can find it
                if (componentCell) {
                    if (componentCell.value && typeof componentCell.value.setAttribute === 'function') {
                        componentCell.value.setAttribute('placeholderId', placeholderId);
                        graph.model.setValue(componentCell, componentCell.value);
                    } else {
                        componentCell.placeholderId = placeholderId;
                    }
                }
            }
            applyResultBoxPlacement(graph, placeholder, componentCell, { width: boxWidth, height: boxHeight });
        }
    } catch (err) {
        console.error('ELXXX: Error creating placeholder:', err);
    } finally {
        graph.model.endUpdate();
    }
}

function applyResultBoxesHook() {
    if (typeof mxGraph === 'undefined' || typeof mxConnectionHandler === 'undefined' || originalGraphAddEdge !== null) return;
    originalGraphAddEdge = mxGraph.prototype.addEdge;
    mxGraph.prototype.addEdge = function (edge, parent, source, target, index) {
        // Prevent recursive re-entry when our own placeholder creation triggers internal addEdge calls
        if (this._elxxxInAddEdge) {
            return originalGraphAddEdge.apply(this, arguments);
        }

        this._elxxxInAddEdge = true;
        try {
            var result = originalGraphAddEdge.apply(this, arguments);

        try {
            if (!result || !source || !target) {
                return result;
            }

            var sourceStyle = source.style || '';
            var targetStyle = target.style || '';
            var edgeStyle = result.style || '';

            var sourceShape = getShapeElxxx(sourceStyle);
            var targetShape = getShapeElxxx(targetStyle);
            var edgeShape = getShapeElxxx(edgeStyle);

            // 1) Placeholders for Line elements (Bus-to-Bus edges with shapeELXXX=Line)
            // Lines created via import use insertEdge, so they go through addEdge but not the connect handler.
            var sourceIsBus = isBusStyle(sourceStyle);
            var targetIsBus = isBusStyle(targetStyle);
            var edgeIsLine = (edgeShape === 'Line' || edgeShape === 'Line 1ph');

            if (sourceIsBus && targetIsBus && edgeIsLine) {
                var lineHasPlaceholder = false;
                if (result) {
                    var lineChildCount = this.model.getChildCount(result);
                    for (var li = 0; li < lineChildCount; li++) {
                        var lineChild = this.model.getChildAt(result, li);
                        if (!lineChild) continue;
                        var lineChildStyle = this.model.getStyle(lineChild) || '';
                        if (isResultPlaceholderStyle(lineChildStyle)) {
                            lineHasPlaceholder = true;
                            break;
                        }
                    }
                }
                if (!lineHasPlaceholder) {
                    createResultPlaceholder(this, result, result, {
                        logicalShape: 'Result',
                        width: 70,
                        height: 80,
                        positionX: 0
                    });
                }
            }
            // 2) Placeholders for ALL components connected to a Bus via edges
            // This includes: External Grid, Generator, Load, Motor, Transformer, Shunt Reactor,
            // Capacitor, Static Generator, Asymmetric Static Generator, Asymmetric Load,
            // Impedance, Ward, Extended Ward, Storage, SVC, TCSC, SSC, DC Line,
            // DC Bus, Load DC, Source DC, Switch, VSC, B2B VSC, etc.
            // Switch has results in net.res_switch (p_from_mw, q_from_mvar, i_ka, loading_percent)
            else if ((sourceIsBus && !targetIsBus && targetShape) ||
                (targetIsBus && !sourceIsBus && sourceShape)) {

                var componentCell = sourceIsBus ? target : source;
                var componentShape = sourceIsBus ? targetShape : sourceShape;

                // For edge-based placeholders, check if a placeholder already exists on THIS specific edge
                var edgeHasPlaceholder = false;
                if (result) {
                    // Use model API for consistency with rest of codebase
                    var childCount = this.model.getChildCount(result);
                    for (var i = 0; i < childCount; i++) {
                        var child = this.model.getChildAt(result, i);
                        if (!child) continue;
                        var childStyle = this.model.getStyle(child) || '';
                        if (childStyle && (childStyle.includes('shapeELXXX=Result') || 
                            childStyle.includes('shapeELXXX=ResultExternalGrid'))) {
                            edgeHasPlaceholder = true;
                            break;
                        }
                    }
                }

                // Transformers and Line vertices: only ONE placeholder total (not one per stub edge)
                var componentHasAnyPlaceholder = false;
                if ((isTransformerShape(componentShape) || isLineStyle(componentCell.style || '')) && componentCell.edges) {
                    for (var e = 0; e < componentCell.edges.length; e++) {
                        var existingEdge = componentCell.edges[e];
                        if (!existingEdge) continue;
                        var edgeChildCount = this.model.getChildCount(existingEdge);
                        for (var j = 0; j < edgeChildCount; j++) {
                            var edgeChild = this.model.getChildAt(existingEdge, j);
                            if (!edgeChild) continue;
                            var edgeChildStyle = this.model.getStyle(edgeChild) || '';
                            if (edgeChildStyle && (edgeChildStyle.includes('shapeELXXX=Result') ||
                                edgeChildStyle.includes('shapeELXXX=ResultExternalGrid'))) {
                                componentHasAnyPlaceholder = true;
                                break;
                            }
                        }
                        if (componentHasAnyPlaceholder) break;
                    }
                    if (!componentHasAnyPlaceholder) {
                        var directChildCount = this.model.getChildCount(componentCell);
                        for (var dc = 0; dc < directChildCount; dc++) {
                            var directChild = this.model.getChildAt(componentCell, dc);
                            if (directChild && isResultPlaceholderStyle(this.model.getStyle(directChild) || '')) {
                                componentHasAnyPlaceholder = true;
                                break;
                            }
                        }
                    }
                }

                var singlePlaceholderShape = isTransformerShape(componentShape) || isLineStyle(componentCell.style || '');
                var shouldCreatePlaceholder = !edgeHasPlaceholder &&
                    (!singlePlaceholderShape || !componentHasAnyPlaceholder);

                if (shouldCreatePlaceholder) {
                    // Use a dedicated logical shape for External Grid result boxes
                    // External Grid needs a larger box to fit load flow (P, Q, PF, Q/P) and short-circuit (ikss, ip, ith, rk, xk) results
                    var logicalShape = (componentShape === 'External Grid' || componentShape === 'Source 1ph')
                        ? 'ResultExternalGrid'
                        : 'Result';
                    var isExternalGrid = (componentShape === 'External Grid' || componentShape === 'Source 1ph');
                    createResultPlaceholder(this, result, componentCell, {
                        logicalShape: logicalShape,
                        width: isExternalGrid ? 95 : 70,
                        height: isExternalGrid ? 58 : 50,
                        positionX: -0.3
                    });
                }
            }           

            
        } catch (err) {
            console.error('ELXXX: Error in addEdge placeholder logic:', err);
        }

        return result;
    } finally {
        this._elxxxInAddEdge = false;
    }
};

    //=============================================================================
    // Connection Handler - Line Creation Logic
    //=============================================================================
    // This code extends mxConnectionHandler to set up Line parameters when
    // connecting two Bus objects together
    //=============================================================================

    //rysowanie linii łączącej obiekty
    //e - mxGraphModel 
    //g - mxCell - finalne połączenie z atrybutami source i target
    mxConnectionHandler.prototype.connect = function (a, b, c, d) {

    //console.log('connect tutaj')
    if (null != b || this.isCreateTarget(c) || this.graph.allowDanglingEdges) {
        var e = this.graph.getModel(),
            f = !1,
            g = null;
        console.log(e)
        e.beginUpdate();
        try {
            if (null != a && null == b && !this.graph.isIgnoreTerminalEvent(c) && this.isCreateTarget(c) && (b = this.createTargetVertex(c, a), null != b)) {
                d = this.graph.getDropTarget([b], c, d);
                f = !0;
                if (null != d && this.graph.getModel().isEdge(d)) d = this.graph.getDefaultParent();
                else {
                    var k = this.graph.getView().getState(d);
                    if (null != k) {
                        var l = e.getGeometry(b);
                        l.x -= k.origin.x;
                        l.y -= k.origin.y
                    }
                }
                this.graph.addCell(b, d)
            }
            var m = this.graph.getDefaultParent();
            null != a && null != b && e.getParent(a) == e.getParent(b) && e.getParent(e.getParent(a)) != e.getRoot() && (m = e.getParent(a), null != a.geometry && a.geometry.relative && null != b.geometry && b.geometry.relative && (m = e.getParent(m)));
            var n = k = null;
            null != this.edgeState && (k = this.edgeState.cell.value, n = this.edgeState.cell.style);
            g = this.insertEdge(m, null, k, a, b, n);
            if (null != g) {
                this.graph.setConnectionConstraint(g, a, !0, this.sourceConstraint);
                this.graph.setConnectionConstraint(g, b, !1, this.constraintHandler.currentConstraint);
                null != this.edgeState && e.setGeometry(g, this.edgeState.cell.geometry);
                m = e.getParent(a);
                if (this.isInsertBefore(g, a, b, c, d)) {
                    for (l = a; null != l.parent && null != l.geometry && l.geometry.relative && l.parent != g.parent;) l = this.graph.model.getParent(l);
                    null != l && null != l.parent && l.parent == g.parent && e.add(m, g, l.parent.getIndex(l))
                }
                var p = e.getGeometry(g);
                null == p && (p = new mxGeometry, p.relative = !0, e.setGeometry(g, p));
                if (null != this.waypoints &&
                    0 < this.waypoints.length) {
                    var q = this.graph.view.scale,
                        r = this.graph.view.translate;
                    p.points = [];
                    for (a = 0; a < this.waypoints.length; a++) {
                        var t = this.waypoints[a];
                        p.points.push(new mxPoint(t.x / q - r.x, t.y / q - r.y))
                    }
                }
                if (null == b) {
                    var u = this.graph.view.translate,
                        q = this.graph.view.scale,
                        t = null != this.originalPoint ? new mxPoint(this.originalPoint.x / q - u.x, this.originalPoint.y / q - u.y) : new mxPoint(this.currentPoint.x / q - u.x, this.currentPoint.y / q - u.y);
                    t.x -= this.graph.panDx / this.graph.view.scale;
                    t.y -= this.graph.panDy / this.graph.view.scale;
                    p.setTerminalPoint(t, !1)
                }
                this.fireEvent(new mxEventObject(mxEvent.CONNECT, "cell", g, "terminal", b, "event", c, "target", d, "terminalInserted", f))
            }
        } catch (x) {
            mxLog.show(), mxLog.debug(x.message)
        } finally {
            e.endUpdate()
        }

        //ELXXX

        //g - mxCell - linia
        //e - mxGraph

        //ustaw label        
        e.setValue(g, '');

        var parametry = e.getValue(g);

        //jesli linia łączy dwa bus wtedy umożliwij wprowadzanie parametrów linii   
        //do wyszukiwania fraza ELXXX Line
        // Two endpoint patterns become a fully parameterised Line element:
        //   • Bus ↔ Bus (classic pandapower line)
        //   • Switch ↔ Switch (Bus1 → Switch1 → Line → Switch2 → Bus2 — one breaker per cable end)
        // A Bus ↔ Switch edge is just a stub (NotEditableLine) — the Switch ↔ Bus connection
        // itself carries no electrical parameters.
        var isBusEndpoint = function (cell) {
            if (!cell || !cell.style) return false;
            return cell.style.includes('shapeELXXX=Bus') ||
                cell.style.includes('shape=mxgraph.electrical.transmission.busbar');
        };
        var isSwitchEndpoint = function (cell) {
            return !!(cell && cell.style && cell.style.includes('shapeELXXX=Switch'));
        };
        var isLineConnection =
            (isBusEndpoint(g.source) && isBusEndpoint(g.target)) ||
            (isSwitchEndpoint(g.source) && isSwitchEndpoint(g.target));
        if (isLineConnection) {

            //utworzenie parametrów linii
            var listaParametry = mxUtils.createXmlDocument().createElement("object");
            //listaParametry.setAttribute("label", parametry || "");
            listaParametry.setAttribute("from_bus", g.source.mxObjectId);
            listaParametry.setAttribute("to_bus", g.target.mxObjectId);

            //INPUT
            listaParametry.setAttribute("length_km", "0");

            listaParametry.setAttribute("parallel", "1");
            listaParametry.setAttribute("df", "1");

            //możliwość wyboru z biblioteki
            listaParametry.setAttribute("parameters", true);
            // listaParametry.setAttribute("standard_type", false);
            // listaParametry.setAttribute("line_type", true);
            listaParametry.setAttribute("name", "Line");            

            //Load_flow_parameters
            listaParametry.setAttribute("Load_flow_parameters", "");
            listaParametry.setAttribute("r_ohm_per_km", "0");
            listaParametry.setAttribute("x_ohm_per_km", "0");
            listaParametry.setAttribute("c_nf_per_km", "0");
            listaParametry.setAttribute("g_us_per_km", "0");
            listaParametry.setAttribute("max_i_ka", "0");
            listaParametry.setAttribute("type", "cs");

            //Short_circuit_parameters
            listaParametry.setAttribute("Short_circuit_parameters", "");
            listaParametry.setAttribute("r0_ohm_per_km", 0.0); //w specyfikacji PandaPower jako nan
            listaParametry.setAttribute("x0_ohm_per_km", "0"); //w specyfikacji PandaPower jako nan
            listaParametry.setAttribute("c0_nf_per_km", "0"); //w specyfikacji PandaPower jako nan
            listaParametry.setAttribute("endtemp_degree", "0");                   

           
            //listaParametry.setAttribute("max_loading_percent", "0"); //w specyfikacji PandaPower jako nan
            //listaParametry.setAttribute("endtemp_degree", "0"); //w specyfikacji PandaPower jako nan
            //listaParametry.setAttribute("in_service", "True"); //in_service nie działa

            e.setValue(g, listaParametry)

            g.setStyle(g.getStyle() + ";shapeELXXX=Line")

            // Create result placeholder for Line - as child of edge with relative positioning
            try {
                var lineExistingId = g.value &&
                    g.value.attributes &&
                    g.value.attributes.placeholderId &&
                    g.value.attributes.placeholderId.nodeValue;

                if (!lineExistingId) {
                    createResultPlaceholder(this.graph, g, g, {
                        logicalShape: 'Result',
                        width: 70,
                        height: 80,
                        positionX: 0.5 // middle of the line
                    });
                }
            } catch (err) {
                console.error('ELXXX: Error creating placeholder for Line:', err);
            }

        }else{
            g.setStyle(g.getStyle() + ";shapeELXXX=NotEditableLine")
        }

        this.select && this.selectCells(g, f ? b : null)
    }
};
}

// Apply hook when mxGraph is available
function waitForMxGraphAndApply() {
    if (typeof mxGraph !== 'undefined' && typeof mxConnectionHandler !== 'undefined') {
        applyResultBoxesHook();
        installResultBoxToggle();
        // Upgrade existing placeholders when diagram is loaded (e.g. from file)
        setTimeout(function tryUpgradeOnLoad() {
            var graph = null;
            if (typeof Editor !== 'undefined' && Editor.ui && Editor.ui.editor && Editor.ui.editor.graph) {
                graph = Editor.ui.editor.graph;
            } else if (typeof window !== 'undefined' && window.EditorUi && window.EditorUi.getCurrentFile) {
                var ui = window.EditorUi;
                if (ui.editor && ui.editor.graph) graph = ui.editor.graph;
            }
            if (graph && graph.getModel) {
                runUpgradeOnce(graph);
                try { repositionAllResultBoxes(graph); } catch (e) { /* ignore */ }
            }
        }, 2500);
        return;
    }
    setTimeout(waitForMxGraphAndApply, 50);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForMxGraphAndApply);
} else {
    waitForMxGraphAndApply();
}

if (typeof window !== 'undefined') {
    window.upgradeResultPlaceholderStyles = upgradeResultPlaceholderStyles;
}