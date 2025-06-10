// EditDataDialog.js - Dialog for editing cell data
import { Dialog } from '../Dialog.js';
import { DIALOG_STYLES } from '../utils/dialogStyles.js';

export class EditDataDialog {
    constructor(ui, cell) {
        try {
            if (!ui || !cell) {
                throw new Error('EditDataDialog requires both UI and cell parameters');
            }

            this.ui = ui;
            this.cell = cell;
            this.inputs = new Map();
            
            // Get cell value and attributes
            this.value = this.ui.editor.graph.getModel().getValue(cell) || '';
            this.attrs = {};
            
            // Extract attributes from cell value if it's an XML node
            if (this.value && this.value.attributes) {
                for (let i = 0; i < this.value.attributes.length; i++) {
                    const attr = this.value.attributes[i];
                    this.attrs[attr.nodeName] = attr.nodeValue;
                }
            }
            
            // Initialize parameters based on cell type
            this.parameters = this.initializeParameters();
            
            // Create the container in a format compatible with mxGraph Dialog
            this.container = this.createContainer();
        } catch (error) {
            console.error('Error initializing EditDataDialog:', error);
            throw error;
        }
    }
    
    createContainer() {
        const div = document.createElement('div');
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.padding = '20px';
        div.style.boxSizing = 'border-box';
        
        return div;
    }

    initializeParameters() {
        const params = [];
        const cellType = this.cell.getAttribute('type') || '';

        // Add common parameters
        params.push({
            id: 'name',
            label: 'Name',
            type: 'text',
            value: this.value || ''
        });

        // Add type-specific parameters based on cell type
        switch (cellType.toLowerCase()) {
            case 'bus':
                params.push(
                    {
                        id: 'vn_kv',
                        label: 'Nominal Voltage (kV)',
                        type: 'number',
                        value: this.attrs.vn_kv || '0'
                    },
                    {
                        id: 'in_service',
                        label: 'In Service',
                        type: 'checkbox',
                        value: this.attrs.in_service !== 'false'
                    }
                );
                break;
            case 'line':
                params.push(
                    {
                        id: 'length_km',
                        label: 'Length (km)',
                        type: 'number',
                        value: this.attrs.length_km || '1'
                    },
                    {
                        id: 'parallel',
                        label: 'Parallel Lines',
                        type: 'number',
                        value: this.attrs.parallel || '1'
                    }
                );
                break;
            case 'load':
                params.push(
                    {
                        id: 'p_mw',
                        label: 'Active Power (MW)',
                        type: 'number',
                        value: this.attrs.p_mw || '0'
                    },
                    {
                        id: 'q_mvar',
                        label: 'Reactive Power (MVAr)',
                        type: 'number',
                        value: this.attrs.q_mvar || '0'
                    }
                );
                break;
            // Add more cases for other cell types
        }

        return params;
    }

    createInput(type, id, value) {
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        
        if (type === 'checkbox') {
            input.checked = value === true || value === 'true';
        } else {
            input.value = value || '';
        }
        
        Object.assign(input.style, DIALOG_STYLES.input);
        this.inputs.set(id, input);
        return input;
    }

    init() {
        try {
            // Create form content
            const form = this.createForm();
            this.container.appendChild(form);
            
            // Focus first input
            const firstInput = this.container.querySelector('input');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        } catch (error) {
            console.error('Error initializing EditDataDialog UI:', error);
        }
    }
    
    createForm() {
        const form = document.createElement('div');
        form.style.width = '100%';
        form.style.height = '100%';
        form.style.overflow = 'auto';
        
        // Add cell ID if available
        const displayId = EditDataDialog.getDisplayIdForCell?.(this.ui, this.cell);
        if (displayId) {
            const idLabel = document.createElement('div');
            idLabel.textContent = `ID: ${displayId}`;
            idLabel.style.marginBottom = '15px';
            idLabel.style.fontSize = '12px';
            idLabel.style.color = '#666';
            form.appendChild(idLabel);
        }

        // Create form fields
        this.parameters.forEach(param => {
            const formGroup = document.createElement('div');
            formGroup.style.marginBottom = '15px';

            const label = document.createElement('label');
            label.htmlFor = param.id;
            label.textContent = param.label;
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.style.fontWeight = 'bold';

            const input = this.createInput(param.type, param.id, param.value);

            formGroup.appendChild(label);
            formGroup.appendChild(input);
            form.appendChild(formGroup);
        });

        // Add help link if configured
        if (EditDataDialog.placeholderHelpLink) {
            const helpContainer = document.createElement('div');
            helpContainer.style.marginTop = '20px';
            helpContainer.style.textAlign = 'right';

            const helpLink = document.createElement('a');
            helpLink.href = EditDataDialog.placeholderHelpLink;
            helpLink.target = '_blank';
            helpLink.textContent = 'Help';
            helpLink.style.color = '#0366d6';
            
            helpContainer.appendChild(helpLink);
            form.appendChild(helpContainer);
        }

        return form;
    }
    
    show(callback) {
        try {
            // This method is kept for backward compatibility but 
            // the actual dialog is shown via mxGraph's Dialog system
            this.callback = callback;
        } catch (error) {
            console.error('Error in EditDataDialog callback:', error);
        }
    }
    
    applyChanges() {
        try {
            const values = {};
            this.parameters.forEach(param => {
                const input = this.inputs.get(param.id);
                if (input) {
                    values[param.id] = param.type === 'checkbox' ? 
                        input.checked : 
                        input.value;
                }
            });
            
            // Update cell
            const graph = this.ui.editor.graph;
            graph.getModel().beginUpdate();
            try {
                // Update value (name)
                if (values.name !== undefined) {
                    graph.cellLabelChanged(this.cell, values.name);
                }
                
                // Update other attributes
                delete values.name;
                if (Object.keys(values).length > 0) {
                    // Update cell attributes
                    Object.keys(values).forEach(key => {
                        this.cell.setAttribute(key, values[key]);
                    });
                }
            } finally {
                graph.getModel().endUpdate();
            }
            
            // Execute callback if provided
            if (this.callback) {
                this.callback(values);
            }
        } catch (error) {
            console.error('Error applying EditDataDialog changes:', error);
        }
    }
    static getDisplayIdForCell(ui, cell) {
        try {
            if (!cell) return null;
            return cell.id || null;
        } catch (error) {
            console.error('Error in getDisplayIdForCell:', error);
            return null;
        }
    }
}

// Set default help link
EditDataDialog.placeholderHelpLink = 'https://pandapower.readthedocs.io/en/latest/elements.html'; 