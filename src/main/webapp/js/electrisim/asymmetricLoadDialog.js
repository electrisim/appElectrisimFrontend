import { Dialog } from './Dialog.js';

// Default values for asymmetric load parameters (based on pandapower documentation)
export const defaultAsymmetricLoadData = {
    name: "Asymmetric Load",
    p_a_mw: 0.0,
    p_b_mw: 0.0,
    p_c_mw: 0.0,
    q_a_mvar: 0.0,
    q_b_mvar: 0.0,
    q_c_mvar: 0.0,
    sn_mva: 0.0,
    scaling: 1.0,
    type: 'wye',
    in_service: true
};

export class AsymmetricLoadDialog extends Dialog {
    constructor(editorUi) {
        super('Asymmetric Load Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'power';
        this.data = { ...defaultAsymmetricLoadData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Power parameters (necessary for executing a power flow calculation)
        this.powerParameters = [
            {
                id: 'name',
                label: 'Load Name',
                description: 'Name identifier for the asymmetric load',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'p_a_mw',
                label: 'Phase A Active Power (MW)',
                description: 'The active power for Phase A load (≥0)',
                type: 'number',
                value: this.data.p_a_mw.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'p_b_mw',
                label: 'Phase B Active Power (MW)',
                description: 'The active power for Phase B load (≥0)',
                type: 'number',
                value: this.data.p_b_mw.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'p_c_mw',
                label: 'Phase C Active Power (MW)',
                description: 'The active power for Phase C load (≥0)',
                type: 'number',
                value: this.data.p_c_mw.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
        // Reactive Power parameters
        this.reactivePowerParameters = [
            {
                id: 'q_a_mvar',
                label: 'Phase A Reactive Power (MVar)',
                description: 'The reactive power for Phase A load',
                type: 'number',
                value: this.data.q_a_mvar.toString(),
                step: '0.1'
            },
            {
                id: 'q_b_mvar',
                label: 'Phase B Reactive Power (MVar)',
                description: 'The reactive power for Phase B load',
                type: 'number',
                value: this.data.q_b_mvar.toString(),
                step: '0.1'
            },
            {
                id: 'q_c_mvar',
                label: 'Phase C Reactive Power (MVar)',
                description: 'The reactive power for Phase C load',
                type: 'number',
                value: this.data.q_c_mvar.toString(),
                step: '0.1'
            }
        ];
        
        // Configuration parameters
        this.configParameters = [
            {
                id: 'sn_mva',
                label: 'Nominal Power (MVA)',
                description: 'Rated power of the load (>0). Note: This is not considered in power flow calculations.',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'scaling',
                label: 'Scaling Factor',
                description: 'Scaling factor that multiplies with p_mw and q_mvar of all phases (≥0)',
                type: 'number',
                value: this.data.scaling.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'type',
                label: 'Connection Type',
                description: 'Connection type of three phase load: wye (same as PH-E loads) or delta',
                type: 'select',
                value: this.data.type,
                options: ['wye', 'delta']
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the load is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Asymmetric Load Parameters</strong><br>Set parameters for three-phase asymmetric load with individual phase power values. Based on <a href="https://pandapower.readthedocs.io/en/latest/elements/asymmetric_load.html" target="_blank">pandapower documentation</a>.';
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
        const powerTab = this.createTab('Active Power', 'power', this.currentTab === 'power');
        const reactiveTab = this.createTab('Reactive Power', 'reactive', this.currentTab === 'reactive');
        const configTab = this.createTab('Configuration', 'config', this.currentTab === 'config');
        
        tabContainer.appendChild(powerTab);
        tabContainer.appendChild(reactiveTab);
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
        const powerContent = this.createTabContent('power', this.powerParameters);
        const reactiveContent = this.createTabContent('reactive', this.reactivePowerParameters);
        const configContent = this.createTabContent('config', this.configParameters);
        
        contentArea.appendChild(powerContent);
        contentArea.appendChild(reactiveContent);
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
            console.log('Asymmetric Load values:', values);
            
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
        powerTab.onclick = () => this.switchTab('power', powerTab, [reactiveTab, configTab], powerContent, [reactiveContent, configContent]);
        reactiveTab.onclick = () => this.switchTab('reactive', reactiveTab, [powerTab, configTab], reactiveContent, [powerContent, configContent]);
        configTab.onclick = () => this.switchTab('config', configTab, [powerTab, reactiveTab], configContent, [powerContent, reactiveContent]);

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
            } else if (param.type === 'select') {
                input = document.createElement('select');
                param.options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
                    if (option === param.value) {
                        optionElement.selected = true;
                    }
                    input.appendChild(optionElement);
                });
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
                    outline: 'none',
                    cursor: 'pointer'
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
        [...this.powerParameters, ...this.reactivePowerParameters, ...this.configParameters].forEach(param => {
            const input = this.inputs.get(param.id);
            if (input) {
                if (param.type === 'number') {
                    values[param.id] = parseFloat(input.value) || 0;
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else if (param.type === 'select') {
                    values[param.id] = input.value;
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
        
        console.log('Asymmetric Load dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== AsymmetricLoadDialog.populateDialog called ===');
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
                
                const reactiveParam = this.reactivePowerParameters.find(p => p.id === attributeName);
                if (reactiveParam) {
                    const oldValue = reactiveParam.value;
                    if (reactiveParam.type === 'checkbox') {
                        reactiveParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        reactiveParam.value = attributeValue;
                    }
                    console.log(`  Updated reactive ${attributeName}: ${oldValue} → ${reactiveParam.value}`);
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
                
                if (!powerParam && !reactiveParam && !configParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        console.log('=== AsymmetricLoadDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsAsymmetricLoad = [defaultAsymmetricLoadData];

export const columnDefsAsymmetricLoad = [  
    {
        field: "name",
        headerTooltip: "Name of the asymmetric load",
        maxWidth: 150
    },
    {
        field: "p_a_mw",
        headerTooltip: "The active power for Phase A load (≥0)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "p_b_mw",
        headerTooltip: "The active power for Phase B load (≥0)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "p_c_mw",
        headerTooltip: "The active power for Phase C load (≥0)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "q_a_mvar",
        headerTooltip: "The reactive power for Phase A load",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "q_b_mvar",
        headerTooltip: "The reactive power for Phase B load",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "q_c_mvar",
        headerTooltip: "The reactive power for Phase C load",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "sn_mva",
        headerTooltip: "Nominal power of the load (>0). Not considered in power flow calculations.",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "scaling",
        headerTooltip: "Scaling factor that multiplies with p_mw and q_mvar of all phases (≥0)",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "type",
        headerTooltip: "Connection type of three phase load: wye (same as PH-E loads) or delta",
        maxWidth: 100
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the load is in service (True/False)",
        maxWidth: 100
    }
];
  
export const gridOptionsAsymmetricLoad = {
    columnDefs: columnDefsAsymmetricLoad,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsAsymmetricLoad,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsAsymmetricLoad = gridOptionsAsymmetricLoad;
globalThis.rowDefsAsymmetricLoad = rowDefsAsymmetricLoad;
globalThis.columnDefsAsymmetricLoad = columnDefsAsymmetricLoad;
globalThis.AsymmetricLoadDialog = AsymmetricLoadDialog;
  
  
  
  