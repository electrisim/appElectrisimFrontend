import { Dialog } from './Dialog.js';
import { createEconomicTabContent, buildCostPerUnitByCurrency } from './utils/economicTabHelper.js';
import { createDialogBracketGroup } from './utils/dialogBracketGroup.js';

// Default values for shunt reactor parameters (based on pandapower documentation)
export const defaultShuntReactorData = {
    name: "Shunt Reactor",
    p_mw: 0.0,
    q_mvar: 0.0,
    vn_kv: 0.0,
    step: 1.0,
    max_step: 1.0,
    in_service: true,
    /** If true, P and Q at v=1 p.u. come from the shunt characteristic table per step (pandapower step_dependency_table). */
    step_dependency_table: false,
    /** JSON string: [{ step, p_mw, q_mvar }, ...] for net.shunt_characteristic_table */
    shunt_characteristic_table_json: "[]",
    discrete_shunt_control: false,
    vm_set_pu: 1.0,
    shunt_control_increment: 1,
    shunt_control_tol: 0.01,
    shunt_reset_at_init: false,
    /** Set shunt step from line active power via P-bands (CharacteristicControl; mutually exclusive with discrete_shunt_control). */
    line_flow_step_control: false,
    /** Diagram cell id of the Line whose res_line P is used for the lookup. */
    line_flow_reference_line_id: '',
    /** JSON: [{ p_mw_min, p_mw_max, step }, ...] — passed to backend as line_flow_step_table_json. */
    line_flow_step_table_json: '[]',
    /** Use |P| from the line result (line_flow_p_use_abs). */
    line_flow_p_use_abs: true,
    /** res_line column: p_from_mw or p_to_mw (line_flow_p_reference). */
    line_flow_p_reference: 'p_from_mw',
    cost_per_unit_by_currency: "0"
};

export function parseShuntCharacteristicTableJson(s) {
    if (s == null || s === "") return [];
    try {
        const v = typeof s === "string" ? JSON.parse(s) : s;
        return Array.isArray(v) ? v : [];
    } catch (e) {
        return [];
    }
}

function normalizeShuntCharRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return [{ step: 0, p_mw: 0, q_mvar: 0 }];
    }
    return rows.map((r) => ({
        step: Number.isFinite(parseInt(r.step, 10)) ? parseInt(r.step, 10) : 0,
        p_mw: parseFloat(r.p_mw) || 0,
        q_mvar: parseFloat(r.q_mvar) || 0
    })).sort((a, b) => a.step - b.step);
}

export function parseLineFlowStepTableJson(s) {
    if (s == null || s === '') return [];
    try {
        const v = typeof s === 'string' ? JSON.parse(s) : s;
        return Array.isArray(v) ? v : [];
    } catch (e) {
        return [];
    }
}

function normalizeLineFlowRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return [{ p_mw_min: 0, p_mw_max: 100, step: 0 }];
    }
    return rows.map((r) => ({
        p_mw_min: parseFloat(r.p_mw_min) || 0,
        p_mw_max: parseFloat(r.p_mw_max) || 0,
        step: Number.isFinite(parseInt(r.step, 10)) ? parseInt(r.step, 10) : 0
    }));
}

export class ShuntReactorDialog extends Dialog {
    constructor(editorUi) {
        super('Shunt Reactor Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'power';
        this.data = { ...defaultShuntReactorData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        this._charTableBody = null;
        this._charTableSection = null;
        this._charTableRows = normalizeShuntCharRows([]);
        this._lineFlowTableBody = null;
        this._lineFlowTableSection = null;
        this._lineFlowTableRows = normalizeLineFlowRows([]);
        
        // Power parameters (necessary for executing a power flow calculation)
        this.powerParameters = [
            {
                id: 'name',
                label: 'Shunt Reactor Name (name)',
                description: 'Name identifier for the shunt reactor (diagram / export attribute: name).',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'p_mw',
                label: 'Active Power (MW) (p_mw)',
                description: 'Shunt active power in MW at v = 1.0 p.u. (p_mw).',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'q_mvar',
                label: 'Reactive Power (MVar) (q_mvar)',
                description: 'Shunt reactive power in MVAr at v = 1.0 p.u. (q_mvar).',
                type: 'number',
                value: this.data.q_mvar.toString(),
                step: '0.1'
            }
        ];
        
        // Electrical parameters
        this.electricalParameters = [
            {
                id: 'vn_kv',
                label: 'Rated Voltage (kV) (vn_kv)',
                description: 'Rated voltage of the shunt; defaults to the connected bus if appropriate (vn_kv).',
                type: 'number',
                value: this.data.vn_kv.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
        // Control parameters
        this.controlParameters = [
            {
                id: 'step',
                label: 'Step Position (step)',
                description: 'Current shunt step; with the characteristic table off, P/Q scale with this step (step).',
                type: 'number',
                value: this.data.step.toString(),
                step: '1',
                min: '0'
            },
            {
                id: 'max_step',
                label: 'Maximum Step (max_step)',
                description: 'Maximum step index for the shunt; used with the table and “Fill 0…max” (max_step).',
                type: 'number',
                value: this.data.max_step.toString(),
                step: '1',
                min: '0'
            },
            {
                id: 'in_service',
                label: 'In Service (in_service)',
                description: 'Whether the shunt is in service in the model (in_service).',
                type: 'checkbox',
                value: this.data.in_service
            },
            {
                id: 'step_dependency_table',
                label: 'Shunt characteristic table — step-dependent P/Q (step_dependency_table)',
                description: 'If enabled, P and Q at v = 1.0 p.u. per step follow the table below; stored in pandapower as step_dependency_table + shunt characteristic data (see shunt_characteristic_table_json).',
                type: 'checkbox',
                value: this.data.step_dependency_table
            },
            {
                id: 'discrete_shunt_control',
                label: 'Discrete shunt control (discrete_shunt_control)',
                description: 'Enable DiscreteShuntController: move step toward vm_set_pu (requires shunt in Include controller in Load Flow).',
                type: 'checkbox',
                value: this.data.discrete_shunt_control,
                bracketGroup: 'discreteShuntControl',
                bracketGroupTitle: 'Discrete shunt control (discrete_shunt_control)'
            },
            {
                id: 'vm_set_pu',
                label: 'Voltage setpoint [pu] (vm_set_pu)',
                description: 'Target shunt bus voltage in p.u. for DiscreteShuntController (vm_set_pu).',
                type: 'number',
                value: this.data.vm_set_pu.toString(),
                step: '0.01',
                min: '0.8',
                bracketGroup: 'discreteShuntControl'
            },
            {
                id: 'shunt_control_increment',
                label: 'Controller step increment (shunt_control_increment)',
                description: 'Step positions to move per control iteration, integer ≥ 1 (shunt_control_increment).',
                type: 'number',
                value: String(this.data.shunt_control_increment),
                step: '1',
                min: '1',
                bracketGroup: 'discreteShuntControl'
            },
            {
                id: 'shunt_control_tol',
                label: 'Voltage tolerance [pu] (shunt_control_tol)',
                description: 'No control action if voltage is within this band around vm_set_pu (shunt_control_tol).',
                type: 'number',
                value: String(this.data.shunt_control_tol),
                step: '0.0005',
                min: '0',
                bracketGroup: 'discreteShuntControl'
            },
            {
                id: 'shunt_reset_at_init',
                label: 'Reset step at controller init (shunt_reset_at_init)',
                description: 'If enabled, reset shunt step at controller init in pandapower (shunt_reset_at_init / reset_at_init).',
                type: 'checkbox',
                value: this.data.shunt_reset_at_init,
                bracketGroup: 'discreteShuntControl'
            },
            {
                id: 'line_flow_step_control',
                label: 'Line P → shunt step lookup (line_flow_step_control)',
                description: 'Maps measured active power on a reference Line to shunt step (pandapower CharacteristicControl). Mutually exclusive with discrete voltage shunt control; requires Load Flow “Include shunt controller”.',
                type: 'checkbox',
                value: this.data.line_flow_step_control,
                bracketGroup: 'lineFlowShuntControl',
                bracketGroupTitle: 'Line power → shunt step (CharacteristicControl)'
            },
            {
                id: 'line_flow_reference_line_id',
                label: 'Reference Line (line_flow_reference_line_id)',
                description: 'Choose a Line from the list (diagram cell id), or use the button to use the line currently selected on the sheet. P from that line’s result drives the P→step table.',
                type: 'text',
                value: this.data.line_flow_reference_line_id,
                bracketGroup: 'lineFlowShuntControl'
            },
            {
                id: 'line_flow_p_use_abs',
                label: 'Use absolute |P| (line_flow_p_use_abs)',
                description: 'If enabled, the controller uses absolute value of the line P from the result table.',
                type: 'checkbox',
                value: this.data.line_flow_p_use_abs,
                bracketGroup: 'lineFlowShuntControl'
            },
            {
                id: 'line_flow_p_reference',
                label: 'Line P column (line_flow_p_reference)',
                description: 'Which res_line column to read: p_from_mw (from-bus) or p_to_mw (to-bus).',
                type: 'text',
                value: this.data.line_flow_p_reference,
                bracketGroup: 'lineFlowShuntControl'
            }
        ];

        // Economic parameters (for Economic Analysis)
        this.economicParameters = [
            { id: 'cost_per_unit_by_currency', label: 'Cost per unit (cost_per_unit_by_currency)', description: 'Economic analysis CAPEX input as JSON or scalar string (cost_per_unit_by_currency).', type: 'text', value: '' }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Shunt Reactor Parameters</strong><br>Set parameters for shunt reactor with power values and step control. ' +
            'See the <a href="https://electrisim.com/documentation.html#shunt" target="_blank" rel="noopener noreferrer">Electrisim documentation</a> for how steps, the characteristic table, and discrete shunt control fit together.';
    }
    
    show(callback) {
        // Store callback for later use
        this.callback = callback;
        
        // Create custom dialog content with tabs
        this.showTabDialog();
    }
    
    showTabDialog() {
        // Use global App if ui is not valid
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        this.graph =
            this.ui?.editor?.graph ||
            this.graph ||
            window.App?.main?.editor?.graph;

        // Create main container
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

        // Add description
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

        // Create tab container
        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex',
            borderBottom: '2px solid #e9ecef',
            marginBottom: '16px'
        });

        // Create tabs
        const powerTab = this.createTab('Power', 'power', this.currentTab === 'power');
        const electricalTab = this.createTab('Electrical', 'electrical', this.currentTab === 'electrical');
        const controlTab = this.createTab('Control', 'control', this.currentTab === 'control');
        const economicTab = this.createTab('Economic', 'economic', this.currentTab === 'economic');
        
        tabContainer.appendChild(powerTab);
        tabContainer.appendChild(electricalTab);
        tabContainer.appendChild(controlTab);
        tabContainer.appendChild(economicTab);
        container.appendChild(tabContainer);

        // Create content area
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

        // Create tab content containers
        const powerContent = this.createTabContent('power', this.powerParameters);
        const electricalContent = this.createTabContent('electrical', this.electricalParameters);
        const controlContent = this.createTabContent('control', this.controlParameters);
        const economicContent = this.createTabContent('economic', this.economicParameters);
        
        contentArea.appendChild(powerContent);
        contentArea.appendChild(electricalContent);
        contentArea.appendChild(controlContent);
        contentArea.appendChild(economicContent);
        container.appendChild(contentArea);

        // Add button container
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
            this.destroy();
            if (this.ui && typeof this.ui.hideDialog === 'function') {
                this.ui.hideDialog();
            }
        };

        applyButton.onclick = (e) => {
            e.preventDefault();
            const values = this.getFormValues();
            console.log('Shunt Reactor values:', values);
            
            if (this.callback) {
                this.callback(values);
            }
            
            this.destroy();
            if (this.ui && typeof this.ui.hideDialog === 'function') {
                this.ui.hideDialog();
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        this.container = container;

        this._wireShuntControlExclusion();
        
        // Tab click handlers
        powerTab.onclick = () => this.switchTab('power', powerTab, [electricalTab, controlTab, economicTab], powerContent, [electricalContent, controlContent, economicContent]);
        electricalTab.onclick = () => this.switchTab('electrical', electricalTab, [powerTab, controlTab, economicTab], electricalContent, [powerContent, controlContent, economicContent]);
        controlTab.onclick = () => this.switchTab('control', controlTab, [powerTab, electricalTab, economicTab], controlContent, [powerContent, electricalContent, economicContent]);
        economicTab.onclick = () => this.switchTab('economic', economicTab, [powerTab, electricalTab, controlTab], economicContent, [powerContent, electricalContent, controlContent]);

        // Show dialog using DrawIO's dialog system
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
    
    _appendShuntCharacteristicSection(form) {
        const wrap = document.createElement('div');
        this._charTableSection = wrap;
        Object.assign(wrap.style, {
            marginTop: '8px',
            padding: '12px',
            backgroundColor: '#f1f3f5',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            borderLeft: '4px solid #0d6efd'
        });

        const title = document.createElement('div');
        Object.assign(title.style, { fontWeight: '600', fontSize: '14px', color: '#343a40', marginBottom: '6px' });
        title.textContent = 'Shunt characteristic table (shunt_characteristic_table_json)';
        wrap.appendChild(title);

        const hint = document.createElement('div');
        Object.assign(hint.style, { fontSize: '12px', color: '#6c757d', lineHeight: '1.45', marginBottom: '10px' });
        hint.innerHTML = 'Diagram / export attribute: <code>shunt_characteristic_table_json</code> (JSON array of ' +
            '<code>{ step, p_mw, q_mvar }</code>). In pandapower this becomes <code>net.shunt_characteristic_table</code> ' +
            'when <code>step_dependency_table</code> is on. One row per step; cover 0 … <code>max_step</code> as needed.';
        wrap.appendChild(hint);

        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '8px' });
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        ['Step', 'P (MW) at v=1 p.u.', 'Q (Mvar) at v=1 p.u.', ''].forEach((h) => {
            const th = document.createElement('th');
            th.textContent = h;
            Object.assign(th.style, {
                textAlign: 'left',
                padding: '6px 8px',
                borderBottom: '1px solid #ced4da',
                color: '#495057',
                fontSize: '12px'
            });
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        this._charTableBody = tbody;
        table.appendChild(tbody);
        wrap.appendChild(table);

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+ Add row';
        Object.assign(addBtn.style, {
            padding: '5px 12px',
            fontSize: '12px',
            border: '1px solid #0d6efd',
            borderRadius: '4px',
            backgroundColor: '#fff',
            color: '#0d6efd',
            cursor: 'pointer'
        });
        addBtn.onclick = () => {
            const rows = this._readCharRowsFromDom();
            const nextStep = rows.length ? Math.max(...rows.map((r) => r.step)) + 1 : 0;
            rows.push({ step: nextStep, p_mw: 0, q_mvar: 0 });
            this._charTableRows = rows;
            this._renderCharTableBody();
        };

        const fillBtn = document.createElement('button');
        fillBtn.type = 'button';
        fillBtn.textContent = 'Fill steps 0…max step';
        Object.assign(fillBtn.style, {
            padding: '5px 12px',
            fontSize: '12px',
            border: '1px solid #6c757d',
            borderRadius: '4px',
            backgroundColor: '#fff',
            color: '#495057',
            cursor: 'pointer'
        });
        fillBtn.onclick = () => {
            const maxEl = this.inputs.get('max_step');
            const mx = maxEl ? parseInt(maxEl.value, 10) : 1;
            const n = Number.isFinite(mx) && mx >= 0 ? mx : 1;
            const rows = [];
            for (let s = 0; s <= n; s++) {
                rows.push({ step: s, p_mw: 0, q_mvar: 0 });
            }
            this._charTableRows = rows;
            this._renderCharTableBody();
        };

        btnRow.appendChild(addBtn);
        btnRow.appendChild(fillBtn);
        wrap.appendChild(btnRow);

        form.appendChild(wrap);

        this._renderCharTableBody();

        const dep = this.inputs.get('step_dependency_table');
        const sync = () => {
            const on = !!(dep && dep.checked);
            wrap.style.opacity = on ? '1' : '0.55';
            wrap.style.pointerEvents = on ? 'auto' : 'none';
            table.querySelectorAll('input').forEach((inp) => { inp.disabled = !on; });
            addBtn.disabled = !on;
            fillBtn.disabled = !on;
        };
        if (dep) dep.addEventListener('change', sync);
        sync();
    }

    _renderCharTableBody() {
        if (!this._charTableBody) return;
        this._charTableBody.innerHTML = '';
        const rows = normalizeShuntCharRows(this._charTableRows);
        this._charTableRows = rows;
        rows.forEach((row, idx) => {
            const tr = document.createElement('tr');
            const mk = (val, key) => {
                const td = document.createElement('td');
                Object.assign(td.style, { padding: '4px 6px' });
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = 'any';
                inp.value = row[key];
                inp.dataset.rowIndex = String(idx);
                inp.dataset.field = key;
                Object.assign(inp.style, {
                    width: '100%',
                    maxWidth: '140px',
                    padding: '6px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                });
                inp.addEventListener('input', () => {
                    const i = parseInt(inp.dataset.rowIndex, 10);
                    const f = inp.dataset.field;
                    if (!this._charTableRows[i]) return;
                    const num = parseFloat(inp.value);
                    this._charTableRows[i][f] = f === 'step' ? (parseInt(inp.value, 10) || 0) : (Number.isFinite(num) ? num : 0);
                });
                td.appendChild(inp);
                tr.appendChild(td);
            };
            mk(row.step, 'step');
            mk(row.p_mw, 'p_mw');
            mk(row.q_mvar, 'q_mvar');

            const tdDel = document.createElement('td');
            Object.assign(tdDel.style, { padding: '4px 6px', textAlign: 'center' });
            const del = document.createElement('button');
            del.type = 'button';
            del.textContent = '\u00d7';
            Object.assign(del.style, {
                border: 'none',
                background: 'transparent',
                color: '#dc3545',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: '700'
            });
            del.onclick = () => {
                this._charTableRows = this._readCharRowsFromDom().filter((_, j) => j !== idx);
                if (this._charTableRows.length === 0) {
                    this._charTableRows = [{ step: 0, p_mw: 0, q_mvar: 0 }];
                }
                this._renderCharTableBody();
            };
            tdDel.appendChild(del);
            tr.appendChild(tdDel);

            this._charTableBody.appendChild(tr);
        });
    }

    _readCharRowsFromDom() {
        if (!this._charTableBody) return normalizeShuntCharRows(this._charTableRows);
        const out = [];
        this._charTableBody.querySelectorAll('tr').forEach((tr) => {
            const cells = tr.querySelectorAll('input[type="number"]');
            if (cells.length < 3) return;
            out.push({
                step: parseInt(cells[0].value, 10) || 0,
                p_mw: parseFloat(cells[1].value) || 0,
                q_mvar: parseFloat(cells[2].value) || 0
            });
        });
        return normalizeShuntCharRows(out);
    }

    _appendLineFlowStepTableSection(form) {
        const wrap = document.createElement('div');
        this._lineFlowTableSection = wrap;
        Object.assign(wrap.style, {
            marginTop: '8px',
            padding: '12px',
            backgroundColor: '#f1f3f5',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            borderLeft: '4px solid #198754'
        });

        const title = document.createElement('div');
        Object.assign(title.style, { fontWeight: '600', fontSize: '14px', color: '#343a40', marginBottom: '6px' });
        title.textContent = 'P [MW] bands → shunt step (line_flow_step_table_json)';
        wrap.appendChild(title);

        const hint = document.createElement('div');
        Object.assign(hint.style, { fontSize: '12px', color: '#6c757d', lineHeight: '1.45', marginBottom: '10px' });
        hint.innerHTML = 'Each row: active power on the reference line (MW) in [<code>p_mw_min</code>, <code>p_mw_max</code>) ' +
            'maps to integer <code>step</code>. Last band includes the upper bound. JSON is stored as <code>line_flow_step_table_json</code>.';
        wrap.appendChild(hint);

        const table = document.createElement('table');
        Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '8px' });
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        ['P min (MW)', 'P max (MW)', 'Step', ''].forEach((h) => {
            const th = document.createElement('th');
            th.textContent = h;
            Object.assign(th.style, {
                textAlign: 'left',
                padding: '6px 8px',
                borderBottom: '1px solid #ced4da',
                color: '#495057',
                fontSize: '12px'
            });
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        this._lineFlowTableBody = tbody;
        table.appendChild(tbody);
        wrap.appendChild(table);

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+ Add row';
        Object.assign(addBtn.style, {
            padding: '5px 12px',
            fontSize: '12px',
            border: '1px solid #198754',
            borderRadius: '4px',
            backgroundColor: '#fff',
            color: '#198754',
            cursor: 'pointer'
        });
        addBtn.onclick = () => {
            const rows = this._readLineFlowRowsFromDom();
            rows.push({ p_mw_min: 0, p_mw_max: 100, step: 0 });
            this._lineFlowTableRows = normalizeLineFlowRows(rows);
            this._renderLineFlowTableBody();
        };

        btnRow.appendChild(addBtn);
        wrap.appendChild(btnRow);

        form.appendChild(wrap);

        this._renderLineFlowTableBody();

        const lf = this.inputs.get('line_flow_step_control');
        const sync = () => {
            const on = !!(lf && lf.checked);
            wrap.style.opacity = on ? '1' : '0.55';
            wrap.style.pointerEvents = on ? 'auto' : 'none';
            table.querySelectorAll('input').forEach((inp) => { inp.disabled = !on; });
            addBtn.disabled = !on;
        };
        if (lf) lf.addEventListener('change', sync);
        sync();
    }

    _renderLineFlowTableBody() {
        if (!this._lineFlowTableBody) return;
        this._lineFlowTableBody.innerHTML = '';
        const rows = normalizeLineFlowRows(this._lineFlowTableRows);
        this._lineFlowTableRows = rows;
        rows.forEach((row, idx) => {
            const tr = document.createElement('tr');
            const mk = (val, key) => {
                const td = document.createElement('td');
                Object.assign(td.style, { padding: '4px 6px' });
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = 'any';
                inp.value = row[key];
                inp.dataset.rowIndex = String(idx);
                inp.dataset.field = key;
                Object.assign(inp.style, {
                    width: '100%',
                    maxWidth: '140px',
                    padding: '6px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                });
                inp.addEventListener('input', () => {
                    const i = parseInt(inp.dataset.rowIndex, 10);
                    const f = inp.dataset.field;
                    if (!this._lineFlowTableRows[i]) return;
                    const num = parseFloat(inp.value);
                    if (f === 'step') {
                        this._lineFlowTableRows[i][f] = parseInt(inp.value, 10) || 0;
                    } else {
                        this._lineFlowTableRows[i][f] = Number.isFinite(num) ? num : 0;
                    }
                });
                td.appendChild(inp);
                tr.appendChild(td);
            };
            mk(row.p_mw_min, 'p_mw_min');
            mk(row.p_mw_max, 'p_mw_max');
            mk(row.step, 'step');

            const tdDel = document.createElement('td');
            Object.assign(tdDel.style, { padding: '4px 6px', textAlign: 'center' });
            const del = document.createElement('button');
            del.type = 'button';
            del.textContent = '\u00d7';
            Object.assign(del.style, {
                border: 'none',
                background: 'transparent',
                color: '#dc3545',
                fontSize: '16px',
                cursor: 'pointer',
                fontWeight: '700'
            });
            del.onclick = () => {
                this._lineFlowTableRows = this._readLineFlowRowsFromDom().filter((_, j) => j !== idx);
                if (this._lineFlowTableRows.length === 0) {
                    this._lineFlowTableRows = [{ p_mw_min: 0, p_mw_max: 100, step: 0 }];
                }
                this._renderLineFlowTableBody();
            };
            tdDel.appendChild(del);
            tr.appendChild(tdDel);

            this._lineFlowTableBody.appendChild(tr);
        });
    }

    _readLineFlowRowsFromDom() {
        if (!this._lineFlowTableBody) return normalizeLineFlowRows(this._lineFlowTableRows);
        const out = [];
        this._lineFlowTableBody.querySelectorAll('tr').forEach((tr) => {
            const cells = tr.querySelectorAll('input[type="number"]');
            if (cells.length < 3) return;
            out.push({
                p_mw_min: parseFloat(cells[0].value) || 0,
                p_mw_max: parseFloat(cells[1].value) || 0,
                step: parseInt(cells[2].value, 10) || 0
            });
        });
        return normalizeLineFlowRows(out);
    }

    _getCellNameAttribute(cell) {
        if (!cell?.value?.attributes) return '';
        for (let i = 0; i < cell.value.attributes.length; i++) {
            if (cell.value.attributes[i].nodeName === 'name') {
                return String(cell.value.attributes[i].nodeValue || '').trim();
            }
        }
        return '';
    }

    /**
     * Resolves shapeELXXX for a cell. mxUtils.getValue only works on style *objects*;
     * cell.getStyle() is usually a *string* — using getValue on a string always fails, so we parse it.
     * When available, graph.getCellStyle(cell) returns a merged style object (preferred).
     */
    _shapeElXxxFromCell(cell) {
        if (!cell) return null;
        const graph = this.ui?.editor?.graph || this.graph;
        if (graph && typeof graph.getCellStyle === 'function') {
            try {
                const st = graph.getCellStyle(cell);
                if (st && typeof st === 'object') {
                    const v =
                        typeof mxUtils !== 'undefined' && mxUtils.getValue
                            ? mxUtils.getValue(st, 'shapeELXXX', null)
                            : st.shapeELXXX;
                    if (v != null && String(v) !== '') return String(v);
                }
            } catch (e) {
                /* fall through to string parse */
            }
        }
        const model = graph?.getModel?.();
        const raw = (model && typeof model.getStyle === 'function' ? model.getStyle(cell) : null) ?? cell?.getStyle?.();
        if (raw == null || raw === '') return null;
        if (typeof raw === 'string') {
            const parts = String(raw).split(';');
            for (let p = 0; p < parts.length; p++) {
                const part = parts[p].trim();
                if (part.startsWith('shapeELXXX=')) {
                    return part.slice('shapeELXXX='.length);
                }
            }
            return null;
        }
        if (typeof raw === 'object' && typeof mxUtils !== 'undefined' && mxUtils.getValue) {
            const v = mxUtils.getValue(raw, 'shapeELXXX', null);
            return v != null && String(v) !== '' ? String(v) : null;
        }
        return null;
    }

    _collectDiagramLineCells() {
        this.graph =
            this.ui?.editor?.graph ||
            this.graph ||
            (typeof window !== 'undefined' ? window.App?.main?.editor?.graph : null);
        if (!this.graph?.getModel) return [];
        const model = this.graph.getModel();
        const cells = model.getDescendants?.() || [];
        const lines = [];
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            if (!cell) continue;
            const st = cell.getStyle?.();
            if (st && (st.includes('Result') || st.includes('ResultBus') || st.includes('ResultExternalGrid'))) continue;
            const shape = this._shapeElXxxFromCell(cell);
            if (shape !== 'Line') continue;
            lines.push(cell);
        }
        return lines;
    }

    /**
     * Id sent to PandaPower matches network export (loadFlow/networkDataPreparation): `cell.id`.
     * `mxCell.getId()` can differ (layer-prefixed / hierarchical mxGraph ids) and broke resolving the reference line.
     */
    _lineDiagramIdForBackend(cell) {
        if (!cell || cell.id == null) return '';
        return String(cell.id);
    }

    _lineRefOptionLabel(cell) {
        const bid = this._lineDiagramIdForBackend(cell);
        const name = this._getCellNameAttribute(cell);
        return name ? `${name}  —  id: ${bid}` : `Line  —  id: ${bid}`;
    }

    _getLineReferenceSelectItems() {
        const list = this._collectDiagramLineCells();
        return list
            .map((cell) => {
                const value = this._lineDiagramIdForBackend(cell);
                return { value, label: this._lineRefOptionLabel(cell), cell };
            })
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    }

    /**
     * Fills a &lt;select&gt; for reference line: placeholder, diagram lines, optional orphan id.
     * @param {HTMLSelectElement} select
     * @param {string} [ensureValue]  Stored id to keep (add option if not in diagram)
     */
    _renderLineReferenceSelect(select, ensureValue) {
        const wanted = ensureValue != null && ensureValue !== '' ? String(ensureValue) : '';
        while (select.firstChild) select.removeChild(select.firstChild);
        const items = this._getLineReferenceSelectItems();
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = items.length
            ? '— Select a line —'
            : '— No Line elements in this diagram —';
        select.appendChild(ph);
        const have = new Set();
        for (const it of items) {
            have.add(it.value);
            const o = document.createElement('option');
            o.value = it.value;
            o.textContent = it.label;
            select.appendChild(o);
        }
        if (wanted && !have.has(wanted)) {
            const o = document.createElement('option');
            o.value = wanted;
            o.textContent = `(id not in diagram) ${wanted}`;
            select.appendChild(o);
        }
        select.value = wanted;
    }

    _syncControlInputsFromParams() {
        [...this.powerParameters, ...this.electricalParameters, ...this.controlParameters].forEach((param) => {
            const input = this.inputs.get(param.id);
            if (!input) return;
            if (param.type === 'checkbox') {
                input.checked = !!param.value;
            } else if (param.id === 'line_flow_p_reference') {
                input.value = param.value === 'p_to_mw' ? 'p_to_mw' : 'p_from_mw';
            } else if (param.id === 'line_flow_reference_line_id' && input.tagName === 'SELECT') {
                this._renderLineReferenceSelect(input, param.value != null ? String(param.value) : '');
            } else {
                input.value = param.value != null ? String(param.value) : '';
            }
        });
    }

    _applyShuntControlModeUi() {
        const lf = this.inputs.get('line_flow_step_control');
        const dsc = this.inputs.get('discrete_shunt_control');
        const lfs = !!(lf && lf.checked);
        const dcs = !!(dsc && dsc.checked);
        ['line_flow_reference_line_id', 'line_flow_p_use_abs', 'line_flow_p_reference'].forEach((id) => {
            const el = this.inputs.get(id);
            if (el) el.disabled = !lfs;
        });
        ['vm_set_pu', 'shunt_control_increment', 'shunt_control_tol', 'shunt_reset_at_init'].forEach((id) => {
            const el = this.inputs.get(id);
            if (el) el.disabled = !dcs;
        });
        if (this._lineFlowTableSection) {
            const on = lfs;
            this._lineFlowTableSection.style.opacity = on ? '1' : '0.55';
            this._lineFlowTableSection.style.pointerEvents = on ? 'auto' : 'none';
            this._lineFlowTableSection.querySelectorAll('table input').forEach((inp) => { inp.disabled = !on; });
            this._lineFlowTableSection.querySelectorAll('button').forEach((b) => { b.disabled = !on; });
        }
    }

    _wireShuntControlExclusion() {
        const lf = this.inputs.get('line_flow_step_control');
        const dsc = this.inputs.get('discrete_shunt_control');
        lf?.addEventListener('change', () => {
            if (lf.checked && dsc) dsc.checked = false;
            this._applyShuntControlModeUi();
        });
        dsc?.addEventListener('change', () => {
            if (dsc.checked && lf) lf.checked = false;
            this._applyShuntControlModeUi();
        });
        this._applyShuntControlModeUi();
    }

    createTabContent(tabId, parameters) {
        if (tabId === 'economic' && parameters.length > 0 && parameters[0]?.id === 'cost_per_unit_by_currency') {
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

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        let bracketWrap = null;

        parameters.forEach((param, paramIndex) => {
            const prev = paramIndex > 0 ? parameters[paramIndex - 1] : null;
            if (param.bracketGroup && (!prev || prev.bracketGroup !== param.bracketGroup)) {
                bracketWrap = createDialogBracketGroup(param.bracketGroupTitle || '');
                form.appendChild(bracketWrap);
            }
            if (!param.bracketGroup) {
                bracketWrap = null;
            }

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
            if (param.bracketGroup) {
                Object.assign(parameterRow.style, { marginBottom: '0' });
            }
            if (param.id === 'line_flow_reference_line_id') {
                Object.assign(parameterRow.style, { gridTemplateColumns: '1fr minmax(300px, 1.1fr)' });
            }

            // Left column: Label and description
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
            label.textContent = param.label;
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

            // Right column: Input field with fixed width
            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minHeight: '60px',
                width: isNameField ? '100%' : (param.id === 'line_flow_reference_line_id' ? '100%' : '200px'),
                ...(isNameField ? { minWidth: '0' } : {}),
                ...(param.id === 'line_flow_reference_line_id' ? { minWidth: '280px' } : {})
            });
            
            let input;
            /** When set, this node is appended to the right column instead of the raw input (e.g. line ref select + button). */
            let rightColumnExtra = null;
            
            // Handle different input types
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
            } else if (param.id === 'line_flow_reference_line_id') {
                input = document.createElement('select');
                this._renderLineReferenceSelect(input, param.value != null ? String(param.value) : '');
                Object.assign(input.style, {
                    width: '100%',
                    maxWidth: '100%',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
                });
                const pickBtn = document.createElement('button');
                pickBtn.type = 'button';
                pickBtn.textContent = 'Use line selected in diagram';
                Object.assign(pickBtn.style, {
                    padding: '8px 12px',
                    fontSize: '12px',
                    border: '1px solid #0d6efd',
                    borderRadius: '6px',
                    backgroundColor: '#e7f1ff',
                    color: '#0a58ca',
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                    fontWeight: '500'
                });
                pickBtn.addEventListener('mouseenter', () => { pickBtn.style.backgroundColor = '#d0e4ff'; });
                pickBtn.addEventListener('mouseleave', () => { pickBtn.style.backgroundColor = '#e7f1ff'; });
                pickBtn.addEventListener('click', () => {
                    this.graph = this.ui?.editor?.graph || this.graph;
                    if (!this.graph) return;
                    const c = this.graph.getSelectionCell();
                    if (!c) {
                        window.alert('Select a line in the diagram first.');
                        return;
                    }
                    if (this._shapeElXxxFromCell(c) !== 'Line') {
                        window.alert('The selected element is not a Line.');
                        return;
                    }
                    const id = this._lineDiagramIdForBackend(c);
                    if (!id) {
                        window.alert('Selected line has no diagram id.');
                        return;
                    }
                    this._renderLineReferenceSelect(input, id);
                });
                const stack = document.createElement('div');
                Object.assign(stack.style, { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', width: '100%' });
                stack.appendChild(input);
                stack.appendChild(pickBtn);
                rightColumnExtra = stack;
            } else if (param.id === 'line_flow_p_reference') {
                input = document.createElement('select');
                ['p_from_mw', 'p_to_mw'].forEach((val) => {
                    const o = document.createElement('option');
                    o.value = val;
                    o.textContent = val;
                    input.appendChild(o);
                });
                input.value = param.value === 'p_to_mw' ? 'p_to_mw' : 'p_from_mw';
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box'
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
                
                // Add hover effect
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
            
            // Set additional attributes for number inputs
            if (param.type === 'number') {
                if (param.step) input.step = param.step;
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
            }

            input.id = param.id;
            this.inputs.set(param.id, input);
            if (rightColumnExtra) {
                rightColumn.appendChild(rightColumnExtra);
            } else {
                rightColumn.appendChild(input);
            }

            parameterRow.appendChild(leftColumn);
            parameterRow.appendChild(rightColumn);

            const appendTarget = param.bracketGroup && bracketWrap ? bracketWrap : form;
            appendTarget.appendChild(parameterRow);

            if (tabId === 'control' && param.id === 'step_dependency_table') {
                this._appendShuntCharacteristicSection(form);
            }
            if (tabId === 'control' && param.id === 'line_flow_p_reference') {
                this._appendLineFlowStepTableSection(form);
            }

            const next = parameters[paramIndex + 1];
            if (param.bracketGroup && (!next || next.bracketGroup !== param.bracketGroup)) {
                bracketWrap = null;
            }
        });

        content.appendChild(form);
        return content;
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
    
    switchTab(tabId, activeTab, inactiveTabs, activeContent, inactiveContents) {
        this.currentTab = tabId;
        
        // Update active tab styles
        Object.assign(activeTab.style, {
            borderBottom: '2px solid #007bff',
            backgroundColor: '#f8f9fa',
            color: '#007bff',
            fontWeight: '600'
        });
        activeTab.classList.add('active');
        
        // Update inactive tab styles
        inactiveTabs.forEach(inactiveTab => {
            Object.assign(inactiveTab.style, {
                borderBottom: '2px solid transparent',
                backgroundColor: 'transparent',
                color: '#6c757d',
                fontWeight: '400'
            });
            inactiveTab.classList.remove('active');
        });
        
        // Update content visibility
        activeContent.style.display = 'block';
        inactiveContents.forEach(inactiveContent => {
            inactiveContent.style.display = 'none';
        });
    }
    
    getFormValues() {
        const values = {};
        
        // Collect all parameter values from all tabs
        [...this.powerParameters, ...this.electricalParameters, ...this.controlParameters, ...(this.economicParameters || [])].forEach(param => {
            const input = this.inputs.get(param.id);
            if (input) {
                if (param.id === 'cost_per_unit_by_currency') {
                    values[param.id] = input.value || '0';
                } else if (param.type === 'number') {
                    const raw = parseFloat(input.value);
                    if (param.id === 'shunt_control_increment') {
                        values[param.id] = Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 1;
                    } else {
                        values[param.id] = Number.isFinite(raw) ? raw : 0;
                    }
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else {
                    values[param.id] = input.value;
                }
            }
        });

        this._charTableRows = this._readCharRowsFromDom();
        values.shunt_characteristic_table_json = JSON.stringify(this._charTableRows);

        this._lineFlowTableRows = this._readLineFlowRowsFromDom();
        values.line_flow_step_table_json = JSON.stringify(this._lineFlowTableRows);
        
        return values;
    }
    
    destroy() {
        // Call parent destroy method
        super.destroy();
        
        // Clear global dialog flags to allow future dialogs
        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
        
        console.log('Shunt Reactor dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== ShuntReactorDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.powerParameters, ...this.electricalParameters, ...this.controlParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        // Update parameter values based on cell data
        if (cellData && cellData.attributes) {
            console.log(`Found ${cellData.attributes.length} attributes to process`);
            
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                console.log(`Processing attribute: ${attributeName} = ${attributeValue}`);
                
                if (attributeName === 'cost_per_unit_by_currency') {
                    this.data[attributeName] = attributeValue;
                    const ep = this.economicParameters?.find(p => p.id === attributeName);
                    if (ep) ep.value = attributeValue.toString();
                }

                if (attributeName === 'shunt_characteristic_table_json') {
                    this._charTableRows = normalizeShuntCharRows(parseShuntCharacteristicTableJson(attributeValue));
                    this.data.shunt_characteristic_table_json = typeof attributeValue === 'string' ? attributeValue : JSON.stringify(this._charTableRows);
                }

                if (attributeName === 'line_flow_step_table_json') {
                    this._lineFlowTableRows = normalizeLineFlowRows(parseLineFlowStepTableJson(attributeValue));
                    this.data.line_flow_step_table_json = typeof attributeValue === 'string' ? attributeValue : JSON.stringify(this._lineFlowTableRows);
                }
                
                // Update the dialog's parameter values (not DOM inputs)
                const powerParam = this.powerParameters.find(p => p.id === attributeName);
                if (powerParam) {
                    const oldValue = powerParam.value;
                    if (powerParam.type === 'checkbox') {
                        powerParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        powerParam.value = attributeValue;
                    }
                    console.log(`  Updated power ${attributeName}: ${oldValue} → ${powerParam.value}`);
                }
                
                const electricalParam = this.electricalParameters.find(p => p.id === attributeName);
                if (electricalParam) {
                    const oldValue = electricalParam.value;
                    if (electricalParam.type === 'checkbox') {
                        electricalParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        electricalParam.value = attributeValue;
                    }
                    console.log(`  Updated electrical ${attributeName}: ${oldValue} → ${electricalParam.value}`);
                }
                
                const controlParam = this.controlParameters.find(p => p.id === attributeName);
                if (controlParam) {
                    const oldValue = controlParam.value;
                    if (controlParam.type === 'checkbox') {
                        controlParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        controlParam.value = attributeValue;
                    }
                    console.log(`  Updated control ${attributeName}: ${oldValue} → ${controlParam.value}`);
                }
                
                if (!powerParam && !electricalParam && !controlParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.powerParameters, ...this.electricalParameters, ...this.controlParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        this._charTableRows = normalizeShuntCharRows(this._charTableRows);
        if (this._charTableBody) {
            this._renderCharTableBody();
        }

        this._lineFlowTableRows = normalizeLineFlowRows(this._lineFlowTableRows);
        if (this._lineFlowTableBody) {
            this._renderLineFlowTableBody();
        }
        this._syncControlInputsFromParams();
        this._applyShuntControlModeUi();

        console.log('=== ShuntReactorDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsShuntReactor = [defaultShuntReactorData];

export const columnDefsShuntReactor = [
    {
        field: "name",
        headerTooltip: "Name of the shunt reactor",
        maxWidth: 150
    },
    {
        field: "p_mw",
        headerTooltip: "Shunt active power in MW at v= 1.0 p.u.",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "q_mvar",
        headerTooltip: "Shunt reactive power in MVAr at v= 1.0 p.u.",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "vn_kv",
        headerTooltip: "Rated voltage of the shunt. Defaults to rated voltage of connected bus",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "step",
        headerTooltip: "Step of shunt with which power values are multiplied",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "max_step",
        headerTooltip: "Maximum step position of the shunt",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "step_dependency_table",
        headerTooltip: "Use shunt characteristic table for P/Q per step (pandapower)",
        maxWidth: 100
    },
    {
        field: "shunt_characteristic_table_json",
        headerTooltip: "JSON array: [{ step, p_mw, q_mvar }, ...]",
        maxWidth: 200
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the shunt reactor is in service (True/False)",
        maxWidth: 100
    }
];
  
export const gridOptionsShuntReactor = {
    columnDefs: columnDefsShuntReactor,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsShuntReactor,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsShuntReactor = gridOptionsShuntReactor;
globalThis.rowDefsShuntReactor = rowDefsShuntReactor;
globalThis.columnDefsShuntReactor = columnDefsShuntReactor;
globalThis.ShuntReactorDialog = ShuntReactorDialog;
  
  
  
  