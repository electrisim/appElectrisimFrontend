import { Dialog } from './Dialog.js';
import { createEconomicTabContent, buildCostPerUnitByCurrency } from './utils/economicTabHelper.js';
import { OPF_COST_CURRENCY_OPTIONS } from './utils/opfCostCurrency.js';
import {
    StaticGeneratorDialog,
    Q_SETPOINT_MODE_OPTIONS
} from './staticGeneratorDialog.js';
import {
    BESS_PCS_CIRCLE,
    BESS_PCS_CUSTOM,
    BESS_PCS_D_SHAPE,
    buildBessPcsEnvelopePoints,
    defaultStorageQCapabilityJson,
    looksLikeWtgPfTriangle,
    parseCurvePoints,
    resolveBessPcsRatings,
    resolveStorageQSetpoint
} from './utils/storageQCapability.js';

// Default values for storage parameters (based on pandapower and OpenDSS documentation)
export const defaultStorageData = {
    name: "Storage",
    // Power
    p_mw: 0.0,
    q_mvar: 0.0,
    // Energy
    max_e_mwh: 0.0,
    min_e_mwh: 0.0,
    soc_percent: 0.0,
    // Configuration
    sn_mva: 0.0,
    scaling: 1.0,
    type: '',
    in_service: true,
    conn: 'wye',
    phases: 3,
    // Optimization (pandapower OPF)
    controllable: false,
    max_p_mw: 0.0,
    min_p_mw: 0.0,
    max_q_mvar: 0.0,
    min_q_mvar: 0.0,
    opf_marginal_cost_eur_per_mwh: '',
    opf_cp2_eur_per_mw2: '',
    opf_cost_currency: 'EUR',
    // OpenDSS-specific parameters (https://opendss.epri.com/Properties5.html)
    state: 'IDLING',
    disp_mode: 'DEFAULT',
    pct_charge: 100,
    pct_discharge: 100,
    pct_eff_charge: 90,
    pct_eff_discharge: 90,
    pct_idling_kw: 1,
    pct_idling_kvar: 0,
    discharge_trigger: 0.0,
    charge_trigger: 0.0,
    time_charge_trig: 2.0,
    spectrum: 'default',
    // Inverter control (OpenDSS InvControl — https://opendss.epri.com/InvControl.html)
    inv_control_mode: 'NONE',
    pf: 1.0,
    pf_q_mode: 'lagging',
    pf_charge: 1.0,
    pf_charge_q_mode: 'leading',
    watt_priority: false,
    // P–Q capability (Qmin/Qmax vs |P|) — same model as static generator
    reactive_capability_curve: false,
    q_cap_voltage_dependent: false,
    curve_style: 'straightLineYValues',
    q_capability_curve_json: defaultStorageQCapabilityJson(50),
    q_capability_preset: BESS_PCS_CIRCLE,
    q_setpoint_mode: 'manual',
    vv_curve_preset: 'IEEE_1547',
    vv_xarray: '0.92 0.98 1.02 1.08',
    vv_yarray: '0.44 0 -0.44 -0.44',
    vw_curve_preset: 'IEEE_1547',
    vw_xarray: '1.06 1.1',
    vw_yarray: '1 0',
    wattpf_xarray: '0 0.5 1',
    wattpf_yarray: '1 0.98 0.95',
    wattvar_xarray: '0.2 0.5 1',
    wattvar_yarray: '0.44 0.22 0',
    cost_per_unit_by_currency: "0"
};

export class StorageDialog extends Dialog {
    constructor(editorUi) {
        super('Storage Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'power';
        this.data = { ...defaultStorageData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Power parameters (necessary for executing a power flow calculation)
        this.powerParameters = [
            {
                id: 'p_mw',
                label: 'Active Power (MW)',
                description: 'Momentary active power. Positive = charging (consuming), negative = discharging (injecting). OpenDSS sign is converted automatically.',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'q_mvar',
                label: 'Reactive Power (MVar)',
                description: 'Manual reactive power setpoint when Q setpoint mode is Manual. For curve-based Q, choose Capacitive max or Inductive max below.',
                type: 'number',
                value: this.data.q_mvar.toString(),
                step: '0.1'
            },
            {
                id: 'q_setpoint_mode',
                label: 'Q setpoint mode (load flow)',
                description: 'When the Q capability curve is enabled: Capacitive max uses q_max (absorb); Inductive max uses q_min (inject). Manual uses Reactive Power above. Dispatch reversal can also command inject/absorb max from this envelope.',
                type: 'select',
                value: this.data.q_setpoint_mode || 'manual',
                options: Q_SETPOINT_MODE_OPTIONS
            }
        ];

        this.qCapabilityParameters = [
            {
                id: 'reactive_capability_curve',
                label: 'Use Q capability curve',
                description: 'Enforce the four-quadrant PCS envelope (STATCOM Q at P = 0, leftover Q at rated P). Dispatch reversal uses this as the Q command when you choose inject/absorb max. Watt priority still decides what is clipped at Sn.',
                type: 'checkbox',
                value: this.data.reactive_capability_curve
            },
            {
                id: 'q_cap_voltage_dependent',
                label: 'Voltage-dependent Q envelope',
                description: 'Scale Qmin/Qmax with terminal voltage (capability vs U). Full Q at 1.00 pu; reduced toward 0.88 / 1.10 pu (already visible at 0.98 / 1.02). This is the PCS envelope, not Volt-VAR droop.',
                type: 'checkbox',
                value: this.data.q_cap_voltage_dependent
            },
            {
                id: 'q_capability_preset',
                label: 'PCS envelope',
                description: 'PCS circle = √(Sn²−P²) with a D-cut at Pmax. D-shape holds Q at 0.9·Sn until the current circle binds. Custom = edit JSON (vendor curve).',
                type: 'select',
                value: this.data.q_capability_preset || BESS_PCS_CIRCLE,
                options: [
                    { value: BESS_PCS_CIRCLE, label: 'PCS circle (kVA) — typical BESS' },
                    { value: BESS_PCS_D_SHAPE, label: 'PCS D-shape (flat Q + circle)' },
                    { value: BESS_PCS_CUSTOM, label: 'Custom (edit JSON)' }
                ]
            },
            {
                id: 'curve_style',
                label: 'Curve style',
                description: 'straightLineYValues: linear segments. constantYValue: Q holds until the next P point.',
                type: 'select',
                value: this.data.curve_style,
                options: ['straightLineYValues', 'constantYValue']
            },
            {
                id: 'q_capability_curve_json',
                label: 'Curve points (JSON)',
                description: 'Array of { "p_mw", "q_min_mvar", "q_max_mvar" }. Four-quadrant: −P discharge, +P charge. Rebuilds from Sn and Pmax when the envelope preset is not Custom.',
                type: 'textarea',
                value: this.data.q_capability_curve_json,
                rows: 8
            }
        ];
        
        // Energy parameters
        this.energyParameters = [
            {
                id: 'max_e_mwh',
                label: 'Maximum Energy (MWh)',
                description: 'Rated storage capacity (maximum charge level). Maps to OpenDSS kWhrated.',
                type: 'number',
                value: this.data.max_e_mwh.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'min_e_mwh',
                label: 'Minimum Energy (MWh)',
                description: 'Minimum energy / reserve level. Maps to OpenDSS %reserve = (min_e_mwh / max_e_mwh) × 100.',
                type: 'number',
                value: this.data.min_e_mwh.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'soc_percent',
                label: 'State of Charge (%)',
                description: 'Present state of charge (0–100 %). Maps to OpenDSS %stored. Charging requires SOC below 100%; discharging requires SOC above the reserve level (min_e_mwh).',
                type: 'number',
                value: this.data.soc_percent.toString(),
                step: '0.1',
                min: '0',
                max: '100'
            }
        ];
        
        // Configuration parameters
        this.configParameters = [
            {
                id: 'name',
                label: 'Storage Name',
                description: 'Name identifier for the storage element.',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'sn_mva',
                label: 'Nominal / Inverter Rating (MVA)',
                description: 'Nominal apparent power of the inverter. Maps to OpenDSS kVA. Used as kWRated when p_mw = 0.',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'conn',
                label: 'Connection',
                description: 'Winding connection type. Maps to OpenDSS conn property.',
                type: 'select',
                value: this.data.conn || 'wye',
                options: ['wye', 'delta']
            },
            {
                id: 'phases',
                label: 'Number of Phases',
                description: 'Number of electrical phases. Power is evenly divided among phases in OpenDSS.',
                type: 'number',
                value: this.data.phases.toString(),
                step: '1',
                min: '1',
                max: '3'
            },
            {
                id: 'scaling',
                label: 'Scaling Factor',
                description: 'Optional scaling factor multiplied with p_mw and q_mvar (pandapower only).',
                type: 'number',
                value: this.data.scaling.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'type',
                label: 'Storage Type',
                description: 'Optional string to classify the storage (e.g. "Li-Ion", "Flow"). Informational only.',
                type: 'text',
                value: this.data.type.toString()
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the storage is in service.',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];

        // Optimization parameters (pandapower OPF)
        this.optimizationParameters = [
            {
                id: 'controllable',
                label: 'Controllable',
                description: 'Whether this storage is controllable by the Optimal Power Flow (OPF). Must be true to use OPF limits below.',
                type: 'checkbox',
                value: this.data.controllable
            },
            {
                id: 'max_p_mw',
                label: 'Max Active Power (MW)',
                description: 'Maximum active power injection for OPF. Required when controllable = true.',
                type: 'number',
                value: this.data.max_p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'min_p_mw',
                label: 'Min Active Power (MW)',
                description: 'Minimum active power injection for OPF. Required when controllable = true.',
                type: 'number',
                value: this.data.min_p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'max_q_mvar',
                label: 'Max Reactive Power (MVar)',
                description: 'Maximum reactive power injection for OPF. Required when controllable = true.',
                type: 'number',
                value: this.data.max_q_mvar.toString(),
                step: '0.1'
            },
            {
                id: 'min_q_mvar',
                label: 'Min Reactive Power (MVar)',
                description: 'Minimum reactive power injection for OPF. Required when controllable = true.',
                type: 'number',
                value: this.data.min_q_mvar.toString(),
                step: '0.1'
            },
            {
                id: 'opf_cost_currency',
                label: 'Marginal cost currency (labels)',
                description:
                    'Shown next to optional marginal / quadratic OPF costs. Numeric values are passed to pandapower unchanged. For the whole OPF run, the first generator, external grid, or storage with a non-empty currency sets the study metadata.',
                type: 'select',
                value: this.data.opf_cost_currency,
                options: OPF_COST_CURRENCY_OPTIONS.map((o) => ({ value: o.code, label: o.label })),
            },
            {
                id: 'opf_marginal_cost_eur_per_mwh',
                label: 'OPF marginal cost (∂C/∂P per MWh)',
                description: 'Optional marginal active-power price for storage dispatch in pandapower OPF. Blank skips an explicit storage cost row.',
                type: 'text',
                value: String(this.data.opf_marginal_cost_eur_per_mwh ?? ''),
            },
            {
                id: 'opf_cp2_eur_per_mw2',
                label: 'OPF quadratic cost coef. cp₂',
                description: 'Small nonnegative curvature when marginal above is set.',
                type: 'text',
                value: String(this.data.opf_cp2_eur_per_mw2 ?? ''),
            }
        ];

        // OpenDSS-specific parameters (https://opendss.epri.com/Properties5.html)
        this.opendssParameters = [
            {
                id: 'state',
                label: 'State',
                description: 'Initial operational state. DISCHARGING = generating (kW positive in OpenDSS). Set automatically from p_mw sign; use IDLING when p_mw = 0.',
                type: 'select',
                value: this.data.state || 'IDLING',
                options: ['IDLING', 'CHARGING', 'DISCHARGING']
            },
            {
                id: 'disp_mode',
                label: 'Dispatch Mode',
                description: 'DEFAULT: time-series loadshape triggers (snapshot charging can idle if SOC is 100%). FOLLOW: output follows a loadshape. EXTERNAL: honour the State / P[MW] setpoint (recommended for snapshot load flow). LOADLEVEL / PRICE: global signal.',
                type: 'select',
                value: this.data.disp_mode || 'DEFAULT',
                options: ['DEFAULT', 'FOLLOW', 'EXTERNAL', 'LOADLEVEL', 'PRICE']
            },
            {
                id: 'pct_charge',
                label: '% Charge Rate',
                description: 'Charging rate as a percent of rated kW. Default = 100.',
                type: 'number',
                value: String(this.data.pct_charge ?? 100),
                step: '1',
                min: '0',
                max: '200'
            },
            {
                id: 'pct_discharge',
                label: '% Discharge Rate',
                description: 'Discharge rate as a percent of rated kW. Default = 100.',
                type: 'number',
                value: String(this.data.pct_discharge ?? 100),
                step: '1',
                min: '0',
                max: '200'
            },
            {
                id: 'pct_eff_charge',
                label: '% Charging Efficiency',
                description: 'Round-trip charging efficiency (%). Default = 90. Combined with discharge efficiency gives round-trip efficiency.',
                type: 'number',
                value: String(this.data.pct_eff_charge ?? 90),
                step: '1',
                min: '0',
                max: '100'
            },
            {
                id: 'pct_eff_discharge',
                label: '% Discharging Efficiency',
                description: 'Discharging efficiency (%). Default = 90. Default round-trip = 90% × 90% = 81%.',
                type: 'number',
                value: String(this.data.pct_eff_discharge ?? 90),
                step: '1',
                min: '0',
                max: '100'
            },
            {
                id: 'pct_idling_kw',
                label: '% Idling Losses (kW)',
                description: 'Percent of rated kW consumed as active power (auxiliary loads, cooling, controls) while idling. Default = 1.',
                type: 'number',
                value: String(this.data.pct_idling_kw ?? 1),
                step: '0.1',
                min: '0',
                max: '100'
            },
            {
                id: 'pct_idling_kvar',
                label: '% Idling Losses (kVar)',
                description: 'Percent of rated kW consumed as reactive power while idling. Default = 0.',
                type: 'number',
                value: String(this.data.pct_idling_kvar ?? 0),
                step: '0.1',
                min: '0',
                max: '100'
            },
            {
                id: 'discharge_trigger',
                label: 'Discharge Trigger',
                description: 'Loadshape level that triggers DISCHARGING state. 0 = disabled (state controlled externally or by State property).',
                type: 'number',
                value: String(this.data.discharge_trigger ?? 0.0),
                step: '0.01',
                min: '0',
                max: '2'
            },
            {
                id: 'charge_trigger',
                label: 'Charge Trigger',
                description: 'Loadshape level below which CHARGING is triggered. 0 = disabled.',
                type: 'number',
                value: String(this.data.charge_trigger ?? 0.0),
                step: '0.01',
                min: '0',
                max: '2'
            },
            {
                id: 'time_charge_trig',
                label: 'Time Charge Trigger (h)',
                description: 'Time of day (fractional hours, e.g. 2.0 = 2 AM) when storage automatically starts charging. Set to -1 to disable. Default = 2.0.',
                type: 'number',
                value: String(this.data.time_charge_trig ?? 2.0),
                step: '0.5',
                min: '-1',
                max: '24'
            },
            {
                id: 'spectrum',
                label: 'Harmonic Spectrum',
                description: 'Harmonic current injection spectrum for OpenDSS harmonic analysis. "default" is the built-in inverter spectrum.',
                type: 'select',
                value: this.data.spectrum || 'default',
                options: ['default', 'defaultgen', 'defaultload', 'pwm6', 'none']
            }
        ];

        // Inverter control parameters (OpenDSS InvControl on Storage)
        this.inverterControlParameters = [
            {
                id: 'inv_control_mode',
                label: 'Inverter Control Mode',
                description: 'NONE: fixed P/Q from Power tab. FIXED_Q: constant kvar. FIXED_PF: constant PF. VOLTVAR/VOLTWATT/WATTPF/WATTVAR/DYNAMICREACCURR use OpenDSS InvControl (requires Control Mode = Time).',
                type: 'select',
                value: this.data.inv_control_mode || 'NONE',
                options: [
                    { value: 'NONE', label: 'None (fixed P/Q)' },
                    { value: 'FIXED_Q', label: 'Fixed Q (constant kvar)' },
                    { value: 'FIXED_PF', label: 'Fixed PF (constant power factor)' },
                    { value: 'VOLTVAR', label: 'Q-V Droop (Volt-VAR / InvControl)' },
                    { value: 'VOLTWATT', label: 'Volt-Watt (InvControl)' },
                    { value: 'WATTPF', label: 'Watt-PF curve (InvControl)' },
                    { value: 'WATTVAR', label: 'Watt-VAR curve (InvControl)' },
                    { value: 'DYNAMICREACCURR', label: 'Dynamic reactive current (InvControl)' }
                ]
            },
            {
                id: 'pf',
                label: 'Discharge power factor (magnitude)',
                description: 'Used when Inverter Control Mode = Fixed PF and the BESS is discharging (P &lt; 0). Enter 0.85–1.0. Q direction is set below — do not enter a negative PF.',
                type: 'number',
                value: String(this.data.pf ?? 1.0),
                step: '0.01',
                min: '0.5',
                max: '1'
            },
            {
                id: 'pf_q_mode',
                label: 'Discharge Q direction',
                description: 'Lagging = absorb Q from the grid (inductive). Leading = inject Q into the grid (capacitive, supports voltage). At PF = 1.0 this has no effect.',
                type: 'select',
                value: this.data.pf_q_mode || 'lagging',
                options: [
                    { value: 'lagging', label: 'Lagging (absorb Q)' },
                    { value: 'leading', label: 'Leading (inject Q)' }
                ]
            },
            {
                id: 'pf_charge',
                label: 'Charge power factor (magnitude)',
                description: 'Fixed PF while charging (P &gt; 0). Leave 1.0 for unity. Typical plant practice: leading while charging to offset transformer var absorption.',
                type: 'number',
                value: String(this.data.pf_charge ?? 1.0),
                step: '0.01',
                min: '0.5',
                max: '1'
            },
            {
                id: 'pf_charge_q_mode',
                label: 'Charge Q direction',
                description: 'Lagging = absorb extra Q while charging (lowers voltage). Leading = inject Q from the PCS while charging (offsets transformer I²X and raises voltage). This is what you want for the 45 MW charge case — not a negative PF.',
                type: 'select',
                value: this.data.pf_charge_q_mode || 'leading',
                options: [
                    { value: 'lagging', label: 'Lagging (absorb Q)' },
                    { value: 'leading', label: 'Leading (inject Q)' }
                ]
            },
            {
                id: 'watt_priority',
                label: 'Watt priority (P over Q at kVA limit)',
                description: 'When hypot(P, Q) would exceed sn_mva: on = keep P and clip Q (typical FCR / energy dispatch); off = keep Q and clip P. kW + kVA alone is only the circle — this switch chooses which axis is sacrificed.',
                type: 'checkbox',
                value: this.data.watt_priority
            },
            {
                id: 'vv_curve_preset',
                label: 'Volt-VAR Curve Preset',
                description: 'Preset Q-V droop curve for VOLTVAR mode. IEEE_1547-style: inject Q below 0.98 pu, absorb Q above 1.02 pu.',
                type: 'select',
                value: this.data.vv_curve_preset || 'IEEE_1547',
                options: [
                    { value: 'IEEE_1547', label: 'IEEE 1547-style (0.92/0.98/1.02/1.08 pu)' },
                    { value: 'CUSTOM', label: 'Custom (edit X/Y arrays below)' }
                ]
            },
            {
                id: 'vv_xarray',
                label: 'Volt-VAR X (voltage pu)',
                description: 'Space-separated per-unit voltages for custom Volt-VAR curve (x-axis).',
                type: 'text',
                value: this.data.vv_xarray || '0.92 0.98 1.02 1.08'
            },
            {
                id: 'vv_yarray',
                label: 'Volt-VAR Y (Q pu of base)',
                description: 'Space-separated reactive power values in pu of base kvar (+ inject, − absorb).',
                type: 'text',
                value: this.data.vv_yarray || '0.44 0 -0.44 -0.44'
            },
            {
                id: 'vw_curve_preset',
                label: 'Volt-Watt Curve Preset',
                description: 'Preset P-V curtailment curve for VOLTWATT mode.',
                type: 'select',
                value: this.data.vw_curve_preset || 'IEEE_1547',
                options: [
                    { value: 'IEEE_1547', label: 'IEEE 1547-style (1.06→1.0, 1.10→0)' },
                    { value: 'CUSTOM', label: 'Custom (edit X/Y arrays below)' }
                ]
            },
            {
                id: 'vw_xarray',
                label: 'Volt-Watt X (voltage pu)',
                description: 'Space-separated per-unit voltages for custom Volt-Watt curve.',
                type: 'text',
                value: this.data.vw_xarray || '1.06 1.1'
            },
            {
                id: 'vw_yarray',
                label: 'Volt-Watt Y (P pu)',
                description: 'Space-separated active power values in pu of rated P.',
                type: 'text',
                value: this.data.vw_yarray || '1 0'
            },
            {
                id: 'wattpf_xarray',
                label: 'Watt-PF X (P pu)',
                description: 'Space-separated active power values in pu for Watt-PF curve.',
                type: 'text',
                value: this.data.wattpf_xarray || '0 0.5 1'
            },
            {
                id: 'wattpf_yarray',
                label: 'Watt-PF Y (power factor)',
                description: 'Space-separated power factor values for Watt-PF curve.',
                type: 'text',
                value: this.data.wattpf_yarray || '1 0.98 0.95'
            },
            {
                id: 'wattvar_xarray',
                label: 'Watt-VAR X (P pu)',
                description: 'Space-separated active power values in pu for Watt-VAR curve.',
                type: 'text',
                value: this.data.wattvar_xarray || '0.2 0.5 1'
            },
            {
                id: 'wattvar_yarray',
                label: 'Watt-VAR Y (Q pu)',
                description: 'Space-separated reactive power values in pu for Watt-VAR curve.',
                type: 'text',
                value: this.data.wattvar_yarray || '0.44 0.22 0'
            }
        ];

        // Economic parameters (for Economic Analysis)
        this.economicParameters = [
            { id: 'cost_per_unit_by_currency', label: 'Cost per unit', description: 'Cost per unit for Economic Analysis CAPEX calculation', type: 'text', value: '' }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Storage Parameters</strong><br>Set parameters for energy storage (BESS). <b>Power</b> &amp; <b>Energy</b> – shared pandapower/OpenDSS parameters. <b>Configuration</b> – naming, phases, connection. <b>Optimization (OPF)</b> – pandapower optimal power flow limits. <b>OpenDSS Parameters</b> – dispatch, efficiency, triggers. <b>Inverter Control</b> – fixed Q/PF or Q-V droop (OpenDSS InvControl). See tutorial <code>templates/tutorials/bess_weak_grid_overvoltage.md</code> and the <a href="https://electrisim.com/documentation.html#storage" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
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
        const energyTab = this.createTab('Energy', 'energy', this.currentTab === 'energy');
        const configTab = this.createTab('Configuration', 'config', this.currentTab === 'config');
        const optimizationTab = this.createTab('Optimization (OPF)', 'optimization', this.currentTab === 'optimization');
        const opendssTab = this.createTab('OpenDSS Parameters', 'opendss', this.currentTab === 'opendss');
        const qCapTab = this.createTab('Q capability', 'qcapability', this.currentTab === 'qcapability');
        const inverterTab = this.createTab('Inverter Control', 'inverter', this.currentTab === 'inverter');
        const economicTab = this.createTab('Economic', 'economic', this.currentTab === 'economic');
        
        tabContainer.appendChild(powerTab);
        tabContainer.appendChild(energyTab);
        tabContainer.appendChild(configTab);
        tabContainer.appendChild(optimizationTab);
        tabContainer.appendChild(qCapTab);
        tabContainer.appendChild(opendssTab);
        tabContainer.appendChild(inverterTab);
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
        this._mountQSetpointHint(powerContent);
        this._wrapQSetpointGroup(powerContent);
        const energyContent = this.createTabContent('energy', this.energyParameters);
        const configContent = this.createTabContent('config', this.configParameters);
        const optimizationContent = this.createTabContent('optimization', this.optimizationParameters);
        const qCapContent = StaticGeneratorDialog.prototype.createTabContent.call(this, 'qcapability', this.qCapabilityParameters);
        const qCapForm = qCapContent.querySelector('form');
        if (qCapForm) {
            StaticGeneratorDialog.prototype._mountQCapabilityChartPanel.call(this, qCapContent, qCapForm);
        }
        const opendssContent = this.createTabContent('opendss', this.opendssParameters);
        const inverterContent = this.createTabContent('inverter', this.inverterControlParameters);
        const economicContent = this.createTabContent('economic', this.economicParameters);

        const qCapPresetWrap = document.createElement('div');
        Object.assign(qCapPresetWrap.style, { padding: '0 16px 16px', marginTop: '4px' });
        const qCapPresetHint = document.createElement('div');
        Object.assign(qCapPresetHint.style, { fontSize: '12px', color: '#6c757d', marginBottom: '10px', lineHeight: '1.45' });
        qCapPresetHint.innerHTML = '<strong>BESS PCS envelope</strong> — four-quadrant kVA circle (STATCOM Q at P = 0). Built from <em>Nominal / Inverter Rating (MVA)</em> and charge/discharge Pmax, not the wind-turbine ±0.95 PF triangle.';
        qCapPresetWrap.appendChild(qCapPresetHint);
        qCapContent.appendChild(qCapPresetWrap);
        
        contentArea.appendChild(powerContent);
        contentArea.appendChild(energyContent);
        contentArea.appendChild(configContent);
        contentArea.appendChild(optimizationContent);
        contentArea.appendChild(qCapContent);
        contentArea.appendChild(opendssContent);
        contentArea.appendChild(inverterContent);
        contentArea.appendChild(economicContent);
        container.appendChild(contentArea);

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
            this.closeDialog();
        };

        applyButton.onclick = (e) => {
            e.preventDefault();
            const values = this.getFormValues();
            console.log('Storage values:', values);
            
            if (this.callback) {
                this.callback(values);
            }
            
            this.closeDialog();
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        this.container = container;
        
        // Tab click handlers
        const allTabs = [powerTab, energyTab, configTab, optimizationTab, qCapTab, opendssTab, inverterTab, economicTab];
        const allContents = [powerContent, energyContent, configContent, optimizationContent, qCapContent, opendssContent, inverterContent, economicContent];
        powerTab.onclick = () => this.switchTab('power', powerTab, allTabs.filter(t => t !== powerTab), powerContent, allContents.filter(c => c !== powerContent));
        energyTab.onclick = () => this.switchTab('energy', energyTab, allTabs.filter(t => t !== energyTab), energyContent, allContents.filter(c => c !== energyContent));
        configTab.onclick = () => this.switchTab('config', configTab, allTabs.filter(t => t !== configTab), configContent, allContents.filter(c => c !== configContent));
        optimizationTab.onclick = () => this.switchTab('optimization', optimizationTab, allTabs.filter(t => t !== optimizationTab), optimizationContent, allContents.filter(c => c !== optimizationContent));
        qCapTab.onclick = () => this.switchTab('qcapability', qCapTab, allTabs.filter(t => t !== qCapTab), qCapContent, allContents.filter(c => c !== qCapContent));
        opendssTab.onclick = () => this.switchTab('opendss', opendssTab, allTabs.filter(t => t !== opendssTab), opendssContent, allContents.filter(c => c !== opendssContent));
        inverterTab.onclick = () => this.switchTab('inverter', inverterTab, allTabs.filter(t => t !== inverterTab), inverterContent, allContents.filter(c => c !== inverterContent));
        economicTab.onclick = () => this.switchTab('economic', economicTab, allTabs.filter(t => t !== economicTab), economicContent, allContents.filter(c => c !== economicContent));

        this._wireStorageQSetpointHintListeners();
        this._wireBessPcsEnvelopeListeners();
        this._maybeReplaceLegacyWtgCurve();
        this._rebuildBessPcsEnvelopeIfPreset();

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
        if (tabId === 'economic' && parameters && parameters.length > 0 && parameters[0]?.id === 'cost_per_unit_by_currency') {
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
            const isNameField = param.id === 'name';
            const parameterRow = document.createElement('div');
            Object.assign(parameterRow.style, {
                display: 'grid',
                gridTemplateColumns: isNameField ? 'minmax(0, 1fr) minmax(300px, 1.2fr)' : '1fr 200px',
                gap: '20px',
                alignItems: 'start',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                minHeight: '80px'
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
            label.htmlFor = param.id;

            const description = document.createElement('div');
            Object.assign(description.style, {
                fontSize: '12px',
                color: '#6c757d',
                lineHeight: '1.4',
                fontStyle: 'italic',
                marginBottom: '4px'
            });
            description.textContent = param.description;

            leftColumn.appendChild(label);
            leftColumn.appendChild(description);

            // Right column: Input field with fixed width
            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minHeight: '60px',
                width: isNameField ? '100%' : '200px',
                ...(isNameField ? { minWidth: '0' } : {})
            });
            
            let input;
            
            // Handle different input types
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
                if (param.options && Array.isArray(param.options)) {
                    param.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        if (typeof option === 'object' && option !== null && 'value' in option) {
                            optionElement.value = String(option.value);
                            optionElement.textContent = option.label != null ? String(option.label) : String(option.value);
                        } else {
                            optionElement.value = String(option);
                            optionElement.textContent = String(option);
                        }
                        if (String(param.value) === optionElement.value) {
                            optionElement.selected = true;
                        }
                        input.appendChild(optionElement);
                    });
                }
                Object.assign(input.style, {
                    width: isNameField ? '100%' : '180px',
                    ...(isNameField ? { minWidth: '0' } : {}),
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
                
                input.addEventListener('focus', () => {
                    input.style.borderColor = '#007bff';
                    input.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
                });
                
                input.addEventListener('blur', () => {
                    input.style.borderColor = '#ced4da';
                    input.style.boxShadow = 'none';
                });
            } else {
                input = document.createElement('input');
                input.type = param.type;
                input.value = param.value;
                Object.assign(input.style, {
                    width: isNameField ? '100%' : '180px',
                    ...(isNameField ? { minWidth: '0' } : {}),
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
            rightColumn.appendChild(input);

            parameterRow.appendChild(leftColumn);
            parameterRow.appendChild(rightColumn);
            form.appendChild(parameterRow);
        });

        content.appendChild(form);
        return content;
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
        [...this.powerParameters, ...this.energyParameters, ...this.configParameters, ...this.optimizationParameters, ...(this.qCapabilityParameters || []), ...this.opendssParameters, ...this.inverterControlParameters, ...(this.economicParameters || [])].forEach(param => {
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
                } else {
                    values[param.id] = input.value;
                }
            }
        });
        
        return values;
    }
    
    destroy() {
        // Call parent destroy method
        super.destroy();
        
        // Clear global dialog flags to allow future dialogs
        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
        
        console.log('Storage dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== StorageDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.powerParameters, ...this.energyParameters, ...this.configParameters, ...this.optimizationParameters, ...this.opendssParameters].forEach(param => {
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
                
                const energyParam = this.energyParameters.find(p => p.id === attributeName);
                if (energyParam) {
                    const oldValue = energyParam.value;
                    if (energyParam.type === 'checkbox') {
                        energyParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        energyParam.value = attributeValue;
                    }
                    console.log(`  Updated energy ${attributeName}: ${oldValue} → ${energyParam.value}`);
                }
                
                const configParam = this.configParameters.find(p => p.id === attributeName);
                if (configParam) {
                    const oldValue = configParam.value;
                    if (configParam.type === 'checkbox') {
                        configParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        configParam.value = attributeValue;
                    }
                    console.log(`  Updated config ${attributeName}: ${oldValue} → ${configParam.value}`);
                }
                
                const optimizationParam = this.optimizationParameters.find(p => p.id === attributeName);
                if (optimizationParam) {
                    const oldValue = optimizationParam.value;
                    if (optimizationParam.type === 'checkbox') {
                        optimizationParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        optimizationParam.value = attributeValue;
                    }
                    console.log(`  Updated optimization ${attributeName}: ${oldValue} → ${optimizationParam.value}`);
                }

                const opendssParam = this.opendssParameters.find(p => p.id === attributeName);
                if (opendssParam) {
                    const oldValue = opendssParam.value;
                    if (opendssParam.type === 'checkbox') {
                        opendssParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        opendssParam.value = attributeValue;
                    }
                    console.log(`  Updated OpenDSS ${attributeName}: ${oldValue} → ${opendssParam.value}`);
                }

                const inverterParam = this.inverterControlParameters.find(p => p.id === attributeName);
                if (inverterParam) {
                    const oldValue = inverterParam.value;
                    if (inverterParam.type === 'checkbox') {
                        inverterParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        inverterParam.value = attributeValue;
                    }
                    console.log(`  Updated Inverter ${attributeName}: ${oldValue} → ${inverterParam.value}`);
                }
                
                const qCapParam = (this.qCapabilityParameters || []).find(p => p.id === attributeName);
                if (qCapParam) {
                    const oldValue = qCapParam.value;
                    if (qCapParam.type === 'checkbox') {
                        qCapParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        qCapParam.value = attributeValue;
                    }
                    console.log(`  Updated Q capability ${attributeName}: ${oldValue} → ${qCapParam.value}`);
                }

                const economicParam = (this.economicParameters || []).find(p => p.id === attributeName);
                if (economicParam) {
                    economicParam.value = attributeValue;
                    this.data[attributeName] = attributeValue;
                }
                
                if (!powerParam && !energyParam && !configParam && !optimizationParam && !qCapParam && !opendssParam && !inverterParam && !economicParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.powerParameters, ...this.energyParameters, ...this.configParameters, ...this.optimizationParameters, ...this.opendssParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        console.log('=== StorageDialog.populateDialog completed ===');
        if (this.inputs && this.inputs.size) {
            this._maybeReplaceLegacyWtgCurve();
        }
    }

    _mountQSetpointHint(powerContent) {
        return StaticGeneratorDialog.prototype._mountQSetpointHint.call(this, powerContent);
    }

    _wrapQSetpointGroup(powerContent) {
        return StaticGeneratorDialog.prototype._wrapQSetpointGroup.call(this, powerContent);
    }

    _wireStorageQSetpointHintListeners() {
        return StaticGeneratorDialog.prototype._wireQSetpointHintListeners.call(this);
    }

    _updateQSetpointHint() {
        const hint = this._qSetpointHintEl;
        if (!hint) return;

        const pIn = this.inputs.get('p_mw');
        const qIn = this.inputs.get('q_mvar');
        const modeIn = this.inputs.get('q_setpoint_mode');
        const curveCb = this.inputs.get('reactive_capability_curve');
        const styleIn = this.inputs.get('curve_style');
        const jsonTa = this.inputs.get('q_capability_curve_json');

        const curveOn = curveCb ? curveCb.checked : false;
        const mode = modeIn ? modeIn.value : 'manual';
        if (!curveOn || mode === 'manual') {
            hint.style.display = 'none';
            return;
        }

        const attrs = {
            reactive_capability_curve: curveOn,
            q_capability_curve_json: jsonTa ? jsonTa.value : '',
            curve_style: styleIn ? styleIn.value : 'straightLineYValues',
            q_setpoint_mode: mode,
            q_mvar: qIn ? parseFloat(qIn.value) : 0
        };
        const pAbs = Math.abs(parseFloat(pIn && pIn.value) || 0);
        const result = resolveStorageQSetpoint(pAbs, attrs);
        const fmt = (v) => (Number.isFinite(v) ? (Math.round(v * 1000) / 1000).toString() : '—');

        if (!result.fromCurve) {
            hint.style.display = 'none';
            return;
        }
        hint.style.display = 'block';
        let modeText = 'capacitive max';
        if (result.sourceLabel === 'inductive_max') modeText = 'inductive max';
        hint.innerHTML =
            `Load flow uses <strong>${fmt(result.qEffective)} MVar</strong> from the Q capability curve ` +
            `(${modeText} at |P| = ${fmt(pAbs)} MW).`;
    }

    _storageRatingsFromInputs() {
        const val = (id) => {
            const el = this.inputs.get(id);
            return el ? el.value : this.data[id];
        };
        return resolveBessPcsRatings({
            sn_mva: val('sn_mva'),
            p_mw: val('p_mw'),
            max_p_mw: val('max_p_mw'),
            min_p_mw: val('min_p_mw')
        });
    }

    _wireBessPcsEnvelopeListeners() {
        const rebuild = () => this._rebuildBessPcsEnvelopeIfPreset();
        ['sn_mva', 'max_p_mw', 'min_p_mw', 'p_mw'].forEach((id) => {
            const el = this.inputs.get(id);
            if (!el) return;
            el.addEventListener('change', rebuild);
            el.addEventListener('input', rebuild);
        });
        const preset = this.inputs.get('q_capability_preset');
        if (preset) {
            preset.addEventListener('change', () => {
                if (preset.value !== BESS_PCS_CUSTOM) {
                    const cb = this.inputs.get('reactive_capability_curve');
                    if (cb) cb.checked = true;
                    this._rebuildBessPcsEnvelopeIfPreset(true);
                }
            });
        }
        const cb = this.inputs.get('reactive_capability_curve');
        if (cb) {
            cb.addEventListener('change', () => {
                if (cb.checked) this._maybeReplaceLegacyWtgCurve();
                this._rebuildBessPcsEnvelopeIfPreset();
            });
        }
        const ta = this.inputs.get('q_capability_curve_json');
        if (ta) {
            ta.addEventListener('input', () => {
                if (this._qcapProgrammaticJsonUpdate) return;
                const presetEl = this.inputs.get('q_capability_preset');
                if (presetEl) presetEl.value = BESS_PCS_CUSTOM;
            });
        }
    }

    _maybeReplaceLegacyWtgCurve() {
        const ta = this.inputs.get('q_capability_curve_json');
        const pts = parseCurvePoints(ta ? ta.value : '');
        if (!looksLikeWtgPfTriangle(pts)) return;
        const presetEl = this.inputs.get('q_capability_preset');
        if (presetEl) presetEl.value = BESS_PCS_CIRCLE;
        this._rebuildBessPcsEnvelopeIfPreset(true);
    }

    _rebuildBessPcsEnvelopeIfPreset(force = false) {
        const presetEl = this.inputs.get('q_capability_preset');
        const preset = presetEl ? presetEl.value : (this.data.q_capability_preset || BESS_PCS_CIRCLE);
        if (!force && preset === BESS_PCS_CUSTOM) return;
        if (preset !== BESS_PCS_CIRCLE && preset !== BESS_PCS_D_SHAPE) return;
        const ta = this.inputs.get('q_capability_curve_json');
        if (!ta) return;
        const { sn, pMax } = this._storageRatingsFromInputs();
        const pts = buildBessPcsEnvelopePoints(sn, pMax, preset);
        StaticGeneratorDialog.prototype._setQCapabilityJsonProgrammatically.call(
            this, ta, JSON.stringify(pts)
        );
        if (typeof this._qCapabilityChartRedraw === 'function') {
            this._qCapabilityChartRedraw();
        }
        this._updateQSetpointHint();
    }
}

// Chart helpers live on StaticGeneratorDialog; mount/redraw call them as `this._redraw…`.
[
    '_redrawQCapabilityChartSvg',
    '_showQCapKnotTooltip',
    '_hideQCapKnotTooltip',
    '_setQCapabilityJsonProgrammatically',
    '_tryAttachQCapabilityTemplateFromJsonString',
    '_mountQCapabilityChartPanel'
].forEach((name) => {
    StorageDialog.prototype[name] = StaticGeneratorDialog.prototype[name];
});

/** Fixed-PF Q for storage. Lagging = absorb Q (q_mvar > 0); leading = inject Q (q_mvar < 0). */
export function resolveStorageFixedPf(p_mw, attrs = {}) {
    const p = Number(p_mw);
    const charging = Number.isFinite(p) && p > 0;
    let magRaw = charging ? (attrs.pf_charge ?? attrs.pf) : attrs.pf;
    let mode = charging
        ? (attrs.pf_charge_q_mode || attrs.pf_q_mode || 'lagging')
        : (attrs.pf_q_mode || 'lagging');
    const magNum = parseFloat(magRaw);
    if (Number.isFinite(magNum) && magNum < 0) {
        mode = 'leading';
    }
    const mag = Math.abs(Number.isFinite(magNum) ? magNum : 1);
    const leading = String(mode).toLowerCase() === 'leading';
    let q_mvar = 0;
    if (Number.isFinite(p) && Math.abs(p) > 1e-9 && mag < 0.999 && mag >= 0.5) {
        const qAbs = Math.abs(p) * Math.tan(Math.acos(Math.min(0.999999, mag)));
        q_mvar = leading ? -qAbs : qAbs;
    }
    return { mag, leading, q_mvar, mode: leading ? 'leading' : 'lagging' };
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsStorage = [defaultStorageData];

export const columnDefsStorage = [  
    {
        field: "name",
        headerTooltip: "Name of the storage",
        maxWidth: 150
    },
    {
        field: "p_mw",
        headerTooltip: "The momentary active power of the storage (positive for charging, negative for discharging)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "max_e_mwh",
        headerTooltip: "The maximum energy content of the storage (maximum charge level)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "q_mvar",
        headerTooltip: "The reactive power of the storage",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "sn_mva",
        headerTooltip: "Nominal power of the storage",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "soc_percent",
        headerTooltip: "The state of charge of the storage",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "min_e_mwh",
        headerTooltip: "The minimum energy content of the storage (minimum charge level)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "scaling",
        headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplies with p_mw and q_mvar.",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "type",
        headerTooltip: "Type variable to classify the storage",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the storage is in service (True/False)",
        maxWidth: 100
    }
];
  
export const gridOptionsStorage = {
    columnDefs: columnDefsStorage,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsStorage,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsStorage = gridOptionsStorage;
globalThis.rowDefsStorage = rowDefsStorage;
globalThis.columnDefsStorage = columnDefsStorage;
globalThis.StorageDialog = StorageDialog;

// Override the default StorageDialog behavior
window.addEventListener('load', function() {
    // Store the original StorageDialog
    var originalStorageDialog = window.StorageDialog;
    
    // Override StorageDialog
    window.StorageDialog = function(editorUi, fn, rowLimit) {
        // Skip the dialog and directly use Device Storage
        editorUi.setMode(App.MODE_DEVICE, true);
        fn();
        return {
            container: document.createElement('div') // Return empty container since we're not showing the dialog
        };
    };
});
  
  
  
  