import { Dialog } from './Dialog.js';

function phaseConnFields(data) {
    return [
        {
            id: 'phase',
            label: 'Phase',
            symbol: 'phase',
            description: 'OpenDSS phase node (1, 2, or 3)',
            type: 'select',
            value: String(data.phase ?? 1),
            options: [
                { value: '1', label: 'Phase 1' },
                { value: '2', label: 'Phase 2' },
                { value: '3', label: 'Phase 3' }
            ]
        },
        {
            id: 'conn',
            label: 'Connection',
            symbol: 'conn',
            description: 'Wye (L-N) for radial single-phase lines. Delta (L-L) needs two energized nodes on the bus.',
            type: 'select',
            value: data.conn || 'wye',
            options: [
                { value: 'wye', label: 'Wye (L-N)' },
                { value: 'delta', label: 'Delta (L-L)' }
            ]
        }
    ];
}

function addInputFocusEffects(input) {
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

class OpenDss1phDialogBase extends Dialog {
    constructor(title, defaultData, parameters) {
        super(title, 'Apply');
        this.ui = null;
        this.data = { ...defaultData };
        this.parameters = parameters;
        this._description = '';
    }

    getDescription() {
        return this._description || '';
    }

    populateDialog(cellValue) {
        if (!cellValue?.attributes) return;
        for (let i = 0; i < cellValue.attributes.length; i++) {
            const attr = cellValue.attributes[i];
            const id = attr.name;
            const val = attr.value;
            if (this.data[id] !== undefined) {
                if (typeof this.data[id] === 'boolean') {
                    this.data[id] = val === 'true' || val === true;
                } else if (typeof this.data[id] === 'number') {
                    const n = parseFloat(val);
                    this.data[id] = Number.isFinite(n) ? n : this.data[id];
                } else {
                    this.data[id] = val;
                }
            }
        }
        if (this.data.p_kw === 0 && cellValue.attributes.getNamedItem('p_mw')) {
            const legacyP = parseFloat(cellValue.attributes.getNamedItem('p_mw').nodeValue);
            if (Number.isFinite(legacyP) && legacyP !== 0) {
                this.data.p_kw = legacyP * 1000;
            }
        }
        if (this.data.q_kvar === 0 && cellValue.attributes.getNamedItem('q_mvar')) {
            const legacyQ = parseFloat(cellValue.attributes.getNamedItem('q_mvar').nodeValue);
            if (Number.isFinite(legacyQ) && legacyQ !== 0) {
                this.data.q_kvar = legacyQ * 1000;
            }
        }
        this.parameters.forEach(p => {
            if (this.data[p.id] !== undefined) {
                p.value = typeof this.data[p.id] === 'boolean'
                    ? this.data[p.id]
                    : String(this.data[p.id]);
            }
        });
    }

    createButton(text, bgColor, hoverColor) {
        const button = document.createElement('button');
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

    createForm() {
        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        this.parameters.forEach(param => {
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
            if (param.symbol) labelText += ` (${param.symbol})`;
            if (param.unit) labelText += ` [${param.unit}]`;
            label.textContent = labelText;
            label.htmlFor = param.id;
            leftColumn.appendChild(label);

            if (param.description) {
                const desc = document.createElement('div');
                Object.assign(desc.style, {
                    fontSize: '12px',
                    color: '#6c757d',
                    lineHeight: '1.4',
                    fontStyle: 'italic',
                    marginBottom: '4px'
                });
                desc.textContent = param.description;
                leftColumn.appendChild(desc);
            }

            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: isNameField ? 'stretch' : 'flex-end',
                minHeight: '60px',
                width: isNameField ? '100%' : '200px',
                ...(isNameField ? { minWidth: '0' } : {})
            });

            let input;
            if (param.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = param.value === true || param.value === 'true';
                Object.assign(input.style, {
                    width: '24px',
                    height: '24px',
                    accentColor: '#007bff',
                    cursor: 'pointer',
                    margin: '0'
                });
            } else if (param.type === 'select') {
                input = document.createElement('select');
                (param.options || []).forEach(opt => {
                    const optionElement = document.createElement('option');
                    if (typeof opt === 'object' && opt !== null && 'value' in opt) {
                        optionElement.value = String(opt.value);
                        optionElement.textContent = opt.label != null ? String(opt.label) : String(opt.value);
                    } else {
                        optionElement.value = String(opt);
                        optionElement.textContent = String(opt);
                    }
                    if (String(param.value) === optionElement.value) {
                        optionElement.selected = true;
                    }
                    input.appendChild(optionElement);
                });
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
                    outline: 'none',
                    cursor: 'pointer'
                });
                addInputFocusEffects(input);
            } else {
                input = document.createElement('input');
                input.type = param.type === 'number' ? 'number' : 'text';
                input.value = param.value ?? '';
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
                addInputFocusEffects(input);
                if (param.type === 'number') {
                    if (param.step) input.step = param.step;
                    if (param.min !== undefined) input.min = param.min;
                    if (param.max !== undefined) input.max = param.max;
                }
            }

            input.id = param.id;
            this.inputs.set(param.id, input);
            rightColumn.appendChild(input);
            parameterRow.appendChild(leftColumn);
            parameterRow.appendChild(rightColumn);
            form.appendChild(parameterRow);
        });

        return form;
    }

    show(callback) {
        this.callback = callback;
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        this.inputs.clear();

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
        contentArea.appendChild(this.createForm());
        container.appendChild(contentArea);

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef',
            flexShrink: '0'
        });

        const cancelButton = this.createButton('Cancel', '#6c757d', '#5a6268');
        const applyButton = this.createButton('Apply', '#007bff', '#0056b3');

        cancelButton.onclick = (e) => {
            e.preventDefault();
            this.destroy();
            if (this.ui?.hideDialog) this.ui.hideDialog();
        };

        applyButton.onclick = (e) => {
            e.preventDefault();
            const values = this.getFormValues();
            this.callback?.(values);
            this.destroy();
            if (this.ui?.hideDialog) this.ui.hideDialog();
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);
        this.container = container;

        if (this.ui?.showDialog) {
            const screenHeight = window.innerHeight - 80;
            this.ui.showDialog(container, 1000, screenHeight, true, false, () => {
                this.destroy();
                return 1;
            });
        } else {
            this.showModalFallback(container);
        }
    }

    getFormValues() {
        const values = {};
        (this.parameters || []).forEach(param => {
            if (param.type === 'checkbox') {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.checked : Boolean(param.value);
            } else if (param.type === 'number') {
                const input = this.inputs.get(param.id);
                const raw = input ? input.value : param.value;
                values[param.id] = raw === '' || raw == null ? 0 : (parseFloat(raw) || 0);
            } else if (param.type === 'select') {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.value : param.value;
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.value : param.value;
            }
        });
        return values;
    }
}

export const defaultLoad1phData = {
    name: 'Load 1ph',
    p_kw: 0,
    q_kvar: 0,
    kv: '',
    pf: 1.0,
    phase: 1,
    conn: 'wye',
    spectrum: 'defaultload',
    pctSeriesRL: 100,
    in_service: true
};

export class Load1phDialog extends OpenDss1phDialogBase {
    constructor(editorUi) {
        super('Load 1ph (OpenDSS)', defaultLoad1phData, [
            { id: 'name', label: 'Name', symbol: 'name', description: 'Name identifier for the load', type: 'text', value: 'Load 1ph' },
            { id: 'p_kw', label: 'Active Power', symbol: 'p_kw', unit: 'kW', description: 'Active power of the single-phase load (>=0)', type: 'number', value: '0', step: '0.1', min: '0' },
            { id: 'q_kvar', label: 'Reactive Power', symbol: 'q_kvar', unit: 'kVar', description: 'Reactive power of the load', type: 'number', value: '0', step: '0.1' },
            { id: 'kv', label: 'Rated Voltage', symbol: 'kv', unit: 'kV', description: 'Rated kV (L-N or L-L). Leave empty to use bus nominal voltage.', type: 'number', value: '', step: '0.001' },
            { id: 'pf', label: 'Power Factor', symbol: 'pf', description: 'Power factor when Q is derived from P', type: 'number', value: '1', step: '0.01', min: '0' },
            ...phaseConnFields(defaultLoad1phData),
            { id: 'in_service', label: 'In Service', symbol: 'in_service', description: 'Whether the load is included in the simulation', type: 'checkbox', value: true }
        ]);
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this._description = '<strong>Configure Load 1ph Parameters</strong><br>OpenDSS single-phase load (<code>phases=1</code>). See the <a href="https://electrisim.com/documentation.html#load-1ph" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }
}

export const defaultSource1phData = {
    name: 'Source 1ph',
    vm_pu: 1.0,
    va_degree: 0,
    s_sc_max_mva: 1000,
    phase: 1,
    conn: 'wye',
    in_service: true
};

export class Source1phDialog extends OpenDss1phDialogBase {
    constructor(editorUi) {
        super('Source 1ph (OpenDSS)', defaultSource1phData, [
            { id: 'name', label: 'Name', symbol: 'name', description: 'Name identifier for the source', type: 'text', value: 'Source 1ph' },
            { id: 'vm_pu', label: 'Voltage', symbol: 'vm_pu', unit: 'pu', description: 'Slack bus voltage in per unit', type: 'number', value: '1', step: '0.001' },
            { id: 'va_degree', label: 'Angle', symbol: 'va_degree', unit: 'deg', description: 'Slack bus voltage angle', type: 'number', value: '0', step: '0.1' },
            { id: 's_sc_max_mva', label: 'Short-circuit Power', symbol: 's_sc_max_mva', unit: 'MVA', description: 'Short-circuit MVA for Thevenin impedance', type: 'number', value: '1000', step: '1' },
            ...phaseConnFields(defaultSource1phData),
            { id: 'in_service', label: 'In Service', symbol: 'in_service', description: 'Whether the source is enabled', type: 'checkbox', value: true }
        ]);
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this._description = '<strong>Configure Source 1ph Parameters</strong><br>OpenDSS single-phase Vsource slack element (<code>Phases=1</code>). See the <a href="https://electrisim.com/documentation.html#source-1ph" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }
}

export const defaultLine1phData = {
    name: 'Line 1ph',
    length_km: 1,
    r_ohm_per_km: 0.122,
    x_ohm_per_km: 0.112,
    c_nf_per_km: 0,
    phase: 1,
    conn: 'wye',
    in_service: true
};

export class Line1phDialog extends OpenDss1phDialogBase {
    constructor(editorUi) {
        super('Line 1ph (OpenDSS)', defaultLine1phData, [
            { id: 'name', label: 'Name', symbol: 'name', description: 'Name identifier for the line', type: 'text', value: 'Line 1ph' },
            { id: 'length_km', label: 'Length', symbol: 'length_km', unit: 'km', description: 'Line length', type: 'number', value: '1', step: '0.001', min: '0' },
            { id: 'r_ohm_per_km', label: 'Resistance', symbol: 'r_ohm_per_km', unit: 'ohm/km', description: 'Series resistance per km', type: 'number', value: '0.122', step: '0.0001' },
            { id: 'x_ohm_per_km', label: 'Reactance', symbol: 'x_ohm_per_km', unit: 'ohm/km', description: 'Series reactance per km', type: 'number', value: '0.112', step: '0.0001' },
            { id: 'c_nf_per_km', label: 'Capacitance', symbol: 'c_nf_per_km', unit: 'nF/km', description: 'Shunt capacitance per km (0 if ignored)', type: 'number', value: '0', step: '0.1' },
            ...phaseConnFields(defaultLine1phData),
            { id: 'in_service', label: 'In Service', symbol: 'in_service', description: 'Whether the line is included in the simulation', type: 'checkbox', value: true }
        ]);
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this._description = '<strong>Configure Line 1ph Parameters</strong><br>OpenDSS single-phase line (<code>phases=1</code>). Connect between two buses. See the <a href="https://electrisim.com/documentation.html#line-1ph" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }
}

export const defaultTransformer1phData = {
    name: 'Transformer 1ph',
    sn_kva: 25,
    vk_percent: 2.0,
    vkr_percent: 0.6,
    vn_hv_kv: 7.2,
    vn_lv_kv: 0.12,
    phase: 1,
    conn: 'wye',
    tap_pos: 0,
    in_service: true
};

export class Transformer1phDialog extends OpenDss1phDialogBase {
    constructor(editorUi) {
        super('Transformer 1ph (OpenDSS)', defaultTransformer1phData, [
            { id: 'name', label: 'Name', symbol: 'name', description: 'Name identifier for the transformer', type: 'text', value: 'Transformer 1ph' },
            { id: 'sn_kva', label: 'Rated Power', symbol: 'sn_kva', unit: 'kVA', description: 'Transformer rated apparent power', type: 'number', value: '25', step: '0.1', min: '0' },
            { id: 'vk_percent', label: 'Short-circuit Voltage', symbol: 'vk_percent', unit: '%', description: 'Short-circuit voltage vk', type: 'number', value: '2', step: '0.01' },
            { id: 'vkr_percent', label: 'Resistive Part vk', symbol: 'vkr_percent', unit: '%', description: 'Resistive part of short-circuit voltage', type: 'number', value: '0.6', step: '0.01' },
            { id: 'vn_hv_kv', label: 'HV Rated Voltage', symbol: 'vn_hv_kv', unit: 'kV', description: 'High-voltage winding rated voltage', type: 'number', value: '7.2', step: '0.001' },
            { id: 'vn_lv_kv', label: 'LV Rated Voltage', symbol: 'vn_lv_kv', unit: 'kV', description: 'Low-voltage winding rated voltage', type: 'number', value: '0.12', step: '0.001' },
            ...phaseConnFields(defaultTransformer1phData),
            { id: 'tap_pos', label: 'Tap Position', symbol: 'tap_pos', description: 'Tap changer position', type: 'number', value: '0', step: '1' },
            { id: 'in_service', label: 'In Service', symbol: 'in_service', description: 'Whether the transformer is included in the simulation', type: 'checkbox', value: true }
        ]);
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this._description = '<strong>Configure Transformer 1ph Parameters</strong><br>OpenDSS 2-winding single-phase transformer (<code>phases=1 Windings=2</code>). See the <a href="https://electrisim.com/documentation.html#transformer-1ph" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }
}

export const defaultGenerator1phData = {
    name: 'Generator 1ph',
    p_kw: 0,
    q_kvar: 0,
    kv: '',
    sn_kva: '',
    model: 1,
    phase: 1,
    conn: 'wye',
    spectrum: 'defaultgen',
    in_service: true
};

export class Generator1phDialog extends OpenDss1phDialogBase {
    constructor(editorUi) {
        super('Generator 1ph (OpenDSS)', defaultGenerator1phData, [
            { id: 'name', label: 'Name', symbol: 'name', description: 'Name identifier for the generator', type: 'text', value: 'Generator 1ph' },
            { id: 'p_kw', label: 'Active Power', symbol: 'p_kw', unit: 'kW', description: 'Generated active power (>=0)', type: 'number', value: '0', step: '0.1', min: '0' },
            { id: 'q_kvar', label: 'Reactive Power', symbol: 'q_kvar', unit: 'kVar', description: 'Generated reactive power', type: 'number', value: '0', step: '0.1' },
            { id: 'kv', label: 'Rated Voltage', symbol: 'kv', unit: 'kV', description: 'Rated kV (L-N or L-L). Leave empty to use bus nominal voltage.', type: 'number', value: '', step: '0.001' },
            { id: 'sn_kva', label: 'Rated Power', symbol: 'sn_kva', unit: 'kVA', description: 'Optional generator kVA rating', type: 'number', value: '', step: '0.1', min: '0' },
            {
                id: 'model',
                label: 'Model',
                symbol: 'model',
                description: '1 = constant P and Q (recommended for snapshot load flow)',
                type: 'select',
                value: '1',
                options: [
                    { value: '1', label: '1 — Constant P and Q' },
                    { value: '3', label: '3 — Constant P, fixed power factor' }
                ]
            },
            ...phaseConnFields(defaultGenerator1phData),
            { id: 'in_service', label: 'In Service', symbol: 'in_service', description: 'Whether the generator is enabled', type: 'checkbox', value: true }
        ]);
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this._description = '<strong>Configure Generator 1ph Parameters</strong><br>OpenDSS single-phase generator (<code>phases=1</code>). OpenDSS-only dispatchable source. See the <a href="https://electrisim.com/documentation.html#generator-1ph" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }
}
