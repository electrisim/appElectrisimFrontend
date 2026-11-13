import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';
import { SIMULATION_FORM_SCROLL_STYLE, SIMULATION_INFO_BANNER_STYLE, STUDY_MODAL_OVERLAY_STYLE, attachBackdropCloseHandler, getStudyModalDialogBoxStyle, preventAccidentalFormSubmit, STUDY_MODAL_CONTENT_WRAPPER_STYLE } from '../utils/dialogStyles.js';

function cellAttribute(cell, name) {
    const value = cell && cell.value;
    return value && typeof value.getAttribute === 'function' ? (value.getAttribute(name) || '') : '';
}

function cellShape(cell) {
    const style = (cell && typeof cell.getStyle === 'function' && cell.getStyle()) || '';
    const match = String(style).match(/shapeELXXX=([^;]+)/);
    return match ? match[1].trim() : '';
}

/**
 * Buses of the diagram for the frequency-scan list, highest voltage first.
 * The default selection is the bus of the External Grid (the point of connection).
 */
function collectBusOptions(graph) {
    const options = [];
    let defaults = [];
    try {
        const model = graph.getModel();
        const cells = Object.values(model.cells || {});
        const buses = cells.filter((cell) => cellShape(cell) === 'Bus');
        const busIds = new Set(buses.map((cell) => cell.id));
        const busOf = (cell) => {
            // a connected terminal is the bus itself or a port drawn on it
            for (let c = cell; c; c = c.parent) {
                if (busIds.has(c.id)) return c.id;
            }
            return null;
        };
        buses
            .map((cell) => ({
                id: cell.id,
                name: cellAttribute(cell, 'name') || cell.id,
                vn: parseFloat(cellAttribute(cell, 'vn_kv'))
            }))
            .sort((a, b) => ((Number.isFinite(b.vn) ? b.vn : -1) - (Number.isFinite(a.vn) ? a.vn : -1))
                || a.name.localeCompare(b.name, undefined, { numeric: true }))
            .forEach((bus) => {
                options.push({
                    value: bus.id,
                    label: Number.isFinite(bus.vn) ? `${bus.name.trim()} (${bus.vn} kV)` : bus.name.trim()
                });
            });
        const grid = cells.find((cell) => cellShape(cell) === 'External Grid');
        if (grid) {
            const neighbours = [grid, ...(grid.children || [])];
            for (const cell of neighbours) {
                for (const edge of (cell.edges || [])) {
                    const other = edge.source === cell ? edge.target : edge.source;
                    const busId = busOf(other);
                    if (busId) { defaults = [busId]; break; }
                }
                if (defaults.length) break;
            }
        }
        if (!defaults.length && options.length) defaults = [options[0].value];
    } catch (e) {
        console.warn('HarmonicAnalysisDialog: could not list buses for the frequency scan', e);
    }
    return { options, defaults };
}

/**
 * HarmonicAnalysisDialog
 * ----------------------
 * Standalone dialog for configuring OpenDSS harmonic analysis parameters.
 * This dialog is separate from the main Load Flow dialog and focuses only
 * on harmonic-specific options.
 *
 * It does not offer a Pandapower tab; it is dedicated to OpenDSS.
 */
export class HarmonicAnalysisDialog extends Dialog {
    constructor(editorUi) {
        super('OpenDSS Harmonic Analysis', 'Run Harmonic Analysis');

        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph || window.App?.main?.editor?.graph;

        // Single-Engine parameter set for OpenDSS harmonic analysis
        // Based on: https://opendss.epri.com/HarmonicFlowAnalysis.html
        //           https://opendss.epri.com/HarmonicsLoadModeling.html
        const busOptions = collectBusOptions(this.graph);
        this.parameters = [
            {
                id: 'frequency',
                label: 'Base Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            },
            {
                id: 'operatingPoint',
                label: 'Operating point (fundamental-frequency load flow)',
                type: 'radio',
                hint: 'OpenDSS has no park controller, plant supervisory controller, STATCOM or transformer tap ' +
                      'control. The controlled load flow applies them (with your Load Flow settings) and the ' +
                      'harmonic study starts from that result.',
                options: [
                    { value: 'controlled', label: 'Controlled load flow (controllers, STATCOM, tap and reactor steps applied)', default: true },
                    { value: 'opendss', label: 'OpenDSS load flow only' }
                ]
            },
            {
                id: 'mode',
                label: 'Initial Solution Mode',
                type: 'radio',
                options: [
                    { value: 'Snapshot', label: 'Snapshot (single power flow)', default: true },
                    { value: 'Daily', label: 'Daily' },
                    { value: 'Dutycycle', label: 'Dutycycle' },
                    { value: 'Yearly', label: 'Yearly' }
                ]
            },
            {
                id: 'algorithm',
                label: 'Initial Solution Algorithm',
                type: 'radio',
                options: [
                    { value: 'Normal', label: 'Normal (fast current injection)', default: true },
                    { value: 'Newton', label: 'Newton (robust for difficult circuits)' }
                ]
            },
            {
                id: 'loadmodel',
                label: 'Load Model (Initial Power Flow)',
                type: 'radio',
                options: [
                    { value: 'Powerflow', label: 'Powerflow (iterative power injections)', default: true },
                    { value: 'Admittance', label: 'Admittance (direct solution)' }
                ]
            },
            {
                id: 'harmonics',
                label: 'Harmonic Orders (list and ranges, e.g. 3,5,7,11,13 or 2-50)',
                type: 'text',
                value: '3,5,7,11,13',
                presets: [
                    { label: 'Characteristic (5-25)', value: '5,7,11,13,17,19,23,25' },
                    { label: 'Odd 3-25', value: '3,5,7,9,11,13,15,17,19,21,23,25' },
                    { label: 'All 2-25', value: '2-25' },
                    { label: 'All 2-50', value: '2-50' }
                ]
            },
            {
                id: 'frequencyScan',
                label: 'Frequency scan: impedance seen from a bus over frequency, to find resonances',
                type: 'checkbox',
                value: true
            },
            {
                id: 'scanBusIds',
                label: 'Frequency scan buses (up to 6; Ctrl+click for several)',
                type: 'multiselect',
                options: busOptions.options,
                value: busOptions.defaults
            },
            {
                id: 'scanMaxOrder',
                label: 'Frequency scan up to harmonic order',
                type: 'number',
                value: '50'
            },
            {
                id: 'scanStep',
                label: 'Frequency scan step (harmonic order)',
                type: 'select',
                options: [
                    { value: '0.05', label: '0.05 (2.5 Hz at 50 Hz)' },
                    { value: '0.1', label: '0.1 (5 Hz at 50 Hz)' },
                    { value: '0.2', label: '0.2 (10 Hz at 50 Hz)' },
                    { value: '0.5', label: '0.5 (25 Hz at 50 Hz)' }
                ],
                value: '0.1'
            },
            {
                id: 'neglectLoadY',
                label: 'Neglect load shunt admittance in harmonics (Set NeglectLoadY=Yes)',
                type: 'checkbox',
                value: false
            },
            {
                id: 'maxIterations',
                label: 'Max Iterations (initial power flow)',
                type: 'number',
                value: '100'
            },
            {
                id: 'tolerance',
                label: 'Convergence Tolerance (initial power flow)',
                type: 'number',
                value: '0.0001'
            },
            {
                id: 'controlmode',
                label: 'Control Mode',
                type: 'radio',
                options: [
                    { value: 'Static', label: 'Static (no control actions)', default: true },
                    { value: 'Event', label: 'Event (time-based controls)' },
                    { value: 'Time', label: 'Time (continuous controls)' }
                ]
            },
            {
                id: 'exportCommands',
                label: 'Export OpenDSS Commands (download .txt file)',
                type: 'checkbox',
                value: false
            },
            {
                id: 'exportOpenDSSResults',
                label: 'Export OpenDSS Results (download .txt file)',
                type: 'checkbox',
                value: false
            }
        ];
    }

    getDescription() {
        return '<strong>Configure OpenDSS harmonic analysis parameters.</strong><br>' +
               'A load flow fixes the operating point, then every selected harmonic order is solved ' +
               '(<code>Solve mode=harmonics</code>) and, if selected, the impedance at the chosen buses is ' +
               'scanned over frequency. Harmonic sources are the spectra set on loads, generators and ' +
               'inverters (Harmonic parameters of each element). ' +
               'See the <a href="https://electrisim.com/documentation.html#harmonic-analysis" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }

    createForm() {
        const form = document.createElement('form');
        preventAccidentalFormSubmit(form);
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '100%',
            boxSizing: 'border-box'
        });

        this.parameters.forEach((param) => {
            const group = document.createElement('div');
            Object.assign(group.style, { marginBottom: '4px' });

            const label = document.createElement('label');
            Object.assign(label.style, {
                display: 'block',
                marginBottom: '2px',
                fontWeight: '600',
                fontSize: '13px',
                color: '#495057'
            });
            label.textContent = param.label;
            group.appendChild(label);

            if (param.hint) {
                const hint = document.createElement('div');
                Object.assign(hint.style, { fontSize: '12px', color: '#6c757d', margin: '0 0 6px 0', lineHeight: '1.4' });
                hint.textContent = param.hint;
                group.appendChild(hint);
            }

            let input;
            if (param.type === 'radio') {
                input = this.createRadioGroup(param);
            } else if (param.type === 'checkbox') {
                input = this.createCheckbox(param);
            } else if (param.type === 'select' || param.type === 'multiselect') {
                input = this.createSelect(param);
            } else {
                input = this.createTextInput(param);
            }

            group.appendChild(input);
            if (Array.isArray(param.presets) && param.presets.length) {
                group.appendChild(this.createPresetRow(param, input));
            }
            form.appendChild(group);
        });

        return form;
    }

    createRadioGroup(param) {
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        });

        param.options.forEach((option, index) => {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
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

            wrapper.appendChild(radio);
            wrapper.appendChild(radioLabel);
            container.appendChild(wrapper);
        });

        // Store container for this radio group
        this.inputs.set(param.id, container);
        return container;
    }

    createCheckbox(param) {
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = param.id;
        checkbox.checked = param.value;
        Object.assign(checkbox.style, {
            width: '16px',
            height: '16px',
            accentColor: '#007bff'
        });

        this.inputs.set(param.id, checkbox);

        const label = document.createElement('label');
        label.htmlFor = param.id;
        label.textContent = param.label;
        Object.assign(label.style, {
            fontSize: '13px',
            color: '#6c757d',
            cursor: 'pointer'
        });

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        return wrapper;
    }

    createTextInput(param) {
        const input = document.createElement('input');
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
            input.style.borderColor = '#007bff';
            input.style.outline = 'none';
            input.style.boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.2)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = '#ced4da';
            input.style.boxShadow = 'none';
        });
        this.inputs.set(param.id, input);
        return input;
    }

    createSelect(param) {
        const select = document.createElement('select');
        select.id = param.id;
        const multiple = param.type === 'multiselect';
        if (multiple) {
            select.multiple = true;
            select.size = Math.min(6, Math.max(3, (param.options || []).length));
        }
        Object.assign(select.style, {
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'inherit',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box'
        });
        const chosen = new Set((Array.isArray(param.value) ? param.value : [param.value]).map(String));
        (param.options || []).forEach((option) => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            opt.selected = chosen.has(String(option.value));
            select.appendChild(opt);
        });
        this.inputs.set(param.id, select);
        return select;
    }

    /** Buttons that fill a text field with a ready-made value. */
    createPresetRow(param, input) {
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' });
        param.presets.forEach((preset) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = preset.label;
            button.title = preset.value;
            Object.assign(button.style, {
                padding: '3px 10px',
                border: '1px solid #ced4da',
                borderRadius: '12px',
                backgroundColor: '#f8f9fa',
                color: '#495057',
                fontSize: '12px',
                cursor: 'pointer'
            });
            button.addEventListener('click', () => {
                input.value = preset.value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            row.appendChild(button);
        });
        return row;
    }

    getFormValues() {
        const values = {};

        this.parameters.forEach((param) => {
            if (param.type === 'radio') {
                const container = this.inputs.get(param.id);
                const checkedRadio = container
                    ? container.querySelector(`input[name="${param.id}"]:checked`)
                    : null;
                values[param.id] = checkedRadio ? checkedRadio.value : param.options[0].value;
            } else if (param.type === 'checkbox') {
                const checkbox = this.inputs.get(param.id);
                values[param.id] = checkbox ? checkbox.checked : !!param.value;
            } else if (param.type === 'multiselect') {
                const select = this.inputs.get(param.id);
                values[param.id] = select
                    ? Array.from(select.selectedOptions).map((o) => o.value).slice(0, 6)
                    : (param.value || []);
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.value : param.value;
            }
        });

        // Fixed engine and analysis type for this dialog
        values.engine = 'opendss';
        values.analysisType = 'harmonic';

        return values;
    }

    show(callback) {
        callback = globalThis.rememberStudySettings?.(this, callback) ?? callback;
        // Fresh inputs map
        this.inputs.clear();

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
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: '0',
            maxHeight: '100%',
            overflow: 'hidden'
        });

        if (this.getDescription) {
            const description = document.createElement('div');
            Object.assign(description.style, SIMULATION_INFO_BANNER_STYLE);
            description.innerHTML = this.getDescription();
            container.appendChild(description);
        }

        const scrollableContent = document.createElement('div');
        Object.assign(scrollableContent.style, SIMULATION_FORM_SCROLL_STYLE);

        const form = this.createForm();
        scrollableContent.appendChild(form);
        container.appendChild(scrollableContent);

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef',
            flexShrink: '0'
        });

        const cancelButton = this.createButton('Cancel', '#6c757d', '#5a6268');
        const applyButton = this.createButton(this.submitButtonText, '#007bff', '#0056b3');

        cancelButton.onclick = (e) => {
            e.preventDefault();
            this.closeDialog();
        };

        applyButton.onclick = async (e) => {
            e.preventDefault();

            // Check subscription status before proceeding
            try {
                const hasSubscription = await this.checkSubscriptionStatus();

                if (!hasSubscription) {
                    this.closeDialog();

                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to use the Harmonic Analysis feature.');
                    }
                    return;
                }

                const values = this.getFormValues();
                if (callback) {
                    callback(values);
                }
                this.closeDialog();
            } catch (error) {
                console.error('HarmonicAnalysisDialog: Error checking subscription status:', error);
                if (error.message && error.message.includes('Token expired')) {
                    alert('Your session has expired. Please log in again.');
                    if (window.location.href.includes('app.electrisim.com')) {
                        window.location.href = '/login.html';
                    }
                } else if (error.message && error.message.includes('NetworkError')) {
                    alert('Network connection error. Please check your internet connection and try again.');
                } else if (error.message && error.message.includes('Failed to fetch')) {
                    alert(
                        'Unable to connect to the server.\n\n' +
                        'This often happens when using a corporate VPN (SSL/certificate is not trusted). Try disconnecting from VPN, using another network, or ask IT to add your organisation\'s root certificate. Contact electrisim@electrisim.com if it persists.'
                    );
                } else {
                    alert('Unable to verify subscription status. Please try again. If the issue persists, contact support.');
                }
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        this.container = container;
        this.createModalOverlay();
        this.displayDialog();
    }

    createModalOverlay() {
        this.modalOverlay = document.createElement('div');
        Object.assign(this.modalOverlay.style, STUDY_MODAL_OVERLAY_STYLE);

        const dialogBox = document.createElement('div');
        Object.assign(dialogBox.style, getStudyModalDialogBoxStyle(600));

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

        attachBackdropCloseHandler(this.modalOverlay, dialogBox, () => this.closeDialog());
    }

    displayDialog() {
        // No-op; dialog is already attached via overlay
    }

    destroy() {
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            document.body.removeChild(this.modalOverlay);
        }
        this.modalOverlay = null;
        this.container = null;
    }

    createButton(text, backgroundColor, hoverColor) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        Object.assign(button.style, {
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            backgroundColor,
            color: 'white',
            transition: 'background-color 0.2s ease'
        });

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = hoverColor;
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = backgroundColor;
        });

        return button;
    }

    async checkSubscriptionStatus() {
        try {
            await ensureSubscriptionFunctions();

            if (window.checkSubscriptionStatus) {
                return await window.checkSubscriptionStatus();
            }

            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                return await window.SubscriptionManager.checkSubscriptionStatus();
            }

            console.warn('HarmonicAnalysisDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('HarmonicAnalysisDialog: Error in checkSubscriptionStatus:', error);
            throw error;
        }
    }
}

// Also expose globally so existing app.min.js style code can use it if needed
if (typeof window !== 'undefined') {
    window.HarmonicAnalysisDialog = HarmonicAnalysisDialog;
}

