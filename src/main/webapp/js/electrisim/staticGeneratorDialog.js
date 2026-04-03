import { Dialog } from './Dialog.js';
import { createEconomicTabContent, buildCostPerUnitByCurrency } from './utils/economicTabHelper.js';
import {
    mountHarmonicSpectrumTriState,
    syncHarmonicSpectrumTriStateFromDialogData,
    valuesFromHarmonicSpectrumTriState
} from './utils/loadHarmonicSpectrumTriStateUi.js';

/**
 * Rated active power (MW) for the built-in offshore WTG Q(P) example.
 * Used only as documentation / preset alignment with curve end-point.
 */
export const Q_CAPABILITY_PRESET_15MW_OFFSHORE_P_RATED_MW = 15;

/**
 * Representative Q(P) for a ~15 MW class Type IV (full-converter) wind turbine,
 * not OEM-specific. |Q| at each P follows |Q| ≈ P·tan(arccos(0.95)) (±0.95 PF
 * capability), a widely used simplification in wind/PV grid-code and integration
 * studies; see e.g. interconnection overviews such as
 * https://www.esig.energy/wiki-main-page/reactive-power-capability-and-interconnection-requirements-for-pv-and-wind-plants/
 * Replace with manufacturer or project data when available.
 */
// |Q|/P = tan(arccos(0.95)) = sqrt(1-0.95²)/0.95 ≈ 0.32868 (±0.95 PF at each P)
export const qCapabilityCurve15MwOffshoreWtgPoints = [
    { p_mw: 0, q_min_mvar: 0, q_max_mvar: 0 },
    { p_mw: 3.75, q_min_mvar: -1.23, q_max_mvar: 1.23 },
    { p_mw: 7.5, q_min_mvar: -2.47, q_max_mvar: 2.47 },
    { p_mw: 11.25, q_min_mvar: -3.7, q_max_mvar: 3.7 },
    { p_mw: 15, q_min_mvar: -4.93, q_max_mvar: 4.93 }
];

export const qCapabilityCurve15MwOffshoreWtgJson = JSON.stringify(qCapabilityCurve15MwOffshoreWtgPoints);

/**
 * Digitized P–Q envelope for **1·U<sub>n</sub>** (export / import limits) for a **15 MW offshore wind turbine**,
 * from a typical manufacturer-style “power boosted reactive power limits” diagram (50 Hz LV side).
 * Original axes: P [kW], Q [kVAr]; stored here as MW / MVAr for pandapower.
 * Asymmetric Qmin/Qmax vs P (import slightly lower magnitude than export at mid-P).
 * For engineering studies only — confirm against OEM certified curves for your plant.
 */
export const qCapabilityCurve15MwOffshoreWt1UnChartPoints = [
    { p_mw: 0, q_min_mvar: -16.5, q_max_mvar: 16.5 },
    { p_mw: 2.5, q_min_mvar: -16.2, q_max_mvar: 16.3 },
    { p_mw: 5, q_min_mvar: -15.5, q_max_mvar: 16.0 },
    { p_mw: 7.5, q_min_mvar: -14.5, q_max_mvar: 15.2 },
    { p_mw: 10, q_min_mvar: -12.8, q_max_mvar: 13.8 },
    { p_mw: 12.5, q_min_mvar: -10.5, q_max_mvar: 11.5 },
    { p_mw: 15, q_min_mvar: -6.5, q_max_mvar: 6.5 }
];

export const qCapabilityCurve15MwOffshoreWt1UnChartJson = JSON.stringify(qCapabilityCurve15MwOffshoreWt1UnChartPoints);

/** Suggested S<sub>n</sub> (MVA) for the 1·U<sub>n</sub> offshore wind turbine Q curve preset (converter apparent-power order). */
export const Q_CAPABILITY_PRESET_OFFSHORE_WT_1UN_SN_MVA = '17.5';

/**
 * Scale a Q-capability point table homogeneously: same technology, different plant rating.
 * Each p_mw and q value is multiplied by `scale` (typically targetRatedMw / templateRatedMw).
 */
export function scaleQCapabilityPointsForPlantRating(basePoints, scale) {
    if (!Array.isArray(basePoints) || !Number.isFinite(scale) || scale <= 0) {
        return [];
    }
    const r = (x) => {
        const n = Number(x);
        if (!Number.isFinite(n)) return 0;
        return Math.round(n * scale * 1e6) / 1e6;
    };
    return basePoints.map((pt) => ({
        p_mw: r(pt.p_mw),
        q_min_mvar: r(pt.q_min_mvar),
        q_max_mvar: r(pt.q_max_mvar)
    }));
}

function parseSortedQCapabilityPoints(raw) {
    let pts;
    try {
        pts = JSON.parse(String(raw).trim());
    } catch {
        return null;
    }
    if (!Array.isArray(pts) || pts.length < 2) return null;
    const sorted = [];
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!p || typeof p !== 'object') continue;
        const pMw = Number(p.p_mw);
        const qMin = Number(p.q_min_mvar);
        const qMax = Number(p.q_max_mvar);
        if (!Number.isFinite(pMw) || !Number.isFinite(qMin) || !Number.isFinite(qMax)) continue;
        sorted.push({ p_mw: pMw, q_min_mvar: qMin, q_max_mvar: qMax });
    }
    if (sorted.length < 2) return null;
    sorted.sort((a, b) => a.p_mw - b.p_mw);
    return sorted;
}

/**
 * If JSON is the ±0.95 PF or 1·Un preset at 15 MW or homogeneously scaled from it, return canonical base knots + sn.
 */
function matchBuiltInQCapabilityTemplate(sortedPts) {
    const pMax = sortedPts[sortedPts.length - 1].p_mw;
    if (!Number.isFinite(pMax) || pMax <= 1e-9) return null;
    const pRef = Q_CAPABILITY_PRESET_15MW_OFFSHORE_P_RATED_MW;
    const inv = pRef / pMax;
    const tolAbs = 0.07;
    const tolRel = 0.015;
    const close = (a, b) =>
        Math.abs(a - b) <= Math.max(tolAbs, tolRel * Math.max(Math.abs(b), 1));

    const presets = [
        { template: qCapabilityCurve15MwOffshoreWtgPoints, snBase: 16.5 },
        {
            template: qCapabilityCurve15MwOffshoreWt1UnChartPoints,
            snBase: parseFloat(Q_CAPABILITY_PRESET_OFFSHORE_WT_1UN_SN_MVA)
        }
    ];
    for (let pi = 0; pi < presets.length; pi++) {
        const { template, snBase } = presets[pi];
        if (sortedPts.length !== template.length) continue;
        let ok = true;
        for (let i = 0; i < template.length; i++) {
            if (!close(sortedPts[i].p_mw * inv, template[i].p_mw)) {
                ok = false;
                break;
            }
            if (!close(sortedPts[i].q_min_mvar * inv, template[i].q_min_mvar)) {
                ok = false;
                break;
            }
            if (!close(sortedPts[i].q_max_mvar * inv, template[i].q_max_mvar)) {
                ok = false;
                break;
            }
        }
        if (ok) {
            return {
                basePoints: JSON.parse(JSON.stringify(template)),
                pRatedMw: pRef,
                snBase
            };
        }
    }
    return null;
}

/**
 * Expand table knots to a polyline: straight segments (straightLineYValues) or
 * horizontal steps until the next P (constantYValue), matching pandapower naming.
 */
function expandQCapabilityPolyline(parsed, qkey, curveStyle) {
    const n = parsed.length;
    const out = [];
    if (curveStyle === 'constantYValue') {
        for (let i = 0; i < n - 1; i++) {
            const q = parsed[i][qkey];
            out.push([parsed[i].p_mw, q]);
            out.push([parsed[i + 1].p_mw, q]);
        }
        const last = parsed[n - 1];
        out.push([last.p_mw, last[qkey]]);
    } else {
        for (let i = 0; i < n; i++) {
            out.push([parsed[i].p_mw, parsed[i][qkey]]);
        }
    }
    return out;
}

// Default values for static generator parameters (based on pandapower documentation)
export const defaultStaticGeneratorData = {
    name: "Static Generator",
    p_mw: 0.0,
    q_mvar: 0.0,
    sn_mva: 0.0,
    scaling: 1.0,
    type: 'wye',
    k: 0.0,
    rx: 0.0,
    generator_type: 'async',
    lrc_pu: 0.0,
    max_ik_ka: 0.0,
    kappa: 0.0,
    current_source: true,
    in_service: true,
    cost_per_unit_by_currency: "0",
    /** pandapower: net.sgen.reactive_capability_curve + q_capability_curve_table */
    reactive_capability_curve: false,
    curve_style: 'straightLineYValues',
    q_capability_curve_json: qCapabilityCurve15MwOffshoreWtgJson,
    /** OpenDSS harmonic (static gen) */
    spectrum: 'defaultgen',
    spectrum_csv: '',
    Xdpp: 0.2,
    XRdp: 20
};

export class StaticGeneratorDialog extends Dialog {
    constructor(editorUi) {
        super('Static Generator Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'power';
        this.data = { ...defaultStaticGeneratorData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        /** Deep-copied template knots (15 MW class); used to rescale when Active power (MW) changes */
        this._qcapTemplateBasePoints = null;
        this._qcapTemplatePRatedMw = null;
        this._qcapTemplateSnBase = null;
        this._qcapProgrammaticJsonUpdate = false;
        
        // Power parameters (necessary for executing a power flow calculation)
        this.powerParameters = [
            {
                id: 'name',
                label: 'Generator Name',
                description: 'Name identifier for the static generator',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'p_mw',
                label: 'Active Power (MW)',
                description: 'The active power of the static generator (positive for generation!). When a Q-capability template is active, the P–Q table is scaled so its maximum P equals this value.',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'q_mvar',
                label: 'Reactive Power (MVar)',
                description: 'The reactive power of the static generator',
                type: 'number',
                value: this.data.q_mvar.toString(),
                step: '0.1'
            }
        ];
        
        // Rating parameters
        this.ratingParameters = [
            {
                id: 'sn_mva',
                label: 'Nominal Power (MVA)',
                description: 'Nominal power of the static generator',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'scaling',
                label: 'Scaling Factor',
                description: 'An OPTIONAL scaling factor to be set customly. Multiplies with p_mw and q_mvar',
                type: 'number',
                value: this.data.scaling.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'type',
                label: 'Connection Type',
                description: 'Type of generator connection',
                type: 'select',
                value: this.data.type,
                options: ['wye', 'delta']
            }
        ];
        
        // Short-circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'k',
                label: 'Current Ratio (k)',
                description: 'Ratio of nominal current to short circuit current',
                type: 'number',
                value: this.data.k.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'rx',
                label: 'R/X Ratio',
                description: 'R/X ratio for short circuit impedance. Only relevant if type is specified as motor so that sgen is treated as asynchronous motor.',
                type: 'number',
                value: this.data.rx.toString(),
                step: '0.01'
            },
            {
                id: 'generator_type',
                label: 'Generator Type',
                description: 'Can be one of "current_source" (full size converter), "async" (asynchronous generator), or "async_doubly_fed" (doubly fed asynchronous generator, DFIG).',
                type: 'select',
                value: this.data.generator_type,
                options: ['current_source', 'async', 'async_doubly_fed']
            }
        ];
        
        // Advanced short-circuit parameters
        this.advancedParameters = [
            {
                id: 'lrc_pu',
                label: 'Locked Rotor Current (p.u.)',
                description: 'Locked rotor current in relation to the rated generator current. Relevant if the generator_type is "async".',
                type: 'number',
                value: this.data.lrc_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'max_ik_ka',
                label: 'Max Short-Circuit Current (kA)',
                description: 'The highest instantaneous short-circuit value in case of a three-phase short-circuit (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
                type: 'number',
                value: this.data.max_ik_ka.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'kappa',
                label: 'Peak Factor (κ)',
                description: 'The factor for the calculation of the peak short-circuit current, referred to the high-voltage side (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
                type: 'number',
                value: this.data.kappa.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'current_source',
                label: 'Current Source Model',
                description: 'Model this sgen as a current source during short-circuit calculations; useful in some cases, for example the simulation of full-size converters per IEC 60909-0:2016.',
                type: 'checkbox',
                value: this.data.current_source
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the static generator is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];

        this.harmonicParameters = [
            {
                id: 'spectrum',
                type: 'harmonicSpectrumTriState',
                triStateModeSelectId: 'staticgen_harm_spectrum_mode',
                defaultSpectrum: 'defaultgen',
                spectrumCsvInputId: 'staticgen_spectrum_csv',
                label: 'Harmonic spectrum',
                description: 'Default (OpenDSS defaultgen), Linear, Custom (CSV: harmonic order, %magnitude, angle), or None (no harmonic spectrum).',
                spectrumValue: this.data.spectrum,
                csvValue: this.data.spectrum_csv,
                rows: 5
            },
            {
                id: 'Xdpp',
                label: 'Subtransient reactance (Xdpp)',
                unit: 'p.u.',
                description: 'Subtransient reactance for harmonic model (per unit)',
                type: 'number',
                value: String(this.data.Xdpp),
                step: '0.01',
                min: '0'
            },
            {
                id: 'XRdp',
                label: 'X/R (XRdp)',
                description: 'X/R ratio at subtransient frequency for harmonic model',
                type: 'number',
                value: String(this.data.XRdp),
                step: '0.1',
                min: '0'
            }
        ];

        // Reactive power capability curve (pandapower net.q_capability_curve_table; requires enforce_q_lims in PF)
        this.qCapabilityParameters = [
            {
                id: 'reactive_capability_curve',
                label: 'Use Q capability curve',
                description: 'If enabled, Qmin/Qmax vs active power follow the table below (pandapower static generator reactive capability). Power flow uses this when reactive limits are enforced. See <a href="https://pandapower.readthedocs.io/en/latest/elements/sgen.html#static-generator-reactive-power-capability-curve-characteristics" target="_blank" rel="noopener">pandapower sgen Q curve</a>.',
                type: 'checkbox',
                value: this.data.reactive_capability_curve
            },
            {
                id: 'curve_style',
                label: 'Curve style',
                description: 'straightLineYValues: linear segments between points. constantYValue: Q holds until the next P point.',
                type: 'select',
                value: this.data.curve_style,
                options: ['straightLineYValues', 'constantYValue']
            },
            {
                id: 'q_capability_curve_json',
                label: 'Curve points (JSON)',
                description: 'Array of { "p_mw", "q_min_mvar", "q_max_mvar" } — at least two points, sorted by p_mw recommended. Templates below are defined for 15 MW; P and Q scale to Active power (MW) on the Power tab. Editing this JSON clears template scaling.',
                type: 'textarea',
                value: this.data.q_capability_curve_json,
                rows: 8
            }
        ];

        // Economic parameters (for Economic Analysis)
        this.economicParameters = [
            { id: 'cost_per_unit_by_currency', label: 'Cost per unit', description: 'Cost per unit for Economic Analysis CAPEX calculation', type: 'text', value: '' }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Static Generator Parameters</strong><br>Set parameters for static generator with power flow and short-circuit capabilities. See the <a href="https://electrisim.com/documentation#static-generator" target="_blank">Electrisim documentation</a>.';
    }
    
    show(callback) {
        // Store callback for later use
        this.callback = callback;
        
        // Create custom dialog content with tabs
        this.showTabDialog();
    }
    
    showTabDialog() {
        // Use global App if ui is not valid
        this.ui = this.ui || window.App?.main?.editor?.editorUi;

        this._qcapTemplateBasePoints = null;
        this._qcapTemplatePRatedMw = null;
        this._qcapTemplateSnBase = null;
        this._qcapProgrammaticJsonUpdate = false;
        
        // Create main container
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

        // Add description
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

        // Create tab container
        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex',
            borderBottom: '2px solid #e9ecef',
            marginBottom: '16px'
        });

        // Create tabs
        const powerTab = this.createTab('Power', 'power', this.currentTab === 'power');
        const ratingTab = this.createTab('Rating', 'rating', this.currentTab === 'rating');
        const shortCircuitTab = this.createTab('Short Circuit', 'shortcircuit', this.currentTab === 'shortcircuit');
        const advancedTab = this.createTab('Advanced', 'advanced', this.currentTab === 'advanced');
        const harmonicTab = this.createTab('Harmonic', 'harmonic', this.currentTab === 'harmonic');
        const qCapTab = this.createTab('Q capability', 'qcapability', this.currentTab === 'qcapability');
        const economicTab = this.createTab('Economic', 'economic', this.currentTab === 'economic');
        
        tabContainer.appendChild(powerTab);
        tabContainer.appendChild(ratingTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(advancedTab);
        tabContainer.appendChild(harmonicTab);
        tabContainer.appendChild(qCapTab);
        tabContainer.appendChild(economicTab);
        container.appendChild(tabContainer);

        // Create content area
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

        // Create tab content containers
        const powerContent = this.createTabContent('power', this.powerParameters);
        const ratingContent = this.createTabContent('rating', this.ratingParameters);
        const shortCircuitContent = this.createTabContent('shortcircuit', this.shortCircuitParameters);
        const advancedContent = this.createTabContent('advanced', this.advancedParameters);
        const triSgen = (this.harmonicParameters || []).find(p => p.type === 'harmonicSpectrumTriState');
        if (triSgen) {
            triSgen.spectrumValue = this.data.spectrum;
            triSgen.csvValue = this.data.spectrum_csv || '';
        }
        const harmonicContent = this.createTabContent('harmonic', this.harmonicParameters);
        const qCapContent = this.createTabContent('qcapability', this.qCapabilityParameters);
        const economicContent = this.createTabContent('economic', this.economicParameters);

        const qCapForm = qCapContent.querySelector('form');
        if (qCapForm) {
            this._mountQCapabilityChartPanel(qCapContent, qCapForm);
        }
        
        contentArea.appendChild(powerContent);
        contentArea.appendChild(ratingContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(advancedContent);
        contentArea.appendChild(harmonicContent);
        contentArea.appendChild(qCapContent);
        contentArea.appendChild(economicContent);
        container.appendChild(contentArea);

        const qCapPresetWrap = document.createElement('div');
        Object.assign(qCapPresetWrap.style, {
            padding: '0 16px 16px',
            marginTop: '4px'
        });
        const qCapPresetHint = document.createElement('div');
        Object.assign(qCapPresetHint.style, { fontSize: '12px', color: '#6c757d', marginBottom: '10px', lineHeight: '1.45' });
        qCapPresetHint.innerHTML = '<strong>Templates</strong> — Shapes are defined for a <strong>15 MW</strong> reference; <strong>P and Q are scaled</strong> to the <strong>Active power (MW)</strong> on the Power tab (e.g. 3.3 MW). Nominal MVA is scaled by the same ratio. (1) Generic ±0.95 PF. (2) Offshore wind: digitized <strong>1·U<sub>n</sub></strong> limits from a typical manufacturer P–Q diagram (50 Hz LV). Both enable the curve, linear segments, and <code>current_source</code>. Editing the JSON clears auto-scaling. Verify OEM data for real projects.';

        const applyQCapabilityPreset = (jsonStr, templatePRatedMw, snMvaAtTemplate) => {
            let base;
            try {
                base = JSON.parse(jsonStr);
            } catch {
                return;
            }
            if (!Array.isArray(base) || base.length < 2) return;
            this._qcapTemplateBasePoints = JSON.parse(JSON.stringify(base));
            this._qcapTemplatePRatedMw = templatePRatedMw;
            this._qcapTemplateSnBase = parseFloat(snMvaAtTemplate);
            const ta = this.inputs.get('q_capability_curve_json');
            const cb = this.inputs.get('reactive_capability_curve');
            const styleSel = this.inputs.get('curve_style');
            if (cb) cb.checked = true;
            if (styleSel) styleSel.value = 'straightLineYValues';
            const gt = this.inputs.get('generator_type');
            if (gt) gt.value = 'current_source';
            this._applyQCapabilityScalingFromTemplate();
        };

        const presetRow = document.createElement('div');
        Object.assign(presetRow.style, {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
        });

        const qCapPresetBtn = this.createButton('Template: ±0.95 PF (15 MW)', '#17a2b8', '#138496');
        qCapPresetBtn.type = 'button';
        qCapPresetBtn.onclick = (e) => {
            e.preventDefault();
            applyQCapabilityPreset(
                qCapabilityCurve15MwOffshoreWtgJson,
                Q_CAPABILITY_PRESET_15MW_OFFSHORE_P_RATED_MW,
                '16.5'
            );
        };

        const qCapPresetOffshoreWt1UnBtn = this.createButton('Template: offshore wind turbine 1·Un (15 MW)', '#6f42c1', '#5a32a3');
        qCapPresetOffshoreWt1UnBtn.type = 'button';
        qCapPresetOffshoreWt1UnBtn.title = 'P–Q limits digitized from typical 15 MW offshore wind turbine diagram (1·Un), LV side';
        qCapPresetOffshoreWt1UnBtn.onclick = (e) => {
            e.preventDefault();
            applyQCapabilityPreset(
                qCapabilityCurve15MwOffshoreWt1UnChartJson,
                Q_CAPABILITY_PRESET_15MW_OFFSHORE_P_RATED_MW,
                Q_CAPABILITY_PRESET_OFFSHORE_WT_1UN_SN_MVA
            );
        };

        qCapPresetWrap.appendChild(qCapPresetHint);
        presetRow.appendChild(qCapPresetBtn);
        presetRow.appendChild(qCapPresetOffshoreWt1UnBtn);
        qCapPresetWrap.appendChild(presetRow);
        qCapContent.appendChild(qCapPresetWrap);

        const pMwEl = this.inputs.get('p_mw');
        if (pMwEl) {
            let pMwInputDebounce = null;
            const onActivePowerForQcap = () => this._syncQcapCurveToActivePowerIfPossible();
            pMwEl.addEventListener('change', onActivePowerForQcap);
            pMwEl.addEventListener('blur', onActivePowerForQcap);
            pMwEl.addEventListener('input', () => {
                if (pMwInputDebounce) clearTimeout(pMwInputDebounce);
                pMwInputDebounce = setTimeout(() => {
                    pMwInputDebounce = null;
                    onActivePowerForQcap();
                }, 100);
            });
        }

        const reactiveCapCb = this.inputs.get('reactive_capability_curve');
        if (reactiveCapCb) {
            reactiveCapCb.addEventListener('change', () => {
                if (reactiveCapCb.checked) {
                    this._syncQcapCurveToActivePowerIfPossible();
                }
            });
        }

        this._syncQcapCurveToActivePowerIfPossible();

        // Add button container
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
        const applyButton = this.createButton('Apply', '#007bff', '#0056b3');
        
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
            console.log('Static Generator values:', values);
            
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
        
        // Tab click handlers
        powerTab.onclick = () => this.switchTab('power', powerTab, [ratingTab, shortCircuitTab, advancedTab, harmonicTab, qCapTab, economicTab], powerContent, [ratingContent, shortCircuitContent, advancedContent, harmonicContent, qCapContent, economicContent]);
        ratingTab.onclick = () => this.switchTab('rating', ratingTab, [powerTab, shortCircuitTab, advancedTab, harmonicTab, qCapTab, economicTab], ratingContent, [powerContent, shortCircuitContent, advancedContent, harmonicContent, qCapContent, economicContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [powerTab, ratingTab, advancedTab, harmonicTab, qCapTab, economicTab], shortCircuitContent, [powerContent, ratingContent, advancedContent, harmonicContent, qCapContent, economicContent]);
        advancedTab.onclick = () => this.switchTab('advanced', advancedTab, [powerTab, ratingTab, shortCircuitTab, harmonicTab, qCapTab, economicTab], advancedContent, [powerContent, ratingContent, shortCircuitContent, harmonicContent, qCapContent, economicContent]);
        harmonicTab.onclick = () => this.switchTab('harmonic', harmonicTab, [powerTab, ratingTab, shortCircuitTab, advancedTab, qCapTab, economicTab], harmonicContent, [powerContent, ratingContent, shortCircuitContent, advancedContent, qCapContent, economicContent]);
        qCapTab.onclick = () => this.switchTab('qcapability', qCapTab, [powerTab, ratingTab, shortCircuitTab, advancedTab, harmonicTab, economicTab], qCapContent, [powerContent, ratingContent, shortCircuitContent, advancedContent, harmonicContent, economicContent]);
        economicTab.onclick = () => this.switchTab('economic', economicTab, [powerTab, ratingTab, shortCircuitTab, advancedTab, harmonicTab, qCapTab], economicContent, [powerContent, ratingContent, shortCircuitContent, advancedContent, harmonicContent, qCapContent]);

        // Show dialog using DrawIO's dialog system
        if (this.ui && typeof this.ui.showDialog === 'function') {
            const screenHeight = window.innerHeight - 80;
            this.ui.showDialog(container, 1000, screenHeight, true, false);
        } else {
            this.showModalFallback(container);
        }
    }
    
    createTab(title, tabId, isActive) {
        const tab = document.createElement('div');
        Object.assign(tab.style, {
            padding: '12px 20px',
            cursor: 'pointer',
            borderBottom: isActive ? '2px solid #007bff' : '2px solid transparent',
            backgroundColor: isActive ? '#f8f9fa' : 'transparent',
            color: isActive ? '#007bff' : '#6c757d',
            fontWeight: isActive ? '600' : '400',
            transition: 'all 0.2s ease',
            userSelect: 'none'
        });
        tab.textContent = title;
        tab.dataset.tab = tabId;
        
        tab.addEventListener('mouseenter', () => {
            if (!tab.classList.contains('active')) {
                tab.style.backgroundColor = '#f8f9fa';
            }
        });
        
        tab.addEventListener('mouseleave', () => {
            if (!tab.classList.contains('active')) {
                tab.style.backgroundColor = 'transparent';
            }
        });
        
        if (isActive) {
            tab.classList.add('active');
        }
        
        return tab;
    }
    
    createTabContent(tabId, parameters) {
        if (tabId === 'economic' && parameters.length > 0 && parameters[0]?.id === 'cost_per_unit_by_currency') {
            const content = document.createElement('div');
            content.dataset.tab = tabId;
            content.style.display = tabId === this.currentTab ? 'block' : 'none';
            content.appendChild(createEconomicTabContent(buildCostPerUnitByCurrency(this.data), this.inputs, true));
            return content;
        }

        const content = document.createElement('div');
        content.dataset.tab = tabId;
        Object.assign(content.style, {
            display: tabId === this.currentTab ? 'block' : 'none'
        });

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        parameters.forEach(param => {
            const parameterRow = document.createElement('div');
            const isTextarea = param.type === 'textarea';
            const isTriHarm = param.type === 'harmonicSpectrumTriState';
            Object.assign(parameterRow.style, {
                display: 'grid',
                gridTemplateColumns: isTextarea ? '1fr' : (isTriHarm ? '1fr minmax(300px, 1.25fr)' : '1fr 200px'),
                gap: '20px',
                alignItems: 'start',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                minHeight: isTextarea ? '120px' : '80px'
            });

            // Left column: Label and description
            const leftColumn = document.createElement('div');
            Object.assign(leftColumn.style, {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '60px'
            });

            const label = document.createElement('label');
            Object.assign(label.style, {
                fontWeight: '600',
                fontSize: '14px',
                color: '#495057',
                marginBottom: '6px',
                lineHeight: '1.2'
            });
            label.textContent = param.label;
            label.htmlFor = isTriHarm ? param.triStateModeSelectId : param.id;

            const description = document.createElement('div');
            Object.assign(description.style, {
                fontSize: '12px',
                color: '#6c757d',
                lineHeight: '1.4',
                fontStyle: 'italic',
                marginBottom: '4px'
            });
            if (param.description && param.description.includes('<a ')) {
                description.innerHTML = param.description;
            } else {
                description.textContent = param.description;
            }

            leftColumn.appendChild(label);
            leftColumn.appendChild(description);

            // Right column: Input field with fixed width
            const rightColumn = document.createElement('div');
            if (isTriHarm) {
                Object.assign(rightColumn.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'flex-start',
                    gap: '10px',
                    minHeight: '60px',
                    width: '100%'
                });
            } else {
                Object.assign(rightColumn.style, {
                    display: 'flex',
                    alignItems: isTextarea ? 'stretch' : 'center',
                    justifyContent: isTextarea ? 'stretch' : 'flex-end',
                    minHeight: '60px',
                    width: isTextarea ? '100%' : '200px'
                });
            }
            
            let input;
            
            // Handle different input types
            if (param.type === 'harmonicSpectrumTriState') {
                mountHarmonicSpectrumTriState(param, rightColumn, this.inputs, {
                    modeSelectId: param.triStateModeSelectId,
                    defaultSpectrum: param.defaultSpectrum,
                    spectrumCsvInputId: param.spectrumCsvInputId,
                    textareaRows: param.rows
                });
                parameterRow.appendChild(leftColumn);
                parameterRow.appendChild(rightColumn);
                form.appendChild(parameterRow);
                return;
            }
            if (param.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = param.value;
                Object.assign(input.style, {
                    width: '24px',
                    height: '24px',
                    accentColor: '#007bff',
                    cursor: 'pointer',
                    margin: '0'
                });
            } else if (param.type === 'select') {
                input = document.createElement('select');
                param.options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    if (param.id === 'curve_style') {
                        optionElement.textContent = option === 'straightLineYValues'
                            ? 'Straight line between points'
                            : 'Constant Q to next P point';
                    } else {
                        optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
                    }
                    if (option === param.value) {
                        optionElement.selected = true;
                    }
                    input.appendChild(optionElement);
                });
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    cursor: 'pointer'
                });
            } else if (param.type === 'textarea') {
                input = document.createElement('textarea');
                input.value = param.value || '';
                input.rows = param.rows || 6;
                Object.assign(input.style, {
                    width: '100%',
                    minHeight: '140px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'Consolas, monospace',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                });
            } else {
                input = document.createElement('input');
                input.type = param.type;
                input.value = param.value;
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                });
                
                input.addEventListener('focus', () => {
                    input.style.borderColor = '#007bff';
                    input.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
                    input.style.transform = 'translateY(-1px)';
                });
                
                input.addEventListener('blur', () => {
                    input.style.borderColor = '#ced4da';
                    input.style.boxShadow = 'none';
                    input.style.transform = 'translateY(0)';
                });
                
                // Add hover effect
                input.addEventListener('mouseenter', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#adb5bd';
                        input.style.backgroundColor = '#f8f9fa';
                    }
                });
                
                input.addEventListener('mouseleave', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#ced4da';
                        input.style.backgroundColor = '#ffffff';
                    }
                });
            }
            
            // Set additional attributes for number inputs
            if (param.type === 'number') {
                if (param.step) input.step = param.step;
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
            }

            input.id = param.id;
            this.inputs.set(param.id, input);

            if (isTextarea) {
                parameterRow.appendChild(leftColumn);
                rightColumn.appendChild(input);
                parameterRow.appendChild(rightColumn);
            } else {
                rightColumn.appendChild(input);
                parameterRow.appendChild(leftColumn);
                parameterRow.appendChild(rightColumn);
            }
            form.appendChild(parameterRow);
        });

        content.appendChild(form);
        return content;
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
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = hoverColor;
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = bgColor;
        });
        
        return button;
    }
    
    switchTab(tabId, activeTab, inactiveTabs, activeContent, inactiveContents) {
        this.currentTab = tabId;
        
        // Update active tab styles
        Object.assign(activeTab.style, {
            borderBottom: '2px solid #007bff',
            backgroundColor: '#f8f9fa',
            color: '#007bff',
            fontWeight: '600'
        });
        activeTab.classList.add('active');
        
        // Update inactive tab styles
        inactiveTabs.forEach(inactiveTab => {
            Object.assign(inactiveTab.style, {
                borderBottom: '2px solid transparent',
                backgroundColor: 'transparent',
                color: '#6c757d',
                fontWeight: '400'
            });
            inactiveTab.classList.remove('active');
        });
        
        // Update content visibility
        activeContent.style.display = 'block';
        inactiveContents.forEach(inactiveContent => {
            inactiveContent.style.display = 'none';
        });
    }
    
    getFormValues() {
        const values = {};
        
        // Collect all parameter values from all tabs
        [...this.powerParameters, ...this.ratingParameters, ...this.shortCircuitParameters, ...this.advancedParameters,
            ...(this.harmonicParameters || []), ...(this.qCapabilityParameters || []), ...(this.economicParameters || [])].forEach(param => {
            if (param.type === 'harmonicSpectrumTriState') {
                if (this.inputs.get(param.triStateModeSelectId)) {
                    Object.assign(values, valuesFromHarmonicSpectrumTriState(this.inputs, {
                        modeSelectId: param.triStateModeSelectId,
                        defaultSpectrum: param.defaultSpectrum,
                        spectrumCsvInputId: param.spectrumCsvInputId
                    }));
                }
                return;
            }
            const input = this.inputs.get(param.id);
            if (input) {
                if (param.id === 'cost_per_unit_by_currency') {
                    values[param.id] = input.value || '0';
                } else if (param.type === 'number') {
                    values[param.id] = parseFloat(input.value) || 0;
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else if (param.type === 'select') {
                    values[param.id] = input.value;
                } else if (param.type === 'textarea') {
                    values[param.id] = input.value;
                } else {
                    values[param.id] = input.value;
                }
            }
        });
        
        return values;
    }
    
    destroy() {
        this._qCapabilityChartRedraw = null;
        this._qcapTemplateBasePoints = null;
        this._qcapTemplatePRatedMw = null;
        this._qcapTemplateSnBase = null;
        this._qcapProgrammaticJsonUpdate = false;
        // Call parent destroy method
        super.destroy();
        
        // Clear global dialog flags to allow future dialogs
        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
        
        console.log('Static Generator dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== StaticGeneratorDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.powerParameters, ...this.ratingParameters, ...this.shortCircuitParameters, ...this.advancedParameters,
            ...(this.harmonicParameters || []), ...(this.qCapabilityParameters || [])].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        // Update parameter values based on cell data
        if (cellData && cellData.attributes) {
            console.log(`Found ${cellData.attributes.length} attributes to process`);
            
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                console.log(`Processing attribute: ${attributeName} = ${attributeValue}`);
                
                // Update the dialog's parameter values (not DOM inputs)
                const powerParam = this.powerParameters.find(p => p.id === attributeName);
                if (powerParam) {
                    const oldValue = powerParam.value;
                    if (powerParam.type === 'checkbox') {
                        powerParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        powerParam.value = attributeValue;
                    }
                    console.log(`  Updated power ${attributeName}: ${oldValue} → ${powerParam.value}`);
                }
                
                const ratingParam = this.ratingParameters.find(p => p.id === attributeName);
                if (ratingParam) {
                    const oldValue = ratingParam.value;
                    if (ratingParam.type === 'checkbox') {
                        ratingParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        ratingParam.value = attributeValue;
                    }
                    console.log(`  Updated rating ${attributeName}: ${oldValue} → ${ratingParam.value}`);
                }
                
                const shortCircuitParam = this.shortCircuitParameters.find(p => p.id === attributeName);
                if (shortCircuitParam) {
                    const oldValue = shortCircuitParam.value;
                    if (shortCircuitParam.type === 'checkbox') {
                        shortCircuitParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        shortCircuitParam.value = attributeValue;
                    }
                    console.log(`  Updated shortCircuit ${attributeName}: ${oldValue} → ${shortCircuitParam.value}`);
                }
                
                const advancedParam = this.advancedParameters.find(p => p.id === attributeName);
                if (advancedParam) {
                    const oldValue = advancedParam.value;
                    if (advancedParam.type === 'checkbox') {
                        advancedParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        advancedParam.value = attributeValue;
                    }
                    console.log(`  Updated advanced ${attributeName}: ${oldValue} → ${advancedParam.value}`);
                }

                const harmonicParam = (this.harmonicParameters || []).find(p => p.id === attributeName);
                if (harmonicParam && harmonicParam.type !== 'harmonicSpectrumTriState') {
                    harmonicParam.value = attributeValue != null ? String(attributeValue) : harmonicParam.value;
                }

                if (attributeName === 'spectrum' || attributeName === 'spectrum_csv') {
                    if (attributeName === 'spectrum') {
                        this.data.spectrum = attributeValue != null ? String(attributeValue) : this.data.spectrum;
                    }
                    if (attributeName === 'spectrum_csv') {
                        this.data.spectrum_csv = attributeValue != null ? String(attributeValue) : (this.data.spectrum_csv || '');
                    }
                    const tri = (this.harmonicParameters || []).find(p => p.type === 'harmonicSpectrumTriState');
                    if (tri) {
                        if (attributeName === 'spectrum') tri.spectrumValue = this.data.spectrum;
                        if (attributeName === 'spectrum_csv') tri.csvValue = this.data.spectrum_csv;
                    }
                }

                const qCapParam = (this.qCapabilityParameters || []).find(p => p.id === attributeName);
                if (qCapParam) {
                    const oldValue = qCapParam.value;
                    if (qCapParam.type === 'checkbox') {
                        qCapParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        qCapParam.value = attributeValue != null ? String(attributeValue) : qCapParam.value;
                    }
                    console.log(`  Updated qCapability ${attributeName}: ${oldValue} → ${qCapParam.value}`);
                }
                
                const economicParam = (this.economicParameters || []).find(p => p.id === attributeName);
                if (economicParam) {
                    economicParam.value = attributeValue;
                    this.data[attributeName] = attributeValue;
                    console.log(`  Updated economic ${attributeName}: → ${attributeValue}`);
                }
                
                if (!powerParam && !ratingParam && !shortCircuitParam && !advancedParam && !harmonicParam && !qCapParam && !economicParam
                    && attributeName !== 'spectrum' && attributeName !== 'spectrum_csv') {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.powerParameters, ...this.ratingParameters, ...this.shortCircuitParameters, ...this.advancedParameters,
            ...(this.harmonicParameters || []), ...(this.qCapabilityParameters || [])].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });

        syncHarmonicSpectrumTriStateFromDialogData(this.inputs, this.harmonicParameters, this.data);
        
        console.log('=== StaticGeneratorDialog.populateDialog completed ===');
    }

    _setQCapabilityJsonProgrammatically(textarea, jsonStr) {
        this._qcapProgrammaticJsonUpdate = true;
        textarea.value = jsonStr;
        this._qcapProgrammaticJsonUpdate = false;
    }

    _tryAttachQCapabilityTemplateFromJsonString(raw) {
        const sorted = parseSortedQCapabilityPoints(raw);
        if (!sorted) return false;
        const m = matchBuiltInQCapabilityTemplate(sorted);
        if (!m) return false;
        this._qcapTemplateBasePoints = m.basePoints;
        this._qcapTemplatePRatedMw = m.pRatedMw;
        this._qcapTemplateSnBase = m.snBase;
        return true;
    }

    /**
     * If Q curve is on, ensure built-in preset shape is bound (from JSON) then rescale P/Q to Active power (MW).
     */
    _syncQcapCurveToActivePowerIfPossible() {
        const cb = this.inputs.get('reactive_capability_curve');
        if (!cb || !cb.checked) return;
        const ta = this.inputs.get('q_capability_curve_json');
        if (!this._qcapTemplateBasePoints) {
            if (!ta || !this._tryAttachQCapabilityTemplateFromJsonString(ta.value)) return;
        }
        this._applyQCapabilityScalingFromTemplate();
    }

    /**
     * Writes scaled Q-capability JSON and optional sn_mva from stored template knots.
     */
    _applyQCapabilityScalingFromTemplate() {
        if (!this._qcapTemplateBasePoints || this._qcapTemplatePRatedMw == null || this._qcapTemplatePRatedMw <= 0) {
            return;
        }
        const ta = this.inputs.get('q_capability_curve_json');
        const pIn = this.inputs.get('p_mw');
        const snIn = this.inputs.get('sn_mva');
        if (!ta) return;

        let targetP = parseFloat(pIn && pIn.value);
        if (!Number.isFinite(targetP) || targetP <= 0) {
            targetP = this._qcapTemplatePRatedMw;
        }
        const scale = targetP / this._qcapTemplatePRatedMw;
        const scaled = scaleQCapabilityPointsForPlantRating(this._qcapTemplateBasePoints, scale);
        if (scaled.length < 2) return;

        this._setQCapabilityJsonProgrammatically(ta, JSON.stringify(scaled));

        if (snIn && Number.isFinite(this._qcapTemplateSnBase) && this._qcapTemplateSnBase > 0) {
            const sn = this._qcapTemplateSnBase * scale;
            snIn.value = String(Math.round(sn * 10000) / 10000);
        }

        if (typeof this._qCapabilityChartRedraw === 'function') {
            this._qCapabilityChartRedraw();
        }
    }

    /**
     * P–Q chart above the Q capability form; redrawn from JSON textarea and curve style.
     */
    _mountQCapabilityChartPanel(parentEl, insertBeforeEl) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            margin: '0 0 8px 0',
            padding: '14px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #e9ecef',
            borderRadius: '8px'
        });
        const title = document.createElement('div');
        title.textContent = 'P–Q capability preview';
        Object.assign(title.style, { fontWeight: '600', fontSize: '14px', color: '#495057', marginBottom: '4px' });
        const sub = document.createElement('div');
        Object.assign(sub.style, { fontSize: '11px', color: '#6c757d', marginBottom: '8px', lineHeight: '1.4' });
        sub.textContent =
            'Allowable reactive band (Qmin … Qmax) vs active power P from the curve points. ' +
            'For built-in templates, the plot updates as you change Active power (MW) on the Power tab (with Q curve enabled).';
        const status = document.createElement('div');
        Object.assign(status.style, { fontSize: '12px', color: '#c62828', minHeight: '20px', marginBottom: '6px' });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 580 320');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        Object.assign(svg.style, { width: '100%', maxHeight: '300px', display: 'block' });
        wrap.appendChild(title);
        wrap.appendChild(sub);
        wrap.appendChild(status);
        wrap.appendChild(svg);
        parentEl.insertBefore(wrap, insertBeforeEl);

        const redraw = () => this._redrawQCapabilityChartSvg(svg, status);
        this._qCapabilityChartRedraw = redraw;

        const ta = this.inputs.get('q_capability_curve_json');
        const styleSel = this.inputs.get('curve_style');
        let debounceT = null;
        const schedule = () => {
            if (debounceT) clearTimeout(debounceT);
            debounceT = setTimeout(() => {
                debounceT = null;
                redraw();
            }, 200);
        };
        if (ta) {
            ta.addEventListener('input', () => {
                if (!this._qcapProgrammaticJsonUpdate) {
                    this._qcapTemplateBasePoints = null;
                    this._qcapTemplatePRatedMw = null;
                    this._qcapTemplateSnBase = null;
                }
                schedule();
            });
            ta.addEventListener('change', redraw);
        }
        if (styleSel) {
            styleSel.addEventListener('change', redraw);
        }
        redraw();
    }

    _redrawQCapabilityChartSvg(svg, statusEl) {
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        statusEl.textContent = '';
        statusEl.style.color = '#c62828';

        const ta = this.inputs.get('q_capability_curve_json');
        const styleSel = this.inputs.get('curve_style');
        const raw = ta ? ta.value.trim() : '';

        let points;
        try {
            points = JSON.parse(raw);
        } catch {
            statusEl.textContent = 'Invalid JSON — fix the curve text to see the chart.';
            return;
        }
        if (!Array.isArray(points) || points.length < 2) {
            statusEl.textContent = 'Enter at least two points to plot the characteristic.';
            return;
        }

        const parsed = [];
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            if (!pt || typeof pt !== 'object') continue;
            const p = Number(pt.p_mw);
            const qmin = Number(pt.q_min_mvar);
            const qmax = Number(pt.q_max_mvar);
            if (!Number.isFinite(p) || !Number.isFinite(qmin) || !Number.isFinite(qmax)) continue;
            parsed.push({ p_mw: p, q_min_mvar: qmin, q_max_mvar: qmax });
        }
        if (parsed.length < 2) {
            statusEl.textContent = 'Need at least two valid objects with p_mw, q_min_mvar, q_max_mvar.';
            return;
        }
        parsed.sort((a, b) => a.p_mw - b.p_mw);

        const curveStyle = styleSel && styleSel.value === 'constantYValue' ? 'constantYValue' : 'straightLineYValues';
        const upper = expandQCapabilityPolyline(parsed, 'q_max_mvar', curveStyle);
        const lower = expandQCapabilityPolyline(parsed, 'q_min_mvar', curveStyle);

        let pMin = parsed[0].p_mw;
        let pMax = parsed[parsed.length - 1].p_mw;
        let qMin = parsed[0].q_min_mvar;
        let qMax = parsed[0].q_max_mvar;
        for (let i = 0; i < parsed.length; i++) {
            qMin = Math.min(qMin, parsed[i].q_min_mvar);
            qMax = Math.max(qMax, parsed[i].q_max_mvar);
        }
        const pPad = Math.max(0.5, (pMax - pMin) * 0.06) || 1;
        const qPad = Math.max(0.25, (qMax - qMin) * 0.08) || 0.5;
        pMin -= pPad;
        pMax += pPad;
        qMin -= qPad;
        qMax += qPad;
        if (pMax <= pMin) pMax = pMin + 1;
        if (qMax <= qMin) qMax = qMin + 0.1;

        const W = 580;
        const H = 320;
        const ml = 52;
        const mr = 28;
        const mt = 24;
        const mb = 48;
        const pw = W - ml - mr;
        const ph = H - mt - mb;

        const xOf = (p) => ml + ((p - pMin) / (pMax - pMin)) * pw;
        const yOf = (q) => mt + ph - ((q - qMin) / (qMax - qMin)) * ph;

        const add = (el) => svg.appendChild(el);

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', String(ml));
        bg.setAttribute('y', String(mt));
        bg.setAttribute('width', String(pw));
        bg.setAttribute('height', String(ph));
        bg.setAttribute('fill', '#f8f9fa');
        bg.setAttribute('stroke', '#dee2e6');
        add(bg);

        const gridN = 5;
        for (let g = 0; g <= gridN; g++) {
            const gx = ml + (g / gridN) * pw;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(gx));
            line.setAttribute('x2', String(gx));
            line.setAttribute('y1', String(mt));
            line.setAttribute('y2', String(mt + ph));
            line.setAttribute('stroke', '#e9ecef');
            line.setAttribute('stroke-width', '1');
            add(line);
        }
        for (let g = 0; g <= gridN; g++) {
            const gy = mt + (g / gridN) * ph;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(ml));
            line.setAttribute('x2', String(ml + pw));
            line.setAttribute('y1', String(gy));
            line.setAttribute('y2', String(gy));
            line.setAttribute('stroke', '#e9ecef');
            line.setAttribute('stroke-width', '1');
            add(line);
        }

        const polyPts = [];
        for (let i = 0; i < upper.length; i++) {
            polyPts.push(`${xOf(upper[i][0]).toFixed(1)},${yOf(upper[i][1]).toFixed(1)}`);
        }
        for (let i = lower.length - 1; i >= 0; i--) {
            polyPts.push(`${xOf(lower[i][0]).toFixed(1)},${yOf(lower[i][1]).toFixed(1)}`);
        }
        const band = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        band.setAttribute('points', polyPts.join(' '));
        band.setAttribute('fill', 'rgba(13, 71, 161, 0.12)');
        band.setAttribute('stroke', 'none');
        add(band);

        const lineUpper = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        lineUpper.setAttribute('fill', 'none');
        lineUpper.setAttribute('stroke', '#0d47a1');
        lineUpper.setAttribute('stroke-width', '2.5');
        lineUpper.setAttribute('points', upper.map(([p, q]) => `${xOf(p).toFixed(1)},${yOf(q).toFixed(1)}`).join(' '));
        add(lineUpper);

        const lineLower = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        lineLower.setAttribute('fill', 'none');
        lineLower.setAttribute('stroke', '#e65100');
        lineLower.setAttribute('stroke-width', '2.5');
        lineLower.setAttribute('points', lower.map(([p, q]) => `${xOf(p).toFixed(1)},${yOf(q).toFixed(1)}`).join(' '));
        add(lineLower);

        for (let i = 0; i < parsed.length; i++) {
            const cx = xOf(parsed[i].p_mw);
            const cyMax = yOf(parsed[i].q_max_mvar);
            const cyMin = yOf(parsed[i].q_min_mvar);
            [cyMax, cyMin].forEach((cy) => {
                const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                c.setAttribute('cx', String(cx.toFixed(1)));
                c.setAttribute('cy', String(cy.toFixed(1)));
                c.setAttribute('r', '4');
                c.setAttribute('fill', '#fff');
                c.setAttribute('stroke', '#495057');
                c.setAttribute('stroke-width', '1.5');
                add(c);
            });
        }

        const xAx = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAx.setAttribute('x1', String(ml));
        xAx.setAttribute('x2', String(ml + pw));
        xAx.setAttribute('y1', String(mt + ph));
        xAx.setAttribute('y2', String(mt + ph));
        xAx.setAttribute('stroke', '#495057');
        xAx.setAttribute('stroke-width', '1.5');
        add(xAx);

        const yAx = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAx.setAttribute('x1', String(ml));
        yAx.setAttribute('x2', String(ml));
        yAx.setAttribute('y1', String(mt));
        yAx.setAttribute('y2', String(mt + ph));
        yAx.setAttribute('stroke', '#495057');
        yAx.setAttribute('stroke-width', '1.5');
        add(yAx);

        const xl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        xl.setAttribute('x', String(ml + pw / 2));
        xl.setAttribute('y', String(H - 12));
        xl.setAttribute('text-anchor', 'middle');
        xl.setAttribute('font-size', '12');
        xl.setAttribute('fill', '#495057');
        xl.textContent = 'P [MW]';
        add(xl);

        const yl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        yl.setAttribute('x', String(14));
        yl.setAttribute('y', String(mt + ph / 2));
        yl.setAttribute('text-anchor', 'middle');
        yl.setAttribute('font-size', '12');
        yl.setAttribute('fill', '#495057');
        yl.setAttribute('transform', `rotate(-90 14 ${mt + ph / 2})`);
        yl.textContent = 'Q [MVAr]';
        add(yl);

        const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
        for (let g = 0; g <= gridN; g++) {
            const pv = pMin + (g / gridN) * (pMax - pMin);
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', String(xOf(pv)));
            t.setAttribute('y', String(mt + ph + 22));
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('font-size', '10');
            t.setAttribute('fill', '#6c757d');
            t.textContent = fmt(pv);
            add(t);
        }
        for (let g = 0; g <= gridN; g++) {
            const qv = qMin + (g / gridN) * (qMax - qMin);
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', String(ml - 8));
            t.setAttribute('y', String(yOf(qv) + 4));
            t.setAttribute('text-anchor', 'end');
            t.setAttribute('font-size', '10');
            t.setAttribute('fill', '#6c757d');
            t.textContent = fmt(qv);
            add(t);
        }

        const leg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        leg.setAttribute('x', String(ml + pw - 4));
        leg.setAttribute('y', String(mt + 14));
        leg.setAttribute('text-anchor', 'end');
        leg.setAttribute('font-size', '10');
        leg.setAttribute('fill', '#6c757d');
        leg.textContent = curveStyle === 'constantYValue' ? 'Style: steps' : 'Style: linear segments';
        add(leg);

        statusEl.style.color = '#2e7d32';
        statusEl.textContent = `${parsed.length} knot(s) — blue: Qmax, orange: Qmin`;
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsStaticGenerator = [defaultStaticGeneratorData];

export const columnDefsStaticGenerator = [  
    {
        field: "name",
        headerTooltip: "Name of the static generator",
        maxWidth: 150
    },
    {
        field: "p_mw",
        headerTooltip: "The active power of the static generator (positive for generation!)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "q_mvar",
        headerTooltip: "The reactive power of the static generator",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "sn_mva",
        headerTooltip: "Nominal power of the static generator",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "scaling",
        headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplies with p_mw and q_mvar",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "type",
        headerTooltip: "Type of generator connection",
        maxWidth: 120
    },
    {
        field: "k",
        headerTooltip: "Ratio of nominal current to short circuit current",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "rx",
        headerTooltip: "R/X ratio for short circuit impedance. Only relevant if type is specified as motor so that sgen is treated as asynchronous motor.",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "generator_type",
        headerTooltip: 'Can be one of "current_source" (full size converter), "async" (asynchronous generator), or "async_doubly_fed" (doubly fed asynchronous generator, DFIG).',
        maxWidth: 160
    },
    {
        field: "lrc_pu",
        headerTooltip: 'Locked rotor current in relation to the rated generator current. Relevant if the generator_type is "async".',
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "max_ik_ka",
        headerTooltip: 'The highest instantaneous short-circuit value in case of a three-phase short-circuit (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
        maxWidth: 160,
        valueParser: 'numberParser'
    },
    {
        field: "kappa",
        headerTooltip: 'The factor for the calculation of the peak short-circuit current, referred to the high-voltage side (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
        maxWidth: 160,
        valueParser: 'numberParser'
    },
    {
        field: "current_source",
        headerTooltip: "Model this sgen as a current source during short-circuit calculations; useful in some cases, for example the simulation of full-size converters per IEC 60909-0:2016.",
        maxWidth: 140
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the static generator is in service (True/False)",
        maxWidth: 100
    },
    {
        field: "reactive_capability_curve",
        headerTooltip: "pandapower: use Q capability curve (P vs Qmin/Qmax) when enforce_q_lims applies",
        maxWidth: 120
    },
    {
        field: "curve_style",
        headerTooltip: "straightLineYValues or constantYValue (pandapower sgen)",
        maxWidth: 140
    },
    {
        field: "q_capability_curve_json",
        headerTooltip: "JSON array of {p_mw, q_min_mvar, q_max_mvar}. Dialog presets: ±0.95 PF or offshore wind turbine 1·Un digitized curve.",
        maxWidth: 200
    }
];
  
export const gridOptionsStaticGenerator = {
    columnDefs: columnDefsStaticGenerator,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsStaticGenerator,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsStaticGenerator = gridOptionsStaticGenerator;
globalThis.rowDefsStaticGenerator = rowDefsStaticGenerator;
globalThis.columnDefsStaticGenerator = columnDefsStaticGenerator;
globalThis.StaticGeneratorDialog = StaticGeneratorDialog;
  
  
  
  