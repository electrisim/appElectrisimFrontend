/**
 * Active-power (P) flow direction overlays and clearer result labels for load-flow results.
 * Pandapower convention: positive terminal P/Q = leaving that bus into the branch.
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    var FLOW_EPSILON = 1e-6;
    var ARROW_COLOR = '#1565C0';
    var FLOW_ARROW_TAG = 'shapeELXXX=FlowArrow';
    var LEGEND_ID = 'electrisim-flow-convention-legend';
    var LEGEND_STYLE_ID = 'electrisim-flow-convention-legend-style';

    function cellSemanticId(c) {
        if (!c) return '';
        return String(c.mxObjectId || '').replace('#', '_');
    }

    function formatNum(num, decimals) {
        decimals = decimals === undefined ? 3 : decimals;
        if (num === null || num === undefined || num === 'NaN' || (typeof num === 'number' && isNaN(num))) {
            return 'N/A';
        }
        return parseFloat(num).toFixed(decimals);
    }

    function getAttr(cell, name) {
        var attrs = cell && cell.value && cell.value.attributes;
        if (!attrs) return null;
        for (var i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === name) return attrs[i].nodeValue;
        }
        return null;
    }

    function busDisplayName(busCell, semanticId) {
        if (busCell) {
            var n = getAttr(busCell, 'name');
            if (n) return n;
        }
        if (semanticId) {
            return String(semanticId).replace(/^mxCell_/, '').replace(/_/g, '#');
        }
        return '?';
    }

    function isFlowArrowCell(cell) {
        return Boolean(cell && cell.style && cell.style.indexOf(FLOW_ARROW_TAG) >= 0);
    }

    function isLineGraphVertex(cell) {
        if (!cell || cell.edge || !cell.style) return false;
        return cell.style.indexOf('shapeELXXX=Line') >= 0;
    }

    function edgesOfVertex(cell, model) {
        if (!cell || !model) return [];
        if (cell.edges && cell.edges.length) return cell.edges.slice();
        var out = [];
        var all = model.cells || {};
        for (var id in all) {
            if (!Object.prototype.hasOwnProperty.call(all, id)) continue;
            var e = all[id];
            if (e && e.edge && (e.source === cell || e.target === cell)) out.push(e);
        }
        return out;
    }

    function findBusCellBySemanticId(model, semanticId) {
        if (!model || !semanticId) return null;
        var root = model.getRoot && model.getRoot();
        if (!root) return null;
        var found = null;
        function visit(cell) {
            if (!cell || found) return;
            if (cellSemanticId(cell) === semanticId) {
                found = cell;
                return;
            }
            var n = cell.getChildCount ? cell.getChildCount() : 0;
            for (var i = 0; i < n; i++) visit(model.getChildAt(cell, i));
        }
        visit(root);
        return found;
    }

    /**
     * Fallback endpoint resolver when loadFlow.getLineBusEndpointsForPayload is unavailable.
     */
    function defaultLineEndpoints(cell, model) {
        if (cell.source && cell.target) {
            return {
                busFrom: cellSemanticId(cell.source),
                busTo: cellSemanticId(cell.target)
            };
        }
        var edges = edgesOfVertex(cell, model);
        if (edges.length >= 2) {
            var o0 = edges[0].source === cell ? edges[0].target : edges[0].source;
            var o1 = edges[1].source === cell ? edges[1].target : edges[1].source;
            return { busFrom: cellSemanticId(o0), busTo: cellSemanticId(o1) };
        }
        return {
            busFrom: cellSemanticId(cell.source),
            busTo: cellSemanticId(cell.target)
        };
    }

    function resolveGraphSideIds(branchCell, model, getEndpointsFn) {
        var resolver = getEndpointsFn || defaultLineEndpoints;
        var ends = resolver(branchCell, model) || {};
        var busFrom = ends.busFrom || '';
        var busTo = ends.busTo || '';

        var sideA = null;
        var sideB = null;

        if (branchCell.source && branchCell.target) {
            sideA = cellSemanticId(branchCell.source);
            sideB = cellSemanticId(branchCell.target);
        } else if (isLineGraphVertex(branchCell)) {
            var edges = edgesOfVertex(branchCell, model);
            if (edges.length >= 2) {
                var p0 = edges[0].source === branchCell ? edges[0].target : edges[0].source;
                var p1 = edges[1].source === branchCell ? edges[1].target : edges[1].source;
                sideA = cellSemanticId(p0);
                sideB = cellSemanticId(p1);
            }
        }

        return { busFrom: busFrom, busTo: busTo, sideA: sideA, sideB: sideB };
    }

    /**
     * Determine active-power flow direction from pandapower terminal results.
     * @returns {{ hasFlow, flowFromId, flowToId, pMw, arrowAtTarget, fromName, toName, nearZero }}
     */
    function resolveBranchFlowDirection(resultRow, branchCell, model, options) {
        options = options || {};
        var pFromKey = options.pFromKey || 'p_from_mw';
        var pToKey = options.pToKey || 'p_to_mw';
        var getEndpointsFn = options.getEndpointsFn;

        var sides = resolveGraphSideIds(branchCell, model, getEndpointsFn);
        var busFrom = sides.busFrom;
        var busTo = sides.busTo;

        var pFrom = Number(resultRow[pFromKey]);
        var pTo = Number(resultRow[pToKey]);
        if (!Number.isFinite(pFrom)) pFrom = 0;
        if (!Number.isFinite(pTo)) pTo = 0;

        var pMw = Math.abs(pFrom) >= Math.abs(pTo) ? Math.abs(pFrom) : Math.abs(pTo);
        var nearZero = pMw < FLOW_EPSILON;

        var flowFromId = busFrom;
        var flowToId = busTo;

        if (!nearZero) {
            if (Math.abs(pFrom) >= Math.abs(pTo)) {
                if (pFrom >= 0) {
                    flowFromId = busFrom;
                    flowToId = busTo;
                } else {
                    flowFromId = busTo;
                    flowToId = busFrom;
                }
            } else if (pTo >= 0) {
                flowFromId = busTo;
                flowToId = busFrom;
            } else {
                flowFromId = busFrom;
                flowToId = busTo;
            }
        }

        var fromBusCell = findBusCellBySemanticId(model, flowFromId);
        var toBusCell = findBusCellBySemanticId(model, flowToId);
        var fromName = busDisplayName(fromBusCell, flowFromId);
        var toName = busDisplayName(toBusCell, flowToId);

        var arrowAtTarget = true;
        if (branchCell.source && branchCell.target) {
            var srcId = cellSemanticId(branchCell.source);
            var tgtId = cellSemanticId(branchCell.target);
            if (flowFromId === srcId && flowToId === tgtId) {
                arrowAtTarget = true;
            } else if (flowFromId === tgtId && flowToId === srcId) {
                arrowAtTarget = false;
            } else if (sides.sideA && sides.sideB) {
                if (flowFromId === sides.sideA && flowToId === sides.sideB) {
                    arrowAtTarget = (srcId === sides.sideA);
                } else if (flowFromId === sides.sideB && flowToId === sides.sideA) {
                    arrowAtTarget = (srcId === sides.sideB);
                }
            }
        } else if (isLineGraphVertex(branchCell)) {
            arrowAtTarget = null;
        }

        return {
            hasFlow: !nearZero,
            nearZero: nearZero,
            flowFromId: flowFromId,
            flowToId: flowToId,
            fromName: fromName,
            toName: toName,
            pMw: pMw,
            arrowAtTarget: arrowAtTarget,
            pFrom: pFrom,
            pTo: pTo
        };
    }

    function saveBaseStyle(model, branchCell) {
        var style = model.getStyle(branchCell) || '';
        if (style.indexOf('electrisimFlowBase=') >= 0) return;
        var encoded = encodeURIComponent(style);
        model.setStyle(branchCell, style + ';electrisimFlowBase=' + encoded);
    }

    function restoreBaseStyles(model) {
        var cells = model.cells || {};
        for (var id in cells) {
            if (!Object.prototype.hasOwnProperty.call(cells, id)) continue;
            var cell = cells[id];
            if (!cell || cell.edge === false && !cell.style) continue;
            var style = model.getStyle(cell) || '';
            var idx = style.indexOf('electrisimFlowBase=');
            if (idx < 0) continue;
            var encoded = style.substring(idx + 'electrisimFlowBase='.length).split(';')[0];
            try {
                var base = decodeURIComponent(encoded);
                model.setStyle(cell, base);
            } catch (_) {
                model.setStyle(cell, style.replace(/;?electrisimFlowBase=[^;]*/g, ''));
            }
        }
    }

    function removeFlowArrowChildren(graph) {
        var model = graph.getModel();
        var toRemove = [];
        var cells = model.cells || {};
        for (var id in cells) {
            if (!Object.prototype.hasOwnProperty.call(cells, id)) continue;
            var cell = cells[id];
            if (isFlowArrowCell(cell)) toRemove.push(cell);
        }
        if (toRemove.length) {
            model.beginUpdate();
            try {
                for (var i = 0; i < toRemove.length; i++) {
                    model.remove(toRemove[i]);
                }
            } finally {
                model.endUpdate();
            }
        }
    }

    function clearFlowArrows(graph) {
        if (!graph || !graph.getModel) return;
        var model = graph.getModel();
        model.beginUpdate();
        try {
            removeFlowArrowChildren(graph);
            restoreBaseStyles(model);
        } finally {
            model.endUpdate();
        }
        hideFlowConventionLegend();
    }

    function triangleStyle(rotation) {
        return [
            FLOW_ARROW_TAG,
            'shape=triangle',
            'fillColor=' + ARROW_COLOR,
            'strokeColor=' + ARROW_COLOR,
            'strokeWidth=1',
            'perimeter=none',
            'pointerEvents=0',
            'opacity=90',
            'rotation=' + (rotation || 0)
        ].join(';');
    }

    function lineVertexIsVertical(branchCell) {
        return Boolean(branchCell.style && branchCell.style.indexOf('direction=north') >= 0);
    }

    function computeVertexArrowRotation(branchCell, model, directionInfo) {
        var fromCell = findBusCellBySemanticId(model, directionInfo.flowFromId);
        var toCell = findBusCellBySemanticId(model, directionInfo.flowToId);
        if (fromCell && toCell && graphCenter(fromCell) && graphCenter(toCell)) {
            var a = graphCenter(fromCell);
            var b = graphCenter(toCell);
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            if (Math.abs(dx) >= Math.abs(dy)) {
                return dx >= 0 ? 90 : 270;
            }
            return dy >= 0 ? 180 : 0;
        }
        if (lineVertexIsVertical(branchCell)) {
            return directionInfo.flowFromId === resolveGraphSideIds(branchCell, model).sideA ? 180 : 0;
        }
        return 90;
    }

    function graphCenter(cell) {
        if (!cell || !cell.geometry) return null;
        return {
            x: cell.geometry.x + (cell.geometry.width || 0) / 2,
            y: cell.geometry.y + (cell.geometry.height || 0) / 2
        };
    }

    function upsertFlowArrowOverlay(graph, branchCell, directionInfo) {
        var model = graph.getModel();
        var parent = branchCell;
        var existing = null;
        var n = model.getChildCount(parent);
        for (var i = 0; i < n; i++) {
            var ch = model.getChildAt(parent, i);
            if (isFlowArrowCell(ch)) {
                existing = ch;
                break;
            }
        }

        var rotation = computeVertexArrowRotation(branchCell, model, directionInfo);
        var style = triangleStyle(rotation);
        var w = 14;
        var h = 12;

        model.beginUpdate();
        try {
            if (existing) {
                model.setStyle(existing, style);
                var geoE = model.getGeometry(existing);
                if (geoE) {
                    geoE.x = 0.45;
                    geoE.y = 0;
                    geoE.relative = true;
                    model.setGeometry(existing, geoE);
                }
            } else {
                var arrow = graph.insertVertex(parent, null, '', 0.45, 0, w, h, style, true);
                if (arrow) {
                    var geo = model.getGeometry(arrow);
                    if (geo) {
                        geo.relative = true;
                        if (typeof mxPoint !== 'undefined') {
                            geo.offset = new mxPoint(-w / 2, -h / 2);
                        }
                        model.setGeometry(arrow, geo);
                    }
                }
            }
        } finally {
            model.endUpdate();
        }
    }

    function applyEdgeArrows(graph, branchCell, directionInfo) {
        if (typeof mxUtils === 'undefined' || typeof mxConstants === 'undefined') return;
        var model = graph.getModel();
        saveBaseStyle(model, branchCell);
        var style = model.getStyle(branchCell) || '';
        style = mxUtils.setStyle(style, mxConstants.STYLE_STARTARROW, 'none');
        style = mxUtils.setStyle(style, mxConstants.STYLE_ENDARROW, 'none');
        style = mxUtils.setStyle(style, mxConstants.STYLE_STARTFILL, '0');
        style = mxUtils.setStyle(style, mxConstants.STYLE_ENDFILL, '0');

        if (directionInfo.arrowAtTarget === true) {
            style = mxUtils.setStyle(style, mxConstants.STYLE_ENDARROW, 'block');
            style = mxUtils.setStyle(style, mxConstants.STYLE_ENDFILL, '1');
        } else if (directionInfo.arrowAtTarget === false) {
            style = mxUtils.setStyle(style, mxConstants.STYLE_STARTARROW, 'block');
            style = mxUtils.setStyle(style, mxConstants.STYLE_STARTFILL, '1');
        }
        model.setStyle(branchCell, style);
    }

    function applyActivePowerArrow(graph, branchCell, directionInfo, options) {
        if (!graph || !branchCell || !directionInfo || !directionInfo.hasFlow) return;

        // Arrows only on line branches (edges or line-as-vertex). Transformers, switches,
        // and other component symbols keep the P-flow text label but no overlay triangle —
        // a triangle on the symbol does not align with the actual conductor path.
        if (branchCell.edge) {
            applyEdgeArrows(graph, branchCell, directionInfo);
            return;
        }
        if (isLineGraphVertex(branchCell)) {
            upsertFlowArrowOverlay(graph, branchCell, directionInfo);
        }
    }

    function formatBranchTerminalQ(qMvar) {
        var qn = Number(qMvar);
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0';
        if (qn > 0) {
            return 'Q=' + formatNum(qn) + ' MVar out of bus (inductive draw)';
        }
        return 'Q=' + formatNum(qn) + ' MVar into bus (capacitive supply)';
    }

    /** Net bus injection Q (res_bus): + = absorbed/inductive, − = supplied/capacitive. */
    function formatBusNetReactiveQ(qMvar) {
        var qn = Number(qMvar);
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0 (unity PF)';
        if (qn > 0) {
            return 'Q=' + formatNum(qn) + ' MVar (inductive, absorbed)';
        }
        return 'Q=' + formatNum(qn) + ' MVar (capacitive, supplied)';
    }

    /** Element Q for loads/shunts: pandapower positive load Q = inductive. */
    function formatElementReactiveQ(qMvar, elementKind) {
        var qn = Number(qMvar);
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0';
        elementKind = elementKind || 'load';
        if (elementKind === 'shunt' || elementKind === 'capacitor') {
            if (qn < 0) return 'Q=' + formatNum(qn) + ' MVar (capacitive, supplied)';
            return 'Q=' + formatNum(qn) + ' MVar (inductive setting)';
        }
        if (elementKind === 'externalgrid' || elementKind === 'generator') {
            if (qn < 0) return 'Q=' + formatNum(qn) + ' MVar (inductive, supplied to network)';
            if (qn > 0) return 'Q=' + formatNum(qn) + ' MVar (capacitive, absorbed from network)';
            return 'Q≈0 (unity PF)';
        }
        if (qn > 0) return 'Q=' + formatNum(qn) + ' MVar (inductive, consumed)';
        return 'Q=' + formatNum(qn) + ' MVar (capacitive, generated)';
    }

    /** External grid / source Q with optional unit label (e.g. kVar for 1ph OpenDSS). */
    function formatExternalGridReactiveQ(qMvar, unit) {
        var qn = Number(qMvar);
        unit = unit || 'MVar';
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0 (unity PF)';
        if (qn < 0) {
            return 'Q=' + formatNum(qn) + ' ' + unit + ' (inductive, supplied to network)';
        }
        if (qn > 0) {
            return 'Q=' + formatNum(qn) + ' ' + unit + ' (capacitive, absorbed from network)';
        }
        return 'Q≈0 (unity PF)';
    }

    function formatLineTerminalBlock(busName, qMvar, iKa) {
        return '@' + busName + ': ' + formatBranchTerminalQ(qMvar) + '\n  i=' + formatNum(iKa) + ' kA';
    }

    function formatLineResultWithFlow(cell, directionInfo, headerLine) {
        var hdr = headerLine || 'Line';
        var fromName = directionInfo ? directionInfo.fromName : '?';
        var toName = directionInfo ? directionInfo.toName : '?';
        if (!directionInfo || directionInfo.nearZero) {
            return hdr + '\nP flow: ≈ 0 MW\n' + formatLineTerminalBlock(fromName, cell.q_from_mvar, cell.i_from_ka) +
                '\nLoading: ' + formatNum(cell.loading_percent, 1) + ' %\n' +
                formatLineTerminalBlock(toName, cell.q_to_mvar, cell.i_to_ka);
        }
        return hdr + '\nP flow: ' + fromName + ' → ' + toName +
            '  (' + formatNum(directionInfo.pMw) + ' MW)\n' +
            formatLineTerminalBlock(fromName, cell.q_from_mvar, cell.i_from_ka) +
            '\nLoading: ' + formatNum(cell.loading_percent, 1) + ' %\n' +
            formatLineTerminalBlock(toName, cell.q_to_mvar, cell.i_to_ka);
    }

    function formatTrafoResultWithFlow(cell, directionInfo, headerLine, tapBlock) {
        var hdr = headerLine || 'Trafo';
        tapBlock = tapBlock || '';
        var flowLine;
        if (!directionInfo || directionInfo.nearZero) {
            flowLine = 'P flow: ≈ 0 MW';
        } else {
            flowLine = 'P flow: ' + directionInfo.fromName + ' → ' + directionInfo.toName +
                '  (' + formatNum(directionInfo.pMw) + ' MW)';
        }
        return hdr + '\n' + flowLine +
            '\nP_HV[MW]: ' + formatNum(cell.p_hv_mw) +
            '\n@HV: ' + formatBranchTerminalQ(cell.q_hv_mvar) +
            '\nP_LV[MW]: ' + formatNum(cell.p_lv_mw) +
            '\n@LV: ' + formatBranchTerminalQ(cell.q_lv_mvar) +
            '\ni_HV[kA]: ' + formatNum(cell.i_hv_ka) +
            '\ni_LV[kA]: ' + formatNum(cell.i_lv_ka) +
            '\nloading[%]: ' + formatNum(cell.loading_percent) + tapBlock;
    }

    function formatSwitchResultWithFlow(cell, directionInfo, headerLine) {
        var hdr = headerLine || 'Switch';
        var closedStr = (cell.closed === false || cell.closed === 'false') ? 'false' : 'true';
        var flowLine;
        if (!directionInfo || directionInfo.nearZero) {
            flowLine = 'P flow: ≈ 0 MW';
        } else {
            flowLine = 'P flow: ' + directionInfo.fromName + ' → ' + directionInfo.toName +
                '  (' + formatNum(directionInfo.pMw) + ' MW)';
        }
        return hdr + '\nclosed: ' + closedStr + '\n' + flowLine +
            '\n' + formatLineTerminalBlock(directionInfo ? directionInfo.fromName : 'from', cell.q_from_mvar, cell.i_ka) +
            '\nLoading: ' + formatNum(cell.loading_percent, 1) + ' %\n' +
            '@' + (directionInfo ? directionInfo.toName : 'to') + ': ' +
            formatBranchTerminalQ(cell.q_to_mvar);
    }

    function formatGenericBranchResultWithFlow(cell, directionInfo, headerLine, extraLines) {
        var hdr = headerLine || 'Branch';
        extraLines = extraLines || '';
        var flowLine;
        if (!directionInfo || directionInfo.nearZero) {
            flowLine = 'P flow: ≈ 0 MW';
        } else {
            flowLine = 'P flow: ' + directionInfo.fromName + ' → ' + directionInfo.toName +
                '  (' + formatNum(directionInfo.pMw) + ' MW)';
        }
        return hdr + '\n' + flowLine +
            '\n@' + (directionInfo ? directionInfo.fromName : 'from') + ': P=' + formatNum(cell.p_from_mw) +
            ', ' + formatBranchTerminalQ(cell.q_from_mvar) +
            '\n@' + (directionInfo ? directionInfo.toName : 'to') + ': P=' + formatNum(cell.p_to_mw) +
            ', ' + formatBranchTerminalQ(cell.q_to_mvar) + extraLines;
    }

    var DASHBOARD_ID = 'electrisim-health-dashboard';

    var legendRepositionTimer = null;

    function positionFlowLegendPanel(panel) {
        if (!panel) return;
        var gap = 10;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';

        var dash = document.getElementById(DASHBOARD_ID);
        if (dash && dash.offsetParent !== null && getComputedStyle(dash).display !== 'none') {
            var dashRect = dash.getBoundingClientRect();
            var legW = panel.offsetWidth || 280;
            var legH = panel.offsetHeight || 130;

            var left = dashRect.left - legW - gap;
            var top = dashRect.bottom - legH;

            if (left < 8) {
                left = Math.max(8, dashRect.left);
                top = dashRect.top - legH - gap;
            }

            left = Math.max(8, Math.min(left, window.innerWidth - legW - 8));
            top = Math.max(8, Math.min(top, window.innerHeight - legH - 8));

            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            return;
        }

        panel.style.left = 'auto';
        panel.style.top = 'auto';
        panel.style.bottom = '16px';
        panel.style.right = '412px';
    }

    function repositionFlowConventionLegend() {
        var panel = document.getElementById(LEGEND_ID);
        if (panel) positionFlowLegendPanel(panel);
    }

    function scheduleLegendReposition() {
        if (legendRepositionTimer) clearTimeout(legendRepositionTimer);
        legendRepositionTimer = setTimeout(function () {
            legendRepositionTimer = null;
            repositionFlowConventionLegend();
        }, 16);
    }

    function bindLegendRepositionListeners() {
        if (bindLegendRepositionListeners._bound) return;
        bindLegendRepositionListeners._bound = true;
        window.addEventListener('resize', scheduleLegendReposition);
    }

    function ensureLegendStyles() {
        if (document.getElementById(LEGEND_STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = LEGEND_STYLE_ID;
        style.textContent = [
            '#' + LEGEND_ID + ' {',
            '  position: fixed; z-index: 998;',
            '  width: 280px; max-width: calc(100vw - 16px); padding: 10px 12px; border-radius: 8px;',
            '  background: rgba(255,255,255,0.96); border: 1px solid #ced4da;',
            '  box-shadow: 0 4px 14px rgba(0,0,0,0.12); font: 12px/1.45 Arial, sans-serif; color: #212529;',
            '}',
            '#' + LEGEND_ID + ' strong { display: block; margin-bottom: 4px; font-size: 12px; }',
            '#' + LEGEND_ID + ' .eflow-arrow { color: ' + ARROW_COLOR + '; font-weight: bold; }',
            '#' + LEGEND_ID + ' button {',
            '  margin-top: 8px; padding: 4px 10px; border: 1px solid #adb5bd; border-radius: 4px;',
            '  background: #f8f9fa; cursor: pointer; font-size: 11px;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function hideFlowConventionLegend() {
        var el = document.getElementById(LEGEND_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function showFlowConventionLegend(graph) {
        if (typeof document === 'undefined') return;
        ensureLegendStyles();
        hideFlowConventionLegend();

        var panel = document.createElement('div');
        panel.id = LEGEND_ID;
        panel.innerHTML = [
            '<strong>Power flow convention</strong>',
            '<span class="eflow-arrow">→</span> Arrow on <b>lines only</b> = active power (P) direction.',
            'Transformers & switches: read <b>P flow:</b> in the result box (no arrow on symbol).',
            '<b>Reactive labels:</b> “out of bus (inductive draw)” / “into bus (capacitive supply)”.',
            'On buses: +Q = inductive absorbed, −Q = capacitive supplied. Q may flow opposite to P.',
            '<button type="button">Dismiss</button>'
        ].join('<br>');

        var btn = panel.querySelector('button');
        if (btn) {
            btn.addEventListener('click', function () {
                hideFlowConventionLegend();
            });
        }
        document.body.appendChild(panel);
        bindLegendRepositionListeners();
        positionFlowLegendPanel(panel);
        requestAnimationFrame(function () { positionFlowLegendPanel(panel); });
        setTimeout(function () { positionFlowLegendPanel(panel); }, 450);
    }

    window.clearFlowArrows = clearFlowArrows;
    window.resolveBranchFlowDirection = resolveBranchFlowDirection;
    window.applyActivePowerArrow = applyActivePowerArrow;
    window.formatLineResultWithFlow = formatLineResultWithFlow;
    window.formatTrafoResultWithFlow = formatTrafoResultWithFlow;
    window.formatSwitchResultWithFlow = formatSwitchResultWithFlow;
    window.formatGenericBranchResultWithFlow = formatGenericBranchResultWithFlow;
    window.formatBranchTerminalQ = formatBranchTerminalQ;
    window.formatBusNetReactiveQ = formatBusNetReactiveQ;
    window.formatElementReactiveQ = formatElementReactiveQ;
    window.formatExternalGridReactiveQ = formatExternalGridReactiveQ;
    window.showFlowConventionLegend = showFlowConventionLegend;
    window.hideFlowConventionLegend = hideFlowConventionLegend;
    window.repositionFlowConventionLegend = repositionFlowConventionLegend;
})();
