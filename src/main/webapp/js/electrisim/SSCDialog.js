import { Dialog } from './Dialog.js';

// Default values for SSC (STATCOM) parameters (based on pandapower documentation)
export const defaultSSCData = {
    name: "SSC(STATCOM)",
    r_ohm: 0.0,
    x_ohm: 0.0,
    set_vm_pu: 0.0,
    vm_internal_pu: 0.0,
    va_internal_degree: 0.0,
    controllable: true,
    in_service: true
};

export class SSCDialog extends Dialog {
    constructor(editorUi) {
        super('SSC (STATCOM) Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'electrical';
        this.data = { ...defaultSSCData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Electrical parameters (necessary for executing a power flow calculation)
        this.electricalParameters = [
            {
                id: 'name',
                label: 'SSC Name',
                description: 'Name identifier for the SSC (STATCOM)',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'r_ohm',
                label: 'Resistance (Ω)',
                description: 'Resistance of the coupling transformer component of SSC(STATCOM)',
                type: 'number',
                value: this.data.r_ohm.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'x_ohm',
                label: 'Reactance (Ω)',
                description: 'Reactance of the coupling transformer component of SSC(STATCOM)',
                type: 'number',
                value: this.data.x_ohm.toString(),
                step: '0.01'
            }
        ];
        
        // Control parameters
        this.controlParameters = [
            {
                id: 'set_vm_pu',
                label: 'Voltage Set Point (p.u.)',
                description: 'Set-point for the bus voltage magnitude at the connection bus',
                type: 'number',
                value: this.data.set_vm_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'vm_internal_pu',
                label: 'Internal Voltage (p.u.)',
                description: 'The voltage magnitude of the voltage source converter VSC at the SSC(STATCOM)',
                type: 'number',
                value: this.data.vm_internal_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'va_internal_degree',
                label: 'Internal Angle (degrees)',
                description: 'The voltage angle of the voltage source converter VSC at the SSC(STATCOM)',
                type: 'number',
                value: this.data.va_internal_degree.toString(),
                step: '0.1'
            }
        ];
        
        // Configuration parameters
        this.configParameters = [
            {
                id: 'controllable',
                label: 'Controllable',
                description: 'Whether the element is considered as actively controlling or as a fixed shunt impedance',
                type: 'checkbox',
                value: this.data.controllable
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the SSC is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure SSC (STATCOM) Parameters</strong><br>Set parameters for Static Synchronous Compensator with voltage control capabilities. Based on <a href="https://pandapower.readthedocs.io/en/latest/elements/ssc.html" target="_blank">pandapower documentation</a>.';
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
        const electricalTab = this.createTab('Electrical', 'electrical', this.currentTab === 'electrical');
        const controlTab = this.createTab('Control', 'control', this.currentTab === 'control');
        const configTab = this.createTab('Configuration', 'config', this.currentTab === 'config');
        
        tabContainer.appendChild(electricalTab);
        tabContainer.appendChild(controlTab);
        tabContainer.appendChild(configTab);
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
        const electricalContent = this.createTabContent('electrical', this.electricalParameters);
        const controlContent = this.createTabContent('control', this.controlParameters);
        const configContent = this.createTabContent('config', this.configParameters);
        
        contentArea.appendChild(electricalContent);
        contentArea.appendChild(controlContent);
        contentArea.appendChild(configContent);
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
            console.log('SSC values:', values);
            
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
        electricalTab.onclick = () => this.switchTab('electrical', electricalTab, [controlTab, configTab], electricalContent, [controlContent, configContent]);
        controlTab.onclick = () => this.switchTab('control', controlTab, [electricalTab, configTab], controlContent, [electricalContent, configContent]);
        configTab.onclick = () => this.switchTab('config', configTab, [electricalTab, controlTab], configContent, [electricalContent, controlContent]);

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
        [...this.electricalParameters, ...this.controlParameters, ...this.configParameters].forEach(param => {
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
        
        console.log('SSC dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== SSCDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.electricalParameters, ...this.controlParameters, ...this.configParameters].forEach(param => {
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
                
                const configParam = this.configParameters.find(p => p.id === attributeName);
                if (configParam) {
                    const oldValue = configParam.value;
                    if (configParam.type === 'checkbox') {
                        configParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        configParam.value = attributeValue;
                    }
                    console.log(`  Updated config ${attributeName}: ${oldValue} → ${configParam.value}`);
                }
                
                if (!electricalParam && !controlParam && !configParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.electricalParameters, ...this.controlParameters, ...this.configParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        console.log('=== SSCDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsSSC = [defaultSSCData];

export const columnDefsSSC = [  
    {
        field: "name",
        headerTooltip: "Name of the SSC(STATCOM)",
        maxWidth: 150
    },
    {
        field: "r_ohm",
        headerTooltip: "Resistance of the coupling transformer component of SSC(STATCOM)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "x_ohm",
        headerTooltip: "Reactance of the coupling transformer component of SSC(STATCOM)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "set_vm_pu",
        headerTooltip: "Set-point for the bus voltage magnitude at the connection bus",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "vm_internal_pu",
        headerTooltip: "The voltage magnitude of the voltage source converter VSC at the SSC(STATCOM)",
        maxWidth: 160,
        valueParser: 'numberParser'
    },
    {
        field: "va_internal_degree",
        headerTooltip: "The voltage angle of the voltage source converter VSC at the SSC(STATCOM)",
        maxWidth: 180,
        valueParser: 'numberParser'
    },
    {
        field: "controllable",
        headerTooltip: "Whether the element is considered as actively controlling or as a fixed shunt impedance",
        maxWidth: 120
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the SSC is in service (True/False)",
        maxWidth: 100
    }
];
  
export const gridOptionsSSC = {
    columnDefs: columnDefsSSC,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsSSC,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsSSC = gridOptionsSSC;
globalThis.rowDefsSSC = rowDefsSSC;
globalThis.columnDefsSSC = columnDefsSSC;
globalThis.SSCDialog = SSCDialog;
  
  
  
  