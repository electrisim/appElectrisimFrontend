// ArcFlashResultsDialog.js — IEEE 1584 / Ralph Lee results with export
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

const PPE_COLORS = {
    '0': { bg: '#d1e7dd', fg: '#0f5132', border: '#a3cfbb' },
    '1': { bg: '#cff4fc', fg: '#055160', border: '#9eeaf9' },
    '2': { bg: '#fff3cd', fg: '#664d03', border: '#ffecb5' },
    '3': { bg: '#ffe5d0', fg: '#984c0c', border: '#ffc107' },
    '4': { bg: '#f8d7da', fg: '#842029', border: '#f5c2c7' },
    Dangerous: { bg: '#842029', fg: '#fff', border: '#842029' },
    'N/A': { bg: '#e9ecef', fg: '#495057', border: '#ced4da' }
};

function ppeStyle(cat) {
    const key = cat == null ? 'N/A' : String(cat);
    return PPE_COLORS[key] || PPE_COLORS['N/A'];
}

function fmt(num, decimals = 2) {
    if (num === null || num === undefined || num === '' || Number.isNaN(Number(num))) return '—';
    const n = Number(num);
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
    return n.toFixed(decimals);
}

export class ArcFlashResultsDialog {
    constructor(results) {
        this.results = results || {};
        this.title = 'Arc Flash Analysis Results';
        this._sortKey = 'incident_energy_cal_cm2';
        this._sortDir = 'desc';
        this._filter = 'all'; // all | ieee | ralph | dangerous
    }

    show() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 10000;
            display: flex; align-items: center; justify-content: center; padding: 16px;
        `;
        overlay.className = 'arc-flash-results-overlay';

        const shell = document.createElement('div');
        shell.style.cssText = `
            background: #fff; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.28);
            max-width: 1180px; width: 100%; max-height: 92vh;
            display: flex; flex-direction: column; overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #212529;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 18px 24px; border-bottom: 1px solid #e9ecef;
            display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
        `;
        const titleEl = document.createElement('h2');
        titleEl.textContent = this.title;
        titleEl.style.cssText = 'margin: 0; font-size: 18px; font-weight: 700;';
        header.appendChild(titleEl);

        const headerClose = document.createElement('button');
        headerClose.textContent = '\u00d7';
        headerClose.title = 'Close';
        headerClose.style.cssText = `
            border: none; background: transparent; font-size: 24px; line-height: 1;
            cursor: pointer; color: #6c757d; padding: 0 4px;
        `;
        headerClose.onclick = () => overlay.remove();
        header.appendChild(headerClose);
        shell.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex: 1; overflow-y: auto; padding: 20px 24px;';
        shell.appendChild(body);

        if (this.results.error) {
            this._renderError(body);
        } else {
            this._renderSummary(body);
            this._renderParameters(body);
            this._filterHost = document.createElement('div');
            body.appendChild(this._filterHost);
            this._refreshFilters();
            this._tableHost = document.createElement('div');
            body.appendChild(this._tableHost);
            this._renderTable(this._tableHost);
            this._renderWarnings(body);
            this._renderLegend(body);
        }

        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 14px 24px; border-top: 1px solid #e9ecef;
            display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; background: #fafbfc;
            flex-wrap: wrap;
        `;
        if (!this.results.error) {
            const csvBtn = this._button('Download CSV', '#28a745');
            csvBtn.onclick = () => this._downloadCSV();
            footer.appendChild(csvBtn);
            const txtBtn = this._button('Download report (.txt)', '#198754');
            txtBtn.onclick = () => this._downloadTxt();
            footer.appendChild(txtBtn);
        }
        const closeBtn = this._button('Close', '#007bff');
        closeBtn.onclick = () => overlay.remove();
        footer.appendChild(closeBtn);
        shell.appendChild(footer);

        overlay.appendChild(shell);
        attachBackdropCloseHandler(overlay, shell, () => overlay.remove());
        document.body.appendChild(overlay);
    }

    _button(label, bg) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = `
            padding: 8px 16px; background: ${bg}; color: #fff; border: none;
            border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
        `;
        return btn;
    }

    _buses() {
        return Array.isArray(this.results.arc_flash) ? this.results.arc_flash : [];
    }

    _renderError(container) {
        const box = document.createElement('div');
        box.style.cssText = 'padding:16px; border:1px solid #f5c2c7; background:#f8d7da; color:#842029; border-radius:8px; line-height:1.5;';
        box.innerHTML = `<strong>Arc flash calculation failed</strong><br>${this._escape(this.results.message || 'Unknown error')}`;
        if (this.results.exception) {
            const pre = document.createElement('pre');
            pre.style.cssText = 'margin:12px 0 0; font-size:12px; white-space:pre-wrap;';
            pre.textContent = this.results.exception;
            box.appendChild(pre);
        }
        container.appendChild(box);
    }

    _renderSummary(container) {
        const buses = this._buses();
        const ieee = buses.filter(b => b.method === 'IEEE1584-2018');
        const ralph = buses.filter(b => b.method === 'RalphLee');
        const dangerous = buses.filter(b => String(b.ppe_category) === 'Dangerous' || Number(b.incident_energy_cal_cm2) >= 40);
        const ies = buses
            .map(b => Number(b.incident_energy_cal_cm2))
            .filter(n => Number.isFinite(n));
        const maxIe = ies.length ? Math.max(...ies) : null;
        const maxBus = buses.find(b => Number(b.incident_energy_cal_cm2) === maxIe);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:20px;';

        const cards = [
            { label: 'Buses analyzed', value: buses.length, color: '#495057' },
            { label: 'IEEE 1584-2018', value: ieee.length, color: '#0d6efd' },
            { label: 'Ralph Lee (>15 kV)', value: ralph.length, color: ralph.length ? '#fd7e14' : '#198754' },
            { label: 'PPE Dangerous / ≥40', value: dangerous.length, color: dangerous.length ? '#dc3545' : '#198754' },
            {
                label: 'Max IE',
                value: maxIe == null ? '—' : `${fmt(maxIe, 2)} cal/cm²`,
                color: maxIe != null && maxIe >= 8 ? '#dc3545' : '#198754',
                sub: maxBus ? (maxBus.name || '') : ''
            }
        ];

        cards.forEach(({ label, value, color, sub }) => {
            const card = document.createElement('div');
            card.style.cssText = `
                background:#f8f9fa; border:1px solid #e9ecef; border-radius:8px; padding:12px 14px;
                border-left:4px solid ${color};
            `;
            const lab = document.createElement('div');
            lab.style.cssText = 'font-size:11px; color:#6c757d; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.3px;';
            lab.textContent = label;
            const val = document.createElement('div');
            val.style.cssText = `font-size:20px; font-weight:700; color:${color};`;
            val.textContent = String(value);
            card.appendChild(lab);
            card.appendChild(val);
            if (sub) {
                const s = document.createElement('div');
                s.style.cssText = 'font-size:11px; color:#6c757d; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                s.textContent = sub;
                card.appendChild(s);
            }
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    _renderParameters(container) {
        const p = this.results.parameters || {};
        if (!Object.keys(p).length) return;

        const box = document.createElement('div');
        box.style.cssText = `
            background:#eef4ff; border:1px solid #cfe2ff; border-radius:8px; padding:12px 16px;
            margin-bottom:18px; font-size:13px; color:#1e3a5f; line-height:1.55;
        `;
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700; margin-bottom:6px;';
        title.textContent = 'Study parameters';
        box.appendChild(title);
        box.appendChild(document.createTextNode(
            `Electrode ${p.electrode_config || 'VCB'} · Working distance ${p.working_distance_mm ?? '—'} mm · ` +
            `Gap ${p.conductor_gap_mm ?? '—'} mm · Enclosure ${p.enclosure_height_mm ?? '—'}×${p.enclosure_width_mm ?? '—'}×${p.enclosure_depth_mm ?? '—'} mm · ` +
            `Clearing ${p.clearing_time_s ?? '—'} s / Iarc-min ${p.clearing_time_min_s ?? p.clearing_time_s ?? '—'} s · Fault 3ph max`
        ));
        container.appendChild(box);
    }

    _refreshFilters() {
        if (!this._filterHost) return;
        this._filterHost.innerHTML = '';
        this._filterHost.appendChild(this._buildFilterRow());
    }

    _buildFilterRow() {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:12px;';
        const label = document.createElement('span');
        label.style.cssText = 'font-size:13px; font-weight:600; color:#495057; margin-right:4px;';
        label.textContent = 'Show:';
        row.appendChild(label);
        const options = [
            { id: 'all', text: 'All buses' },
            { id: 'ieee', text: 'IEEE 1584 only' },
            { id: 'ralph', text: 'Ralph Lee only' },
            { id: 'dangerous', text: 'Cat 3+ / Dangerous' }
        ];
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.textContent = opt.text;
            const active = this._filter === opt.id;
            btn.style.cssText = `
                padding:6px 12px; border-radius:16px; font-size:12px; cursor:pointer;
                border:1px solid ${active ? '#0d6efd' : '#ced4da'};
                background:${active ? '#0d6efd' : '#fff'}; color:${active ? '#fff' : '#495057'};
            `;
            btn.onclick = () => {
                this._filter = opt.id;
                this._refreshFilters();
                this._renderTable(this._tableHost);
            };
            row.appendChild(btn);
        });
        return row;
    }

    _filteredSorted() {
        let rows = this._buses().slice();
        if (this._filter === 'ieee') rows = rows.filter(b => b.method === 'IEEE1584-2018');
        if (this._filter === 'ralph') rows = rows.filter(b => b.method === 'RalphLee');
        if (this._filter === 'dangerous') {
            rows = rows.filter(b => {
                const cat = String(b.ppe_category);
                const ie = Number(b.incident_energy_cal_cm2);
                return cat === 'Dangerous' || cat === '3' || cat === '4' || ie >= 8;
            });
        }

        const key = this._sortKey;
        const dir = this._sortDir === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            let va = a[key];
            let vb = b[key];
            if (key === 'ppe_category') {
                const rank = (c) => {
                    if (c === 'Dangerous') return 99;
                    const n = Number(c);
                    return Number.isFinite(n) ? n : -1;
                };
                return (rank(va) - rank(vb)) * dir;
            }
            if (typeof va === 'string' || typeof vb === 'string') {
                return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
            }
            va = Number(va);
            vb = Number(vb);
            if (!Number.isFinite(va)) va = dir > 0 ? Infinity : -Infinity;
            if (!Number.isFinite(vb)) vb = dir > 0 ? Infinity : -Infinity;
            return (va - vb) * dir;
        });
        return rows;
    }

    _renderTable(container) {
        container.innerHTML = '';
        const rows = this._filteredSorted();
        if (!rows.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:24px; text-align:center; color:#6c757d;';
            empty.textContent = 'No buses match this filter.';
            container.appendChild(empty);
            return;
        }

        const wrap = document.createElement('div');
        wrap.style.cssText = 'overflow-x:auto; border:1px solid #e9ecef; border-radius:8px;';

        const table = document.createElement('table');
        table.style.cssText = 'width:100%; border-collapse:collapse; font-size:13px;';

        const cols = [
            { key: 'name', label: 'Bus', align: 'left' },
            { key: 'vn_kv', label: 'V [kV]', align: 'right', dec: 2 },
            { key: 'ikss_ka', label: 'Ikss [kA]', align: 'right', dec: 3 },
            { key: 'ia_ka', label: 'Ia [kA]', align: 'right', dec: 3 },
            { key: 'incident_energy_cal_cm2', label: 'IE [cal/cm²]', align: 'right', dec: 2 },
            { key: 'arc_flash_boundary_mm', label: 'AFB [mm]', align: 'right', dec: 0 },
            { key: 'ppe_category', label: 'PPE', align: 'center' },
            { key: 'method', label: 'Method', align: 'left' }
        ];

        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        hr.style.cssText = 'background:#f1f3f5;';
        cols.forEach(col => {
            const th = document.createElement('th');
            th.style.cssText = `
                padding:10px 12px; text-align:${col.align}; border-bottom:1px solid #dee2e6;
                font-size:12px; font-weight:700; color:#495057; cursor:pointer; white-space:nowrap; user-select:none;
            `;
            const arrow = this._sortKey === col.key ? (this._sortDir === 'asc' ? ' ▲' : ' ▼') : '';
            th.textContent = col.label + arrow;
            th.onclick = () => {
                if (this._sortKey === col.key) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortKey = col.key;
                    this._sortDir = col.key === 'name' || col.key === 'method' ? 'asc' : 'desc';
                }
                this._renderTable(container);
            };
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach((bus, i) => {
            const tr = document.createElement('tr');
            tr.style.cssText = `background:${i % 2 ? '#fafbfc' : '#fff'};`;
            cols.forEach(col => {
                const td = document.createElement('td');
                td.style.cssText = `padding:9px 12px; text-align:${col.align}; border-bottom:1px solid #f1f3f5; vertical-align:middle;`;
                if (col.key === 'ppe_category') {
                    const badge = document.createElement('span');
                    const st = ppeStyle(bus.ppe_category);
                    badge.style.cssText = `
                        display:inline-block; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700;
                        background:${st.bg}; color:${st.fg}; border:1px solid ${st.border};
                    `;
                    badge.textContent = bus.ppe_category == null ? 'N/A' : `Cat ${bus.ppe_category}`;
                    td.appendChild(badge);
                } else if (col.key === 'method') {
                    const m = bus.method || '—';
                    td.textContent = m === 'IEEE1584-2018' ? 'IEEE 1584' : m;
                    if (m === 'RalphLee') td.style.color = '#fd7e14';
                    if (m === 'skipped' || m === 'error') td.style.color = '#6c757d';
                } else if (col.key === 'name') {
                    const display = bus.dialogName || bus.name || bus.id || '—';
                    td.textContent = display;
                    td.style.fontWeight = '600';
                    if (bus.object_id && String(bus.object_id) !== String(display)) {
                        td.title = `Object id: ${bus.object_id}`;
                    }
                } else if (col.dec != null) {
                    td.textContent = fmt(bus[col.key], col.dec);
                    if (col.key === 'incident_energy_cal_cm2' && Number(bus[col.key]) >= 40) {
                        td.style.color = '#dc3545';
                        td.style.fontWeight = '700';
                    }
                } else {
                    td.textContent = bus[col.key] ?? '—';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        container.appendChild(wrap);

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px; color:#6c757d; margin-top:8px;';
        hint.textContent = 'Click column headers to sort. Compact labels remain on the diagram; this dialog is the full report.';
        container.appendChild(hint);
    }

    _renderWarnings(container) {
        const warnings = this.results.warnings;
        if (!Array.isArray(warnings) || !warnings.length) return;
        const box = document.createElement('div');
        box.style.cssText = `
            margin-top:18px; padding:12px 16px; border-radius:8px;
            background:#fff3cd; border:1px solid #ffecb5; color:#664d03; font-size:13px;
        `;
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700; margin-bottom:6px;';
        title.textContent = `Warnings (${warnings.length})`;
        box.appendChild(title);
        const ul = document.createElement('ul');
        ul.style.cssText = 'margin:0; padding-left:18px;';
        warnings.forEach(w => {
            const li = document.createElement('li');
            li.style.marginBottom = '4px';
            li.textContent = w;
            ul.appendChild(li);
        });
        box.appendChild(ul);
        container.appendChild(box);
    }

    _renderLegend(container) {
        const box = document.createElement('div');
        box.style.cssText = 'margin-top:16px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;';
        const lab = document.createElement('span');
        lab.style.cssText = 'font-size:12px; color:#6c757d; margin-right:4px;';
        lab.textContent = 'PPE legend:';
        box.appendChild(lab);
        ['0', '1', '2', '3', '4', 'Dangerous'].forEach(cat => {
            const st = ppeStyle(cat);
            const badge = document.createElement('span');
            badge.style.cssText = `
                display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700;
                background:${st.bg}; color:${st.fg}; border:1px solid ${st.border};
            `;
            badge.textContent = cat === 'Dangerous' ? 'Dangerous' : `Cat ${cat}`;
            box.appendChild(badge);
        });
        container.appendChild(box);
    }

    _downloadCSV() {
        const rows = this._filteredSorted();
        const headers = [
            'name', 'dialogName', 'id', 'object_id', 'vn_kv', 'ikss_ka', 'ia_ka', 'ia_full_ka', 'ia_min_ka',
            'incident_energy_cal_cm2', 'arc_flash_boundary_mm', 'ppe_category', 'method', 'note'
        ];
        const lines = [headers.join(',')];
        rows.forEach(b => {
            const rowObj = {
                ...b,
                name: b.dialogName || b.name || b.id || ''
            };
            lines.push(headers.map(h => {
                let v = rowObj[h];
                if (v == null) return '';
                v = String(v);
                if (v.includes(',') || v.includes('"') || v.includes('\n')) {
                    return `"${v.replace(/"/g, '""')}"`;
                }
                return v;
            }).join(','));
        });
        this._saveBlob(lines.join('\n'), `Electrisim_ArcFlash_${this._stamp()}.csv`, 'text/csv;charset=utf-8');
    }

    _downloadTxt() {
        const p = this.results.parameters || {};
        const rows = this._filteredSorted();
        let t = '';
        t += '========================================\n';
        t += '   Electrisim Arc Flash Analysis Report\n';
        t += '========================================\n\n';
        t += `Generated: ${new Date().toISOString()}\n`;
        t += `Standard: IEEE 1584-2018 (208 V–15 kV); Ralph Lee above 15 kV\n\n`;
        t += '--- PARAMETERS ---\n';
        t += `Electrode configuration : ${p.electrode_config || 'VCB'}\n`;
        t += `Working distance        : ${p.working_distance_mm ?? '—'} mm\n`;
        t += `Conductor gap           : ${p.conductor_gap_mm ?? '—'} mm\n`;
        t += `Enclosure H×W×D         : ${p.enclosure_height_mm ?? '—'} × ${p.enclosure_width_mm ?? '—'} × ${p.enclosure_depth_mm ?? '—'} mm\n`;
        t += `Clearing time Iarc      : ${p.clearing_time_s ?? '—'} s\n`;
        t += `Clearing time Iarc-min  : ${p.clearing_time_min_s ?? p.clearing_time_s ?? '—'} s\n`;
        t += `Fault                   : 3-phase maximum\n\n`;

        t += '--- BUS RESULTS ---\n';
        const widths = [22, 8, 10, 10, 12, 10, 12, 14];
        const headers = ['Bus', 'V[kV]', 'Ikss[kA]', 'Ia[kA]', 'IE[cal/cm2]', 'AFB[mm]', 'PPE', 'Method'];
        const pad = (s, w) => String(s).padEnd(w).slice(0, w);
        t += headers.map((h, i) => pad(h, widths[i])).join(' | ') + '\n';
        t += widths.map(w => '-'.repeat(w)).join('-+-') + '\n';
        rows.forEach(b => {
            const displayName = b.dialogName || b.name || b.id || '';
            const row = [
                displayName,
                fmt(b.vn_kv, 2),
                fmt(b.ikss_ka, 3),
                fmt(b.ia_ka, 3),
                fmt(b.incident_energy_cal_cm2, 2),
                fmt(b.arc_flash_boundary_mm, 0),
                b.ppe_category ?? 'N/A',
                b.method === 'IEEE1584-2018' ? 'IEEE1584' : (b.method || '')
            ];
            t += row.map((c, i) => pad(c, widths[i])).join(' | ') + '\n';
        });

        if (Array.isArray(this.results.warnings) && this.results.warnings.length) {
            t += '\n--- WARNINGS ---\n';
            this.results.warnings.forEach(w => { t += `- ${w}\n`; });
        }

        t += '\n========================================\n';
        t += 'PPE categories (NFPA 70E style):\n';
        t += '  <1.2 Cat 0 · 1.2–4 Cat 1 · 4–8 Cat 2 · 8–25 Cat 3 · 25–40 Cat 4 · ≥40 Dangerous\n';
        t += 'Apply engineering judgment and local PPE programs.\n';
        t += '========================================\n';

        this._saveBlob(t, `Electrisim_ArcFlash_Report_${this._stamp()}.txt`, 'text/plain;charset=utf-8');
    }

    _stamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    }

    _saveBlob(text, filename, type) {
        const blob = new Blob([text], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _escape(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

if (typeof window !== 'undefined') {
    window.ArcFlashResultsDialog = ArcFlashResultsDialog;
}

export default ArcFlashResultsDialog;
