/**
 * Plant Supervisory Controller (steady-state, pandapower).
 *
 * Leads the plant's STATCOMs and variable shunt reactors to one target at a chosen busbar
 * (normally the POC): Q, voltage, voltage with Q-V droop, cos phi or a Q(P) characteristic.
 * The reactors take the bulk of the reactive power in steps; the STATCOMs supply the exact
 * remainder and are kept near the middle of their range.
 *
 * Tabs: Devices | Control. Built on the Park Controller dialog (same cards and controls).
 */
import { ParkControllerDialog } from './ParkControllerDialog.js';
import { listGridTemplates, getGridTemplateRequirementsMw } from './RPCDialog.js';

export const DEFAULT_PSC_NAME = 'Plant Supervisory Controller';

export const PSC_CONTROL_MODES = [
    { value: 'Q', label: 'Q control (constant Q at the bus)' },
    { value: 'V', label: 'Voltage control' },
    { value: 'V_droop', label: 'Voltage control with Q-V droop' },
    { value: 'cosphi', label: 'cos φ control' },
    { value: 'QP', label: 'Q(P) characteristic' }
];

export const defaultPlantSupervisoryControllerData = {
    name: DEFAULT_PSC_NAME,
    enabled: true,
    control_bus: '',
    control_mode: 'Q',
    q_set_mvar: '0',
    vm_set_pu: '1.0',
    droop_percent: '4',
    q_ref_mvar: '0',
    cos_phi: '1.0',
    excitation: 'Overexcited',
    qp_characteristic_json: '[{"p_mw":0,"q_mvar":0}]',
    /** 'custom' or a Grid Code P-Q template key; the points are then built from that template. */
    qp_source: 'custom',
    /** Which edge of the template's required envelope to follow: 'max' (capacitive) or 'min' (inductive). */
    qp_edge: 'max',
    /** Active-power base for the template's p.u. table (Pmax at the controlled bus). */
    qp_pmax_mw: '',
    statcoms_json: '[]',
    reactors_json: '[]',
    statcom_band_percent: '50'
};

function attrMap(cellData) {
    const m = {};
    if (!cellData?.attributes) return m;
    for (let i = 0; i < cellData.attributes.length; i++) {
        m[cellData.attributes[i].name] = cellData.attributes[i].value;
    }
    return m;
}

function parseJsonArray(raw) {
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function shapeOf(cell) {
    const m = String(cell?.getStyle?.() || cell?.style || '').match(/shapeELXXX=([^;]+)/);
    return m ? m[1] : '';
}

function cellName(cell) {
    const n = cell?.value?.getAttribute?.('name');
    return n || String(cell?.mxObjectId || cell?.id || '').replace('#', '_');
}

function attr(cell, name) {
    return cell?.value?.getAttribute?.(name);
}

function listBusNames(graph) {
    const names = [];
    for (const cell of graph?.getModel?.().getDescendants?.() || []) {
        const s = shapeOf(cell);
        if (s === 'Bus' || s === 'Busbar') names.push(cellName(cell));
    }
    return [...new Set(names.filter(Boolean))].sort();
}

/** STATCOMs on the page with their Q rating (empty rating = cannot be led). */
function listStatcoms(graph) {
    const out = [];
    for (const cell of graph?.getModel?.().getDescendants?.() || []) {
        if (shapeOf(cell) !== 'SSC') continue;
        const qMax = parseFloat(attr(cell, 'q_max_mvar'));
        const qMin = parseFloat(attr(cell, 'q_min_mvar'));
        const rated = Number.isFinite(qMax) && Number.isFinite(qMin) && !(qMax === 0 && qMin === 0);
        const controllable = attr(cell, 'controllable') !== 'false';
        let info;
        if (!rated) info = 'No Q rating: set both ratings in the STATCOM dialog';
        else if (!controllable) info = 'Controllable is unticked in the STATCOM dialog';
        else info = `Q ${-Math.abs(qMin)} … +${Math.abs(qMax)} Mvar`;
        out.push({ id: String(cell.id), name: cellName(cell), info, usable: rated && controllable });
    }
    return out;
}

/** Shunt reactors on the page with their steps. */
function listReactors(graph) {
    const out = [];
    for (const cell of graph?.getModel?.().getDescendants?.() || []) {
        if (shapeOf(cell) !== 'Shunt Reactor') continue;
        let info;
        let usable = true;
        const table = parseJsonArray(attr(cell, 'shunt_characteristic_table_json'));
        if (attr(cell, 'step_dependency_table') === 'true' && table.length) {
            const qs = table.map((r) => Number(r.q_mvar)).filter(Number.isFinite);
            info = `${table.length} steps, ${Math.min(...qs)} … ${Math.max(...qs)} Mvar`;
            usable = table.length >= 2;
        } else {
            const maxStep = parseInt(attr(cell, 'max_step') || '1', 10);
            const q = Number(attr(cell, 'q_mvar'));
            info = `${Number.isFinite(maxStep) ? maxStep + 1 : '?'} steps of ${Number.isFinite(q) ? q : '?'} Mvar (0 … max step)`;
            usable = Number.isFinite(maxStep) && maxStep >= 1;
        }
        if (!usable) info += ': only one step, cannot be switched';
        out.push({ id: String(cell.id), name: cellName(cell), info, usable });
    }
    return out;
}

export class PlantSupervisoryControllerDialog extends ParkControllerDialog {
    constructor(editorUi) {
        super(editorUi);
        this.title = 'Plant Supervisory Controller (steady-state)';
        this.data = { ...defaultPlantSupervisoryControllerData };
        this.currentTab = 'devices';
        this._usesMachines = false;
        this.statcoms = [];
        this.reactors = [];
    }

    _tabSpecs() {
        return [
            ['Devices', 'devices'],
            ['Control', 'control']
        ];
    }

    getDescription() {
        return (
            '<strong>Configure the Plant Supervisory Controller (steady-state)</strong><br>' +
            'Leads the plant\'s STATCOMs and variable shunt reactors to one target at a chosen busbar, ' +
            'normally the point of connection: Q, voltage, voltage with Q-V droop, cos φ or Q(P). ' +
            'The reactors take the bulk of the reactive power in steps and the STATCOMs supply the exact ' +
            'remainder, so the result at the busbar is smooth. Pandapower only.'
        );
    }

    populateDialog(cellData) {
        const a = attrMap(cellData);
        Object.keys(defaultPlantSupervisoryControllerData).forEach((k) => {
            if (a[k] != null && a[k] !== '') this.data[k] = a[k];
        });
        if (a.enabled != null) this.data.enabled = a.enabled === true || a.enabled === 'true';
        this._loadDevices();
    }

    _loadDevices() {
        this.graph = this.graph || this.ui?.editor?.graph;
        const pickStat = new Set(parseJsonArray(this.data.statcoms_json).map((r) => String(r?.id ?? '')));
        const pickReac = new Set(parseJsonArray(this.data.reactors_json).map((r) => String(r?.id ?? '')));
        this.statcoms = listStatcoms(this.graph).map((d) => ({ ...d, selected: pickStat.has(d.id) }));
        this.reactors = listReactors(this.graph).map((d) => ({ ...d, selected: pickReac.has(d.id) }));
    }

    showTabDialog() {
        if (!this.statcoms.length && !this.reactors.length) this._loadDevices();
        super.showTabDialog();
    }

    _renderCurrentTab() {
        const host = this._scrollHost;
        if (!host) return;
        host.innerHTML = '';
        const keep = new Map();
        ['name', 'enabled'].forEach((k) => {
            if (this.inputs.has(k)) keep.set(k, this.inputs.get(k));
        });
        this.inputs = keep;
        if (this.currentTab === 'devices') this._renderDevices(host);
        else this._renderControl(host);
    }

    _note(text, tone = 'info') {
        const note = document.createElement('div');
        const colours = tone === 'warn'
            ? { bg: '#fff8e1', border: '#ffe082', fg: '#6d4c41' }
            : { bg: '#e8f5e9', border: '#c8e6c9', fg: '#1b5e20' };
        Object.assign(note.style, {
            padding: '10px 14px',
            backgroundColor: colours.bg,
            border: `1px solid ${colours.border}`,
            borderRadius: '8px',
            fontSize: '12px',
            color: colours.fg,
            lineHeight: '1.45'
        });
        note.textContent = text;
        return note;
    }

    _deviceTable(title, rows, emptyText) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            padding: '14px 16px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px'
        });
        const h = document.createElement('div');
        h.textContent = title;
        Object.assign(h.style, { fontWeight: '600', fontSize: '14px', color: '#495057', marginBottom: '8px' });
        wrap.appendChild(h);
        if (!rows.length) {
            const empty = document.createElement('div');
            empty.textContent = emptyText;
            Object.assign(empty.style, { fontSize: '12px', color: '#6c757d', fontStyle: 'italic' });
            wrap.appendChild(empty);
            return wrap;
        }
        rows.forEach((row) => {
            const line = document.createElement('label');
            Object.assign(line.style, {
                display: 'grid',
                gridTemplateColumns: '28px minmax(0,1fr) minmax(0,1.4fr)',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 4px',
                borderTop: '1px solid #e9ecef',
                cursor: row.usable ? 'pointer' : 'not-allowed',
                opacity: row.usable ? '1' : '0.65'
            });
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!row.selected && row.usable;
            cb.disabled = !row.usable;
            Object.assign(cb.style, { width: '18px', height: '18px', accentColor: '#2e7d32' });
            cb.onchange = () => {
                row.selected = cb.checked;
            };
            const name = document.createElement('span');
            name.textContent = row.name;
            Object.assign(name.style, { fontSize: '13px', color: '#212529', fontWeight: '500' });
            const info = document.createElement('span');
            info.textContent = row.info;
            Object.assign(info.style, { fontSize: '12px', color: row.usable ? '#6c757d' : '#b45309' });
            line.append(cb, name, info);
            wrap.appendChild(line);
        });
        return wrap;
    }

    _renderDevices(host) {
        const form = this._formColumn();
        form.appendChild(this._deviceTable(
            'STATCOMs (continuous Q)',
            this.statcoms,
            'No STATCOM (SSC) on this page.'
        ));
        form.appendChild(this._deviceTable(
            'Variable shunt reactors (Q in steps)',
            this.reactors,
            'No shunt reactor on this page.'
        ));
        form.appendChild(this._paramCard(
            'STATCOM reserve band [%]',
            'The reactors switch only when the STATCOMs leave this share of their half-range around the middle of their range (50 % of ±200 Mvar = ±100 Mvar). Then they switch to the steps that bring the STATCOMs back closest to the middle. A ticked reactor leaves its own step control (voltage or Line P→step) while this controller leads it.',
            this._numberInput('statcom_band_percent', this.data.statcom_band_percent, '5')
        ));
        form.appendChild(this._note(
            'Ticked STATCOMs need both Q ratings (STATCOM dialog). While led by this controller a STATCOM does not hold its own voltage setpoint: the controller sets its Q within its rating.'
        ));
        host.appendChild(form);
    }

    _renderControl(host) {
        const form = this._formColumn();
        form.appendChild(this._paramCard(
            'Name',
            'Name of the controller (shown on the diagram).',
            this._textInput('name', this.data.name, true),
            { wide: true }
        ));
        form.appendChild(this._paramCard(
            'Enabled',
            'When ticked, the controller is attached in pandapower load flows and in Grid Code P-Q ("Park Controller — exactly as configured").',
            this._checkboxInput('enabled', this.data.enabled !== false)
        ));
        form.appendChild(this._paramCard(
            'Controlled bus',
            'Busbar where the target applies, normally the point of connection (POC). Q and P are measured as the power the plant feeds into this busbar.',
            this._namedSelectInput('control_bus', this.data.control_bus, listBusNames(this.graph))
        ));
        form.appendChild(this._paramCard(
            'Control mode',
            'What the controller holds at the controlled bus.',
            this._selectInput('control_mode', this.data.control_mode, PSC_CONTROL_MODES, () => {
                this._syncDataFromInputs();
                this._renderCurrentTab();
            })
        ));

        const mode = this.inputs.get('control_mode')?.value || this.data.control_mode;
        if (mode === 'Q') {
            form.appendChild(this._paramCard(
                'Q setpoint [Mvar]',
                'Reactive power the plant feeds into the controlled bus. + = the plant supplies Q (capacitive, overexcited); − = it absorbs Q (inductive, underexcited).',
                this._numberInput('q_set_mvar', this.data.q_set_mvar, '0.1')
            ));
        } else if (mode === 'V') {
            form.appendChild(this._paramCard(
                'Voltage setpoint [p.u.]',
                'Voltage held at the controlled bus.',
                this._numberInput('vm_set_pu', this.data.vm_set_pu, '0.001')
            ));
            form.appendChild(this._note(
                'Voltage control cannot move the bus of the External Grid, because the external grid fixes that voltage in a load flow. At that bus, use Q-V droop (Q follows the grid voltage), Q, cos φ or Q(P), or pick a bus inside the plant.',
                'warn'
            ));
        } else if (mode === 'V_droop') {
            form.appendChild(this._paramCard(
                'Voltage setpoint [p.u.]',
                'Voltage at which the plant feeds no reactive power (centre of the droop).',
                this._numberInput('vm_set_pu', this.data.vm_set_pu, '0.001')
            ));
            form.appendChild(this._paramCard(
                'Droop [%]',
                'Voltage change, in % of the setpoint, for a reactive power change equal to the reference Q.',
                this._numberInput('droop_percent', this.data.droop_percent, '0.1')
            ));
            form.appendChild(this._paramCard(
                'Reference Q [Mvar]',
                'Q = Reference Q × 100 / Droop × (Setpoint − U). Example: 300 Mvar and 4 % give 75 Mvar per 0.01 p.u.',
                this._numberInput('q_ref_mvar', this.data.q_ref_mvar, '1')
            ));
        } else if (mode === 'cosphi') {
            form.appendChild(this._paramCard(
                'cos φ',
                'Power factor at the controlled bus: Q = |P| × tan(acos(cos φ)).',
                this._numberInput('cos_phi', this.data.cos_phi, '0.001')
            ));
            form.appendChild(this._paramCard(
                'Excitation',
                'Overexcited = the plant supplies Q (capacitive); underexcited = it absorbs Q (inductive).',
                this._selectInput('excitation', this.data.excitation, [
                    { value: 'Overexcited', label: 'Overexcited (capacitive, supplies Q)' },
                    { value: 'Underexcited', label: 'Underexcited (inductive, absorbs Q)' }
                ])
            ));
        } else {
            this._renderQpSection(form);
        }
        form.appendChild(this._note(
            'The controller stops pushing when one of its device buses reaches 0.90 or 1.10 p.u., or when every device is at its limit; the result box and the load-flow warnings then say which.'
        ));
        host.appendChild(form);
    }

    /** Sum of the active power of the generating units on the page (default Pmax for templates). */
    _installedPmw() {
        let sum = 0;
        for (const cell of this.graph?.getModel?.().getDescendants?.() || []) {
            const s = shapeOf(cell);
            if (!['Static Generator', 'Wind Turbine', 'Generator'].includes(s)) continue;
            if (attr(cell, 'in_service') === 'false') continue;
            const p = parseFloat(attr(cell, 'p_mw'));
            if (Number.isFinite(p)) sum += p;
        }
        return sum;
    }

    /** Q(P) points [{p_mw, q_mvar}] from a Grid Code P-Q template edge, scaled to Pmax. */
    _templatePoints(key, edge, pmax) {
        return getGridTemplateRequirementsMw(key, pmax).map((r) => ({
            p_mw: r.p,
            q_mvar: edge === 'min' ? r.qMin : r.qMax
        }));
    }

    _renderQpSection(form) {
        const templates = listGridTemplates();
        if (!this.data.qp_pmax_mw) {
            const inst = this._installedPmw();
            if (inst > 0) this.data.qp_pmax_mw = String(+inst.toFixed(3));
        }
        const source = this.inputs.get('qp_source')?.value || this.data.qp_source || 'custom';
        const tpl = templates.find((t) => t.key === source);

        const rerender = () => {
            this._syncDataFromInputs();
            const key = this.data.qp_source;
            const pmax = parseFloat(this.data.qp_pmax_mw);
            if (key && key !== 'custom' && pmax > 0) {
                this.data.qp_characteristic_json = JSON.stringify(
                    this._templatePoints(key, this.data.qp_edge, pmax));
            }
            this._renderCurrentTab();
        };

        form.appendChild(this._paramCard(
            'Q(P) characteristic from',
            'A Grid Code P-Q template (the same tables as the Grid Code Compliance P-Q study), or Custom to enter your own points.',
            this._selectInput('qp_source', source, [
                { value: 'custom', label: 'Custom (enter the points below)' },
                ...templates.map((t) => ({ value: t.key, label: t.name }))
            ], rerender)
        ));
        if (tpl) {
            if (tpl.description) form.appendChild(this._note(tpl.description));
            form.appendChild(this._paramCard(
                'Follow which edge',
                'A template gives a required range (Q min … Q max) at each P. The controller follows one edge of it.',
                this._selectInput('qp_edge', this.data.qp_edge || 'max', [
                    { value: 'max', label: 'Capacitive edge (required Q max, supplies Q)' },
                    { value: 'min', label: 'Inductive edge (required Q min, absorbs Q)' }
                ], rerender)
            ));
            const pmaxInput = this._numberInput('qp_pmax_mw', this.data.qp_pmax_mw, '0.1');
            pmaxInput.onchange = rerender;
            form.appendChild(this._paramCard(
                'Pmax [MW]',
                'Active-power base of the template\'s p.u. table, at the controlled bus. Defaults to the installed P of the generating units on this page; the Grid Code P-Q results show "Pmax at PCC" if you want to use that instead.',
                pmaxInput
            ));
        }
        const ta = this._textareaInput('qp_characteristic_json', this.data.qp_characteristic_json);
        if (tpl) {
            ta.readOnly = true;
            ta.style.backgroundColor = '#f1f3f5';
        }
        form.appendChild(this._paramCard(
            tpl ? 'Q(P) points (from the template)' : 'Q(P) points',
            'Points as [{"p_mw": …, "q_mvar": …}, …], P and Q fed into the controlled bus (+Q = supplies). Linear between points, flat outside them.' +
                (tpl ? ' Built from the template; pick Custom to edit them.' : ''),
            ta,
            { wide: true }
        ));
    }

    getFormValues() {
        this._syncDataFromInputs();
        const get = (id, fallback) => {
            const el = this.inputs.get(id);
            if (el) return el.type === 'checkbox' ? el.checked : el.value;
            return this.data[id] != null ? this.data[id] : fallback;
        };
        const pick = (rows) => JSON.stringify(
            rows.filter((r) => r.selected && r.usable).map(({ id, name }) => ({ id, name }))
        );
        return {
            name: get('name', DEFAULT_PSC_NAME),
            enabled: get('enabled', true),
            control_bus: get('control_bus', ''),
            control_mode: get('control_mode', 'Q'),
            q_set_mvar: get('q_set_mvar', '0'),
            vm_set_pu: get('vm_set_pu', '1.0'),
            droop_percent: get('droop_percent', '4'),
            q_ref_mvar: get('q_ref_mvar', '0'),
            cos_phi: get('cos_phi', '1.0'),
            excitation: get('excitation', 'Overexcited'),
            qp_characteristic_json: get('qp_characteristic_json', '[]'),
            qp_source: get('qp_source', 'custom'),
            qp_edge: get('qp_edge', 'max'),
            qp_pmax_mw: get('qp_pmax_mw', ''),
            statcoms_json: pick(this.statcoms),
            reactors_json: pick(this.reactors),
            statcom_band_percent: get('statcom_band_percent', '50')
        };
    }
}

if (typeof window !== 'undefined') {
    window.PlantSupervisoryControllerDialog = PlantSupervisoryControllerDialog;
}
