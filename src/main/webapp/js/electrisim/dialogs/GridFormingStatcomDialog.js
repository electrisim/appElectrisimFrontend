// GridFormingStatcomDialog.js - settings for sizing a grid-forming STATCOM and its supercapacitors
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';
import { listDiagramBusbars } from '../utils/scFaultBuses.js';

const SETTINGS_ATTR = 'electrisim_study_settings';

/**
 * Requirement sets. The connection conditions name the capabilities and leave the numbers to be
 * agreed with the operator, so every number here is a starting assumption the user can change.
 */
export const GRID_FORMING_REQUIREMENT_SETS = {
    pse_grid_forming: {
        label: 'PSE (Poland): synthetic inertia, oscillation damping, grid-forming STATCOM (newer connection conditions, 15.3 and 15.4)',
        values: {
            duty_inertia: true, inertia_h_s: '3', inertia_base: 'plant', rocof_hz_s: '2', f_min_hz: '47.5', f_max_hz: '51.5',
            duty_phase_jump: true, phase_jump_deg: '10', phase_jump_tau_s: '0.2',
            duty_damping: true, damping_percent: '5', damping_freq_hz: '0.5',
            duty_frequency_support: false, droop_percent: '5', deadband_mhz: '20', support_range_percent: '5',
            support_time_s: '15', activation_threshold_hz: '0', activation_delay_s: '0'
        }
    },
    pse_island: {
        // These conditions put FSM / LFSM and island operation on the turbines and the park controller.
        // They ask for no grid forming, so every duty is off and the result is "no supercapacitors".
        label: 'PSE (Poland): island operation with FSM, LFSM-O, LFSM-U, no grid forming, so no supercapacitors (older connection conditions)',
        values: {
            duty_inertia: false, inertia_h_s: '3', inertia_base: 'plant', rocof_hz_s: '2', f_min_hz: '47.5', f_max_hz: '51.5',
            duty_phase_jump: false, phase_jump_deg: '10', phase_jump_tau_s: '0.2',
            duty_damping: false, damping_percent: '5', damping_freq_hz: '0.5',
            duty_frequency_support: false, droop_percent: '5', deadband_mhz: '20', support_range_percent: '5',
            support_time_s: '15', activation_threshold_hz: '0.5', activation_delay_s: '1'
        }
    },
    custom: { label: 'Custom (keep the values below)', values: null }
};

function cellAttr(cell, name) {
    try {
        return cell?.value?.getAttribute ? (cell.value.getAttribute(name) || '') : '';
    } catch (e) {
        return '';
    }
}

function savedSettings(graph, key) {
    try {
        const attrs = graph?.getModel?.().getRoot?.()?.value?.attributes;
        if (!attrs) return {};
        for (let i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === SETTINGS_ATTR) {
                const all = JSON.parse(attrs[i].nodeValue);
                return (all && typeof all[key] === 'object' && all[key]) || {};
            }
        }
    } catch (e) { /* missing or malformed settings */ }
    return {};
}

function listStatcoms(graph) {
    const model = graph?.getModel?.();
    if (!model) return [];
    const cells = (typeof model.getDescendants === 'function' ? model.getDescendants() : null)
        || Object.values(model.cells || {});
    const out = [];
    cells.forEach((cell) => {
        const style = typeof cell?.getStyle === 'function' ? (cell.getStyle() || '') : '';
        if (!/shapeELXXX=SSC(;|$)/.test(style) || !cell.value) return;
        const qMax = Math.abs(parseFloat(cellAttr(cell, 'q_max_mvar')));
        const qMin = Math.abs(parseFloat(cellAttr(cell, 'q_min_mvar')));
        const rating = Math.max(Number.isFinite(qMax) ? qMax : 0, Number.isFinite(qMin) ? qMin : 0);
        out.push({
            value: cell.getId(),
            label: `${cellAttr(cell, 'name') || 'STATCOM'} (${rating > 0 ? `±${rating} Mvar` : 'no Q rating set'})`
        });
    });
    return out;
}

export class GridFormingStatcomDialog extends Dialog {
    constructor(editorUi) {
        super('Grid-Forming STATCOM Sizing (Supercapacitors)', 'Calculate');
        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 780;
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        const statcoms = listStatcoms(this.graph);
        this._hasStatcom = statcoms.length > 0;
        const buses = listDiagramBusbars(this.graph);
        const pccSaved = String(savedSettings(this.graph, 'gridCodePq').pccBusId || '');
        const busOptions = buses.map((b) => ({ value: b.id, label: b.label, default: String(b.id) === pccSaved }));
        const d = GRID_FORMING_REQUIREMENT_SETS.pse_grid_forming.values;

        this.parameters = [
            { type: 'section', label: 'Model' },
            {
                id: 'statcom_id', label: 'STATCOM to size', type: 'select',
                options: statcoms.length ? statcoms : [{ value: '', label: 'No STATCOM on this diagram' }]
            },
            {
                id: 'pcc_bus_id', label: 'Connection point (bus)', type: 'select',
                description: 'The bus where the plant meets the transmission grid. Its short-circuit power is reported.',
                options: busOptions.length ? busOptions : [{ value: '', label: 'No buses on this diagram' }]
            },
            {
                id: 'statcom_rating_mva', label: 'STATCOM rating [MVA]', type: 'number', value: '', min: '0', step: '1',
                description: 'Leave empty to use the Q rating of the STATCOM in the model.'
            },
            {
                id: 'plant_mw', label: 'Plant rated power [MW]', type: 'number', value: '', min: '0', step: '1',
                description: 'Leave empty to use the sum of the Static Generators in service.'
            },
            {
                id: 'q_reserve_mode', label: 'Reactive power kept free for voltage control during the event', type: 'select',
                options: [
                    { value: 'load_flow', label: 'What the STATCOM carries in the load flow of this model', default: true },
                    { value: 'percent', label: 'A share of the STATCOM rating (next field)' },
                    { value: 'full', label: 'The full STATCOM rating' }
                ]
            },
            { id: 'q_reserve_percent', label: 'Share of the STATCOM rating kept for reactive power [%]', type: 'number', value: '50', min: '0', max: '100', step: '5' },
            {
                id: 'overload_pu', label: 'Short-time current capability of the converter [p.u.]', type: 'number', value: '1.0', min: '0.5', max: '3', step: '0.05',
                description: '1.0 means no overload. Use the supplier value for a few seconds if there is one.'
            },
            {
                id: 'frequency', label: 'Frequency', type: 'radio',
                options: [{ value: '50', label: '50 Hz', default: true }, { value: '60', label: '60 Hz' }]
            },

            { type: 'section', label: 'Grid Code requirement', subtitle: 'Choosing a set switches the duties below on or off. Only duties that need active power call for supercapacitors; the older PSE conditions have none. The numbers are left to be agreed with the operator, so check each one.' },
            {
                id: 'requirement_set', label: 'Requirement set', type: 'select',
                options: Object.entries(GRID_FORMING_REQUIREMENT_SETS).map(([value, set], i) => ({ value, label: set.label, default: i === 0 }))
            },

            { type: 'section', label: 'Frequency event', subtitle: 'The disturbance the STATCOM has to ride through, falling (discharge) and rising (charge).' },
            { id: 'rocof_hz_s', label: 'Rate of change of frequency [Hz/s]', type: 'number', value: d.rocof_hz_s, min: '0.05', step: '0.1' },
            { id: 'f_min_hz', label: 'Lowest frequency [Hz]', type: 'number', value: d.f_min_hz, step: '0.1' },
            { id: 'f_max_hz', label: 'Highest frequency [Hz]', type: 'number', value: d.f_max_hz, step: '0.1' },

            { type: 'section', label: 'Duty 1: synthetic inertia' },
            { id: 'duty_inertia', label: 'Size for synthetic inertia', type: 'checkbox', value: d.duty_inertia },
            { id: 'inertia_h_s', label: 'Inertia constant H [s]', type: 'number', value: d.inertia_h_s, min: '0', step: '0.5' },
            {
                id: 'inertia_base', label: 'H is given on', type: 'select',
                options: [
                    { value: 'plant', label: 'the plant rated power', default: true },
                    { value: 'statcom', label: 'the STATCOM rating' }
                ]
            },

            { type: 'section', label: 'Duty 2: voltage source behaviour (phase jump)', subtitle: 'The power comes from the model: bus voltage, coupling reactance of the STATCOM and grid reactance.' },
            { id: 'duty_phase_jump', label: 'Size for a phase jump of the grid voltage', type: 'checkbox', value: d.duty_phase_jump },
            { id: 'phase_jump_deg', label: 'Phase jump [degrees]', type: 'number', value: d.phase_jump_deg, min: '0', max: '90', step: '1' },
            { id: 'phase_jump_tau_s', label: 'Decay time constant of the response [s]', type: 'number', value: d.phase_jump_tau_s, min: '0.01', step: '0.05' },

            { type: 'section', label: 'Duty 3: power oscillation damping' },
            { id: 'duty_damping', label: 'Size for oscillation damping with active power', type: 'checkbox', value: d.duty_damping },
            { id: 'damping_percent', label: 'Damping power amplitude [% of STATCOM rating]', type: 'number', value: d.damping_percent, min: '0', step: '1' },
            { id: 'damping_freq_hz', label: 'Oscillation frequency [Hz]', type: 'number', value: d.damping_freq_hz, min: '0.05', step: '0.1', description: 'The lowest frequency to damp needs the most energy.' },

            { type: 'section', label: 'Duty 4: frequency support in island operation (FSM / LFSM bridging)', subtitle: 'The STATCOM delivers the droop response until the turbines have taken over.' },
            { id: 'duty_frequency_support', label: 'Size for frequency support', type: 'checkbox', value: d.duty_frequency_support },
            { id: 'droop_percent', label: 'Droop [%]', type: 'number', value: d.droop_percent, min: '0.5', step: '0.5' },
            { id: 'deadband_mhz', label: 'Deadband [mHz]', type: 'number', value: d.deadband_mhz, min: '0', step: '5' },
            { id: 'support_range_percent', label: 'Largest power from the STATCOM [% of plant rated power]', type: 'number', value: d.support_range_percent, min: '0', step: '1' },
            { id: 'support_time_s', label: 'Bridging time [s]', type: 'number', value: d.support_time_s, min: '0', step: '1' },
            { id: 'activation_threshold_hz', label: 'Island mode starts at a frequency deviation of [Hz]', type: 'number', value: d.activation_threshold_hz, min: '0', step: '0.1', description: '0 starts the support at the deadband.' },
            { id: 'activation_delay_s', label: 'Delay before island mode starts [s]', type: 'number', value: d.activation_delay_s, min: '0', step: '0.5' },

            { type: 'section', label: 'Supercapacitor bank', subtitle: 'Defaults are a common 3000 F cell. Use the data sheet of the cell you plan to use.' },
            { id: 'cell_capacitance_f', label: 'Cell capacitance [F]', type: 'number', value: '3000', min: '1', step: '100' },
            { id: 'cell_voltage_v', label: 'Cell rated voltage [V]', type: 'number', value: '2.7', min: '0.5', step: '0.1' },
            { id: 'cell_esr_mohm', label: 'Cell series resistance, new [mΩ]', type: 'number', value: '0.29', min: '0', step: '0.01' },
            { id: 'cell_max_current_a', label: 'Cell peak current [A]', type: 'number', value: '1900', min: '1', step: '50' },
            { id: 'bank_vmax_v', label: 'Highest voltage of a string [V]', type: 'number', value: '1500', min: '10', step: '50' },
            { id: 'bank_vmin_percent', label: 'Lowest working voltage [% of the highest]', type: 'number', value: '50', min: '5', max: '95', step: '5' },
            { id: 'eol_capacitance_percent', label: 'Capacitance at end of life [% of new]', type: 'number', value: '80', min: '10', max: '100', step: '5' },
            { id: 'eol_esr_percent', label: 'Resistance at end of life [% of new]', type: 'number', value: '200', min: '100', step: '10' },
            { id: 'efficiency_percent', label: 'Converter efficiency, one way [%]', type: 'number', value: '97', min: '50', max: '100', step: '0.5' },
            { id: 'design_margin_percent', label: 'Design margin on the bank [%]', type: 'number', value: '10', min: '0', step: '5' }
        ];
    }

    getDescription() {
        return (
            '<strong>Which converter rating and how many supercapacitors make the STATCOM grid forming?</strong><br>' +
            'A STATCOM has no energy of its own. To act as a voltage source, give synthetic inertia and damp oscillations it must ' +
            'deliver and absorb active power for a few seconds, and that energy comes from supercapacitors on its DC side. ' +
            'The study reads the STATCOM, the plant power, the load-flow operating point and the grid short-circuit power from the diagram, ' +
            'simulates a falling and a rising frequency event, and sizes the bank at end of life. ' +
            '<a href="https://electrisim.com/documentation.html#grid-forming-statcom" target="_blank" rel="noopener noreferrer">Documentation</a>'
        );
    }

    /** Fill the duty fields from the chosen requirement set. */
    _applyRequirementSet(key) {
        const values = GRID_FORMING_REQUIREMENT_SETS[key]?.values;
        if (!values) return;
        Object.entries(values).forEach(([id, value]) => {
            const input = this.inputs.get(id);
            if (!input) return;
            if (input.type === 'checkbox') input.checked = !!value;
            else input.value = String(value);
        });
    }

    show(callback) {
        super.show(async (values) => {
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (window.showSubscriptionModal) window.showSubscriptionModal();
                    else alert('A subscription is required for Grid-Forming STATCOM Sizing.');
                    return;
                }
            } catch (e) {
                alert('Unable to verify subscription status. Please try again.');
                return;
            }
            if (!this._hasStatcom) {
                alert('This study needs a STATCOM on the diagram. Add a STATCOM (SSC), connect it to a bus and try again.');
                return;
            }
            if (callback) callback(values);
        });
        const select = this.inputs.get('requirement_set');
        if (select) {
            // Only a change fills the duties: values remembered in the diagram stay as the user left them.
            this.addEventListener(select, 'change', () => this._applyRequirementSet(select.value));
        }
    }

    async checkSubscriptionStatus() {
        await ensureSubscriptionFunctions();
        if (window.checkSubscriptionStatus) return window.checkSubscriptionStatus();
        if (window.SubscriptionManager?.checkSubscriptionStatus) {
            return window.SubscriptionManager.checkSubscriptionStatus();
        }
        return false;
    }
}

globalThis.GridFormingStatcomDialog = GridFormingStatcomDialog;
