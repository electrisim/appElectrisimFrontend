// BessPreliminaryDesignDialog.js - BESS preliminary design wizard
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';
import {
    SIMULATION_FORM_SCROLL_STYLE,
    SIMULATION_INFO_BANNER_STYLE,
    preventAccidentalFormSubmit,
} from '../utils/dialogStyles.js';
import { createDialogBracketGroup } from '../utils/dialogBracketGroup.js';
import { buildOrUpdateBessPlant, computeSuggestedRatings } from '../bessPlantBuilder.js';

export class BessPreliminaryDesignDialog extends Dialog {
    constructor(editorUi) {
        super('BESS Preliminary Design', 'Run Study');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 800;
    }

    getDescription() {
        return '<strong>BESS Preliminary Design</strong><br>Enter project parameters, generate the plant SLD, then run load-flow cases, rating checks, and a P/Q capability envelope at the POC.';
    }

    _field(id, label, value, type = 'number', step = 'any') {
        return { id, label, type, value: type === 'checkbox' ? !!value : String(value ?? ''), step };
    }

    _section(title) {
        return { type: 'section', title };
    }

    buildFieldList() {
        return [
            this._section('POC / Grid'),
            this._field('pocP_MW', 'Active power at POC (MW)', 50),
            this._field('pocQ_Mvar', 'Reactive power at POC (Mvar)', 10),
            this._field('hvVoltage_kV', 'POC / HV voltage (kV)', 132),
            this._field('frequency', 'Frequency (Hz)', 50),
            this._field('umin_pu', 'Minimum POC voltage (pu)', 0.95),
            this._field('umax_pu', 'Maximum POC voltage (pu)', 1.05),
            this._field('unom_pu', 'Nominal grid voltage (pu)', 1.0),
            this._field('powerFactor', 'Power factor (optional check)', 0.98),
            this._section('PCS / BESS'),
            this._field('numUnits', 'Number of PCS / Storage units', 4, 'number', '1'),
            this._field('storageSnMva', 'PCS rating per unit (MVA)', 15),
            this._field('pMaxDischarge_MW', 'Max discharge per unit (MW)', 12),
            this._field('pMaxCharge_MW', 'Max charge per unit (MW)', 12),
            this._field('lvVoltage_kV', 'LV / PCS voltage (kV)', 0.69),
            this._field('useQCurve', 'Use PCS P–Q capability curve', false, 'checkbox'),
            this._section('HV/MV transformer (OLTC)'),
            this._field('mvVoltage_kV', 'MV collection voltage (kV)', 33),
            this._field('hvTrafoSnMva', 'POC transformer rating (MVA)', 60),
            this._field('hvVkPercent', 'Short-circuit voltage vk (%)', 12),
            this._field('tapMin', 'Tap min', -5, 'number', '1'),
            this._field('tapMax', 'Tap max', 5, 'number', '1'),
            this._field('tapStepPercent', 'Tap step (%)', 1.25),
            this._field('oltcVmLower', 'OLTC band lower (pu)', 0.99),
            this._field('oltcVmUpper', 'OLTC band upper (pu)', 1.01),
            this._section('MV cables'),
            this._field('cableLength_km', 'Cable length per string (km)', 0.3),
            this._field('cableR_ohmPerKm', 'R (ohm/km)', 0.08),
            this._field('cableX_ohmPerKm', 'X (ohm/km)', 0.12),
            this._field('cableMaxIKa', 'Thermal rating (kA)', 0.5),
            this._section('MV/LV transformers'),
            this._field('stringTrafoSnMva', 'String transformer rating (MVA)', 15),
            this._field('stringVkPercent', 'String vk (%)', 8),
            this._section('Auxiliary load'),
            this._field('auxP_MW', 'Auxiliary P (MW)', 0.5),
            this._field('auxQ_Mvar', 'Auxiliary Q (Mvar)', 0.1),
        ];
    }

    getFormValues() {
        const values = {};
        this.inputs.forEach((input, id) => {
            if (input.type === 'checkbox') {
                values[id] = input.checked;
            } else {
                values[id] = input.value;
            }
        });
        return values;
    }

    parseNumericValues(raw) {
        const num = (k, def = 0) => {
            const v = parseFloat(raw[k]);
            return Number.isFinite(v) ? v : def;
        };
        const int = (k, def = 1) => {
            const v = parseInt(raw[k], 10);
            return Number.isFinite(v) ? v : def;
        };
        return {
            pocP_MW: num('pocP_MW', 50),
            pocQ_Mvar: num('pocQ_Mvar', 0),
            powerFactor: num('powerFactor', 0.98),
            hvVoltage_kV: num('hvVoltage_kV', 132),
            mvVoltage_kV: num('mvVoltage_kV', 33),
            lvVoltage_kV: num('lvVoltage_kV', 0.69),
            unom_pu: num('unom_pu', 1),
            umin_pu: num('umin_pu', 0.95),
            umax_pu: num('umax_pu', 1.05),
            frequency: num('frequency', 50),
            numUnits: int('numUnits', 4),
            storageSnMva: num('storageSnMva', 15),
            pMaxDischarge_MW: num('pMaxDischarge_MW', 12),
            pMaxCharge_MW: num('pMaxCharge_MW', 12),
            hvTrafoSnMva: num('hvTrafoSnMva', 60),
            hvVkPercent: num('hvVkPercent', 12),
            tapMin: int('tapMin', -5),
            tapMax: int('tapMax', 5),
            tapStepPercent: num('tapStepPercent', 1.25),
            oltcVmLower: num('oltcVmLower', 0.99),
            oltcVmUpper: num('oltcVmUpper', 1.01),
            cableLength_km: num('cableLength_km', 0.3),
            cableR_ohmPerKm: num('cableR_ohmPerKm', 0.08),
            cableX_ohmPerKm: num('cableX_ohmPerKm', 0.12),
            cableMaxIKa: num('cableMaxIKa', 0.5),
            stringTrafoSnMva: num('stringTrafoSnMva', 15),
            stringVkPercent: num('stringVkPercent', 8),
            auxP_MW: num('auxP_MW', 0.5),
            auxQ_Mvar: num('auxQ_Mvar', 0.1),
            useQCurve: raw.useQCurve === true || raw.useQCurve === 'true',
            oltcEnabled: true,
            pocBusName: 'POC_HV',
            extGridName: 'Grid',
            hvTrafoName: 'POC_Transformer',
        };
    }

    async checkSubscriptionStatus() {
        try {
            if (typeof ensureSubscriptionFunctions === 'function') {
                await ensureSubscriptionFunctions();
            }
            if (typeof window.checkSubscriptionStatus === 'function') {
                return await window.checkSubscriptionStatus();
            }
            return false;
        } catch (e) {
            throw e;
        }
    }

    show(callback) {
        this.displayDialog(callback);
    }

    _styleNumberInput(input) {
        Object.assign(input.style, {
            width: '100%',
            boxSizing: 'border-box',
            padding: '7px 10px',
            border: '1px solid #ced4da',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#212529',
            background: '#fff',
        });
        input.addEventListener('focus', () => { input.style.borderColor = '#80bdff'; input.style.outline = 'none'; });
        input.addEventListener('blur', () => { input.style.borderColor = '#ced4da'; });
    }

    _createFieldControl(field) {
        if (field.type === 'checkbox') {
            const group = document.createElement('div');
            group.style.cssText = 'display:flex;align-items:flex-start;gap:8px;grid-column:1 / -1;padding-top:4px;';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = field.id;
            input.checked = field.value === true || field.value === 'true';
            input.style.cssText = 'width:16px;height:16px;margin-top:2px;accent-color:#2563eb;flex-shrink:0;';
            const col = document.createElement('div');
            const label = document.createElement('label');
            label.htmlFor = field.id;
            label.textContent = field.label;
            Object.assign(label.style, {
                fontWeight: '600',
                fontSize: '13px',
                color: '#343a40',
                cursor: 'pointer',
                textDecoration: 'none',
            });
            col.appendChild(label);
            if (field.id === 'useQCurve') {
                const hint = document.createElement('div');
                hint.textContent = 'When checked, each Storage uses its P–Q capability curve instead of a circular MVA rating.';
                hint.style.cssText = 'margin-top:2px;font-size:12px;color:#6c757d;line-height:1.4;';
                col.appendChild(hint);
            }
            this.inputs.set(field.id, input);
            group.appendChild(input);
            group.appendChild(col);
            return group;
        }

        const group = document.createElement('div');
        Object.assign(group.style, { minWidth: '0', display: 'flex', flexDirection: 'column', gap: '4px' });
        const label = document.createElement('label');
        label.htmlFor = field.id;
        label.textContent = field.label;
        Object.assign(label.style, {
            display: 'block',
            fontWeight: '600',
            fontSize: '12px',
            color: '#495057',
            textDecoration: 'none',
        });
        const input = document.createElement('input');
        input.type = field.type || 'number';
        input.id = field.id;
        input.value = field.value ?? '';
        if (field.step) input.step = field.step;
        this._styleNumberInput(input);
        this.inputs.set(field.id, input);
        group.appendChild(label);
        group.appendChild(input);
        return group;
    }

    displayDialog(callback) {
        this.callback = callback;
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        this.inputs = new Map();

        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#333',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: '0',
            overflow: 'hidden',
        });

        const desc = document.createElement('div');
        Object.assign(desc.style, SIMULATION_INFO_BANNER_STYLE);
        desc.innerHTML = this.getDescription();
        container.appendChild(desc);

        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, { ...SIMULATION_FORM_SCROLL_STYLE, overflowX: 'hidden' });

        const form = document.createElement('form');
        preventAccidentalFormSubmit(form);
        Object.assign(form.style, { display: 'flex', flexDirection: 'column', gap: '12px' });

        let sectionBox = null;
        let sectionGrid = null;
        const startSection = (title) => {
            sectionBox = createDialogBracketGroup(title);
            sectionGrid = document.createElement('div');
            Object.assign(sectionGrid.style, {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: '10px 16px',
            });
            sectionBox.appendChild(sectionGrid);
            form.appendChild(sectionBox);
        };

        this.buildFieldList().forEach((field) => {
            if (field.type === 'section') {
                startSection(field.title);
                return;
            }
            const control = this._createFieldControl(field);
            (sectionGrid || form).appendChild(control);
        });

        const suggestBox = document.createElement('div');
        suggestBox.id = 'bess-prelim-suggest';
        Object.assign(suggestBox.style, {
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '6px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#0c4a6e',
            lineHeight: '1.5',
        });
        const suggestText = document.createElement('div');
        suggestBox.appendChild(suggestText);

        const updateSuggest = () => {
            const s = computeSuggestedRatings(this.parseNumericValues(this.getFormValues()));
            suggestText.innerHTML =
                `<strong>Suggested ratings</strong> from the POC power and unit count<br>` +
                `POC transformer ${s.hvTrafoSnMva} MVA · String trafo ${s.stringTrafoSnMva} MVA · ` +
                `PCS ${s.storageSnMva} MVA · Pmax ${s.storagePMaxMw} MW · Cable ${s.cableMaxIKa} kA`;
        };
        form.addEventListener('input', updateSuggest);
        updateSuggest();

        const applySuggest = document.createElement('button');
        applySuggest.type = 'button';
        applySuggest.textContent = 'Apply suggested ratings';
        Object.assign(applySuggest.style, {
            marginTop: '10px',
            padding: '6px 12px',
            border: '1px solid #38bdf8',
            background: '#fff',
            color: '#0369a1',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
        });
        applySuggest.onclick = (e) => {
            e.preventDefault();
            const s = computeSuggestedRatings(this.parseNumericValues(this.getFormValues()));
            const set = (id, v) => { const inp = this.inputs.get(id); if (inp) inp.value = String(v); };
            set('hvTrafoSnMva', s.hvTrafoSnMva);
            set('stringTrafoSnMva', s.stringTrafoSnMva);
            set('storageSnMva', s.storageSnMva);
            set('pMaxDischarge_MW', s.storagePMaxMw);
            set('pMaxCharge_MW', s.storagePMaxMw);
            set('cableMaxIKa', s.cableMaxIKa);
            updateSuggest();
        };
        suggestBox.appendChild(applySuggest);
        form.appendChild(suggestBox);

        contentArea.appendChild(form);
        container.appendChild(contentArea);

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            paddingTop: '12px',
            borderTop: '1px solid #e9ecef',
            flexShrink: '0',
        });

        const cancelBtn = this.createButton('Cancel', '#6c757d', '#5a6268');
        const genBtn = this.createButton('Generate / Update SLD', '#10b981', '#059669');
        const runBtn = this.createButton('Run Study', '#007bff', '#0056b3');

        cancelBtn.onclick = (e) => { e.preventDefault(); this.closeDialog(); };

        genBtn.onclick = (e) => {
            e.preventDefault();
            try {
                const params = this.parseNumericValues(this.getFormValues());
                const result = buildOrUpdateBessPlant(this.graph, params);
                alert(result.created ? 'BESS plant SLD created.' : 'BESS plant SLD updated.');
            } catch (err) {
                alert('Failed to generate SLD: ' + (err?.message || err));
            }
        };

        runBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (runBtn.disabled) return;
            const originalLabel = runBtn.textContent;
            runBtn.disabled = true;
            runBtn.textContent = 'Starting…';
            try {
                const hasSub = await this.checkSubscriptionStatus();
                if (!hasSub) {
                    this.closeDialog();
                    if (typeof window.showSubscriptionModal === 'function') {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to run BESS Preliminary Design.');
                    }
                    return;
                }
                // destroy() clears this.callback, so capture it before closing.
                const onRun = this.callback;
                const params = this.parseNumericValues(this.getFormValues());
                buildOrUpdateBessPlant(this.graph, params);
                const values = { ...this.getFormValues(), ...params, action: 'run' };
                this.closeDialog();
                if (typeof onRun === 'function') {
                    onRun(values);
                } else {
                    alert('Study could not start. Close this window and open BESS Preliminary Design again.');
                }
            } catch (err) {
                alert('Error: ' + (err?.message || err));
            } finally {
                if (runBtn.isConnected) {
                    runBtn.disabled = false;
                    runBtn.textContent = originalLabel;
                }
            }
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(genBtn);
        btnRow.appendChild(runBtn);
        container.appendChild(btnRow);

        this.container = container;
        if (typeof this.mountStudyModalShell === 'function') {
            this.mountStudyModalShell(this.studyModalBoxWidth);
        } else {
            this.showModalFallback(container);
        }
    }
}
