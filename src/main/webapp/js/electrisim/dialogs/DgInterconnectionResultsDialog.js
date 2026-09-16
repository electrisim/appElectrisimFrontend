// DgInterconnectionResultsDialog.js - Results for OpenDSS DG interconnection screening
export class DgInterconnectionResultsDialog {
    constructor(editorUi, results) {
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.results = results || {};
        this.title = 'DG Interconnection Screening Results';
    }

    _escape(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _statusBadge(status) {
        const ok = String(status).toLowerCase() === 'pass';
        const color = ok ? '#2e7d32' : '#c62828';
        const bg = ok ? '#e8f5e9' : '#ffebee';
        return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${bg};color:${color};font-weight:600;text-transform:uppercase;font-size:12px;">${this._escape(status)}</span>`;
    }

    _checksTable(checks) {
        if (!Array.isArray(checks) || !checks.length) {
            return '<p>No checks returned.</p>';
        }
        const rows = checks.map((c) => `
            <tr>
                <td>${this._escape(c.name || c.id)}</td>
                <td>${this._statusBadge(c.status)}</td>
                <td>${this._escape(c.value)} ${this._escape(c.unit || '')}</td>
                <td>${this._escape(c.limit)} ${this._escape(c.unit || '')}</td>
                <td>${this._escape(c.location || '')}</td>
            </tr>`).join('');
        return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f5f5f5;text-align:left;">
                <th style="padding:6px;border-bottom:1px solid #ddd;">Check</th>
                <th style="padding:6px;border-bottom:1px solid #ddd;">Status</th>
                <th style="padding:6px;border-bottom:1px solid #ddd;">Value</th>
                <th style="padding:6px;border-bottom:1px solid #ddd;">Limit</th>
                <th style="padding:6px;border-bottom:1px solid #ddd;">Location</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    show() {
        const r = this.results;
        if (r.error) {
            alert('DG Interconnection Screening failed: ' + (r.message || 'unknown error'));
            return;
        }

        const summary = r.summary || {};
        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            padding: '12px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxSizing: 'border-box'
        });

        container.innerHTML = `
            <h2 style="margin:0 0 8px 0;">${this._escape(this.title)}</h2>
            <div style="margin-bottom:12px;padding:10px;background:#e3f2fd;border:1px solid #bbdefb;border-radius:4px;">
                Overall: ${this._statusBadge(summary.overall || 'n/a')}<br>
                Proposed: ${this._escape(summary.proposed_kw)} kW
                (${this._escape(summary.der_type)} / ${this._escape(summary.der_id)})<br>
                Limiting constraint: ${this._escape(summary.limiting_constraint || 'none')}
            </div>
            <h3 style="margin:16px 0 8px;">Baseline checks (InvControl off)</h3>
            ${this._checksTable(r.checks)}
            ${r.invcontrol_compare ? `
                <h3 style="margin:16px 0 8px;">With Volt-VAR InvControl</h3>
                <div style="margin-bottom:8px;">Overall: ${this._statusBadge(r.invcontrol_compare.overall)}
                ${r.invcontrol_compare.limiting_constraint ? `<br>Limiting: ${this._escape(r.invcontrol_compare.limiting_constraint)}` : ''}
                </div>
                ${this._checksTable(r.invcontrol_compare.checks)}
            ` : ''}
            ${r.hosting_capacity ? `
                <h3 style="margin:16px 0 8px;">Hosting capacity</h3>
                <div style="padding:10px;background:#fafafa;border:1px solid #eee;border-radius:4px;">
                    Estimated hosting capacity: <strong>${this._escape(r.hosting_capacity.hosting_capacity_kw)} kW</strong>
                    (${this._escape(r.hosting_capacity.iterations)} iterations,
                    search max ${this._escape(r.hosting_capacity.search_max_kw)} kW)
                </div>
            ` : ''}
            <h3 style="margin:16px 0 8px;">Suggested mitigations</h3>
            <ul>${(r.mitigations || []).map((m) => `<li>${this._escape(m)}</li>`).join('') || '<li>None</li>'}</ul>
            <p style="color:#666;font-size:12px;margin-top:16px;">
                Related studies: BESS Sizing for Busbar Requirements; Grid Code Compliance (P-Q).
            </p>
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '12px',
            padding: '8px 16px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        container.appendChild(closeBtn);

        if (this.ui && typeof this.ui.showDialog === 'function') {
            this.ui.showDialog(container, 720, Math.min(window.innerHeight - 80, 640), true, false);
            closeBtn.onclick = () => this.ui.hideDialog();
        } else {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.4)',
                zIndex: '10000', display: 'flex', alignItems: 'center', justifyContent: 'center'
            });
            const box = document.createElement('div');
            Object.assign(box.style, {
                background: '#fff', borderRadius: '8px', width: '720px', maxWidth: '95vw',
                maxHeight: '85vh', overflow: 'auto', padding: '8px'
            });
            box.appendChild(container);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            closeBtn.onclick = () => overlay.remove();
        }
    }
}

window.DgInterconnectionResultsDialog = DgInterconnectionResultsDialog;
export default DgInterconnectionResultsDialog;
