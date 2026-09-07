// AnsiShortCircuitResultsDialog.js — ANSI/IEEE C37 short-circuit results with device duty table
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

function fmt(num, decimals = 3) {
    if (num === null || num === undefined || num === '' || Number.isNaN(Number(num))) return '—';
    const n = Number(num);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(decimals);
}

function passStyle(pass) {
    if (pass === true) return { bg: '#d1e7dd', fg: '#0f5132' };
    if (pass === false) return { bg: '#f8d7da', fg: '#842029' };
    return { bg: '#e9ecef', fg: '#495057' };
}

function displayName(row) {
    return row?.dialogName || row?.name || '—';
}

export class AnsiShortCircuitResultsDialog {
    constructor(results) {
        this.results = results || {};
        this.title = 'ANSI/IEEE C37 Short Circuit Results (beta)';
        this._sortKey = 'i_interrupting_ka';
        this._sortDir = 'desc';
    }

    show() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 10000;
            display: flex; align-items: center; justify-content: center; padding: 16px;
        `;
        overlay.className = 'ansi-sc-results-overlay';

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

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'border:none;background:transparent;font-size:28px;cursor:pointer;line-height:1;color:#6c757d;';
        closeBtn.onclick = () => overlay.remove();
        header.appendChild(closeBtn);
        shell.appendChild(header);

        const meta = document.createElement('div');
        meta.style.cssText = 'padding: 12px 24px; background: #f8f9fa; font-size: 13px; color: #495057; flex-shrink: 0;';
        const r = this.results;
        meta.innerHTML = `
            <strong>${r.standard || 'ANSI/IEEE C37'}</strong> · beta ·
            Fault: ${r.fault_type || '3ph'} ·
            ${r.frequency_hz || 60} Hz ·
            Prefault: ${r.prefault_v_pu || 1.0} pu ·
            Contact parting: ${r.contact_parting_cycles || 3} cycles
            ${r.disclaimer ? `<br><em style="font-size:12px;color:#856404;">${r.disclaimer}</em>` : ''}
        `;
        shell.appendChild(meta);

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding: 10px 24px; display: flex; gap: 8px; flex-shrink: 0;';
        const exportTxt = document.createElement('button');
        exportTxt.type = 'button';
        exportTxt.textContent = 'Export TXT';
        exportTxt.style.cssText = 'padding:6px 14px;border:1px solid #ced4da;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;';
        exportTxt.onclick = () => this._exportTxt();
        toolbar.appendChild(exportTxt);
        shell.appendChild(toolbar);

        const body = document.createElement('div');
        body.style.cssText = 'overflow: auto; padding: 0 24px 24px; flex: 1;';

        body.appendChild(this._sectionTitle('Bus fault currents'));
        body.appendChild(this._busTable());

        const lines = r.lines_sc || [];
        if (lines.length > 0) {
            body.appendChild(this._sectionTitle('Line fault currents (worst case over all fault locations)'));
            body.appendChild(this._branchTable(lines, 'Line', ['I from [kA]', 'I to [kA]'], ['i_from_ka', 'i_to_ka']));
        }

        const trafos = r.trafos_sc || [];
        if (trafos.length > 0) {
            body.appendChild(this._sectionTitle('Transformer fault currents'));
            body.appendChild(this._branchTable(trafos, 'Transformer', ['I HV [kA]', 'I LV [kA]'], ['i_hv_ka', 'i_lv_ka']));
        }

        const duties = r.device_duties || [];
        if (duties.length > 0) {
            body.appendChild(this._sectionTitle('Device duty check'));
            body.appendChild(this._dutyTable(duties));
        }

        shell.appendChild(body);
        overlay.appendChild(shell);
        document.body.appendChild(overlay);
        attachBackdropCloseHandler(overlay, shell, () => overlay.remove());
    }

    _sectionTitle(text) {
        const h = document.createElement('h3');
        h.textContent = text;
        h.style.cssText = 'margin: 20px 0 10px; font-size: 15px; font-weight: 600;';
        return h;
    }

    _busTable() {
        const buses = [...(this.results.busbars || [])];
        buses.sort((a, b) => (Number(b[this._sortKey]) || 0) - (Number(a[this._sortKey]) || 0));

        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
        const headers = ['Bus', 'kV', 'I1/2 sym [kA]', 'I1/2 peak [kA]', 'I int [kA]', 'I30 [kA]', 'X/R'];
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            th.style.cssText = 'border:1px solid #dee2e6;padding:8px;background:#f1f3f5;text-align:left;';
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        buses.forEach(bus => {
            const tr = document.createElement('tr');
            const cells = [
                displayName(bus),
                fmt(bus.vn_kv, 2),
                fmt(bus.i_first_sym_ka),
                fmt(bus.i_first_peak_ka),
                fmt(bus.i_interrupting_ka),
                fmt(bus.i_steady_ka),
                fmt(bus.xr_first, 1)
            ];
            cells.forEach((c, i) => {
                const td = document.createElement('td');
                td.textContent = c;
                td.style.cssText = `border:1px solid #dee2e6;padding:6px;text-align:${i > 0 ? 'right' : 'left'};`;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _branchTable(rows, label, endHeaders, endKeys) {
        const sorted = [...rows].sort(
            (a, b) => (Number(b.i_first_sym_ka) || 0) - (Number(a.i_first_sym_ka) || 0));

        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
        const headers = [label, ...endHeaders,
            'I1/2 sym [kA]', 'I1/2 peak [kA]', 'I int [kA]', 'I30 [kA]'];
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            th.style.cssText = 'border:1px solid #dee2e6;padding:8px;background:#f1f3f5;text-align:left;';
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        sorted.forEach(row => {
            const tr = document.createElement('tr');
            const cells = [
                displayName(row),
                fmt(row[endKeys[0]]),
                fmt(row[endKeys[1]]),
                fmt(row.i_first_sym_ka),
                fmt(row.i_first_peak_ka),
                fmt(row.i_interrupting_ka),
                fmt(row.i_steady_ka)
            ];
            cells.forEach((c, i) => {
                const td = document.createElement('td');
                td.textContent = c;
                td.style.cssText = `border:1px solid #dee2e6;padding:6px;text-align:${i > 0 ? 'right' : 'left'};`;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _dutyTable(duties) {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
        const headers = ['Device', 'Standard', 'Duty int [kA]', 'Rating [kA]', 'Int OK', 'Duty mom [kA]', 'Mom rating [kA]', 'Mom OK'];
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            th.style.cssText = 'border:1px solid #dee2e6;padding:8px;background:#f1f3f5;text-align:left;';
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        duties.forEach(d => {
            const tr = document.createElement('tr');
            const intStyle = passStyle(d.interrupting_pass);
            const momStyle = passStyle(d.momentary_pass);
            const row = [
                { t: displayName(d), align: 'left' },
                { t: d.standard || '—', align: 'left' },
                { t: fmt(d.duty_interrupting_ka), align: 'right' },
                { t: fmt(d.interrupting_rating_ka), align: 'right' },
                { t: d.interrupting_pass === true ? 'PASS' : d.interrupting_pass === false ? 'FAIL' : '—', align: 'center', style: intStyle },
                { t: fmt(d.duty_momentary_ka), align: 'right' },
                { t: fmt(d.momentary_rating_ka), align: 'right' },
                { t: d.momentary_pass === true ? 'PASS' : d.momentary_pass === false ? 'FAIL' : '—', align: 'center', style: momStyle }
            ];
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell.t;
                td.style.cssText = `border:1px solid #dee2e6;padding:6px;text-align:${cell.align};`;
                if (cell.style) {
                    td.style.backgroundColor = cell.style.bg;
                    td.style.color = cell.style.fg;
                    td.style.fontWeight = '600';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _exportTxt() {
        const r = this.results;
        let text = '========================================\n';
        text += '   ANSI/IEEE C37 Short Circuit Results (beta)\n';
        text += '========================================\n\n';
        text += `Standard: ${r.standard || 'ANSI/IEEE C37'} (beta)\n`;
        text += `Fault: ${r.fault_type || '3ph'}\n`;
        text += `Frequency: ${r.frequency_hz || 60} Hz\n`;
        text += `Prefault voltage: ${r.prefault_v_pu || 1.0} pu\n`;
        text += `Contact parting: ${r.contact_parting_cycles || 3} cycles\n\n`;

        text += '--- BUSES ---\n';
        (r.busbars || []).forEach(bus => {
            text += `${displayName(bus)}\t${fmt(bus.vn_kv, 2)} kV\t`;
            text += `I1/2=${fmt(bus.i_first_sym_ka)}\tIpeak=${fmt(bus.i_first_peak_ka)}\t`;
            text += `Iint=${fmt(bus.i_interrupting_ka)}\tI30=${fmt(bus.i_steady_ka)}\tX/R=${fmt(bus.xr_first, 1)}\n`;
        });

        const branchSection = (rows, heading, endLabels, endKeys) => {
            if (!rows || !rows.length) return;
            text += `\n--- ${heading} ---\n`;
            rows.forEach(row => {
                text += `${displayName(row)}\t`;
                text += `${endLabels[0]}=${fmt(row[endKeys[0]])}\t${endLabels[1]}=${fmt(row[endKeys[1]])}\t`;
                text += `I1/2=${fmt(row.i_first_sym_ka)}\tIpeak=${fmt(row.i_first_peak_ka)}\t`;
                text += `Iint=${fmt(row.i_interrupting_ka)}\tI30=${fmt(row.i_steady_ka)}\n`;
            });
        };
        branchSection(r.lines_sc, 'LINES', ['Ifrom', 'Ito'], ['i_from_ka', 'i_to_ka']);
        branchSection(r.trafos_sc, 'TRANSFORMERS', ['Ihv', 'Ilv'], ['i_hv_ka', 'i_lv_ka']);

        if (r.device_duties && r.device_duties.length) {
            text += '\n--- DEVICE DUTIES ---\n';
            r.device_duties.forEach(d => {
                text += `${displayName(d)}\t${d.standard}\t`;
                text += `duty_int=${fmt(d.duty_interrupting_ka)}\trating=${fmt(d.interrupting_rating_ka)}\t`;
                text += `${d.interrupting_pass === true ? 'PASS' : d.interrupting_pass === false ? 'FAIL' : 'N/A'}\n`;
            });
        }

        text += '\n========================================\n';
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ANSI_ShortCircuit_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

if (typeof window !== 'undefined') {
    window.AnsiShortCircuitResultsDialog = AnsiShortCircuitResultsDialog;
}
