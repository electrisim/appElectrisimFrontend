/**
 * Soft voltage heat map over the diagram after load flow (PowerFactory-style colouring).
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    var CANVAS_ID = 'electrisim-loadflow-colour-overlay';
    var LS_KEY = 'electrisimColourDiagram';

    var active = {
        graph: null,
        dataJson: null,
        canvas: null,
        scrollHandler: null
    };

    function readPref() {
        try { return localStorage.getItem(LS_KEY) === '1'; } catch (_) { return false; }
    }

    function savePref(on) {
        try { localStorage.setItem(LS_KEY, on ? '1' : '0'); } catch (_) { /* ignore */ }
    }

    function voltageRgb(vm) {
        var d = Math.abs(Number(vm) - 1);
        if (!isFinite(d)) return [160, 170, 160];
        var stops = [
            [0, [56, 196, 72]],
            [0.03, [120, 210, 60]],
            [0.05, [230, 210, 40]],
            [0.08, [235, 140, 30]],
            [0.1, [210, 50, 45]]
        ];
        if (d <= stops[0][0]) return stops[0][1];
        var last = stops[stops.length - 1];
        if (d >= last[0]) return last[1];
        var i;
        for (i = 1; i < stops.length; i++) {
            if (d <= stops[i][0]) {
                var lo = stops[i - 1];
                var hi = stops[i];
                var t = (d - lo[0]) / (hi[0] - lo[0]);
                return [
                    lo[1][0] + (hi[1][0] - lo[1][0]) * t,
                    lo[1][1] + (hi[1][1] - lo[1][1]) * t,
                    lo[1][2] + (hi[1][2] - lo[1][2]) * t
                ];
            }
        }
        return last[1];
    }

    function resolveCell(graph, row) {
        if (typeof window.buildGraphCellLookupMap !== 'function' ||
            typeof window.resolveGraphCellForResult !== 'function') return null;
        try {
            var map = window.__electrisimLfColourLookup;
            if (!map) map = window.buildGraphCellLookupMap(graph);
            return window.resolveGraphCellForResult(map, row, graph);
        } catch (_) {
            return null;
        }
    }

    function busViewPoint(graph, cell) {
        var state = graph.view && graph.view.getState(cell);
        if (!state) return null;
        var c = graph.container;
        return {
            x: state.x + state.width / 2 - (c.scrollLeft || 0),
            y: state.y + state.height / 2 - (c.scrollTop || 0)
        };
    }

    function ensureCanvas() {
        var existing = document.getElementById(CANVAS_ID);
        if (existing) return existing;
        var canvas = document.createElement('canvas');
        canvas.id = CANVAS_ID;
        canvas.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:9990;';
        document.body.appendChild(canvas);
        return canvas;
    }

    function removeCanvas() {
        var el = document.getElementById(CANVAS_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function paint() {
        var graph = active.graph;
        var data = active.dataJson;
        if (!graph || !graph.container || !data) return;
        var canvas = ensureCanvas();
        active.canvas = canvas;
        var rect = graph.container.getBoundingClientRect();
        var w = Math.max(1, Math.round(rect.width));
        var h = Math.max(1, Math.round(rect.height));
        var dpr = window.devicePixelRatio || 1;
        canvas.style.left = rect.left + 'px';
        canvas.style.top = rect.top + 'px';
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        var buses = data.busbars || data.buses || [];
        var radius = 110;
        buses.forEach(function (row) {
            var vm = Number(row.vm_pu);
            if (!isFinite(vm)) return;
            var cell = resolveCell(graph, row);
            if (!cell) return;
            var pt = busViewPoint(graph, cell);
            if (!pt) return;
            if (pt.x < -radius || pt.y < -radius || pt.x > w + radius || pt.y > h + radius) return;
            var rgb = voltageRgb(vm);
            var g = ctx.createRadialGradient(pt.x, pt.y, radius * 0.08, pt.x, pt.y, radius);
            g.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.55)');
            g.addColorStop(0.55, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.28)');
            g.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function detach() {
        if (active.scrollHandler) {
            if (active.graph && active.graph.container) {
                active.graph.container.removeEventListener('scroll', active.scrollHandler);
            }
            window.removeEventListener('resize', active.scrollHandler);
        }
        active.scrollHandler = null;
    }

    function stopLoadFlowDiagramColour() {
        detach();
        removeCanvas();
        active.canvas = null;
        active.graph = null;
        active.dataJson = null;
        try { delete window.__electrisimLfColourLookup; } catch (_) { window.__electrisimLfColourLookup = null; }
    }

    function bind(graph) {
        detach();
        active.scrollHandler = function () { paint(); };
        if (graph.container) graph.container.addEventListener('scroll', active.scrollHandler, { passive: true });
        window.addEventListener('resize', active.scrollHandler);
    }

    function startLoadFlowDiagramColour(graph, resultJson, enabled) {
        var on = enabled === undefined ? readPref() : !!enabled;
        savePref(on);
        stopLoadFlowDiagramColour();
        if (!graph || !resultJson) {
            syncLegend(false);
            return;
        }
        active.graph = graph;
        active.dataJson = resultJson;
        if (typeof window.buildGraphCellLookupMap === 'function') {
            try { window.__electrisimLfColourLookup = window.buildGraphCellLookupMap(graph); } catch (_) { /* ignore */ }
        }
        syncLegend(on);
        if (!on) return;
        bind(graph);
        paint();
    }

    function setLoadFlowDiagramColour(on) {
        savePref(!!on);
        if (!on) {
            detach();
            removeCanvas();
            active.canvas = null;
            syncLegend(false);
            return;
        }
        if (active.graph && active.dataJson) {
            bind(active.graph);
            paint();
        }
        syncLegend(true);
    }

    function syncLegend(on) {
        var box = document.querySelector('#electrisim-loadflow-animation-legend .lf-colour');
        if (box) box.checked = !!on;
    }

    window.startLoadFlowDiagramColour = startLoadFlowDiagramColour;
    window.stopLoadFlowDiagramColour = stopLoadFlowDiagramColour;
    window.setLoadFlowDiagramColour = setLoadFlowDiagramColour;
    window.readSavedColourDiagram = readPref;
    window.repaintLoadFlowDiagramColour = paint;
})();
