import { Dialog } from './Dialog.js';

// Default values for extended ward parameters (based on pandapower documentation)
export const defaultExtendedWardData = {
    name: "Extended Ward",
    ps_mw: 0.0,
    qs_mvar: 0.0,
    pz_mw: 0.0,
    qz_mvar: 0.0,
    r_ohm: 0.0,
    x_ohm: 0.0,
    vm_pu: 0.0,
    in_service: true
};

export class ExtendedWardDialog extends Dialog {
    constructor(editorUi) {
        super('Extended Ward Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'load';
        this.data = { ...defaultExtendedWardData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Load parameters (necessary for executing a power flow calculation)
        this.loadParameters = [
            {
                id: 'name',
                label: 'Extended Ward Name',
                description: 'Name identifier for the extended ward',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'ps_mw',
                label: 'PQ Load Active Power (MW)',
                description: 'Active power of the PQ load',
                type: 'number',
                value: this.data.ps_mw.toString(),
                step: '0.1'
            },
            {
                id: 'qs_mvar',
                label: 'PQ Load Reactive Power (MVar)',
                description: 'Reactive power of the PQ load',
                type: 'number',
                value: this.data.qs_mvar.toString(),
                step: '0.1'
            }
        ];
        
        // Impedance load parameters
        this.impedanceParameters = [
            {
                id: 'pz_mw',
                label: 'Impedance Load Active Power (MW)',
                description: 'Active power of the impedance load in MW at 1.pu voltage',
                type: 'number',
                value: this.data.pz_mw.toString(),
                step: '0.1'
            },
            {
                id: 'qz_mvar',
                label: 'Impedance Load Reactive Power (MVar)',
                description: 'Reactive power of the impedance load in MVar at 1.pu voltage',
                type: 'number',
                value: this.data.qz_mvar.toString(),
                step: '0.1'
            }
        ];
        
        // Electrical parameters
        this.electricalParameters = [
            {
                id: 'r_ohm',
                label: 'Internal Resistance (Ω)',
                description: 'Internal resistance of the voltage source',
                type: 'number',
                value: this.data.r_ohm.toString(),
                step: '0.01'
            },
            {
                id: 'x_ohm',
                label: 'Internal Reactance (Ω)',
                description: 'Internal reactance of the voltage source',
                type: 'number',
                value: this.data.x_ohm.toString(),
                step: '0.01'
            },
            {
                id: 'vm_pu',
                label: 'Voltage Magnitude (p.u.)',
                description: 'Voltage magnitude at the additional PV-node',
                type: 'number',
                value: this.data.vm_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the extended ward is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Extended Ward Parameters</strong><br>Set parameters for extended ward equivalent with PQ load, impedance load, and voltage source. Based on <a href="https://pandapower.readthedocs.io/en/latest/elements/xward.html" target="_blank">pandapower documentation</a>.';
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
        const loadTab = this.createTab('PQ Load', 'load', this.currentTab === 'load');
        const impedanceTab = this.createTab('Impedance Load', 'impedance', this.currentTab === 'impedance');
        const electricalTab = this.createTab('Electrical', 'electrical', this.currentTab === 'electrical');
        
        tabContainer.appendChild(loadTab);
        tabContainer.appendChild(impedanceTab);
        tabContainer.appendChild(electricalTab);
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
        const loadContent = this.createTabContent('load', this.loadParameters);
        const impedanceContent = this.createTabContent('impedance', this.impedanceParameters);
        const electricalContent = this.createTabContent('electrical', this.electricalParameters);
        
        contentArea.appendChild(loadContent);
        contentArea.appendChild(impedanceContent);
        contentArea.appendChild(electricalContent);
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
            console.log('Extended Ward values:', values);
            
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
        loadTab.onclick = () => this.switchTab('load', loadTab, [impedanceTab, electricalTab], loadContent, [impedanceContent, electricalContent]);
        impedanceTab.onclick = () => this.switchTab('impedance', impedanceTab, [loadTab, electricalTab], impedanceContent, [loadContent, electricalContent]);
        electricalTab.onclick = () => this.switchTab('electrical', electricalTab, [loadTab, impedanceTab], electricalContent, [loadContent, impedanceContent]);

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
        [...this.loadParameters, ...this.impedanceParameters, ...this.electricalParameters].forEach(param => {
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
        
        console.log('Extended Ward dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== ExtendedWardDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.loadParameters, ...this.impedanceParameters, ...this.electricalParameters].forEach(param => {
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
                const loadParam = this.loadParameters.find(p => p.id === attributeName);
                if (loadParam) {
                    const oldValue = loadParam.value;
                    if (loadParam.type === 'checkbox') {
                        loadParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        loadParam.value = attributeValue;
                    }
                    console.log(`  Updated load ${attributeName}: ${oldValue} → ${loadParam.value}`);
                }
                
                const impedanceParam = this.impedanceParameters.find(p => p.id === attributeName);
                if (impedanceParam) {
                    const oldValue = impedanceParam.value;
                    if (impedanceParam.type === 'checkbox') {
                        impedanceParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        impedanceParam.value = attributeValue;
                    }
                    console.log(`  Updated impedance ${attributeName}: ${oldValue} → ${impedanceParam.value}`);
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
                
                if (!loadParam && !impedanceParam && !electricalParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.loadParameters, ...this.impedanceParameters, ...this.electricalParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        console.log('=== ExtendedWardDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsExtendedWard = [defaultExtendedWardData];

export const columnDefsExtendedWard = [  
    {
        field: "name",
        headerTooltip: "Name of the extended ward",
        maxWidth: 150
    },
    {
        field: "ps_mw",
        headerTooltip: "Active power of the PQ load",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "qs_mvar",
        headerTooltip: "Reactive power of the PQ load",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "pz_mw",
        headerTooltip: "Active power of the impedance load in MW at 1.pu voltage",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "qz_mvar",
        headerTooltip: "Reactive power of the impedance load in MVar at 1.pu voltage",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "r_ohm",
        headerTooltip: "Internal resistance of the voltage source",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "x_ohm",
        headerTooltip: "Internal reactance of the voltage source",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "vm_pu",
        headerTooltip: "Voltage magnitude at the additional PV-node",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the extended ward is in service (True/False)",
        maxWidth: 100
    }
];
  
export const gridOptionsExtendedWard = {
    columnDefs: columnDefsExtendedWard,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsExtendedWard,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsExtendedWard = gridOptionsExtendedWard;
globalThis.rowDefsExtendedWard = rowDefsExtendedWard;
globalThis.columnDefsExtendedWard = columnDefsExtendedWard;
globalThis.ExtendedWardDialog = ExtendedWardDialog;
  
  
  
  