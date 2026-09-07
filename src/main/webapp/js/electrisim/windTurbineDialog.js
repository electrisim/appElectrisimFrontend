/**
 * Wind Turbine dialog — Static Generator plus wind-speed → P(v) power curve.
 * Active power for load flow is always interpolated from the curve at wind_speed_ms.
 * Power-curve UI: editable table + live plot (PowerFactory-style).
 */
import {
    StaticGeneratorDialog,
    defaultStaticGeneratorData
} from './staticGeneratorDialog.js';
import {
    defaultQCap2dState,
    loadQCap2dFromAttrs,
    serializeQCap2d,
    flattenQCap2dToPqPoints,
    interpQCap2dMvar,
    insertAxisValue,
    insertMatrixColumn,
    insertMatrixRow,
    oneDCurveTo2d,
    QCAP_PLOT_COLORS
} from './utils/qCapabilityVoltageDependent.js';

const WIND_Q_SETPOINT_MODE_OPTIONS = [
    { value: 'manual', label: 'Manual (Power tab)' },
    { value: 'capacitive_max', label: 'Capacitive max (Qmax from capability curve)' },
    { value: 'inductive_max', label: 'Inductive max (Qmin from capability curve)' }
];

/** Default rated power (MW) for the built-in power curve (~2.5 MW class as in typical WTG libraries). */
export const WIND_POWER_CURVE_DEFAULT_RATED_MW = 2.5;

function clonePts(pts) {
    return pts.map((pt) => ({ ...pt }));
}

/**
 * Representative manufacturer-style P(v) for a ~2.5 MW onshore wind turbine
 * (cut-in ~3 m/s, rated ~15–17 m/s, cut-out ~25 m/s). Replace with OEM data when available.
 */
export const windPowerCurve2p5MwOnshorePoints = [
    { v_ms: 0, p_mw: 0 },
    { v_ms: 1, p_mw: 0 },
    { v_ms: 2, p_mw: 0 },
    { v_ms: 3, p_mw: 0 },
    { v_ms: 3.01, p_mw: 0.01 },
    { v_ms: 4, p_mw: 0.03 },
    { v_ms: 5, p_mw: 0.1 },
    { v_ms: 6, p_mw: 0.2 },
    { v_ms: 7, p_mw: 0.3 },
    { v_ms: 8, p_mw: 0.5 },
    { v_ms: 9, p_mw: 0.8 },
    { v_ms: 10, p_mw: 1.15 },
    { v_ms: 11, p_mw: 1.5 },
    { v_ms: 12, p_mw: 1.85 },
    { v_ms: 13, p_mw: 2.1 },
    { v_ms: 14, p_mw: 2.3 },
    { v_ms: 15, p_mw: 2.4 },
    { v_ms: 16, p_mw: 2.45 },
    { v_ms: 17, p_mw: 2.5 },
    { v_ms: 18, p_mw: 2.5 },
    { v_ms: 20, p_mw: 2.5 },
    { v_ms: 22, p_mw: 2.5 },
    { v_ms: 25, p_mw: 2.5 },
    { v_ms: 25.01, p_mw: 0 },
    { v_ms: 30, p_mw: 0 }
];

/**
 * Representative P(v) for a ~3.3 MW onshore wind turbine (same class as 2.5 MW:
 * cut-in ~3 m/s, rated ~14–16 m/s, cut-out ~25 m/s). Generic library shape — replace with OEM data.
 */
export const windPowerCurve3p3MwOnshorePoints = [
    { v_ms: 0, p_mw: 0 },
    { v_ms: 1, p_mw: 0 },
    { v_ms: 2, p_mw: 0 },
    { v_ms: 3, p_mw: 0 },
    { v_ms: 3.01, p_mw: 0.02 },
    { v_ms: 4, p_mw: 0.05 },
    { v_ms: 5, p_mw: 0.15 },
    { v_ms: 6, p_mw: 0.3 },
    { v_ms: 7, p_mw: 0.5 },
    { v_ms: 8, p_mw: 0.75 },
    { v_ms: 9, p_mw: 1.1 },
    { v_ms: 10, p_mw: 1.55 },
    { v_ms: 11, p_mw: 2.05 },
    { v_ms: 12, p_mw: 2.5 },
    { v_ms: 13, p_mw: 2.85 },
    { v_ms: 14, p_mw: 3.1 },
    { v_ms: 15, p_mw: 3.25 },
    { v_ms: 16, p_mw: 3.3 },
    { v_ms: 18, p_mw: 3.3 },
    { v_ms: 20, p_mw: 3.3 },
    { v_ms: 22, p_mw: 3.3 },
    { v_ms: 25, p_mw: 3.3 },
    { v_ms: 25.01, p_mw: 0 },
    { v_ms: 30, p_mw: 0 }
];

/**
 * Representative P(v) for a ~15 MW offshore wind turbine (Type IV):
 * cut-in ~3 m/s, rated ~11–12 m/s, cut-out ~25 m/s. Generic library shape — replace with OEM data.
 */
export const windPowerCurve15MwOffshorePoints = [
    { v_ms: 0, p_mw: 0 },
    { v_ms: 1, p_mw: 0 },
    { v_ms: 2, p_mw: 0 },
    { v_ms: 3, p_mw: 0 },
    { v_ms: 3.01, p_mw: 0.05 },
    { v_ms: 4, p_mw: 0.25 },
    { v_ms: 5, p_mw: 0.7 },
    { v_ms: 6, p_mw: 1.4 },
    { v_ms: 7, p_mw: 2.5 },
    { v_ms: 8, p_mw: 4.0 },
    { v_ms: 9, p_mw: 6.0 },
    { v_ms: 10, p_mw: 8.5 },
    { v_ms: 11, p_mw: 11.5 },
    { v_ms: 12, p_mw: 14.0 },
    { v_ms: 13, p_mw: 14.8 },
    { v_ms: 14, p_mw: 15.0 },
    { v_ms: 16, p_mw: 15.0 },
    { v_ms: 18, p_mw: 15.0 },
    { v_ms: 20, p_mw: 15.0 },
    { v_ms: 22, p_mw: 15.0 },
    { v_ms: 25, p_mw: 15.0 },
    { v_ms: 25.01, p_mw: 0 },
    { v_ms: 30, p_mw: 0 }
];

/** @deprecated Use windPowerCurve2p5MwOnshorePoints — kept for existing imports. */
export const defaultWindPowerCurvePoints = windPowerCurve2p5MwOnshorePoints;

export const defaultWindPowerCurveJson = JSON.stringify(windPowerCurve2p5MwOnshorePoints);

/** Built-in P(v) templates shown on the Wind Power Curve panel. */
export const WIND_POWER_CURVE_TEMPLATES = [
    {
        id: 'onshore_2p5',
        label: '2.5 MW onshore',
        ratedMw: 2.5,
        snMva: 2.5,
        points: windPowerCurve2p5MwOnshorePoints
    },
    {
        id: 'onshore_3p3',
        label: '3.3 MW onshore',
        ratedMw: 3.3,
        snMva: 3.3,
        points: windPowerCurve3p3MwOnshorePoints
    },
    {
        id: 'offshore_15',
        label: '15 MW offshore',
        ratedMw: 15,
        snMva: 16.5,
        points: windPowerCurve15MwOffshorePoints
    }
];

/** ±0.95 PF vs P at 15 MW (same knots as Static Generator template). */
const qCapPf095Points15Mw = [
    { p_mw: 0, q_min_mvar: 0, q_max_mvar: 0 },
    { p_mw: 3.75, q_min_mvar: -1.23, q_max_mvar: 1.23 },
    { p_mw: 7.5, q_min_mvar: -2.47, q_max_mvar: 2.47 },
    { p_mw: 11.25, q_min_mvar: -3.7, q_max_mvar: 3.7 },
    { p_mw: 15, q_min_mvar: -4.93, q_max_mvar: 4.93 }
];

/** Digitized 1·Un P–Q envelope for a 15 MW offshore WTG (MW / MVAr). */
const qCapOffshore1UnPoints15Mw = [
    { p_mw: 0, q_min_mvar: -16.5, q_max_mvar: 16.5 },
    { p_mw: 2.5, q_min_mvar: -16.2, q_max_mvar: 16.3 },
    { p_mw: 5, q_min_mvar: -15.5, q_max_mvar: 16.0 },
    { p_mw: 7.5, q_min_mvar: -14.5, q_max_mvar: 15.2 },
    { p_mw: 10, q_min_mvar: -12.8, q_max_mvar: 13.8 },
    { p_mw: 12.5, q_min_mvar: -10.5, q_max_mvar: 11.5 },
    { p_mw: 15, q_min_mvar: -6.5, q_max_mvar: 6.5 }
];

/** Built-in P–U / P–Q capability templates on the Q capability tab (stored in p.u. of Sn). */
export const WIND_Q_CAPABILITY_TEMPLATES = [
    {
        id: 'frc_2d',
        label: 'FRC WTG P–U (voltage-dependent)',
        description:
            'PowerFactory Fully Rated Converter WTG 2.5MW 50Hz Q(P,U) matrices. Stored in p.u. of Sn. Q=0 at P=0.',
        apply: () => defaultQCap2dState()
    },
    {
        id: 'pf095_1d',
        label: '±0.95 PF vs P (1D, U = 1.0 p.u.)',
        description:
            '|Q| ≈ P·tan(arccos(0.95)) at each P. Single voltage row (U = 1.0 p.u.). Same shape as the Static Generator 15 MW template, scaled to this turbine Sn.',
        apply: () => {
            const from1d = oneDCurveTo2d(qCapPf095Points15Mw, 15);
            if (!from1d) return defaultQCap2dState();
            return { ...defaultQCap2dState(), ...from1d, voltageDependent: false, inputModel: 'pu' };
        }
    },
    {
        id: 'offshore_1un',
        label: '15 MW offshore 1·Un chart (1D)',
        description:
            'Digitized manufacturer-style 1·Un P–Q envelope (asymmetric import/export). Converted to p.u. of Sn. Confirm against OEM data.',
        apply: () => {
            const from1d = oneDCurveTo2d(qCapOffshore1UnPoints15Mw, 17.5);
            if (!from1d) return defaultQCap2dState();
            return { ...defaultQCap2dState(), ...from1d, voltageDependent: false, inputModel: 'pu' };
        }
    }
];

export const DEFAULT_WIND_SPEED_MS = 10;

/** Approximation modes for P(v) between table knots (PowerFactory-style). */
export const WIND_CURVE_APPROX_OPTIONS = [
    { value: 'linear', label: 'linear' },
    { value: 'constant', label: 'constant' }
];

/**
 * Interpolate active power at wind speed v from sorted {v_ms, p_mw} points.
 * @param {Array<{v_ms:number,p_mw:number}>} points
 * @param {number} vMs
 * @param {'linear'|'constant'} [approx='linear']
 * @returns {number|null}
 */
export function interpWindPowerAtV(points, vMs, approx = 'linear') {
    if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(vMs)) return null;
    const v = points.map((pt) => Number(pt.v_ms));
    const p = points.map((pt) => Number(pt.p_mw));
    if (v.some((x) => !Number.isFinite(x)) || p.some((x) => !Number.isFinite(x))) return null;

    if (vMs <= v[0]) return p[0];
    if (vMs >= v[v.length - 1]) return p[p.length - 1];

    const style = approx === 'constant' || approx === 'step' ? 'constant' : 'linear';
    if (style === 'constant') {
        for (let i = 0; i < v.length - 1; i++) {
            if (vMs >= v[i] && vMs < v[i + 1]) return p[i];
        }
        return p[p.length - 1];
    }

    for (let i = 0; i < v.length - 1; i++) {
        if (vMs >= v[i] && vMs <= v[i + 1]) {
            const span = v[i + 1] - v[i];
            if (Math.abs(span) < 1e-12) return p[i];
            const t = (vMs - v[i]) / span;
            return p[i] + t * (p[i + 1] - p[i]);
        }
    }
    return p[p.length - 1];
}

/**
 * Parse wind power curve JSON into sorted points.
 * @param {string|Array} raw
 * @returns {Array<{v_ms:number,p_mw:number}>|null}
 */
export function parseWindPowerCurvePoints(raw) {
    let pts;
    try {
        pts = typeof raw === 'string' ? JSON.parse(String(raw).trim()) : raw;
    } catch {
        return null;
    }
    if (!Array.isArray(pts) || pts.length < 2) return null;
    const out = [];
    for (const pt of pts) {
        const v_ms = Number(pt.v_ms);
        const p_mw = Number(pt.p_mw);
        if (!Number.isFinite(v_ms) || !Number.isFinite(p_mw)) return null;
        out.push({ v_ms, p_mw });
    }
    out.sort((a, b) => a.v_ms - b.v_ms);
    return out;
}

/**
 * Compute p_mw from wind speed + curve JSON (fallback 0 if invalid).
 */
export function computeWindTurbinePMw(windSpeedMs, curveJson, approx = 'linear') {
    const points = parseWindPowerCurvePoints(curveJson);
    const v = Number(windSpeedMs);
    if (!points || !Number.isFinite(v)) return 0;
    const p = interpWindPowerAtV(points, v, approx);
    return p != null && Number.isFinite(p) ? p : 0;
}

const defaultComputedPMw = computeWindTurbinePMw(DEFAULT_WIND_SPEED_MS, defaultWindPowerCurveJson, 'linear');

export const defaultWindTurbineData = {
    ...defaultStaticGeneratorData,
    name: 'Wind Turbine',
    p_mw: defaultComputedPMw,
    sn_mva: WIND_POWER_CURVE_DEFAULT_RATED_MW,
    max_p_mw: WIND_POWER_CURVE_DEFAULT_RATED_MW,
    generator_type: 'current_source',
    current_source: true,
    dyn_plant_kind: 'WIND',
    reactive_capability_curve: false,
    q_capability_curve_json: JSON.stringify(
        flattenQCap2dToPqPoints(defaultQCap2dState(), WIND_POWER_CURVE_DEFAULT_RATED_MW)
    ),
    ...serializeQCap2d(defaultQCap2dState()),
    wind_speed_ms: DEFAULT_WIND_SPEED_MS,
    wind_power_curve_json: defaultWindPowerCurveJson,
    wind_curve_approx: 'linear'
};

function fmtNum(n, digits = 4) {
    if (!Number.isFinite(n)) return '';
    const r = Math.round(n * 1e6) / 1e6;
    return String(r);
}

export class WindTurbineDialog extends StaticGeneratorDialog {
    constructor(editorUi) {
        super(editorUi);
        this.title = 'Wind Turbine Parameters';
        this.data = { ...defaultWindTurbineData };
        this._windCurveTableBody = null;
        this._windCurveSvg = null;
        this._windCurveStatus = null;
        this._windCurveRedraw = null;
        this._windCurveProgrammatic = false;
        this._qCap2d = defaultQCap2dState();
        this._qCap2dHost = null;

        const hideQcapIds = new Set(['curve_style', 'q_capability_curve_json', 'reactive_capability_curve']);
        (this.qCapabilityParameters || []).forEach((p) => {
            if (hideQcapIds.has(p.id)) p.hidden = true;
        });
        this.qCapabilityParameters = [
            ...(this.qCapabilityParameters || []),
            { id: 'q_cap_voltage_dependent', type: 'text', value: 'true', hidden: true },
            { id: 'q_cap_input_model', type: 'text', value: 'pu', hidden: true },
            { id: 'q_cap_scale_min_percent', type: 'number', value: '100', hidden: true },
            { id: 'q_cap_scale_max_percent', type: 'number', value: '100', hidden: true },
            { id: 'q_cap_u_json', type: 'textarea', value: JSON.stringify(this._qCap2d.u), hidden: true },
            { id: 'q_cap_p_json', type: 'textarea', value: JSON.stringify(this._qCap2d.p), hidden: true },
            { id: 'q_cap_qmax_json', type: 'textarea', value: JSON.stringify(this._qCap2d.qmax), hidden: true },
            { id: 'q_cap_qmin_json', type: 'textarea', value: JSON.stringify(this._qCap2d.qmin), hidden: true }
        ];

        this.powerParameters = [
            {
                id: 'name',
                label: 'Turbine Name',
                description: 'Name identifier for the wind turbine',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'wind_speed_ms',
                label: 'Wind Speed (m/s)',
                description: 'Hub-height wind speed used with the power curve to set active power for load flow.',
                type: 'number',
                value: String(this.data.wind_speed_ms),
                step: '0.1',
                min: '0'
            },
            {
                id: 'wind_curve_approx',
                label: 'Approximation',
                description:
                    'How P is interpolated between table knots (linear segments or constant / stepwise).',
                type: 'select',
                value: this.data.wind_curve_approx || 'linear',
                options: WIND_CURVE_APPROX_OPTIONS
            },
            {
                // Hidden storage — UI edits the table; this textarea stays synced for Apply/serialize
                id: 'wind_power_curve_json',
                label: 'Wind Power Curve JSON',
                description: 'Internal storage for the P(v) table.',
                type: 'textarea',
                value: this.data.wind_power_curve_json,
                rows: 2,
                hidden: true
            },
            {
                id: 'p_mw',
                label: 'Active Power (MW) — from curve',
                description:
                    'Computed from wind speed and the power curve (read-only). Used as the P setpoint in load flow.',
                type: 'number',
                value: String(this.data.p_mw),
                step: '0.01',
                readOnly: true
            },
            {
                id: 'q_mvar',
                label: 'Reactive Power (MVar)',
                description: 'Reactive power setpoint used when mode is Manual.',
                type: 'number',
                value: this.data.q_mvar.toString(),
                step: '0.1'
            },
            {
                id: 'q_setpoint_mode',
                label: 'Q setpoint mode (load flow)',
                description:
                    'Manual = use Reactive Power above. Capacitive max / Inductive max take Q from the P–U capability table (enable on Q capability tab).',
                type: 'select',
                value: this.data.q_setpoint_mode || 'manual',
                options: WIND_Q_SETPOINT_MODE_OPTIONS
            }
        ];

        const genType = this.shortCircuitParameters?.find((p) => p.id === 'generator_type');
        if (genType) genType.value = 'current_source';
        const dynKind = this.dynamicsParameters?.find((p) => p.id === 'dyn_plant_kind');
        if (dynKind) dynKind.value = 'WIND';
        const sn = this.ratingParameters?.find((p) => p.id === 'sn_mva');
        if (sn) sn.value = String(WIND_POWER_CURVE_DEFAULT_RATED_MW);
    }

    getDescription() {
        return '<strong>Configure Wind Turbine Parameters</strong><br>Based on Static Generator. Edit the wind power curve table (speed [m/s] vs Power [MW]); active power is taken from the curve at the entered wind speed.';
    }

    /** Q capability tab: hidden inputs only — P–U capability UI is rendered by _mountWindQCapabilityPanel. */
    createTabContent(tabId, parameters) {
        if (tabId !== 'qcapability') {
            const other = super.createTabContent(tabId, parameters);
            if (tabId === 'power') this._powerTabContent = other;
            return other;
        }
        const content = document.createElement('div');
        content.dataset.tab = tabId;
        Object.assign(content.style, {
            display: tabId === this.currentTab ? 'block' : 'none',
            width: '100%',
            boxSizing: 'border-box'
        });
        const store = document.createElement('div');
        store.setAttribute('aria-hidden', 'true');
        Object.assign(store.style, {
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: '0'
        });
        (parameters || []).forEach((param) => {
            if (param.type === 'textarea') {
                const el = document.createElement('textarea');
                el.id = param.id;
                el.value = param.value || '';
                store.appendChild(el);
                this.inputs.set(param.id, el);
            } else if (param.type === 'checkbox') {
                const el = document.createElement('input');
                el.type = 'checkbox';
                el.id = param.id;
                el.checked = !!param.value;
                store.appendChild(el);
                this.inputs.set(param.id, el);
            } else if (param.type === 'select') {
                const el = document.createElement('select');
                el.id = param.id;
                (param.options || []).forEach((opt) => {
                    const o = document.createElement('option');
                    const val = typeof opt === 'object' ? opt.value : opt;
                    o.value = val;
                    o.textContent = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                    el.appendChild(o);
                });
                el.value = param.value != null ? String(param.value) : el.value;
                store.appendChild(el);
                this.inputs.set(param.id, el);
            } else {
                const el = document.createElement('input');
                el.type = param.type === 'number' ? 'number' : 'text';
                el.id = param.id;
                el.value = param.value != null ? String(param.value) : '';
                store.appendChild(el);
                this.inputs.set(param.id, el);
            }
        });
        content.appendChild(store);
        this._qCapTabContent = content;
        return content;
    }

    showTabDialog() {
        super.showTabDialog();
        // wind_power_curve_json is already param.hidden — do not walk ancestors to hide
        // a "row" (that used to blank the entire Power tab).
        this._mountWindPowerCurvePanel();
        this._wireWindPowerUi();
        this._mountWindQCapabilityPanel();
        this._patchWindQSetpointGroupUi();
        this._syncWindPowerInputsFromParameters();
        // Ensure Power tab content stayed visible after mounting
        const powerContent = this._powerTabContent;
        if (powerContent && this.currentTab === 'power') powerContent.style.display = 'block';
    }

    /**
     * PowerFactory-style layout: editable speed/Power table + live P(v) plot.
     */
    _mountWindPowerCurvePanel() {
        const powerContent = this._powerTabContent;
        // Prefer finding via wind_speed input's form
        const vInput = this.inputs.get('wind_speed_ms');
        const form = vInput?.closest('form') || powerContent?.querySelector('form');
        const host = form || powerContent;
        if (!host) return;

        // Remove previous panel if re-opened
        const existing = host.querySelector('[data-wind-curve-panel="1"]');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.dataset.windCurvePanel = '1';
        Object.assign(panel.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            margin: '4px 0 12px 0',
            padding: '12px 14px',
            backgroundColor: '#ffffff',
            border: '1px solid #cfd4da',
            borderRadius: '6px'
        });

        const title = document.createElement('div');
        title.textContent = 'Wind Power Curve';
        Object.assign(title.style, {
            fontWeight: '600',
            fontSize: '14px',
            color: '#212529',
            marginBottom: '2px'
        });
        panel.appendChild(title);

        const tplRow = document.createElement('div');
        Object.assign(tplRow.style, {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
        });
        const tplLab = document.createElement('label');
        tplLab.textContent = 'Template';
        Object.assign(tplLab.style, { fontSize: '12px', color: '#495057', fontWeight: '600' });
        const tplSel = document.createElement('select');
        Object.assign(tplSel.style, {
            minWidth: '180px',
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            background: '#fff'
        });
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '— Select turbine class —';
        tplSel.appendChild(opt0);
        WIND_POWER_CURVE_TEMPLATES.forEach((tpl) => {
            const o = document.createElement('option');
            o.value = tpl.id;
            o.textContent = tpl.label;
            tplSel.appendChild(o);
        });
        const tplBtn = document.createElement('button');
        tplBtn.type = 'button';
        tplBtn.textContent = 'Apply template';
        Object.assign(tplBtn.style, {
            fontSize: '12px',
            padding: '4px 10px',
            cursor: 'pointer',
            background: '#17a2b8',
            color: '#fff',
            border: 'none',
            borderRadius: '4px'
        });
        tplBtn.addEventListener('click', () => this._applyWindPowerCurveTemplate(tplSel.value));
        const tplHint = document.createElement('span');
        tplHint.textContent = 'Loads P(v) and sets Sn / max P. Replace with OEM data when available.';
        Object.assign(tplHint.style, { fontSize: '11px', color: '#6c757d' });
        tplRow.append(tplLab, tplSel, tplBtn, tplHint);
        panel.appendChild(tplRow);

        const body = document.createElement('div');
        Object.assign(body.style, {
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 260px) 1fr',
            gap: '14px',
            alignItems: 'stretch',
            minHeight: '280px'
        });

        // --- Table column ---
        const tableCol = document.createElement('div');
        Object.assign(tableCol.style, {
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #adb5bd',
            borderRadius: '2px',
            overflow: 'hidden',
            backgroundColor: '#fff',
            minHeight: '260px'
        });

        const tableScroll = document.createElement('div');
        Object.assign(tableScroll.style, {
            flex: '1 1 auto',
            overflowY: 'auto',
            maxHeight: '320px'
        });

        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            fontFamily: 'Segoe UI, Arial, sans-serif'
        });

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['', 'speed', 'Power MW'].forEach((label, i) => {
            const th = document.createElement('th');
            th.textContent = label;
            Object.assign(th.style, {
                position: 'sticky',
                top: '0',
                backgroundColor: '#e9ecef',
                borderBottom: '1px solid #adb5bd',
                borderRight: i < 2 ? '1px solid #ced4da' : 'none',
                padding: '4px 6px',
                fontWeight: '600',
                textAlign: i === 0 ? 'center' : 'left',
                zIndex: '1',
                width: i === 0 ? '28px' : undefined
            });
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        this._windCurveTableBody = tbody;
        table.appendChild(tbody);
        tableScroll.appendChild(table);
        tableCol.appendChild(tableScroll);

        const tableBtns = document.createElement('div');
        Object.assign(tableBtns.style, {
            display: 'flex',
            gap: '6px',
            padding: '6px',
            borderTop: '1px solid #ced4da',
            backgroundColor: '#f8f9fa'
        });
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+ Row';
        Object.assign(addBtn.style, {
            fontSize: '12px',
            padding: '3px 8px',
            cursor: 'pointer'
        });
        addBtn.addEventListener('click', () => {
            const pts = this._readWindCurveFromTable();
            const lastV = pts.length ? pts[pts.length - 1].v_ms : 0;
            this._appendWindCurveRow(lastV + 1, 0);
            this._syncWindCurveJsonFromTable();
        });
        const sortBtn = document.createElement('button');
        sortBtn.type = 'button';
        sortBtn.textContent = 'Sort by speed';
        Object.assign(sortBtn.style, {
            fontSize: '12px',
            padding: '3px 8px',
            cursor: 'pointer'
        });
        sortBtn.addEventListener('click', () => {
            const pts = this._readWindCurveFromTable().sort((a, b) => a.v_ms - b.v_ms);
            this._fillWindCurveTable(pts);
            this._syncWindCurveJsonFromTable();
        });
        tableBtns.appendChild(addBtn);
        tableBtns.appendChild(sortBtn);
        tableCol.appendChild(tableBtns);

        // --- Chart column ---
        const chartCol = document.createElement('div');
        Object.assign(chartCol.style, {
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #adb5bd',
            borderRadius: '2px',
            backgroundColor: '#fff',
            padding: '8px 10px 6px',
            minHeight: '260px',
            position: 'relative'
        });

        const status = document.createElement('div');
        Object.assign(status.style, {
            fontSize: '11px',
            color: '#c62828',
            minHeight: '16px',
            marginBottom: '4px'
        });
        this._windCurveStatus = status;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 520 280');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        Object.assign(svg.style, {
            width: '100%',
            flex: '1 1 auto',
            minHeight: '220px',
            display: 'block'
        });
        this._windCurveSvg = svg;

        const approxRow = document.createElement('div');
        Object.assign(approxRow.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '6px',
            fontSize: '12px',
            color: '#343a40'
        });
        const approxLabel = document.createElement('span');
        approxLabel.textContent = 'Approximation';
        approxRow.appendChild(approxLabel);

        // Move the approximation select into the chart footer (PowerFactory-style)
        const approxSel = this.inputs.get('wind_curve_approx');
        if (approxSel) {
            // Only hide the parameter card that directly wraps this select — never the tab pane
            let approxParamRow = approxSel.parentElement;
            while (
                approxParamRow &&
                approxParamRow !== host &&
                !(
                    approxParamRow.tagName === 'DIV' &&
                    String(approxParamRow.style?.display || '').includes('grid') &&
                    approxParamRow.contains(approxSel) &&
                    !approxParamRow.dataset?.tab
                )
            ) {
                approxParamRow = approxParamRow.parentElement;
            }
            if (
                approxParamRow &&
                approxParamRow !== host &&
                !approxParamRow.dataset?.tab &&
                approxParamRow.querySelector('select') === approxSel
            ) {
                approxParamRow.style.display = 'none';
            }
            Object.assign(approxSel.style, {
                width: '140px',
                padding: '4px 6px',
                fontSize: '12px'
            });
            approxRow.appendChild(approxSel);
        }

        chartCol.appendChild(status);
        chartCol.appendChild(svg);
        chartCol.appendChild(approxRow);

        body.appendChild(tableCol);
        body.appendChild(chartCol);
        panel.appendChild(body);

        // Insert after wind speed row if possible
        const vRow = vInput?.closest('div[style*="grid"]') || vInput?.parentElement?.parentElement;
        if (vRow && vRow.parentElement) {
            vRow.parentElement.insertBefore(panel, vRow.nextSibling);
        } else {
            host.insertBefore(panel, host.firstChild);
        }

        // Populate table from JSON
        const ta = this.inputs.get('wind_power_curve_json');
        const pts = parseWindPowerCurvePoints(ta?.value) || defaultWindPowerCurvePoints.slice();
        this._fillWindCurveTable(pts);

        this._windCurveRedraw = () => this._redrawWindPowerCurveChart();
        this._windCurveRedraw();
    }

    _applyWindPowerCurveTemplate(templateId) {
        const tpl = WIND_POWER_CURVE_TEMPLATES.find((t) => t.id === templateId);
        if (!tpl) return;
        const pts = clonePts(tpl.points);
        this._fillWindCurveTable(pts);
        this._syncWindCurveJsonFromTable();
        this._setRatedPowerFromTemplate(tpl.snMva, tpl.ratedMw);
        if (typeof this._windCurveRedraw === 'function') this._windCurveRedraw();
        this._refreshComputedPMw();
    }

    _setRatedPowerFromTemplate(snMva, ratedMw) {
        const sn = Number(snMva);
        const pMax = Number(ratedMw);
        const snEl = this.inputs.get('sn_mva');
        if (snEl && Number.isFinite(sn) && sn > 0) {
            snEl.value = String(sn);
            this.data.sn_mva = sn;
            const snParam = this.ratingParameters?.find((p) => p.id === 'sn_mva');
            if (snParam) snParam.value = String(sn);
        }
        const maxPEl = this.inputs.get('max_p_mw');
        if (maxPEl && Number.isFinite(pMax) && pMax > 0) {
            maxPEl.value = String(pMax);
            this.data.max_p_mw = pMax;
            const maxPParam = this.ratingParameters?.find((p) => p.id === 'max_p_mw');
            if (maxPParam) maxPParam.value = String(pMax);
        }
        this._syncQCap2dToInputs();
    }

    _applyWindQCapabilityTemplate(templateId) {
        const tpl = WIND_Q_CAPABILITY_TEMPLATES.find((t) => t.id === templateId);
        if (!tpl) return;
        const next = tpl.apply(this._snForQCap());
        this._qCap2d = {
            ...defaultQCap2dState(),
            ...next,
            u: (next.u || []).slice(),
            p: (next.p || []).slice(),
            qmax: (next.qmax || []).map((row) => row.slice()),
            qmin: (next.qmin || []).map((row) => row.slice())
        };
        const hiddenUse = this.inputs.get('reactive_capability_curve');
        if (hiddenUse) hiddenUse.checked = true;
        this.data.reactive_capability_curve = true;
        this._syncQCap2dToInputs();
        this._renderQCap2dPanel();
        this._refreshQSetpointModeUi();
        this._updateQSetpointHint();
    }

    _fillWindCurveTable(points) {
        const tbody = this._windCurveTableBody;
        if (!tbody) return;
        while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
        (points || []).forEach((pt) => this._appendWindCurveRow(pt.v_ms, pt.p_mw));
        if (!points || points.length === 0) {
            this._appendWindCurveRow(0, 0);
            this._appendWindCurveRow(1, 0);
        }
    }

    _appendWindCurveRow(vMs, pMw) {
        const tbody = this._windCurveTableBody;
        if (!tbody) return;
        const tr = document.createElement('tr');
        Object.assign(tr.style, { borderBottom: '1px solid #e9ecef' });

        const tdIdx = document.createElement('td');
        Object.assign(tdIdx.style, {
            padding: '2px 4px',
            textAlign: 'center',
            color: '#868e96',
            borderRight: '1px solid #e9ecef',
            width: '28px'
        });
        tdIdx.textContent = String(tbody.children.length + 1);

        const mkCell = (val, field) => {
            const td = document.createElement('td');
            Object.assign(td.style, {
                padding: '0',
                borderRight: field === 'v' ? '1px solid #e9ecef' : 'none'
            });
            const input = document.createElement('input');
            input.type = 'number';
            input.step = field === 'v' ? '0.01' : '0.01';
            input.value = fmtNum(Number(val));
            input.dataset.windField = field;
            Object.assign(input.style, {
                width: '100%',
                boxSizing: 'border-box',
                border: 'none',
                padding: '4px 6px',
                fontSize: '12px',
                fontFamily: 'inherit',
                outline: 'none',
                backgroundColor: 'transparent'
            });
            input.addEventListener('focus', () => {
                input.style.backgroundColor = '#fff8e1';
            });
            input.addEventListener('blur', () => {
                input.style.backgroundColor = 'transparent';
            });
            const onEdit = () => {
                this._renumberWindCurveRows();
                this._syncWindCurveJsonFromTable();
            };
            input.addEventListener('input', onEdit);
            input.addEventListener('change', onEdit);
            td.appendChild(input);
            return td;
        };

        const tdDel = document.createElement('td');
        // put delete on index cell as button overlay approach: use a small × on index
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.title = 'Remove row';
        delBtn.textContent = '×';
        Object.assign(delBtn.style, {
            border: 'none',
            background: 'transparent',
            color: '#adb5bd',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: '1',
            padding: '0 2px'
        });
        delBtn.addEventListener('mouseenter', () => { delBtn.style.color = '#c62828'; });
        delBtn.addEventListener('mouseleave', () => { delBtn.style.color = '#adb5bd'; });
        delBtn.addEventListener('click', () => {
            if (tbody.children.length <= 2) return;
            tr.remove();
            this._renumberWindCurveRows();
            this._syncWindCurveJsonFromTable();
        });
        tdIdx.textContent = '';
        tdIdx.appendChild(delBtn);

        tr.appendChild(tdIdx);
        tr.appendChild(mkCell(vMs, 'v'));
        tr.appendChild(mkCell(pMw, 'p'));
        tbody.appendChild(tr);
        this._renumberWindCurveRows();
    }

    _renumberWindCurveRows() {
        const tbody = this._windCurveTableBody;
        if (!tbody) return;
        Array.from(tbody.children).forEach((tr, i) => {
            const btn = tr.querySelector('button');
            // keep delete button; optional index via title
            if (btn) btn.title = `Remove row ${i + 1}`;
        });
    }

    _readWindCurveFromTable() {
        const tbody = this._windCurveTableBody;
        if (!tbody) return [];
        const out = [];
        Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
            const vIn = tr.querySelector('input[data-wind-field="v"]');
            const pIn = tr.querySelector('input[data-wind-field="p"]');
            const v_ms = parseFloat(vIn?.value);
            const p_mw = parseFloat(pIn?.value);
            if (Number.isFinite(v_ms) && Number.isFinite(p_mw)) {
                out.push({ v_ms, p_mw });
            }
        });
        return out;
    }

    _syncWindCurveJsonFromTable() {
        const pts = this._readWindCurveFromTable();
        const ta = this.inputs.get('wind_power_curve_json');
        if (ta) {
            this._windCurveProgrammatic = true;
            ta.value = JSON.stringify(pts);
            this._windCurveProgrammatic = false;
            const param = this.powerParameters.find((p) => p.id === 'wind_power_curve_json');
            if (param) param.value = ta.value;
            this.data.wind_power_curve_json = ta.value;
        }
        if (typeof this._windCurveRedraw === 'function') this._windCurveRedraw();
        this._refreshComputedPMw();
    }

    _redrawWindPowerCurveChart() {
        const svg = this._windCurveSvg;
        const statusEl = this._windCurveStatus;
        if (!svg) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        if (statusEl) {
            statusEl.textContent = '';
            statusEl.style.color = '#c62828';
        }

        let pts = this._readWindCurveFromTable();
        if (pts.length < 2) {
            if (statusEl) statusEl.textContent = 'Enter at least two points to plot the curve.';
            return;
        }
        pts = pts.slice().sort((a, b) => a.v_ms - b.v_ms);

        const approxSel = this.inputs.get('wind_curve_approx');
        const approx = approxSel?.value === 'constant' ? 'constant' : 'linear';

        // Build polyline samples for display (dense for linear; stepped for constant)
        const poly = [];
        if (approx === 'constant') {
            for (let i = 0; i < pts.length - 1; i++) {
                poly.push([pts[i].v_ms, pts[i].p_mw]);
                poly.push([pts[i + 1].v_ms, pts[i].p_mw]);
            }
            poly.push([pts[pts.length - 1].v_ms, pts[pts.length - 1].p_mw]);
        } else {
            pts.forEach((pt) => poly.push([pt.v_ms, pt.p_mw]));
        }

        const W = 520;
        const H = 280;
        const padL = 52;
        const padR = 18;
        const padT = 16;
        const padB = 36;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;

        let vMin = Math.min(...pts.map((p) => p.v_ms));
        let vMax = Math.max(...pts.map((p) => p.v_ms));
        let pMin = 0;
        let pMax = Math.max(...pts.map((p) => p.p_mw), 0.1);
        if (vMax <= vMin) vMax = vMin + 1;
        // Nice axes: start x at 0 if near zero; y from 0
        if (vMin > 0 && vMin < 1) vMin = 0;
        if (vMin >= 0) vMin = 0;
        pMin = 0;
        // Round pMax up slightly
        pMax = pMax * 1.02;

        const xOf = (v) => padL + ((v - vMin) / (vMax - vMin)) * plotW;
        const yOf = (p) => padT + plotH - ((p - pMin) / (pMax - pMin)) * plotH;

        const ns = 'http://www.w3.org/2000/svg';
        const add = (tag, attrs) => {
            const el = document.createElementNS(ns, tag);
            Object.entries(attrs).forEach(([k, val]) => el.setAttribute(k, String(val)));
            svg.appendChild(el);
            return el;
        };

        // Background
        add('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' });
        add('rect', {
            x: padL,
            y: padT,
            width: plotW,
            height: plotH,
            fill: '#fafafa',
            stroke: '#adb5bd',
            'stroke-width': 1
        });

        // Grid + ticks
        const xTicks = 3;
        const yTicks = 3;
        for (let i = 0; i <= xTicks; i++) {
            const v = vMin + (i / xTicks) * (vMax - vMin);
            const x = xOf(v);
            add('line', {
                x1: x, y1: padT, x2: x, y2: padT + plotH,
                stroke: '#dee2e6', 'stroke-width': 1
            });
            const t = add('text', {
                x, y: padT + plotH + 16,
                'text-anchor': 'middle',
                'font-size': 11,
                fill: '#495057',
                'font-family': 'Segoe UI, Arial, sans-serif'
            });
            t.textContent = v.toFixed(2);
        }
        for (let i = 0; i <= yTicks; i++) {
            const p = pMin + (i / yTicks) * (pMax - pMin);
            const y = yOf(p);
            add('line', {
                x1: padL, y1: y, x2: padL + plotW, y2: y,
                stroke: '#dee2e6', 'stroke-width': 1
            });
            const t = add('text', {
                x: padL - 6, y: y + 4,
                'text-anchor': 'end',
                'font-size': 11,
                fill: '#495057',
                'font-family': 'Segoe UI, Arial, sans-serif'
            });
            t.textContent = p.toFixed(4);
        }

        // Axis labels
        const yLab = add('text', {
            x: 14, y: padT + plotH / 2,
            'text-anchor': 'middle',
            'font-size': 12,
            fill: '#212529',
            'font-family': 'Segoe UI, Arial, sans-serif',
            transform: `rotate(-90 14 ${padT + plotH / 2})`
        });
        yLab.textContent = 'MW';
        const xLab = add('text', {
            x: padL + plotW / 2, y: H - 6,
            'text-anchor': 'middle',
            'font-size': 12,
            fill: '#212529',
            'font-family': 'Segoe UI, Arial, sans-serif'
        });
        xLab.textContent = 'm/s';

        // Curve (red like PowerFactory)
        const d = poly
            .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xOf(pt[0]).toFixed(2)} ${yOf(pt[1]).toFixed(2)}`)
            .join(' ');
        add('path', {
            d,
            fill: 'none',
            stroke: '#c62828',
            'stroke-width': 2,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round'
        });

        // Operating point marker at current wind speed
        const vIn = this.inputs.get('wind_speed_ms');
        const vOp = parseFloat(vIn?.value);
        if (Number.isFinite(vOp) && vOp >= vMin && vOp <= vMax) {
            const pOp = interpWindPowerAtV(pts, vOp, approx);
            if (pOp != null) {
                add('line', {
                    x1: xOf(vOp), y1: padT, x2: xOf(vOp), y2: padT + plotH,
                    stroke: '#1976d2', 'stroke-width': 1, 'stroke-dasharray': '4 3'
                });
                add('circle', {
                    cx: xOf(vOp),
                    cy: yOf(pOp),
                    r: 4,
                    fill: '#1976d2',
                    stroke: '#fff',
                    'stroke-width': 1.5
                });
            }
        }
    }

    _wireWindPowerUi() {
        const pInput = this.inputs.get('p_mw');
        if (pInput) {
            pInput.readOnly = true;
            pInput.style.backgroundColor = '#e9ecef';
            pInput.style.cursor = 'default';
        }
        const vInput = this.inputs.get('wind_speed_ms');
        const approxSel = this.inputs.get('wind_curve_approx');
        const refresh = () => {
            this._refreshComputedPMw();
            if (typeof this._windCurveRedraw === 'function') this._windCurveRedraw();
        };
        if (vInput) {
            vInput.addEventListener('input', refresh);
            vInput.addEventListener('change', refresh);
        }
        if (approxSel) {
            approxSel.addEventListener('change', refresh);
        }
        this._refreshComputedPMw();
    }

    _refreshComputedPMw() {
        const vInput = this.inputs.get('wind_speed_ms');
        const curveTa = this.inputs.get('wind_power_curve_json');
        const approxSel = this.inputs.get('wind_curve_approx');
        const pInput = this.inputs.get('p_mw');
        if (!pInput) return;
        const v = vInput ? parseFloat(vInput.value) : Number(this.data.wind_speed_ms);
        const curve = curveTa ? curveTa.value : this.data.wind_power_curve_json;
        const approx = approxSel?.value || this.data.wind_curve_approx || 'linear';
        const p = computeWindTurbinePMw(v, curve, approx);
        const rounded = Math.round(p * 1e6) / 1e6;
        pInput.value = String(rounded);
        const pParam = this.powerParameters.find((x) => x.id === 'p_mw');
        if (pParam) pParam.value = String(rounded);
        this.data.p_mw = rounded;
        if (typeof this._updateQSetpointHint === 'function') {
            this._updateQSetpointHint();
        }
        if (typeof this._syncQcapCurveToActivePowerIfPossible === 'function') {
            this._syncQcapCurveToActivePowerIfPossible();
        }
    }

    getFormValues() {
        this._syncWindCurveJsonFromTable();
        this._refreshComputedPMw();
        const values = super.getFormValues();
        const vInput = this.inputs.get('wind_speed_ms');
        const curveTa = this.inputs.get('wind_power_curve_json');
        const approxSel = this.inputs.get('wind_curve_approx');
        if (vInput) values.wind_speed_ms = parseFloat(vInput.value) || 0;
        if (curveTa) values.wind_power_curve_json = curveTa.value;
        if (approxSel) values.wind_curve_approx = approxSel.value || 'linear';
        values.p_mw = computeWindTurbinePMw(
            values.wind_speed_ms,
            values.wind_power_curve_json,
            values.wind_curve_approx
        );
        this._syncQCap2dToInputs();
        const ser = serializeQCap2d(this._qCap2d || defaultQCap2dState());
        Object.assign(values, ser);
        const sn = Number(values.sn_mva) || WIND_POWER_CURVE_DEFAULT_RATED_MW;
        values.q_capability_curve_json = JSON.stringify(flattenQCap2dToPqPoints(this._qCap2d, sn));
        return values;
    }

    populateDialog(cellData) {
        super.populateDialog(cellData);
        if (cellData && cellData.attributes) {
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const name = attribute.name;
                const value = attribute.value;
                const powerParam = this.powerParameters.find((p) => p.id === name);
                if (
                    powerParam &&
                    (name === 'wind_speed_ms' ||
                        name === 'wind_power_curve_json' ||
                        name === 'wind_curve_approx' ||
                        name === 'p_mw' ||
                        name === 'q_mvar' ||
                        name === 'q_setpoint_mode')
                ) {
                    powerParam.value = value;
                    this.data[name] = value;
                }
            }
        }
        const v = this.powerParameters.find((p) => p.id === 'wind_speed_ms')?.value;
        const curve = this.powerParameters.find((p) => p.id === 'wind_power_curve_json')?.value;
        const approx = this.powerParameters.find((p) => p.id === 'wind_curve_approx')?.value || 'linear';
        const p = computeWindTurbinePMw(v, curve, approx);
        const pParam = this.powerParameters.find((x) => x.id === 'p_mw');
        if (pParam) pParam.value = String(p);
        this.data.p_mw = p;

        const attrObj = {};
        if (cellData && cellData.attributes) {
            for (let i = 0; i < cellData.attributes.length; i++) {
                attrObj[cellData.attributes[i].name] = cellData.attributes[i].value;
            }
        }
        const sn = Number(attrObj.sn_mva) || Number(this.data.sn_mva) || WIND_POWER_CURVE_DEFAULT_RATED_MW;
        this._qCap2d = loadQCap2dFromAttrs({ ...this.data, ...attrObj }, sn);
        this._syncQCap2dToInputs();
        if (this._qCap2dHost) this._renderQCap2dPanel();

        // If panel already mounted (re-populate), refresh table
        if (this._windCurveTableBody) {
            const pts = parseWindPowerCurvePoints(curve) || defaultWindPowerCurvePoints.slice();
            this._fillWindCurveTable(pts);
            if (typeof this._windCurveRedraw === 'function') this._windCurveRedraw();
        }
        this._syncWindPowerInputsFromParameters();
    }

    _syncQcapCurveToActivePowerIfPossible() {
        // Wind turbine Q limits come from the P–U matrix, not the 15 MW 1D template scaler.
        this._syncQCap2dToInputs();
        if (typeof this._updateQSetpointHint === 'function') this._updateQSetpointHint();
    }

    _snForQCap() {
        const snEl = this.inputs.get('sn_mva');
        const sn = Number(snEl?.value != null ? snEl.value : this.data.sn_mva);
        return Number.isFinite(sn) && sn > 0 ? sn : WIND_POWER_CURVE_DEFAULT_RATED_MW;
    }

    _syncQCap2dToInputs() {
        if (!this._qCap2d) this._qCap2d = defaultQCap2dState();
        const ser = serializeQCap2d(this._qCap2d);
        Object.entries(ser).forEach(([k, v]) => {
            const el = this.inputs.get(k);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = v === true || v === 'true';
            else el.value = v;
            this.data[k] = v;
        });
        const sn = this._snForQCap();
        const flat = JSON.stringify(flattenQCap2dToPqPoints(this._qCap2d, sn));
        const ta = this.inputs.get('q_capability_curve_json');
        if (ta) {
            if (typeof this._setQCapabilityJsonProgrammatically === 'function') {
                this._setQCapabilityJsonProgrammatically(ta, flat);
            } else {
                ta.value = flat;
            }
        }
        this.data.q_capability_curve_json = flat;
        this._updateQSetpointHint();
    }

    _patchWindQSetpointGroupUi() {
        const powerContent = this._powerTabContent;
        if (!powerContent) return;
        const fieldset = powerContent.querySelector('.sgen-q-setpoint-group');
        if (!fieldset) return;

        Object.assign(fieldset.style, {
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 16px 16px'
        });

        const legend = fieldset.querySelector('legend');
        if (legend) {
            legend.textContent = 'Reactive power in load flow';
            Object.assign(legend.style, { fontSize: '13px' });
        }

        const inner = fieldset.querySelector(':scope > div');
        if (!inner) return;

        Object.assign(inner.style, {
            width: '100%',
            boxSizing: 'border-box',
            position: 'static',
            gap: '10px'
        });

        // Drop decorative bracket and cramped connector strip
        inner.querySelectorAll('div[aria-hidden="true"]').forEach((el) => el.remove());

        inner.querySelectorAll('div').forEach((row) => {
            if (row.style.marginLeft === '22px') row.style.marginLeft = '0';
        });

        const hint = inner.querySelector('#q_setpoint_effective_hint');
        const modeInput = inner.querySelector('#q_setpoint_mode');
        const modeRow = modeInput?.parentElement?.parentElement;
        if (hint && modeRow && hint !== modeRow.nextElementSibling) {
            inner.appendChild(hint);
        }
        if (hint) {
            Object.assign(hint.style, {
                margin: '0',
                width: '100%',
                boxSizing: 'border-box',
                borderLeft: '3px solid #0dcaf0',
                lineHeight: '1.5'
            });
        }

        let guide = inner.querySelector('#wt-q-setpoint-guide');
        if (!guide) {
            guide = document.createElement('div');
            guide.id = 'wt-q-setpoint-guide';
            inner.insertBefore(guide, inner.firstChild);
        }
        Object.assign(guide.style, {
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 14px',
            fontSize: '12px',
            lineHeight: '1.55',
            color: '#343a40',
            background: '#ffffff',
            border: '1px solid #cfe2ff',
            borderRadius: '6px'
        });
        guide.innerHTML =
            '<div style="font-weight:600;margin-bottom:8px;color:#084298;">How reactive power is set</div>' +
            '<ol style="margin:0;padding-left:22px;">' +
            '<li style="margin-bottom:6px;">Open the <strong>Q capability</strong> tab and enable <strong>Use Q capability curve</strong> to define voltage-dependent Q limits (P and U).</li>' +
            '<li style="margin-bottom:6px;"><strong>Manual</strong> — enter Q in <strong>Reactive Power (MVar)</strong> above.</li>' +
            '<li><strong>Capacitive max</strong> or <strong>Inductive max</strong> — load flow takes Qmax or Qmin from the capability table at the current active power (preview below uses U&nbsp;=&nbsp;1.0&nbsp;p.u.).</li>' +
            '</ol>';
    }

    _syncWindPowerInputsFromParameters() {
        (this.powerParameters || []).forEach((param) => {
            const el = this.inputs.get(param.id);
            if (!el) return;
            if (param.type === 'checkbox') {
                el.checked = !!param.value;
                this.data[param.id] = !!param.value;
            } else if (param.type === 'select') {
                const v = param.value != null ? String(param.value) : 'manual';
                el.value = v;
                this.data[param.id] = v;
            } else {
                el.value = param.value != null ? String(param.value) : '';
                this.data[param.id] = param.value;
            }
        });
        const qCapCurve = (this.qCapabilityParameters || []).find((p) => p.id === 'reactive_capability_curve');
        if (qCapCurve) {
            const hidden = this.inputs.get('reactive_capability_curve');
            if (hidden) {
                hidden.checked = !!qCapCurve.value;
                this.data.reactive_capability_curve = !!qCapCurve.value;
            }
        }
        this._refreshQSetpointModeUi();
        if (typeof this._updateQSetpointHint === 'function') this._updateQSetpointHint();
    }

    _refreshQSetpointModeUi() {
        const modeIn = this.inputs.get('q_setpoint_mode');
        const curveCb = this.inputs.get('reactive_capability_curve');
        const qIn = this.inputs.get('q_mvar');
        if (!modeIn) return;
        const curveOn = !!(curveCb && curveCb.checked);
        Array.from(modeIn.options).forEach((opt) => {
            if (opt.value === 'manual') opt.disabled = false;
            else opt.disabled = !curveOn;
        });
        // Keep stored mode from cell / Components Data — do not force manual when curve is off.

        const mode = modeIn.value || 'manual';
        const manualActive = !curveOn || mode === 'manual';
        if (qIn) {
            qIn.readOnly = !manualActive;
            qIn.tabIndex = manualActive ? 0 : -1;
            Object.assign(qIn.style, {
                backgroundColor: manualActive ? '#ffffff' : '#e9ecef',
                color: manualActive ? '#212529' : '#6c757d',
                cursor: manualActive ? '' : 'not-allowed',
                borderColor: manualActive ? '#ced4da' : '#dee2e6'
            });
        }
        const qRow =
            this._powerTabContent?.querySelector('#q_mvar')?.parentElement?.parentElement;
        if (qRow) {
            qRow.style.opacity = manualActive ? '1' : '0.65';
            qRow.style.transition = 'opacity 0.15s ease';
        }
    }

    _wireQSetpointHintListeners() {
        super._wireQSetpointHintListeners();
        ['wind_speed_ms', 'sn_mva'].forEach((id) => {
            const el = this.inputs.get(id);
            if (!el) return;
            const handler = () => this._updateQSetpointHint();
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        });
        const modeIn = this.inputs.get('q_setpoint_mode');
        if (modeIn) {
            modeIn.addEventListener('change', () => {
                this._refreshQSetpointModeUi();
                this._updateQSetpointHint();
            });
        }
    }

    _updateQSetpointHint() {
        const hint = this._qSetpointHintEl;
        if (!hint) return;

        const pIn = this.inputs.get('p_mw');
        const qIn = this.inputs.get('q_mvar');
        const modeIn = this.inputs.get('q_setpoint_mode');
        const curveCb = this.inputs.get('reactive_capability_curve');

        const curveOn = !!(curveCb && curveCb.checked);
        const mode = modeIn ? modeIn.value : 'manual';
        const pMw = pIn ? parseFloat(pIn.value) : Number(this.data.p_mw) || 0;
        const qManual = qIn ? parseFloat(qIn.value) : Number(this.data.q_mvar) || 0;
        const sn = this._snForQCap();
        const st = this._qCap2d || defaultQCap2dState();
        const lim = interpQCap2dMvar(st, pMw, 1, sn);
        const fmt = (v) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '—');

        this._refreshQSetpointModeUi();

        if (!curveOn) {
            hint.style.display = 'block';
            hint.style.color = '#664d03';
            hint.style.backgroundColor = '#fff3cd';
            hint.style.borderColor = '#ffecb5';
            hint.innerHTML =
                '<strong>Step 1:</strong> Open the <strong>Q capability</strong> tab and check ' +
                '<strong>Use Q capability curve</strong>. ' +
                'Then you can select Capacitive max or Inductive max here, or keep Manual and enter Q above.';
            return;
        }

        hint.style.display = 'block';
        hint.style.color = '#0f5132';
        hint.style.backgroundColor = '#d1e7dd';
        hint.style.borderColor = '#badbcc';

        if (!lim) {
            hint.innerHTML =
                'Q capability is enabled but limits could not be read at the current active power. Check the matrices on the Q capability tab.';
            return;
        }

        if (mode === 'manual') {
            hint.innerHTML =
                `<strong>Load flow Q:</strong> ${fmt(qManual)} MVar (manual). ` +
                `Allowed range at P&nbsp;=&nbsp;${fmt(pMw)} MW, U&nbsp;=&nbsp;1.0 p.u.: ` +
                `${fmt(lim.q_min_mvar)} … ${fmt(lim.q_max_mvar)} MVar.`;
            return;
        }

        const qEff = mode === 'capacitive_max' ? lim.q_max_mvar : lim.q_min_mvar;
        const modeLabel = mode === 'capacitive_max' ? 'Capacitive max (Qmax)' : 'Inductive max (Qmin)';
        hint.innerHTML =
            `<strong>Load flow Q:</strong> ${fmt(qEff)} MVar — ${modeLabel} from the capability curve ` +
            `at P&nbsp;=&nbsp;${fmt(pMw)} MW, U&nbsp;=&nbsp;1.0 p.u.`;
    }

    /** Wind turbine uses the 2D P–U capability plot; skip the 1D P–Q preview from Static Generator. */
    _mountQCapabilityChartPanel() {
        this._qCapChartWrap = null;
        this._qCapabilityChartRedraw = null;
    }

    _syncQCapOptionsEnabled(enabled, block) {
        if (!block) return;
        Object.assign(block.style, {
            opacity: enabled ? '1' : '0.55',
            pointerEvents: enabled ? 'auto' : 'none',
            transition: 'opacity 0.15s ease'
        });
    }

    _mountWindQCapabilityPanel() {
        // Tab buttons carry the same data-tab value, so use the stored content element.
        const qCapContent = this._qCapTabContent;
        if (!qCapContent) return;

        Object.assign(qCapContent.style, {
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'auto'
        });

        Array.from(qCapContent.children).forEach((child) => {
            if (child.dataset?.wtQcap2d !== '1') child.style.display = 'none';
        });

        let host = qCapContent.querySelector('[data-wt-qcap-2d="1"]');
        if (!host) {
            host = document.createElement('div');
            host.dataset.wtQcap2d = '1';
            qCapContent.appendChild(host);
        }
        Object.assign(host.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            width: '100%',
            minWidth: '0',
            boxSizing: 'border-box'
        });
        this._qCap2dHost = host;
        this._renderQCap2dPanel();
    }

    _qCapDisplayFactor() {
        return this._qCap2d?.inputModel === 'mw_mvar' ? this._snForQCap() : 1;
    }

    _qCapPLabel() {
        return this._qCap2d?.inputModel === 'mw_mvar' ? 'P-setpoints MW' : 'P-setpoints p.u.';
    }

    _qCapQLabel(kind) {
        const unit = this._qCap2d?.inputModel === 'mw_mvar' ? 'Mvar' : 'p.u.';
        return kind === 'max' ? `Qmax [${unit}]` : `Qmin [${unit}]`;
    }

    _renderQCap2dPanel() {
        const host = this._qCap2dHost;
        if (!host) return;
        this._closeQCap2dPlotExpanded();
        if (!this._qCap2d) this._qCap2d = defaultQCap2dState();
        host.innerHTML = '';

        const st = this._qCap2d;

        const cfg = document.createElement('div');
        Object.assign(cfg.style, {
            width: '100%',
            boxSizing: 'border-box',
            background: '#ffffff',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            overflow: 'hidden'
        });

        const cfgHead = document.createElement('div');
        cfgHead.textContent = 'Configuration (P–U Q capability)';
        Object.assign(cfgHead.style, {
            padding: '11px 16px',
            background: '#f8f9fa',
            borderBottom: '1px solid #e9ecef',
            fontWeight: '600',
            fontSize: '14px',
            color: '#343a40'
        });
        cfg.appendChild(cfgHead);

        const cfgBody = document.createElement('div');
        Object.assign(cfgBody.style, {
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        });

        const useCurveLab = document.createElement('label');
        Object.assign(useCurveLab.style, {
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            fontSize: '13px',
            fontWeight: '600',
            color: '#212529',
            lineHeight: '1.4',
            cursor: 'pointer'
        });
        const useCurveCb = document.createElement('input');
        useCurveCb.type = 'checkbox';
        useCurveCb.style.marginTop = '2px';
        const hiddenUse = this.inputs.get('reactive_capability_curve');
        useCurveCb.checked = hiddenUse ? !!hiddenUse.checked : !!this.data.reactive_capability_curve;
        useCurveCb.onchange = () => {
            if (hiddenUse) hiddenUse.checked = useCurveCb.checked;
            this.data.reactive_capability_curve = useCurveCb.checked;
            this._syncQCapOptionsEnabled(useCurveCb.checked, optionsBlock);
            this._refreshQSetpointModeUi();
            this._updateQSetpointHint();
        };
        const useCurveText = document.createElement('span');
        useCurveText.textContent = 'Use Q capability curve (enforce limits in load flow)';
        useCurveLab.append(useCurveCb, useCurveText);
        cfgBody.appendChild(useCurveLab);

        const qTplRow = document.createElement('div');
        Object.assign(qTplRow.style, {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '8px'
        });
        const qTplLab = document.createElement('label');
        qTplLab.textContent = 'Capability template';
        Object.assign(qTplLab.style, {
            fontSize: '12px',
            fontWeight: '600',
            color: '#495057',
            marginTop: '6px'
        });
        const qTplSel = document.createElement('select');
        Object.assign(qTplSel.style, {
            minWidth: '260px',
            padding: '6px 8px',
            fontSize: '13px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            background: '#fff'
        });
        const qOpt0 = document.createElement('option');
        qOpt0.value = '';
        qOpt0.textContent = '— Select capability shape —';
        qTplSel.appendChild(qOpt0);
        WIND_Q_CAPABILITY_TEMPLATES.forEach((tpl) => {
            const o = document.createElement('option');
            o.value = tpl.id;
            o.textContent = tpl.label;
            qTplSel.appendChild(o);
        });
        const qTplBtn = document.createElement('button');
        qTplBtn.type = 'button';
        qTplBtn.textContent = 'Apply template';
        Object.assign(qTplBtn.style, {
            fontSize: '12px',
            padding: '6px 12px',
            cursor: 'pointer',
            background: '#17a2b8',
            color: '#fff',
            border: 'none',
            borderRadius: '4px'
        });
        const qTplHint = document.createElement('div');
        Object.assign(qTplHint.style, {
            width: '100%',
            fontSize: '12px',
            color: '#6c757d',
            lineHeight: '1.4'
        });
        qTplHint.textContent =
            'Loads a library P–Q / P–U shape (p.u. of Sn). Enables the curve. Confirm against OEM data.';
        qTplSel.addEventListener('change', () => {
            const t = WIND_Q_CAPABILITY_TEMPLATES.find((x) => x.id === qTplSel.value);
            qTplHint.textContent = t
                ? t.description
                : 'Loads a library P–Q / P–U shape (p.u. of Sn). Enables the curve. Confirm against OEM data.';
        });
        qTplBtn.addEventListener('click', () => this._applyWindQCapabilityTemplate(qTplSel.value));
        qTplRow.append(qTplLab, qTplSel, qTplBtn, qTplHint);
        cfgBody.appendChild(qTplRow);

        const optionsBlock = document.createElement('div');
        Object.assign(optionsBlock.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '12px 14px',
            background: '#f8fbff',
            border: '1px solid #dbeafe',
            borderRadius: '6px'
        });

        const modelSection = document.createElement('div');
        Object.assign(modelSection.style, { display: 'flex', flexDirection: 'column', gap: '8px' });
        const modelLab = document.createElement('div');
        modelLab.textContent = 'Input model';
        Object.assign(modelLab.style, { fontSize: '12px', fontWeight: '600', color: '#495057' });
        modelSection.appendChild(modelLab);
        const modelRow = document.createElement('div');
        Object.assign(modelRow.style, { display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' });
        [
            { v: 'mw_mvar', t: 'MW / Mvar' },
            { v: 'pu', t: 'p.u. of Sn' }
        ].forEach((opt) => {
            const lab = document.createElement('label');
            Object.assign(lab.style, {
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                fontSize: '13px',
                color: '#343a40',
                cursor: 'pointer'
            });
            const r = document.createElement('input');
            r.type = 'radio';
            r.name = 'wt_qcap_input_model';
            r.checked = st.inputModel === opt.v;
            r.onchange = () => {
                st.inputModel = opt.v;
                this._syncQCap2dToInputs();
                this._renderQCap2dPanel();
            };
            lab.append(r, document.createTextNode(opt.t));
            modelRow.appendChild(lab);
        });
        modelSection.appendChild(modelRow);
        optionsBlock.appendChild(modelSection);

        const vdLab = document.createElement('label');
        Object.assign(vdLab.style, {
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            fontSize: '13px',
            color: '#343a40',
            cursor: 'pointer'
        });
        const vd = document.createElement('input');
        vd.type = 'checkbox';
        vd.checked = st.voltageDependent !== false;
        vd.onchange = () => {
            st.voltageDependent = vd.checked;
            this._syncQCap2dToInputs();
            this._renderQCap2dPanel();
        };
        vdLab.append(vd, document.createTextNode('Consider voltage dependent limits'));
        optionsBlock.appendChild(vdLab);

        const scaleSection = document.createElement('div');
        Object.assign(scaleSection.style, {
            display: 'grid',
            gridTemplateColumns: 'minmax(160px, 1fr) 88px',
            gap: '8px 16px',
            alignItems: 'center',
            maxWidth: '380px'
        });
        const scaleTitle = document.createElement('div');
        scaleTitle.textContent = 'Operational scaling';
        Object.assign(scaleTitle.style, {
            gridColumn: '1 / -1',
            fontSize: '12px',
            fontWeight: '600',
            color: '#495057',
            marginBottom: '2px'
        });
        scaleSection.appendChild(scaleTitle);
        [
            ['scaleMinPercent', 'Scaling factor (min.) %'],
            ['scaleMaxPercent', 'Scaling factor (max.) %']
        ].forEach(([key, labText]) => {
            const lab = document.createElement('label');
            lab.textContent = labText;
            Object.assign(lab.style, { fontSize: '13px', color: '#495057' });
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.step = '1';
            inp.min = '0';
            inp.value = String(st[key] ?? 100);
            Object.assign(inp.style, {
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '13px',
                textAlign: 'right'
            });
            inp.onchange = () => {
                st[key] = Number(inp.value) || 100;
                this._syncQCap2dToInputs();
                this._redrawQCap2dPlot();
            };
            scaleSection.appendChild(lab);
            scaleSection.appendChild(inp);
        });
        optionsBlock.appendChild(scaleSection);
        cfgBody.appendChild(optionsBlock);
        cfg.appendChild(cfgBody);
        this._syncQCapOptionsEnabled(useCurveCb.checked, optionsBlock);

        const axes = document.createElement('div');
        Object.assign(axes.style, {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'flex-start',
            width: '100%'
        });
        if (st.voltageDependent) {
            const uEd = this._qCapAxisEditor('Rows: Voltage Level p.u.', 'u', true);
            Object.assign(uEd.style, { flex: '0 0 168px', width: '168px' });
            axes.appendChild(uEd);
        }
        const pEd = this._qCapAxisEditor(`Columns: ${this._qCapPLabel()}`, 'p', false);
        Object.assign(pEd.style, { flex: '1 1 320px', minWidth: '280px' });
        axes.appendChild(pEd);

        const leftCol = document.createElement('div');
        Object.assign(leftCol.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: '0'
        });
        leftCol.appendChild(cfg);
        leftCol.appendChild(axes);

        const tablesRow = document.createElement('div');
        Object.assign(tablesRow.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%'
        });
        tablesRow.appendChild(this._qCapMatrixTable('max'));
        tablesRow.appendChild(this._qCapMatrixTable('min'));

        const plotCol = document.createElement('div');
        Object.assign(plotCol.style, {
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            background: '#ffffff',
            minWidth: '420px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
        });
        const plotHead = document.createElement('div');
        Object.assign(plotHead.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '12px 14px 0'
        });
        const plotTitle = document.createElement('div');
        plotTitle.textContent = 'Capability Curve';
        Object.assign(plotTitle.style, {
            color: '#495057',
            fontSize: '14px',
            fontWeight: '600'
        });
        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.textContent = 'Expand';
        expandBtn.title = 'Open enlarged plot';
        Object.assign(expandBtn.style, {
            border: '1px solid #ced4da',
            borderRadius: '4px',
            background: '#fff',
            color: '#495057',
            fontSize: '12px',
            padding: '4px 10px',
            cursor: 'pointer'
        });
        expandBtn.addEventListener('click', () => this._openQCap2dPlotExpanded());
        plotHead.append(plotTitle, expandBtn);

        const dims = this._qCapPlotDimensions(false);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${dims.W} ${dims.H}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        Object.assign(svg.style, {
            width: '100%',
            height: dims.cssHeight,
            minHeight: dims.cssHeight,
            display: 'block',
            padding: '0 10px 10px',
            boxSizing: 'border-box'
        });
        this._qCap2dSvg = svg;
        plotCol.append(plotHead, svg);

        const body = document.createElement('div');
        Object.assign(body.style, {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(420px, 540px)',
            gap: '16px',
            alignItems: 'start',
            width: '100%'
        });
        body.appendChild(leftCol);
        body.appendChild(plotCol);
        host.appendChild(body);
        host.appendChild(tablesRow);

        const note = document.createElement('div');
        Object.assign(note.style, {
            fontSize: '12px',
            color: '#6c757d',
            fontStyle: 'italic',
            lineHeight: '1.45',
            width: '100%'
        });
        note.textContent =
            'Qmin/Qmax depend on active power P and terminal voltage U (bilinear interpolation). ' +
            'Load flow uses the U=1.0 p.u. slice for pandapower’s P–Q table and interpolates on U when bus voltage is available (Park Controller).';
        host.appendChild(note);

        this._redrawQCap2dPlot();
    }

    _qCapAxisEditor(title, axis, isVoltage) {
        const st = this._qCap2d;
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            overflow: 'hidden',
            background: '#fff',
            minWidth: '0'
        });
        const head = document.createElement('div');
        head.textContent = title;
        Object.assign(head.style, {
            background: '#e9ecef',
            padding: '6px 8px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#212529'
        });
        wrap.appendChild(head);
        const list = document.createElement('div');
        const wrapInputs = axis === 'p';
        Object.assign(list.style, wrapInputs
            ? { display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', maxHeight: 'none' }
            : { maxHeight: 'none' });
        const factor = axis === 'p' ? this._qCapDisplayFactor() : 1;
        st[axis].forEach((val, idx) => {
            const row = document.createElement('div');
            Object.assign(row.style, wrapInputs
                ? { display: 'flex', alignItems: 'center' }
                : {
                    display: 'flex',
                    gap: '4px',
                    padding: '2px 6px',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f3f5'
                });
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.step = '0.001';
            inp.value = String(Math.round(val * factor * 1e6) / 1e6);
            Object.assign(inp.style, {
                width: wrapInputs ? '70px' : '100%',
                minWidth: wrapInputs ? '70px' : '72px',
                flex: wrapInputs ? '0 0 70px' : '1',
                boxSizing: 'border-box',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: '12px'
            });
            inp.onchange = () => {
                const raw = Number(inp.value);
                if (!Number.isFinite(raw)) return;
                st[axis][idx] = axis === 'p' ? raw / factor : raw;
                this._syncQCap2dToInputs();
                this._redrawQCap2dPlot();
            };
            row.appendChild(inp);
            list.appendChild(row);
        });
        wrap.appendChild(list);
        const btns = document.createElement('div');
        Object.assign(btns.style, { display: 'flex', gap: '6px', padding: '6px' });
        const add = document.createElement('button');
        add.type = 'button';
        add.textContent = '+';
        add.onclick = (e) => {
            e.preventDefault();
            const arr = st[axis];
            const last = arr[arr.length - 1];
            const next = last + (isVoltage ? 0.01 : 0.05);
            const idx = insertAxisValue(arr, next);
            if (axis === 'p') {
                insertMatrixColumn(st.qmax, idx, Math.max(0, idx - 1));
                insertMatrixColumn(st.qmin, idx, Math.max(0, idx - 1));
            } else {
                insertMatrixRow(st.qmax, idx, st.p.length, Math.max(0, idx - 1));
                insertMatrixRow(st.qmin, idx, st.p.length, Math.max(0, idx - 1));
            }
            this._syncQCap2dToInputs();
            this._renderQCap2dPanel();
        };
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '−';
        del.onclick = (e) => {
            e.preventDefault();
            if (st[axis].length <= (axis === 'p' ? 2 : 1)) return;
            const idx = st[axis].length - 1;
            st[axis].splice(idx, 1);
            if (axis === 'p') {
                st.qmax.forEach((row) => row.splice(idx, 1));
                st.qmin.forEach((row) => row.splice(idx, 1));
            } else {
                st.qmax.splice(idx, 1);
                st.qmin.splice(idx, 1);
            }
            this._syncQCap2dToInputs();
            this._renderQCap2dPanel();
        };
        [add, del].forEach((b) => {
            Object.assign(b.style, {
                padding: '2px 10px',
                border: '1px solid #adb5bd',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer'
            });
        });
        btns.append(add, del);
        wrap.appendChild(btns);
        return wrap;
    }

    _qCapMatrixTable(kind) {
        const st = this._qCap2d;
        const k = this._qCapDisplayFactor();
        const mat = kind === 'max' ? st.qmax : st.qmin;
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            overflow: 'visible',
            background: '#fff',
            width: '100%',
            boxSizing: 'border-box'
        });
        const head = document.createElement('div');
        head.textContent = this._qCapQLabel(kind);
        Object.assign(head.style, {
            background: '#e9ecef',
            padding: '6px 8px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#212529'
        });
        wrap.appendChild(head);
        const table = document.createElement('table');
        Object.assign(table.style, {
            borderCollapse: 'collapse',
            fontSize: '11px',
            fontFamily: 'ui-monospace, Consolas, monospace',
            width: '100%',
            tableLayout: 'fixed',
            color: '#212529'
        });
        const headCell = {
            padding: '4px 6px',
            background: '#f1f3f5',
            color: '#212529',
            fontWeight: '600',
            whiteSpace: 'nowrap'
        };
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        const corner = document.createElement('th');
        corner.textContent = st.voltageDependent ? 'U \\ P' : 'P';
        Object.assign(corner.style, { ...headCell, width: '56px', minWidth: '56px' });
        hr.appendChild(corner);
        st.p.forEach((pPu) => {
            const th = document.createElement('th');
            th.textContent = String(Math.round(pPu * k * 1e4) / 1e4);
            Object.assign(th.style, headCell);
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        const rowsU = st.voltageDependent ? st.u : [st.u[nearestUIndex(st)]];
        const rowIdxs = st.voltageDependent ? st.u.map((_, i) => i) : [nearestUIndex(st)];
        rowIdxs.forEach((ri, displayI) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = st.voltageDependent ? String(rowsU[displayI]) : '';
            Object.assign(th.style, {
                ...headCell,
                background: '#f8f9fa',
                width: '56px',
                minWidth: '56px'
            });
            tr.appendChild(th);
            st.p.forEach((_, cj) => {
                const td = document.createElement('td');
                td.style.padding = '1px';
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = '0.001';
                const pu = Number(mat[ri]?.[cj]);
                inp.value = Number.isFinite(pu) ? String(Math.round(pu * k * 1e6) / 1e6) : '0';
                Object.assign(inp.style, {
                    width: '100%',
                    minWidth: '0',
                    boxSizing: 'border-box',
                    border: '1px solid #dee2e6',
                    padding: '3px 4px',
                    fontSize: '11px',
                    color: '#212529'
                });
                inp.onchange = () => {
                    const raw = Number(inp.value);
                    if (!mat[ri]) return;
                    mat[ri][cj] = Number.isFinite(raw) ? raw / k : 0;
                    this._syncQCap2dToInputs();
                    this._redrawQCap2dPlot();
                };
                td.appendChild(inp);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        return wrap;
    }

    _qCapPlotDimensions(expanded) {
        if (expanded) {
            return { W: 980, H: 640, cssHeight: 'min(72vh, 640px)' };
        }
        return { W: 720, H: 480, cssHeight: '420px' };
    }

    _closeQCap2dPlotExpanded() {
        if (this._qCap2dPlotOverlayEsc) {
            document.removeEventListener('keydown', this._qCap2dPlotOverlayEsc);
            this._qCap2dPlotOverlayEsc = null;
        }
        if (this._qCap2dPlotOverlay) {
            this._qCap2dPlotOverlay.remove();
            this._qCap2dPlotOverlay = null;
        }
        this._qCap2dExpandedSvg = null;
    }

    _openQCap2dPlotExpanded() {
        if (this._qCap2dPlotOverlay) return;

        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '10050',
            background: 'rgba(33, 37, 41, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box'
        });

        const panel = document.createElement('div');
        Object.assign(panel.style, {
            width: 'min(96vw, 1180px)',
            maxHeight: '92vh',
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #dee2e6',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        });

        const head = document.createElement('div');
        Object.assign(head.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 18px',
            borderBottom: '1px solid #e9ecef'
        });
        const title = document.createElement('div');
        title.textContent = 'Capability Curve';
        Object.assign(title.style, { fontSize: '15px', fontWeight: '600', color: '#343a40' });

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            border: '1px solid #ced4da',
            borderRadius: '4px',
            background: '#fff',
            color: '#495057',
            fontSize: '12px',
            padding: '5px 12px',
            cursor: 'pointer'
        });
        closeBtn.addEventListener('click', () => this._closeQCap2dPlotExpanded());
        head.append(title, closeBtn);

        const dims = this._qCapPlotDimensions(true);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${dims.W} ${dims.H}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        Object.assign(svg.style, {
            width: '100%',
            height: dims.cssHeight,
            minHeight: '420px',
            display: 'block',
            flex: '1 1 auto'
        });

        const body = document.createElement('div');
        Object.assign(body.style, {
            padding: '12px 18px 18px',
            overflow: 'auto',
            boxSizing: 'border-box'
        });
        body.appendChild(svg);

        panel.append(head, body);
        overlay.appendChild(panel);
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) this._closeQCap2dPlotExpanded();
        });

        this._qCap2dPlotOverlay = overlay;
        this._qCap2dExpandedSvg = svg;
        this._qCap2dPlotOverlayEsc = (ev) => {
            if (ev.key === 'Escape') this._closeQCap2dPlotExpanded();
        };
        document.addEventListener('keydown', this._qCap2dPlotOverlayEsc);
        document.body.appendChild(overlay);
        this._drawQCap2dPlot(svg, true);
    }

    _redrawQCap2dPlot() {
        this._drawQCap2dPlot(this._qCap2dSvg, false);
        if (this._qCap2dExpandedSvg) this._drawQCap2dPlot(this._qCap2dExpandedSvg, true);
    }

    _drawQCap2dPlot(svg, expanded) {
        const st = this._qCap2d;
        if (!svg || !st) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const { W, H } = this._qCapPlotDimensions(!!expanded);
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        const ml = 58;
        const mr = 20;
        const mt = 20;
        const mb = 62;
        const pw = W - ml - mr;
        const ph = H - mt - mb;
        const k = this._qCapDisplayFactor();
        const pUnit = st.inputModel === 'mw_mvar' ? 'MW' : 'p.u.';
        const qUnit = st.inputModel === 'mw_mvar' ? 'Mvar' : 'p.u.';
        const smin = (Number(st.scaleMinPercent) || 100) / 100;
        const smax = (Number(st.scaleMaxPercent) || 100) / 100;
        const fmtVal = (v) => String(Math.round(v * 1000) / 1000);

        const qDispAbs = [];
        st.qmax.forEach((row) => row.forEach((v) => qDispAbs.push(Math.abs(v * k * smax))));
        st.qmin.forEach((row) => row.forEach((v) => qDispAbs.push(Math.abs(v * k * smin))));
        const qMaxAbs = Math.max(0.5, ...(qDispAbs.length ? qDispAbs : [0.5])) * 1.15;
        const pMin = Math.min(0, ...st.p) * k;
        const pMax = Math.max(1, ...st.p) * k;
        const xOfQ = (qDisp) => ml + ((qDisp + qMaxAbs) / (2 * qMaxAbs)) * pw;
        const yOfP = (pDisp) => mt + (1 - (pDisp - pMin) / (pMax - pMin || 1)) * ph;

        const add = (el) => svg.appendChild(el);

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', String(ml));
        bg.setAttribute('y', String(mt));
        bg.setAttribute('width', String(pw));
        bg.setAttribute('height', String(ph));
        bg.setAttribute('fill', '#ffffff');
        bg.setAttribute('stroke', '#dee2e6');
        add(bg);

        const addText = (x, y, text, anchor = 'middle', size = 11) => {
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', String(x));
            t.setAttribute('y', String(y));
            t.setAttribute('fill', '#495057');
            t.setAttribute('font-size', String(size));
            t.setAttribute('font-family', 'Segoe UI, Arial, sans-serif');
            t.setAttribute('text-anchor', anchor);
            t.textContent = text;
            add(t);
            return t;
        };

        for (let g = 0; g <= 4; g++) {
            const gx = ml + (g / 4) * pw;
            const qTick = -qMaxAbs + (g / 4) * (2 * qMaxAbs);
            const vline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            vline.setAttribute('x1', String(gx));
            vline.setAttribute('x2', String(gx));
            vline.setAttribute('y1', String(mt));
            vline.setAttribute('y2', String(mt + ph));
            vline.setAttribute('stroke', '#e9ecef');
            add(vline);
            addText(gx, mt + ph + 14, fmtVal(qTick), 'middle', 10);

            const gy = mt + (g / 4) * ph;
            const pTick = pMax - (g / 4) * (pMax - pMin);
            const hline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hline.setAttribute('x1', String(ml));
            hline.setAttribute('x2', String(ml + pw));
            hline.setAttribute('y1', String(gy));
            hline.setAttribute('y2', String(gy));
            hline.setAttribute('stroke', '#e9ecef');
            add(hline);
            addText(ml - 6, gy + 4, fmtVal(pTick), 'end', 10);
        }

        const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        axis.setAttribute('x1', String(xOfQ(0)));
        axis.setAttribute('x2', String(xOfQ(0)));
        axis.setAttribute('y1', String(mt));
        axis.setAttribute('y2', String(mt + ph));
        axis.setAttribute('stroke', '#adb5bd');
        axis.setAttribute('stroke-dasharray', '4 4');
        add(axis);

        addText(ml + pw / 2, H - 8, `Q [${qUnit}]`, 'middle', 12);
        const pLab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        pLab.setAttribute('x', '14');
        pLab.setAttribute('y', String(mt + ph / 2));
        pLab.setAttribute('fill', '#495057');
        pLab.setAttribute('font-size', '12');
        pLab.setAttribute('font-family', 'Segoe UI, Arial, sans-serif');
        pLab.setAttribute('text-anchor', 'middle');
        pLab.setAttribute('transform', `rotate(-90 14 ${mt + ph / 2})`);
        pLab.textContent = `P [${pUnit}]`;
        add(pLab);

        const addPlotPoint = (cx, cy, color, tip) => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'wt-qcap-plot-point');
            g.style.cursor = 'pointer';

            const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hit.setAttribute('cx', String(cx));
            hit.setAttribute('cy', String(cy));
            hit.setAttribute('r', '9');
            hit.setAttribute('fill', 'transparent');
            hit.setAttribute('stroke', 'none');

            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', String(cx));
            dot.setAttribute('cy', String(cy));
            dot.setAttribute('r', '3.5');
            dot.setAttribute('fill', color);
            dot.setAttribute('stroke', '#ffffff');
            dot.setAttribute('stroke-width', '1.2');

            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = tip;

            const highlight = () => {
                dot.setAttribute('r', '5');
                dot.setAttribute('stroke-width', '2');
            };
            const reset = () => {
                dot.setAttribute('r', '3.5');
                dot.setAttribute('stroke-width', '1.2');
            };
            g.addEventListener('mouseenter', highlight);
            g.addEventListener('mouseleave', reset);

            g.append(title, hit, dot);
            add(g);
        };

        const uRows = st.voltageDependent ? st.u.map((_, i) => i) : [nearestUIndex(st)];
        uRows.forEach((ri, n) => {
            const color = QCAP_PLOT_COLORS[n % QCAP_PLOT_COLORS.length];
            const uLabel = st.voltageDependent ? `, U = ${st.u[ri]} p.u.` : '';
            const pts = [];
            st.p.forEach((p, j) => {
                const pD = p * k;
                const qMaxD = st.qmax[ri][j] * k * smax;
                pts.push([xOfQ(qMaxD), yOfP(pD)]);
            });
            for (let j = st.p.length - 1; j >= 0; j--) {
                const pD = st.p[j] * k;
                const qMinD = st.qmin[ri][j] * k * smin;
                pts.push([xOfQ(qMinD), yOfP(pD)]);
            }
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            poly.setAttribute('points', pts.map((xy) => xy.join(',')).join(' '));
            poly.setAttribute('fill', 'none');
            poly.setAttribute('stroke', color);
            poly.setAttribute('stroke-width', '1.8');
            add(poly);

            st.p.forEach((p, j) => {
                const pD = p * k;
                const qMaxD = st.qmax[ri][j] * k * smax;
                const qMinD = st.qmin[ri][j] * k * smin;
                addPlotPoint(
                    xOfQ(qMaxD),
                    yOfP(pD),
                    color,
                    `Qmax — P = ${fmtVal(pD)} ${pUnit}, Q = ${fmtVal(qMaxD)} ${qUnit}${uLabel}`
                );
                addPlotPoint(
                    xOfQ(qMinD),
                    yOfP(pD),
                    color,
                    `Qmin — P = ${fmtVal(pD)} ${pUnit}, Q = ${fmtVal(qMinD)} ${qUnit}${uLabel}`
                );
            });
        });

        if (st.voltageDependent) {
            addText(ml, H - 34, 'U [p.u.]:', 'start', 10);
            const legendW = Math.min(70, (pw - 48) / Math.max(1, uRows.length));
            uRows.forEach((ri, n) => {
                const color = QCAP_PLOT_COLORS[n % QCAP_PLOT_COLORS.length];
                const x = ml + 48 + n * legendW;
                const sw = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                sw.setAttribute('x', String(x));
                sw.setAttribute('y', String(H - 38));
                sw.setAttribute('width', '12');
                sw.setAttribute('height', '4');
                sw.setAttribute('fill', color);
                add(sw);
                addText(x + 16, H - 34, String(st.u[ri]), 'start', 10);
            });
        }
    }
}

function nearestUIndex(st) {
    if (!st?.u?.length) return 0;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < st.u.length; i++) {
        const d = Math.abs(st.u[i] - 1);
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

if (typeof window !== 'undefined') {
    window.WindTurbineDialog = WindTurbineDialog;
    window.interpWindPowerAtV = interpWindPowerAtV;
    window.computeWindTurbinePMw = computeWindTurbinePMw;
    window.parseWindPowerCurvePoints = parseWindPowerCurvePoints;
}
