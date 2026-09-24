// DataCenterSiteScreeningResultsDialog.js — comparison table + CSV export
import { parkOverlayForCanvas } from '../utils/dialogStyles.js';
const COLUMNS = [
    { key: 'site_name', label: 'Load', align: 'left' },
    { key: 'requested_mw', label: 'Requested', align: 'right' },
    { key: 'headroom_mw', label: 'Headroom', align: 'right' },
    { key: 'base_violations', label: 'Intact system', align: 'right' },
    { key: 'n1', label: 'Worst N-1', align: 'left' },
    { key: 'n11', label: 'Worst N-1-1', align: 'left' },
    { key: 'upgrade_likely', label: 'Outcome', align: 'left' },
    { key: 'notes', label: 'Notes', align: 'left' }
];

function prettyOutageName(raw) {
    if (raw == null || String(raw).trim() === '') return '';
    const piece = (part) => {
        let s = String(part).trim();
        s = s.replace(/^(Line|Trafo|Gen)_/i, (_, kind) => {
            const label = { line: 'Line', trafo: 'Transformer', gen: 'Generator' }[kind.toLowerCase()];
            return `${label} `;
        });
        s = s.replace(/^(Transformer|Line|Generator)\s+(Generator|Transformer|Trafo|Line|Gen)[_\s]*/i, '$1 ');
        return s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    };
    return String(raw)
        .replace(/^N11_/i, '')
        .split('+')
        .map(piece)
        .filter(Boolean)
        .join(' + ');
}

function violationText(count) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) return 'Did not converge';
    if (n === 0) return 'No violations';
    return n === 1 ? '1 violation' : `${n} violations`;
}

function contingencyCell(count, caseName) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) return 'Did not converge';
    if (n === 0) return 'No extra violations';
    const label = prettyOutageName(caseName);
    const countText = n === 1 ? '1 violation' : `${n} violations`;
    return label ? `${countText} — ${label}` : countText;
}

function mwText(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
}

function cellText(row, key) {
    if (key === 'requested_mw' || key === 'headroom_mw') return mwText(row[key]);
    if (key === 'base_violations') return violationText(row.base_violations);
    if (key === 'n1') return contingencyCell(row.worst_n1_violations, row.n1_worst_case);
    if (key === 'n11') return contingencyCell(row.worst_n11_violations, row.n11_worst_case);
    if (key === 'upgrade_likely') return row.upgrade_likely ? 'Upgrade likely' : 'Within limits';
    if (key === 'notes') return row.notes ? String(row.notes) : '—';
    return row[key] == null || row[key] === '' ? '—' : String(row[key]);
}

export class DataCenterSiteScreeningResultsDialog {
    constructor(results, graph) {
        this.results = results || {};
        this.graph = graph || null;
        this.title = 'Data Center Site Screening Results';
    }

    show() {
        const overlay = document.createElement('div');
        overlay.style.cssText =
            'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';

        const shell = document.createElement('div');
        shell.style.cssText =
            'background:#fff;border-radius:10px;max-width:1180px;width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;font-family:system-ui,sans-serif;';

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e9ecef;display:flex;justify-content:space-between;align-items:center;';
        const title = document.createElement('h2');
        title.textContent = this.title;
        title.style.cssText = 'margin:0;font-size:18px;';
        const close = document.createElement('button');
        close.textContent = '×';
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.style.cssText = 'border:none;background:transparent;font-size:26px;cursor:pointer;line-height:1;';
        close.onclick = () => {
            this._clearSiteMark();
            this._parkHandle?.dismiss?.();
            overlay.remove();
        };
        header.appendChild(title);
        header.appendChild(close);
        shell.appendChild(header);

        shell.appendChild(this._summary());

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding:10px 20px 0;display:flex;justify-content:space-between;align-items:center;gap:12px;';
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:12px;color:#6c757d;line-height:1.45;';
        hint.textContent =
            'Headroom is the largest project load that still meets the voltage and thermal limits. ' +
            'Click a violation count to see which buses, lines, and transformers are outside the limits, ' +
            'then open that load flow in the Network Dashboard.';
        const csvBtn = document.createElement('button');
        csvBtn.type = 'button';
        csvBtn.textContent = 'Download CSV';
        csvBtn.style.cssText = 'padding:6px 14px;border:1px solid #ced4da;border-radius:4px;background:#fff;cursor:pointer;white-space:nowrap;';
        csvBtn.onclick = () => this._downloadCsv();
        toolbar.appendChild(hint);
        toolbar.appendChild(csvBtn);
        shell.appendChild(toolbar);

        const body = document.createElement('div');
        body.style.cssText = 'overflow:auto;padding:12px 20px 20px;flex:1;';
        this._detail = document.createElement('div');
        this._detail.style.cssText = 'display:none;margin-bottom:12px;padding:12px 14px;border:1px solid #dee2e6;border-radius:8px;background:#f8f9fa;';
        body.appendChild(this._detail);
        body.appendChild(this._table());
        shell.appendChild(body);
        this._overlay = overlay;

        overlay.appendChild(shell);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }

    _summary() {
        const summary = this.results.summary || {};
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px;background:#f8f9fa;';
        const chips = [
            ['Sites', summary.sites_analyzed ?? '—'],
            ['Sizes', (summary.mw_sizes || []).map((mw) => `${mw} MW`).join(', ') || '—'],
            ['N-1 cases', summary.n1_cases ?? '—'],
            ['N-1-1 cases', summary.n11_cases ?? '—'],
            ['Upgrade likely', summary.upgrade_likely_count ?? '—']
        ];
        chips.forEach(([label, value]) => {
            const chip = document.createElement('div');
            chip.style.cssText = 'background:#fff;border:1px solid #e9ecef;border-radius:6px;padding:6px 10px;font-size:12px;';
            const k = document.createElement('div');
            k.textContent = label;
            k.style.cssText = 'color:#6c757d;';
            const v = document.createElement('div');
            v.textContent = String(value);
            v.style.cssText = 'font-weight:600;color:#212529;margin-top:1px;';
            chip.appendChild(k);
            chip.appendChild(v);
            wrap.appendChild(chip);
        });
        return wrap;
    }

    _rows() {
        return this.results.screening_results || [];
    }

    _table() {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed;';
        const colgroup = document.createElement('colgroup');
        ['11%', '10%', '10%', '12%', '18%', '18%', '11%', '10%'].forEach((width) => {
            const col = document.createElement('col');
            col.style.width = width;
            colgroup.appendChild(col);
        });
        table.appendChild(colgroup);
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        COLUMNS.forEach((col) => {
            const th = document.createElement('th');
            th.textContent = col.label;
            th.style.cssText =
                `text-align:${col.align};padding:8px 10px;border-bottom:2px solid #dee2e6;` +
                'background:#f8f9fa;position:sticky;top:0;white-space:nowrap;';
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        this._rows().forEach((row) => {
            const tr = document.createElement('tr');
            if (row.upgrade_likely) tr.style.background = '#fff8e6';
            COLUMNS.forEach((col) => {
                const td = document.createElement('td');
                const text = cellText(row, col.key);
                td.style.cssText =
                    `text-align:${col.align};padding:8px 10px;border-bottom:1px solid #eee;` +
                    'vertical-align:top;line-height:1.4;white-space:normal;overflow-wrap:anywhere;';
                if (col.key === 'upgrade_likely') {
                    const badge = document.createElement('span');
                    badge.textContent = text;
                    badge.style.cssText = row.upgrade_likely
                        ? 'display:inline-block;padding:2px 8px;border-radius:999px;background:#ffe8a3;color:#7a5b00;font-weight:600;white-space:nowrap;'
                        : 'display:inline-block;padding:2px 8px;border-radius:999px;background:#d8f3dc;color:#1b4332;font-weight:600;white-space:nowrap;';
                    td.appendChild(badge);
                } else if (col.key === 'base_violations' || col.key === 'n1' || col.key === 'n11') {
                    td.appendChild(this._violationButton(row, col.key, text));
                } else {
                    td.textContent = text;
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _caseBundle(row, key) {
        if (key === 'base_violations') {
            return {
                title: `${row.site_name} — intact system at 0 MW`,
                note: 'This is the network before the project load is applied. The same count is shown for every size of this load.',
                details: row.base_violation_details || [],
                snapshot: row.base_snapshot,
                site: { id: row.site_id, name: row.site_name, p_mw: 0 },
                extra: Number(row.case_violations) >= 0 ? {
                    title: `${row.site_name} — intact at ${mwText(row.requested_mw)}`,
                    details: row.case_violation_details || [],
                    snapshot: row.case_snapshot,
                    site: { id: row.site_id, name: row.site_name, p_mw: Number(row.requested_mw) }
                } : null
            };
        }
        if (key === 'n1') {
            const name = prettyOutageName(row.n1_worst_case) || 'worst N-1';
            return {
                title: `${row.site_name} at ${mwText(row.requested_mw)} — N-1 ${name}`,
                note: 'Outage with the most limit breaches at this project size.',
                details: row.n1_violation_details || [],
                snapshot: row.n1_snapshot,
                site: { id: row.site_id, name: row.site_name, p_mw: Number(row.requested_mw) },
                extra: null
            };
        }
        const name = prettyOutageName(row.n11_worst_case) || 'worst N-1-1';
        return {
            title: `${row.site_name} at ${mwText(row.requested_mw)} — N-1-1 ${name}`,
            note: 'Pair of outages with the most limit breaches at this project size.',
            details: row.n11_violation_details || [],
            snapshot: row.n11_snapshot,
            site: { id: row.site_id, name: row.site_name, p_mw: Number(row.requested_mw) },
            extra: null
        };
    }

    _violationButton(row, key, text) {
        const bundle = this._caseBundle(row, key);
        const clickable = (bundle.details && bundle.details.length) || bundle.snapshot;
        if (!clickable || text === 'No violations' || text === 'No extra violations' || text === 'Did not converge') {
            const span = document.createElement('span');
            span.textContent = text;
            return span;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = text;
        btn.title = 'Show which elements are outside the limits';
        btn.style.cssText = 'border:none;background:transparent;padding:0;color:#0066cc;cursor:pointer;font:inherit;text-align:inherit;text-decoration:underline;';
        btn.onclick = () => this._showDetail(bundle);
        return btn;
    }

    _detailList(details) {
        const list = document.createElement('ul');
        list.style.cssText = 'margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.45;';
        if (!details.length) {
            const li = document.createElement('li');
            li.textContent = 'No element list was stored for this case.';
            list.appendChild(li);
            return list;
        }
        details.forEach((item) => {
            const li = document.createElement('li');
            const kind = item.kind || 'Element';
            const name = item.name || item.id || '';
            const value = item.text || '';
            const limit = item.limit ? ` (limit ${item.limit})` : '';
            li.textContent = `${kind} ${name} — ${value}${limit}`;
            list.appendChild(li);
        });
        return list;
    }

    _dashButton(label, snapshot, site) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.disabled = !snapshot;
        btn.style.cssText = 'margin-top:8px;margin-right:8px;padding:6px 12px;border:1px solid #0066cc;border-radius:4px;background:#0066cc;color:#fff;cursor:pointer;font-size:12px;';
        if (!snapshot) btn.style.opacity = '0.5';
        btn.onclick = () => this._openDashboard(snapshot, site);
        return btn;
    }

    _showDetail(bundle) {
        const box = this._detail;
        if (!box) return;
        box.style.display = 'block';
        box.textContent = '';
        const title = document.createElement('div');
        title.textContent = bundle.title;
        title.style.cssText = 'font-weight:600;font-size:14px;';
        const note = document.createElement('div');
        note.textContent = bundle.note;
        note.style.cssText = 'font-size:12px;color:#6c757d;margin-top:4px;';
        box.appendChild(title);
        box.appendChild(note);
        box.appendChild(this._detailList(bundle.details));
        box.appendChild(this._dashButton('Open this load flow in Network Dashboard', bundle.snapshot, bundle.site));
        if (bundle.extra) {
            const sub = document.createElement('div');
            sub.textContent = bundle.extra.title;
            sub.style.cssText = 'font-weight:600;font-size:13px;margin-top:12px;';
            const subNote = document.createElement('div');
            const n = bundle.extra.details.length;
            subNote.textContent = n
                ? `${n} limit breach${n === 1 ? '' : 'es'} with the project load applied and no outage.`
                : 'No limit breaches with the project load applied and no outage.';
            subNote.style.cssText = 'font-size:12px;color:#6c757d;margin-top:4px;';
            box.appendChild(sub);
            box.appendChild(subNote);
            if (n) box.appendChild(this._detailList(bundle.extra.details));
            box.appendChild(this._dashButton('Open this load flow in Network Dashboard', bundle.extra.snapshot, bundle.extra.site));
        }
        box.scrollIntoView({ block: 'nearest' });
    }

    _openDashboard(snapshot) {
        if (!snapshot || typeof window.showNetworkHealthDashboard !== 'function') {
            alert('Network Dashboard is not available in this window.');
            return;
        }
        const graph = this.graph
            || window.App?._editorUi?.editor?.graph
            || window.App?.main?.editor?.editorUi?.editor?.graph
            || window.editorUi?.editor?.graph
            || null;
        const payload = Object.assign({ converged: true }, snapshot);
        window.showNetworkHealthDashboard(payload, graph);
        this._markSiteLoad(graph, snapshot.site_load || site);
        if (this._overlay) {
            this._parkHandle?.dismiss?.();
            this._parkHandle = parkOverlayForCanvas(this._overlay, {
                restoreLabel: 'Back to screening results',
                zIndex: 10002
            });
            this._overlay._electrisimRestoreBtn?.addEventListener('click', () => this._clearSiteMark());
        }
        const dash = document.getElementById('electrisim-health-dashboard');
        dash?.querySelector('.ehd-close')?.addEventListener('click', () => this._clearSiteMark());
    }

    _clearSiteMark() {
        const prev = window._elxxxSiteLoadMark;
        if (!prev) return;
        prev.listeners?.forEach((off) => { try { off(); } catch (e) { /* ignore */ } });
        prev.badge?.remove();
        window._elxxxSiteLoadMark = null;
    }

    _markSiteLoad(graph, site) {
        this._clearSiteMark();
        if (!graph || !site) return;
        const row = { id: site.id, name: site.name, dialogName: site.name };
        let cell = null;
        try {
            if (typeof window.buildGraphCellLookupMap === 'function' && typeof window.resolveGraphCellForResult === 'function') {
                cell = window.resolveGraphCellForResult(window.buildGraphCellLookupMap(graph), row, graph);
            }
        } catch (e) { /* ignore */ }
        if (!cell) return;
        try {
            graph.setSelectionCell(cell);
            if (typeof graph.scrollCellToVisible === 'function') graph.scrollCellToVisible(cell, true);
        } catch (e) { /* ignore */ }

        const p = Number(site.p_mw);
        const mw = Number.isFinite(p)
            ? `${p.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`
            : '';
        const badge = document.createElement('div');
        badge.textContent = p > 0
            ? `Project load ${site.name || ''} · ${mw}`.trim()
            : `Site load ${site.name || ''} · 0 MW`.trim();
        badge.style.cssText = 'position:fixed;z-index:10050;pointer-events:none;padding:4px 8px;border-radius:6px;background:#b45309;color:#fff;font:600 12px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap;';
        document.body.appendChild(badge);

        const place = () => {
            const state = graph.view?.getState?.(cell);
            const node = state?.shape?.node;
            if (!node) {
                badge.style.display = 'none';
                return;
            }
            const rect = node.getBoundingClientRect();
            badge.style.display = 'block';
            badge.style.left = `${Math.max(8, rect.left)}px`;
            badge.style.top = `${Math.max(8, rect.top - 28)}px`;
        };
        place();
        const listeners = [];
        const view = graph.getView?.();
        if (view && typeof view.addListener === 'function' && typeof mxEvent !== 'undefined') {
            [mxEvent.SCALE, mxEvent.TRANSLATE, mxEvent.SCALE_AND_TRANSLATE].forEach((ev) => {
                if (!ev) return;
                const fn = () => place();
                view.addListener(ev, fn);
                listeners.push(() => { try { view.removeListener?.(fn); } catch (e) { /* ignore */ } });
            });
        }
        window._elxxxSiteLoadMark = { badge, listeners };
    }

    _downloadCsv() {
        const lines = [COLUMNS.map((c) => c.label).join(',')];
        this._rows().forEach((row) => {
            lines.push(COLUMNS.map((c) => {
                const s = cellText(row, c.key).replace(/"/g, '""');
                return `"${s}"`;
            }).join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'data_center_site_screening.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }
}

globalThis.DataCenterSiteScreeningResultsDialog = DataCenterSiteScreeningResultsDialog;
