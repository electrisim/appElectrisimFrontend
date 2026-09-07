/**
 * Park Controller (steady-state) — pandapower plant Q/V/PF/tanφ control.
 * Tabs: Machines | General | Distribution (formatting aligned with transformerBaseDialog).
 */
import { Dialog } from '../Dialog.js';
import { listMachineCandidates } from '../utils/machineQCapabilityPreview.js';

export const PARK_CONTROL_MODES = [
    'Voltage Control',
    'Reactive Power Control',
    'Power Factor Control',
    'tan(phi) Control'
];

export const PARK_DISTRIBUTION_METHODS = [
    'According to Dispatched Active Power',
    'According to Rated Power',
    'According to Q Capability',
    'Individual Reactive Power',
    'Maximise Reactive Reserve',
    'Voltage Setpoint Adaption'
];

export const DEFAULT_PARK_CONTROLLER_NAME = 'ParkController (steady-state)';

export const defaultParkControllerData = {
    name: DEFAULT_PARK_CONTROLLER_NAME,
    enabled: true,
    machines_json: '[]',
    control_mode: 'Voltage Control',
    node_selection: 'User Selection',
    uset_mode: 'bus target voltage',
    controlled_bus: '',
    target_bus: '',
    vm_set_pu: '1.0',
    enable_droop: false,
    q_rated_mvar: '0',
    droop_percent: '4',
    q_measured_at: '',
    q_control_type: 'Const. Q',
    q_set_mvar: '0',
    control_q_at: '',
    qv_characteristic_json: '[]',
    qp_characteristic_json: '[]',
    pf_control_type: 'Const. cosphi',
    cos_phi: '1.0',
    cosphi_p_excitation: 'Overexcited',
    /** Overexcited: min cosφ = 1.0 at P = 7.5 MW */
    cosphi_p_oe_characteristic_json: '[{"p_mw":7.5,"cos_phi":1}]',
    /** Underexcited: min cosφ = 0.95 at P = 15 MW */
    cosphi_p_ue_characteristic_json: '[{"p_mw":15,"cos_phi":0.95}]',
    /** @deprecated kept for older diagrams; prefer OE/UE fields */
    cosphi_p_characteristic_json: '[{"p_mw":7.5,"cos_phi":1}]',
    cosphi_v_characteristic_json: '[]',
    tan_phi: '0',
    distribution_method: 'According to Rated Power',
    consider_q_dispatch: true,
    /** Use each machine's P–Q capability curve (Wind Turbine / SGen Q capability tab) for limits & distribution */
    use_q_capability: true,
    q_change_response: 'same'
};

function attrMap(cellData) {
    const m = {};
    if (!cellData?.attributes) return m;
    for (let i = 0; i < cellData.attributes.length; i++) {
        m[cellData.attributes[i].name] = cellData.attributes[i].value;
    }
    return m;
}

function parseJsonArray(raw, fallback = []) {
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
        return Array.isArray(v) ? v : fallback;
    } catch {
        return fallback;
    }
}

/** Read one cosφ(P) point from stored JSON (supports legacy multi-point curves). */
function cosphiPPointFromJson(raw, fallbackCos, fallbackP, prefer = 'first') {
    const pts = parseJsonArray(raw).filter((p) => p && typeof p === 'object');
    if (!pts.length) return { cos_phi: fallbackCos, p_mw: fallbackP };
    const pt = prefer === 'last' ? pts[pts.length - 1] : pts[0];
    const cos = Number(pt.cos_phi);
    const p = Number(pt.p_mw);
    return {
        cos_phi: Number.isFinite(cos) ? cos : fallbackCos,
        p_mw: Number.isFinite(p) ? p : fallbackP
    };
}

function cosphiPPointToJson(cosPhi, pMw) {
    const cos = Number(cosPhi);
    const p = Number(pMw);
    if (!Number.isFinite(cos) || !Number.isFinite(p)) return '[]';
    return JSON.stringify([{ p_mw: p, cos_phi: cos }]);
}

function machineQBand(m) {
    const qMin = Number(m?.q_min_mvar);
    const qMax = Number(m?.q_max_mvar);
    if (Number.isFinite(qMin) && Number.isFinite(qMax)) return Math.max(0, qMax - qMin);
    return null;
}

function listBusNames(graph) {
    const names = [];
    if (!graph?.getModel) return names;
    for (const cell of graph.getModel().getDescendants?.() || []) {
        const style = cell.getStyle?.() || '';
        if (!style.includes('shapeELXXX=Bus') && !style.includes('shapeELXXX=Busbar')) continue;
        let name = cell.value?.getAttribute?.('name');
        if (!name) name = (cell.mxObjectId || cell.id || '').toString().replace('#', '_');
        if (name) names.push(name);
    }
    return [...new Set(names)].sort();
}

function listLineTrafoNames(graph) {
    const names = [];
    if (!graph?.getModel) return names;
    for (const cell of graph.getModel().getDescendants?.() || []) {
        const style = cell.getStyle?.() || '';
        const m = style.match(/shapeELXXX=([^;]+)/);
        if (!m) continue;
        if (m[1] !== 'Line' && m[1] !== 'Transformer' && m[1] !== 'Three Winding Transformer') continue;
        let name = cell.value?.getAttribute?.('name');
        if (!name) name = (cell.mxObjectId || cell.id || '').toString().replace('#', '_');
        if (name) names.push(name);
    }
    return names.sort();
}

/** Boundary candidates for Control Q at: busbars first, then lines/transformers. */
function listControlQAtNames(graph) {
    const buses = listBusNames(graph);
    const branches = listLineTrafoNames(graph);
    const seen = new Set(buses);
    const out = [...buses];
    for (const n of branches) {
        if (!seen.has(n)) {
            seen.add(n);
            out.push(n);
        }
    }
    return out;
}

function styleControl(el, wide = false) {
    // Selects need extra width so labels like "Power Factor Control" / "cosphi(P)-Characteristic" are not clipped.
    const isSelect = el && el.tagName === 'SELECT';
    Object.assign(el.style, {
        width: wide || isSelect ? '100%' : '180px',
        ...(wide || isSelect ? { minWidth: isSelect && !wide ? '260px' : '0' } : {}),
        padding: isSelect ? '10px 36px 10px 14px' : '10px 14px',
        border: '2px solid #ced4da',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'inherit',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
        outline: 'none',
        ...(isSelect
            ? {
                  textOverflow: 'clip',
                  whiteSpace: 'nowrap',
                  overflow: 'visible'
              }
            : {})
    });
    el.addEventListener('focus', () => {
        el.style.borderColor = '#007bff';
        el.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
        el.style.transform = 'translateY(-1px)';
    });
    el.addEventListener('blur', () => {
        el.style.borderColor = '#ced4da';
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0)';
    });
    el.addEventListener('mouseenter', () => {
        if (el !== document.activeElement) {
            el.style.borderColor = '#adb5bd';
            el.style.backgroundColor = '#f8f9fa';
        }
    });
    el.addEventListener('mouseleave', () => {
        if (el !== document.activeElement) {
            el.style.borderColor = '#ced4da';
            el.style.backgroundColor = '#ffffff';
        }
    });
}

export class ParkControllerDialog extends Dialog {
    constructor(editorUi) {
        super('Park Controller (steady-state)', 'Apply');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.data = { ...defaultParkControllerData };
        this.machines = [];
        this.currentTab = 'machines';
        this.inputs = new Map();
    }

    getDescription() {
        return (
            '<strong>Configure Park Controller (steady-state)</strong><br>' +
            'Pandapower-only plant control for linked Wind Turbines / Static Generators / Generators: ' +
            'voltage, reactive power, power factor, or tan(φ) at a bus or boundary. See the ' +
            '<a href="https://electrisim.com/documentation.html#park-controller" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.'
        );
    }

    populateDialog(cellData) {
        const attrs = attrMap(cellData);
        Object.keys(defaultParkControllerData).forEach((k) => {
            if (attrs[k] != null && attrs[k] !== '') this.data[k] = attrs[k];
        });
        if (attrs.enabled != null) {
            this.data.enabled = attrs.enabled === true || attrs.enabled === 'true';
        }
        if (attrs.enable_droop != null) {
            this.data.enable_droop = attrs.enable_droop === true || attrs.enable_droop === 'true';
        }
        if (attrs.consider_q_dispatch != null) {
            this.data.consider_q_dispatch =
                attrs.consider_q_dispatch === true || attrs.consider_q_dispatch === 'true';
        }
        if (attrs.use_q_capability != null) {
            this.data.use_q_capability =
                attrs.use_q_capability === true || attrs.use_q_capability === 'true';
        }
        // Migrate legacy single cosφ(P) curve → Overexcited / Underexcited
        const legacyP = attrs.cosphi_p_characteristic_json;
        const hasLegacy = legacyP != null && String(legacyP).trim() && String(legacyP).trim() !== '[]';
        if (
            hasLegacy &&
            (!attrs.cosphi_p_oe_characteristic_json || String(attrs.cosphi_p_oe_characteristic_json).trim() === '[]')
        ) {
            this.data.cosphi_p_oe_characteristic_json = legacyP;
        }
        if (
            hasLegacy &&
            (!attrs.cosphi_p_ue_characteristic_json || String(attrs.cosphi_p_ue_characteristic_json).trim() === '[]')
        ) {
            this.data.cosphi_p_ue_characteristic_json = legacyP;
        }
        const stored = parseJsonArray(this.data.machines_json);
        this.machines = this._mergeMachineCandidates(listMachineCandidates(this.graph), stored);
        for (const prev of stored) {
            if (!this.machines.some((m) => m.name === prev.name)) {
                this.machines.push({
                    name: prev.name,
                    typ: prev.typ || 'Static Generator',
                    connected: prev.connected !== false,
                    q_percent: Number(prev.q_percent) || 0,
                    has_q_capability: false,
                    q_min_mvar: null,
                    q_max_mvar: null
                });
            }
        }
    }

    _mergeMachineCandidates(candidates, storedRows) {
        const stored = Array.isArray(storedRows) ? storedRows : parseJsonArray(this.data.machines_json);
        const byName = new Map(stored.map((m) => [m.name, m]));
        const live = new Map((this.machines || []).map((m) => [m.name, m]));
        return candidates.map((c) => {
            const prev = byName.get(c.name) || live.get(c.name);
            return {
                name: c.name,
                typ: c.typ,
                connected: prev ? prev.connected !== false : false,
                q_percent: prev?.q_percent != null ? Number(prev.q_percent) : 0,
                sn_mva: c.sn_mva,
                p_mw: c.p_mw,
                has_q_capability: !!c.has_q_capability,
                q_min_mvar: c.q_min_mvar,
                q_max_mvar: c.q_max_mvar
            };
        });
    }

    show(callback, options = {}) {
        this.callback = callback;
        this._stackedOverStudy = Boolean(options && options.stacked);
        this.showTabDialog();
    }

    _closeParkDialog() {
        const stacked = this._stackedOverStudy;
        this.destroy();
        if (!stacked && this.ui && typeof this.ui.hideDialog === 'function') {
            this.ui.hideDialog();
        }
    }

    _mountStackedOverlay(container) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: '10050',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.2)',
            width: 'min(900px, 96vw)',
            height: 'min(calc(100vh - 48px), 920px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '16px 20px',
            boxSizing: 'border-box'
        });
        box.appendChild(container);
        overlay.appendChild(box);
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) {
                e.preventDefault();
                this._closeParkDialog();
            }
        });
        document.body.appendChild(overlay);
        this.modalOverlay = overlay;
    }

    showTabDialog() {
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        if (this.graph) {
            this.machines = this._mergeMachineCandidates(listMachineCandidates(this.graph));
        }

        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
            padding: '0',
            margin: '0',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
        });

        const banner = document.createElement('div');
        Object.assign(banner.style, {
            padding: '6px 10px',
            backgroundColor: '#e3f2fd',
            border: '1px solid #bbdefb',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1565c0',
            marginBottom: '12px'
        });
        banner.innerHTML = this.getDescription();
        container.appendChild(banner);

        const tabBar = document.createElement('div');
        Object.assign(tabBar.style, {
            display: 'flex',
            borderBottom: '2px solid #e9ecef',
            marginBottom: '16px'
        });
        const tabMachines = this.createTab('Machines', 'machines', this.currentTab === 'machines');
        const tabGeneral = this.createTab('General', 'general', this.currentTab === 'general');
        const tabDist = this.createTab('Distribution', 'distribution', this.currentTab === 'distribution');
        tabBar.append(tabMachines, tabGeneral, tabDist);
        container.appendChild(tabBar);

        const scroll = document.createElement('div');
        Object.assign(scroll.style, {
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 auto',
            minHeight: '0',
            scrollbarWidth: 'thin',
            scrollbarColor: '#c1c1c1 #f1f1f1',
            paddingRight: '8px'
        });
        this._scrollHost = scroll;
        container.appendChild(scroll);

        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef'
        });
        const cancel = this.createButton('Cancel', '#6c757d', '#5a6268');
        const apply = this.createButton('Apply', '#007bff', '#0056b3');
        cancel.onclick = (e) => {
            e.preventDefault();
            this._closeParkDialog();
        };
        apply.onclick = (e) => {
            e.preventDefault();
            const values = this.getFormValues();
            if (this.callback) this.callback(values);
            this._closeParkDialog();
        };
        footer.append(cancel, apply);
        container.appendChild(footer);

        this.container = container;
        this._tabs = [tabMachines, tabGeneral, tabDist];
        tabMachines.onclick = () => this.switchTab('machines', tabMachines);
        tabGeneral.onclick = () => this.switchTab('general', tabGeneral);
        tabDist.onclick = () => this.switchTab('distribution', tabDist);

        if (this._stackedOverStudy) {
            this._mountStackedOverlay(container);
        } else if (this.ui && typeof this.ui.showDialog === 'function') {
            const h = window.innerHeight - 80;
            this.ui.showDialog(container, 900, h, true, false);
        } else {
            this.showModalFallback(container);
        }

        this._renderCurrentTab();
    }

    createTab(label, key, active) {
        const tab = document.createElement('div');
        Object.assign(tab.style, {
            padding: '12px 20px',
            cursor: 'pointer',
            borderBottom: active ? '2px solid #007bff' : '2px solid transparent',
            backgroundColor: active ? '#f8f9fa' : 'transparent',
            color: active ? '#007bff' : '#333',
            fontWeight: active ? '600' : '400',
            transition: 'all 0.2s ease'
        });
        tab.textContent = label;
        tab.setAttribute('data-tab', key);
        tab.addEventListener('mouseenter', () => {
            if (this.currentTab !== key) {
                tab.style.backgroundColor = '#f8f9fa';
                tab.style.color = '#007bff';
            }
        });
        tab.addEventListener('mouseleave', () => {
            if (this.currentTab !== key) {
                tab.style.backgroundColor = 'transparent';
                tab.style.color = '#333';
            }
        });
        return tab;
    }

    createButton(label, bg, hover) {
        const btn = document.createElement('button');
        btn.textContent = label;
        Object.assign(btn.style, {
            padding: '8px 16px',
            backgroundColor: bg,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = hover;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = bg;
        });
        return btn;
    }

    switchTab(key, activeTab) {
        this._syncDataFromInputs();
        this.currentTab = key;
        this._tabs.forEach((t) => {
            const on = t === activeTab;
            t.style.borderBottom = on ? '2px solid #007bff' : '2px solid transparent';
            t.style.backgroundColor = on ? '#f8f9fa' : 'transparent';
            t.style.color = on ? '#007bff' : '#333';
            t.style.fontWeight = on ? '600' : '400';
        });
        this._renderCurrentTab();
    }

    _syncDataFromInputs() {
        this.inputs.forEach((el, id) => {
            if (el.type === 'checkbox') this.data[id] = el.checked;
            else this.data[id] = el.value;
        });
    }

    _renderCurrentTab() {
        const host = this._scrollHost;
        if (!host) return;
        host.innerHTML = '';
        // Keep name/enabled across tabs; re-register only fields for current view
        const keep = new Map();
        ['name', 'enabled'].forEach((k) => {
            if (this.inputs.has(k)) keep.set(k, this.inputs.get(k));
        });
        this.inputs = keep;

        if (this.currentTab === 'machines') this._renderMachines(host);
        else if (this.currentTab === 'general') this._renderGeneral(host);
        else this._renderDistribution(host);
    }

    _paramCard(label, description, controlEl, { wide = false } = {}) {
        const isSelect = controlEl && controlEl.tagName === 'SELECT';
        const useWide = wide || isSelect;
        const card = document.createElement('div');
        Object.assign(card.style, {
            display: 'grid',
            gridTemplateColumns: useWide
                ? 'minmax(0,1fr) minmax(280px,1.2fr)'
                : '1fr 200px',
            gap: '20px',
            alignItems: 'start',
            padding: '16px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            minHeight: '80px'
        });
        const left = document.createElement('div');
        Object.assign(left.style, {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '60px'
        });
        const lab = document.createElement('label');
        Object.assign(lab.style, {
            fontWeight: '600',
            fontSize: '14px',
            color: '#495057',
            marginBottom: '6px',
            lineHeight: '1.2'
        });
        lab.textContent = label;
        left.appendChild(lab);
        if (description) {
            const desc = document.createElement('div');
            Object.assign(desc.style, {
                fontSize: '12px',
                color: '#6c757d',
                lineHeight: '1.4',
                fontStyle: 'italic',
                marginBottom: '4px'
            });
            desc.textContent = description;
            left.appendChild(desc);
        }
        const right = document.createElement('div');
        Object.assign(right.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            minHeight: '60px',
            width: useWide ? '100%' : '200px',
            ...(useWide ? { minWidth: '0' } : {})
        });
        right.appendChild(controlEl);
        card.append(left, right);
        return card;
    }

    _textInput(id, value, wide = false) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.value = value ?? '';
        styleControl(input, wide);
        this.inputs.set(id, input);
        return input;
    }

    _numberInput(id, value, step = '0.1') {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.step = step;
        input.value = value ?? '';
        styleControl(input, false);
        this.inputs.set(id, input);
        return input;
    }

    _checkboxInput(id, checked) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = Boolean(checked);
        Object.assign(input.style, {
            width: '24px',
            height: '24px',
            accentColor: '#007bff',
            cursor: 'pointer',
            margin: '0'
        });
        this.inputs.set(id, input);
        return input;
    }

    _selectInput(id, value, options, onChange, wide = false) {
        const sel = document.createElement('select');
        sel.id = id;
        options.forEach((o) => {
            const opt = document.createElement('option');
            if (o && typeof o === 'object') {
                opt.value = o.value;
                opt.textContent = o.label;
                if (o.value === value) opt.selected = true;
            } else {
                opt.value = o;
                opt.textContent = o;
                if (o === value) opt.selected = true;
            }
            sel.appendChild(opt);
        });
        styleControl(sel, wide);
        if (onChange) sel.onchange = onChange;
        this.inputs.set(id, sel);
        return sel;
    }

    _namedSelectInput(id, value, names, wide = false) {
        const sel = document.createElement('select');
        sel.id = id;
        const none = document.createElement('option');
        none.value = '';
        none.textContent = '(none)';
        if (!value) none.selected = true;
        sel.appendChild(none);
        names.forEach((n) => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            if (n === value) opt.selected = true;
            sel.appendChild(opt);
        });
        styleControl(sel, wide);
        this.inputs.set(id, sel);
        return sel;
    }

    _textareaInput(id, value) {
        const ta = document.createElement('textarea');
        ta.id = id;
        ta.rows = 4;
        ta.value = value || '[]';
        styleControl(ta, true);
        ta.style.fontFamily = 'monospace';
        ta.style.fontSize = '12px';
        ta.style.minHeight = '90px';
        this.inputs.set(id, ta);
        return ta;
    }

    _compactNumberInput(id, value, step = '0.01', width = '80px') {
        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.step = step;
        input.value = value ?? '';
        Object.assign(input.style, {
            width,
            padding: '8px 10px',
            border: '2px solid #ced4da',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'inherit',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            outline: 'none'
        });
        this.inputs.set(id, input);
        return input;
    }

    _cosphiPBranchPanel(branchLabel, cosPhiId, pMwId, cosPhi, pMw) {
        const panel = document.createElement('div');
        Object.assign(panel.style, {
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            padding: '12px 16px',
            backgroundColor: '#ffffff'
        });
        const head = document.createElement('div');
        Object.assign(head.style, {
            fontWeight: '600',
            fontSize: '14px',
            color: '#495057',
            marginBottom: '10px'
        });
        head.textContent = branchLabel;

        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#495057'
        });
        const mkText = (text) => {
            const span = document.createElement('span');
            span.textContent = text;
            return span;
        };
        row.append(
            mkText('Min. power factor'),
            this._compactNumberInput(cosPhiId, cosPhi, '0.01'),
            mkText('at'),
            mkText('Active power'),
            this._compactNumberInput(pMwId, pMw, '0.1'),
            mkText('MW')
        );
        panel.append(head, row);
        return panel;
    }

    _cosphiPCharacteristicSection() {
        const oe = cosphiPPointFromJson(this.data.cosphi_p_oe_characteristic_json, 1, 7.5, 'first');
        const ue = cosphiPPointFromJson(this.data.cosphi_p_ue_characteristic_json, 0.95, 15, 'last');

        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            padding: '16px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        });
        const title = document.createElement('div');
        Object.assign(title.style, {
            fontWeight: '600',
            fontSize: '14px',
            color: '#495057',
            marginBottom: '4px'
        });
        title.textContent = 'cosphi(P)-Characteristic';
        wrap.appendChild(title);
        wrap.appendChild(
            this._cosphiPBranchPanel(
                'Overexcited (capacitive)',
                'cosphi_p_oe_cos_phi',
                'cosphi_p_oe_p_mw',
                oe.cos_phi,
                oe.p_mw
            )
        );
        wrap.appendChild(
            this._cosphiPBranchPanel(
                'Underexcited (inductive)',
                'cosphi_p_ue_cos_phi',
                'cosphi_p_ue_p_mw',
                ue.cos_phi,
                ue.p_mw
            )
        );
        return wrap;
    }

    _formColumn() {
        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });
        return form;
    }

    _renderMachines(host) {
        const form = this._formColumn();
        form.appendChild(
            this._paramCard(
                'Name',
                'Name identifier for the park controller (shown on the diagram).',
                this._textInput('name', this.data.name, true),
                { wide: true }
            )
        );
        form.appendChild(
            this._paramCard(
                'Enabled',
                'When enabled, the controller is attached during pandapower load flow.',
                this._checkboxInput('enabled', this.data.enabled !== false)
            )
        );

        const tableCard = document.createElement('div');
        Object.assign(tableCard.style, {
            padding: '16px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px'
        });
        const title = document.createElement('div');
        Object.assign(title.style, {
            fontWeight: '600',
            fontSize: '14px',
            color: '#495057',
            marginBottom: '6px'
        });
        title.textContent = 'Connected machines';
        const desc = document.createElement('div');
        Object.assign(desc.style, {
            fontSize: '12px',
            color: '#6c757d',
            fontStyle: 'italic',
            marginBottom: '12px'
        });
        desc.textContent =
            'Select Wind Turbines, Static Generators, or Generators controlled by this park controller. ' +
            'Q at P shows limits from each machine’s Q capability tab (P–Q curve) at its current P.';
        tableCard.append(title, desc);

        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:6px;overflow:hidden;';
        table.innerHTML =
            '<thead><tr style="background:#e9ecef;">' +
            '<th style="text-align:left;padding:10px 12px;">Connected</th>' +
            '<th style="text-align:left;padding:10px 12px;">Machine</th>' +
            '<th style="text-align:left;padding:10px 12px;">Type</th>' +
            '<th style="text-align:left;padding:10px 12px;">Q at P [Mvar]</th>' +
            '</tr></thead>';
        const tbody = document.createElement('tbody');
        this.machines.forEach((m, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e9ecef';
            const tdC = document.createElement('td');
            tdC.style.padding = '10px 12px';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!m.connected;
            Object.assign(cb.style, { width: '20px', height: '20px', accentColor: '#007bff', cursor: 'pointer' });
            cb.onchange = () => {
                this.machines[idx].connected = cb.checked;
                this._redistributePercents();
            };
            tdC.appendChild(cb);
            const tdN = document.createElement('td');
            tdN.style.padding = '10px 12px';
            tdN.textContent = m.name;
            const tdT = document.createElement('td');
            tdT.style.padding = '10px 12px';
            tdT.style.color = '#6c757d';
            tdT.textContent = m.typ;
            const tdQ = document.createElement('td');
            tdQ.style.padding = '10px 12px';
            tdQ.style.color = '#6c757d';
            tdQ.style.fontFamily = 'ui-monospace, Consolas, monospace';
            tdQ.style.fontSize = '12px';
            if (Number.isFinite(Number(m.q_min_mvar)) && Number.isFinite(Number(m.q_max_mvar))) {
                tdQ.textContent = `${Number(m.q_min_mvar).toFixed(2)} … ${Number(m.q_max_mvar).toFixed(2)}`;
                const pNote = Number.isFinite(Number(m.p_mw)) ? ` at P = ${Number(m.p_mw).toFixed(3)} MW` : '';
                tdQ.title = `From machine Q capability${pNote}, U = 1.0 p.u.`;
            } else {
                tdQ.textContent = '—';
                tdQ.title = 'Enable Q capability curve on the machine dialog';
            }
            tr.append(tdC, tdN, tdT, tdQ);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableCard.appendChild(table);
        if (!this.machines.length) {
            const empty = document.createElement('p');
            empty.style.cssText = 'margin:12px 0 0;color:#adb5bd;font-size:13px;';
            empty.textContent = 'No Wind Turbine / Static Generator / Generator found on the diagram.';
            tableCard.appendChild(empty);
        }
        form.appendChild(tableCard);
        host.appendChild(form);
    }

    _renderGeneral(host) {
        const form = this._formColumn();
        form.appendChild(
            this._paramCard(
                'Name',
                'Name identifier for the park controller (shown on the diagram).',
                this._textInput('name', this.data.name, true),
                { wide: true }
            )
        );
        form.appendChild(
            this._paramCard(
                'Enabled',
                'When enabled, the controller is attached during pandapower load flow.',
                this._checkboxInput('enabled', this.data.enabled !== false)
            )
        );

        form.appendChild(
            this._paramCard(
                'Control Mode',
                'Plant-level control objective: voltage, Q, power factor, or tan(φ).',
                this._selectInput('control_mode', this.data.control_mode, PARK_CONTROL_MODES, () => {
                    this._syncDataFromInputs();
                    this._renderCurrentTab();
                })
            )
        );

        const mode = this.inputs.get('control_mode')?.value || this.data.control_mode;

        if (mode === 'Voltage Control') {
            form.appendChild(
                this._paramCard(
                    'Node selection',
                    'User Selection picks the controlled bus by name; Automatic Selection uses the highest-voltage machine bus.',
                    this._selectInput('node_selection', this.data.node_selection, [
                        'User Selection',
                        'Automatic Selection'
                    ])
                )
            );
            form.appendChild(
                this._paramCard(
                    'Setpoint',
                    'Use Station Controller voltage setpoint or the bus target voltage.',
                    this._selectInput('uset_mode', this.data.uset_mode, [
                        'Station Controller',
                        'bus target voltage'
                    ])
                )
            );
            form.appendChild(
                this._paramCard(
                    'Controlled Node',
                    'Bus whose voltage is held by the park controller.',
                    this._namedSelectInput('controlled_bus', this.data.controlled_bus, listBusNames(this.graph))
                )
            );
            form.appendChild(
                this._paramCard(
                    'Target Node',
                    'Optional target bus reference for setpoint mode.',
                    this._namedSelectInput('target_bus', this.data.target_bus, listBusNames(this.graph))
                )
            );
            form.appendChild(
                this._paramCard(
                    'Voltage setpoint [p.u.]',
                    'Voltage magnitude setpoint in per unit.',
                    this._numberInput('vm_set_pu', this.data.vm_set_pu, '0.01')
                )
            );
            const droopCb = this._checkboxInput('enable_droop', !!this.data.enable_droop);
            droopCb.onchange = () => {
                this._syncDataFromInputs();
                this._renderCurrentTab();
            };
            form.appendChild(
                this._paramCard(
                    'Enable droop',
                    'Chain DroopControl onto BinarySearchControl (Q-V droop).',
                    droopCb
                )
            );
            if (this.inputs.get('enable_droop')?.checked ?? this.data.enable_droop) {
                form.appendChild(
                    this._paramCard(
                        'Rated reactive power [Mvar]',
                        'Qrated used with droop percent to size the droop characteristic.',
                        this._numberInput('q_rated_mvar', this.data.q_rated_mvar, '0.1')
                    )
                );
                form.appendChild(
                    this._paramCard(
                        'Droop [%]',
                        'Voltage droop in percent of rated reactive power.',
                        this._numberInput('droop_percent', this.data.droop_percent, '0.1')
                    )
                );
                form.appendChild(
                    this._paramCard(
                        'Q measured at (line/trafo)',
                        'Optional boundary element name where Q is measured for droop.',
                        this._namedSelectInput(
                            'q_measured_at',
                            this.data.q_measured_at,
                            listLineTrafoNames(this.graph)
                        )
                    )
                );
            }
            const note = document.createElement('div');
            Object.assign(note.style, {
                padding: '12px 16px',
                backgroundColor: '#fff8e1',
                border: '1px solid #ffe082',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#6d4c41'
            });
            note.textContent = 'Balanced load flow uses positive-sequence voltage only.';
            form.appendChild(note);
        } else if (mode === 'Reactive Power Control') {
            form.appendChild(
                this._paramCard(
                    'Q-Control',
                    'Constant Q or characteristic Q(V) / Q(P).',
                    this._selectInput(
                        'q_control_type',
                        this.data.q_control_type,
                        ['Const. Q', 'Q(V)-Characteristic', 'Q(P)-Characteristic'],
                        () => {
                            this._syncDataFromInputs();
                            this._renderCurrentTab();
                        }
                    )
                )
            );
            form.appendChild(
                this._paramCard(
                    'Control Q at (bus/line/trafo)',
                    'Busbar, line, or transformer where reactive power is controlled.',
                    this._namedSelectInput('control_q_at', this.data.control_q_at, listControlQAtNames(this.graph))
                )
            );
            const qType = this.inputs.get('q_control_type')?.value || this.data.q_control_type;
            if (qType === 'Const. Q') {
                form.appendChild(
                    this._paramCard(
                        'Q setpoint [Mvar]',
                        'Constant reactive power setpoint at the boundary.',
                        this._numberInput('q_set_mvar', this.data.q_set_mvar, '0.1')
                    )
                );
            } else if (qType === 'Q(V)-Characteristic') {
                form.appendChild(
                    this._paramCard(
                        'Q(V) characteristic JSON',
                        'Points as [{vm_pu, q_mvar}, …]. Setpoint is interpolated from measured voltage.',
                        this._textareaInput('qv_characteristic_json', this.data.qv_characteristic_json),
                        { wide: true }
                    )
                );
            } else {
                form.appendChild(
                    this._paramCard(
                        'Q(P) characteristic JSON',
                        'Points as [{p_mw, q_mvar}, …]. Setpoint is interpolated from measured P.',
                        this._textareaInput('qp_characteristic_json', this.data.qp_characteristic_json),
                        { wide: true }
                    )
                );
            }
        } else if (mode === 'Power Factor Control') {
            form.appendChild(
                this._paramCard(
                    'PF-Control',
                    'Constant cosφ or characteristic cosφ(P) / cosφ(V).',
                    this._selectInput(
                        'pf_control_type',
                        this.data.pf_control_type,
                        ['Const. cosphi', 'cosphi(P)-Characteristic', 'cosphi(V)-Characteristic'],
                        () => {
                            this._syncDataFromInputs();
                            this._renderCurrentTab();
                        }
                    )
                )
            );
            form.appendChild(
                this._paramCard(
                    'Control Q at (bus/line/trafo)',
                    'Busbar, line, or transformer where Q is derived from the power-factor target.',
                    this._namedSelectInput('control_q_at', this.data.control_q_at, listControlQAtNames(this.graph))
                )
            );
            const pfType = this.inputs.get('pf_control_type')?.value || this.data.pf_control_type;
            if (pfType === 'Const. cosphi') {
                form.appendChild(
                    this._paramCard(
                        'cos(φ)',
                        'Constant power factor (signed cosφ).',
                        this._numberInput('cos_phi', this.data.cos_phi, '0.01')
                    )
                );
            } else if (pfType === 'cosphi(P)-Characteristic') {
                form.appendChild(
                    this._paramCard(
                        'Excitation branch',
                        'Which cosφ(P) curve to use. Auto picks Overexcited (capacitive, injects Q) when measured Q ≥ 0 at Control Q at, otherwise Underexcited (inductive, absorbs Q).',
                        this._selectInput('cosphi_p_excitation', this.data.cosphi_p_excitation || 'Overexcited', [
                            { value: 'Overexcited', label: 'Overexcited (capacitive)' },
                            { value: 'Underexcited', label: 'Underexcited (inductive)' },
                            { value: 'Auto (by Q sign)', label: 'Auto (by Q sign)' }
                        ])
                    )
                );
                form.appendChild(this._cosphiPCharacteristicSection());
            } else {
                form.appendChild(
                    this._paramCard(
                        'cosφ(V) characteristic JSON',
                        'Points as [{vm_pu, cos_phi}, …].',
                        this._textareaInput(
                            'cosphi_v_characteristic_json',
                            this.data.cosphi_v_characteristic_json
                        ),
                        { wide: true }
                    )
                );
            }
        } else {
            form.appendChild(
                this._paramCard(
                    'Control Q at (bus/line/trafo)',
                    'Busbar, line, or transformer where Q = P × tan(φ).',
                    this._namedSelectInput('control_q_at', this.data.control_q_at, listControlQAtNames(this.graph))
                )
            );
            form.appendChild(
                this._paramCard(
                    'tan(φ)',
                    'Constant tan(φ) for reactive power from measured active power.',
                    this._numberInput('tan_phi', this.data.tan_phi, '0.01')
                )
            );
        }

        form.appendChild(
            this._paramCard(
                'Q change response (at Q limit)',
                'How remaining machines respond when one reaches a Q limit: same or opposite direction.',
                this._selectInput('q_change_response', this.data.q_change_response, ['same', 'opposite'])
            )
        );

        host.appendChild(form);
    }

    _renderDistribution(host) {
        const form = this._formColumn();
        form.appendChild(
            this._paramCard(
                'Name',
                'Name identifier for the park controller (shown on the diagram).',
                this._textInput('name', this.data.name, true),
                { wide: true }
            )
        );
        form.appendChild(
            this._paramCard(
                'Reactive power distribution',
                'How plant Q is shared among connected machines.',
                this._selectInput(
                    'distribution_method',
                    this.data.distribution_method,
                    PARK_DISTRIBUTION_METHODS,
                    () => {
                        this._syncDataFromInputs();
                        this._redistributePercents();
                        this._renderCurrentTab();
                    },
                    true
                ),
                { wide: true }
            )
        );
        form.appendChild(
            this._paramCard(
                'Consider reactive power dispatch',
                'When enabled, distribution percentages are applied to the park Q setpoint.',
                this._checkboxInput('consider_q_dispatch', this.data.consider_q_dispatch !== false)
            )
        );
        form.appendChild(
            this._paramCard(
                'Use machine P–Q capability curves',
                'When enabled, each connected Wind Turbine / Static Generator Q capability tab (P–Q curve) ' +
                    'limits park Q (clamp plant setpoint + enforce min/max Q at current P). ' +
                    'Also used by “According to Q Capability” and “Maximise Reactive Reserve” distribution.',
                this._checkboxInput(
                    'use_q_capability',
                    this.data.use_q_capability !== false && this.data.use_q_capability !== 'false'
                ),
                { wide: true }
            )
        );
        this._redistributePercents();

        const tableCard = document.createElement('div');
        Object.assign(tableCard.style, {
            padding: '16px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px'
        });
        const title = document.createElement('div');
        Object.assign(title.style, {
            fontWeight: '600',
            fontSize: '14px',
            color: '#495057',
            marginBottom: '6px'
        });
        title.textContent = 'Per-machine Q share';
        const desc = document.createElement('div');
        Object.assign(desc.style, {
            fontSize: '12px',
            color: '#6c757d',
            fontStyle: 'italic',
            marginBottom: '12px'
        });
        desc.textContent =
            'Percentages are auto-filled from the distribution method. Edit only when Individual Reactive Power is selected. ' +
            'Q at P is from each machine’s Q capability curve.';
        tableCard.append(title, desc);

        const table = document.createElement('table');
        table.style.cssText =
            'width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:6px;overflow:hidden;';
        table.innerHTML =
            '<thead><tr style="background:#e9ecef;">' +
            '<th style="text-align:left;padding:10px 12px;">#</th>' +
            '<th style="text-align:left;padding:10px 12px;">Machine</th>' +
            '<th style="text-align:left;padding:10px 12px;">Q at P [Mvar]</th>' +
            '<th style="text-align:left;padding:10px 12px;">Q share %</th>' +
            '</tr></thead>';
        const tbody = document.createElement('tbody');
        const connected = this.machines.filter((m) => m.connected);
        connected.forEach((m, i) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e9ecef';
            const tdI = document.createElement('td');
            tdI.style.padding = '10px 12px';
            tdI.textContent = String(i + 1);
            const tdN = document.createElement('td');
            tdN.style.padding = '10px 12px';
            tdN.textContent = m.name;
            const tdCap = document.createElement('td');
            tdCap.style.padding = '10px 12px';
            tdCap.style.fontFamily = 'ui-monospace, Consolas, monospace';
            tdCap.style.fontSize = '12px';
            tdCap.style.color = '#6c757d';
            if (Number.isFinite(Number(m.q_min_mvar)) && Number.isFinite(Number(m.q_max_mvar))) {
                tdCap.textContent = `${Number(m.q_min_mvar).toFixed(2)} … ${Number(m.q_max_mvar).toFixed(2)}`;
            } else {
                tdCap.textContent = '—';
            }
            const tdP = document.createElement('td');
            tdP.style.padding = '10px 12px';
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.step = '0.01';
            inp.value = String(m.q_percent != null ? m.q_percent : 0);
            Object.assign(inp.style, {
                width: '100%',
                maxWidth: '120px',
                padding: '6px 8px',
                border: '1px solid #ced4da',
                borderRadius: '4px'
            });
            const method =
                this.inputs.get('distribution_method')?.value || this.data.distribution_method;
            inp.disabled = method !== 'Individual Reactive Power';
            inp.onchange = () => {
                const idx = this.machines.findIndex((x) => x.name === m.name);
                if (idx >= 0) this.machines[idx].q_percent = Number(inp.value) || 0;
            };
            tdP.appendChild(inp);
            tr.append(tdI, tdN, tdCap, tdP);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableCard.appendChild(table);
        if (!connected.length) {
            const empty = document.createElement('p');
            empty.style.cssText = 'margin:12px 0 0;color:#adb5bd;font-size:13px;';
            empty.textContent = 'Connect machines on the Machines tab first.';
            tableCard.appendChild(empty);
        }
        form.appendChild(tableCard);
        host.appendChild(form);
    }

    _redistributePercents() {
        const method =
            this.inputs.get('distribution_method')?.value || this.data.distribution_method;
        const connected = this.machines.filter((m) => m.connected);
        if (!connected.length) return;
        if (method === 'Individual Reactive Power') return;
        let weights;
        if (method === 'According to Dispatched Active Power') {
            weights = connected.map((m) => Math.abs(Number(m.p_mw)) || 0);
        } else if (method === 'According to Rated Power') {
            weights = connected.map((m) => Math.abs(Number(m.sn_mva)) || 0);
        } else if (method === 'According to Q Capability') {
            weights = connected.map((m) => {
                const band = machineQBand(m);
                return band != null && band > 0 ? band : 1;
            });
        } else if (method === 'Maximise Reactive Reserve') {
            weights = connected.map((m) => {
                const band = machineQBand(m);
                return band != null && band > 0 ? band : 1;
            });
        } else {
            weights = connected.map(() => 1);
        }
        const sum = weights.reduce((a, b) => a + b, 0) || connected.length;
        const useEqual = sum <= 0;
        connected.forEach((m, i) => {
            const w = useEqual ? 1 : weights[i];
            const pct = (100 * (useEqual ? 1 : w)) / (useEqual ? connected.length : sum);
            const idx = this.machines.findIndex((x) => x.name === m.name);
            if (idx >= 0) this.machines[idx].q_percent = Math.round(pct * 1e5) / 1e5;
        });
    }

    getFormValues() {
        this._syncDataFromInputs();
        const get = (id, fallback) => {
            const el = this.inputs.get(id);
            if (el) {
                if (el.type === 'checkbox') return el.checked;
                return el.value;
            }
            return this.data[id] != null ? this.data[id] : fallback;
        };
        this._redistributePercents();
        const oeFallback = cosphiPPointFromJson(
            this.data.cosphi_p_oe_characteristic_json,
            1,
            7.5,
            'first'
        );
        const ueFallback = cosphiPPointFromJson(
            this.data.cosphi_p_ue_characteristic_json,
            0.95,
            15,
            'last'
        );
        return {
            name: get('name', DEFAULT_PARK_CONTROLLER_NAME),
            enabled: get('enabled', true),
            machines_json: JSON.stringify(
                this.machines.map(({ name, typ, connected, q_percent }) => ({
                    name,
                    typ,
                    connected: !!connected,
                    q_percent: Number(q_percent) || 0
                }))
            ),
            control_mode: get('control_mode', 'Voltage Control'),
            node_selection: get('node_selection', 'User Selection'),
            uset_mode: get('uset_mode', 'bus target voltage'),
            controlled_bus: get('controlled_bus', ''),
            target_bus: get('target_bus', ''),
            vm_set_pu: get('vm_set_pu', '1.0'),
            enable_droop: get('enable_droop', false),
            q_rated_mvar: get('q_rated_mvar', '0'),
            droop_percent: get('droop_percent', '4'),
            q_measured_at: get('q_measured_at', ''),
            q_control_type: get('q_control_type', 'Const. Q'),
            q_set_mvar: get('q_set_mvar', '0'),
            control_q_at: get('control_q_at', ''),
            qv_characteristic_json: get('qv_characteristic_json', '[]'),
            qp_characteristic_json: get('qp_characteristic_json', '[]'),
            pf_control_type: get('pf_control_type', 'Const. cosphi'),
            cos_phi: get('cos_phi', '1.0'),
            cosphi_p_excitation: get('cosphi_p_excitation', 'Overexcited'),
            cosphi_p_oe_characteristic_json: cosphiPPointToJson(
                get('cosphi_p_oe_cos_phi', String(oeFallback.cos_phi)),
                get('cosphi_p_oe_p_mw', String(oeFallback.p_mw))
            ),
            cosphi_p_ue_characteristic_json: cosphiPPointToJson(
                get('cosphi_p_ue_cos_phi', String(ueFallback.cos_phi)),
                get('cosphi_p_ue_p_mw', String(ueFallback.p_mw))
            ),
            // Legacy single curve = OE (older backends / diagrams)
            cosphi_p_characteristic_json: cosphiPPointToJson(
                get('cosphi_p_oe_cos_phi', String(oeFallback.cos_phi)),
                get('cosphi_p_oe_p_mw', String(oeFallback.p_mw))
            ),
            cosphi_v_characteristic_json: get('cosphi_v_characteristic_json', '[]'),
            tan_phi: get('tan_phi', '0'),
            distribution_method: get('distribution_method', 'According to Rated Power'),
            consider_q_dispatch: get('consider_q_dispatch', true),
            use_q_capability: get('use_q_capability', true),
            q_change_response: get('q_change_response', 'same')
        };
    }

    destroy() {
        super.destroy?.();
        if (window._globalDialogShowing) delete window._globalDialogShowing;
    }
}

if (typeof window !== 'undefined') {
    window.ParkControllerDialog = ParkControllerDialog;
}
