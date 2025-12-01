// Dialog Helper - Optimized dialog utilities with DOM caching
// Use this to create performant dialogs

import { domCache } from './domCache.js';
import { batchDOM } from './batchDOM.js';

class DialogHelper {
    constructor() {
        this.activeDialogs = new Map();
        this.dialogCounter = 0;
    }

    /**
     * Create an optimized form with cached DOM queries
     * @param {Array} parameters - Form parameters
     * @param {Map} inputsMap - Map to store input references
     * @returns {HTMLFormElement} The created form
     */
    createOptimizedForm(parameters, inputsMap) {
        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '100%',
            boxSizing: 'border-box'
        });

        // Create all form elements using DocumentFragment for better performance
        const elementSpecs = [];
        
        parameters.forEach((param, index) => {
            const formGroup = document.createElement('div');
            Object.assign(formGroup.style, {
                marginBottom: '4px'
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
                input = this.createOptimizedRadioGroup(param, inputsMap);
            } else if (param.type === 'checkbox') {
                input = this.createOptimizedCheckbox(param, inputsMap);
            } else {
                input = this.createOptimizedTextInput(param, inputsMap);
            }

            formGroup.appendChild(input);
            form.appendChild(formGroup);
        });

        return form;
    }

    /**
     * Create optimized radio group
     * @param {Object} param - Parameter config
     * @param {Map} inputsMap - Inputs map
     * @returns {HTMLElement} Radio group container
     */
    createOptimizedRadioGroup(param, inputsMap) {
        const radioContainer = document.createElement('div');
        Object.assign(radioContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        });

        param.options.forEach((option, index) => {
            const radioWrapper = document.createElement('div');
            Object.assign(radioWrapper.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            });

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = param.id;
            radio.value = option.value;
            radio.checked = option.default || false;
            radio.id = `${param.id}_${index}`;
            Object.assign(radio.style, {
                width: '16px',
                height: '16px',
                accentColor: '#007bff'
            });

            const radioLabel = document.createElement('label');
            radioLabel.htmlFor = `${param.id}_${index}`;
            radioLabel.textContent = option.label;
            Object.assign(radioLabel.style, {
                fontSize: '13px',
                color: '#6c757d',
                cursor: 'pointer'
            });

            radioWrapper.appendChild(radio);
            radioWrapper.appendChild(radioLabel);
            radioContainer.appendChild(radioWrapper);

            // Store reference to the radio group (only once)
            if (index === 0 && inputsMap) {
                inputsMap.set(param.id, radioContainer);
            }
        });

        return radioContainer;
    }

    /**
     * Create optimized checkbox
     * @param {Object} param - Parameter config
     * @param {Map} inputsMap - Inputs map
     * @returns {HTMLElement} Checkbox wrapper
     */
    createOptimizedCheckbox(param, inputsMap) {
        const checkboxWrapper = document.createElement('div');
        Object.assign(checkboxWrapper.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = param.id;
        checkbox.checked = param.value || false;
        checkbox.setAttribute('data-param-id', param.id);
        Object.assign(checkbox.style, {
            width: '16px',
            height: '16px',
            accentColor: '#007bff'
        });

        // Store the checkbox element directly in the inputs map
        if (inputsMap) {
            inputsMap.set(param.id, checkbox);
        }

        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = param.id;
        checkboxLabel.textContent = param.label;
        Object.assign(checkboxLabel.style, {
            fontSize: '13px',
            color: '#6c757d',
            cursor: 'pointer'
        });

        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(checkboxLabel);
        return checkboxWrapper;
    }

    /**
     * Create optimized text input
     * @param {Object} param - Parameter config
     * @param {Map} inputsMap - Inputs map
     * @returns {HTMLInputElement} Text input
     */
    createOptimizedTextInput(param, inputsMap) {
        const input = document.createElement('input');
        input.type = param.type;
        input.id = param.id;
        input.value = param.value || '';
        Object.assign(input.style, {
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'inherit',
            backgroundColor: '#ffffff'
        });

        // Use event delegation for better performance
        input.addEventListener('focus', this.handleInputFocus);
        input.addEventListener('blur', this.handleInputBlur);

        if (inputsMap) {
            inputsMap.set(param.id, input);
        }
        return input;
    }

    /**
     * Handle input focus (reusable handler)
     * @param {Event} e - Focus event
     */
    handleInputFocus(e) {
        e.target.style.borderColor = '#007bff';
        e.target.style.outline = 'none';
        e.target.style.boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.2)';
    }

    /**
     * Handle input blur (reusable handler)
     * @param {Event} e - Blur event
     */
    handleInputBlur(e) {
        e.target.style.borderColor = '#ced4da';
        e.target.style.boxShadow = 'none';
    }

    /**
     * Get form values efficiently
     * @param {Array} parameters - Form parameters
     * @param {Map} inputsMap - Inputs map
     * @returns {Object} Form values
     */
    getFormValuesOptimized(parameters, inputsMap) {
        const values = {};
        
        parameters.forEach(param => {
            if (param.type === 'radio') {
                const radioContainer = inputsMap.get(param.id);
                if (radioContainer) {
                    // Use cached query
                    const checkedRadio = radioContainer.querySelector(`input[name="${param.id}"]:checked`);
                    values[param.id] = checkedRadio ? checkedRadio.value : param.options[0].value;
                }
            } else if (param.type === 'checkbox') {
                // Get checkbox from inputs map (already cached)
                const checkbox = inputsMap.get(param.id);
                values[param.id] = checkbox ? checkbox.checked : (param.value || false);
            } else {
                const input = inputsMap.get(param.id);
                values[param.id] = input ? input.value : param.value;
            }
        });

        return values;
    }

    /**
     * Create a modal overlay with optimized rendering
     * @param {Object} config - Modal configuration
     * @returns {Object} Modal elements
     */
    async createOptimizedModal(config) {
        const dialogId = `dialog_${++this.dialogCounter}`;
        
        // Create elements using batch operations
        const modalOverlay = document.createElement('div');
        Object.assign(modalOverlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: '10000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        });

        const dialogBox = document.createElement('div');
        Object.assign(dialogBox.style, {
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            width: config.width || '600px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            minHeight: config.minHeight || '400px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });

        // Add title bar
        if (config.title) {
            const titleBar = document.createElement('div');
            Object.assign(titleBar.style, {
                padding: '16px 20px',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #e9ecef',
                fontWeight: '600',
                fontSize: '16px',
                color: '#495057'
            });
            titleBar.textContent = config.title;
            dialogBox.appendChild(titleBar);
        }

        // Add content wrapper
        const contentWrapper = document.createElement('div');
        Object.assign(contentWrapper.style, {
            padding: '20px',
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0',
            overflowY: 'auto'
        });

        if (config.content) {
            contentWrapper.appendChild(config.content);
        }

        dialogBox.appendChild(contentWrapper);
        modalOverlay.appendChild(dialogBox);

        // Use batch DOM operation to insert
        await batchDOM.write(() => {
            document.body.appendChild(modalOverlay);
        });

        // Store reference
        this.activeDialogs.set(dialogId, {
            overlay: modalOverlay,
            box: dialogBox,
            content: contentWrapper
        });

        return {
            id: dialogId,
            overlay: modalOverlay,
            box: dialogBox,
            content: contentWrapper
        };
    }

    /**
     * Close and cleanup a dialog
     * @param {string} dialogId - Dialog ID
     */
    async closeDialog(dialogId) {
        const dialog = this.activeDialogs.get(dialogId);
        if (!dialog) return;

        await batchDOM.write(() => {
            if (dialog.overlay && dialog.overlay.parentNode) {
                dialog.overlay.parentNode.removeChild(dialog.overlay);
            }
        });

        this.activeDialogs.delete(dialogId);
    }

    /**
     * Get element using cached query
     * @param {string} selector - CSS selector
     * @param {HTMLElement} context - Optional context
     * @returns {HTMLElement|null}
     */
    getCached(selector, context) {
        return domCache.querySelector(selector, context);
    }

    /**
     * Get element by ID using cache
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    getCachedById(id) {
        return domCache.getElementById(id);
    }
}

// Create global instance
const dialogHelper = new DialogHelper();

// Expose globally
window.DialogHelper = DialogHelper;
window.dialogHelper = dialogHelper;

// Export for module usage
export { DialogHelper, dialogHelper };
export default dialogHelper;

console.log('✅ Dialog Helper initialized with performance optimizations');

