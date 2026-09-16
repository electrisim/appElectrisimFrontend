// BessPreliminaryDesignResultsDialog.js
import { attachBackdropCloseHandler, parkOverlayForCanvas } from '../utils/dialogStyles.js';
import { buildGraphCellLookupMap, resolveGraphCellForResult } from '../utils/attributeUtils.js';
import { applyBessPreliminaryResultsToSld, pickBessSldCase } from '../utils/bessPreliminarySldResults.js';

function fmt(v, d = 3) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    return Number(v).toFixed(d);
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function ratingLabel(el) {
    if (el?.type === 'battery_dc' && el.pmax_mw != null && el.pmax_mw !== '') {
        return `${fmt(el.pmax_mw, 1)} MW DC`;
    }
    if (el?.type === 'storage' && el.sn_mva != null && el.sn_mva !== '') {
        const p = el.max_p_mw != null && el.max_p_mw !== '' ? ` / ${fmt(el.max_p_mw, 1)} MW` : '';
        return `${fmt(el.sn_mva, 1)} MVA${p}`;
    }
    if (el?.sn_mva != null && el.sn_mva !== '') return `${fmt(el.sn_mva, 1)} MVA`;
    if (el?.max_i_ka != null && el.max_i_ka !== '') return `${fmt(el.max_i_ka, 2)} kA`;
    return '—';
}

function limiterHtml(lim) {
    if (!lim) return '—';
    const name = lim.name || '';
    const extra = lim.loading_percent != null ? ` (${fmt(lim.loading_percent, 1)}%)` : '';
    const reason = lim.limit_reason ? ` [${lim.limit_reason}]` : '';
    const text = `${lim.type || ''}: ${escapeHtml(name)}${extra}${reason}`.replace(/^: /, '');
    if (!name || name === 'load_flow' || name === 'POC target' || name === 'PCS apparent power'
        || name === 'unit rating' || name === 'PCS rating' || name === 'Battery DC Pmax'
        || name === 'PCS Pmax') {
        return text;
    }
    return `<button type="button" class="bess-prelim-sld-link" data-sld-name="${escapeHtml(name)}" ` +
        `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;">${text}</button>`;
}

function envelopeRequirement(pq) {
    const reqMap = pq?.requirements || {};
    return Object.values(reqMap).find((r) => r && (r.q_over_pn != null || r.p_mw)) || null;
}

function requirementPnQ(pq, wizardParams) {
    const req = envelopeRequirement(pq);
    let pn = 0;
    if (req?.p_mw?.length) {
        pn = Math.max(...req.p_mw.map((p) => Math.abs(Number(p))), 0);
    }
    if (!(pn > 0)) pn = Math.abs(Number(pq?.pn_mw)) || 0;
    if (!(pn > 0)) pn = Math.abs(Number(wizardParams?.pocP_MW)) || 0;
    let qPn = Number(req?.q_over_pn);
    if (!(qPn > 0) && pn > 0 && req?.q_req_max_mvar?.length) {
        qPn = Math.max(...req.q_req_max_mvar.map((q) => Math.abs(Number(q))), 0) / pn;
    }
    if (!(qPn > 0) && pn > 0 && wizardParams?.powerFactor) {
        const pf = Math.min(0.999999, Math.max(0.1, Math.abs(Number(wizardParams.powerFactor) || 0.95)));
        qPn = Math.tan(Math.acos(pf));
    }
    return { pn, qPn, qReq: qPn * pn };
}

function exportRatedIndex(pts) {
    let best = 0;
    (pts || []).forEach((p, i) => {
        if (Number(p) > Number(pts[best])) best = i;
    });
    return best;
}

function qAtRatedP(curve) {
    const pts = (curve?.p_mw || []).map(Number);
    if (!pts.length) return null;
    const i = exportRatedIndex(pts);
    if (!(pts[i] > 1e-6)) return null;
    const qmax = Number(curve.q_max_mvar?.[i]);
    const qmin = Number(curve.q_min_mvar?.[i]);
    return {
        p_rated_mw: pts[i],
        q_max_mvar: Number.isFinite(qmax) ? qmax : null,
        q_min_mvar: Number.isFinite(qmin) ? qmin : null,
    };
}

function plantVoltageBand(wizardParams, results) {
    const w = wizardParams || {};
    const p = results?.params || {};
    const vmin = Number(w.vmin_allow_pu ?? p.vmin_pu);
    const vmax = Number(w.vmax_allow_pu ?? p.vmax_pu);
    return {
        vmin: Number.isFinite(vmin) ? vmin : 0.90,
        vmax: Number.isFinite(vmax) ? vmax : 1.10,
    };
}

function optNum(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function mergeTicks(min, max, preferred) {
    const out = [];
    const seen = new Set();
    const add = (t) => {
        const n = Number(t);
        if (!Number.isFinite(n) || n < min - 1e-9 || n > max + 1e-9) return;
        const k = n.toFixed(5);
        if (seen.has(k)) return;
        seen.add(k);
        out.push(n);
    };
    (preferred || []).forEach(add);
    add(min);
    add(max);
    out.sort((a, b) => a - b);
    return out;
}

function fmtTick(v, digits) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    const abs = Math.abs(n);
    if (abs >= 100) return n.toFixed(0);
    if (digits != null) return n.toFixed(digits);
    if (abs >= 10) return n.toFixed(1);
    if (Math.abs(n - Math.round(n * 1000) / 1000) < 1e-9) {
        const s = n.toFixed(3).replace(/\.?0+$/, '');
        return s === '-0' ? '0' : s;
    }
    return n.toFixed(2);
}

function hatchRect(ctx, x, y, w, h, color) {
    if (!(w > 0) || !(h > 0)) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const step = 8;
    for (let i = x - h; i < x + w + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, y);
        ctx.lineTo(i + h, y + h);
        ctx.stroke();
    }
    ctx.restore();
}

function defaultChartPrefs() {
    return {
        pqTitle: 'P/Q capability envelope at POC',
        pqXLabel: 'P [MW]  (− import / + export)',
        pqYLabel: 'Q [Mvar]  (− inductive / + capacitive)',
        pqXMin: '',
        pqXMax: '',
        pqYMin: '',
        pqYMax: '',
        pqPu: false,
        uqTitle: 'U–Q at rated P',
        uqXLabel: 'Q / Pn',
        uqYLabel: 'U / Uc  [pu]',
        uqXMin: '',
        uqXMax: '',
        uqYMin: '',
        uqYMax: '',
    };
}

function voltageBandLabel(u, wizardParams, results) {
    const w = wizardParams || {};
    const p = results?.params || {};
    const levels = [
        ['Umin', Number(w.umin_pu ?? p.umin_pu) || 0.95],
        ['Unom', Number(w.unom_pu ?? p.unom_pu) || 1.0],
        ['Umax', Number(w.umax_pu ?? p.umax_pu) || 1.05],
    ];
    let best = levels[1];
    let bestD = Infinity;
    levels.forEach((lv) => {
        const d = Math.abs(Number(u) - lv[1]);
        if (d < bestD) {
            bestD = d;
            best = lv;
        }
    });
    return best[0];
}

function envelopePointCaseName(p, q, u, wizardParams, results, qReq) {
    const uLabel = voltageBandLabel(u, wizardParams, results);
    const pn = Math.abs(Number(wizardParams?.pocP_MW) || 0);
    const qNeed = Number(qReq) > 0 ? Number(qReq) : pn * 0.329;
    const pAbs = Math.abs(Number(p) || 0);
    const qAbs = Math.abs(Number(q) || 0);
    if (qNeed > 0 && qAbs < 0.22 * qNeed && pAbs > 0.35 * Math.max(pn, 1e-6)) {
        return Number(p) >= 0 ? `${uLabel}_Rated_Discharge` : `${uLabel}_Rated_Charge`;
    }
    const pName = Number(p) >= 0 ? 'Export' : 'Import';
    const qName = Number(q) >= 0 ? 'Capacitive' : 'Inductive';
    return `${uLabel}_${pName}_${qName}`;
}

function existingCaseName(results, want) {
    const cases = results?.named_cases || [];
    if (!want) return null;
    const exact = cases.find((c) => c.name === want);
    if (exact) return exact.name;
    const folded = String(want).replace(/\s+/g, '');
    const fuzzy = cases.find((c) => String(c.name || '').replace(/\s+/g, '') === folded);
    return fuzzy?.name || null;
}

function nearestHit(hits, x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    (hits || []).forEach((h) => {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bestD) {
            bestD = d;
            best = h;
        }
    });
    return best;
}

function drawHitMarkers(ctx, hits, selectedName) {
    (hits || []).forEach((h) => {
        const sel = h.caseName && h.caseName === selectedName;
        ctx.beginPath();
        ctx.arc(h.x, h.y, sel ? 6.5 : 3.6, 0, Math.PI * 2);
        ctx.fillStyle = h.color || '#334155';
        ctx.fill();
        if (sel) {
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}

function assessUqAtRatedP(pq, wizardParams, results) {
    if (!pq || pq.error || !pq.curves) return null;
    const umin = Number(wizardParams?.umin_pu);
    const umax = Number(wizardParams?.umax_pu);
    const band = plantVoltageBand(wizardParams, results);
    const uInnerMin = Number.isFinite(umin) ? umin : Number(pq.uq_at_rated_p?.u_inner_min) || 0.95;
    const uInnerMax = Number.isFinite(umax) ? umax : Number(pq.uq_at_rated_p?.u_inner_max) || 1.05;
    const { pn, qPn } = requirementPnQ(pq, wizardParams);
    if (!(pn > 0) || !(qPn > 0)) return null;
    const tolPu = 0.005;
    const points = [];
    Object.entries(pq.curves).forEach(([vk, curve]) => {
        const u = Number(vk);
        if (!Number.isFinite(u) || !curve) return;
        const inBand = u >= uInnerMin - 1e-4 && u <= uInnerMax + 1e-4;
        const rated = qAtRatedP(curve) || {};
        const qmaxPu = rated.q_max_mvar != null ? rated.q_max_mvar / pn : null;
        const qminPu = rated.q_min_mvar != null ? rated.q_min_mvar / pn : null;
        const covers = qmaxPu != null && qminPu != null
            && qmaxPu + tolPu >= qPn
            && qminPu - tolPu <= -qPn;
        points.push({
            u_pu: u,
            in_inner_band: inBand,
            p_rated_mw: rated.p_rated_mw,
            q_max_mvar: rated.q_max_mvar,
            q_min_mvar: rated.q_min_mvar,
            q_max_over_pn: qmaxPu,
            q_min_over_pn: qminPu,
            covers,
        });
    });
    const inBand = points.filter((p) => p.in_inner_band);
    if (!inBand.length) return null;
    points.sort((a, b) => a.u_pu - b.u_pu);
    return {
        compliant: inBand.every((p) => p.covers),
        q_req_mvar: qPn * pn,
        q_over_pn: qPn,
        pn_mw: pn,
        u_inner_min: uInnerMin,
        u_inner_max: uInnerMax,
        u_outer_min: band.vmin,
        u_outer_max: band.vmax,
        points,
    };
}

export class BessPreliminaryDesignResultsDialog {
    constructor(editorUi, dataJson, graph, wizardParams) {
        this.ui = editorUi;
        this.graph = graph;
        this.wizardParams = wizardParams || {};
        this.results = dataJson?.bess_preliminary_results || dataJson;
        this._overlay = null;
        this._panel = null;
        this._body = null;
        this._maxBtn = null;
        this._parkHandle = null;
        this._dialogMaximized = false;
        this._chartLightbox = null;
        this._chartMaxKind = null;
        this._onResize = null;
        this._onKey = null;
        this._paintedCase = pickBessSldCase(this.results)?.name || null;
        this._chartPrefs = defaultChartPrefs();
    }

    panelCss(maximized) {
        return maximized
            ? 'background:#fff;border-radius:0;max-width:none;width:100%;height:100%;max-height:none;display:flex;flex-direction:column;box-shadow:none;'
            : 'background:#fff;border-radius:10px;max-width:1180px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.2);';
    }

    headerBtnCss() {
        return 'padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;cursor:pointer;font-weight:600;';
    }

    show() {
        if (!this.results || typeof this.results !== 'object') {
            alert('BESS Preliminary Design returned no results.');
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'bess-prelim-results-overlay';
        overlay.style.cssText =
            'position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;';
        this._overlay = overlay;

        const panel = document.createElement('div');
        panel.style.cssText = this.panelCss(false);
        this._panel = panel;

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0;';
        header.innerHTML = '<h2 style="margin:0;font-size:18px;color:#1d4ed8;flex:1;">BESS Preliminary Design Results</h2>';

        const minBtn = document.createElement('button');
        minBtn.type = 'button';
        minBtn.textContent = 'Minimize';
        minBtn.title = 'Hide this window and show the diagram (click outside the dialog does the same)';
        minBtn.style.cssText = this.headerBtnCss();
        minBtn.onclick = () => this.parkForCanvas();

        const maxBtn = document.createElement('button');
        maxBtn.type = 'button';
        maxBtn.textContent = 'Maximize';
        maxBtn.title = 'Fill the screen with this results window';
        maxBtn.style.cssText = this.headerBtnCss();
        maxBtn.onclick = () => this.setDialogMaximized(!this._dialogMaximized);
        this._maxBtn = maxBtn;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:6px;background:#64748b;color:#fff;cursor:pointer;';
        closeBtn.onclick = () => this.dismiss();
        header.appendChild(minBtn);
        header.appendChild(maxBtn);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.style.cssText = 'padding:16px 20px;overflow:auto;flex:1;min-height:0;font-size:13px;line-height:1.5;';
        body.innerHTML = this.buildHtml();
        this._body = body;

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;flex-shrink:0;';
        const pdfBtn = document.createElement('button');
        pdfBtn.textContent = 'Export PDF Summary';
        pdfBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;';
        pdfBtn.onclick = () => this.exportPdf();
        footer.appendChild(pdfBtn);

        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        if (!document.getElementById('bess-prelim-sld-flash')) {
            const style = document.createElement('style');
            style.id = 'bess-prelim-sld-flash';
            style.textContent = `
                @keyframes electrisim-calc-error-flash {
                    0%, 100% { filter: drop-shadow(0 0 0 rgba(37,99,235,0)); }
                    50% { filter: drop-shadow(0 0 14px rgba(37,99,235,0.95)); }
                }
                .electrisim-calc-error-flash { animation: electrisim-calc-error-flash 1.6s ease-in-out 2; }
            `;
            document.head.appendChild(style);
        }
        attachBackdropCloseHandler(overlay, panel, () => this.parkForCanvas());

        body.addEventListener('click', (ev) => {
            const caseHit = ev.target.closest('[data-sld-case]');
            const nameHit = ev.target.closest('[data-sld-name]');
            const caseName = caseHit?.getAttribute('data-sld-case');
            if (caseName) this.paintSld(caseName);
            if (nameHit) {
                const name = nameHit.getAttribute('data-sld-name');
                this.focusElement(name);
                this.parkForCanvas(caseName || name);
                return;
            }
            if (caseName) this.parkForCanvas(caseName);
        });

        this.bindChartControls(body);
        this.bindMaximizeControls(body);
        this.redrawCharts(body);
        this.paintSld(this._paintedCase);

        this._onResize = () => {
            if (!this._overlay) return;
            if (this._chartMaxKind) this.drawMaximizedChart();
            else this.redrawCharts(this._body);
        };
        this._onKey = (ev) => {
            if (ev.key !== 'Escape') return;
            if (/^(INPUT|TEXTAREA|SELECT)$/i.test(ev.target?.tagName || '')) return;
            if (this._chartMaxKind) {
                ev.preventDefault();
                this.closeChartLightbox();
            } else if (this._dialogMaximized) {
                ev.preventDefault();
                this.setDialogMaximized(false);
            }
        };
        window.addEventListener('resize', this._onResize);
        document.addEventListener('keydown', this._onKey);
    }

    parkForCanvas(elementName) {
        if (!this._overlay) return;
        this.closeChartLightbox();
        this._parkHandle?.dismiss?.();
        const label = elementName
            ? `Back to results (${elementName})`
            : 'Back to BESS Preliminary Design results';
        this._parkHandle = parkOverlayForCanvas(this._overlay, {
            restoreLabel: label,
            zIndex: 100001,
        });
    }

    dismiss() {
        this.closeChartLightbox();
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        if (this._onKey) document.removeEventListener('keydown', this._onKey);
        this._onResize = null;
        this._onKey = null;
        this._parkHandle?.dismiss?.();
        this._parkHandle = null;
        if (this._overlay?.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null;
        this._panel = null;
        this._body = null;
        this._maxBtn = null;
        this._dialogMaximized = false;
    }

    setDialogMaximized(on) {
        this._dialogMaximized = !!on;
        if (this._maxBtn) {
            this._maxBtn.textContent = on ? 'Restore' : 'Maximize';
            this._maxBtn.title = on
                ? 'Return the results window to its normal size'
                : 'Fill the screen with this results window';
        }
        if (this._panel) this._panel.style.cssText = this.panelCss(on);
        if (this._overlay && !this._chartMaxKind) {
            this._overlay.style.padding = on ? '0' : '16px';
            this._overlay.style.alignItems = on ? 'stretch' : 'center';
            this._overlay.style.justifyContent = on ? 'stretch' : 'center';
        }
        requestAnimationFrame(() => {
            this.redrawCharts(this._body);
            if (this._chartMaxKind) this.drawMaximizedChart();
        });
    }

    bindMaximizeControls(body) {
        body?.querySelectorAll('[data-chart-max]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const kind = btn.getAttribute('data-chart-max');
                if (kind === 'pq' || kind === 'uq') this.openChartLightbox(kind);
            });
        });
    }

    openChartLightbox(kind) {
        if (!this._overlay || (kind !== 'pq' && kind !== 'uq')) return;
        this.closeChartLightbox();
        const title = kind === 'pq' ? 'P/Q capability envelope at POC' : 'U–Q at rated P';
        const box = document.createElement('div');
        box.style.cssText =
            'position:absolute;inset:0;z-index:5;background:#fff;display:flex;flex-direction:column;';
        const head = document.createElement('div');
        head.style.cssText =
            'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e2e8f0;gap:8px;flex-shrink:0;';
        head.innerHTML = `<h2 style="margin:0;font-size:16px;color:#1d4ed8;flex:1;">${escapeHtml(title)}</h2>`;
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.textContent = 'Restore';
        restore.title = 'Return to the results summary';
        restore.style.cssText = this.headerBtnCss();
        restore.onclick = () => this.closeChartLightbox();
        head.appendChild(restore);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'flex:1;min-height:0;padding:12px 16px;';
        const canvas = document.createElement('canvas');
        canvas.dataset.fill = '1';
        canvas.style.cssText =
            'display:block;width:100%;height:100%;border:1px solid #e2e8f0;border-radius:6px;background:#fafafa;';
        wrap.appendChild(canvas);
        box.appendChild(head);
        box.appendChild(wrap);
        this._overlay.appendChild(box);
        this._overlay.style.padding = '0';
        this._chartLightbox = box;
        this._chartMaxKind = kind;
        requestAnimationFrame(() => requestAnimationFrame(() => this.drawMaximizedChart()));
    }

    drawMaximizedChart() {
        const canvas = this._chartLightbox?.querySelector('canvas');
        if (!canvas) return;
        if (this._chartMaxKind === 'pq') this._drawPqChart(canvas);
        else if (this._chartMaxKind === 'uq') this._drawUqChart(canvas);
    }

    closeChartLightbox() {
        if (this._chartLightbox?.parentNode) {
            this._chartLightbox.parentNode.removeChild(this._chartLightbox);
        }
        this._chartLightbox = null;
        this._chartMaxKind = null;
        if (this._overlay) {
            this._overlay.style.padding = this._dialogMaximized ? '0' : '16px';
            this._overlay.style.alignItems = this._dialogMaximized ? 'stretch' : 'center';
            this._overlay.style.justifyContent = this._dialogMaximized ? 'stretch' : 'center';
        }
        if (this._body) this.redrawCharts(this._body);
    }

    paintSld(caseName) {
        const graph = this.graph || this.ui?.editor?.graph;
        if (!graph) return;
        try {
            const band = plantVoltageBand(this.wizardParams, this.results);
            const painted = applyBessPreliminaryResultsToSld(graph, this.results, {
                caseName: caseName || undefined,
                umin_pu: band.vmin,
                umax_pu: band.vmax,
            });
            if (painted) this._paintedCase = painted;
            this._overlay?.querySelectorAll('[data-sld-case]').forEach((btn) => {
                const on = btn.getAttribute('data-sld-case') === this._paintedCase;
                btn.style.fontWeight = on ? '700' : '400';
                const tr = btn.closest('tr');
                if (tr) tr.style.background = on ? '#eff6ff' : 'transparent';
            });
        } catch (err) {
            console.warn('BESS preliminary SLD paint failed', err);
        }
        this.redrawCharts(this._body);
        if (this._chartMaxKind) this.drawMaximizedChart();
    }

    focusElement(name) {
        const graph = this.graph || this.ui?.editor?.graph;
        if (!graph || !name) return false;
        const map = buildGraphCellLookupMap(graph);
        const cell = resolveGraphCellForResult(map, { name }, graph);
        if (!cell) return false;
        try {
            graph.setSelectionCell(cell);
            if (graph.scrollCellToVisible) graph.scrollCellToVisible(cell, true);
            const state = graph.view?.getState?.(cell);
            const node = state?.shape?.node;
            if (node) {
                node.classList.add('electrisim-calc-error-flash');
                setTimeout(() => node.classList.remove('electrisim-calc-error-flash'), 1600);
            }
        } catch (e) { /* ignore */ }
        return true;
    }

    buildHtml() {
        const r = this.results;
        const summary = r.summary || {};
        let html = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">`;
        html += this.kpi('Cases passed', `${summary.passed_cases ?? 0} / ${summary.total_cases ?? 0}`, '#16a34a');
        html += this.kpi('Failed', summary.failed_cases ?? 0, '#f59e0b');
        html += this.kpi('Diverged', summary.diverged_cases ?? 0, '#dc2626');
        if (summary.target_cases) {
            const allMet = summary.target_met_cases === summary.target_cases;
            html += this.kpi('POC target met',
                `${summary.target_met_cases ?? 0} / ${summary.target_cases}`,
                allMet ? '#16a34a' : '#dc2626');
        }
        const uqKpi = assessUqAtRatedP(r.pq_envelope, this.wizardParams, r);
        if (uqKpi) {
            html += this.kpi('U–Q at rated P',
                uqKpi.compliant ? 'Compliant' : 'Non-compliant',
                uqKpi.compliant ? '#16a34a' : '#dc2626');
        }
        html += `</div>`;
        if (summary.target_met_cases === summary.target_cases && summary.target_cases
            && (summary.failed_cases || 0) > 0) {
            html += `<p style="font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;` +
                `border-radius:6px;padding:8px;margin:0 0 12px;">` +
                `The requested POC P/Q was delivered, but named cases still fail thermal or voltage limits. ` +
                `The limiter column names the binding element (often an undersized MV cable).` +
                `</p>`;
        }

        html += this.buildTargetTable();
        html += this.buildVoltageProfile();

        html += `<p style="font-size:11px;color:#64748b;margin:0 0 8px;">SLD result boxes show the selected load-flow case (default <b>Unom_Export_Capacitive</b>, POC P/Q export-positive). Click a case row to paint that load-flow on the diagram. Click a limiter or bus name to select that element.</p>`;
        html += `<h3>Named load-flow cases</h3>`;
        const band = plantVoltageBand(this.wizardParams, r);
        html += `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">|P| at the POC is capped at the Pn you entered (charge is scaled so auxiliaries and losses do not import more than Pn). Rated Discharge/Charge are unity power factor. OLTC tap is the position after that case’s load-flow. Named-case voltage pass/fail uses the plant allowance <b>${band.vmin.toFixed(2)}–${band.vmax.toFixed(2)} pu</b> (wizard plant voltage min/max), not the POC Umin/Umax study voltages.</p>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Case</th><th>P POC</th><th>Q POC</th><th>Losses</th><th>Tap</th><th>Status</th><th>Limiting element</th></tr>`;
        (r.named_cases || []).forEach((c) => {
            const status = !c.converged ? '<span style="color:#dc2626">Diverged</span>' :
                c.pass ? '<span style="color:#16a34a">Pass</span>' : '<span style="color:#f59e0b">Fail</span>';
            const painted = c.name && c.name === this._paintedCase;
            const caseBtn = `<button type="button" class="bess-prelim-sld-link" data-sld-case="${escapeHtml(c.name)}" ` +
                  `title="Show this load-flow on the SLD" ` +
                  `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;font-weight:${painted ? '700' : '400'};">${escapeHtml(c.name)}</button>`;
            html += `<tr data-sld-case="${escapeHtml(c.name)}" style="border-bottom:1px solid #e2e8f0;background:${painted ? '#eff6ff' : 'transparent'};cursor:pointer;"><td style="padding:6px;">${caseBtn}</td>` +
                `<td style="text-align:center">${fmt(c.p_poc_mw)}</td><td style="text-align:center">${fmt(c.q_poc_mvar)}</td>` +
                `<td style="text-align:center">${fmt(c.p_loss_mw)}</td>` +
                `<td style="text-align:center">${c.tap_pos == null ? '—' : fmt(c.tap_pos, 0)}</td>` +
                `<td style="text-align:center">${status}</td><td style="padding:6px;">${limiterHtml(c.limiting_element)}</td></tr>`;
        });
        html += `</table>`;

        html += `<h3>Rating verification (worst-case loading vs nameplate)</h3>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Element</th><th>Type</th><th>Nameplate</th><th>Loading %</th></tr>`;
        (r.rating_table || []).forEach((el) => {
            const over = Number(el.loading_percent) > 100;
            const nameBtn = el.name
                ? `<button type="button" class="bess-prelim-sld-link" data-sld-name="${escapeHtml(el.name)}" ` +
                  `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;">${escapeHtml(el.name)}</button>`
                : '—';
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">${nameBtn}</td>` +
                `<td>${escapeHtml(el.type)}</td><td style="text-align:center">${ratingLabel(el)}</td>` +
                `<td style="text-align:center;color:${over ? '#dc2626' : 'inherit'}">${fmt(el.loading_percent, 1)}</td></tr>`;
        });
        html += `</table>`;

        const envError = r.pq_envelope?.error;
        if (envError) {
            html += `<h3>P/Q capability envelope at POC</h3>`;
            html += `<p style="font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;` +
                `border-radius:6px;padding:8px;">P/Q envelope was not computed: ${escapeHtml(envError)}</p>`;
        } else if (!r.pq_envelope) {
            html += `<h3>P/Q capability envelope at POC</h3>`;
            html += `<p style="font-size:12px;color:#64748b;">P/Q envelope was not run.</p>`;
        } else {
            html += this.chartHeadingHtml('P/Q capability envelope at POC', 'pq');
            html += `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">Solid coloured curves are plant <b>Qmax (capacitive, Q&gt;0)</b>; dashed coloured curves are plant <b>Qmin (inductive, Q&lt;0)</b>, at Umin / Unom / Umax. The grey band is the grid-code |Q| rectangle at the entered PF, from −Pn (charge / import) to +Pn (discharge / export). Envelope at the diagram tap, 25% Pn steps. Axis ticks mark Pn, |Q|/Pn from the entered PF, and import/export quadrants. <b>Click a point</b> on a voltage curve to paint that load-flow on the SLD result boxes.</p>`;
            html += this.chartOptionsHtml('pq');
            html += `<div data-chart-wrap="pq" style="width:100%;"><canvas id="bess-prelim-pq-canvas" width="900" height="420" style="display:block;width:100%;height:420px;border:1px solid #e2e8f0;border-radius:6px;background:#fafafa;"></canvas></div>`;
            html += `<p style="font-size:12px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;margin:8px 0 0;">The larger gap between the three voltage traces on the <b>inductive</b> (dashed) side is from the load-flow, not from axis scaling. Absorbing Q lowers plant voltages, so available Qmin changes more with the POC voltage setpoint. Injecting Q (capacitive) raises voltages toward the OLTC / voltage limits, so the three Qmax curves stay closer together.</p>`;
            html += this.chartHeadingHtml('U–Q at rated P', 'uq', true);
            html += this.buildUqCompliance();
            html += this.chartOptionsHtml('uq');
            html += `<div data-chart-wrap="uq" style="width:100%;"><canvas id="bess-prelim-uq-canvas" width="880" height="400" style="display:block;width:100%;height:400px;border:1px solid #e2e8f0;border-radius:6px;background:#fafafa;"></canvas></div>`;
            html += this.buildEnvelopeLimiters();
        }

        const taps = r.tap_sweep || [];
        const tapProblem = taps.find((t) => t.error);
        html += `<details style="margin-top:16px;">`;
        html += `<summary style="cursor:pointer;font-size:16px;font-weight:700;color:#0f172a;">Tap position impact (rated discharge)</summary>`;
        html += `<p style="font-size:12px;color:#64748b;margin:8px 0;">Optional OLTC sensitivity. Enable <b>Tap position sweep</b> in the wizard and re-run if you need this table. It is collapsed here because it is secondary to the named cases and P/Q envelope.</p>`;
        if (tapProblem) {
            html += `<p style="font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;` +
                `border-radius:6px;padding:8px;">${escapeHtml(tapProblem.message || tapProblem.error)}</p>`;
        } else if (!taps.length) {
            html += `<p style="font-size:12px;color:#64748b;">Tap sweep was not run.</p>`;
        } else {
            html += `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">Rated discharge at Unom, tap forced (OLTC off). Qmax/Qmin are the largest feasible POC Q at that tap; <b>n/a</b> means the plant is already overloaded at Q = 0.</p>`;
            html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
            html += `<tr style="background:#f1f5f9;"><th>Tap</th><th>HV V (pu)</th><th>MV V (pu)</th><th>P POC</th><th>Qmax</th><th>Qmin</th><th>Qmax limiter</th></tr>`;
            taps.forEach((t) => {
                const status = t.converged ? '' : ' style="color:#dc2626"';
                const qmax = t.q_max_mvar == null ? 'n/a' : fmt(t.q_max_mvar);
                const qmin = t.q_min_mvar == null ? 'n/a' : fmt(t.q_min_mvar);
                html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="text-align:center;padding:4px;">${t.tap_pos}</td>` +
                    `<td style="text-align:center">${fmt(t.hv_vm_pu, 4)}</td>` +
                    `<td style="text-align:center"${status}>${t.converged ? fmt(t.mv_vm_pu, 4) : 'diverged'}</td>` +
                    `<td style="text-align:center">${fmt(t.p_poc_mw)}</td>` +
                    `<td style="text-align:center">${qmax}</td>` +
                    `<td style="text-align:center">${qmin}</td>` +
                    `<td style="padding:4px;">${limiterHtml(t.q_max_limiter || t.limiting_element)}</td></tr>`;
            });
            html += `</table>`;
        }
        html += `</details>`;
        return html;
    }

    buildTargetTable() {
        const targets = (this.results.named_cases || []).filter((c) => c.target_met != null);
        if (!targets.length) return '';
        let html = `<h3>Requested POC operating point</h3>`;
        html += `<p style="font-size:11px;color:#64748b;margin:0 0 6px;">` +
            `Twelve corners: Umin / Unom / Umax × Export (discharge) / Import (charge) × Capacitive (Q&gt;0) / Inductive (Q&lt;0), ` +
            `at the entered Pn and power factor. Export-positive at the POC: P &gt; 0 delivers into the grid, Q &gt; 0 is capacitive. ` +
            `Achieved values include auxiliary load and internal losses.</p>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Case</th>` +
            `<th>P target</th><th>P achieved</th><th>Q target</th><th>Q achieved</th>` +
            `<th>PCS per unit</th><th>Result</th></tr>`;
        targets.forEach((c) => {
            const ok = c.target_met;
            const lim = c.limiting_element || {};
            const note = ok ? 'Met'
                : (c.clamp_reason === 'Battery DC Pmax' || lim.type === 'battery_dc' ? 'Battery DC Pmax'
                    : (c.clamp_reason === 'PCS apparent power' || c.rating_clamped ? (c.clamp_reason || 'PCS rating exceeded')
                        : 'Not reachable'));
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">${escapeHtml(c.name)}</td>` +
                `<td style="text-align:center">${fmt(c.target_p_mw)}</td>` +
                `<td style="text-align:center">${fmt(c.p_poc_mw)}</td>` +
                `<td style="text-align:center">${fmt(c.target_q_mvar)}</td>` +
                `<td style="text-align:center">${fmt(c.q_poc_mvar)}</td>` +
                `<td style="text-align:center">${fmt(c.pcs_p_each_mw)} MW / ${fmt(c.pcs_q_each_mvar)} Mvar</td>` +
                `<td style="text-align:center;color:${ok ? '#16a34a' : '#dc2626'};font-weight:600;">${note}</td></tr>`;
        });
        html += `</table>`;
        return html;
    }

    buildVoltageProfile() {
        const profile = this.results.voltage_profile
            || (this.results.named_cases || []).find((c) => c.voltage_profile)?.voltage_profile
            || [];
        if (!profile.length) return '';
        let html = `<h3>Voltage profile (Unom, export capacitive POC point)</h3>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Bus</th><th>Vn (kV)</th><th>V (pu)</th></tr>`;
        profile.forEach((b) => {
            const vm = Number(b.vm_pu);
            const band = plantVoltageBand(this.wizardParams, this.results);
            const bad = Number.isFinite(vm) && (vm < band.vmin || vm > band.vmax);
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">` +
                `<button type="button" class="bess-prelim-sld-link" data-sld-name="${escapeHtml(b.name)}" ` +
                `style="background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font:inherit;">${escapeHtml(b.name)}</button></td>` +
                `<td style="text-align:center">${fmt(b.vn_kv, 2)}</td>` +
                `<td style="text-align:center;color:${bad ? '#dc2626' : 'inherit'}">${fmt(b.vm_pu, 4)}</td></tr>`;
        });
        html += `</table>`;
        return html;
    }

    buildUqCompliance() {
        const uq = assessUqAtRatedP(this.results.pq_envelope, this.wizardParams, this.results);
        const umin = uq?.u_inner_min ?? (Number(this.wizardParams?.umin_pu) || 0.95);
        const umax = uq?.u_inner_max ?? (Number(this.wizardParams?.umax_pu) || 1.05);
        const outer = plantVoltageBand(this.wizardParams, this.results);
        let html = `<p style="font-size:12px;color:#64748b;margin:4px 0 8px;">` +
            `Inner band ${umin.toFixed(2)}–${umax.toFixed(2)} pu is the required operating area at rated export (P = +Pn). ` +
            `Hatched ${outer.vmin.toFixed(2)}–${outer.vmax.toFixed(2)} pu is the reduced-P / plant voltage-allowance region. Markers are plant Qmax / Qmin at +Pn. ` +
            `Compliant when those points cover the required |Q|/Pn from the grid-code power factor. ` +
            `<b>Click a marker</b> to show the rated-export capacitive or inductive load-flow at that voltage on the SLD.` +
            `</p>`;
        if (!uq) return html;
        const ok = uq.compliant;
        const fails = (uq.points || []).filter((p) => p.in_inner_band && !p.covers);
        const failTxt = fails.length
            ? ` Shortfall at ${fails.map((p) => `U=${Number(p.u_pu).toFixed(2)} pu`).join(', ')}.`
            : '';
        html += `<p style="font-size:13px;font-weight:700;margin:0 0 8px;padding:8px 10px;border-radius:6px;` +
            `border:1px solid ${ok ? '#bbf7d0' : '#fecaca'};background:${ok ? '#f0fdf4' : '#fef2f2'};` +
            `color:${ok ? '#15803d' : '#b91c1c'};">` +
            (ok
                ? `COMPLIANT — plant Q at rated export covers the required |Q|/Pn = ${fmt(uq.q_over_pn, 3)} from ${umin.toFixed(2)} to ${umax.toFixed(2)} pu.`
                : `NON-COMPLIANT — plant Q at rated export does not cover the required |Q|/Pn = ${fmt(uq.q_over_pn, 3)} over ${umin.toFixed(2)}–${umax.toFixed(2)} pu.${failTxt}`) +
            `</p>`;
        if ((uq.points || []).length) {
            html += `<table style="width:100%;border-collapse:collapse;margin:0 0 8px;font-size:12px;">`;
            html += `<tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">U [pu]</th>` +
                `<th>Required band</th><th>Qmax / Pn</th><th>Qmin / Pn</th><th>Result</th></tr>`;
            uq.points.forEach((p) => {
                const status = !p.in_inner_band
                    ? '<span style="color:#64748b">n/a (reduced P)</span>'
                    : p.covers
                        ? '<span style="color:#16a34a;font-weight:600;">Pass</span>'
                        : '<span style="color:#dc2626;font-weight:600;">Fail</span>';
                html += `<tr style="border-bottom:1px solid #e2e8f0;">` +
                    `<td style="padding:6px;">${fmt(p.u_pu, 4)}</td>` +
                    `<td style="text-align:center">${p.in_inner_band ? 'Yes' : 'No'}</td>` +
                    `<td style="text-align:center">${fmt(p.q_max_over_pn, 3)}</td>` +
                    `<td style="text-align:center">${fmt(p.q_min_over_pn, 3)}</td>` +
                    `<td style="text-align:center">${status}</td></tr>`;
            });
            html += `</table>`;
        }
        return html;
    }

    buildEnvelopeLimiters() {
        const curves = this.results.pq_envelope?.curves || {};
        const rows = [];
        Object.entries(curves).forEach(([vk, c]) => {
            const seen = new Set();
            (c.p_mw || []).forEach((p, i) => {
                ['limit_max', 'limit_min'].forEach((key) => {
                    const lim = (c[key] || [])[i];
                    if (!lim) return;
                    const id = `${vk}|${lim.type}|${lim.name}|${lim.limit_reason || ''}`;
                    if (seen.has(id)) return;
                    seen.add(id);
                    rows.push({
                        u: vk,
                        side: key === 'limit_max' ? 'Qmax' : 'Qmin',
                        p,
                        text: limiterHtml(lim),
                        name: lim.name,
                    });
                });
            });
        });
        if (!rows.length) return '';
        let html = `<p style="font-size:11px;color:#64748b;margin:8px 0 4px;">Binding constraints on the envelope (unique limiter per voltage / side):</p>`;
        html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">`;
        html += `<tr style="background:#f1f5f9;"><th>U (pu)</th><th>Side</th><th>P (MW)</th><th style="text-align:left;padding:6px;">Limiter</th></tr>`;
        rows.forEach((r) => {
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="text-align:center">${escapeHtml(r.u)}</td>` +
                `<td style="text-align:center">${r.side}</td><td style="text-align:center">${fmt(r.p)}</td>` +
                `<td style="padding:6px;">${r.text}</td></tr>`;
        });
        html += `</table>`;
        return html;
    }

    kpi(label, value, color) {
        return `<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">` +
            `<div style="font-size:11px;color:#64748b;">${label}</div>` +
            `<div style="font-size:20px;font-weight:700;color:${color};">${value}</div></div>`;
    }

    chartHeadingHtml(title, kind, spaced) {
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;` +
            `margin:${spaced ? '16px 0 8px' : '0 0 8px'};">` +
            `<h3 style="margin:0;">${escapeHtml(title)}</h3>` +
            `<button type="button" data-chart-max="${escapeHtml(kind)}" ` +
            `title="Show this chart full screen" ` +
            `style="${this.headerBtnCss()}">Maximize</button></div>`;
    }

    chartOptionsHtml(kind) {
        const p = this._chartPrefs;
        const inp = (key, placeholder = '') =>
            `<input data-chart-pref="${key}" value="${escapeHtml(p[key] ?? '')}" ` +
            `placeholder="${escapeHtml(placeholder)}" ` +
            `style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;">`;
        const extra = kind === 'pq'
            ? `<label style="display:flex;align-items:center;gap:8px;grid-column:1/-1;">` +
              `<input type="checkbox" data-chart-pref="pqPu"${p.pqPu ? ' checked' : ''}> ` +
              `Per-unit axes (P/Pn vs Q/Pn)</label>`
            : '';
        return `<details style="margin:8px 0 10px;font-size:12px;color:#334155;">` +
            `<summary style="cursor:pointer;font-weight:600;">Chart options — title, axis labels, scaling</summary>` +
            `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;` +
            `padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">` +
            `<label>Title<br>${inp(`${kind}Title`)}</label>` +
            `<label>X axis<br>${inp(`${kind}XLabel`)}</label>` +
            `<label>Y axis<br>${inp(`${kind}YLabel`)}</label>` +
            `<span></span>` +
            `<label>X min<br>${inp(`${kind}XMin`, 'auto')}</label>` +
            `<label>X max<br>${inp(`${kind}XMax`, 'auto')}</label>` +
            `<label>Y min<br>${inp(`${kind}YMin`, 'auto')}</label>` +
            `<label>Y max<br>${inp(`${kind}YMax`, 'auto')}</label>` +
            extra +
            `<div style="grid-column:1/-1;">` +
            `<button type="button" data-chart-apply style="padding:6px 12px;border:1px solid #cbd5e1;` +
            `border-radius:6px;background:#fff;cursor:pointer;font-weight:600;">Apply chart options</button>` +
            `</div></div></details>`;
    }

    bindChartControls(body) {
        if (!body) return;
        body.querySelectorAll('[data-chart-apply]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.readChartPrefs(body);
                this.redrawCharts(body);
            });
        });
        body.querySelectorAll('[data-chart-pref="pqPu"]').forEach((el) => {
            el.addEventListener('change', () => {
                this.readChartPrefs(body);
                this.redrawCharts(body);
            });
        });
    }

    bindChartHitCanvas(canvas) {
        if (!canvas || canvas.dataset.bessHitBound === '1') return;
        canvas.dataset.bessHitBound = '1';
        canvas.style.cursor = 'crosshair';
        canvas.addEventListener('click', (ev) => this.handleChartClick(canvas, ev));
        canvas.addEventListener('mousemove', (ev) => this.handleChartMove(canvas, ev));
        canvas.addEventListener('mouseleave', () => {
            canvas.style.cursor = 'crosshair';
            canvas.removeAttribute('title');
        });
    }

    handleChartMove(canvas, ev) {
        const hit = nearestHit(canvas._bessHits, ev.offsetX, ev.offsetY, 22);
        canvas.style.cursor = hit ? 'pointer' : 'crosshair';
        if (hit?.caseName) canvas.title = `Show ${hit.caseName} on the SLD`;
        else canvas.removeAttribute('title');
    }

    handleChartClick(canvas, ev) {
        const hit = nearestHit(canvas._bessHits, ev.offsetX, ev.offsetY, 28);
        if (!hit?.caseName) return;
        ev.preventDefault();
        ev.stopPropagation();
        const name = existingCaseName(this.results, hit.caseName);
        if (!name) return;
        this.paintSld(name);
        this.parkForCanvas(name);
    }

    readChartPrefs(body) {
        const p = this._chartPrefs;
        body.querySelectorAll('[data-chart-pref]').forEach((el) => {
            const key = el.getAttribute('data-chart-pref');
            if (!key) return;
            if (el.type === 'checkbox') p[key] = !!el.checked;
            else p[key] = el.value;
        });
    }

    redrawCharts(body) {
        const host = body || this._overlay;
        this._drawPqChart(host?.querySelector('#bess-prelim-pq-canvas'));
        this._drawUqChart(host?.querySelector('#bess-prelim-uq-canvas'));
    }

    chartCssHeight(kind) {
        if (this._dialogMaximized) {
            return kind === 'pq'
                ? Math.max(520, Math.floor(window.innerHeight * 0.55))
                : Math.max(480, Math.floor(window.innerHeight * 0.5));
        }
        return kind === 'pq' ? 420 : 400;
    }

    prepareCanvas(canvas, cssHeight) {
        const wrap = canvas.parentElement;
        const cssW = Math.max(320, Math.floor(wrap?.clientWidth || canvas.clientWidth || 880));
        let cssH = cssHeight || 400;
        if (canvas.dataset.fill === '1' && wrap) {
            cssH = Math.max(280, Math.floor(wrap.clientHeight || cssH));
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = '100%';
        canvas.style.height = canvas.dataset.fill === '1' ? '100%' : `${cssH}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, cssW, cssH);
        return { ctx, W: cssW, H: cssH };
    }

    drawChartFrame(ctx, {
        W, H, padL, padR, padT, padB, xMin, xMax, yMin, yMax, xTicks, yTicks,
        xFmt, yFmt, title, xLabel, yLabel,
    }) {
        const xScale = (v) => padL + ((v - xMin) / (xMax - xMin || 1)) * (W - padL - padR);
        const yScale = (v) => H - padB - ((v - yMin) / (yMax - yMin || 1)) * (H - padT - padB);
        ctx.save();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial';
        (xTicks || []).forEach((t) => {
            const x = xScale(t);
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, H - padB);
            ctx.stroke();
            ctx.beginPath();
            ctx.strokeStyle = '#94a3b8';
            ctx.moveTo(x, H - padB);
            ctx.lineTo(x, H - padB + 5);
            ctx.stroke();
            ctx.strokeStyle = '#e2e8f0';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText((xFmt || fmtTick)(t), x, H - padB + 7);
        });
        (yTicks || []).forEach((t) => {
            const y = yScale(t);
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText((yFmt || fmtTick)(t), padL - 6, y);
        });
        ctx.restore();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, H - padB);
        ctx.lineTo(W - padR, H - padB);
        ctx.stroke();
        if (yMin < 0 && yMax > 0) {
            ctx.save();
            ctx.strokeStyle = '#64748b';
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(padL, yScale(0));
            ctx.lineTo(W - padR, yScale(0));
            ctx.stroke();
            ctx.restore();
        }
        if (xMin < 0 && xMax > 0) {
            ctx.save();
            ctx.strokeStyle = '#64748b';
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(xScale(0), padT);
            ctx.lineTo(xScale(0), H - padB);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        if (title) ctx.fillText(title, padL, 8);
        ctx.fillStyle = '#334155';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        if (xLabel) ctx.fillText(xLabel, padL + (W - padL - padR) / 2, H - 6);
        if (yLabel) {
            ctx.save();
            ctx.translate(14, padT + (H - padT - padB) / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(yLabel, 0, 0);
            ctx.restore();
        }
        return { xScale, yScale };
    }

    _drawPqChart(canvas) {
        if (!canvas) return;
        const pq = this.results.pq_envelope;
        const curves = pq?.curves || {};
        const prefs = this._chartPrefs;
        const { ctx, W, H } = this.prepareCanvas(canvas, this.chartCssHeight('pq'));
        const padL = 64;
        const padR = 118;
        const padT = 36;
        const padB = 62;
        const { pn, qPn, qReq } = requirementPnQ(pq, this.wizardParams);
        const pf = Math.abs(Number(this.wizardParams?.powerFactor) || 0.95);
        const pu = !!prefs.pqPu;
        const denomP = pu && pn > 0 ? pn : 1;
        const denomQ = pu && pn > 0 ? pn : 1;

        const strokePoly = (pts, qKey, dash, xScale, yScale) => {
            ctx.save();
            if (dash) ctx.setLineDash(dash);
            ctx.beginPath();
            let started = false;
            pts.forEach((p, j) => {
                const q = qKey?.[j];
                if (q == null) return;
                const x = xScale(Number(p) / denomP);
                const y = yScale(Number(q) / denomQ);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        };

        let allP = [];
        let allQ = [];
        Object.values(curves).forEach((c) => {
            (c.p_mw || []).forEach((p) => allP.push(Number(p) / denomP));
            (c.q_max_mvar || []).forEach((q) => { if (q != null) allQ.push(Number(q) / denomQ); });
            (c.q_min_mvar || []).forEach((q) => { if (q != null) allQ.push(Number(q) / denomQ); });
        });
        const reqMap = pq?.requirements || {};
        const req = Object.values(reqMap).find((r) => r && r.p_mw) || null;
        if (req) {
            (req.p_mw || []).forEach((p) => allP.push(Number(p) / denomP));
            (req.q_req_max_mvar || []).forEach((q) => allQ.push(Number(q) / denomQ));
            (req.q_req_min_mvar || []).forEach((q) => allQ.push(Number(q) / denomQ));
        }
        if (!allP.length) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Arial';
            ctx.fillText('P/Q envelope not available', padL, H / 2);
            return;
        }
        let xMin = Math.min(...allP, 0);
        let xMax = Math.max(...allP, 0);
        let yMin = Math.min(...allQ, 0);
        let yMax = Math.max(...allQ, 0);
        const padX = Math.max((xMax - xMin) * 0.06, pu ? 0.05 : 1);
        const padY = Math.max((yMax - yMin) * 0.08, pu ? 0.04 : 1);
        xMin -= padX;
        xMax += padX;
        yMin -= padY;
        yMax += padY;
        xMin = optNum(prefs.pqXMin) ?? xMin;
        xMax = optNum(prefs.pqXMax) ?? xMax;
        yMin = optNum(prefs.pqYMin) ?? yMin;
        yMax = optNum(prefs.pqYMax) ?? yMax;
        if (xMax <= xMin) xMax = xMin + 1;
        if (yMax <= yMin) yMax = yMin + 1;

        const pnX = pu ? 1 : pn;
        const qY = pu ? qPn : qReq;
        const xTicks = mergeTicks(xMin, xMax, [xMin, -pnX, 0, pnX, xMax]);
        const yTicks = mergeTicks(yMin, yMax, [yMin, -qY, 0, qY, yMax]);
        const xLabel = prefs.pqXLabel || (pu ? 'P / Pn  (− import / + export)' : 'P [MW]  (− import / + export)');
        const yLabel = prefs.pqYLabel || (pu ? 'Q / Pn  (− inductive / + capacitive)' : 'Q [Mvar]  (− inductive / + capacitive)');
        const { xScale, yScale } = this.drawChartFrame(ctx, {
            W, H, padL, padR, padT, padB, xMin, xMax, yMin, yMax, xTicks, yTicks,
            xFmt: (v) => fmtTick(v, pu ? 2 : 1),
            yFmt: (v) => fmtTick(v, pu ? 3 : 1),
            title: prefs.pqTitle,
            xLabel,
            yLabel,
        });

        if (req && (req.p_mw || []).length) {
            ctx.save();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
            ctx.strokeStyle = '#64748b';
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const n = Math.min(req.p_mw.length, (req.q_req_max_mvar || []).length, (req.q_req_min_mvar || []).length);
            for (let i = 0; i < n; i++) {
                const x = xScale(Number(req.p_mw[i]) / denomP);
                const y = yScale(Number(req.q_req_max_mvar[i]) / denomQ);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            for (let i = n - 1; i >= 0; i--) {
                ctx.lineTo(xScale(Number(req.p_mw[i]) / denomP), yScale(Number(req.q_req_min_mvar[i]) / denomQ));
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        const colors = ['#2563eb', '#16a34a', '#dc2626'];
        Object.entries(curves).forEach(([vk, curve], i) => {
            const col = colors[i % colors.length];
            const pts = curve.p_mw || [];
            ctx.strokeStyle = col;
            ctx.lineWidth = 2.25;
            strokePoly(pts, curve.q_max_mvar, null, xScale, yScale);
            strokePoly(pts, curve.q_min_mvar, [6, 4], xScale, yScale);
            ctx.fillStyle = col;
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`U=${Number(vk).toFixed(4)} pu`, W - padR + 8, padT + 4 + i * 16);
        });

        ctx.fillStyle = '#475569';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        const legendY = padT + 4 + Object.keys(curves).length * 16 + 10;
        ctx.fillText('Solid: Qmax (cap.)', W - padR + 8, legendY);
        ctx.fillText('Dashed: Qmin (ind.)', W - padR + 8, legendY + 13);
        ctx.fillText('Grey band: grid-code |Q|', W - padR + 8, legendY + 26);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        if (xMin < 0) ctx.fillText('Import', xScale(Math.min(0, xMin) * 0.5), H - padB + 22);
        if (xMax > 0) ctx.fillText('Export', xScale(Math.max(0, xMax) * 0.5), H - padB + 22);
        ctx.save();
        ctx.fillStyle = '#64748b';
        ctx.translate(padL - 38, yScale(Math.max(0, yMax) * 0.55));
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('+ capacitive', 0, 0);
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#64748b';
        ctx.translate(padL - 38, yScale(Math.min(0, yMin) * 0.55));
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('− inductive', 0, 0);
        ctx.restore();

        const labelPt = (x, y, text, align = 'left') => {
            ctx.fillStyle = '#0f172a';
            ctx.font = '10px Arial';
            ctx.textAlign = align;
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, xScale(x) + (align === 'left' ? 4 : -4), yScale(y) - 3);
        };
        if (pnX > 0 && qY > 0) {
            labelPt(pnX, qY, `PF = ${pf.toFixed(2)}`);
            labelPt(pnX, -qY, `PF = −${pf.toFixed(2)}`, 'left');
            labelPt(-pnX, qY, `PF = ${pf.toFixed(2)}`, 'right');
            labelPt(pnX, 0, 'P/Pn = 1');
        }
        if (qY > 0) {
            ctx.fillStyle = '#0f172a';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Q/Pn = ${qPn.toFixed(3)}`, xScale(Math.min(xMax, pnX || xMax)) + 6, yScale(qY));
            ctx.fillText(`Q/Pn = −${qPn.toFixed(3)}`, xScale(Math.min(xMax, pnX || xMax)) + 6, yScale(-qY));
        }

        const hits = [];
        Object.entries(curves).forEach(([vk, curve], i) => {
            const col = colors[i % colors.length];
            const u = Number(vk);
            (curve.p_mw || []).forEach((rawP, j) => {
                const p = Number(rawP);
                const qmax = curve.q_max_mvar?.[j];
                const qmin = curve.q_min_mvar?.[j];
                const add = (q) => {
                    if (q == null || !Number.isFinite(Number(q))) return;
                    const qn = Number(q);
                    hits.push({
                        x: xScale(p / denomP),
                        y: yScale(qn / denomQ),
                        caseName: existingCaseName(
                            this.results,
                            envelopePointCaseName(p, qn, u, this.wizardParams, this.results, qReq)
                        ),
                        color: col,
                    });
                };
                add(qmax);
                add(qmin);
            });
        });
        drawHitMarkers(ctx, hits, this._paintedCase);
        canvas._bessHits = hits;
        this.bindChartHitCanvas(canvas);
    }

    _drawUqChart(canvas) {
        if (!canvas) return;
        const pq = this.results.pq_envelope;
        const curves = pq?.curves || {};
        const prefs = this._chartPrefs;
        const { ctx, W, H } = this.prepareCanvas(canvas, this.chartCssHeight('uq'));
        const padL = 62;
        const padR = 110;
        const padT = 40;
        const padB = 58;

        const { qPn: reqQPn, pn: gridPn } = requirementPnQ(pq, this.wizardParams);
        let qPn = reqQPn;
        if (!Number.isFinite(qPn) || qPn <= 0) qPn = 0.329;
        const uq = assessUqAtRatedP(pq, this.wizardParams, this.results);
        const umin = uq?.u_inner_min ?? (Number(this.wizardParams?.umin_pu) || 0.95);
        const umax = uq?.u_inner_max ?? (Number(this.wizardParams?.umax_pu) || 1.05);
        const band = plantVoltageBand(this.wizardParams, this.results);
        const uOuterMin = uq?.u_outer_min ?? band.vmin;
        const uOuterMax = uq?.u_outer_max ?? band.vmax;
        const failU = new Set(
            (uq?.points || []).filter((p) => p.in_inner_band && !p.covers).map((p) => Number(p.u_pu).toFixed(4))
        );
        const qDenom = gridPn > 0 ? gridPn : 1e-9;
        const markerQ = [];
        Object.values(curves).forEach((curve) => {
            const pts = curve.p_mw || [];
            if (!pts.length) return;
            const best = exportRatedIndex(pts);
            if (!(Number(pts[best]) > 0)) return;
            const qmax = Number(curve.q_max_mvar?.[best]);
            const qmin = Number(curve.q_min_mvar?.[best]);
            if (Number.isFinite(qmax)) markerQ.push(qmax / qDenom);
            if (Number.isFinite(qmin)) markerQ.push(qmin / qDenom);
        });
        const qSpan = Math.max(0.45, qPn * 1.25, ...markerQ.map((q) => Math.abs(q)), 0);
        let xMin = optNum(prefs.uqXMin) ?? -qSpan;
        let xMax = optNum(prefs.uqXMax) ?? qSpan;
        let yMin = optNum(prefs.uqYMin) ?? Math.min(0.85, uOuterMin - 0.02);
        let yMax = optNum(prefs.uqYMax) ?? Math.max(1.12, uOuterMax + 0.02);
        if (xMax <= xMin) xMax = xMin + 0.2;
        if (yMax <= yMin) yMax = yMin + 0.1;

        const xTicks = mergeTicks(xMin, xMax, [-qPn, 0, qPn]);
        const yTicks = mergeTicks(yMin, yMax, [0.85, 0.90, 0.95, 0.96, 1.00, 1.04, 1.05, 1.10, umin, umax, uOuterMin, uOuterMax]);
        const { xScale, yScale } = this.drawChartFrame(ctx, {
            W, H, padL, padR, padT, padB, xMin, xMax, yMin, yMax, xTicks, yTicks,
            xFmt: (v) => fmtTick(v, 3),
            yFmt: (v) => fmtTick(v, 2),
            title: prefs.uqTitle,
            xLabel: prefs.uqXLabel || 'Q / Pn',
            yLabel: prefs.uqYLabel || 'U / Uc  [pu]',
        });

        const rx = xScale(-qPn);
        const rw = xScale(qPn) - xScale(-qPn);
        hatchRect(ctx, rx, yScale(uOuterMax), rw, yScale(umax) - yScale(uOuterMax), 'rgba(100,116,139,0.35)');
        hatchRect(ctx, rx, yScale(umin), rw, yScale(uOuterMin) - yScale(umin), 'rgba(100,116,139,0.35)');
        ctx.save();
        ctx.fillStyle = 'rgba(37,99,235,0.12)';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(rx, yScale(umax), rw, yScale(umin) - yScale(umax));
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx, yScale(uOuterMax), rw, yScale(uOuterMin) - yScale(uOuterMax));
        ctx.restore();

        ctx.fillStyle = '#334155';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Operating area', xScale(qPn) + 8, yScale((umin + umax) / 2));
        ctx.fillStyle = '#64748b';
        ctx.fillText('Reduced P / allowance', xScale(qPn) + 8, yScale((umax + uOuterMax) / 2));

        const colors = ['#2563eb', '#16a34a', '#dc2626'];
        const hits = [];
        Object.entries(curves).forEach(([vk, curve], i) => {
            const pts = curve.p_mw || [];
            if (!pts.length) return;
            const best = exportRatedIndex(pts);
            if (!(Number(pts[best]) > 0)) return;
            const u = Number(vk);
            const qmax = Number(curve.q_max_mvar?.[best]);
            const qmin = Number(curve.q_min_mvar?.[best]);
            const failed = failU.has(u.toFixed(4));
            const col = colors[i % colors.length];
            const uLabel = voltageBandLabel(u, this.wizardParams, this.results);
            ctx.fillStyle = col;
            const dot = (q, caseName) => {
                const x = xScale(q / qDenom);
                const y = yScale(u);
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                if (failed) {
                    ctx.strokeStyle = '#dc2626';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                hits.push({ x, y, caseName, color: col });
            };
            if (Number.isFinite(qmax)) {
                dot(qmax, existingCaseName(this.results, `${uLabel}_Export_Capacitive`));
            }
            if (Number.isFinite(qmin)) {
                dot(qmin, existingCaseName(this.results, `${uLabel}_Export_Inductive`));
            }
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`U=${Number(vk).toFixed(4)}`, W - padR + 8, padT + 4 + i * 16);
        });
        drawHitMarkers(ctx, hits, this._paintedCase);

        ctx.fillStyle = '#0f172a';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtTick(qPn, 3), xScale(qPn), yScale(0) - 4);
        ctx.fillText(`−${fmtTick(qPn, 3)}`, xScale(-qPn), yScale(0) - 4);
        ctx.fillStyle = '#64748b';
        ctx.textBaseline = 'top';
        ctx.fillText('Q export', xScale(Math.max(qPn * 0.55, xMax * 0.35)), H - padB + 22);
        ctx.fillText('Q import', xScale(Math.min(-qPn * 0.55, xMin * 0.35)), H - padB + 22);
        ctx.fillText(`|Q|/Pn = ${qPn.toFixed(3)}  ·  required ${umin.toFixed(2)}–${umax.toFixed(2)} pu at rated export`,
            padL + (W - padL - padR) / 2, padT - 2);
        canvas._bessHits = hits;
        this.bindChartHitCanvas(canvas);
    }

    exportPdf() {
        if (typeof window.exportEngineeringReport !== 'function') {
            alert('PDF export module not loaded.');
            return;
        }
        this.parkForCanvas();
        window.exportEngineeringReport(
            { bess_preliminary_results: this.results },
            this.graph,
            {
                reportTitle: 'BESS Preliminary Design Summary',
                prefill: {
                    project: 'BESS Preliminary Design',
                    notes: this.targetSummaryText(),
                },
            }
        );
    }

    targetSummaryText() {
        const targets = (this.results.named_cases || []).filter((c) => c.target_met != null);
        if (!targets.length) return '';
        return targets
            .map((c) => `${c.name}: ${c.target_met ? 'target met' : 'target NOT met'} ` +
                `(P ${fmt(c.p_poc_mw)} / ${fmt(c.target_p_mw)} MW, ` +
                `Q ${fmt(c.q_poc_mvar)} / ${fmt(c.target_q_mvar)} Mvar)`)
            .join('; ');
    }
}
