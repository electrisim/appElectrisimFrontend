import { OPF_COST_CURRENCY_OPTIONS } from './opfCostCurrency.js';

export const BOOLEAN_STRING_VALUES = ['true', 'false'];

/** Keep in sync with Q_SETPOINT_MODE_OPTIONS in staticGeneratorDialog.js */
export const Q_SETPOINT_MODE_GRID_VALUES = ['manual', 'capacitive_max', 'inductive_max'];

export const Q_SETPOINT_MODE_GRID_LABELS = {
    manual: 'Manual (Power tab)',
    capacitive_max: 'Capacitive max (q_max from curve)',
    inductive_max: 'Inductive max (q_min from curve)'
};

/** Fields stored as "true" / "false" strings — use dropdown in Components Data grid. */
export const COMPONENTS_DATA_BOOLEAN_FIELDS = new Set([
    'reactive_capability_curve',
    'current_source',
    'in_service',
    'controllable',
    'slack',
    'discrete_tap_control',
    'tap_phase_shifter',
]);

const qSetpointLabels = Q_SETPOINT_MODE_GRID_LABELS;

const opfCurrencyLabels = Object.fromEntries(
    OPF_COST_CURRENCY_OPTIONS.map((o) => [o.code, o.label])
);

/** Fixed select-field configs keyed by diagram attribute name. */
export const COMPONENTS_DATA_SELECT_FIELDS = {
    q_setpoint_mode: {
        values: Q_SETPOINT_MODE_GRID_VALUES,
        labels: qSetpointLabels,
        headerTooltip:
            'Load flow Q setpoint — click cell to choose manual, capacitive max (q_max), or inductive max (q_min). Use Fill down to apply to multiple rows.'
    },
    generator_type: {
        values: ['current_source', 'async', 'async_doubly_fed'],
        headerTooltip: 'Static generator type for short-circuit calculations'
    },
    curve_style: {
        values: ['straightLineYValues', 'constantYValue'],
        labels: {
            straightLineYValues: 'Straight line between points',
            constantYValue: 'Constant Q to next P'
        },
        headerTooltip: 'P–Q capability curve interpolation style (pandapower)'
    },
    tap_side: {
        values: ['hv', 'lv', 'mv'],
        headerTooltip: 'Side where the tap changer is located'
    },
    control_side: {
        values: ['hv', 'lv', 'mv'],
        headerTooltip: 'Side used for discrete tap / voltage control'
    },
    opf_cost_currency: {
        values: OPF_COST_CURRENCY_OPTIONS.map((o) => o.code),
        labels: opfCurrencyLabels,
        headerTooltip: 'OPF marginal cost currency label'
    },
    conn: {
        values: ['wye', 'delta'],
        headerTooltip: 'OpenDSS connection type'
    },
    connection_type: {
        values: ['wye', 'delta'],
        labels: { wye: 'wye', delta: 'delta' },
        headerTooltip: 'Element connection type (wye / delta)'
    },
    bus_type: {
        values: ['b', 'n'],
        labels: { b: 'b (PQ bus)', n: 'n (auxiliary bus)' },
        headerTooltip: 'Bus type for power flow'
    }
};

function _collectColumnValues(rowData, field) {
    const out = [];
    for (let i = 0; i < rowData.length; i++) {
        const v = rowData[i]?.[field];
        if (v == null || v === '' || v === 'N/A') continue;
        out.push(String(v).trim());
    }
    return out;
}

function _allValuesInSet(values, allowed) {
    if (!values.length) return false;
    const norm = (v) => String(v).toLowerCase();
    const allow = new Set([...allowed].map(norm));
    return values.every((v) => allow.has(norm(v)));
}

/**
 * Resolve AG Grid select editor config for a Components Data column.
 * @param {string} field
 * @param {Array<object>} rowData
 * @returns {{ values: string[], labels?: object, headerTooltip?: string }|null}
 */
export function resolveComponentsDataColumnEditor(field, rowData) {
    if (COMPONENTS_DATA_BOOLEAN_FIELDS.has(field)) {
        return {
            values: BOOLEAN_STRING_VALUES,
            headerTooltip: 'true / false — click cell to toggle via dropdown'
        };
    }

    const fixed = COMPONENTS_DATA_SELECT_FIELDS[field];
    if (fixed) {
        return fixed;
    }

    if (field === 'type' && Array.isArray(rowData) && rowData.length) {
        const vals = _collectColumnValues(rowData, 'type');
        if (_allValuesInSet(vals, ['wye', 'delta'])) {
            return COMPONENTS_DATA_SELECT_FIELDS.connection_type;
        }
        if (_allValuesInSet(vals, ['b', 'n'])) {
            return COMPONENTS_DATA_SELECT_FIELDS.bus_type;
        }
    }

    return null;
}

/**
 * Apply select/boolean editor settings to an AG Grid column definition.
 * @param {string} field
 * @param {Array<object>} rowData
 * @param {object} colDef
 * @returns {boolean} true if a select editor was applied
 */
export function applyComponentsDataColumnEditor(field, rowData, colDef) {
    const cfg = resolveComponentsDataColumnEditor(field, rowData);
    if (!cfg) return false;

    colDef.cellEditor = 'agSelectCellEditor';
    colDef.cellEditorParams = { values: cfg.values };
    if (cfg.labels) {
        colDef.valueFormatter = (params) => {
            const v = params.value;
            if (v == null || v === '') return '';
            return cfg.labels[v] || cfg.labels[String(v)] || String(v);
        };
    }
    if (cfg.headerTooltip) {
        colDef.headerTooltip = cfg.headerTooltip;
    }
    return true;
}

/**
 * Whether a read-only topology column should become editable because it has a known enum editor.
 */
export function isComponentsDataEnumColumn(field, rowData) {
    if (field === 'type') {
        return resolveComponentsDataColumnEditor('type', rowData) != null;
    }
    return COMPONENTS_DATA_BOOLEAN_FIELDS.has(field) ||
        Object.prototype.hasOwnProperty.call(COMPONENTS_DATA_SELECT_FIELDS, field);
}
