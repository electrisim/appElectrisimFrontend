/**
 * Wind Turbine Controller (steady-state) — Pref from wind speed + power curve for snapshot load flow.
 * Chain: Wind Speed Input → Lookup (Power Curve) → Pref / P
 */
import { Dialog } from '../Dialog.js';
import {
    defaultWindPowerCurveJson,
    defaultWindPowerCurvePoints,
    parseWindPowerCurvePoints,
    computeWindTurbinePMw,
    WIND_CURVE_APPROX_OPTIONS,
    WIND_POWER_CURVE_TEMPLATES
} from '../windTurbineDialog.js';

const BLOCKS = [
    { id: 'wind_input', title: 'Wind Speed\nInput', color: '#e3f2fd', border: '#1565c0' },
    { id: 'lookup', title: 'Lookup Table\n(Power Curve)', color: '#fff3e0', border: '#ef6c00' },
    { id: 'outputs', title: 'Pref / P', color: '#eceff1', border: '#455a64' }
];

export const DEFAULT_WTC_STEADY_NAME = 'WindTurbineController (steady-state)';

export const defaultWindTurbineControllerData = {
    name: DEFAULT_WTC_STEADY_NAME,
    wind_turbine: '',
    enabled: true,
    power_curve_type: 'Turbine Power Curve',
    wind_speed_ms: '10',
    use_turbine_wind_speed: true,
    wind_power_curve_json: defaultWindPowerCurveJson,
    wind_curve_approx: 'linear'
};

function attrMap(cellData) {
    const m = {};
    if (!cellData?.attributes) return m;
    for (let i = 0; i < cellData.attributes.length; i++) {
        m[cellData.attributes[i].name] = cellData.attributes[i].value;
    }
    return m;
}

function listWindTurbineNames(graph) {
    const names = [];
    if (!graph) return names;
    const model = graph.getModel();
    const cells = model.getDescendants ? model.getDescendants() : [];
    for (const cell of cells) {
        const style = cell.getStyle?.() || '';
        if (!style.includes('shapeELXXX=Wind Turbine')) continue;
        let name = cell.value?.getAttribute?.('name');
        if (!name) name = (cell.mxObjectId || cell.id || '').toString().replace('#', '_');
        if (name) names.push(name);
    }
    return names.sort();
}

export class WindTurbineControllerDialog extends Dialog {
    constructor(editorUi) {
        super('Wind Turbine Controller (steady-state)', 'Apply');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.data = { ...defaultWindTurbineControllerData };
        this.inputs = new Map();
        this.selectedBlock = 'wind_input';
        this._blockBtns = new Map();
        this._paramHost = null;
        this._prefPreview = null;
    }

    populateDialog(cellData) {
        const attrs = attrMap(cellData);
        Object.keys(this.data).forEach((key) => {
            if (attrs[key] == null) return;
            if (key === 'enabled' || key === 'use_turbine_wind_speed') {
                this.data[key] = attrs[key] === true || attrs[key] === 'true';
            } else {
                this.data[key] = attrs[key];
            }
        });
    }

    show(callback) {
        this.callback = callback;
        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Segoe UI, Arial, sans-serif',
            fontSize: '13px',
            color: '#212529',
            padding: '10px 12px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            height: '100%'
        });

        const banner = document.createElement('div');
        Object.assign(banner.style, {
            padding: '8px 10px',
            backgroundColor: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#0d47a1',
            lineHeight: '1.4'
        });
        banner.innerHTML =
            '<strong>Wind Turbine Controller (steady-state)</strong> (pandapower &amp; OpenDSS). ' +
            'Sets Pref for snapshot load flow from wind speed and the power curve. ' +
            'For averaging / gradient limiting, use <em>Controls → Dynamic → Wind Turbine Controller (dynamic)</em>.';
        container.appendChild(banner);

        // Header fields: name, turbine link, enabled
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr auto',
            gap: '10px',
            alignItems: 'end'
        });
        header.appendChild(this._fieldText('name', 'Name', this.data.name));
        header.appendChild(this._fieldTurbineSelect());
        header.appendChild(this._fieldCheckbox('enabled', 'Enabled', this.data.enabled));
        container.appendChild(header);

        // Visual chain
        const chainWrap = document.createElement('div');
        Object.assign(chainWrap.style, {
            border: '1px solid #adb5bd',
            borderRadius: '4px',
            background: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)',
            padding: '16px 12px',
            overflowX: 'auto'
        });
        const chain = document.createElement('div');
        Object.assign(chain.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0',
            minWidth: '420px'
        });

        BLOCKS.forEach((block, idx) => {
            if (idx > 0) {
                const arrow = document.createElement('div');
                Object.assign(arrow.style, {
                    width: '28px',
                    height: '2px',
                    backgroundColor: '#6c757d',
                    position: 'relative',
                    flex: '0 0 28px'
                });
                const head = document.createElement('div');
                Object.assign(head.style, {
                    position: 'absolute',
                    right: '-1px',
                    top: '-4px',
                    width: '0',
                    height: '0',
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                    borderLeft: '8px solid #6c757d'
                });
                arrow.appendChild(head);
                chain.appendChild(arrow);
            }

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.blockId = block.id;
            Object.assign(btn.style, {
                width: '108px',
                minHeight: '64px',
                padding: '8px 6px',
                borderRadius: '6px',
                border: `2px solid ${block.border}`,
                backgroundColor: block.color,
                cursor: 'pointer',
                whiteSpace: 'pre-line',
                fontSize: '11px',
                fontWeight: '600',
                color: '#212529',
                lineHeight: '1.25',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                textAlign: 'center'
            });
            btn.textContent = block.title;
            btn.addEventListener('click', () => this._selectBlock(block.id));
            this._blockBtns.set(block.id, btn);
            chain.appendChild(btn);
        });
        chainWrap.appendChild(chain);

        // Pref preview strip
        const preview = document.createElement('div');
        Object.assign(preview.style, {
            marginTop: '10px',
            fontSize: '12px',
            color: '#495057',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap'
        });
        this._prefPreview = preview;
        chainWrap.appendChild(preview);
        container.appendChild(chainWrap);

        // Parameter panel for selected block
        const paramPanel = document.createElement('div');
        Object.assign(paramPanel.style, {
            border: '1px solid #ced4da',
            borderRadius: '4px',
            padding: '12px',
            backgroundColor: '#fff',
            minHeight: '180px',
            flex: '1 1 auto',
            overflowY: 'auto'
        });
        this._paramHost = paramPanel;
        container.appendChild(paramPanel);

        // Buttons (same style as Dialog / Load Flow / other study dialogs)
        const buttons = document.createElement('div');
        Object.assign(buttons.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            paddingTop: '12px',
            marginTop: '8px',
            borderTop: '1px solid #e9ecef',
            flexShrink: '0'
        });
        const cancel = this.createButton('Cancel', '#6c757d', '#5a6268');
        const apply = this.createButton('Apply', '#007bff', '#0056b3');
        cancel.onclick = (e) => {
            e?.preventDefault?.();
            this.closeDialog();
        };
        apply.onclick = (e) => {
            e?.preventDefault?.();
            const values = this.getFormValues();
            this.callback?.(values);
            this.closeDialog();
        };
        buttons.append(cancel, apply);
        container.appendChild(buttons);

        this.container = container;
        if (this.ui?.showDialog) {
            // true, false = no Draw.io buttons; onClose runs destroy for ESC / X
            this.ui.showDialog(container, 980, Math.min(window.innerHeight - 60, 720), true, false, () => {
                this.destroy();
                return 1;
            });
        } else {
            this.showModalFallback(container);
        }

        this._selectBlock(this.selectedBlock);
        this._updatePrefPreview();
    }

    _fieldText(id, label, value) {
        const wrap = document.createElement('div');
        const lab = document.createElement('label');
        lab.textContent = label;
        Object.assign(lab.style, { display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' });
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value ?? '';
        Object.assign(input.style, { width: '100%', padding: '6px 8px', boxSizing: 'border-box' });
        this.inputs.set(id, input);
        wrap.append(lab, input);
        return wrap;
    }

    _fieldCheckbox(id, label, checked) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' });
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(checked);
        const lab = document.createElement('label');
        lab.textContent = label;
        lab.style.fontWeight = '600';
        lab.style.fontSize = '12px';
        this.inputs.set(id, input);
        wrap.append(input, lab);
        return wrap;
    }

    _fieldTurbineSelect() {
        const wrap = document.createElement('div');
        const lab = document.createElement('label');
        lab.textContent = 'Controlled Wind Turbine';
        Object.assign(lab.style, { display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '12px' });
        const sel = document.createElement('select');
        Object.assign(sel.style, { width: '100%', padding: '6px 8px', boxSizing: 'border-box' });
        const names = listWindTurbineNames(this.graph);
        sel.appendChild(new Option('(none)', '', false, !this.data.wind_turbine));
        names.forEach((n) => {
            sel.appendChild(new Option(n, n, false, n === this.data.wind_turbine));
        });
        if (this.data.wind_turbine && !names.includes(this.data.wind_turbine)) {
            sel.appendChild(new Option(this.data.wind_turbine + ' (missing)', this.data.wind_turbine, false, true));
        }
        this.inputs.set('wind_turbine', sel);
        sel.addEventListener('change', () => this._updatePrefPreview());
        wrap.append(lab, sel);
        return wrap;
    }

    _selectBlock(blockId) {
        this.selectedBlock = blockId;
        this._blockBtns.forEach((btn, id) => {
            const meta = BLOCKS.find((b) => b.id === id);
            const active = id === blockId;
            btn.style.outline = active ? `3px solid ${meta.border}` : 'none';
            btn.style.transform = active ? 'translateY(-2px)' : 'none';
            btn.style.boxShadow = active
                ? `0 0 0 1px ${meta.border}, 0 4px 10px rgba(0,0,0,0.12)`
                : '0 1px 2px rgba(0,0,0,0.08)';
        });
        this._renderBlockParams(blockId);
    }

    _clearParamHost() {
        const host = this._paramHost;
        if (!host) return;
        while (host.firstChild) host.removeChild(host.firstChild);
    }

    _paramTitle(text) {
        const t = document.createElement('div');
        t.textContent = text;
        Object.assign(t.style, {
            fontWeight: '700',
            fontSize: '14px',
            marginBottom: '10px',
            color: '#343a40'
        });
        return t;
    }

    _numRow(id, label, value, step = '0.1') {
        const row = document.createElement('label');
        Object.assign(row.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 140px',
            gap: '12px',
            alignItems: 'center',
            margin: '8px 0'
        });
        const span = document.createElement('span');
        span.textContent = label;
        const input = document.createElement('input');
        input.type = 'number';
        input.step = step;
        input.value = value != null ? String(value) : '';
        Object.assign(input.style, { padding: '6px 8px' });
        this.inputs.set(id, input);
        input.addEventListener('input', () => this._updatePrefPreview());
        row.append(span, input);
        return row;
    }

    _selectRow(id, label, value, options) {
        const row = document.createElement('label');
        Object.assign(row.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 220px',
            gap: '12px',
            alignItems: 'center',
            margin: '8px 0'
        });
        const span = document.createElement('span');
        span.textContent = label;
        const sel = document.createElement('select');
        options.forEach((opt) => {
            const v = typeof opt === 'object' ? opt.value : opt;
            const lab = typeof opt === 'object' ? opt.label : opt;
            sel.appendChild(new Option(lab, v, false, v === value));
        });
        Object.assign(sel.style, { padding: '6px 8px' });
        this.inputs.set(id, sel);
        sel.addEventListener('change', () => {
            this._updatePrefPreview();
            if (id === 'power_curve_type') this._renderBlockParams('lookup');
        });
        row.append(span, sel);
        return row;
    }

    _renderBlockParams(blockId) {
        this._clearParamHost();
        const host = this._paramHost;
        if (!host) return;

        if (blockId === 'wind_input') {
            host.appendChild(this._paramTitle('Wind Speed Input'));
            const hint = document.createElement('p');
            hint.style.cssText = 'margin:0 0 8px;color:#6c757d;font-size:12px;';
            hint.textContent =
                'Source wind speed for the lookup table. Prefer the linked Wind Turbine wind_speed_ms, or override here.';
            host.appendChild(hint);
            const useTurbine = document.createElement('label');
            useTurbine.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = this.data.use_turbine_wind_speed !== false;
            // restore from live input if present
            const existing = this.inputs.get('use_turbine_wind_speed');
            if (existing) cb.checked = existing.checked;
            this.inputs.set('use_turbine_wind_speed', cb);
            cb.addEventListener('change', () => this._updatePrefPreview());
            useTurbine.append(cb, document.createTextNode('Use linked Wind Turbine wind speed'));
            host.appendChild(useTurbine);
            host.appendChild(this._numRow('wind_speed_ms', 'Wind speed override [m/s]', this._val('wind_speed_ms', '10'), '0.1'));
            return;
        }

        if (blockId === 'lookup') {
            host.appendChild(this._paramTitle('Lookup Table (Power Curve)'));
            host.appendChild(
                this._selectRow(
                    'power_curve_type',
                    'Type of Power Curve',
                    this._val('power_curve_type', 'Turbine Power Curve'),
                    ['Turbine Power Curve', 'Controller Curve']
                )
            );
            host.appendChild(
                this._selectRow(
                    'wind_curve_approx',
                    'Approximation',
                    this._val('wind_curve_approx', 'linear'),
                    WIND_CURVE_APPROX_OPTIONS
                )
            );

            const type = this.inputs.get('power_curve_type')?.value || this.data.power_curve_type;
            const note = document.createElement('p');
            note.style.cssText = 'margin:8px 0;color:#6c757d;font-size:12px;';
            if (type === 'Turbine Power Curve') {
                note.textContent =
                    'Uses the power curve stored on the linked Wind Turbine. Switch to “Controller Curve” to edit a dedicated curve here.';
                host.appendChild(note);
            } else {
                note.textContent = 'Controller-owned P(v) table (editable). Stored on this controller cell.';
                host.appendChild(note);
                host.appendChild(this._mountMiniCurveEditor());
            }
            return;
        }

        if (blockId === 'outputs') {
            host.appendChild(this._paramTitle('Outputs Pref / P'));
            const hint = document.createElement('p');
            hint.style.cssText = 'margin:0 0 8px;color:#6c757d;font-size:12px;';
            hint.textContent =
                'Pref is the power-curve lookup at the selected wind speed. Snapshot load flow injects this Pref as turbine P.';
            host.appendChild(hint);
            this._updatePrefPreview();
            const box = document.createElement('div');
            box.style.cssText =
                'padding:12px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;font-family:Consolas,monospace;';
            box.id = 'wtc-output-box';
            host.appendChild(box);
            this._fillOutputBox(box);
        }
    }

    _val(id, fallback) {
        const live = this.inputs.get(id);
        if (live) {
            if (live.type === 'checkbox') return live.checked;
            return live.value;
        }
        return this.data[id] != null ? this.data[id] : fallback;
    }

    _mountMiniCurveEditor() {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: '10px',
            marginTop: '8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            padding: '8px',
            background: '#fafafa'
        });

        const tableScroll = document.createElement('div');
        Object.assign(tableScroll.style, { maxHeight: '200px', overflowY: 'auto', border: '1px solid #adb5bd', background: '#fff' });
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px;';
        const thead = document.createElement('thead');
        thead.innerHTML =
            '<tr><th style="padding:3px;border-bottom:1px solid #adb5bd;background:#e9ecef"></th>' +
            '<th style="padding:3px;border-bottom:1px solid #adb5bd;background:#e9ecef">speed</th>' +
            '<th style="padding:3px;border-bottom:1px solid #adb5bd;background:#e9ecef">Power MW</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        tableScroll.appendChild(table);

        let pts =
            parseWindPowerCurvePoints(this._val('wind_power_curve_json', defaultWindPowerCurveJson)) ||
            defaultWindPowerCurvePoints.slice();

        const hidden = document.createElement('textarea');
        hidden.style.display = 'none';
        hidden.value = JSON.stringify(pts);
        this.inputs.set('wind_power_curve_json', hidden);

        const sync = () => {
            const out = [];
            tbody.querySelectorAll('tr').forEach((tr) => {
                const v = parseFloat(tr.querySelector('[data-f=v]')?.value);
                const p = parseFloat(tr.querySelector('[data-f=p]')?.value);
                if (Number.isFinite(v) && Number.isFinite(p)) out.push({ v_ms: v, p_mw: p });
            });
            hidden.value = JSON.stringify(out);
            this._updatePrefPreview();
            draw(out);
        };

        const addRow = (v, p) => {
            const tr = document.createElement('tr');
            const tdDel = document.createElement('td');
            tdDel.style.textAlign = 'center';
            const del = document.createElement('button');
            del.type = 'button';
            del.textContent = '×';
            del.style.cssText = 'border:none;background:transparent;cursor:pointer;color:#adb5bd';
            del.addEventListener('click', () => {
                if (tbody.children.length <= 2) return;
                tr.remove();
                sync();
            });
            tdDel.appendChild(del);
            tr.appendChild(tdDel);

            const mk = (field, val) => {
                const td = document.createElement('td');
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = '0.01';
                inp.dataset.f = field;
                inp.value = String(val);
                inp.style.cssText = 'width:100%;border:none;padding:3px 4px;font-size:11px;box-sizing:border-box';
                inp.addEventListener('input', sync);
                td.appendChild(inp);
                return td;
            };
            tr.appendChild(mk('v', v));
            tr.appendChild(mk('p', p));
            tbody.appendChild(tr);
        };

        pts.forEach((pt) => addRow(pt.v_ms, pt.p_mw));

        const tplRow = document.createElement('div');
        tplRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px;';
        const tplSel = document.createElement('select');
        tplSel.style.cssText = 'min-width:160px;font-size:11px;padding:3px 6px;';
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '— Turbine class —';
        tplSel.appendChild(opt0);
        WIND_POWER_CURVE_TEMPLATES.forEach((tpl) => {
            const o = document.createElement('option');
            o.value = tpl.id;
            o.textContent = tpl.label;
            tplSel.appendChild(o);
        });
        const tplBtn = document.createElement('button');
        tplBtn.type = 'button';
        tplBtn.textContent = 'Apply template';
        tplBtn.style.cssText =
            'font-size:11px;padding:3px 8px;cursor:pointer;background:#17a2b8;color:#fff;border:none;border-radius:4px;';
        tplBtn.addEventListener('click', () => {
            const tpl = WIND_POWER_CURVE_TEMPLATES.find((t) => t.id === tplSel.value);
            if (!tpl) return;
            while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
            tpl.points.forEach((pt) => addRow(pt.v_ms, pt.p_mw));
            sync();
        });
        tplRow.append(tplSel, tplBtn);

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:6px;margin-top:4px;';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+ Row';
        addBtn.addEventListener('click', () => {
            const last = tbody.lastElementChild;
            const lastV = parseFloat(last?.querySelector('[data-f=v]')?.value) || 0;
            addRow(lastV + 1, 0);
            sync();
        });
        btns.appendChild(addBtn);

        const left = document.createElement('div');
        left.append(tplRow, tableScroll, btns);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 360 200');
        Object.assign(svg.style, { width: '100%', height: '200px', background: '#fff', border: '1px solid #adb5bd' });

        const draw = (points) => {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            if (!points || points.length < 2) return;
            const sorted = points.slice().sort((a, b) => a.v_ms - b.v_ms);
            const padL = 40;
            const padR = 10;
            const padT = 10;
            const padB = 28;
            const W = 360;
            const H = 200;
            const vMin = 0;
            const vMax = Math.max(...sorted.map((p) => p.v_ms), 1);
            const pMax = Math.max(...sorted.map((p) => p.p_mw), 0.1) * 1.02;
            const xOf = (v) => padL + ((v - vMin) / (vMax - vMin)) * (W - padL - padR);
            const yOf = (p) => padT + (H - padT - padB) - (p / pMax) * (H - padT - padB);
            const ns = 'http://www.w3.org/2000/svg';
            const addEl = (tag, attrs) => {
                const el = document.createElementNS(ns, tag);
                Object.entries(attrs).forEach(([k, val]) => el.setAttribute(k, String(val)));
                svg.appendChild(el);
                return el;
            };
            addEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' });
            addEl('rect', {
                x: padL,
                y: padT,
                width: W - padL - padR,
                height: H - padT - padB,
                fill: '#fafafa',
                stroke: '#adb5bd'
            });
            const d = sorted
                .map((pt, i) => `${i ? 'L' : 'M'}${xOf(pt.v_ms).toFixed(1)} ${yOf(pt.p_mw).toFixed(1)}`)
                .join(' ');
            addEl('path', { d, fill: 'none', stroke: '#c62828', 'stroke-width': 2 });
            const xlab = addEl('text', {
                x: (padL + W - padR) / 2,
                y: H - 6,
                'text-anchor': 'middle',
                'font-size': 11,
                fill: '#495057'
            });
            xlab.textContent = 'm/s';
            const ylab = addEl('text', {
                x: 12,
                y: H / 2,
                'text-anchor': 'middle',
                'font-size': 11,
                fill: '#495057',
                transform: `rotate(-90 12 ${H / 2})`
            });
            ylab.textContent = 'MW';
        };
        draw(pts);

        wrap.append(left, svg, hidden);
        return wrap;
    }

    _resolveWindSpeedAndCurve() {
        const turbineName = this.inputs.get('wind_turbine')?.value || this.data.wind_turbine || '';
        const useTurbineSpeed = this.inputs.get('use_turbine_wind_speed')
            ? this.inputs.get('use_turbine_wind_speed').checked
            : this.data.use_turbine_wind_speed !== false;
        let windSpeed = parseFloat(this.inputs.get('wind_speed_ms')?.value ?? this.data.wind_speed_ms);
        let curveJson = this.inputs.get('wind_power_curve_json')?.value || this.data.wind_power_curve_json;
        const curveType = this.inputs.get('power_curve_type')?.value || this.data.power_curve_type;
        const approx = this.inputs.get('wind_curve_approx')?.value || this.data.wind_curve_approx || 'linear';

        let turbineCell = null;
        if (turbineName && this.graph) {
            const cells = this.graph.getModel().getDescendants?.() || [];
            for (const cell of cells) {
                const style = cell.getStyle?.() || '';
                if (!style.includes('shapeELXXX=Wind Turbine')) continue;
                const n = cell.value?.getAttribute?.('name');
                if (n === turbineName) {
                    turbineCell = cell;
                    break;
                }
            }
        }

        if (turbineCell) {
            if (useTurbineSpeed) {
                const v = parseFloat(turbineCell.value.getAttribute('wind_speed_ms'));
                if (Number.isFinite(v)) windSpeed = v;
            }
            if (curveType !== 'Controller Curve') {
                const c = turbineCell.value.getAttribute('wind_power_curve_json');
                if (c) curveJson = c;
                const a = turbineCell.value.getAttribute('wind_curve_approx');
                if (a) {
                    // prefer turbine approx when using turbine curve
                    return { windSpeed, curveJson, approx: a || approx, turbineName };
                }
            }
        }
        return { windSpeed, curveJson, approx, turbineName };
    }

    _updatePrefPreview() {
        if (!this._prefPreview) return;
        const { windSpeed, curveJson, approx, turbineName } = this._resolveWindSpeedAndCurve();
        const pref = computeWindTurbinePMw(windSpeed, curveJson, approx);
        this._prefPreview.innerHTML =
            `<span><strong>Linked:</strong> ${turbineName || '(none)'}</span>` +
            `<span><strong>v:</strong> ${Number.isFinite(windSpeed) ? windSpeed.toFixed(2) : '—'} m/s</span>` +
            `<span><strong>Pref:</strong> ${pref.toFixed(4)} MW</span>` +
            `<span><strong>P (snapshot):</strong> ${pref.toFixed(4)} MW</span>`;
        const box = this._paramHost?.querySelector?.('#wtc-output-box');
        if (box) this._fillOutputBox(box, pref, windSpeed);
    }

    _fillOutputBox(box, pref, windSpeed) {
        if (pref == null || windSpeed == null) {
            const r = this._resolveWindSpeedAndCurve();
            pref = computeWindTurbinePMw(r.windSpeed, r.curveJson, r.approx);
            windSpeed = r.windSpeed;
        }
        box.textContent = `v = ${Number.isFinite(windSpeed) ? windSpeed.toFixed(3) : '—'} m/s\nPref = ${pref.toFixed(6)} MW\nP    = ${pref.toFixed(6)} MW  (steady-state snapshot)`;
    }

    getFormValues() {
        // Ensure curve JSON exists even if lookup panel never opened
        if (!this.inputs.has('wind_power_curve_json')) {
            const hidden = document.createElement('textarea');
            hidden.value = this.data.wind_power_curve_json || defaultWindPowerCurveJson;
            this.inputs.set('wind_power_curve_json', hidden);
        }
        if (!this.inputs.has('use_turbine_wind_speed')) {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = this.data.use_turbine_wind_speed !== false;
            this.inputs.set('use_turbine_wind_speed', cb);
        }

        const get = (id, fallback = '') => {
            const el = this.inputs.get(id);
            if (!el) return this.data[id] != null ? this.data[id] : fallback;
            if (el.type === 'checkbox') return el.checked;
            return el.value;
        };

        const ensureNum = (id, fallback) => {
            if (this.inputs.has(id)) return get(id, fallback);
            return this.data[id] != null ? this.data[id] : fallback;
        };

        return {
            name: get('name', DEFAULT_WTC_STEADY_NAME),
            wind_turbine: get('wind_turbine', ''),
            enabled: get('enabled', true),
            power_curve_type: ensureNum('power_curve_type', 'Turbine Power Curve'),
            wind_speed_ms: ensureNum('wind_speed_ms', '10'),
            use_turbine_wind_speed: get('use_turbine_wind_speed', true),
            wind_power_curve_json: get('wind_power_curve_json', defaultWindPowerCurveJson),
            wind_curve_approx: ensureNum('wind_curve_approx', 'linear')
        };
    }

    destroy() {
        super.destroy?.();
        if (window._globalDialogShowing) delete window._globalDialogShowing;
    }
}

if (typeof window !== 'undefined') {
    window.WindTurbineControllerDialog = WindTurbineControllerDialog;
}
