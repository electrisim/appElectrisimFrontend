import { Dialog } from './Dialog.js';

// Default values for motor parameters (based on pandapower documentation)
export const defaultMotorData = {
    name: "Motor",
    pn_mech_mw: 0.0,
    cos_phi: 0.0,
    cos_phi_n: 0.0,
    efficiency_n_percent: 0.0,
    lrc_pu: 0.0,
    rx: 0.0,
    vn_kv: 0.0,
    efficiency_percent: 0.0,
    loading_percent: 0.0,
    scaling: 1.0,
    in_service: true
};

export class MotorDialog extends Dialog {
    constructor(editorUi) {
        super('Motor Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'mechanical';
        this.data = { ...defaultMotorData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Mechanical parameters (necessary for executing a power flow calculation)
        this.mechanicalParameters = [
            {
                id: 'name',
                label: 'Motor Name',
                description: 'Name identifier for the motor',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'pn_mech_mw',
                label: 'Mechanical Rated Power (MW)',
                description: 'Mechanical rated power of the motor',
                type: 'number',
                value: this.data.pn_mech_mw.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'loading_percent',
                label: 'Loading Percentage (%)',
                description: 'The mechanical loading in percentage of the rated mechanical power',
                type: 'number',
                value: this.data.loading_percent.toString(),
                step: '0.1',
                min: '0',
                max: '100'
            }
        ];
        
        // Electrical parameters
        this.electricalParameters = [
            {
                id: 'cos_phi',
                label: 'Current Power Factor',
                description: 'Cosine phi at current operating point',
                type: 'number',
                value: this.data.cos_phi.toString(),
                step: '0.01',
                min: '0',
                max: '1'
            },
            {
                id: 'cos_phi_n',
                label: 'Rated Power Factor',
                description: 'Cosine phi at rated power of the motor for short-circuit calculation',
                type: 'number',
                value: this.data.cos_phi_n.toString(),
                step: '0.01',
                min: '0',
                max: '1'
            },
            {
                id: 'vn_kv',
                label: 'Rated Voltage (kV)',
                description: 'Rated voltage of the motor for short-circuit calculation',
                type: 'number',
                value: this.data.vn_kv.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
        // Performance parameters
        this.performanceParameters = [
            {
                id: 'efficiency_n_percent',
                label: 'Rated Efficiency (%)',
                description: 'Efficiency in percent at rated power for short-circuit calculation',
                type: 'number',
                value: this.data.efficiency_n_percent.toString(),
                step: '0.1',
                min: '0',
                max: '100'
            },
            {
                id: 'efficiency_percent',
                label: 'Current Efficiency (%)',
                description: 'Efficiency in percent at current operating point',
                type: 'number',
                value: this.data.efficiency_percent.toString(),
                step: '0.1',
                min: '0',
                max: '100'
            },
            {
                id: 'scaling',
                label: 'Scaling Factor',
                description: 'Scaling factor for the active power of the motor',
                type: 'number',
                value: this.data.scaling.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
        // Short-circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'lrc_pu',
                label: 'Locked Rotor Current (p.u.)',
                description: 'Locked rotor current in relation to the rated motor current',
                type: 'number',
                value: this.data.lrc_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'rx',
                label: 'R/X Ratio',
                description: 'R/X ratio of the motor for short-circuit calculation',
                type: 'number',
                value: this.data.rx.toString(),
                step: '0.01'
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the motor is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Motor Parameters</strong><br>Set parameters for asynchronous motor with mechanical, electrical, and short-circuit characteristics. See the <a href="https://electrisim.com/documentation#motor" target="_blank">Electrisim documentation</a>.';
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
        const mechanicalTab = this.createTab('Mechanical', 'mechanical', this.currentTab === 'mechanical');
        const electricalTab = this.createTab('Electrical', 'electrical', this.currentTab === 'electrical');
        const performanceTab = this.createTab('Performance', 'performance', this.currentTab === 'performance');
        const shortCircuitTab = this.createTab('Short Circuit', 'shortcircuit', this.currentTab === 'shortcircuit');
        
        tabContainer.appendChild(mechanicalTab);
        tabContainer.appendChild(electricalTab);
        tabContainer.appendChild(performanceTab);
        tabContainer.appendChild(shortCircuitTab);
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
        const mechanicalContent = this.createTabContent('mechanical', this.mechanicalParameters);
        const electricalContent = this.createTabContent('electrical', this.electricalParameters);
        const performanceContent = this.createTabContent('performance', this.performanceParameters);
        const shortCircuitContent = this.createTabContent('shortcircuit', this.shortCircuitParameters);
        
        contentArea.appendChild(mechanicalContent);
        contentArea.appendChild(electricalContent);
        contentArea.appendChild(performanceContent);
        contentArea.appendChild(shortCircuitContent);
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
            console.log('Motor values:', values);
            
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
        mechanicalTab.onclick = () => this.switchTab('mechanical', mechanicalTab, [electricalTab, performanceTab, shortCircuitTab], mechanicalContent, [electricalContent, performanceContent, shortCircuitContent]);
        electricalTab.onclick = () => this.switchTab('electrical', electricalTab, [mechanicalTab, performanceTab, shortCircuitTab], electricalContent, [mechanicalContent, performanceContent, shortCircuitContent]);
        performanceTab.onclick = () => this.switchTab('performance', performanceTab, [mechanicalTab, electricalTab, shortCircuitTab], performanceContent, [mechanicalContent, electricalContent, shortCircuitContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [mechanicalTab, electricalTab, performanceTab], shortCircuitContent, [mechanicalContent, electricalContent, performanceContent]);

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
        [...this.mechanicalParameters, ...this.electricalParameters, ...this.performanceParameters, ...this.shortCircuitParameters].forEach(param => {
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
        
        console.log('Motor dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== MotorDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.mechanicalParameters, ...this.electricalParameters, ...this.performanceParameters, ...this.shortCircuitParameters].forEach(param => {
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
                
                // Update the dialog's parameter values (not DOM inputs)
                const mechanicalParam = this.mechanicalParameters.find(p => p.id === attributeName);
                if (mechanicalParam) {
                    const oldValue = mechanicalParam.value;
                    if (mechanicalParam.type === 'checkbox') {
                        mechanicalParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        mechanicalParam.value = attributeValue;
                    }
                    console.log(`  Updated mechanical ${attributeName}: ${oldValue} → ${mechanicalParam.value}`);
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
                
                const performanceParam = this.performanceParameters.find(p => p.id === attributeName);
                if (performanceParam) {
                    const oldValue = performanceParam.value;
                    if (performanceParam.type === 'checkbox') {
                        performanceParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        performanceParam.value = attributeValue;
                    }
                    console.log(`  Updated performance ${attributeName}: ${oldValue} → ${performanceParam.value}`);
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
                
                if (!mechanicalParam && !electricalParam && !performanceParam && !shortCircuitParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.mechanicalParameters, ...this.electricalParameters, ...this.performanceParameters, ...this.shortCircuitParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        console.log('=== MotorDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsMotor = [defaultMotorData];

export const columnDefsMotor = [
    {
        field: "name",
        headerTooltip: "Name of the motor",
        maxWidth: 150
    },
    {
        field: "pn_mech_mw",
        headerTooltip: "Mechanical rated power of the motor",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "cos_phi",
        headerTooltip: "Cosine phi at current operating point",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "cos_phi_n",
        headerTooltip: "Cosine phi at rated power of the motor for short-circuit calculation",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "efficiency_n_percent",
        headerTooltip: "Efficiency in percent at rated power for short-circuit calculation",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "lrc_pu",
        headerTooltip: "Locked rotor current in relation to the rated motor current",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "rx",
        headerTooltip: "R/X ratio of the motor for short-circuit calculation",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "vn_kv",
        headerTooltip: "Rated voltage of the motor for short-circuit calculation",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "efficiency_percent",
        headerTooltip: "Efficiency in percent at current operating point",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "loading_percent",
        headerTooltip: "The mechanical loading in percentage of the rated mechanical power",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "scaling",
        headerTooltip: "Scaling factor for the active power of the motor",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the motor is in service (True/False)",
        maxWidth: 100
    }
];

export const gridOptionsMotor = {
    columnDefs: columnDefsMotor,
    defaultColDef: {
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsMotor,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};

// Make all necessary variables globally available
globalThis.gridOptionsMotor = gridOptionsMotor;
globalThis.rowDefsMotor = rowDefsMotor;
globalThis.columnDefsMotor = columnDefsMotor;
globalThis.MotorDialog = MotorDialog;



