// DataCenterSiteScreeningResultsDialog.js — comparison table + CSV export
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
    constructor(results) {
        this.results = results || {};
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
        close.onclick = () => overlay.remove();
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
            'Upgrade likely means headroom is below the requested size, or an outage adds violations.';
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
        body.appendChild(this._table());
        shell.appendChild(body);

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
