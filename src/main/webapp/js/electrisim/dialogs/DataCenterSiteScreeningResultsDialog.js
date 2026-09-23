// DataCenterSiteScreeningResultsDialog.js — comparison table + CSV export
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
            'background:#fff;border-radius:10px;max-width:1100px;width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;font-family:system-ui,sans-serif;';

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e9ecef;display:flex;justify-content:space-between;align-items:center;';
        header.innerHTML = `<h2 style="margin:0;font-size:18px;">${this.title}</h2>`;
        const close = document.createElement('button');
        close.textContent = '×';
        close.type = 'button';
        close.style.cssText = 'border:none;background:transparent;font-size:26px;cursor:pointer;';
        close.onclick = () => overlay.remove();
        header.appendChild(close);
        shell.appendChild(header);

        const summary = this.results.summary || {};
        const meta = document.createElement('div');
        meta.style.cssText = 'padding:12px 20px;background:#f8f9fa;font-size:13px;';
        meta.textContent =
            `Sites: ${summary.sites_analyzed ?? '—'} · MW sizes: ${(summary.mw_sizes || []).join(', ')} · ` +
            `N-1 cases: ${summary.n1_cases ?? '—'} · N-1-1 cases: ${summary.n11_cases ?? '—'} · ` +
            `Upgrade likely rows: ${summary.upgrade_likely_count ?? '—'}`;
        shell.appendChild(meta);

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding:8px 20px;';
        const csvBtn = document.createElement('button');
        csvBtn.type = 'button';
        csvBtn.textContent = 'Download CSV';
        csvBtn.style.cssText = 'padding:6px 14px;border:1px solid #ced4da;border-radius:4px;background:#fff;cursor:pointer;';
        csvBtn.onclick = () => this._downloadCsv();
        toolbar.appendChild(csvBtn);
        shell.appendChild(toolbar);

        const body = document.createElement('div');
        body.style.cssText = 'overflow:auto;padding:0 20px 20px;flex:1;';
        body.appendChild(this._table());
        shell.appendChild(body);

        overlay.appendChild(shell);
        document.body.appendChild(overlay);
    }

    _rows() {
        return this.results.screening_results || [];
    }

    _table() {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
        const cols = [
            'site_name', 'requested_mw', 'headroom_mw', 'base_violations',
            'worst_n1_violations', 'worst_n11_violations', 'n1_worst_case', 'n11_worst_case', 'upgrade_likely', 'notes'
        ];
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        cols.forEach((c) => {
            const th = document.createElement('th');
            th.textContent = c;
            th.style.cssText = 'text-align:left;padding:8px;border-bottom:2px solid #dee2e6;background:#f8f9fa;';
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        this._rows().forEach((row) => {
            const tr = document.createElement('tr');
            if (row.upgrade_likely) tr.style.background = '#fff3cd';
            cols.forEach((c) => {
                const td = document.createElement('td');
                let v = row[c];
                if (c === 'upgrade_likely') v = v ? 'YES' : 'no';
                td.textContent = v ?? '';
                td.style.cssText = 'padding:8px;border-bottom:1px solid #eee;';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _downloadCsv() {
        const cols = [
            'site_id', 'site_name', 'requested_mw', 'headroom_mw', 'base_violations',
            'worst_n1_violations', 'worst_n11_violations', 'n1_worst_case', 'n11_worst_case',
            'n1_failed_cases', 'n11_failed_cases', 'upgrade_likely', 'notes'
        ];
        const lines = [cols.join(',')];
        this._rows().forEach((row) => {
            lines.push(cols.map((c) => {
                let v = row[c];
                if (c === 'upgrade_likely') v = v ? 'YES' : 'NO';
                if (v == null) v = '';
                const s = String(v).replace(/"/g, '""');
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
