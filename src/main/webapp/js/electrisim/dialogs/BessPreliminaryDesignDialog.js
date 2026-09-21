// BessPreliminaryDesignDialog.js - BESS preliminary design wizard
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';
import {
    SIMULATION_FORM_SCROLL_STYLE,
    SIMULATION_INFO_BANNER_STYLE,
    preventAccidentalFormSubmit,
} from '../utils/dialogStyles.js';
import { createDialogBracketGroup } from '../utils/dialogBracketGroup.js';
import { buildOrUpdateBessPlant, computeSuggestedRatings, findBessPlantElements } from '../bessPlantBuilder.js';

const WIZARD_STORE_KEY = 'electrisim.bessPreliminaryDesign.v1';
const WIZARD_GRAPH_ATTR = 'bessPrelimWizard';

function qFromPPf(p, pf) {
    const pAbs = Math.abs(Number(p) || 0);
    const c = Math.min(0.999999, Math.max(0.1, Math.abs(Number(pf) || 0.95)));
    return pAbs * Math.tan(Math.acos(c));
}

/** Equipment ratings auto-sized from the POC inputs until the user edits them. */
const RATING_FIELDS = [
    'storageSnMva', 'pMaxDischarge_MW', 'pMaxCharge_MW', 'batteryPmax_MW',
    'hvTrafoSnMva', 'hvVkPercent', 'stringTrafoSnMva', 'stringVkPercent', 'cableMaxIKa',
];

/** Editing one of these re-sizes the rating fields the user has not typed into. */
const RATING_DRIVERS = new Set([
    'pocP_MW', 'powerFactor', 'pocQ_Mvar', 'specifyQDirectly', 'numUnits',
    'stringTopology', 'pcsPerWinding', 'umin_pu', 'auxP_MW', 'mvVoltage_kV',
]);

const DRAFT_EDITED_KEY = '_userEditedRatings';

/** Ratings where a value below the auto-sized one limits what the plant can deliver. */
const CAPACITY_FIELDS = [
    ['storageSnMva', 'PCS rating per unit', 'MVA'],
    ['pMaxDischarge_MW', 'Max discharge per unit', 'MW'],
    ['pMaxCharge_MW', 'Max charge per unit', 'MW'],
    ['batteryPmax_MW', 'Battery DC Pmax per rack', 'MW'],
    ['hvTrafoSnMva', 'POC transformer', 'MVA'],
    ['stringTrafoSnMva', 'String transformer', 'MVA'],
    ['cableMaxIKa', 'Cable thermal rating', 'kA'],
];

/** computeSuggestedRatings covers MVA/MW/kA; vk is a fixed low-impedance default. */
function suggestedRatingValues(suggested) {
    return {
        storageSnMva: suggested.storageSnMva,
        pMaxDischarge_MW: suggested.storagePMaxMw,
        pMaxCharge_MW: suggested.storagePMaxMw,
        batteryPmax_MW: suggested.storagePMaxMw,
        hvTrafoSnMva: suggested.hvTrafoSnMva,
        hvVkPercent: 8,
        stringTrafoSnMva: suggested.stringTrafoSnMva,
        stringVkPercent: 6,
        cableMaxIKa: suggested.cableMaxIKa,
    };
}

function loadWizardDraft(graph) {
    try {
        const cells = graph?.getModel?.().getDescendants?.() || [];
        const tagged = cells.find((c) => c?.value?.getAttribute?.(WIZARD_GRAPH_ATTR));
        const raw = tagged?.value?.getAttribute?.(WIZARD_GRAPH_ATTR);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    try {
        const raw = localStorage.getItem(WIZARD_STORE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
}

function saveWizardDraft(graph, values) {
    const payload = JSON.stringify(values);
    try { localStorage.setItem(WIZARD_STORE_KEY, payload); } catch { /* ignore */ }
    try {
        const cells = graph?.getModel?.().getDescendants?.() || [];
        const poc = cells.find((c) => c?.value?.getAttribute?.('bessPlantRole') === 'poc');
        if (poc?.value?.setAttribute) {
            graph.getModel().beginUpdate();
            try { poc.value.setAttribute(WIZARD_GRAPH_ATTR, payload); }
            finally { graph.getModel().endUpdate(); }
        }
    } catch { /* ignore */ }
}

function inferTopologyFromGraph(graph) {
    try {
        const plant = findBessPlantElements(graph);
        if (plant?.lvTrafo3ws?.length && !plant?.lvTrafos?.length) return 'three_winding';
        if (plant?.lvTrafos?.length && !plant?.lvTrafo3ws?.length) return 'two_winding';
        if (plant?.lvTrafo3ws?.length) return 'three_winding';
    } catch { /* ignore */ }
    return null;
}

export class BessPreliminaryDesignDialog extends Dialog {
    constructor(editorUi) {
        super('BESS Preliminary Design', 'Run Study');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 800;
        this.studyModalParkable = true;
    }

    getDescription() {
        return '<strong>BESS Preliminary Design</strong><br>' +
            'Set the agreed POC active power and the grid-code power factor (typically 0.95). ' +
            'Q at the POC is computed from P and PF. Generate the plant SLD, then run load-flow corner cases and a P/Q envelope against that requirement.';
    }

    _field(id, label, value, type = 'number', step = 'any', extra = {}) {
        return {
            id, label, type,
            value: type === 'checkbox' ? !!value : String(value ?? ''),
            step,
            ...extra,
        };
    }

    _section(title) {
        return { type: 'section', title };
    }

    _savedVal(saved, id, fallback) {
        if (saved && saved[id] != null && saved[id] !== '') return saved[id];
        return fallback;
    }

    _markEdited(id) {
        if (!this._editedRatings) this._editedRatings = new Set();
        if (RATING_FIELDS.includes(id)) this._editedRatings.add(id);
    }

    _isEdited(id) {
        return !!this._editedRatings?.has(id);
    }

    /** Re-size only the rating fields the user has not typed into. */
    _writeSuggestedRatings(suggested) {
        const values = suggestedRatingValues(suggested);
        RATING_FIELDS.forEach((id) => {
            if (this._isEdited(id)) return;
            const inp = this.inputs.get(id);
            if (inp) inp.value = String(values[id]);
        });
    }

    /** Drop every typed rating and put the auto-sized set back in the fields. */
    _resetRatingsToAuto() {
        this._editedRatings = new Set();
        this._writeSuggestedRatings(computeSuggestedRatings(this.parseNumericValues(this.getFormValues())));
    }

    /**
     * Auto-sizing carries margin for losses and Umin, so a rating a little under
     * the suggested value usually still complies. Report how far under each one
     * is, and flag a PCS whose MVA cannot carry its own Pmax — that one is not a
     * margin question but an impossible nameplate.
     */
    _undersizedRatings() {
        const params = this.parseNumericValues(this.getFormValues());
        const suggested = suggestedRatingValues(computeSuggestedRatings(params));
        const low = CAPACITY_FIELDS
            .filter(([id]) => {
                const entered = Number(params[id]);
                const target = Number(suggested[id]);
                return entered > 0 && target > 0 && entered < target * 0.995;
            })
            .map(([id, label, unit]) => ({
                label,
                unit,
                entered: Number(params[id]),
                target: Number(suggested[id]),
                shortfallPct: (1 - Number(params[id]) / Number(suggested[id])) * 100,
            }));
        const sn = Number(params.storageSnMva);
        const pUnit = Math.max(Number(params.pMaxDischarge_MW) || 0, Number(params.pMaxCharge_MW) || 0);
        const snBelowP = sn > 0 && pUnit > sn * 1.001;
        return { low, snBelowP, sn, pUnit };
    }

    buildFieldList(saved) {
        const inferred = inferTopologyFromGraph(this.graph);
        const v = (id, def) => this._savedVal(saved, id, def);
        const p = Number(v('pocP_MW', 50));
        const pf = Number(v('powerFactor', 0.95));
        const qDefault = v('specifyQDirectly', false) ? v('pocQ_Mvar', qFromPPf(p, pf)) : qFromPPf(p, pf);
        const topoDefault = inferred || v('stringTopology', 'two_winding') || 'two_winding';
        const s = computeSuggestedRatings({
            pocP_MW: p,
            powerFactor: pf,
            pocQ_Mvar: qDefault,
            numUnits: parseInt(v('numUnits', 4), 10) || 4,
            stringTopology: topoDefault === 'three_winding' ? 'three_winding' : 'two_winding',
            pcsPerWinding: Number(v('pcsPerWinding', 2)) === 4 ? 4 : 2,
            umin_pu: Number(v('umin_pu', 0.95)) || 0.95,
            auxP_MW: Number(v('auxP_MW', 0.5)) || 0,
            mvVoltage_kV: Number(v('mvVoltage_kV', 33)) || 33,
        });
        const sugRatings = suggestedRatingValues(s);
        // A rating the user typed in is kept; the rest follow the POC inputs.
        const r = (id) => (this._isEdited(id) ? this._savedVal(saved, id, sugRatings[id]) : sugRatings[id]);
        return [
            this._section('POC / Grid'),
            this._field('pocP_MW', 'Active power at POC / Pn (MW)', v('pocP_MW', 50)),
            this._field('powerFactor', 'Grid-code power factor', v('powerFactor', 0.95)),
            this._field('pocQ_Mvar', 'Reactive power at POC (Mvar)', qDefault, 'number', 'any', {
                hint: 'Computed from Pn and PF: Q = Pn × tan(acos(PF)) (at 0.95 this is about 0.329 × Pn). Check “Specify Q directly” only if the grid operator gave a Q in Mvar.',
            }),
            this._field('specifyQDirectly', 'Specify Q directly (do not use PF)', v('specifyQDirectly', false), 'checkbox'),
            this._field('hvVoltage_kV', 'POC / HV voltage (kV)', v('hvVoltage_kV', 132)),
            this._field('frequency', 'Frequency (Hz)', v('frequency', 50)),
            this._field('umin_pu', 'Minimum POC voltage (pu)', v('umin_pu', 0.95)),
            this._field('umax_pu', 'Maximum POC voltage (pu)', v('umax_pu', 1.05)),
            this._field('unom_pu', 'Nominal grid voltage (pu)', v('unom_pu', 1.0)),
            this._field('vmin_allow_pu', 'Plant voltage min (pu)', v('vmin_allow_pu', 0.90), 'number', 'any', {
                description: 'Named-case pass/fail and SLD colours use this band (bus dialog default is 0.90–1.10). Umin/Umax above are the POC operating voltages for the study cases, not the plant voltage limits.',
            }),
            this._field('vmax_allow_pu', 'Plant voltage max (pu)', v('vmax_allow_pu', 1.10)),
            this._section('PCS / BESS'),
            this._field('numUnits', 'Number of PCS / Storage units', v('numUnits', 4), 'number', '1'),
            this._field('storageSnMva', 'PCS rating per unit (MVA)', r('storageSnMva'), 'number', 'any', {
                hint: 'Auto-sized from Pn, PF, and unit count until you type a value here; after that your rating is used as entered, '
                    + 'including in later sessions. “Reset ratings to auto-size” hands every rating back to the auto-sizer.',
            }),
            this._field('pMaxDischarge_MW', 'Max discharge per unit (MW)', r('pMaxDischarge_MW')),
            this._field('pMaxCharge_MW', 'Max charge per unit (MW)', r('pMaxCharge_MW')),
            this._field('batteryPmax_MW', 'Battery DC Pmax per rack (MW)', r('batteryPmax_MW'), 'number', 'any', {
                hint: 'Tighter of PCS Pmax and this value is applied as the AC Storage P limit. Matching PCS MW to the MVA rating does not close the P/Q circle if this battery field is still lower — raise it to the same MW as well. Generate SLD places a PCS inverter, DC bus, and battery rack per string. Those DC elements are shown on the diagram; the AC load-flow does not solve a coupled DC network.',
            }),
            this._field('lvVoltage_kV', 'LV / PCS voltage (kV)', v('lvVoltage_kV', 0.69)),
            this._field('useQCurve', 'Use PCS P–Q capability curve', v('useQCurve', false), 'checkbox'),
            this._section('HV/MV transformer (OLTC)'),
            this._field('mvVoltage_kV', 'MV collection voltage (kV)', v('mvVoltage_kV', 33)),
            this._field('hvTrafoSnMva', 'POC transformer rating (MVA)', r('hvTrafoSnMva')),
            this._field('hvVkPercent', 'Short-circuit voltage vk (%)', r('hvVkPercent')),
            this._field('tapMin', 'Tap min', v('tapMin', -5), 'number', '1'),
            this._field('tapMax', 'Tap max', v('tapMax', 5), 'number', '1'),
            this._field('tapStepPercent', 'Tap step (%)', v('tapStepPercent', 1.25)),
            this._field('oltcVmLower', 'OLTC band lower (pu)', v('oltcVmLower', 0.99)),
            this._field('oltcVmUpper', 'OLTC band upper (pu)', v('oltcVmUpper', 1.01)),
            this._field('tapSweep', 'Tap position sweep (rated discharge)', v('tapSweep', false), 'checkbox', null, {
                description: 'Optional. Sweeps the HV/MV OLTC at rated discharge. Leave off for a shorter study; you can still review named cases and the P/Q envelope.',
            }),
            this._section('MV cables'),
            this._field('cableLength_km', 'Cable length per string (km)', v('cableLength_km', 0.3)),
            this._field('cableR_ohmPerKm', 'R (ohm/km)', v('cableR_ohmPerKm', 0.08)),
            this._field('cableX_ohmPerKm', 'X (ohm/km)', v('cableX_ohmPerKm', 0.12)),
            this._field('cableMaxIKa', 'Thermal rating (kA)', r('cableMaxIKa')),
            this._section('MV/LV transformers'),
            this._field('stringTopology', 'String transformer type', v('stringTopology', topoDefault), 'select', null, {
                options: [
                    { value: 'two_winding', label: 'Two-winding (1 PCS per trafo)' },
                    { value: 'three_winding', label: 'Three-winding skid (2 × 0.69 kV windings)' },
                ],
                hint: 'Three-winding: one MV/LV skid transformer with two 690 V windings, 2 or 4 inverters on each.',
            }),
            this._field('pcsPerWinding', 'PCS per LV winding (3W skid)', v('pcsPerWinding', 2), 'select', null, {
                options: [
                    { value: '2', label: '2 inverters per winding' },
                    { value: '4', label: '4 inverters per winding' },
                ],
            }),
            this._field('stringTrafoSnMva', 'String transformer rating (MVA)', r('stringTrafoSnMva')),
            this._field('stringVkPercent', 'String vk (%)', r('stringVkPercent')),
            this._section('Auxiliary load'),
            this._field('auxP_MW', 'Auxiliary P (MW)', v('auxP_MW', 0.5)),
            this._field('auxQ_Mvar', 'Auxiliary Q (Mvar)', v('auxQ_Mvar', 0.1)),
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
        const out = {
            pocP_MW: num('pocP_MW', 50),
            pocQ_Mvar: num('pocQ_Mvar', 0),
            powerFactor: num('powerFactor', 0.95),
            hvVoltage_kV: num('hvVoltage_kV', 132),
            mvVoltage_kV: num('mvVoltage_kV', 33),
            lvVoltage_kV: num('lvVoltage_kV', 0.69),
            unom_pu: num('unom_pu', 1),
            umin_pu: num('umin_pu', 0.95),
            umax_pu: num('umax_pu', 1.05),
            vmin_allow_pu: num('vmin_allow_pu', 0.9),
            vmax_allow_pu: num('vmax_allow_pu', 1.1),
            frequency: num('frequency', 50),
            numUnits: int('numUnits', 4),
            // Ratings left blank are filled from computeSuggestedRatings, not from
            // a fixed catalog value that would only suit one plant size.
            storageSnMva: num('storageSnMva', 0),
            pMaxDischarge_MW: num('pMaxDischarge_MW', 0),
            pMaxCharge_MW: num('pMaxCharge_MW', 0),
            hvTrafoSnMva: num('hvTrafoSnMva', 0),
            hvVkPercent: num('hvVkPercent', 0),
            tapMin: int('tapMin', -5),
            tapMax: int('tapMax', 5),
            tapStepPercent: num('tapStepPercent', 1.25),
            oltcVmLower: num('oltcVmLower', 0.99),
            oltcVmUpper: num('oltcVmUpper', 1.01),
            cableLength_km: num('cableLength_km', 0.3),
            cableR_ohmPerKm: num('cableR_ohmPerKm', 0.08),
            cableX_ohmPerKm: num('cableX_ohmPerKm', 0.12),
            cableMaxIKa: num('cableMaxIKa', 0),
            stringTrafoSnMva: num('stringTrafoSnMva', 0),
            stringVkPercent: num('stringVkPercent', 0),
            auxP_MW: num('auxP_MW', 0.5),
            auxQ_Mvar: num('auxQ_Mvar', 0.1),
            batteryPmax_MW: num('batteryPmax_MW', num('pMaxDischarge_MW', 0)),
            stringTopology: raw.stringTopology === 'three_winding' ? 'three_winding' : 'two_winding',
            pcsPerWinding: int('pcsPerWinding', 2) === 4 ? 4 : 2,
            specifyQDirectly: raw.specifyQDirectly === true || raw.specifyQDirectly === 'true',
            useQCurve: raw.useQCurve === true || raw.useQCurve === 'true',
            tapSweep: raw.tapSweep === true || raw.tapSweep === 'true',
            oltcEnabled: true,
            pocBusName: 'POC_HV',
            extGridName: 'Grid',
            hvTrafoName: 'POC_Transformer',
        };
        if (!out.specifyQDirectly) {
            out.pocQ_Mvar = qFromPPf(out.pocP_MW, out.powerFactor);
        }
        return out;
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
            if (field.id === 'specifyQDirectly') {
                const hint = document.createElement('div');
                hint.textContent = 'Leave unchecked to set Q from the grid-code power factor: Q = P × tan(acos(PF)).';
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
        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            input.id = field.id;
            (field.options || []).forEach((opt) => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                if (String(field.value) === String(opt.value)) o.selected = true;
                input.appendChild(o);
            });
            this._styleNumberInput(input);
        } else {
            input = document.createElement('input');
            input.type = field.type || 'number';
            input.id = field.id;
            input.value = field.value ?? '';
            if (field.step) input.step = field.step;
            this._styleNumberInput(input);
        }
        input.addEventListener('input', () => this._markEdited(field.id));
        input.addEventListener('change', () => this._markEdited(field.id));
        this.inputs.set(field.id, input);
        group.appendChild(label);
        group.appendChild(input);
        if (field.hint) {
            const hint = document.createElement('div');
            hint.textContent = field.hint;
            hint.style.cssText = 'font-size:11px;color:#6c757d;line-height:1.35;';
            group.appendChild(hint);
        }
        return group;
    }

    displayDialog(callback) {
        this.callback = callback;
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        this.graph = this.graph || this.ui?.editor?.graph;
        this.inputs = new Map();
        const saved = loadWizardDraft(this.graph);
        this._editedRatings = new Set(
            Array.isArray(saved?.[DRAFT_EDITED_KEY]) ? saved[DRAFT_EDITED_KEY] : []
        );

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

        this.buildFieldList(saved).forEach((field) => {
            if (field.type === 'section') {
                startSection(field.title);
                return;
            }
            const control = this._createFieldControl(field);
            (sectionGrid || form).appendChild(control);
        });

        const syncQFromPf = () => {
            const specify = this.inputs.get('specifyQDirectly');
            const qInp = this.inputs.get('pocQ_Mvar');
            const pInp = this.inputs.get('pocP_MW');
            const pfInp = this.inputs.get('powerFactor');
            if (!qInp) return;
            const locked = !(specify && specify.checked);
            qInp.readOnly = locked;
            qInp.style.background = locked ? '#f1f5f9' : '#fff';
            if (locked && pInp && pfInp) {
                qInp.value = String(Math.round(qFromPPf(pInp.value, pfInp.value) * 1000) / 1000);
            }
        };
        const ratingNote = document.createElement('div');
        ratingNote.style.cssText = 'display:none;margin-top:10px;padding:8px 10px;border-radius:6px;'
            + 'border:1px solid #fcd34d;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.45;';
        const refreshRatingNote = () => {
            const { low, snBelowP, sn, pUnit } = this._undersizedRatings();
            if (!low.length && !snBelowP) {
                ratingNote.style.display = 'none';
                return;
            }
            const parts = [];
            if (snBelowP) {
                parts.push(`<strong>PCS rating per unit ${sn} MVA is below its own ${pUnit} MW Pmax</strong>, `
                    + 'so P is clipped to the MVA rating. Raise the MVA or lower Pmax.');
            }
            if (low.length) {
                const list = low
                    .map((r) => `${r.label} ${r.entered} ${r.unit} vs ${r.target} (−${r.shortfallPct.toFixed(0)}%)`)
                    .join('; ');
                parts.push(`Below the auto-sized value: <strong>${list}</strong>. `
                    + 'Auto-sizing is deliberately conservative (margin for losses and for Q at Umin), '
                    + 'so a plant slightly under it can still be compliant — the run shows the verdict. '
                    + 'Ratings are used exactly as entered; “Reset ratings to auto-size” restores the suggested set.');
            }
            ratingNote.innerHTML = parts.join('<br>');
            ratingNote.style.display = 'block';
        };

        form.addEventListener('input', () => { syncQFromPf(); refreshRatingNote(); });
        form.addEventListener('change', (e) => {
            syncQFromPf();
            const id = e.target && e.target.id;
            if (RATING_DRIVERS.has(id)) {
                this._writeSuggestedRatings(computeSuggestedRatings(this.parseNumericValues(this.getFormValues())));
            }
            refreshRatingNote();
        });
        syncQFromPf();

        form.appendChild(ratingNote);
        contentArea.appendChild(form);
        container.appendChild(contentArea);
        refreshRatingNote();

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
        const autoBtn = this.createButton('Reset ratings to auto-size', '#f59e0b', '#d97706');
        const genBtn = this.createButton('Generate / Update SLD', '#10b981', '#059669');
        const runBtn = this.createButton('Run Study', '#007bff', '#0056b3');

        cancelBtn.onclick = (e) => { e.preventDefault(); this.closeDialog(); };

        autoBtn.onclick = (e) => {
            e.preventDefault();
            this._resetRatingsToAuto();
            refreshRatingNote();
        };

        // Ratings are taken from the form exactly as shown. Only a blank or
        // non-positive field falls back to the suggested value.
        const preparePlantParams = () => {
            const params = this.parseNumericValues(this.getFormValues());
            const suggested = suggestedRatingValues(computeSuggestedRatings(params));
            RATING_FIELDS.forEach((id) => {
                if (Number(params[id]) > 0) return;
                params[id] = suggested[id];
                const inp = this.inputs.get(id);
                if (inp) inp.value = String(suggested[id]);
            });
            return params;
        };

        const draftValues = (params) => ({
            ...this.getFormValues(),
            ...params,
            [DRAFT_EDITED_KEY]: [...(this._editedRatings || [])],
        });

        genBtn.onclick = (e) => {
            e.preventDefault();
            try {
                const params = preparePlantParams();
                saveWizardDraft(this.graph, draftValues(params));
                const result = buildOrUpdateBessPlant(this.graph, params);
                this.parkStudyModal(result.created
                    ? 'SLD created — back to BESS Preliminary Design'
                    : 'SLD updated — back to BESS Preliminary Design');
                requestAnimationFrame(() => {
                    try {
                        this.graph?.refresh?.();
                        this.graph?.fit?.();
                        this.graph?.center?.(true, true);
                    } catch { /* ignore */ }
                });
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
                const params = preparePlantParams();
                saveWizardDraft(this.graph, draftValues(params));
                buildOrUpdateBessPlant(this.graph, params);
                const values = { ...draftValues(params), action: 'run' };
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
        btnRow.appendChild(autoBtn);
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
