// Dialog.js - Base class for all dialogs
import { DIALOG_STYLES } from './utils/dialogStyles.js';

// Try to import performance utils, but don't fail if not available
let EventListenerRegistry;
try {
    const perfUtils = await import('./utils/performanceUtils.js');
    EventListenerRegistry = perfUtils.globalEventRegistry;
} catch (e) {
    console.warn('Performance utils not available, using basic event handling');
}

export class Dialog {
    constructor(title, submitButtonText = 'OK') {
        this.title = title;
        this.submitButtonText = submitButtonText;
        this.container = null;
        this.modalOverlay = null;
        this.ui = null;
        this.inputs = new Map();
        this.cleanupCallback = null; // Callback to call when dialog is destroyed
        this.eventListenerIds = []; // Track event listener IDs for cleanup
    }
    
    /**
     * Add event listener with automatic cleanup tracking
     * @param {EventTarget} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(element, event, handler, options = {}) {
        if (EventListenerRegistry) {
            const id = EventListenerRegistry.add(element, event, handler, options);
            this.eventListenerIds.push(id);
        } else {
            // Fallback: add normally but track for manual cleanup
            element.addEventListener(event, handler, options);
            this.eventListenerIds.push({ element, event, handler, options });
        }
    }

    show(callback, parameters = []) {
        // Store callback for potential use in fallback
        this.callback = callback;
        
        // Use global App if ui is not valid
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        
        // Create a simple content container for DrawIO's dialog system
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
                marginBottom: '12px'
            });
            description.innerHTML = this.getDescription();
            container.appendChild(description);
        }

        // Create content area (scrollable)
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

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            boxSizing: 'border-box'
        });


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
                    // Use tracked event listeners for automatic cleanup
                    this.addEventListener(input, 'focus', () => {
                        input.style.borderColor = '#0066cc';
                        input.style.outline = 'none';
                        input.style.boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.2)';
                    });
                    this.addEventListener(input, 'blur', () => {
                        input.style.borderColor = '#ced4da';
                        input.style.boxShadow = 'none';
                    });
                    this.inputs.set(param.id, input);
                }

                formGroup.appendChild(input);
                form.appendChild(formGroup);
            });
        }

        // Append form to content area
        contentArea.appendChild(form);
        container.appendChild(contentArea);

        // Add button container at the bottom
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
        const applyButton = this.createButton(this.submitButtonText, '#007bff', '#0056b3');
        
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
            console.log(`${this.title} values:`, values);
            
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

        // Use DrawIO's dialog system like externalGridDialog does
        if (this.ui && typeof this.ui.showDialog === 'function') {
            // The true, false parameters tell DrawIO not to create its own buttons
            this.ui.showDialog(container, 680, 600, true, false);
        } else {
            this.showModalFallback(container);
        }
    }

    calculateContentHeight() {
        if (!this.parameters) return 200;
        
        let height = 120; // Header + padding + buttons
        
        // Add description height if present
        if (this.getDescription) {
            height += 40; // Description box
        }
        
        // Calculate height for each parameter
        this.parameters.forEach(param => {
            height += 30; // Label
            if (param.type === 'radio') {
                height += (param.options.length * 25) + 20; // Radio options + container padding
            } else if (param.type === 'checkbox') {
                height += 25; // Checkbox
            } else {
                height += 35; // Input field
            }
            height += 10; // Margin between fields
        });
        
        return height;
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

        // Create a complete dialog container for fallback
        const dialogContainer = document.createElement('div');
        Object.assign(dialogContainer.style, {
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            maxWidth: '680px',
            width: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
        });

        // Add title header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '16px 20px',
            borderBottom: '1px solid #e9ecef',
            fontWeight: 'bold',
            fontSize: '16px'
        });
        header.textContent = this.title;
        dialogContainer.appendChild(header);

        // Add content
        const contentWrapper = document.createElement('div');
        Object.assign(contentWrapper.style, {
            padding: '20px',
            flex: '1',
            overflow: 'auto'
        });
        contentWrapper.appendChild(content);
        dialogContainer.appendChild(contentWrapper);

        // Add buttons
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            padding: '16px 20px',
            borderTop: '1px solid #e9ecef',
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end'
        });

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        Object.assign(cancelButton.style, {
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        cancelButton.onclick = () => {
            this.destroy();
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };

        const okButton = document.createElement('button');
        okButton.textContent = this.submitButtonText;
        Object.assign(okButton.style, {
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        okButton.onclick = async () => {
            // Disable button to prevent multiple clicks
            okButton.disabled = true;
            const originalText = okButton.textContent;
            okButton.textContent = 'Processing...';
            
            try {
                const values = this.getFormValues();
                console.log(`${this.title} values:`, values);
                
                if (this.callback) {
                    // Check if callback is async by calling it and checking if it returns a Promise
                    const result = this.callback(values);
                    
                    // If the callback returns a Promise, wait for it to resolve
                    if (result && typeof result.then === 'function') {
                        await result;
                    }
                }
                
                // Only destroy dialog if callback completed successfully
                this.destroy();
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            } catch (error) {
                console.error('Error in dialog callback:', error);
                // Re-enable button and restore text if there was an error
                okButton.disabled = false;
                okButton.textContent = originalText;
                // Don't destroy dialog on error - let user try again
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(okButton);
        dialogContainer.appendChild(buttonContainer);

        overlay.appendChild(dialogContainer);
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
        // Clean up all tracked event listeners
        if (EventListenerRegistry) {
            for (const id of this.eventListenerIds) {
                EventListenerRegistry.remove(id);
            }
        } else {
            // Fallback: manually remove event listeners
            for (const listener of this.eventListenerIds) {
                if (listener.element && listener.event && listener.handler) {
                    listener.element.removeEventListener(listener.event, listener.handler, listener.options);
                }
            }
        }
        this.eventListenerIds = [];
        
        // Call cleanup callback if provided (for EditDataDialog cleanup)
        if (this.cleanupCallback) {
            try {
                this.cleanupCallback();
            } catch (error) {
                console.error('Error in dialog cleanup callback:', error);
            }
        }
        
        // Clean up modal overlay if using fallback
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            document.body.removeChild(this.modalOverlay);
        }
        
        // Clean up any references
        this.container = null;
        this.modalOverlay = null;
        this.callback = null;
        this.cleanupCallback = null;
        this.inputs.clear();
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

        this.addEventListener(form, 'submit', (e) => e.preventDefault());

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
        
        // Use tracked event listeners for automatic cleanup
        this.addEventListener(button, 'mouseenter', () => {
            if (!button.disabled) {
                button.style.backgroundColor = hoverColor;
            }
        });
        
        this.addEventListener(button, 'mouseleave', () => {
            if (!button.disabled) {
                button.style.backgroundColor = bgColor;
            }
        });
        
        return button;
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
        this.addEventListener(cancelButton, 'click', () => {
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
        this.addEventListener(submitButton, 'click', () => {
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