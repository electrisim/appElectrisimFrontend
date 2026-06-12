import { Dialog } from './Dialog.js';
import { createEconomicTabContent, buildCostPerUnitByCurrency } from './utils/economicTabHelper.js';
import ENV from './config/environment.js';

/**
 * Keys from pandapower.basic_fuse_std_types() — HV fuses (6.3–200 A) and Siemens NH (16–1000 A).
 * Sorted by ascending rated current within each family for easier browsing.
 */
export const PANDAPOWER_STANDARD_FUSE_TYPES = [
    'HV 6.3A',
    'HV 10A',
    'HV 16A',
    'HV 20A',
    'HV 25A',
    'HV 31.5A',
    'HV 40A',
    'HV 50A',
    'HV 63A',
    'HV 80A',
    'HV 100A',
    'HV 125A',
    'HV 160A',
    'HV 200A',
    'Siemens NH-1-16',
    'Siemens NH-1-25',
    'Siemens NH-1-50',
    'Siemens NH-1-63',
    'Siemens NH-1-80',
    'Siemens NH-1-100',
    'Siemens NH-1-125',
    'Siemens NH-1-160',
    'Siemens NH-2-200',
    'Siemens NH-2-224',
    'Siemens NH-2-250',
    'Siemens NH-2-315',
    'Siemens NH-2-355',
    'Siemens NH-2-400',
    'Siemens NH-2-425',
    'Siemens NH-2-630',
    'Siemens NH-2-1000'
];

/** Select value when the user defines a fuse via `pp.create_std_type(..., element="fuse")`. */
export const CUSTOM_FUSE_TYPE_VALUE = '__custom_fuse__';

/** Example curve payload (HV 63 A style — same structure as pandapower fuse std types). */
export const FUSE_CUSTOM_CURVE_JSON_EXAMPLE = `{
  "t_avg": 0,
  "t_min": [10.0, 2.84, 0.368, 0.164, 0.1, 0.0621, 0.0378, 0.0195, 0.01],
  "t_total": [10.0, 1.82, 0.344, 0.1, 0.0467, 0.0269, 0.01],
  "x_avg": 0,
  "x_min": [189.0, 220.0, 300.0, 350.0, 393.0, 450.0, 530.0, 700.0, 961.0],
  "x_total": [378.0, 500.0, 700.0, 934.0, 1200.0, 1500.0, 2366.0]
}`;

/**
 * Rated current [A] encoded in pandapower standard fuse type strings:
 * e.g. "HV 31.5A" → 31.5, "Siemens NH-2-1000" → 1000.
 * @param {string} fuseType
 * @returns {number|null}
 */
export function ratedCurrentAmpsFromFuseType(fuseType) {
    if (fuseType == null || fuseType === '') return null;
    const s = String(fuseType).trim();
    const hv = s.match(/(\d+(?:\.\d+)?)\s*A\s*$/i);
    if (hv) return parseFloat(hv[1]);
    const nh = s.match(/-(\d+(?:\.\d+)?)\s*$/);
    if (nh) return parseFloat(nh[1]);
    return null;
}

// Default values for Switch parameters (based on pandapower documentation)
export const defaultSwitchData = {
    name: "Switch",
    closed: true,
    type: "CB",
    z_ohm: 0.0,
    in_ka: 0.0,
    cost_per_unit_by_currency: "0",
    // Protection coordination defaults (used by the Protection Coordination study)
    protection_type: "none",
    oc_relay_type: "DTOC",
    curve_type: "standard_inverse",
    tms: 1.0,
    t_grade: 0.5,
    t_gg: 0.07,
    t_g: 0.5,
    t_diff: 0.3,
    pickup_mode: "auto",
    I_s_a: 0.0,
    I_g_a: 0.0,
    I_gg_a: 0.0,
    fuse_type: "",
    fuse_mode: "library",
    fuse_custom_name: "",
    fuse_custom_std_json: FUSE_CUSTOM_CURVE_JSON_EXAMPLE,
    rated_i_a: 0.0,
    overload_factor: 1.25,
    ct_current_factor: 1.2,
    safety_factor: 1.0
};

export class SwitchDialog extends Dialog {
    constructor(editorUi) {
        super('Switch Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultSwitchData };
        this.inputs = new Map();
        
        // Load Flow parameters
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'Name',
                symbol: 'name',
                description: 'Name identifier for the switch',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'closed',
                label: 'Closed',
                symbol: 'closed',
                description: 'Specifies if the switch is closed (True/False)',
                type: 'checkbox',
                value: this.data.closed
            },
            {
                id: 'type',
                label: 'Type',
                symbol: 'type',
                description: 'Type of switch (CB: Circuit Breaker, LS: Load Switch, LBS: Load Break Switch, DS: Disconnecting Switch)',
                type: 'text',
                value: this.data.type
            },
            {
                id: 'z_ohm',
                label: 'Impedance',
                symbol: 'z_ohm',
                unit: 'Ω',
                description: 'Impedance of the switch in Ohm',
                type: 'number',
                value: this.data.z_ohm.toString(),
                step: '0.001',
                min: '0'
            },
            {
                id: 'in_ka',
                label: 'Rated Current',
                symbol: 'in_ka',
                unit: 'kA',
                description: 'Rated current of the switch in kA',
                type: 'number',
                value: this.data.in_ka.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
        // Short Circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'ikss_ka',
                label: 'Short Circuit Current',
                symbol: 'ikss_ka',
                unit: 'kA',
                description: 'Short circuit current in kA',
                type: 'number',
                value: '0',
                step: '0.1',
                min: '0'
            }
        ];
        
        // OPF parameters (switches don't have specific OPF parameters)
        this.opfParameters = [];

        // Economic parameters (for Economic Analysis)
        this.economicParameters = [
            { id: 'cost_per_unit_by_currency', label: 'Cost per unit', description: 'Cost per unit for Economic Analysis CAPEX calculation', type: 'text', value: '' }
        ];

        // Protection coordination parameters (used by the Protection Coordination study).
        // The select/info field types are handled in createTabContent below.
        this.protectionParameters = [
            {
                id: 'protection_type',
                label: 'Protection device',
                description: 'Type of protection assigned to this switch. None = switch acts only as a CB without protection logic.',
                type: 'select',
                value: this.data.protection_type,
                options: [
                    { value: 'none', label: 'None' },
                    { value: 'ocr', label: 'Overcurrent Relay (OCR)' },
                    { value: 'fuse', label: 'Fuse' },
                    { value: 'differential', label: 'Differential (87) - UI placeholder' },
                    { value: 'distance', label: 'Distance (21) - UI placeholder' }
                ]
            },
            // ---- OCR fields (visible when protection_type == 'ocr') ----
            {
                id: 'oc_relay_type', label: 'OC relay subtype', description: 'DTOC (definite time), IDMT (inverse time, IEC 60255), or IDTOC (combined).',
                type: 'select', value: this.data.oc_relay_type, showWhen: { protection_type: ['ocr'] },
                options: [
                    { value: 'DTOC', label: 'DTOC' },
                    { value: 'IDMT', label: 'IDMT' },
                    { value: 'IDTOC', label: 'IDTOC' }
                ]
            },
            {
                id: 'curve_type', label: 'IEC inverse curve', description: 'IEC 60255 inverse curve family (used for IDMT and IDTOC).',
                type: 'select', value: this.data.curve_type, showWhen: { protection_type: ['ocr'] },
                options: [
                    { value: 'standard_inverse', label: 'Standard inverse' },
                    { value: 'very_inverse', label: 'Very inverse' },
                    { value: 'extremely_inverse', label: 'Extremely inverse' },
                    { value: 'long_inverse', label: 'Long inverse' }
                ]
            },
            { id: 'tms', label: 'TMS', symbol: 'tms', unit: 's', description: 'Time multiplier setting (IDMT / IDTOC).', type: 'number', value: String(this.data.tms), step: '0.01', min: '0', showWhen: { protection_type: ['ocr'] } },
            { id: 't_grade', label: 'Time grading', symbol: 't_grade', unit: 's', description: 'Grading delay between successive relays (IDMT / IDTOC).', type: 'number', value: String(this.data.t_grade), step: '0.01', min: '0', showWhen: { protection_type: ['ocr'] } },
            { id: 't_gg', label: 'Instantaneous trip time', symbol: 't_gg', unit: 's', description: 'Instantaneous trip time t>> (DTOC / IDTOC).', type: 'number', value: String(this.data.t_gg), step: '0.01', min: '0', showWhen: { protection_type: ['ocr'] } },
            { id: 't_g', label: 'Primary trip time', symbol: 't_g', unit: 's', description: 'Primary backup trip time t> (DTOC / IDTOC).', type: 'number', value: String(this.data.t_g), step: '0.01', min: '0', showWhen: { protection_type: ['ocr'] } },
            { id: 't_diff', label: 'Grading margin', symbol: 't_diff', unit: 's', description: 'Time grading delay difference used for the miscoordination check.', type: 'number', value: String(this.data.t_diff), step: '0.01', min: '0', showWhen: { protection_type: ['ocr'] } },
            {
                id: 'pickup_mode', label: 'Pickup current mode', description: 'Auto: pandapower derives pickup from line ratings. Manual: enter explicit pickup currents.',
                type: 'select', value: this.data.pickup_mode, showWhen: { protection_type: ['ocr'] },
                options: [
                    { value: 'auto', label: 'Auto (from line ratings)' },
                    { value: 'manual', label: 'Manual' }
                ]
            },
            { id: 'I_s_a', label: 'Pickup current I_s', symbol: 'I_s', unit: 'A', description: 'Manual IDMT / IDTOC pickup current.', type: 'number', value: String(this.data.I_s_a), step: '1', min: '0', showWhen: { protection_type: ['ocr'], pickup_mode: ['manual'] } },
            { id: 'I_g_a', label: 'Pickup current I>', symbol: 'I_g', unit: 'A', description: 'Manual DTOC / IDTOC primary pickup current.', type: 'number', value: String(this.data.I_g_a), step: '1', min: '0', showWhen: { protection_type: ['ocr'], pickup_mode: ['manual'] } },
            { id: 'I_gg_a', label: 'Pickup current I>>', symbol: 'I_gg', unit: 'A', description: 'Manual DTOC / IDTOC instantaneous pickup current.', type: 'number', value: String(this.data.I_gg_a), step: '1', min: '0', showWhen: { protection_type: ['ocr'], pickup_mode: ['manual'] } },
            { id: 'overload_factor', label: 'Overload factor', description: 'Allowable line overload used to derive auto pickup currents.', type: 'number', value: String(this.data.overload_factor), step: '0.05', min: '1', showWhen: { protection_type: ['ocr'] } },
            { id: 'ct_current_factor', label: 'CT current factor', description: 'CT multiplication factor for auto pickup currents.', type: 'number', value: String(this.data.ct_current_factor), step: '0.05', min: '1', showWhen: { protection_type: ['ocr'] } },
            { id: 'safety_factor', label: 'Safety factor', description: 'Safety limit applied to the instantaneous pickup current.', type: 'number', value: String(this.data.safety_factor), step: '0.05', min: '1', showWhen: { protection_type: ['ocr'] } },

            // ---- Fuse fields (visible when protection_type == 'fuse') ----
            {
                id: 'fuse_type',
                label: 'Fuse type',
                description: 'Standard library (pandapower.basic_fuse_std_types) or user-defined type registered like pp.create_std_type(net, data, name=…, element="fuse").',
                type: 'select',
                value: this.data.fuse_type,
                showWhen: { protection_type: ['fuse'] },
                options: [
                    { value: '', label: '— Select type —' },
                    { value: CUSTOM_FUSE_TYPE_VALUE, label: 'Custom fuse (user-defined)…' },
                    ...PANDAPOWER_STANDARD_FUSE_TYPES.map((t) => ({ value: t, label: t }))
                ]
            },
            {
                id: 'fuse_custom_name',
                label: 'Custom fuse name',
                description: 'Name registered in the network std_types (must match fuse_type in the curve JSON). Use letters, numbers, spaces; avoid clashing with built-in library names unless you intend to override.',
                type: 'text',
                value: this.data.fuse_custom_name,
                showWhen: { protection_type: ['fuse'], fuse_type: [CUSTOM_FUSE_TYPE_VALUE] }
            },
            {
                id: 'fuse_custom_std_json',
                label: 'Custom curve data (JSON)',
                description: 'Editable JSON: t_avg, t_min, t_total, x_avg, x_min, x_total (omit fuse_type / i_rated_a — I_rated comes from the field below). A working template is pre-filled; replace with your curve.',
                type: 'textarea',
                value: this.data.fuse_custom_std_json,
                showWhen: { protection_type: ['fuse'], fuse_type: [CUSTOM_FUSE_TYPE_VALUE] }
            },
            { id: 'rated_i_a', label: 'Rated current', symbol: 'I_rated', unit: 'A', description: 'Fuse rated current I_rated [A]. For library types, auto-filled from the name; for custom types, must match i_rated_a sent to pandapower.', type: 'number', value: String(this.data.rated_i_a), step: '1', min: '0', showWhen: { protection_type: ['fuse'] } },

            // ---- Differential / Distance placeholders ----
            {
                id: '_protection_stub_banner',
                label: 'Not computed',
                description: 'Differential (87) and Distance (21) are not modeled in pandapower. Settings entered here are stored on the cell for documentation purposes and will be available once these device types are supported.',
                type: 'info',
                showWhen: { protection_type: ['differential', 'distance'] }
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Switch Parameters</strong><br>Set parameters for switch elements that can connect/disconnect lines or transformers. See the <a href="https://electrisim.com/documentation.html#switch" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }
    
    show(callback) {
        this.callback = callback;
        this.showTabDialog();
    }
    
    showTabDialog() {
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        
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

        const description = document.createElement('div');
        Object.assign(description.style, {
            padding: '6px 10px',
            backgroundColor: '#e3f2fd',
            border: '1px solid #bbdefb',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1565c0',
            marginBottom: '12px'
        });
        description.innerHTML = this.getDescription();
        container.appendChild(description);

        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex',
            borderBottom: '2px solid #e9ecef',
            marginBottom: '16px'
        });

        const loadFlowTab = this.createTab('Load Flow', 'loadflow', this.currentTab === 'loadflow');
        const shortCircuitTab = this.createTab('Short Circuit', 'shortcircuit', this.currentTab === 'shortcircuit');
        const opfTab = this.createTab('OPF', 'opf', this.currentTab === 'opf');
        const economicTab = this.createTab('Economic', 'economic', this.currentTab === 'economic');
        const protectionTab = this.createTab('Protection', 'protection', this.currentTab === 'protection');

        tabContainer.appendChild(loadFlowTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(opfTab);
        tabContainer.appendChild(economicTab);
        tabContainer.appendChild(protectionTab);
        container.appendChild(tabContainer);

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, {
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 auto',
            minHeight: '0',
            scrollbarWidth: 'thin',
            scrollbarColor: '#c1c1c1 #f1f1f1',
            paddingRight: '8px'
        });

        const loadFlowContent = this.createTabContent('loadflow', this.loadFlowParameters);
        const shortCircuitContent = this.createTabContent('shortcircuit', this.shortCircuitParameters);
        const opfContent = this.createTabContent('opf', this.opfParameters);
        const economicContent = this.createTabContent('economic', this.economicParameters);
        const protectionContent = this.createTabContent('protection', this.protectionParameters);
        this._initFusePreviewPanel(protectionContent);

        contentArea.appendChild(loadFlowContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(opfContent);
        contentArea.appendChild(economicContent);
        contentArea.appendChild(protectionContent);
        container.appendChild(contentArea);

        // Wire up showWhen-based visibility for protection fields + fuse curve preview.
        this._refreshProtectionVisibility = () => {
            this.refreshProtectionVisibility();
            this._syncFusePreviewPanel();
        };
        this._refreshProtectionVisibility();

        ['protection_type', 'fuse_type', 'rated_i_a', 'fuse_custom_name', 'fuse_custom_std_json'].forEach((id) => {
            const el = this.inputs.get(id);
            if (!el) return;
            const ev = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(ev, () => this._syncFusePreviewPanel());
        });

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef'
        });

        const cancelButton = this.createButton('Cancel', '#6c757d', '#5a6268');
        const applyButton = this.createButton('Apply', '#007bff', '#0056b3');
        
        cancelButton.onclick = (e) => {
            e.preventDefault();
            this.closeDialog();
        };

        applyButton.onclick = (e) => {
            e.preventDefault();
            const fuseTypeEl = this.inputs.get('fuse_type');
            const rawFuseSel = fuseTypeEl ? fuseTypeEl.value : '';
            if (this.inputs.get('protection_type')?.value === 'fuse') {
                if (rawFuseSel === CUSTOM_FUSE_TYPE_VALUE) {
                    const nm = (this.inputs.get('fuse_custom_name')?.value || '').trim();
                    const jsonStr = (this.inputs.get('fuse_custom_std_json')?.value || '').trim();
                    const ir = parseFloat(this.inputs.get('rated_i_a')?.value || '0');
                    if (!nm) {
                        window.alert('Enter a custom fuse name (library id for pandapower create_std_type).');
                        return;
                    }
                    if (!jsonStr) {
                        window.alert('Paste the custom fuse curve data as JSON (t_min / x_min / …).');
                        return;
                    }
                    try {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                            throw new Error('JSON must be an object.');
                        }
                    } catch (err) {
                        window.alert(`Custom fuse curve JSON is invalid: ${err.message || err}`);
                        return;
                    }
                    if (!ir || ir <= 0) {
                        window.alert('Enter rated current I_rated [A] for the custom fuse.');
                        return;
                    }
                } else if (!rawFuseSel) {
                    window.alert('Select a fuse type from the library or choose Custom fuse.');
                    return;
                }
            }

            const values = this.getFormValues();
            console.log('Switch values:', values);
            
            if (this.callback) {
                this.callback(values);
            }
            
            this.closeDialog();
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        this.container = container;
        
        loadFlowTab.onclick = () => this.switchTab('loadflow', loadFlowTab, [shortCircuitTab, opfTab, economicTab, protectionTab], loadFlowContent, [shortCircuitContent, opfContent, economicContent, protectionContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [loadFlowTab, opfTab, economicTab, protectionTab], shortCircuitContent, [loadFlowContent, opfContent, economicContent, protectionContent]);
        opfTab.onclick = () => this.switchTab('opf', opfTab, [loadFlowTab, shortCircuitTab, economicTab, protectionTab], opfContent, [loadFlowContent, shortCircuitContent, economicContent, protectionContent]);
        economicTab.onclick = () => this.switchTab('economic', economicTab, [loadFlowTab, shortCircuitTab, opfTab, protectionTab], economicContent, [loadFlowContent, shortCircuitContent, opfContent, protectionContent]);
        protectionTab.onclick = () => this.switchTab('protection', protectionTab, [loadFlowTab, shortCircuitTab, opfTab, economicTab], protectionContent, [loadFlowContent, shortCircuitContent, opfContent, economicContent]);

        if (this.ui && typeof this.ui.showDialog === 'function') {
            const screenHeight = window.innerHeight - 80;
            this.ui.showDialog(container, 1000, screenHeight, true, false);
        } else {
            this.showModalFallback(container);
        }
    }
    
    createTab(title, tabId, isActive) {
        const tab = document.createElement('div');
        Object.assign(tab.style, {
            padding: '12px 20px',
            cursor: 'pointer',
            borderBottom: isActive ? '2px solid #007bff' : '2px solid transparent',
            backgroundColor: isActive ? '#f8f9fa' : 'transparent',
            color: isActive ? '#007bff' : '#6c757d',
            fontWeight: isActive ? '600' : '400',
            transition: 'all 0.2s ease',
            userSelect: 'none'
        });
        tab.textContent = title;
        tab.dataset.tab = tabId;
        
        tab.addEventListener('mouseenter', () => {
            if (!tab.classList.contains('active')) {
                tab.style.backgroundColor = '#f8f9fa';
            }
        });
        
        tab.addEventListener('mouseleave', () => {
            if (!tab.classList.contains('active')) {
                tab.style.backgroundColor = 'transparent';
            }
        });
        
        if (isActive) {
            tab.classList.add('active');
        }
        
        return tab;
    }
    
    createTabContent(tabId, parameters) {
        if (tabId === 'economic' && parameters && parameters.length > 0 && parameters[0]?.id === 'cost_per_unit_by_currency') {
            const content = document.createElement('div');
            content.dataset.tab = tabId;
            content.style.display = tabId === this.currentTab ? 'block' : 'none';
            content.appendChild(createEconomicTabContent(buildCostPerUnitByCurrency(this.data), this.inputs, true));
            return content;
        }

        const content = document.createElement('div');
        content.dataset.tab = tabId;
        Object.assign(content.style, {
            display: tabId === this.currentTab ? 'block' : 'none'
        });

        if (parameters.length === 0) {
            const emptyMessage = document.createElement('div');
            Object.assign(emptyMessage.style, {
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontStyle: 'italic'
            });
            emptyMessage.textContent = 'No parameters available for this category.';
            content.appendChild(emptyMessage);
            return content;
        }

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        parameters.forEach(param => {
            const isNameField = param.id === 'name';
            const parameterRow = document.createElement('div');
            Object.assign(parameterRow.style, {
                display: 'grid',
                gridTemplateColumns: isNameField ? 'minmax(0, 1fr) minmax(300px, 1.2fr)' : '1fr 200px',
                gap: '20px',
                alignItems: 'start',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                minHeight: '80px'
            });

            const leftColumn = document.createElement('div');
            Object.assign(leftColumn.style, {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '60px'
            });

            const label = document.createElement('label');
            Object.assign(label.style, {
                fontWeight: '600',
                fontSize: '14px',
                color: '#495057',
                marginBottom: '6px',
                lineHeight: '1.2'
            });
            let labelText = param.label;
            if (param.symbol) {
                labelText += ` (${param.symbol})`;
            }
            if (param.unit) {
                labelText += ` [${param.unit}]`;
            }
            label.textContent = labelText;
            label.htmlFor = param.id;

            const description = document.createElement('div');
            Object.assign(description.style, {
                fontSize: '12px',
                color: '#6c757d',
                lineHeight: '1.4',
                fontStyle: 'italic',
                marginBottom: '4px'
            });
            description.textContent = param.description;

            leftColumn.appendChild(label);
            leftColumn.appendChild(description);

            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minHeight: '60px',
                width: isNameField ? '100%' : '200px',
                ...(isNameField ? { minWidth: '0' } : {})
            });
            
            let input;
            
            if (param.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = param.value;
                Object.assign(input.style, {
                    width: '24px',
                    height: '24px',
                    accentColor: '#007bff',
                    cursor: 'pointer',
                    margin: '0'
                });
            } else if (param.type === 'select') {
                input = document.createElement('select');
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    outline: 'none',
                    cursor: 'pointer'
                });
                (param.options || []).forEach(opt => {
                    const optionEl = document.createElement('option');
                    optionEl.value = opt.value;
                    optionEl.textContent = opt.label;
                    if (String(opt.value) === String(param.value)) optionEl.selected = true;
                    input.appendChild(optionEl);
                });
                if (param.id === 'fuse_type') {
                    input.style.width = '100%';
                    input.style.maxWidth = '280px';
                }
                input.addEventListener('change', () => {
                    if (typeof this._refreshProtectionVisibility === 'function') {
                        this._refreshProtectionVisibility();
                    }
                    if (param.id === 'fuse_type') {
                        const ratedInput = this.inputs.get('rated_i_a');
                        if (ratedInput) {
                            if (input.value === CUSTOM_FUSE_TYPE_VALUE) {
                                const ta = this.inputs.get('fuse_custom_std_json');
                                if (ta && !String(ta.value || '').trim()) {
                                    ta.value = FUSE_CUSTOM_CURVE_JSON_EXAMPLE;
                                }
                            } else if (input.value === '') {
                                ratedInput.value = '0';
                            } else {
                                const amps = ratedCurrentAmpsFromFuseType(input.value);
                                if (amps != null) {
                                    ratedInput.value = String(amps);
                                }
                            }
                        }
                    }
                });
            } else if (param.type === 'info') {
                input = document.createElement('div');
                Object.assign(input.style, {
                    padding: '10px 14px',
                    border: '1px dashed #ced4da',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#856404',
                    backgroundColor: '#fff3cd',
                    fontStyle: 'italic',
                    maxWidth: '320px',
                    lineHeight: '1.4'
                });
                input.textContent = param.description || 'Not computed';
            } else if (param.type === 'textarea') {
                input = document.createElement('textarea');
                input.value = String(param.value ?? '');
                input.rows = param.rows || 7;
                Object.assign(input.style, {
                    width: '100%',
                    minHeight: '120px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'Consolas, ui-monospace, monospace',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'vertical'
                });
                input.addEventListener('focus', () => {
                    input.style.borderColor = '#007bff';
                    input.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
                });
                input.addEventListener('blur', () => {
                    input.style.borderColor = '#ced4da';
                    input.style.boxShadow = 'none';
                });
            } else {
                input = document.createElement('input');
                input.type = param.type;
                input.value = param.value;
                Object.assign(input.style, {
                    width: isNameField ? '100%' : '180px',
                    ...(isNameField ? { minWidth: '0' } : {}),
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                });
                
                input.addEventListener('focus', () => {
                    input.style.borderColor = '#007bff';
                    input.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
                    input.style.transform = 'translateY(-1px)';
                });
                
                input.addEventListener('blur', () => {
                    input.style.borderColor = '#ced4da';
                    input.style.boxShadow = 'none';
                    input.style.transform = 'translateY(0)';
                });
                
                input.addEventListener('mouseenter', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#adb5bd';
                        input.style.backgroundColor = '#f8f9fa';
                    }
                });
                
                input.addEventListener('mouseleave', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#ced4da';
                        input.style.backgroundColor = '#ffffff';
                    }
                });
            }
            
            if (param.type === 'number') {
                if (param.step) input.step = param.step;
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
            }

            input.id = param.id;
            this.inputs.set(param.id, input);
            if (param.type === 'textarea') {
                parameterRow.style.gridTemplateColumns = '1fr';
                leftColumn.appendChild(input);
                parameterRow.appendChild(leftColumn);
            } else {
                rightColumn.appendChild(input);
                parameterRow.appendChild(leftColumn);
                parameterRow.appendChild(rightColumn);
            }
            form.appendChild(parameterRow);

            if (param.showWhen) {
                if (!this._fieldRowsByParamId) this._fieldRowsByParamId = new Map();
                this._fieldRowsByParamId.set(param.id, { row: parameterRow, showWhen: param.showWhen });
            }
        });

        content.appendChild(form);
        return content;
    }
    
    refreshProtectionVisibility() {
        if (!this._fieldRowsByParamId) return;
        this._fieldRowsByParamId.forEach(({ row, showWhen }) => {
            const visible = Object.entries(showWhen).every(([key, allowed]) => {
                const driver = this.inputs.get(key);
                if (!driver) return false;
                const driverValue = driver.tagName === 'SELECT' ? driver.value : driver.value;
                return Array.isArray(allowed) ? allowed.includes(driverValue) : driverValue === allowed;
            });
            row.style.display = visible ? '' : 'none';
        });
    }

    createButton(text, bgColor, hoverColor) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        Object.assign(button.style, {
            padding: '8px 16px',
            backgroundColor: bgColor,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        });
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = hoverColor;
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = bgColor;
        });
        
        return button;
    }
    
    switchTab(tabId, activeTab, inactiveTabs, activeContent, inactiveContents) {
        this.currentTab = tabId;
        
        Object.assign(activeTab.style, {
            borderBottom: '2px solid #007bff',
            backgroundColor: '#f8f9fa',
            color: '#007bff',
            fontWeight: '600'
        });
        activeTab.classList.add('active');
        
        inactiveTabs.forEach(inactiveTab => {
            Object.assign(inactiveTab.style, {
                borderBottom: '2px solid transparent',
                backgroundColor: 'transparent',
                color: '#6c757d',
                fontWeight: '400'
            });
            inactiveTab.classList.remove('active');
        });
        
        activeContent.style.display = 'block';
        inactiveContents.forEach(inactiveContent => {
            inactiveContent.style.display = 'none';
        });
        if (tabId === 'protection') {
            this._syncFusePreviewPanel();
        }
    }

    _initFusePreviewPanel(protectionContent) {
        const host = document.createElement('div');
        host.id = 'fuseCharacteristicPreviewHost';
        host.style.cssText =
            'display:none;margin-top:12px;padding:14px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;';
        const title = document.createElement('div');
        title.textContent = 'Time–current characteristic (preview)';
        title.style.cssText = 'font-weight:600;font-size:14px;color:#495057;margin-bottom:6px;';
        const hint = document.createElement('div');
        hint.id = 'fuseCharacteristicPreviewHint';
        hint.style.cssText = 'font-size:12px;color:#6c757d;margin-bottom:10px;min-height:18px;line-height:1.4;';
        hint.textContent =
            'Select a fuse type to plot the same characteristic pandapower uses in Fuse.plot_protection_characteristic(net).';
        const box = document.createElement('div');
        box.style.cssText = 'position:relative;height:260px;width:100%;min-width:280px;';
        const canvas = document.createElement('canvas');
        canvas.id = 'fuseCharacteristicPreviewCanvas';
        box.appendChild(canvas);
        host.appendChild(title);
        host.appendChild(hint);
        host.appendChild(box);
        protectionContent.appendChild(host);
        this._fusePreviewHost = host;
        this._fusePreviewHint = hint;
        this._fusePreviewCanvas = canvas;
        this._fusePreviewChart = null;
        this._fusePreviewDebounce = null;
        this._fusePreviewSeq = 0;
    }

    _getUserEmailForFusePreview() {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const u = JSON.parse(userStr);
                if (u && u.email) return u.email;
            }
        } catch (e) {
            /* ignore */
        }
        return 'unknown@user.com';
    }

    _clearFusePreviewChart() {
        if (this._fusePreviewChart) {
            try {
                this._fusePreviewChart.destroy();
            } catch (e) {
                /* ignore */
            }
            this._fusePreviewChart = null;
        }
    }

    _ensureChartJsForFusePreview() {
        if (typeof window.Chart === 'function') return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-chart-electrisim-loader]');
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Chart.js failed to load')));
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.setAttribute('data-chart-electrisim-loader', 'true');
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Chart.js failed to load'));
            document.head.appendChild(script);
        });
    }

    _syncFusePreviewPanel() {
        if (!this._fusePreviewHost) return;
        const prot = this.inputs.get('protection_type')?.value;
        if (prot !== 'fuse') {
            this._fusePreviewHost.style.display = 'none';
            if (this._fusePreviewDebounce) {
                clearTimeout(this._fusePreviewDebounce);
                this._fusePreviewDebounce = null;
            }
            this._clearFusePreviewChart();
            return;
        }
        this._fusePreviewHost.style.display = '';
        const rawFuse = this.inputs.get('fuse_type')?.value || '';
        if (!rawFuse) {
            this._fusePreviewHint.textContent =
                'Select a fuse type to plot the melting curve (log–log), sampled like pandapower’s protection characteristic.';
            this._clearFusePreviewChart();
            return;
        }
        if (rawFuse === CUSTOM_FUSE_TYPE_VALUE) {
            const nm = (this.inputs.get('fuse_custom_name')?.value || '').trim();
            const jsonStr = (this.inputs.get('fuse_custom_std_json')?.value || '').trim();
            const ir = parseFloat(this.inputs.get('rated_i_a')?.value || '');
            if (!nm || !jsonStr || !ir || ir <= 0) {
                this._fusePreviewHint.textContent =
                    'Enter the custom fuse name, positive rated current [A], and valid curve JSON to preview.';
                this._clearFusePreviewChart();
                return;
            }
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('invalid');
                }
            } catch (e) {
                this._fusePreviewHint.textContent = 'Curve JSON is invalid; fix it to preview a custom fuse.';
                this._clearFusePreviewChart();
                return;
            }
        }

        this._fusePreviewHint.textContent = 'Loading curve from backend…';
        if (this._fusePreviewDebounce) clearTimeout(this._fusePreviewDebounce);
        this._fusePreviewDebounce = setTimeout(() => {
            this._fusePreviewDebounce = null;
            this._runFuseCharacteristicPreviewFetch().catch((e) => {
                console.error('Fuse preview failed:', e);
                if (this._fusePreviewHint) {
                    this._fusePreviewHint.textContent =
                        'Could not load preview: ' + (e && e.message ? e.message : String(e));
                }
            });
        }, 380);
    }

    async _runFuseCharacteristicPreviewFetch() {
        if (!this._fusePreviewCanvas || !this._fusePreviewHint) return;
        const seq = ++this._fusePreviewSeq;
        const rawFuse = this.inputs.get('fuse_type')?.value || '';
        let fuse_mode = 'library';
        let fuse_type = rawFuse;
        let fuse_custom_std_json = '';
        if (rawFuse === CUSTOM_FUSE_TYPE_VALUE) {
            fuse_mode = 'custom';
            fuse_type = (this.inputs.get('fuse_custom_name')?.value || '').trim();
            fuse_custom_std_json = (this.inputs.get('fuse_custom_std_json')?.value || '').trim();
        }
        const rated_i_a = parseFloat(this.inputs.get('rated_i_a')?.value || '') || 0;

        const payload = {
            0: {
                typ: 'FuseCharacteristicPreviewPandaPower',
                user_email: this._getUserEmailForFusePreview(),
                fuse_mode,
                fuse_type,
                rated_i_a,
                fuse_custom_std_json
            }
        };

        const url = (ENV.backendUrl || '').replace(/\/?$/, '') + '/';
        const response = await fetch(url, {
            mode: 'cors',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (seq !== this._fusePreviewSeq) return;
        if (!response.ok) {
            this._fusePreviewHint.textContent =
                'Backend error ' + response.status + ': ' + (data.message || response.statusText || '');
            this._clearFusePreviewChart();
            return;
        }
        if (data.error) {
            this._fusePreviewHint.textContent = data.message || 'Could not build fuse curve.';
            this._clearFusePreviewChart();
            return;
        }
        const ia = data.i_a || [];
        const ts = data.t_s || [];
        if (!ia.length || !ts.length || ia.length !== ts.length) {
            this._fusePreviewHint.textContent = 'No curve points returned for this fuse.';
            this._clearFusePreviewChart();
            return;
        }

        const pts = [];
        for (let k = 0; k < ia.length; k++) {
            const x = Number(ia[k]);
            const y = Number(ts[k]);
            if (!isFinite(x) || x <= 0 || !isFinite(y) || y <= 0) continue;
            pts.push({ x, y });
        }
        pts.sort((a, b) => a.x - b.x);
        if (!pts.length) {
            this._fusePreviewHint.textContent = 'Curve sample produced no valid I–t points.';
            this._clearFusePreviewChart();
            return;
        }

        const ax = data.axis || {};
        let xMin = ax.i_a_min;
        let xMax = ax.i_a_max;
        let yMin = ax.t_s_min;
        let yMax = ax.t_s_max;
        if (xMin == null || xMax == null || yMin == null || yMax == null) {
            const xi = pts.map((p) => p.x);
            const yi = pts.map((p) => p.y);
            const loI = Math.min(...xi);
            const hiI = Math.max(...xi);
            const loT = Math.min(...yi);
            const hiT = Math.max(...yi);
            xMin = Math.pow(10, Math.floor(Math.log10(loI)));
            xMax = Math.pow(10, Math.ceil(Math.log10(hiI)));
            yMin = Math.pow(10, Math.floor(Math.log10(loT)));
            yMax = Math.pow(10, Math.ceil(Math.log10(hiT)));
        }

        await this._ensureChartJsForFusePreview();
        if (seq !== this._fusePreviewSeq) return;
        this._clearFusePreviewChart();
        const label = data.fuse_type || 'Fuse';
        try {
            this._fusePreviewChart = new window.Chart(this._fusePreviewCanvas, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label,
                            data: pts,
                            showLine: true,
                            fill: false,
                            borderColor: '#1f77b4',
                            backgroundColor: '#1f77b4',
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            borderWidth: 2,
                            tension: 0,
                            spanGaps: false,
                            parsing: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: false },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Time-Current Characteristic of Fuse',
                            font: { size: 15, weight: '600' },
                            color: '#222',
                            padding: { bottom: 8 }
                        },
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const v = ctx.raw;
                                    if (!v) return '';
                                    return `I=${Number(v.x).toPrecision(5)} A, t=${Number(v.y).toPrecision(5)} s`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'logarithmic',
                            min: xMin,
                            max: xMax,
                            title: {
                                display: true,
                                text: 'I [A]',
                                font: { size: 12, weight: '600' },
                                color: '#222'
                            },
                            ticks: { color: '#333', maxRotation: 0 },
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.12)' },
                            border: { display: true, color: '#333' }
                        },
                        y: {
                            type: 'logarithmic',
                            min: yMin,
                            max: yMax,
                            title: {
                                display: true,
                                text: 'time [s]',
                                font: { size: 12, weight: '600' },
                                color: '#222'
                            },
                            ticks: { color: '#333' },
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.12)' },
                            border: { display: true, color: '#333' }
                        }
                    }
                }
            });
            this._fusePreviewHint.textContent =
                'Log–log plot (same sampling as pandapower Fuse.plot_protection_characteristic).';
        } catch (e) {
            this._fusePreviewHint.textContent = 'Chart error: ' + (e && e.message ? e.message : String(e));
        }
    }
    
    getFormValues() {
        const values = {};
        
        [
            ...this.loadFlowParameters,
            ...this.shortCircuitParameters,
            ...this.opfParameters,
            ...(this.economicParameters || []),
            ...(this.protectionParameters || [])
        ].forEach(param => {
            if (param.type === 'info') return; // banner row, not an editable value
            const input = this.inputs.get(param.id);
            if (input) {
                if (param.id === 'cost_per_unit_by_currency') {
                    values[param.id] = input.value || '0';
                } else if (param.type === 'number') {
                    values[param.id] = parseFloat(input.value) || 0;
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else if (param.type === 'select') {
                    values[param.id] = input.value;
                } else if (param.type === 'textarea') {
                    values[param.id] = input.value;
                } else {
                    values[param.id] = input.value;
                }
            }
        });

        const fuseTypeEl = this.inputs.get('fuse_type');
        const rawFuseSel = fuseTypeEl ? fuseTypeEl.value : '';
        if (rawFuseSel === CUSTOM_FUSE_TYPE_VALUE) {
            values.fuse_mode = 'custom';
            values.fuse_type = (this.inputs.get('fuse_custom_name')?.value || '').trim();
            values.fuse_custom_std_json = (this.inputs.get('fuse_custom_std_json')?.value || '').trim();
        } else {
            values.fuse_mode = 'library';
            values.fuse_type = rawFuseSel;
            values.fuse_custom_std_json = '';
        }
        delete values.fuse_custom_name;

        return values;
    }
    
    destroy() {
        if (this._fusePreviewDebounce) {
            clearTimeout(this._fusePreviewDebounce);
            this._fusePreviewDebounce = null;
        }
        this._clearFusePreviewChart();
        super.destroy();

        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
    }
    
    populateDialog(cellData) {
        if (cellData && cellData.attributes) {
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                if (attributeName === 'cost_per_unit_by_currency') {
                    this.data[attributeName] = attributeValue;
                    const ep = this.economicParameters?.find(p => p.id === attributeName);
                    if (ep) ep.value = attributeValue.toString();
                }
                if (attributeName === 'fuse_mode') {
                    this.data.fuse_mode = String(attributeValue || 'library');
                }
                if (attributeName === 'fuse_custom_std_json') {
                    this.data.fuse_custom_std_json = String(attributeValue ?? '');
                }
                if (attributeName === 'fuse_type') {
                    this.data.fuse_type = String(attributeValue ?? '');
                }

                const allParams = [
                    ...this.loadFlowParameters,
                    ...this.shortCircuitParameters,
                    ...this.opfParameters,
                    ...(this.economicParameters || []),
                    ...(this.protectionParameters || [])
                ];
                const param = allParams.find(p => p.id === attributeName);
                if (param) {
                    if (param.type === 'checkbox') {
                        param.value = attributeValue === 'true' || attributeValue === true;
                        const input = this.inputs.get(attributeName);
                        if (input) input.checked = param.value;
                    } else if (param.type === 'select') {
                        param.value = attributeValue;
                        const input = this.inputs.get(attributeName);
                        if (input) input.value = attributeValue;
                    } else if (param.type === 'textarea') {
                        param.value = String(attributeValue ?? '');
                        const input = this.inputs.get(attributeName);
                        if (input) input.value = String(attributeValue ?? '');
                    } else {
                        param.value = attributeValue;
                        const input = this.inputs.get(attributeName);
                        if (input) input.value = attributeValue;
                    }
                }
                if (typeof this._refreshProtectionVisibility === 'function') {
                    this._refreshProtectionVisibility();
                }
            }
        }

        const fuseParam = this.protectionParameters.find((p) => p.id === 'fuse_type');
        const fuseSel = this.inputs.get('fuse_type');
        const fuseMode = String(this.data.fuse_mode || 'library').toLowerCase();
        const jsonNonEmpty = String(this.data.fuse_custom_std_json || '').trim() !== '';
        const storedName = this.data.fuse_type != null ? String(this.data.fuse_type) : '';
        const inferredCustom =
            fuseMode === 'custom' ||
            (jsonNonEmpty && storedName && !PANDAPOWER_STANDARD_FUSE_TYPES.includes(storedName));

        if (fuseSel && fuseSel.tagName === 'SELECT' && fuseParam) {
            if (inferredCustom) {
                this.data.fuse_mode = 'custom';
                fuseParam.value = CUSTOM_FUSE_TYPE_VALUE;
                fuseSel.value = CUSTOM_FUSE_TYPE_VALUE;
                const nameInp = this.inputs.get('fuse_custom_name');
                const nameParam = this.protectionParameters.find((p) => p.id === 'fuse_custom_name');
                if (nameParam) nameParam.value = storedName;
                if (nameInp) nameInp.value = storedName;
                const jInp = this.inputs.get('fuse_custom_std_json');
                const jParam = this.protectionParameters.find((p) => p.id === 'fuse_custom_std_json');
                const jRaw = this.data.fuse_custom_std_json;
                const jVal = String(jRaw ?? '').trim()
                    ? String(jRaw)
                    : FUSE_CUSTOM_CURVE_JSON_EXAMPLE;
                if (jParam) jParam.value = jVal;
                if (jInp) jInp.value = jVal;
            } else {
                const v = fuseParam.value != null ? String(fuseParam.value) : '';
                const has = v === '' || Array.from(fuseSel.options).some((o) => o.value === v);
                if (!has && v) {
                    const leg = document.createElement('option');
                    leg.value = v;
                    leg.textContent = `${v} (legacy)`;
                    fuseSel.appendChild(leg);
                }
                fuseSel.value = v;
            }
        }

        if (typeof this._refreshProtectionVisibility === 'function') {
            this._refreshProtectionVisibility();
        }
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.SwitchDialog = SwitchDialog;
    window.defaultSwitchData = defaultSwitchData;
    window.PANDAPOWER_STANDARD_FUSE_TYPES = PANDAPOWER_STANDARD_FUSE_TYPES;
    window.ratedCurrentAmpsFromFuseType = ratedCurrentAmpsFromFuseType;
    window.CUSTOM_FUSE_TYPE_VALUE = CUSTOM_FUSE_TYPE_VALUE;
    window.FUSE_CUSTOM_CURVE_JSON_EXAMPLE = FUSE_CUSTOM_CURVE_JSON_EXAMPLE;
}
