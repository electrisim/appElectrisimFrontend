// TimeSeriesSimulationDialog.js
import {
    buildLoadPresetProfile,
    buildGenerationPresetProfile,
    buildRandomAbsoluteProfile,
    parseProfileValues,
    formatProfileValues,
    normalizeProfileLength
} from '../utils/timeSeriesProfiles.js';
import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

const LOAD_TYPES = new Set(['Load', 'Asymmetric Load']);
const GEN_TYPES = new Set(['Generator', 'Static Generator', 'Asymmetric Static Generator', 'PV System', 'PVSystem']);

function parseCellStyle(style) {
    if (!style) return null;
    const pairs = style.split(';').map(pair => pair.split('='));
    return Object.fromEntries(pairs);
}

function getCellAttr(cell, attrName) {
    if (!cell?.value?.attributes) return null;
    for (let i = 0; i < cell.value.attributes.length; i++) {
        if (cell.value.attributes[i].nodeName === attrName) {
            return cell.value.attributes[i].nodeValue;
        }
    }
    return null;
}

function collectProfileElements(graph) {
    const elements = [];
    if (!graph?.getModel) return elements;
    const cells = graph.getModel().getChildCells(graph.getDefaultParent(), true, true) || [];
    for (const cell of cells) {
        const styleStr = cell.getStyle?.();
        if (!styleStr || styleStr.includes('Result')) continue;
        const style = parseCellStyle(styleStr);
        let componentType = style?.shapeELXXX;
        if (!componentType && styleStr.includes('Static Generator')) componentType = 'Static Generator';
        if (!componentType) continue;

        let elementType = null;
        if (LOAD_TYPES.has(componentType)) elementType = 'load';
        else if (GEN_TYPES.has(componentType) || componentType === 'Static Generator') {
            elementType = componentType === 'Generator' ? 'gen' : 'sgen';
        }
        if (!elementType) continue;

        const technicalName = cell.mxObjectId?.replace('#', '_') || cell.id;
        const userFriendlyName = getCellAttr(cell, 'name') || technicalName;
        const basePMw = parseFloat(getCellAttr(cell, 'p_mw')) || (elementType === 'load' ? 15 : 20);

        elements.push({
            key: technicalName,
            label: userFriendlyName,
            elementType,
            basePMw
        });
    }
    return elements;
}

class TimeSeriesSimulationDialog {
    constructor(graph) {
        this.graph = graph;
        this.title = 'Time Series Simulation';
        this.profileElements = collectProfileElements(graph);
    }

    show(callback) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
            padding: max(12px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px))
                     max(12px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
            box-sizing: border-box; overflow-y: auto;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white; border-radius: 8px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
            width: min(780px, 96vw); max-width: 96vw; height: calc(100vh - 48px);
            max-height: calc(100vh - 48px); overflow: hidden; display: flex; flex-direction: column;
            flex-shrink: 0; margin: auto; font-family: Arial, sans-serif; box-sizing: border-box;
        `;

        const title = document.createElement('h2');
        title.textContent = this.title;
        title.style.cssText = 'margin: 0; padding: 18px 24px 8px; color: #333; font-size: 18px; font-weight: 600; flex-shrink: 0;';
        dialog.appendChild(title);

        const blurb = document.createElement('div');
        blurb.style.cssText = `
            margin: 0 24px 12px; padding: 10px 14px; background: #e8f4fc; border: 1px solid #b8dae9;
            border-radius: 6px; font-size: 12px; line-height: 1.5; color: #0d47a1; flex-shrink: 0;
        `;
        blurb.innerHTML = `
            Run an AC load flow for each hour with time-varying load and generation — similar to the
            <a href="https://pandapower.readthedocs.io/en/latest/timeseries.html" target="_blank" rel="noopener noreferrer">pandapower time series tutorial</a>.
            Define a profile for each load and generator below. Use <strong>Absolute P (MW)</strong> for notebook-style values,
            or <strong>Scale factor</strong> to multiply the element&rsquo;s base P from the diagram.
            <a href="https://electrisim.com/documentation.html#time-series-simulation" target="_blank" rel="noopener noreferrer">Documentation</a>
        `;
        dialog.appendChild(blurb);

        const formScroll = document.createElement('div');
        formScroll.style.cssText = `
            flex: 1 1 0%; min-height: 0; overflow-y: auto; overflow-x: hidden;
            padding: 4px 24px 12px; scrollbar-width: thin; scrollbar-color: #c5ccd3 #f1f3f5;
        `;

        const form = document.createElement('form');
        form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

        // Duration
        const tsSection = document.createElement('div');
        tsSection.innerHTML = '<h3 style="margin: 0 0 12px 0; color: #007cba; font-size: 15px;">Simulation horizon</h3>';
        const timeStepsEl = this.createNumberInput('time_steps', 'Duration (hours / time steps)', '24', '1', '8760',
            'Each time step runs one AC power flow (1 hour by default).');
        tsSection.appendChild(timeStepsEl);
        const timeStepsInput = timeStepsEl.querySelector('#time_steps');
        form.appendChild(tsSection);

        // Load & generation profiles
        const profileSection = document.createElement('div');
        profileSection.innerHTML = `<h3 style="margin: 0 0 8px 0; color: #007cba; font-size: 15px;">Load &amp; generation profiles</h3>
            <p style="margin:0 0 10px;font-size:12px;color:#555;line-height:1.45;">
                One profile per element. Values are comma- or space-separated — one value per time step.
                Tip: run a single <strong>Load Flow</strong> first to verify the network converges at the base case.
            </p>`;

        this.profileEditors = [];
        this._timeStepsInput = timeStepsInput;

        const quickFill = document.createElement('div');
        quickFill.style.cssText = 'background:#f0f4f8;border:1px solid #d0d7de;border-radius:6px;padding:10px 12px;margin-bottom:12px;';
        quickFill.innerHTML = '<div style="font-size:12px;font-weight:600;color:#333;margin-bottom:8px;">Quick fill (optional)</div>';

        const quickRow = document.createElement('div');
        quickRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;';

        const loadPresetWrap = this.createSelect('quick_load_preset', 'Load shape', [
            { value: 'constant', label: 'Constant' },
            { value: 'daily', label: 'Daily (residential)' },
            { value: 'industrial', label: 'Industrial' },
            { value: 'variable', label: 'Variable' }
        ], 'Scale factors applied to each load\'s base P.');
        loadPresetWrap.style.flex = '1 1 140px';
        quickRow.appendChild(loadPresetWrap);

        const genPresetWrap = this.createSelect('quick_gen_preset', 'Generation shape', [
            { value: 'constant', label: 'Constant' },
            { value: 'solar', label: 'Solar' },
            { value: 'wind', label: 'Wind' },
            { value: 'variable', label: 'Variable' }
        ], 'Scale factors applied to each generator\'s base P.');
        genPresetWrap.style.flex = '1 1 140px';
        quickRow.appendChild(genPresetWrap);

        this._loadPresetSelect = loadPresetWrap.querySelector('#quick_load_preset');
        this._genPresetSelect = genPresetWrap.querySelector('#quick_gen_preset');

        const mkQuickBtn = (label, title, handler) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.title = title;
            b.style.cssText = 'padding:7px 12px;font-size:12px;border:1px solid #007cba;background:#fff;color:#007cba;border-radius:4px;cursor:pointer;white-space:nowrap;';
            b.addEventListener('click', handler);
            return b;
        };

        quickRow.appendChild(mkQuickBtn('Apply load preset → all loads', 'Fill every load with scale factors from the load shape', () => {
            this.applyPresetToEditors('load', this._loadPresetSelect.value);
        }));
        quickRow.appendChild(mkQuickBtn('Apply gen preset → all generators', 'Fill every generator/sgen with scale factors from the generation shape', () => {
            this.applyPresetToEditors('gen', this._genPresetSelect.value);
        }));
        quickRow.appendChild(mkQuickBtn('Random MW (tutorial) → all', 'Notebook-style random absolute MW for every element', () => {
            this.applyRandomToAll();
        }));

        quickFill.appendChild(quickRow);
        profileSection.appendChild(quickFill);

        const customSection = document.createElement('div');
        customSection.id = 'ts_custom_section';
        if (this.profileElements.length === 0) {
            customSection.innerHTML = `
                <div style="color:#856404;background:#fff3cd;padding:12px;border-radius:6px;font-size:13px;line-height:1.45;border:1px solid #ffeeba;">
                    <strong>No profiled elements found.</strong> Add at least one <em>Load</em> or
                    <em>Generator / Static Generator</em> to the diagram to run a time series simulation.
                </div>`;
        } else {
            const countLoads = this.profileElements.filter(e => e.elementType === 'load').length;
            const countGens = this.profileElements.length - countLoads;
            const summary = document.createElement('p');
            summary.style.cssText = 'margin:0 0 10px;font-size:12px;color:#666;';
            summary.textContent = `${this.profileElements.length} element(s): ${countLoads} load(s), ${countGens} generator(s).`;
            customSection.appendChild(summary);
            this.profileElements.forEach(el => {
                customSection.appendChild(this.createElementProfileEditor(el));
            });
        }
        profileSection.appendChild(customSection);
        form.appendChild(profileSection);

        const exportRow = document.createElement('div');
        exportRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
        const exportCheckbox = document.createElement('input');
        exportCheckbox.type = 'checkbox';
        exportCheckbox.id = 'export_to_xlsx';
        exportCheckbox.checked = true;
        const exportLabel = document.createElement('label');
        exportLabel.htmlFor = 'export_to_xlsx';
        exportLabel.textContent = 'Download Excel report automatically when results open';
        exportLabel.style.cssText = 'font-size:13px;color:#333;cursor:pointer;';
        exportRow.appendChild(exportCheckbox);
        exportRow.appendChild(exportLabel);
        form.appendChild(exportRow);

        // Advanced power flow (collapsed)
        const pfDetails = document.createElement('details');
        pfDetails.style.cssText = 'border:1px solid #e9ecef;border-radius:6px;padding:0 12px 8px;background:#fafbfc;';
        const pfSummary = document.createElement('summary');
        pfSummary.textContent = 'Advanced power flow settings';
        pfSummary.style.cssText = 'cursor:pointer;padding:10px 0;font-weight:600;color:#555;font-size:13px;';
        pfDetails.appendChild(pfSummary);
        const pfInner = document.createElement('div');
        pfInner.style.cssText = 'padding-bottom:4px;';
        pfInner.appendChild(this.createNumberInput('frequency', 'Frequency (Hz)', '50', '0.1', '1000'));
        pfInner.appendChild(this.createSelect('algorithm', 'Algorithm', [
            { value: 'nr', label: 'Newton-Raphson (NR)' },
            { value: 'iwamoto_nr', label: 'Iwamoto Newton-Raphson' },
            { value: 'fastdecoupled', label: 'Fast Decoupled' },
            { value: 'dc', label: 'DC Power Flow' }
        ]));
        pfInner.appendChild(this.createSelect('calculate_voltage_angles', 'Calculate voltage angles', [
            { value: 'auto', label: 'Auto' },
            { value: true, label: 'Yes' },
            { value: false, label: 'No' }
        ]));
        pfInner.appendChild(this.createSelect('init', 'Initialization', [
            { value: 'auto', label: 'Auto (recommended)' },
            { value: 'dc', label: 'DC' },
            { value: 'flat', label: 'Flat' },
            { value: 'pf', label: 'Power Flow' }
        ], 'Use Auto unless you have convergence issues — it warm-starts from the previous time step.'));
        pfDetails.appendChild(pfInner);
        form.appendChild(pfDetails);

        formScroll.appendChild(form);
        dialog.appendChild(formScroll);

        timeStepsInput.addEventListener('change', () => this.syncAllProfileHints(timeStepsInput.value));

        const getField = (id) => form.querySelector(`#${id}`);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex; gap: 12px; justify-content: flex-end; flex-shrink: 0;
            padding: 14px 24px 18px; border-top: 1px solid #e9ecef; background: #fafbfc;
        `;
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.type = 'button';
        cancelButton.style.cssText = 'padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;';
        cancelButton.onclick = () => document.body.removeChild(overlay);

        const submitButton = document.createElement('button');
        submitButton.textContent = 'Run Simulation';
        submitButton.type = 'button';
        submitButton.style.cssText = 'padding: 8px 20px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;';
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(submitButton);
        dialog.appendChild(buttonContainer);

        const runSimulation = async () => {
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    document.body.removeChild(overlay);
                    if (window.showSubscriptionModal) window.showSubscriptionModal();
                    else alert('A subscription is required to use the Time Series Simulation feature.');
                    return;
                }

                if (this.profileElements.length === 0) {
                    alert('Add at least one Load or Generator/Static Generator to the diagram.');
                    return;
                }

                const timeSteps = Math.max(1, Math.min(8760, parseInt(getField('time_steps').value, 10) || 24));
                const params = {
                    time_steps: timeSteps,
                    profile_mode: 'custom',
                    load_profile: getField('quick_load_preset')?.value || 'constant',
                    generation_profile: getField('quick_gen_preset')?.value || 'constant',
                    frequency: getField('frequency').value,
                    algorithm: getField('algorithm').value,
                    calculate_voltage_angles: getField('calculate_voltage_angles').value,
                    init: getField('init').value,
                    export_to_xlsx: exportCheckbox.checked,
                    element_profiles: {}
                };

                for (const editor of this.profileEditors) {
                    const values = parseProfileValues(editor.textarea.value);
                    if (values.length === 0) {
                        alert(`Please enter profile values for "${editor.label}".`);
                        return;
                    }
                    let mode = editor.modeSelect.value;
                    const maxVal = Math.max(...values.map(v => Math.abs(Number(v))));
                    const baseP = editor.basePMw || 1;
                    const looksLikeAbsolute = maxVal > 3 || (maxVal >= baseP * 0.2 && maxVal <= baseP * 1.05);
                    if (mode === 'scale' && looksLikeAbsolute) {
                        alert(
                            `"${editor.label}" is set to Scale factor but the values look like MW (max ${maxVal.toFixed(2)}, base P ${baseP} MW).\n\n` +
                            'Switch to Absolute P (MW), or enter scale factors typically between 0 and 2.'
                        );
                        return;
                    }
                    params.element_profiles[editor.key] = {
                        element_type: editor.elementType,
                        mode,
                        values: normalizeProfileLength(values, timeSteps),
                        display_name: editor.label
                    };
                }

                document.body.removeChild(overlay);
                if (callback) callback(params);
            } catch (error) {
                console.error('TimeSeriesSimulationDialog: Error:', error);
                if (error.message?.includes('Token expired')) {
                    alert('Your session has expired. Please log in again.');
                } else {
                    alert('Unable to verify subscription status. Please try again.');
                }
            }
        };

        submitButton.addEventListener('click', runSimulation);
        form.addEventListener('submit', (e) => { e.preventDefault(); runSimulation(); });

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        attachBackdropCloseHandler(overlay, dialog, () => document.body.removeChild(overlay));

        this.syncAllProfileHints(timeStepsInput.value);
    }

    applyPresetToEditors(kind, preset) {
        const n = parseInt(this._timeStepsInput?.value, 10) || 24;
        for (const editor of this.profileEditors) {
            const isLoad = editor.elementType === 'load';
            const isGen = editor.elementType === 'gen' || editor.elementType === 'sgen';
            if (kind === 'load' && !isLoad) continue;
            if (kind === 'gen' && !isGen) continue;
            editor.modeSelect.value = 'scale';
            const values = isLoad
                ? buildLoadPresetProfile(preset, n)
                : buildGenerationPresetProfile(preset, n);
            editor.textarea.value = formatProfileValues(values);
        }
    }

    applyRandomToAll() {
        const n = parseInt(this._timeStepsInput?.value, 10) || 24;
        for (const editor of this.profileEditors) {
            editor.modeSelect.value = 'absolute';
            editor.textarea.value = formatProfileValues(buildRandomAbsoluteProfile(n, editor.basePMw));
        }
    }

    createElementProfileEditor(el) {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #dee2e6;border-radius:6px;padding:12px;margin-bottom:10px;background:#fff;';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;';
        const titleWrap = document.createElement('div');
        const badge = el.elementType === 'load' ? 'Load' : 'Generation';
        const badgeColor = el.elementType === 'load' ? '#1565c0' : '#2e7d32';
        titleWrap.innerHTML = `<strong style="font-size:14px;">${el.label}</strong>
            <span style="margin-left:6px;font-size:11px;padding:2px 6px;border-radius:3px;background:${badgeColor}18;color:${badgeColor};">${badge}</span>`;
        header.appendChild(titleWrap);

        const modeSelect = document.createElement('select');
        modeSelect.style.cssText = 'padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;';
        [{ value: 'absolute', label: 'Absolute P (MW)' }, { value: 'scale', label: 'Scale factor (× base P)' }].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            modeSelect.appendChild(o);
        });
        modeSelect.value = 'absolute';
        header.appendChild(modeSelect);
        card.appendChild(header);

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:#666;margin-bottom:6px;';
        const initialSteps = parseInt(this._timeStepsInput?.value, 10) || 24;
        hint.textContent = `Base P from diagram: ${el.basePMw} MW — enter ${initialSteps} values`;
        card.appendChild(hint);

        const textarea = document.createElement('textarea');
        textarea.rows = 3;
        textarea.placeholder = 'e.g. 10, 12, 8, 15, … (one value per hour)';
        textarea.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccc;border-radius:4px;font-family:Consolas,monospace;font-size:12px;resize:vertical;';
        const initial = buildRandomAbsoluteProfile(initialSteps, el.basePMw);
        textarea.value = formatProfileValues(initial);
        card.appendChild(textarea);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;';
        const mkBtn = (label, handler) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.style.cssText = 'padding:4px 10px;font-size:11px;border:1px solid #ccc;background:#f8f9fa;border-radius:4px;cursor:pointer;';
            b.addEventListener('click', handler);
            return b;
        };
        btnRow.appendChild(mkBtn('Random (tutorial)', () => {
            const n = parseInt(this._timeStepsInput?.value, 10) || 24;
            modeSelect.value = 'absolute';
            textarea.value = formatProfileValues(buildRandomAbsoluteProfile(n, el.basePMw));
        }));
        btnRow.appendChild(mkBtn('Fill preset (scale)', () => {
            const n = parseInt(this._timeStepsInput?.value, 10) || 24;
            const preset = el.elementType === 'load'
                ? (this._loadPresetSelect?.value || 'constant')
                : (this._genPresetSelect?.value || 'constant');
            modeSelect.value = 'scale';
            const values = el.elementType === 'load'
                ? buildLoadPresetProfile(preset, n)
                : buildGenerationPresetProfile(preset, n);
            textarea.value = formatProfileValues(values);
        }));
        btnRow.appendChild(mkBtn('Import file', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.txt';
            input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    textarea.value = String(reader.result).trim();
                };
                reader.readAsText(file);
            };
            input.click();
        }));
        card.appendChild(btnRow);

        const editor = { key: el.key, label: el.label, elementType: el.elementType, basePMw: el.basePMw, textarea, modeSelect, hint };
        this.profileEditors.push(editor);
        return card;
    }

    syncAllProfileHints(timeSteps) {
        const n = parseInt(timeSteps, 10) || 24;
        for (const editor of this.profileEditors || []) {
            editor.hint.textContent = `Base P from diagram: ${editor.basePMw} MW — enter ${n} values`;
        }
    }

    async checkSubscriptionStatus() {
        if (window.ensureSubscriptionFunctions) await window.ensureSubscriptionFunctions();
        if (window.checkSubscriptionStatus) return window.checkSubscriptionStatus();
        if (window.SubscriptionManager?.checkSubscriptionStatus) return window.SubscriptionManager.checkSubscriptionStatus();
        return false;
    }

    createNumberInput(id, label, defaultValue, step, max, hintText) {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;';
        const labelElement = document.createElement('label');
        labelElement.htmlFor = id;
        labelElement.textContent = label;
        labelElement.style.cssText = 'font-weight: bold; color: #333; font-size: 13px;';
        const input = document.createElement('input');
        input.type = 'number';
        input.id = id;
        input.value = defaultValue;
        input.step = step;
        input.max = max;
        input.min = '1';
        input.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
        container.appendChild(labelElement);
        container.appendChild(input);
        if (hintText) {
            const hint = document.createElement('span');
            hint.style.cssText = 'font-size:11px;color:#666;';
            hint.textContent = hintText;
            container.appendChild(hint);
        }
        return container;
    }

    createSelect(id, label, options, hintText) {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;';
        const labelElement = document.createElement('label');
        labelElement.htmlFor = id;
        labelElement.textContent = label;
        labelElement.style.cssText = 'font-weight: bold; color: #333; font-size: 13px;';
        const select = document.createElement('select');
        select.id = id;
        select.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });
        container.appendChild(labelElement);
        container.appendChild(select);
        if (hintText) {
            const hint = document.createElement('span');
            hint.style.cssText = 'font-size:11px;color:#666;';
            hint.textContent = hintText;
            container.appendChild(hint);
        }
        return container;
    }
}

globalThis.TimeSeriesSimulationDialog = TimeSeriesSimulationDialog;
export { TimeSeriesSimulationDialog };
