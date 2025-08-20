import { Dialog } from './Dialog.js';

// Default values for generator parameters (based on pandapower documentation)
export const defaultGeneratorData = {
    name: "Generator",
    p_mw: 0.0,
    vm_pu: 1.0,
    sn_mva: 0.0,
    scaling: 1.0,
    slack: false,
    controllable: false,
    vn_kv: 0.0,
    xdss_pu: 0.0,
    rdss_ohm: 0.0,
    cos_phi: 0.8,
    pg_percent: 0.0,
    power_station_trafo: null,
    max_p_mw: 0.0,
    min_p_mw: 0.0,
    max_q_mvar: 0.0,
    min_q_mvar: 0.0,
    in_service: true
};

export class GeneratorDialog extends Dialog {
    constructor(editorUi) {
        super('Generator Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultGeneratorData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Load Flow parameters (necessary for executing a power flow calculation)
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'Name',
                symbol: 'name',
                description: 'Name identifier for the generator',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'p_mw',
                label: 'Active Power',
                symbol: 'p_mw',
                unit: 'MW',
                description: 'The active power of the generator (positive for generation!)',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'vm_pu',
                label: 'Voltage Set Point',
                symbol: 'vm_pu',
                unit: 'p.u.',
                description: 'The voltage set point of the generator (>0)',
                type: 'number',
                value: this.data.vm_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'scaling',
                label: 'Scaling Factor',
                symbol: 'scaling',
                description: 'Scaling factor for the active power of the generator (>0)',
                type: 'number',
                value: this.data.scaling.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'slack',
                label: 'Slack Generator',
                symbol: 'slack',
                description: 'True if generator is slack generator for loadflow calculation',
                type: 'checkbox',
                value: this.data.slack
            },
            {
                id: 'controllable',
                label: 'Controllable',
                symbol: 'controllable',
                description: 'True if generator is controllable by OPF',
                type: 'checkbox',
                value: this.data.controllable
            },
            {
                id: 'in_service',
                label: 'In Service',
                symbol: 'in_service',
                description: 'Specifies if the generator is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
        
        // Short Circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'sn_mva',
                label: 'Nominal Power',
                symbol: 'sn_mva',
                unit: 'MVA',
                description: 'Nominal power of the generator for short-circuit calculation (>0)',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vn_kv',
                label: 'Rated Voltage',
                symbol: 'vn_kv',
                unit: 'kV',
                description: 'Rated voltage of the generator for short-circuit calculation (>0)',
                type: 'number',
                value: this.data.vn_kv.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'xdss_pu',
                label: 'Subtransient Reactance',
                symbol: 'xdss_pu',
                unit: 'p.u.',
                description: 'Subtransient generator reactance for short-circuit calculation (>0)',
                type: 'number',
                value: this.data.xdss_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'rdss_ohm',
                label: 'Subtransient Resistance',
                symbol: 'rdss_ohm',
                unit: 'Ω',
                description: 'Subtransient generator resistance for short-circuit calculation (>=0)',
                type: 'number',
                value: this.data.rdss_ohm.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'cos_phi',
                label: 'Power Factor',
                symbol: 'cos_phi',
                description: 'Rated cosine phi of the generator for short-circuit calculation (0...1)',
                type: 'number',
                value: this.data.cos_phi.toString(),
                step: '0.01',
                min: '0',
                max: '1'
            },
            {
                id: 'pg_percent',
                label: 'PG Percent',
                symbol: 'pg_percent',
                unit: '%',
                description: 'Rated pg (voltage control range) of the generator for short-circuit calculation (>=0)',
                type: 'number',
                value: this.data.pg_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'power_station_trafo',
                label: 'Power Station Transformer',
                symbol: 'power_station_trafo',
                description: 'Index of the power station transformer for short-circuit calculation',
                type: 'number',
                value: this.data.power_station_trafo?.toString() || '',
                step: '1'
            }
        ];
        
        // OPF (Optimal Power Flow) parameters
        this.opfParameters = [
            {
                id: 'max_p_mw',
                label: 'Maximum Active Power',
                symbol: 'max_p_mw',
                unit: 'MW',
                description: 'Maximum active power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.max_p_mw.toString(),
                step: '1'
            },
            {
                id: 'min_p_mw',
                label: 'Minimum Active Power',
                symbol: 'min_p_mw',
                unit: 'MW',
                description: 'Minimum active power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.min_p_mw.toString(),
                step: '1'
            },
            {
                id: 'max_q_mvar',
                label: 'Maximum Reactive Power',
                symbol: 'max_q_mvar',
                unit: 'MVar',
                description: 'Maximum reactive power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.max_q_mvar.toString(),
                step: '1'
            },
            {
                id: 'min_q_mvar',
                label: 'Minimum Reactive Power',
                symbol: 'min_q_mvar',
                unit: 'MVar',
                description: 'Minimum reactive power injection. Only respected for OPF calculations',
                type: 'number',
                value: this.data.min_q_mvar.toString(),
                step: '1'
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Generator Parameters</strong><br>Set parameters for synchronous generator with power flow and short-circuit capabilities. Based on <a href="https://pandapower.readthedocs.io/en/latest/elements/gen.html" target="_blank">pandapower documentation</a>.';
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
            console.log('Generator values:', values);
            
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
            this.ui.showDialog(container, 750, 600, true, false);
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
            // Include symbol and unit in label if available
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

            // Right column: Input field with fixed width
            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minHeight: '60px',
                width: '200px'
            });
            
            let input;
            
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
            } else {
                input = document.createElement('input');
                input.type = param.type;
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
            
            // Set additional attributes for number inputs
            if (param.type === 'number') {
                if (param.step) input.step = param.step;
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
            }

            input.id = param.id;
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
        
        console.log('Generator dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== GeneratorDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Update parameter values based on cell data
        if (cellData && cellData.attributes) {
            console.log(`Found ${cellData.attributes.length} attributes to process`);
            
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                console.log(`Processing attribute: ${attributeName} = ${attributeValue}`);
                
                // Update the dialog's parameter values (not DOM inputs)
                const loadFlowParam = this.loadFlowParameters.find(p => p.id === attributeName);
                if (loadFlowParam) {
                    const oldValue = loadFlowParam.value;
                    if (loadFlowParam.type === 'checkbox') {
                        loadFlowParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        loadFlowParam.value = attributeValue;
                    }
                    console.log(`  Updated loadFlow ${attributeName}: ${oldValue} → ${loadFlowParam.value}`);
                }
                
                const shortCircuitParam = this.shortCircuitParameters.find(p => p.id === attributeName);
                if (shortCircuitParam) {
                    const oldValue = shortCircuitParam.value;
                    if (shortCircuitParam.type === 'checkbox') {
                        shortCircuitParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        shortCircuitParam.value = attributeValue;
                    }
                    console.log(`  Updated shortCircuit ${attributeName}: ${oldValue} → ${shortCircuitParam.value}`);
                }
                
                const opfParam = this.opfParameters.find(p => p.id === attributeName);
                if (opfParam) {
                    const oldValue = opfParam.value;
                    if (opfParam.type === 'checkbox') {
                        opfParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        opfParam.value = attributeValue;
                    }
                    console.log(`  Updated opf ${attributeName}: ${oldValue} → ${opfParam.value}`);
                }
                
                if (!loadFlowParam && !shortCircuitParam && !opfParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        console.log('=== GeneratorDialog.populateDialog completed ===');
    }
}

// Note: Legacy AG-Grid exports have been removed to prevent conflicts with the new modern dialog system
// The GeneratorDialog class is now the primary interface for editing generator parameters
  
  
  
  