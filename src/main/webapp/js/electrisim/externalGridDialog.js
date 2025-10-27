import { Dialog } from './Dialog.js';

// Default values for external grid parameters (based on pandapower documentation)
export const defaultExternalGridData = {
    name: "External Grid",
    vm_pu: 1.0,
    va_degree: 0.0,
    in_service: true,
    s_sc_max_mva: 1000000.0,
    s_sc_min_mva: 0.0,
    rx_max: 0.0,
    rx_min: 0.0,
    r0x0_max: 0.0,
    x0x_max: 0.0,
    max_p_mw: 0.0,
    min_p_mw: 0.0,
    max_q_mvar: 0.0,
    min_q_mvar: 0.0,
    controllable: false,
    slack_weight: 1.0
};

export class ExternalGridDialog extends Dialog {
    constructor(editorUi) {
        super('External Grid Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultExternalGridData };
        
        // Load Flow parameters (necessary for executing a power flow calculation)
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'External Grid Name',
                description: 'Name identifier for the external grid',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'vm_pu',
                label: 'Voltage Magnitude (p.u.)',
                description: 'Voltage at the slack node in per unit (>0)',
                type: 'number',
                value: this.data.vm_pu.toString(),
                step: '0.01',
                min: '0.01'
            },
            {
                id: 'va_degree',
                label: 'Voltage Angle (degrees)',
                description: 'Voltage angle at the slack node in degrees. Only considered in loadflow if calculate_voltage_angles = True',
                type: 'number',
                value: this.data.va_degree.toString(),
                step: '0.1'
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the external grid is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
        
        // Short Circuit parameters
        this.shortCircuitParameters = [
            {
                id: 's_sc_max_mva',
                label: 'Max Short Circuit Power (MVA)',
                description: 'Maximum short circuit apparent power to calculate internal impedance of ext_grid for short circuit calculations (>0)',
                type: 'number',
                value: this.data.s_sc_max_mva.toString(),
                step: '1000',
                min: '0'
            },
            {
                id: 's_sc_min_mva',
                label: 'Min Short Circuit Power (MVA)',
                description: 'Minimum short circuit apparent power to calculate internal impedance of ext_grid for short circuit calculations (>0)',
                type: 'number',
                value: this.data.s_sc_min_mva.toString(),
                step: '1000',
                min: '0'
            },
            {
                id: 'rx_max',
                label: 'Max R/X Ratio',
                description: 'Maximum R/X-ratio to calculate internal impedance of ext_grid for short circuit calculations (0...1)',
                type: 'number',
                value: this.data.rx_max.toString(),
                step: '0.01',
                min: '0',
                max: '1'
            },
            {
                id: 'rx_min',
                label: 'Min R/X Ratio',
                description: 'Minimum R/X-ratio to calculate internal impedance of ext_grid for short circuit calculations (0...1)',
                type: 'number',
                value: this.data.rx_min.toString(),
                step: '0.01',
                min: '0',
                max: '1'
            },
            {
                id: 'r0x0_max',
                label: 'Max R0/X0 Ratio',
                description: 'Maximal R/X-ratio to calculate Zero sequence internal impedance of ext_grid (0...1)',
                type: 'number',
                value: this.data.r0x0_max.toString(),
                step: '0.01',
                min: '0',
                max: '1'
            },
            {
                id: 'x0x_max',
                label: 'Max X0/X Ratio',
                description: 'Maximal X0/X-ratio to calculate Zero sequence internal impedance of ext_grid (0...1)',
                type: 'number',
                value: this.data.x0x_max.toString(),
                step: '0.01',
                min: '0',
                max: '1'
            }
        ];
        
        // OPF (Optimal Power Flow) parameters
        this.opfParameters = [
            {
                id: 'max_p_mw',
                label: 'Max Active Power (MW)',
                description: 'Maximum active power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.max_p_mw.toString(),
                step: '1'
            },
            {
                id: 'min_p_mw',
                label: 'Min Active Power (MW)',
                description: 'Minimum active power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.min_p_mw.toString(),
                step: '1'
            },
            {
                id: 'max_q_mvar',
                label: 'Max Reactive Power (MVar)',
                description: 'Maximum reactive power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.max_q_mvar.toString(),
                step: '1'
            },
            {
                id: 'min_q_mvar',
                label: 'Min Reactive Power (MVar)',
                description: 'Minimum reactive power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.min_q_mvar.toString(),
                step: '1'
            },
            {
                id: 'controllable',
                label: 'Controllable',
                description: 'Control of value limits: True = p_mw, q_mvar and vm_pu limits enforced; False = set points enforced, limits ignored',
                type: 'checkbox',
                value: this.data.controllable
            },
            {
                id: 'slack_weight',
                label: 'Slack Weight',
                description: 'Contribution factor for distributed slack power flow calculation (active power balancing)',
                type: 'number',
                value: this.data.slack_weight.toString(),
                step: '0.1',
                min: '0'
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure External Grid Parameters</strong><br>Set parameters for Load Flow, Short Circuit, and Optimal Power Flow calculations. Based on <a href="https://pandapower.readthedocs.io/en/latest/elements/ext_grid.html" target="_blank">pandapower documentation</a>.';
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
        const loadFlowTab = this.createTab('Load Flow', 'loadflow', this.currentTab === 'loadflow');
        const shortCircuitTab = this.createTab('Short Circuit', 'shortcircuit', this.currentTab === 'shortcircuit');
        const opfTab = this.createTab('OPF', 'opf', this.currentTab === 'opf');
        
        tabContainer.appendChild(loadFlowTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(opfTab);
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
        const loadFlowContent = this.createTabContent('loadflow', this.loadFlowParameters);
        const shortCircuitContent = this.createTabContent('shortcircuit', this.shortCircuitParameters);
        const opfContent = this.createTabContent('opf', this.opfParameters);
        
        contentArea.appendChild(loadFlowContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(opfContent);
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
            console.log('External Grid values:', values);
            
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
        
        // Tab click handlers
        loadFlowTab.onclick = () => this.switchTab('loadflow', loadFlowTab, [shortCircuitTab, opfTab], loadFlowContent, [shortCircuitContent, opfContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [loadFlowTab, opfTab], shortCircuitContent, [loadFlowContent, opfContent]);
        opfTab.onclick = () => this.switchTab('opf', opfTab, [loadFlowTab, shortCircuitTab], opfContent, [loadFlowContent, shortCircuitContent]);

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
    
    createTabContent(tabId, parameters) {
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

        parameters.forEach(param => {
            const parameterRow = document.createElement('div');
            Object.assign(parameterRow.style, {
                display: 'grid',
                gridTemplateColumns: '1fr 200px',
                gap: '20px',
                alignItems: 'start',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                minHeight: '80px'
            });

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
                width: '200px'
            });
            
            const input = document.createElement('input');
            input.type = param.type;
            input.id = param.id;
            
            // Handle different input types
            if (param.type === 'checkbox') {
                input.checked = param.value;
                Object.assign(input.style, {
                    width: '24px',
                    height: '24px',
                    accentColor: '#007bff',
                    cursor: 'pointer',
                    margin: '0'
                });
            } else {
                input.value = param.value;
                Object.assign(input.style, {
                    width: '180px',
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
            
            // Set additional attributes
            if (param.step) input.step = param.step;
            if (param.min !== undefined) input.min = param.min;
            if (param.max !== undefined) input.max = param.max;

            this.inputs.set(param.id, input);
            rightColumn.appendChild(input);

            parameterRow.appendChild(leftColumn);
            parameterRow.appendChild(rightColumn);
            form.appendChild(parameterRow);
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
        [...this.loadFlowParameters, ...this.shortCircuitParameters, ...this.opfParameters].forEach(param => {
            const input = this.inputs.get(param.id);
            if (input) {
                if (param.type === 'number') {
                    values[param.id] = parseFloat(input.value) || 0;
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else {
                    values[param.id] = input.value;
                }
            }
        });
        
        return values;
    }
    
    destroy() {
        // Call parent destroy method
        super.destroy();
        
        // Clear global dialog flags to allow future dialogs
        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
        
        console.log('External Grid dialog destroyed and flags cleared');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsExternalGrid = [defaultExternalGridData];

export const columnDefsExternalGrid = [  
    { field: "name", maxWidth: 200 },
    { field: "vm_pu", headerTooltip: "voltage at the slack node in per unit", maxWidth: 100 },
    { field: "va_degree", headerTooltip: "voltage angle at the slack node in degrees. Only considered in loadflow if calculate_voltage_angles = True", maxWidth: 100 },
    { field: "s_sc_max_mva", headerTooltip: "maximal short circuit apparent power to calculate internal impedance of ext_grid for short circuit calculations", maxWidth: 160 },
    { field: "s_sc_min_mva", headerTooltip: "minimal short circuit apparent power to calculate internal impedance of ext_grid for short circuit calculations", maxWidth: 160 },
    { field: "rx_max", headerTooltip: "maximal R/X-ratio to calculate internal impedance of ext_grid for short circuit calculations", maxWidth: 120 },
    { field: "rx_min", headerTooltip: "minimal R/X-ratio to calculate internal impedance of ext_grid for short circuit calculations", maxWidth: 100 },
    { field: "r0x0_max", headerTooltip: "maximal R/X-ratio to calculate Zero sequence internal impedance of ext_grid", maxWidth: 100 },
    { field: "x0x_max", headerTooltip: "maximal X0/X-ratio to calculate Zero sequence internal impedance of ext_grid", maxWidth: 120 }
];
  
export const gridOptionsExternalGrid = {
    columnDefs: columnDefsExternalGrid,
    defaultColDef: { minWidth: 100, editable: true },
    rowData: rowDefsExternalGrid,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsExternalGrid = gridOptionsExternalGrid;
globalThis.rowDefsExternalGrid = rowDefsExternalGrid;
globalThis.columnDefsExternalGrid = columnDefsExternalGrid;
globalThis.ExternalGridDialog = ExternalGridDialog;
  