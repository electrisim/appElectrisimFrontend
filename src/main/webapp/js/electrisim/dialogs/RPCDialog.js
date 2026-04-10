import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

console.log('RPCDialog.js LOADED');

const GRID_CODE_TEMPLATES = {
    'none': {
        name: '-- Select Grid Code Template --',
        description: '',
        rows: []
    },
    'custom_manual': {
        name: 'Custom (manual table)',
        description: 'Select this when you enter P, Q_min, and Q_max in the table yourself. Required for labeling whenever the table contains data.',
        rows: []
    },
    'entsoe_ppm_inner': {
        name: 'ENTSO-E RfG \u2013 PPM Inner Envelope (EU minimum)',
        description: 'EU Reg. 2016/631 Art. 21 \u2013 minimum Q capability for Power Park Modules (wind/solar). cos\u03C6 = 0.95 both directions at P \u2265 0.2\u00B7Pmax.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.033 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.3287 }
        ]
    },
    'entsoe_ppm_outer': {
        name: 'ENTSO-E RfG \u2013 PPM Outer Envelope (max TSO range)',
        description: 'EU Reg. 2016/631 Art. 21 \u2013 maximum Q range a TSO may require for PPMs. Overexcited cos\u03C6 = 0.925, underexcited cos\u03C6 = 0.95.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.041 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.4108 }
        ]
    },
    'vde_4120_v2': {
        name: 'VDE AR-N 4120 Var. 2 (Germany HV, \u2265110 kV)',
        description: 'German HV grid connection rules for generating plants. cos\u03C6 = 0.925 overexcited, cos\u03C6 = 0.95 underexcited at P \u2265 0.2\u00B7Pmax.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.041 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.4108 }
        ]
    },
    'vde_4110': {
        name: 'VDE AR-N 4110 (Germany MV)',
        description: 'German MV grid connection rules for generating plants. cos\u03C6 = 0.95 both directions at P \u2265 0.2\u00B7Pmax.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.033 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.3287 }
        ]
    },
    'polish_iriesp_type_d': {
        name: 'Polish Grid Code IRiESP \u2013 Type D (\u2265110 kV)',
        description: 'PSE (Polskie Sieci Elektroenergetyczne) requirements for Type D generating modules at 110 kV and above. cos\u03C6 = 0.9 overexcited, cos\u03C6 = 0.95 underexcited at rated power.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.048 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.4843 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.4843 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.4843 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.4843 }
        ]
    },
    'polish_iriesp_ppm': {
        name: 'Polish Grid Code IRiESP \u2013 PPM / Wind Farms',
        description: 'PSE requirements for Power Park Modules (wind/solar) at the PCC. cos\u03C6 = 0.925 overexcited, cos\u03C6 = 0.95 underexcited at P \u2265 0.2\u00B7Pmax.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.041 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.4108 }
        ]
    },
    'gb_grid_code': {
        name: 'GB Grid Code (UK, National Grid ESO)',
        description: 'National Grid ESO requirements for large power stations. cos\u03C6 = 0.95 underexcited, cos\u03C6 = 0.85 overexcited (lagging) at rated power.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.12, q_min_pu: -0.039,   q_max_pu: 0.074 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.6197 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.6197 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.6197 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.6197 }
        ]
    },
    'spanish_po122': {
        name: 'Spanish Grid Code P.O. 12.2 (REE)',
        description: 'REE requirements for wind farms at the connection point. cos\u03C6 = 0.95 both directions at rated power.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.033 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.3287 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.3287 }
        ]
    },
    'danish_energinet': {
        name: 'Danish Grid Code (Energinet TF 3.2.5)',
        description: 'Energinet requirements for wind power plants \u2265 25 MW. cos\u03C6 = 0.925 overexcited, cos\u03C6 = 0.95 underexcited at rated power.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.041 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.4108 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.4108 }
        ]
    },
    'italian_terna_a68': {
        name: 'Italian Grid Code (Terna, Allegato A.68)',
        description: 'Terna requirements for generating plants at HV. cos\u03C6 = 0.9 overexcited, cos\u03C6 = 0.95 underexcited at rated power.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.033,   q_max_pu: 0.048 },
            { p_pu: 0.2,  q_min_pu: -0.3287,  q_max_pu: 0.4843 },
            { p_pu: 0.5,  q_min_pu: -0.3287,  q_max_pu: 0.4843 },
            { p_pu: 0.8,  q_min_pu: -0.3287,  q_max_pu: 0.4843 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.4843 }
        ]
    },
    'sagc_ppm': {
        name: 'Saudi Arabian Grid Code (SAGC May 2024) \u2013 Power Park Module',
        description: 'Connection Code \u00A72.5.5.1 \u2014 PPM at connection point: Q within [\u22120.33, +0.33]\u00B7P_rated for P > 20% rated; [\u22120.05, +0.05]\u00B7P_rated for P < 20% (Fig. 2.1). Simplified envelope; verify against official SAGC and connection agreement.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,    q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.05,  q_max_pu: 0.05 },
            { p_pu: 0.2,  q_min_pu: -0.33,  q_max_pu: 0.33 },
            { p_pu: 0.5,  q_min_pu: -0.33,  q_max_pu: 0.33 },
            { p_pu: 0.8,  q_min_pu: -0.33,  q_max_pu: 0.33 },
            { p_pu: 1.0,  q_min_pu: -0.33,  q_max_pu: 0.33 }
        ]
    },
    'sagc_sgu': {
        name: 'Saudi Arabian Grid Code (SAGC May 2024) \u2013 Synchronous Generating Unit',
        description: 'Connection Code \u00A72.5.5.1 \u2014 at rated P: 85% PF lagging to 95% PF leading at unit terminals (Q/P \u2248 +0.62 / \u22120.33 p.u.). Below rated P the table uses a linear ramp to (0,0) for plotting; the code text is explicit at rated output\u2014confirm with TSP.',
        rows: [
            { p_pu: 0.0,  q_min_pu: 0.0,     q_max_pu: 0.0 },
            { p_pu: 0.1,  q_min_pu: -0.0329,  q_max_pu: 0.062 },
            { p_pu: 0.2,  q_min_pu: -0.0657,  q_max_pu: 0.124 },
            { p_pu: 0.5,  q_min_pu: -0.1643,  q_max_pu: 0.3099 },
            { p_pu: 0.8,  q_min_pu: -0.2629,  q_max_pu: 0.4958 },
            { p_pu: 1.0,  q_min_pu: -0.3287,  q_max_pu: 0.6197 }
        ]
    }
};

/**
 * Scale a built-in grid code template to absolute MW/Mvar for RPC request / charts.
 * @param {string} templateKey — key in GRID_CODE_TEMPLATES (not 'none')
 * @param {number} pRatedMw — rated active power base (MW)
 * @returns {{ p: number, qMin: number, qMax: number }[]}
 */
export function getGridTemplateRequirementsMw(templateKey, pRatedMw) {
    const tpl = GRID_CODE_TEMPLATES[templateKey];
    if (!tpl || !tpl.rows || tpl.rows.length === 0 || !(pRatedMw > 0)) {
        return [];
    }
    return tpl.rows.map(r => ({
        p: +(r.p_pu * pRatedMw).toFixed(4),
        qMin: +(r.q_min_pu * pRatedMw).toFixed(4),
        qMax: +(r.q_max_pu * pRatedMw).toFixed(4)
    }));
}

/** Display name for template key (for results UI). */
export function getGridTemplateDisplayName(templateKey) {
    const tpl = GRID_CODE_TEMPLATES[templateKey];
    return tpl && tpl.name ? tpl.name : '';
}

/** Sum S_n / P from static generators (MW) — same base as P Max = 0 “auto” on the backend. */
export function estimateRpcInstalledMw(graph) {
    if (!graph) return 0;
    const model = graph.getModel();
    const cells = model.getDescendants();
    let totalSn = 0;
    cells.forEach(cell => {
        if (!cell || !cell.value) return;
        const style = cell.getStyle();
        if (!style) return;
        if (style.includes('shapeELXXX=Static Generator')) {
            try {
                const snAttr = cell.value.attributes?.getNamedItem('sn_mva');
                const pAttr = cell.value.attributes?.getNamedItem('p_mw');
                const sn = snAttr ? parseFloat(snAttr.nodeValue) : 0;
                const p = pAttr ? parseFloat(pAttr.nodeValue) : 0;
                totalSn += (sn > 0 ? sn : (p > 0 ? p : 0));
            } catch (e) { /* skip */ }
        }
    });
    return totalSn;
}

export class RPCDialog extends Dialog {
    constructor(editorUi) {
        super('Reactive Power Capability Analysis', 'Calculate');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.requirementRows = [];

        this.parameters = [
            {
                id: 'pccBusId',
                label: 'PCC Bus (Point of Common Coupling)',
                type: 'select',
                options: []
            },
            {
                id: 'extGridId',
                label: 'External Grid (voltage source at PCC)',
                type: 'select',
                options: []
            },
            {
                id: 'generatorIds',
                label: 'Wind Farm Generators (Static Generators)',
                type: 'multiselect',
                options: []
            },
            {
                id: 'pMaxMw',
                label: 'P Max (MW) — 0 = auto from installed capacity',
                type: 'number',
                value: '0',
                placeholder: '0'
            },
            {
                id: 'pSteps',
                label: 'Number of P Steps',
                type: 'number',
                value: '10',
                placeholder: '10'
            },
            {
                id: 'voltageLevels',
                label: 'Voltage Levels at PCC (pu, comma-separated)',
                type: 'text',
                value: '0.9, 0.95, 1.0, 1.05, 1.1',
                placeholder: '0.9, 0.95, 1.0, 1.05, 1.1'
            },
            {
                id: 'qCapabilityMode',
                label: 'Q Capability Mode',
                type: 'radio',
                options: [
                    { value: 'from_rating', label: 'From S_n and P (circular capability)', default: true },
                    { value: 'fixed_fraction', label: 'Fixed fraction (0.5 × S_n)' },
                    {
                        value: 'from_sgen_curve',
                        label: 'From static generator P–Q curve (diagram, reactive capability enabled)'
                    }
                ]
            },
            {
                id: 'limitOverloads',
                label: 'Limit Q to avoid branch overloads',
                type: 'checkbox',
                value: false
            },
            {
                id: 'rpc_run_control',
                label: 'Include controller',
                checkboxLabel: 'DiscreteTapControl for transformers with discrete tap control enabled',
                type: 'checkbox',
                value: false
            },
            {
                id: 'maxLoadingPercent',
                label: 'Max Loading (%)',
                type: 'number',
                value: '100',
                placeholder: '100'
            },
            {
                id: 'frequency',
                label: 'Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            }
        ];
    }

    getDescription() {
        return '<strong>Reactive Power Capability (PQ Diagram)</strong><br>' +
            'Sweeps active power of the power plant and determines the reactive power capability envelope at the PCC bus across multiple voltage levels. ' +
            'Optionally compares against grid code requirements. ' +
            'To use manufacturer-style limits per unit, enable <em>Use Q capability curve</em> on each static generator and pick <strong>From static generator P–Q curve</strong> below. ' +
            'Use <strong>Include controller</strong> to run each power flow with pandapower DiscreteTapControl on transformers that have discrete tap control enabled in the diagram.';
    }

    populateOptions() {
        if (!this.graph) return;
        const model = this.graph.getModel();
        const busbars = [];
        const extGrids = [];
        const sgens = [];
        const cellsArray = model.getDescendants();

        cellsArray.forEach(cell => {
            if (!cell || !cell.value) return;
            const style = cell.getStyle();
            if (!style) return;
            const styleParts = style.split(';');
            let componentType = null;
            for (const part of styleParts) {
                if (part.startsWith('shapeELXXX=')) {
                    componentType = part.split('=')[1];
                    break;
                }
            }

            const name = this._getCellName(cell);

            if (componentType === 'Bus' || style.includes('shapeELXXX=Bus') || style.includes('shapeELXXX=Busbar')) {
                busbars.push({ value: cell.getId(), label: name || `Bus ${cell.getId()}` });
            }
            if (componentType === 'External Grid' || style.includes('shapeELXXX=External Grid')) {
                extGrids.push({ value: cell.getId(), label: name || `ExtGrid ${cell.getId()}` });
            }
            if (componentType === 'Static Generator' || style.includes('shapeELXXX=Static Generator')) {
                sgens.push({ value: cell.getId(), label: name || `SGen ${cell.getId()}` });
            }
        });

        const pccParam = this.parameters.find(p => p.id === 'pccBusId');
        if (pccParam) pccParam.options = busbars.length ? busbars : [{ value: '', label: 'No buses found' }];

        const extParam = this.parameters.find(p => p.id === 'extGridId');
        if (extParam) extParam.options = extGrids.length ? extGrids : [{ value: '', label: 'No external grids found' }];

        const genParam = this.parameters.find(p => p.id === 'generatorIds');
        if (genParam) genParam.options = sgens.length ? sgens : [{ value: '', label: 'No static generators found' }];
    }

    _getCellName(cell) {
        try {
            const value = cell.value;
            if (value && value.attributes) {
                const nameAttr = value.attributes.getNamedItem('userFriendlyName') || value.attributes.getNamedItem('name');
                if (nameAttr) return nameAttr.nodeValue;
            }
            return cell.getId();
        } catch (e) {
            return cell.getId();
        }
    }

    _getCellAttrName(cell) {
        try {
            const value = cell.value;
            if (value && value.attributes) {
                const attr = value.attributes.getNamedItem('name');
                if (attr) return attr.nodeValue;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    createSelect(param) {
        const select = document.createElement('select');
        Object.assign(select.style, {
            width: '100%', padding: '8px', border: '1px solid #ced4da',
            borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'
        });
        (param.options || []).forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value || '';
            o.textContent = opt.label || '';
            if (opt.default) o.selected = true;
            select.appendChild(o);
        });
        this.inputs.set(param.id, select);
        return select;
    }

    createMultiSelect(param) {
        const container = document.createElement('div');
        Object.assign(container.style, {
            border: '1px solid #ced4da', borderRadius: '4px', padding: '6px',
            maxHeight: '140px', overflowY: 'auto', backgroundColor: '#fff'
        });
        const checkboxes = [];
        (param.options || []).forEach((opt, i) => {
            const row = document.createElement('label');
            Object.assign(row.style, {
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '3px 0', cursor: 'pointer', fontSize: '13px'
            });
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = opt.value || '';
            cb.checked = true;
            cb.dataset.label = opt.label || '';
            row.appendChild(cb);
            row.appendChild(document.createTextNode(opt.label || ''));
            container.appendChild(row);
            checkboxes.push(cb);
        });
        this.inputs.set(param.id, { _multiCheckboxes: checkboxes });
        return container;
    }

    createRadioGroup(param) {
        const radioContainer = document.createElement('div');
        Object.assign(radioContainer.style, { display: 'flex', flexDirection: 'column', gap: '6px' });
        (param.options || []).forEach((option, index) => {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', gap: '8px' });
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = param.id;
            radio.value = option.value;
            radio.checked = option.default || false;
            radio.id = `${param.id}_${index}`;
            const label = document.createElement('label');
            label.htmlFor = radio.id;
            label.textContent = option.label;
            Object.assign(label.style, { margin: 0, cursor: 'pointer', fontSize: '14px' });
            wrapper.appendChild(radio);
            wrapper.appendChild(label);
            radioContainer.appendChild(wrapper);
            if (option.default) this.inputs.set(param.id, radio);
            radio.onchange = () => this.inputs.set(param.id, radio);
        });
        return radioContainer;
    }

    createCheckbox(param) {
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = param.id;
        cb.checked = param.value || false;
        const label = document.createElement('label');
        label.htmlFor = param.id;
        label.textContent = param.checkboxLabel != null ? param.checkboxLabel : param.label;
        Object.assign(label.style, { fontSize: '13px', color: '#6c757d', cursor: 'pointer' });
        wrapper.appendChild(cb);
        wrapper.appendChild(label);
        this.inputs.set(param.id, cb);
        return wrapper;
    }

    createTextInput(param) {
        const input = document.createElement('input');
        input.type = param.type || 'text';
        input.value = param.value || '';
        if (param.placeholder) input.placeholder = param.placeholder;
        Object.assign(input.style, {
            width: '100%', padding: '8px', border: '1px solid #ced4da',
            borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box'
        });
        this.inputs.set(param.id, input);
        return input;
    }

    _createRequirementsSection() {
        const section = document.createElement('div');
        Object.assign(section.style, { marginTop: '8px' });

        // --- Title ---
        const title = document.createElement('label');
        title.textContent = 'Grid Code Requirements';
        Object.assign(title.style, {
            display: 'block', fontWeight: '600', fontSize: '13px', color: '#495057', marginBottom: '6px'
        });
        section.appendChild(title);

        // --- Template selector row ---
        const templateRow = document.createElement('div');
        Object.assign(templateRow.style, {
            display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px', flexWrap: 'wrap'
        });

        const templateGroup = document.createElement('div');
        Object.assign(templateGroup.style, { flex: '1 1 280px' });
        const templateLabel = document.createElement('label');
        templateLabel.textContent = 'Grid Code Template (required if table has rows)';
        Object.assign(templateLabel.style, { display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '2px' });
        templateGroup.appendChild(templateLabel);

        const templateSelect = document.createElement('select');
        Object.assign(templateSelect.style, {
            width: '100%', padding: '6px 8px', border: '1px solid #ced4da',
            borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box'
        });
        Object.keys(GRID_CODE_TEMPLATES).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = GRID_CODE_TEMPLATES[key].name;
            templateSelect.appendChild(opt);
        });
        templateGroup.appendChild(templateSelect);
        templateRow.appendChild(templateGroup);
        this._templateSelect = templateSelect;

        const pratedGroup = document.createElement('div');
        Object.assign(pratedGroup.style, { flex: '0 0 120px' });
        const pratedLabel = document.createElement('label');
        pratedLabel.textContent = 'P rated (MW)';
        Object.assign(pratedLabel.style, { display: 'block', fontSize: '12px', color: '#6c757d', marginBottom: '2px' });
        pratedGroup.appendChild(pratedLabel);

        this._pRatedInput = document.createElement('input');
        this._pRatedInput.type = 'number';
        this._pRatedInput.step = 'any';
        this._pRatedInput.value = '';
        this._pRatedInput.placeholder = 'auto';
        Object.assign(this._pRatedInput.style, {
            width: '100%', padding: '6px 8px', border: '1px solid #ced4da',
            borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box'
        });
        pratedGroup.appendChild(this._pRatedInput);
        templateRow.appendChild(pratedGroup);

        const applyTemplateBtn = document.createElement('button');
        applyTemplateBtn.type = 'button';
        applyTemplateBtn.textContent = 'Apply';
        Object.assign(applyTemplateBtn.style, {
            padding: '6px 14px', fontSize: '13px', border: '1px solid #28a745',
            borderRadius: '4px', backgroundColor: '#28a745', color: '#fff',
            cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap', alignSelf: 'flex-end'
        });
        applyTemplateBtn.onmouseenter = () => applyTemplateBtn.style.backgroundColor = '#218838';
        applyTemplateBtn.onmouseleave = () => applyTemplateBtn.style.backgroundColor = '#28a745';
        applyTemplateBtn.onclick = () => this._applyTemplate(templateSelect.value);
        templateRow.appendChild(applyTemplateBtn);

        section.appendChild(templateRow);

        // --- Template description ---
        this._templateDescEl = document.createElement('div');
        Object.assign(this._templateDescEl.style, {
            fontSize: '11px', color: '#1565c0', backgroundColor: '#e8f4fd',
            border: '1px solid #bbdefb', borderRadius: '4px', padding: '5px 8px',
            marginBottom: '8px', display: 'none', lineHeight: '1.4'
        });
        section.appendChild(this._templateDescEl);

        // --- Template preview chart ---
        this._previewContainer = document.createElement('div');
        Object.assign(this._previewContainer.style, {
            display: 'none', marginBottom: '10px', border: '1px solid #e9ecef',
            borderRadius: '6px', padding: '8px', backgroundColor: '#fafbfc'
        });
        this._previewCanvas = document.createElement('canvas');
        this._previewCanvas.width = 620;
        this._previewCanvas.height = 260;
        Object.assign(this._previewCanvas.style, { width: '100%', maxHeight: '260px' });
        this._previewContainer.appendChild(this._previewCanvas);
        section.appendChild(this._previewContainer);
        this._previewChart = null;

        templateSelect.onchange = () => {
            const key = templateSelect.value;
            const tpl = GRID_CODE_TEMPLATES[key];
            if (tpl && tpl.description) {
                this._templateDescEl.textContent = tpl.description;
                this._templateDescEl.style.display = 'block';
            } else {
                this._templateDescEl.style.display = 'none';
            }
            this._renderTemplatePreview(key);
        };

        // --- Row actions header ---
        const actionsRow = document.createElement('div');
        Object.assign(actionsRow.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'
        });

        const helpText = document.createElement('div');
        helpText.textContent = 'P (MW), Q_min (Mvar, underexcited / negative), Q_max (Mvar, overexcited / positive). Applied to all voltage levels. If you add any rows, choose a template above — use "Custom (manual table)" for hand-entered points. Leave the table empty and keep "-- Select --" to plot capability only.';
        Object.assign(helpText.style, { fontSize: '11px', color: '#6c757d', flex: '1' });
        actionsRow.appendChild(helpText);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+ Add Row';
        Object.assign(addBtn.style, {
            padding: '4px 10px', fontSize: '12px', border: '1px solid #007bff',
            borderRadius: '4px', backgroundColor: '#fff', color: '#007bff', cursor: 'pointer',
            marginLeft: '8px', whiteSpace: 'nowrap'
        });
        addBtn.onclick = () => this._addRequirementRow(tableBody);
        actionsRow.appendChild(addBtn);
        section.appendChild(actionsRow);

        // --- Requirements table ---
        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '13px' });
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['P (MW)', 'Q_min (Mvar)', 'Q_max (Mvar)', ''].forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            Object.assign(th.style, {
                padding: '4px 6px', borderBottom: '1px solid #dee2e6', textAlign: 'left',
                fontWeight: '600', color: '#495057', fontSize: '12px'
            });
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tableBody = document.createElement('tbody');
        table.appendChild(tableBody);
        section.appendChild(table);

        this.requirementRows = [];
        this._requirementsBody = tableBody;

        return section;
    }

    _loadChartJS() {
        if (window.Chart) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src*="chart.js"]') ||
                             document.querySelector('script[src*="chart.umd"]');
            if (existing) {
                if (window.Chart) { resolve(); return; }
                existing.addEventListener('load', resolve);
                existing.addEventListener('error', () => reject(new Error('Chart.js load failed')));
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Chart.js'));
            document.head.appendChild(script);
        });
    }

    _renderTemplatePreview(templateKey) {
        const tpl = GRID_CODE_TEMPLATES[templateKey];
        if (!tpl || !tpl.rows || tpl.rows.length === 0) {
            this._previewContainer.style.display = 'none';
            if (this._previewChart) { this._previewChart.destroy(); this._previewChart = null; }
            return;
        }

        this._previewContainer.style.display = 'block';

        this._loadChartJS().then(() => {
            const Chart = window.Chart;
            if (!Chart) return;

            if (this._previewChart) { this._previewChart.destroy(); this._previewChart = null; }

            const rows = tpl.rows;
            const qMinPts = rows.map(r => ({ x: r.q_min_pu, y: r.p_pu }));
            const qMaxPts = rows.map(r => ({ x: r.q_max_pu, y: r.p_pu }));

            const envelope = [];
            for (let i = 0; i < rows.length; i++) envelope.push({ x: rows[i].q_min_pu, y: rows[i].p_pu });
            for (let i = rows.length - 1; i >= 0; i--) envelope.push({ x: rows[i].q_max_pu, y: rows[i].p_pu });

            const ctx = this._previewCanvas.getContext('2d');
            this._previewChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: 'Q_max (overexcited)',
                            data: qMaxPts,
                            borderColor: '#0d6efd',
                            backgroundColor: 'transparent',
                            borderWidth: 2.5,
                            pointRadius: 3,
                            pointBackgroundColor: '#0d6efd',
                            showLine: true,
                            order: 1
                        },
                        {
                            label: 'Q_min (underexcited)',
                            data: qMinPts,
                            borderColor: '#dc3545',
                            backgroundColor: 'transparent',
                            borderWidth: 2.5,
                            borderDash: [6, 3],
                            pointRadius: 3,
                            pointBackgroundColor: '#dc3545',
                            showLine: true,
                            order: 1
                        },
                        {
                            label: '_fill',
                            data: envelope,
                            borderColor: 'transparent',
                            backgroundColor: 'rgba(13, 110, 253, 0.07)',
                            fill: true,
                            pointRadius: 0,
                            showLine: true,
                            order: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    plugins: {
                        title: {
                            display: true,
                            text: tpl.name,
                            font: { size: 13, weight: '600' },
                            color: '#212529',
                            padding: { bottom: 8 }
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                filter: (item) => !item.text.startsWith('_'),
                                font: { size: 11 },
                                boxWidth: 14,
                                padding: 10
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `Q/Pmax: ${ctx.parsed.x?.toFixed(4)}, P/Pmax: ${ctx.parsed.y?.toFixed(2)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Q / P_max (pu)', font: { size: 11, weight: '600' } },
                            grid: { color: 'rgba(0,0,0,0.06)' },
                            ticks: { font: { size: 10 } }
                        },
                        y: {
                            title: { display: true, text: 'P / P_max (pu)', font: { size: 11, weight: '600' } },
                            grid: { color: 'rgba(0,0,0,0.06)' },
                            min: 0, max: 1.1,
                            ticks: { font: { size: 10 } }
                        }
                    }
                }
            });
        }).catch(err => console.warn('Could not load Chart.js for preview:', err));
    }

    _applyTemplate(templateKey) {
        const tpl = GRID_CODE_TEMPLATES[templateKey];
        if (!tpl || !tpl.rows || tpl.rows.length === 0) return;

        let pRated = parseFloat(this._pRatedInput.value);
        if (isNaN(pRated) || pRated <= 0) {
            const pMaxInput = this.inputs.get('pMaxMw');
            pRated = pMaxInput ? parseFloat(pMaxInput.value) : 0;
        }
        if (isNaN(pRated) || pRated <= 0) {
            pRated = this._estimateInstalledCapacity();
        }
        if (isNaN(pRated) || pRated <= 0) {
            alert('Enter a P rated (MW) value or set P Max so the template can be scaled to absolute MW/Mvar.');
            return;
        }

        // Clear existing rows
        while (this._requirementsBody.firstChild) {
            this._requirementsBody.removeChild(this._requirementsBody.firstChild);
        }
        this.requirementRows = [];

        // Populate from template
        tpl.rows.forEach(r => {
            const pMw = +(r.p_pu * pRated).toFixed(2);
            const qMin = +(r.q_min_pu * pRated).toFixed(2);
            const qMax = +(r.q_max_pu * pRated).toFixed(2);
            this._addRequirementRow(this._requirementsBody, pMw, qMin, qMax);
        });
    }

    _estimateInstalledCapacity() {
        return estimateRpcInstalledMw(this.graph);
    }

    _addRequirementRow(tbody, p = '', qMin = '', qMax = '') {
        const tr = document.createElement('tr');
        const inputs = {};
        [{ key: 'p', val: p }, { key: 'qMin', val: qMin }, { key: 'qMax', val: qMax }].forEach(({ key, val }) => {
            const td = document.createElement('td');
            Object.assign(td.style, { padding: '3px 4px' });
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.step = 'any';
            inp.value = val;
            Object.assign(inp.style, {
                width: '100%', padding: '4px', border: '1px solid #ced4da',
                borderRadius: '3px', fontSize: '13px', boxSizing: 'border-box'
            });
            td.appendChild(inp);
            tr.appendChild(td);
            inputs[key] = inp;
        });
        const tdDel = document.createElement('td');
        Object.assign(tdDel.style, { padding: '3px 4px', width: '30px', textAlign: 'center' });
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = '\u00d7';
        Object.assign(delBtn.style, {
            border: 'none', background: 'transparent', color: '#dc3545',
            fontSize: '16px', cursor: 'pointer', fontWeight: '700'
        });
        delBtn.onclick = () => {
            tbody.removeChild(tr);
            this.requirementRows = this.requirementRows.filter(r => r.tr !== tr);
        };
        tdDel.appendChild(delBtn);
        tr.appendChild(tdDel);
        tbody.appendChild(tr);
        this.requirementRows.push({ tr, inputs });
    }

    getFormValues() {
        const values = {};
        this.parameters.forEach(param => {
            if (param.type === 'radio') {
                let checked = null;
                if (this.container) {
                    checked = this.container.querySelector(
                        `input[type="radio"][name="${param.id}"]:checked`
                    );
                }
                if (!checked) {
                    const radio = this.inputs.get(param.id);
                    if (radio && radio.checked) checked = radio;
                }
                if (checked) {
                    values[param.id] = checked.value;
                } else {
                    const defOpt = param.options.find(o => o.default);
                    values[param.id] = defOpt ? defOpt.value : (param.options[0]?.value || '');
                }
            } else if (param.type === 'checkbox') {
                const cb = this.inputs.get(param.id);
                values[param.id] = cb ? cb.checked : false;
            } else if (param.type === 'multiselect') {
                const data = this.inputs.get(param.id);
                if (data && data._multiCheckboxes) {
                    values[param.id] = data._multiCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
                } else {
                    values[param.id] = [];
                }
            } else if (param.type === 'select') {
                const sel = this.inputs.get(param.id);
                values[param.id] = sel ? sel.value : '';
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.value : param.value;
            }
        });

        values.requirements = this.requirementRows.map(r => ({
            p: parseFloat(r.inputs.p.value) || 0,
            qMin: parseFloat(r.inputs.qMin.value) || 0,
            qMax: parseFloat(r.inputs.qMax.value) || 0
        }));

        values.gridCodeTemplateKey = this._templateSelect ? this._templateSelect.value : 'none';
        const pr = this._pRatedInput ? parseFloat(this._pRatedInput.value) : NaN;
        values.pRatedMw = !isNaN(pr) && pr > 0 ? pr : null;

        if (this.container) {
            const syncCb = (id) => {
                const el = this.container.querySelector(`input[type="checkbox"][id="${id}"]`);
                if (el) {
                    const key = id;
                    values[key] = el.checked;
                }
            };
            syncCb('limitOverloads');
            syncCb('rpc_run_control');
        }

        return values;
    }

    async checkSubscriptionStatus() {
        try {
            await ensureSubscriptionFunctions();
            if (window.checkSubscriptionStatus) return await window.checkSubscriptionStatus();
            if (window.SubscriptionManager?.checkSubscriptionStatus) return await window.SubscriptionManager.checkSubscriptionStatus();
            return false;
        } catch (e) {
            throw e;
        }
    }

    show(callback) {
        try { this.populateOptions(); } catch (e) { console.error('Error populating RPC options:', e); }
        this.displayDialog(callback);
    }

    displayDialog(callback) {
        this.callback = callback;
        this.ui = this.ui || window.App?.main?.editor?.editorUi;

        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5',
            color: '#333', padding: '0', margin: '0', width: '100%', height: '100%',
            boxSizing: 'border-box', display: 'flex', flexDirection: 'column'
        });

        if (this.getDescription) {
            const desc = document.createElement('div');
            Object.assign(desc.style, {
                padding: '6px 10px', backgroundColor: '#e3f2fd', border: '1px solid #bbdefb',
                borderRadius: '4px', fontSize: '12px', color: '#1565c0', marginBottom: '12px'
            });
            desc.innerHTML = this.getDescription();
            container.appendChild(desc);
        }

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, {
            overflowY: 'auto', overflowX: 'hidden', flex: '1 1 auto', minHeight: '0', paddingRight: '8px'
        });

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box'
        });

        this.parameters.forEach(param => {
            const formGroup = document.createElement('div');
            Object.assign(formGroup.style, { marginBottom: '4px' });

            if (param.type !== 'checkbox' || param.checkboxLabel != null) {
                const label = document.createElement('label');
                Object.assign(label.style, {
                    display: 'block', marginBottom: '2px', fontWeight: '600',
                    fontSize: '13px', color: '#495057'
                });
                label.textContent = param.label;
                formGroup.appendChild(label);
            }

            let input;
            if (param.type === 'radio') input = this.createRadioGroup(param);
            else if (param.type === 'select') input = this.createSelect(param);
            else if (param.type === 'multiselect') input = this.createMultiSelect(param);
            else if (param.type === 'checkbox') input = this.createCheckbox(param);
            else input = this.createTextInput(param);

            if (input instanceof Node) formGroup.appendChild(input);
            form.appendChild(formGroup);
        });

        form.appendChild(this._createRequirementsSection());

        contentArea.appendChild(form);
        container.appendChild(contentArea);

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex', gap: '8px', justifyContent: 'flex-end',
            marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e9ecef'
        });

        const cancelButton = this.createButton('Cancel', '#6c757d', '#5a6268');
        const applyButton = this.createButton(this.submitButtonText, '#007bff', '#0056b3');

        const cleanupAndClose = () => {
            if (this._previewChart) { this._previewChart.destroy(); this._previewChart = null; }
            this.destroy();
            if (this.ui?.hideDialog) this.ui.hideDialog();
        };

        cancelButton.onclick = (e) => {
            e.preventDefault();
            cleanupAndClose();
        };

        applyButton.onclick = async (e) => {
            e.preventDefault();
            try {
                const hasSub = await this.checkSubscriptionStatus();
                if (!hasSub) {
                    cleanupAndClose();
                    if (window.showSubscriptionModal) window.showSubscriptionModal();
                    else alert('A subscription is required to use Reactive Power Capability analysis.');
                    return;
                }
                const values = this.getFormValues();
                if (this.callback) this.callback(values);
                cleanupAndClose();
            } catch (error) {
                console.error('RPCDialog error:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        this.container = container;

        if (this.ui && typeof this.ui.showDialog === 'function') {
            this.ui.showDialog(container, 720, 750, true, false);
        } else {
            this.showModalFallback(container);
        }
    }
}
