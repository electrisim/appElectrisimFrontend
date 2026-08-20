/**
 * Wind Turbine Controller (dynamic) — averaging & gradient limiting for time-domain studies.
 * Chain: Wind Speed Averaging → Gradient Limiter → Active Power Averaging
 * Does not set Pref for snapshot load flow (use the steady-state controller for that).
 */
import { Dialog } from '../Dialog.js';

const BLOCKS = [
    { id: 'wind_avg', title: 'Wind Speed\nAveraging', color: '#e8f5e9', border: '#2e7d32' },
    { id: 'gradient', title: 'Gradient\nLimiter', color: '#fce4ec', border: '#c2185b' },
    { id: 'power_avg', title: 'Active Power\nAveraging', color: '#f3e5f5', border: '#7b1fa2' }
];

export const DEFAULT_WTC_DYNAMIC_NAME = 'WindTurbineController (dynamic)';

export const defaultWindTurbineDynamicControllerData = {
    name: DEFAULT_WTC_DYNAMIC_NAME,
    wind_turbine: '',
    enabled: true,
    wind_avg_T: '1',
    wind_avg_Tavg: '10',
    power_avg_T: '1',
    power_avg_Tavg: '10',
    gradient_T: '1',
    gradient_max: '0.5'
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

export class WindTurbineDynamicControllerDialog extends Dialog {
    constructor(editorUi) {
        super('Wind Turbine Controller (dynamic)', 'Apply');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.data = { ...defaultWindTurbineDynamicControllerData };
        this.inputs = new Map();
        this.selectedBlock = 'wind_avg';
        this._blockBtns = new Map();
        this._paramHost = null;
    }

    populateDialog(cellData) {
        const attrs = attrMap(cellData);
        Object.keys(this.data).forEach((key) => {
            if (attrs[key] == null) return;
            if (key === 'enabled') {
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
            border: '1px solid #bbdefb',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1565c0',
            lineHeight: '1.4'
        });
        banner.innerHTML =
            '<strong>Wind Turbine Controller (dynamic)</strong> — time-domain / RMS chain. ' +
            'Stores wind-speed averaging, Pref gradient limiting, and active-power averaging for the linked turbine. ' +
            '<em>Not applied in snapshot load flow.</em> For Pref in load flow, use ' +
            '<em>Controls → Steady-state → Wind Turbine Controller (steady-state)</em>.';
        container.appendChild(banner);

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr auto',
            gap: '10px',
            alignItems: 'end'
        });
        header.appendChild(this._fieldText('name', 'Name', this.data.name));
        header.appendChild(this._fieldTurbineSelect());
        header.appendChild(this._fieldCheckbox('enabled', 'Enabled', this.data.enabled !== false));
        container.appendChild(header);

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
        container.appendChild(chainWrap);

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
            this.callback?.(this.getFormValues());
            this.closeDialog();
        };
        buttons.append(cancel, apply);
        container.appendChild(buttons);

        this.container = container;
        if (this.ui?.showDialog) {
            this.ui.showDialog(container, 900, Math.min(window.innerHeight - 60, 640), true, false, () => {
                this.destroy();
                return 1;
            });
        } else {
            this.showModalFallback(container);
        }

        this._selectBlock(this.selectedBlock);
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
        row.append(span, input);
        return row;
    }

    _val(id, fallback) {
        const live = this.inputs.get(id);
        if (live) {
            if (live.type === 'checkbox') return live.checked;
            return live.value;
        }
        return this.data[id] != null ? this.data[id] : fallback;
    }

    _renderBlockParams(blockId) {
        this._clearParamHost();
        const host = this._paramHost;
        if (!host) return;

        if (blockId === 'wind_avg') {
            host.appendChild(this._paramTitle('Wind Speed Averaging'));
            const hint = document.createElement('p');
            hint.style.cssText = 'margin:0 0 8px;color:#6c757d;font-size:12px;';
            hint.textContent =
                'First-order / moving averaging of wind speed before the Pref chain in time-domain studies.';
            host.appendChild(hint);
            host.appendChild(this._numRow('wind_avg_T', 'T [s]', this._val('wind_avg_T', '1'), '0.1'));
            host.appendChild(this._numRow('wind_avg_Tavg', 'Tavg [s]', this._val('wind_avg_Tavg', '10'), '0.1'));
            return;
        }

        if (blockId === 'gradient') {
            host.appendChild(this._paramTitle('Gradient Limiter'));
            const hint = document.createElement('p');
            hint.style.cssText = 'margin:0 0 8px;color:#6c757d;font-size:12px;';
            hint.textContent =
                'Limits the rate of change of active-power reference (MW/s) during ramping / time-series.';
            host.appendChild(hint);
            host.appendChild(this._numRow('gradient_T', 'T [s]', this._val('gradient_T', '1'), '0.1'));
            host.appendChild(this._numRow('gradient_max', 'Max gradient [MW/s]', this._val('gradient_max', '0.5'), '0.01'));
            return;
        }

        if (blockId === 'power_avg') {
            host.appendChild(this._paramTitle('Active Power Averaging'));
            const hint = document.createElement('p');
            hint.style.cssText = 'margin:0 0 8px;color:#6c757d;font-size:12px;';
            hint.textContent =
                'Averaging of active power after the gradient limiter in time-domain studies.';
            host.appendChild(hint);
            host.appendChild(this._numRow('power_avg_T', 'T [s]', this._val('power_avg_T', '1'), '0.1'));
            host.appendChild(this._numRow('power_avg_Tavg', 'Tavg [s]', this._val('power_avg_Tavg', '10'), '0.1'));
        }
    }

    getFormValues() {
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
            name: get('name', DEFAULT_WTC_DYNAMIC_NAME),
            wind_turbine: get('wind_turbine', ''),
            enabled: get('enabled', true),
            wind_avg_T: ensureNum('wind_avg_T', '1'),
            wind_avg_Tavg: ensureNum('wind_avg_Tavg', '10'),
            power_avg_T: ensureNum('power_avg_T', '1'),
            power_avg_Tavg: ensureNum('power_avg_Tavg', '10'),
            gradient_T: ensureNum('gradient_T', '1'),
            gradient_max: ensureNum('gradient_max', '0.5')
        };
    }

    destroy() {
        super.destroy?.();
        if (window._globalDialogShowing) delete window._globalDialogShowing;
    }
}

if (typeof window !== 'undefined') {
    window.WindTurbineDynamicControllerDialog = WindTurbineDynamicControllerDialog;
}
