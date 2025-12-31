import { Dialog } from './Dialog.js';

// Default values for VSC parameters (based on pandapower documentation)
export const defaultVscData = {
    name: "VSC",
    bus: "",
    p_mw: 0.0,
    vm_pu: 1.0,
    sn_mva: 0.0,
    rx: 0.1,
    max_ik_ka: 0.0,
    in_service: true
};

export class VscDialog extends Dialog {
    constructor(editorUi) {
        super('VSC Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultVscData };
        this.inputs = new Map();
        
        // Load Flow parameters
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'Name',
                symbol: 'name',
                description: 'Name identifier for the VSC',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'bus',
                label: 'Bus',
                symbol: 'bus',
                description: 'Index of the AC bus',
                type: 'text',
                value: this.data.bus
            },
            {
                id: 'p_mw',
                label: 'Active Power',
                symbol: 'p_mw',
                unit: 'MW',
                description: 'Active power at the AC bus',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'vm_pu',
                label: 'Voltage Magnitude',
                symbol: 'vm_pu',
                unit: 'p.u.',
                description: 'Voltage magnitude setpoint in p.u.',
                type: 'number',
                value: this.data.vm_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'sn_mva',
                label: 'Rated Power',
                symbol: 'sn_mva',
                unit: 'MVA',
                description: 'Rated apparent power of the VSC',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'rx',
                label: 'R/X Ratio',
                symbol: 'rx',
                description: 'Resistance to reactance ratio',
                type: 'number',
                value: this.data.rx.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'max_ik_ka',
                label: 'Max Short Circuit Current',
                symbol: 'max_ik_ka',
                unit: 'kA',
                description: 'Maximum short circuit current',
                type: 'number',
                value: this.data.max_ik_ka.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'in_service',
                label: 'In Service',
                symbol: 'in_service',
                description: 'Specifies if the VSC is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
        
        this.shortCircuitParameters = [];
        this.opfParameters = [];
    }
    
    getDescription() {
        return '<strong>Configure VSC Parameters</strong><br>Set parameters for Voltage Source Converter connecting AC and DC systems. See the <a href="https://pandapower.readthedocs.io/en/latest/elements/vsc.html" target="_blank">Pandapower documentation</a>.';
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
        
        tabContainer.appendChild(loadFlowTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(opfTab);
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
        
        contentArea.appendChild(loadFlowContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(opfContent);
        container.appendChild(contentArea);

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
            console.log('VSC values:', values);
            
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
        
        loadFlowTab.onclick = () => this.switchTab('loadflow', loadFlowTab, [shortCircuitTab, opfTab], loadFlowContent, [shortCircuitContent, opfContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [loadFlowTab, opfTab], shortCircuitContent, [loadFlowContent, opfContent]);
        opfTab.onclick = () => this.switchTab('opf', opfTab, [loadFlowTab, shortCircuitTab], opfContent, [loadFlowContent, shortCircuitContent]);

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
                width: '200px'
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
    }
    
    getFormValues() {
        const values = {};
        
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
                
                const allParams = [...this.loadFlowParameters, ...this.shortCircuitParameters, ...this.opfParameters];
                const param = allParams.find(p => p.id === attributeName);
                if (param) {
                    if (param.type === 'checkbox') {
                        param.value = attributeValue === 'true' || attributeValue === true;
                        const input = this.inputs.get(attributeName);
                        if (input) input.checked = param.value;
                    } else {
                        param.value = attributeValue;
                        const input = this.inputs.get(attributeName);
                        if (input) input.value = attributeValue;
                    }
                }
            }
        }
    }
}

// Make globally available
if (typeof window !== 'undefined') {
    window.VscDialog = VscDialog;
    window.defaultVscData = defaultVscData;
}

