import { RPCResultsDialog } from './RPCResultsDialog.js';
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

console.log('GridCodeVqResultsDialog.js LOADED');

export class GridCodeVqResultsDialog extends RPCResultsDialog {
    show(results) {
        const data = results && (results.grid_code_vq_results || results.rpc_results);
        if (!data) {
            alert('No V-Q results to display.');
            return;
        }
        if (!data.uq_curve && data.curves) {
            data.uq_curve = {
                u_pu: data.voltage_levels || [],
                q_max_mvar: [],
                q_min_mvar: [],
                p_mw: data.p_dispatch_mw || data.pn_mw
            };
        }
        this.pointLoadflows = data.point_loadflows || {};
        this._createModal(data);
    }

    _createModal(data) {
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10001',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', width: '920px', maxWidth: '95vw',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
        });

        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            padding: '16px 24px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        });
        const titleText = document.createElement('span');
        titleText.textContent = 'Grid Code Compliance — V-Q';
        Object.assign(titleText.style, { fontWeight: '700', fontSize: '16px', color: '#212529' });
        titleBar.appendChild(titleText);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u00d7';
        Object.assign(closeBtn.style, {
            border: 'none', background: 'transparent', fontSize: '22px',
            cursor: 'pointer', color: '#6c757d', fontWeight: '700'
        });
        closeBtn.onclick = () => this.destroy();
        titleBar.appendChild(closeBtn);
        dialog.appendChild(titleBar);

        dialog.appendChild(this._createVqSummaryBar(data));

        const content = document.createElement('div');
        Object.assign(content.style, {
            flex: '1 1 auto', overflowY: 'auto', padding: '20px 24px'
        });

        const panel = document.createElement('div');
        this._buildUqChartPanel(panel, data);
        content.appendChild(panel);

        if (data.pcc_q_convention) {
            const note = document.createElement('div');
            Object.assign(note.style, {
                marginTop: '16px', fontSize: '12px', color: '#6c757d', lineHeight: '1.45'
            });
            note.textContent = data.pcc_q_convention;
            content.appendChild(note);
        }

        dialog.appendChild(content);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '12px 24px', borderTop: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'flex-end', gap: '8px'
        });
        const csvBtn = document.createElement('button');
        csvBtn.type = 'button';
        csvBtn.textContent = 'Download CSV';
        Object.assign(csvBtn.style, {
            padding: '8px 16px', borderRadius: '6px', border: '1px solid #007bff',
            backgroundColor: '#fff', color: '#007bff', cursor: 'pointer', fontWeight: '600'
        });
        csvBtn.onclick = () => this._downloadVqCsv(data);
        footer.appendChild(csvBtn);
        const closeFooter = document.createElement('button');
        closeFooter.type = 'button';
        closeFooter.textContent = 'Close';
        Object.assign(closeFooter.style, {
            padding: '8px 16px', borderRadius: '6px', border: 'none',
            backgroundColor: '#6c757d', color: '#fff', cursor: 'pointer', fontWeight: '600'
        });
        closeFooter.onclick = () => this.destroy();
        footer.appendChild(closeFooter);
        dialog.appendChild(footer);

        this.overlay.appendChild(dialog);
        attachBackdropCloseHandler(this.overlay, dialog, () => this.destroy());
        document.body.appendChild(this.overlay);
    }

    _createVqSummaryBar(data) {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            padding: '12px 24px', backgroundColor: '#f0f7ff', borderBottom: '1px solid #e9ecef',
            display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px'
        });

        const items = [];
        if (data.pcc_bus_name) items.push(['PCC', data.pcc_bus_name]);
        if (data.pn_mw != null) items.push(['Pn', `${Number(data.pn_mw).toFixed(2)} MW`]);
        if (data.p_pcc_mw != null) items.push(['P at PCC', `${Number(data.p_pcc_mw).toFixed(2)} MW`]);
        if (data.p_max_pct != null) items.push(['P setpoint', `${Number(data.p_max_pct).toFixed(0)}% of Pn`]);
        if (data.uq_grid_code_template_name) items.push(['U-Q template', data.uq_grid_code_template_name]);
        if (data.q_dispatch_mode === 'park' && data.park_controller_name) {
            items.push(['Park', data.park_controller_name]);
        }
        if (data.uq_compliance === true || data.uq_compliance === false) {
            items.push(['Compliance', data.uq_compliance ? 'COMPLIANT' : 'NON-COMPLIANT']);
        }

        items.forEach(([k, v]) => {
            const span = document.createElement('span');
            span.innerHTML = `<strong>${k}:</strong> ${v}`;
            bar.appendChild(span);
        });
        return bar;
    }

    _downloadVqCsv(data) {
        const uq = data.uq_curve || {};
        const req = data.uq_requirements || {};
        let csv = 'U_pu,Q_max_Mvar,Q_min_Mvar\n';
        (uq.u_pu || []).forEach((u, i) => {
            csv += `${u},${uq.q_max_mvar[i] ?? ''},${uq.q_min_mvar[i] ?? ''}\n`;
        });
        if (req.u_pu && req.u_pu.length) {
            csv += '\n# U-Q requirements\nU_pu,Q_req_max_Mvar,Q_req_min_Mvar\n';
            req.u_pu.forEach((u, i) => {
                csv += `${u},${req.q_req_max_mvar[i] ?? ''},${req.q_req_min_mvar[i] ?? ''}\n`;
            });
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'grid_code_vq_results.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }
}

window.GridCodeVqResultsDialog = GridCodeVqResultsDialog;
