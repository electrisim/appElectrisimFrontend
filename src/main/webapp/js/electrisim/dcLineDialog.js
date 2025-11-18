import { Dialog } from './Dialog.js';

// Default values for DC line parameters (based on pandapower documentation)
export const defaultDCLineData = {
    name: "DC Line",
    p_mw: 0.0,
    loss_percent: 0.0,
    loss_mw: 0.0,
    vm_from_pu: 0.0,
    vm_to_pu: 0.0,
    in_service: true
};

export class DCLineDialog extends Dialog {
    constructor(editorUi) {
        super('DC Line Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'power';
        this.data = { ...defaultDCLineData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Power parameters (necessary for executing a power flow calculation)
        this.powerParameters = [
            {
                id: 'name',
                label: 'DC Line Name',
                description: 'Name identifier for the DC line',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'p_mw',
                label: 'Active Power (MW)',
                description: 'Active power transmitted from from_bus to to_bus',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1'
            }
        ];
        
        // Loss parameters
        this.lossParameters = [
            {
                id: 'loss_percent',
                label: 'Loss Percentage (%)',
                description: 'Relative transmission loss in percent of active power transmission',
                type: 'number',
                value: this.data.loss_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'loss_mw',
                label: 'Loss (MW)',
                description: 'Total transmission loss in MW',
                type: 'number',
                value: this.data.loss_mw.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
        // Voltage parameters
        this.voltageParameters = [
            {
                id: 'vm_from_pu',
                label: 'From Bus Voltage (p.u.)',
                description: 'Voltage setpoint at from bus',
                type: 'number',
                value: this.data.vm_from_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'vm_to_pu',
                label: 'To Bus Voltage (p.u.)',
                description: 'Voltage setpoint at to bus',
                type: 'number',
                value: this.data.vm_to_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the DC line is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure DC Line Parameters</strong><br>Set parameters for DC transmission line. See the <a href="https://electrisim.com/documentation#dc-line" target="_blank">Electrisim documentation</a>.';
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
        const powerTab = this.createTab('Power', 'power', this.currentTab === 'power');
        const lossTab = this.createTab('Losses', 'loss', this.currentTab === 'loss');
        const voltageTab = this.createTab('Voltage', 'voltage', this.currentTab === 'voltage');
        
        tabContainer.appendChild(powerTab);
        tabContainer.appendChild(lossTab);
        tabContainer.appendChild(voltageTab);
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
        const lossContent = this.createTabContent('loss', this.lossParameters);
        const voltageContent = this.createTabContent('voltage', this.voltageParameters);
        
        contentArea.appendChild(powerContent);
        contentArea.appendChild(lossContent);
        contentArea.appendChild(voltageContent);
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
            console.log('DC Line values:', values);
            
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
        powerTab.onclick = () => this.switchTab('power', powerTab, [lossTab, voltageTab], powerContent, [lossContent, voltageContent]);
        lossTab.onclick = () => this.switchTab('loss', lossTab, [powerTab, voltageTab], lossContent, [powerContent, voltageContent]);
        voltageTab.onclick = () => this.switchTab('voltage', voltageTab, [powerTab, lossTab], voltageContent, [powerContent, lossContent]);

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
        [...this.powerParameters, ...this.lossParameters, ...this.voltageParameters].forEach(param => {
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
        
        console.log('DC Line dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== DCLineDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.powerParameters, ...this.lossParameters, ...this.voltageParameters].forEach(param => {
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
                
                const lossParam = this.lossParameters.find(p => p.id === attributeName);
                if (lossParam) {
                    const oldValue = lossParam.value;
                    if (lossParam.type === 'checkbox') {
                        lossParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        lossParam.value = attributeValue;
                    }
                    console.log(`  Updated loss ${attributeName}: ${oldValue} → ${lossParam.value}`);
                }
                
                const voltageParam = this.voltageParameters.find(p => p.id === attributeName);
                if (voltageParam) {
                    const oldValue = voltageParam.value;
                    if (voltageParam.type === 'checkbox') {
                        voltageParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        voltageParam.value = attributeValue;
                    }
                    console.log(`  Updated voltage ${attributeName}: ${oldValue} → ${voltageParam.value}`);
                }
                
                if (!powerParam && !lossParam && !voltageParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.powerParameters, ...this.lossParameters, ...this.voltageParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        console.log('=== DCLineDialog.populateDialog completed ===');
    }
}

// Note: Legacy AG-Grid exports have been removed to prevent conflicts with the new modern dialog system
// The DCLineDialog class is now the primary interface for editing DC line parameters
  
  
  
  