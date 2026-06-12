// Dialog.js - Base class for all dialogs
import {
    DIALOG_STYLES,
    attachBackdropCloseHandler,
    getDrawioStudyDialogHeight,
    getStudyModalDialogBoxStyle,
    preventAccidentalFormSubmit,
    preventAccidentalFormSubmitOnTree,
    SIMULATION_FORM_SCROLL_STYLE,
    SIMULATION_INFO_BANNER_STYLE,
    STUDY_MODAL_CONTENT_WRAPPER_STYLE,
    STUDY_MODAL_OVERLAY_STYLE
} from './utils/dialogStyles.js';

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
            minWidth: 0,
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            ...(this.useStudyModalShell
                ? {
                    flex: '1 1 auto',
                    minHeight: '0',
                    maxHeight: '100%',
                    overflow: 'hidden'
                }
                : {})
        });

        // Add description if provided
        if (this.getDescription) {
            const description = document.createElement('div');
            Object.assign(description.style, SIMULATION_INFO_BANNER_STYLE);
            description.innerHTML = this.getDescription();
            container.appendChild(description);
        }

        // Create content area (scrollable)
        const contentArea = document.createElement('div');
        Object.assign(
            contentArea.style,
            this.useStudyModalShell
                ? SIMULATION_FORM_SCROLL_STYLE
                : {
                    overflowY: 'auto',
                    overflowX: 'auto',
                    flex: '1 1 auto',
                    minHeight: '0',
                    minWidth: 0,
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#c5ccd3 #f1f3f5',
                    paddingRight: '8px'
                }
        );

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            boxSizing: 'border-box'
        });
        preventAccidentalFormSubmit(form);

        // Create form fields from parameters
        if (this.parameters && Array.isArray(this.parameters)) {
            this.parameters.forEach(param => {
                const formGroup = document.createElement('div');
                Object.assign(formGroup.style, {
                    marginBottom: '6px',
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
                });

                let input;
                if (param.type !== 'section') {
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
                    if (param.description) {
                        const hint = document.createElement('div');
                        Object.assign(hint.style, {
                            fontSize: '12px',
                            color: '#6c757d',
                            lineHeight: '1.4',
                            marginBottom: '4px',
                            fontStyle: 'italic'
                        });
                        hint.textContent = param.description;
                        formGroup.appendChild(hint);
                    }
                }
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
                } else if (param.type === 'section') {
                    const sectionDiv = document.createElement('div');
                    Object.assign(sectionDiv.style, {
                        marginTop: '16px',
                        marginBottom: '8px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #e9ecef'
                    });
                    const titleEl = document.createElement('div');
                    Object.assign(titleEl.style, {
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#495057',
                        marginBottom: '2px'
                    });
                    titleEl.textContent = param.label;
                    sectionDiv.appendChild(titleEl);
                    if (param.subtitle) {
                        const subEl = document.createElement('div');
                        Object.assign(subEl.style, {
                            fontSize: '12px',
                            color: '#6c757d',
                            fontStyle: 'italic'
                        });
                        subEl.textContent = param.subtitle;
                        sectionDiv.appendChild(subEl);
                    }
                    formGroup.appendChild(sectionDiv);
                    formGroup.style.marginBottom = '8px';
                    input = null;
                } else if (param.type === 'select') {
                    input = document.createElement('select');
                    input.id = param.id;
                    Object.assign(input.style, {
                        width: '100%',
                        minWidth: '120px',
                        maxWidth: '100%',
                        padding: '6px 10px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
                    });
                    (param.options || []).forEach(opt => {
                        const o = document.createElement('option');
                        const val = typeof opt === 'object' ? opt.value : opt;
                        const lbl = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                        o.value = String(val);
                        o.textContent = lbl;
                        if (typeof opt === 'object' && opt.default) o.selected = true;
                        input.appendChild(o);
                    });
                    if (param.value != null && param.value !== '') {
                        input.value = String(param.value);
                    } else if (!(param.options || []).some(o => typeof o === 'object' && o.default) && (param.options || []).length) {
                        input.selectedIndex = 0;
                    }
                    this.inputs.set(param.id, input);
                } else {
                    input = document.createElement('input');
                    input.type = param.type;
                    input.id = param.id;
                    input.value = param.value;
                    Object.assign(input.style, {
                        width: '100%',
                        minWidth: '120px',
                        maxWidth: '100%',
                        padding: '6px 10px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box'
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
                    if (param.step) input.step = param.step;
                    if (param.min !== undefined) input.min = param.min;
                    if (param.max !== undefined) input.max = param.max;
                    this.inputs.set(param.id, input);
                }

                if (input != null) formGroup.appendChild(input);
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
            this.closeDialog();
        };

        applyButton.onclick = (e) => {
            e.preventDefault();
            const values = this.getFormValues();
            console.log(`${this.title} values:`, values);
            
            if (this.callback) {
                this.callback(values);
            }
            
            this.closeDialog();
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);

        // Only add our buttons when using DrawIO's showDialog - showModalFallback adds its own
        const useDrawIODialog = !this.useModalFallback && this.ui && typeof this.ui.showDialog === 'function';

        if (this.useStudyModalShell) {
            Object.assign(buttonContainer.style, { flexShrink: '0' });
            container.appendChild(buttonContainer);
            this.container = container;
            preventAccidentalFormSubmitOnTree(container);
            const w = this.studyModalBoxWidth != null ? this.studyModalBoxWidth : 720;
            this.mountStudyModalShell(w);
            return;
        }

        if (useDrawIODialog) {
            container.appendChild(buttonContainer);
        }

        this.container = container;
        preventAccidentalFormSubmitOnTree(container);

        // Use DrawIO's dialog system like externalGridDialog does
        if (useDrawIODialog) {
            // The true, false parameters tell DrawIO not to create its own buttons
            // Pass onDialogClose so destroy() runs when closed via ESC (ensures cleanupCallback runs)
            this.ui.showDialog(container, 720, getDrawioStudyDialogHeight(), true, false, () => {
                this.destroy();
                return 1; // Allow DrawIO to proceed with DOM removal
            });
        } else {
            this.showModalFallback(container);
        }
    }

    /**
     * Same full-viewport modal shell as Load Flow (title bar + flex body + scroll region).
     * @param {number} boxWidthPx Content max width before vw cap (default 720).
     */
    mountStudyModalShell(boxWidthPx = 720) {
        this.modalOverlay = document.createElement('div');
        Object.assign(this.modalOverlay.style, STUDY_MODAL_OVERLAY_STYLE);

        const dialogBox = document.createElement('div');
        Object.assign(dialogBox.style, getStudyModalDialogBoxStyle(boxWidthPx));

        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            padding: '16px 20px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e9ecef',
            fontWeight: '600',
            fontSize: '16px',
            color: '#495057',
            flexShrink: '0'
        });
        titleBar.textContent = this.title;
        dialogBox.appendChild(titleBar);

        const contentWrapper = document.createElement('div');
        Object.assign(contentWrapper.style, STUDY_MODAL_CONTENT_WRAPPER_STYLE);
        contentWrapper.appendChild(this.container);
        dialogBox.appendChild(contentWrapper);

        this.modalOverlay.appendChild(dialogBox);
        document.body.appendChild(this.modalOverlay);

        preventAccidentalFormSubmitOnTree(this.container);
        attachBackdropCloseHandler(this.modalOverlay, dialogBox, () => this.destroy());
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
            if (param.type === 'section') {
                height += 50;
            } else {
                height += 30; // Label
                if (param.type === 'radio') {
                    height += (param.options.length * 25) + 20; // Radio options + container padding
                } else if (param.type === 'checkbox') {
                    height += 25; // Checkbox
                } else {
                    height += 35; // Input field
                }
            }
            height += 10; // Margin between fields
        });
        
        return height;
    }

    getFormValues() {
        if (!this.parameters) return [];
        
        return this.parameters
            .filter(param => param.type !== 'section')
            .map(param => {
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
            maxWidth: '720px',
            width: '95%',
            minWidth: '320px',
            maxHeight: 'min(92vh, 920px)',
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
            minWidth: 0,
            overflow: 'auto'
        });
        contentWrapper.appendChild(content);
        dialogContainer.appendChild(contentWrapper);
        preventAccidentalFormSubmitOnTree(content);

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
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        Object.assign(cancelButton.style, {
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        cancelButton.onclick = () => this.closeDialog();

        const okButton = document.createElement('button');
        okButton.type = 'button';
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
        attachBackdropCloseHandler(overlay, dialogContainer, () => {
            this.destroy();
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        });
    }

    /** Close whether shown via custom overlay, fallback modal, or Draw.io showDialog. */
    closeDialog() {
        const customOverlay = !!(this.modalOverlay && document.body.contains(this.modalOverlay));
        this.destroy();
        if (!customOverlay && this.ui && typeof this.ui.hideDialog === 'function') {
            this.ui.hideDialog();
        }
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
        
        // Clean up modal overlay if using fallback (guard against double-removal/ESC race)
        if (this.modalOverlay && document.body.contains(this.modalOverlay)) {
            try { document.body.removeChild(this.modalOverlay); } catch (e) { /* ignore */ }
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
        button.type = 'button';
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

function patchEditorUiShowDialogFormGuard() {
    const tryPatch = () => {
        const proto = window.EditorUi?.prototype;
        if (!proto || proto._electrisimFormGuardPatched) return !!proto;
        const original = proto.showDialog;
        proto.showDialog = function(elt, ...args) {
            preventAccidentalFormSubmitOnTree(elt);
            return original.call(this, elt, ...args);
        };
        proto._electrisimFormGuardPatched = true;
        return true;
    };
    if (!tryPatch()) {
        window.addEventListener('load', tryPatch, { once: true });
    }
}

patchEditorUiShowDialogFormGuard();