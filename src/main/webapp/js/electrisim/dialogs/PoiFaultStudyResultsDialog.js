import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

function fmt(num, decimals = 3) {
    if (num === null || num === undefined || num === '' || Number.isNaN(Number(num))) return '—';
    const n = Number(num);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(decimals);
}

function passStyle(pass, over) {
    if (over === true || pass === false) return { bg: '#f8d7da', fg: '#842029' };
    if (pass === true) return { bg: '#d1e7dd', fg: '#0f5132' };
    return { bg: '#fff', fg: '#212529' };
}

export class PoiFaultStudyResultsDialog {
    constructor(results) {
        this.results = results || {};
        this.title = 'POI fault study results';
    }

    show() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';

        const shell = document.createElement('div');
        shell.style.cssText = 'background:#fff;border-radius:10px;max-width:1200px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;font-family:system-ui,sans-serif;';

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid #e9ecef;display:flex;justify-content:space-between;align-items:center;';
        const h2 = document.createElement('h2');
        h2.textContent = this.title;
        h2.style.margin = '0';
        header.appendChild(h2);
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '×';
        close.style.cssText = 'border:none;background:transparent;font-size:26px;cursor:pointer;';
        close.onclick = () => overlay.remove();
        header.appendChild(close);
        shell.appendChild(header);

        const meta = document.createElement('div');
        meta.style.cssText = 'padding:10px 20px;background:#f8f9fa;font-size:13px;';
        const poi = this.results.poi_bus || {};
        meta.innerHTML = `<strong>POI:</strong> ${poi.userFriendlyName || poi.name || '—'} · ${fmt(this.results.frequency_hz, 0)} Hz`;
        shell.appendChild(meta);

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding:8px 20px;display:flex;gap:8px;';
        const csvBtn = document.createElement('button');
        csvBtn.type = 'button';
        csvBtn.textContent = 'Export CSV';
        csvBtn.onclick = () => this._exportCsv();
        csvBtn.style.cssText = 'padding:6px 12px;border:1px solid #ced4da;border-radius:4px;background:#fff;cursor:pointer;';
        toolbar.appendChild(csvBtn);
        shell.appendChild(toolbar);

        const body = document.createElement('div');
        body.style.cssText = 'overflow:auto;padding:0 20px 20px;flex:1;';

        body.appendChild(this._section('Breaker / relay duty (ANSI, post-project)', this._dutyTable()));
        body.appendChild(this._section('On-site source contribution at POI', this._sourceTable()));
        body.appendChild(this._section('Grounding / SLG / NGR', this._groundingTable()));
        body.appendChild(this._section('Protection coordination data (IEC min/max, close-in vs remote)', this._coordTable()));

        shell.appendChild(body);
        overlay.appendChild(shell);
        document.body.appendChild(overlay);
        attachBackdropCloseHandler(overlay, () => overlay.remove());
    }

    _section(title, table) {
        const wrap = document.createElement('div');
        wrap.style.marginTop = '16px';
        const h = document.createElement('h3');
        h.textContent = title;
        h.style.cssText = 'font-size:15px;margin:0 0 8px;';
        wrap.appendChild(h);
        wrap.appendChild(table);
        return wrap;
    }

    _table(headers, rows) {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.cssText = 'text-align:left;padding:6px 8px;border-bottom:2px solid #dee2e6;background:#f8f9fa;';
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        rows.forEach(cells => {
            const tr = document.createElement('tr');
            cells.forEach((cell, idx) => {
                const td = document.createElement('td');
                if (typeof cell === 'object' && cell !== null && cell.t !== undefined) {
                    td.textContent = cell.t;
                    if (cell.style) Object.assign(td.style, cell.style);
                } else {
                    td.textContent = cell ?? '—';
                }
                td.style.padding = '6px 8px';
                td.style.borderBottom = '1px solid #eee';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    }

    _dutyTable() {
        const duties = this.results.breaker_duties || [];
        if (!duties.length) return this._empty('No switches with ratings on the diagram.');
        const rows = duties.map(d => {
            const st = passStyle(d.interrupting_pass, d.over_duty);
            return [
                { t: d.name || '—', style: d.over_duty ? { fontWeight: '700', color: '#842029' } : {} },
                fmt(d.duty_interrupting_ka),
                fmt(d.interrupting_rating_ka),
                d.over_duty ? { t: 'OVER-DUTY', style: { background: st.bg, color: st.fg, fontWeight: '700' } } : { t: d.interrupting_pass === false ? 'FAIL' : 'OK', style: { background: st.bg, color: st.fg } },
                fmt(d.pre_duty_interrupting_ka),
                fmt(d.duty_momentary_ka),
                fmt(d.momentary_rating_ka),
            ];
        });
        return this._table(['Device', 'Duty int [kA]', 'Rating int [kA]', 'Status', 'Pre int [kA]', 'Duty mom [kA]', 'Rating mom [kA]'], rows);
    }

    _sourceTable() {
        const rows = (this.results.source_contributions || []).map(s => [
            s.name || '—',
            s.kind || '—',
            fmt(s.delta_i_first_sym_ka_poi),
            fmt(s.i_with_source_ka_poi),
            fmt(s.i_without_source_ka_poi),
        ]);
        if (!rows.length) return this._empty('No on-site sources in the model.');
        return this._table(['Source', 'Type', 'ΔI at POI [kA]', 'I with [kA]', 'I without [kA]'], rows);
    }

    _groundingTable() {
        const rows = (this.results.grounding || []).map(g => [
            g.trafo_name || '—',
            fmt(g.slg_i_ka_lv),
            fmt(g.slg_i_ka_poi_ansi),
            g.rn_ohm != null ? fmt(g.rn_ohm, 2) : '—',
            g.suggested_rn_ohm != null ? fmt(g.suggested_rn_ohm, 2) : '—',
            g.rn_voltage_v != null ? fmt(g.rn_voltage_v, 1) : '—',
        ]);
        if (!rows.length) return this._empty('No transformer grounding data.');
        return this._table(['Transformer', 'SLG I LV [kA]', 'SLG I POI [kA]', 'Rn [Ω]', 'Suggested Rn [Ω]', 'V_Rn [V]'], rows);
    }

    _coordTable() {
        const rows = (this.results.coordination || []).map(c => [
            c.location_class || '—',
            c.bus_name || '—',
            c.fault_type || '—',
            c.case || '—',
            fmt(c.ikss_ka),
            fmt(c.ip_ka),
            fmt(c.ith_ka),
        ]);
        if (!rows.length) return this._empty('No coordination scenarios computed.');
        return this._table(['Class', 'Bus', 'Fault', 'Case', 'Ik″ [kA]', 'Ip [kA]', 'Ith [kA]'], rows);
    }

    _empty(msg) {
        const p = document.createElement('p');
        p.textContent = msg;
        p.style.color = '#6c757d';
        return p;
    }

    _exportCsv() {
        const lines = [];
        const push = (title, headers, rows) => {
            lines.push(title);
            lines.push(headers.join(','));
            rows.forEach(r => lines.push(r.map(x => (typeof x === 'object' ? x.t : x) ?? '').join(',')));
            lines.push('');
        };
        push('breaker_duties', ['name', 'duty_int', 'rating_int', 'over_duty', 'pre_int', 'duty_mom', 'rating_mom'],
            (this.results.breaker_duties || []).map(d => [d.name, d.duty_interrupting_ka, d.interrupting_rating_ka, d.over_duty, d.pre_duty_interrupting_ka, d.duty_momentary_ka, d.momentary_rating_ka]));
        push('source_contributions', ['name', 'kind', 'delta_ka', 'with_ka', 'without_ka'],
            (this.results.source_contributions || []).map(s => [s.name, s.kind, s.delta_i_first_sym_ka_poi, s.i_with_source_ka_poi, s.i_without_source_ka_poi]));
        push('grounding', ['trafo', 'slg_lv', 'slg_poi', 'rn', 'suggested_rn', 'v_rn'],
            (this.results.grounding || []).map(g => [g.trafo_name, g.slg_i_ka_lv, g.slg_i_ka_poi_ansi, g.rn_ohm, g.suggested_rn_ohm, g.rn_voltage_v]));
        push('coordination', ['class', 'bus', 'fault', 'case', 'ikss', 'ip', 'ith'],
            (this.results.coordination || []).map(c => [c.location_class, c.bus_name, c.fault_type, c.case, c.ikss_ka, c.ip_ka, c.ith_ka]));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'poi_fault_study.csv';
        a.click();
    }
}
