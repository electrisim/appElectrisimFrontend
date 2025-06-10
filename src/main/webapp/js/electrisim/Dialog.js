// Dialog.js - Base class for all dialogs
import { DIALOG_STYLES } from './utils/dialogStyles.js';

export class Dialog {
    constructor(title, submitButtonText = 'OK') {
        this.title = title;
        this.submitButtonText = submitButtonText;
        this.container = null;
        this.modalOverlay = null;
        this.ui = null;
        this.inputs = new Map();
    }

    show(callback, parameters = []) {
        // Use global App if ui is not valid
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        
        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
            backgroundColor: '#ffffff',
            width: '100%',
            maxWidth: '700px',
            height: 'auto',
            maxHeight: '98vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        });

        // Create header
        const header = document.createElement('div');
        Object.assign(header.style, {
            backgroundColor: '#f8f9fa',
            padding: '16px 20px',
            borderBottom: '1px solid #e9ecef',
            borderRadius: '8px 8px 0 0',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#495057'
        });
        header.textContent = this.title;
        container.appendChild(header);

        const form = document.createElement('form');
        Object.assign(form.style, {
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflowY: 'auto',
            overflowX: 'hidden',
            maxHeight: 'calc(98vh - 60px)',
            width: '100%',
            boxSizing: 'border-box',
            flex: '1',
            minHeight: 'auto'
        });
        
        // Add description if provided
        if (this.getDescription) {
            const description = document.createElement('div');
            Object.assign(description.style, {
                padding: '6px 10px',
                backgroundColor: '#e3f2fd',
                border: '1px solid #bbdefb',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#1565c0',
                marginBottom: '8px'
            });
            description.innerHTML = this.getDescription();
            form.appendChild(description);
        }

        // Create form fields from parameters
        if (this.parameters && Array.isArray(this.parameters)) {
            this.parameters.forEach(param => {
                const formGroup = document.createElement('div');
                Object.assign(formGroup.style, {
                    marginBottom: '6px'
                });

                const label = document.createElement('label');
                Object.assign(label.style, {
                    display: 'block',
                    marginBottom: '2px',
                    fontWeight: '600',
                    fontSize: '13px',
                    color: '#495057'
                });
                label.textContent = param.label;
                formGroup.appendChild(label);

                let input;
                if (param.type === 'radio') {
                    input = this.createRadioGroup(param);
                } else if (param.type === 'checkbox') {
                    const checkboxWrapper = document.createElement('div');
                    Object.assign(checkboxWrapper.style, {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    });

                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.id = param.id;
                    input.checked = param.value;
                    Object.assign(input.style, {
                        width: '16px',
                        height: '16px',
                        accentColor: '#0066cc'
                    });
                    this.inputs.set(param.id, input);

                    const checkboxLabel = document.createElement('label');
                    checkboxLabel.htmlFor = param.id;
                    checkboxLabel.textContent = param.label;
                    Object.assign(checkboxLabel.style, {
                        fontSize: '13px',
                        color: '#6c757d',
                        cursor: 'pointer'
                    });

                    checkboxWrapper.appendChild(input);
                    checkboxWrapper.appendChild(checkboxLabel);
                    input = checkboxWrapper;
                } else {
                    input = document.createElement('input');
                    input.type = param.type;
                    input.id = param.id;
                    input.value = param.value;
                    Object.assign(input.style, {
                        width: '100%',
                        padding: '6px 10px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        backgroundColor: '#ffffff'
                    });
                    input.addEventListener('focus', () => {
                        input.style.borderColor = '#0066cc';
                        input.style.outline = 'none';
                        input.style.boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.2)';
                    });
                    input.addEventListener('blur', () => {
                        input.style.borderColor = '#ced4da';
                        input.style.boxShadow = 'none';
                    });
                    this.inputs.set(param.id, input);
                }

                formGroup.appendChild(input);
                form.appendChild(formGroup);
            });
        }

        // Add button container
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            marginTop: '12px',
            justifyContent: 'flex-end',
            paddingTop: '8px',
            paddingBottom: '0',
            borderTop: '1px solid #e9ecef'
        });

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        Object.assign(cancelButton.style, {
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        });
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = '#5a6268';
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = '#6c757d';
        });

        const okButton = document.createElement('button');
        okButton.textContent = this.submitButtonText;
        Object.assign(okButton.style, {
            padding: '10px 20px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        });
        okButton.addEventListener('mouseenter', () => {
            okButton.style.backgroundColor = '#0052a3';
        });
        okButton.addEventListener('mouseleave', () => {
            okButton.style.backgroundColor = '#0066cc';
        });

        okButton.onclick = (e) => {
            e.preventDefault();
            const values = this.getFormValues();
            
            console.log(`${this.title} values:`, values);
            
            if (callback) {
                callback(values);
            }
            
            this.destroy();
        };

        cancelButton.onclick = (e) => {
            e.preventDefault();
            this.destroy();
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(okButton);
        form.appendChild(buttonContainer);
        container.appendChild(form);

        this.container = container;

        // Show dialog
        if (this.ui && typeof this.ui.showDialog === 'function') {
            this.ui.showDialog(container, 720, 700, true, true);
        } else {
            this.showModalFallback(container);
        }
    }

    getFormValues() {
        if (!this.parameters) return [];
        
        return this.parameters.map(param => {
            if (param.type === 'radio') {
                const selectedRadio = param.options.find(option => 
                    this.inputs.get(`${param.id}_${option.value}`).checked
                );
                return selectedRadio ? selectedRadio.value : param.options.find(opt => opt.default)?.value;
            } else {
                const input = this.inputs.get(param.id);
                if (param.type === 'checkbox') {
                    return input ? input.checked : param.value;
                } else {
                    return input ? input.value : param.value;
                }
            }
        });
    }

    showModalFallback(content) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10000'
        });

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        this.modalOverlay = overlay;
    }

    createRadioGroup(param) {
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '4px 8px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '4px',
            width: '100%',
            boxSizing: 'border-box'
        });

        param.options.forEach(option => {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            });

            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `${param.id}_${option.value}`;
            input.name = param.id;
            input.value = option.value;
            Object.assign(input.style, {
                width: '16px',
                height: '16px',
                accentColor: '#0066cc'
            });
            if (option.default) {
                input.checked = true;
            }

            const label = document.createElement('label');
            label.htmlFor = input.id;
            label.textContent = option.label;
            Object.assign(label.style, {
                fontSize: '13px',
                color: '#495057',
                cursor: 'pointer',
                userSelect: 'none'
            });

            wrapper.appendChild(input);
            wrapper.appendChild(label);
            container.appendChild(wrapper);

            this.inputs.set(`${param.id}_${option.value}`, input);
        });

        return container;
    }

    destroy() {
        if (this.ui && typeof this.ui.hideDialog === 'function') {
            this.ui.hideDialog();
        } else if (this.modalOverlay) {
            document.body.removeChild(this.modalOverlay);
        }
    }

    // Legacy methods for backward compatibility
    create() {
        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '20px',
            maxHeight: '80vh',
            overflow: 'auto'
        });

        const titleElement = document.createElement('h2');
        titleElement.textContent = this.title;
        Object.assign(titleElement.style, {
            margin: '0',
            fontSize: '1.5em',
            fontWeight: 'bold'
        });
        this.container.appendChild(titleElement);

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
        });

        form.addEventListener('submit', (e) => e.preventDefault());

        return form;
    }

    createFormGroup(label, input) {
        const formGroup = document.createElement('div');
        Object.assign(formGroup.style, DIALOG_STYLES.formGroup);

        const labelElement = document.createElement('label');
        Object.assign(labelElement.style, DIALOG_STYLES.label);
        labelElement.textContent = label;

        formGroup.appendChild(labelElement);
        formGroup.appendChild(input);

        return formGroup;
    }

    createInput(type, id, defaultValue = '') {
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.value = defaultValue;

        if (type === 'checkbox') {
            input.style.width = 'auto';
        } else {
            Object.assign(input.style, DIALOG_STYLES.input);
        }

        return input;
    }

    createSelect(id, options) {
        const select = document.createElement('select');
        select.id = id;
        Object.assign(select.style, DIALOG_STYLES.select);

        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
        });

        return select;
    }

    createGrid() {
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gap: '15px'
        });
        return grid;
    }

    createButtonContainer(onSubmit, onCancel) {
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px'
        });

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        Object.assign(cancelButton.style, {
            padding: '8px 16px',
            border: '1px solid #d1d5da',
            borderRadius: '6px',
            backgroundColor: '#fafbfc',
            cursor: 'pointer'
        });
        cancelButton.addEventListener('click', () => {
            if (onCancel) onCancel();
            this.close();
        });

        const submitButton = document.createElement('button');
        submitButton.textContent = this.submitButtonText;
        Object.assign(submitButton.style, {
            padding: '8px 16px',
            border: '1px solid #2ea44f',
            borderRadius: '6px',
            backgroundColor: '#2ea44f',
            color: 'white',
            cursor: 'pointer'
        });
        submitButton.addEventListener('click', () => {
            if (onSubmit) onSubmit();
            this.close();
        });

        container.appendChild(cancelButton);
        container.appendChild(submitButton);

        return container;
    }

    close() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    createErrorMessage(message) {
        const error = document.createElement('div');
        Object.assign(error.style, DIALOG_STYLES.error);
        error.textContent = message;
        return error;
    }

    createSuccessMessage(message) {
        const success = document.createElement('div');
        Object.assign(success.style, DIALOG_STYLES.success);
        success.textContent = message;
        return success;
    }
} 