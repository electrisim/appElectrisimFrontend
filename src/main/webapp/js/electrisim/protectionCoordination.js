// protectionCoordination.js - Protection Coordination study entry point.
//
// Workflow:
//  1. window.protectionCoordinationPandaPower(a, b, c) is invoked from the
//     "Protection Coordination" menu action registered in app.min.js.
//  2. We open ProtectionCoordinationDialog (Fault / Grading / Output tabs).
//  3. On Apply we collect the network using the shared prepareNetworkData helper
//     (so every other Pandapower analysis stays in sync) and augment Switch
//     entries with their protection_* attributes (these are not part of the
//     standard switch attribute map; see configureAttributes.js / switchDialog.js).
//  4. The payload is POSTed to the backend, which dispatches to
//     pandapower_electrisim.protection_coordination().
//  5. The response is shown via ProtectionCoordinationResultsDialog.

import { ProtectionCoordinationDialog } from './dialogs/ProtectionCoordinationDialog.js';
import { ProtectionCoordinationResultsDialog } from './dialogs/ProtectionCoordinationResultsDialog.js';
import ENV from './config/environment.js';

// The list of protection-coordination-specific attributes we copy from each Switch
// cell into the backend payload (in addition to the standard switch attributes
// pulled by prepareNetworkData).
const PROTECTION_ATTRS = [
    'protection_type',
    'oc_relay_type',
    'curve_type',
    'tms',
    't_grade',
    't_gg',
    't_g',
    't_diff',
    'pickup_mode',
    'I_s_a',
    'I_g_a',
    'I_gg_a',
    'fuse_type',
    'fuse_mode',
    'fuse_custom_std_json',
    'rated_i_a',
    'overload_factor',
    'ct_current_factor',
    'safety_factor'
];

function readSwitchProtectionAttrs(cell) {
    const out = {};
    if (!cell || !cell.value || !cell.value.attributes) return out;
    const attrs = cell.value.attributes;
    for (let i = 0; i < attrs.length; i++) {
        const name = attrs[i].nodeName;
        if (PROTECTION_ATTRS.includes(name)) {
            out[name] = attrs[i].nodeValue;
        }
    }
    return out;
}

function _fmtProtVal(v, digits = 3) {
    if (v == null || v === '') return '-';
    const n = Number(v);
    if (!isFinite(n)) return '-';
    return n.toFixed(digits);
}

function _formatPickupSummary(settings) {
    const parts = [];
    if (settings.I_s_a != null) {
        parts.push(`I_s=${_fmtProtVal(settings.I_s_a)} A (overload / IDMT pickup)`);
    } else if (settings.I_s != null) {
        parts.push(`I_s=${_fmtProtVal(settings.I_s)} kA (overload / IDMT pickup)`);
    }
    if (settings.I_g_a != null) {
        parts.push(`I_g=${_fmtProtVal(settings.I_g_a)} A (primary / t> pickup)`);
    } else if (settings.I_g != null) {
        parts.push(`I_g=${_fmtProtVal(settings.I_g)} kA (primary / t> pickup)`);
    }
    if (settings.I_gg_a != null) {
        parts.push(`I_gg=${_fmtProtVal(settings.I_gg_a)} A (instantaneous / t>> pickup)`);
    } else if (settings.I_gg != null) {
        parts.push(`I_gg=${_fmtProtVal(settings.I_gg)} kA (instantaneous / t>> pickup)`);
    }
    if (settings.rated_i_a != null) {
        parts.push(`I_rated=${_fmtProtVal(settings.rated_i_a)} A`);
    }
    if (settings.pickup_current != null) {
        parts.push(`I_pickup=${_fmtProtVal(settings.pickup_current)} A`);
    }
    return parts.length ? parts.join('; ') : '-';
}

function _appendDeviceSettingsSection(lines, dataJson) {
    const devices = dataJson.devices || [];
    lines.push('--- PROTECTION DEVICE SETTINGS ---');
    lines.push('Computed/stored settings for each switch with an attached protection device.');
    lines.push('OCR: overload pickup (I_s / I_g), overload delay (t_g or TMS+t_grade), instantaneous (I_gg, t_gg). Fuse: I_rated + curve.');
    lines.push('Earth-fault (EF) pickup is not modeled in Electrisim.');
    lines.push('');

    if (!devices.length) {
        lines.push('  (no device settings in response — check attach_summaries below)');
        lines.push('');
        return;
    }

    devices.forEach((d) => {
        const s = d.settings || {};
        const name = d.user_friendly_name || d.switch_name || d.switch_id || '?';
        lines.push(`  Switch: ${name}`);
        lines.push(`    Type: ${d.type || '-'} / ${d.subtype || '-'}`);
        lines.push(`    Curve: ${d.curve_type || '-'}`);
        if (s.tms != null) lines.push(`    TMS: ${s.tms}`);
        if (s.t_grade != null) lines.push(`    t_grade [s] (overload grading delay): ${s.t_grade}`);
        if (s.t_g != null) lines.push(`    t_g [s] (primary / overload trip time): ${s.t_g}`);
        if (s.t_gg != null) lines.push(`    t_gg [s] (instantaneous trip time): ${s.t_gg}`);
        lines.push(`    Pickup: ${_formatPickupSummary(s)}`);
        if (s.overload_factor != null) lines.push(`    overload_factor: ${s.overload_factor}`);
        if (s.ct_current_factor != null) lines.push(`    ct_current_factor: ${s.ct_current_factor}`);
        if (s.safety_factor != null) lines.push(`    safety_factor: ${s.safety_factor}`);
        lines.push('');
    });
}

function _appendAttachSummariesSection(lines, dataJson) {
    const summaries = dataJson.attach_summaries || [];
    const skipped = summaries.filter(s => !s.attached);
    if (!skipped.length) return;
    lines.push('--- DEVICES NOT ATTACHED ---');
    skipped.forEach(s => {
        lines.push(`  ${s.user_friendly_name || s.switch_name || s.switch_id || '?'}: ${s.reason || 'unknown'}`);
    });
    lines.push('');
}

function downloadProtectionResultsText(dataJson) {
    try {
        const lines = [];
        lines.push('========================================');
        lines.push('   Pandapower Protection Coordination Results');
        lines.push('========================================');
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push('');
        if (dataJson.summary) {
            const s = dataJson.summary;
            lines.push('--- SUMMARY ---');
            lines.push(`Converged: ${s.converged}`);
            lines.push(`Devices attached: ${s.n_attached}/${s.n_devices}`);
            lines.push(`Scenarios: ${s.n_scenarios}`);
            lines.push(`Tripped (total across scenarios): ${s.n_tripped}`);
            lines.push(`Miscoordination warnings: ${s.n_miscoordination}`);
            lines.push(`Fault type: ${s.fault_type}, case: ${s.case}, t_diff: ${s.t_diff_s}s`);
            if (s.fault_location_mode) {
                lines.push(`Fault location mode: ${s.fault_location_mode}`);
            }
            if (s.scenario_warning) {
                lines.push(`WARNING: ${s.scenario_warning}`);
            }
            lines.push('');
        }

        _appendDeviceSettingsSection(lines, dataJson);
        _appendAttachSummariesSection(lines, dataJson);

        lines.push('--- FAULT SCENARIOS & TRIP RESULTS ---');
        const scenarios = dataJson.scenarios || [];
        if (!scenarios.length) {
            const warn = dataJson.summary?.scenario_warning
                || dataJson.warning
                || 'No fault scenarios were run — trip results are empty.';
            lines.push(`  ${warn}`);
            if (dataJson.summary?.fault_location_mode === 'line') {
                lines.push('  Tip: models without lines need Fault location → "At selected busbar" and a chosen bus.');
            }
            lines.push('');
        }
        scenarios.forEach((sc, idx) => {
            const loc = sc.fault_location_mode === 'bus'
                ? `bus fault at ${sc.fault_bus ?? '?'}`
                : `line ${sc.sc_line_id}, fraction=${sc.sc_fraction}, fault bus=${sc.fault_bus ?? '?'}`;
            lines.push(`--- SCENARIO ${idx + 1} (${loc}) ---`);
            if (sc.short_circuit && sc.short_circuit.ikss_ka != null) {
                lines.push(`  Short-circuit at fault bus: Ikss=${sc.short_circuit.ikss_ka} kA`);
            }
            if (sc.error) {
                lines.push(`ERROR: ${sc.error}`);
            } else {
                (sc.trip || []).forEach(t => {
                    const act = t.activation_parameter_value != null ? t.activation_parameter_value : t.ikss_ka;
                    const melt = t.trip_melt_time_s != null ? t.trip_melt_time_s : t.t_melt_s;
                    lines.push(
                        `  ${t.user_friendly_name || t.switch_id || '?'} [${t.device}] ` +
                        `tripped=${t.tripped} ` +
                        `activation_parameter_value=${act ?? '-'} ` +
                        `trip_melt_time_s=${melt ?? '-'} s ` +
                        `t_trip=${t.t_trip_s ?? '-'} s ` +
                        `ikss=${t.ikss_ka ?? '-'} kA`
                    );
                });
            }
            lines.push('');
        });
        if (dataJson.miscoordination && dataJson.miscoordination.length) {
            lines.push('--- MISCOORDINATION ---');
            dataJson.miscoordination.forEach(m => {
                lines.push(`  primary=${m.primary_user_friendly_name} (t=${m.primary_t_s}s) | backup=${m.backup_user_friendly_name} (t=${m.backup_t_s}s) | Δt=${m.delta_t_s}s (< ${m.required_t_diff_s}s)`);
            });
            lines.push('');
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `protection_coordination_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Failed to download protection results:', e);
    }
}

async function postProtectionPayload(payload) {
    const url = ENV.backendUrl + '/';
    console.log('[Protection Coordination] POST', url);
    const response = await fetch(url, {
        mode: 'cors',
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Backend returned ${response.status}: ${text || response.statusText}`);
    }
    return response.json();
}

// Build the JSON payload by reusing prepareNetworkData (so we collect every other
// element exactly the way Load Flow / Short Circuit / Contingency do) and then
// adding protection attributes onto the Switch entries.
async function buildPayloadFromGraph(graph, dialogValues) {
    // Dynamic import keeps protectionCoordination.js a leaf module that does not
    // force the heavy loadFlow.js to be parsed up front.
    const { prepareNetworkData } = await import('./utils/networkDataPreparation.js');

    const userEmail = (() => {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const u = JSON.parse(userStr);
                if (u && u.email) return u.email;
            }
        } catch (e) { /* ignore */ }
        return 'unknown@user.com';
    })();

    const simulationParameters = {
        typ: 'ProtectionCoordinationPandaPower',
        user_email: userEmail,
        // Mirror keys read by the Flask dispatch in app.py.
        fault_type: dialogValues.fault_type || '3ph',
        case: dialogValues.case || 'max',
        fault_location_mode: dialogValues.fault_location_mode || 'line',
        fault_bus_id: (dialogValues.fault_bus_id && String(dialogValues.fault_bus_id).trim()) || '',
        sc_line_id: (dialogValues.sc_line_id === undefined || dialogValues.sc_line_id === null || String(dialogValues.sc_line_id).trim().toLowerCase() === 'all')
            ? 'all'
            : String(dialogValues.sc_line_id).trim(),
        sc_fraction: parseFloat(dialogValues.sc_fraction) || 0.5,
        grading_mode: dialogValues.grading_mode || 'auto',
        curve_type: dialogValues.curve_type || 'standard_inverse',
        t_diff: parseFloat(dialogValues.t_diff) || 0.3,
        t_g: parseFloat(dialogValues.t_g) || 0.5,
        t_gg: parseFloat(dialogValues.t_gg) || 0.07,
        tms: parseFloat(dialogValues.tms) || 1.0,
        t_grade: parseFloat(dialogValues.t_grade) || 0.5,
        overload_factor: parseFloat(dialogValues.overload_factor) || 1.25,
        ct_current_factor: parseFloat(dialogValues.ct_current_factor) || 1.2,
        safety_factor: parseFloat(dialogValues.safety_factor) || 1.0,
        export_results: !!dialogValues.export_results,
        show_curves: dialogValues.show_curves !== false,
        show_table: dialogValues.show_table !== false,
        show_miscoordination: dialogValues.show_miscoordination !== false
    };

    const payload = prepareNetworkData(graph, simulationParameters, { removeResultCells: false });

    // Augment Switch entries with their protection_* attributes by reading them
    // directly from the cell - getAttributesAsObject only collects the keys it
    // is explicitly given, and protection_* are not part of the default switch map.
    const model = graph.getModel();
    Object.keys(payload).forEach(key => {
        const entry = payload[key];
        if (!entry || typeof entry !== 'object' || !entry.typ) return;
        if (!String(entry.typ).startsWith('Switch')) return;
        const cell = model.getCell(entry.id) || model.getCell(entry.name);
        const protAttrs = readSwitchProtectionAttrs(cell);
        Object.assign(entry, protAttrs);
    });

    return payload;
}

function showResults(dataJson) {
    try {
        const dlg = new ProtectionCoordinationResultsDialog(dataJson);
        dlg.show();
    } catch (e) {
        console.error('Failed to show ProtectionCoordinationResultsDialog:', e);
        alert('Protection Coordination finished but the results dialog failed to open: ' + (e?.message || e));
    }
}

function protectionCoordinationPandaPower(a, b, c) {
    // a = App, b = Graph, c = Editor (same signature as shortCircuitPandaPower / contingencyAnalysisPandaPower).
    try {
        const graph = b || a?.editor?.graph || c?.graph;
        const editorUi = a || c || window.App?.main?.editor?.editorUi;

        const dialog = new ProtectionCoordinationDialog(editorUi);
        dialog.show(async (values) => {
            try {
                if (a && a.spinner && typeof a.spinner.spin === 'function') {
                    try { a.spinner.spin(document.body, 'Running Protection Coordination...'); } catch (e) { /* ignore */ }
                }
                const payload = await buildPayloadFromGraph(graph, values);
                const dataJson = await postProtectionPayload(payload);
                console.log('[Protection Coordination] response:', dataJson);

                if (dataJson && dataJson.error) {
                    alert('Protection Coordination: ' + (dataJson.message || 'unknown error'));
                }

                if (dataJson && !dataJson.error) {
                    const nScenarios = dataJson.summary?.n_scenarios ?? (dataJson.scenarios || []).length;
                    if (nScenarios === 0) {
                        const warn = dataJson.summary?.scenario_warning
                            || 'No fault scenarios were run. Use "At selected busbar" if the model has no lines.';
                        alert('Protection Coordination: ' + warn);
                    }
                    if (values.export_results) {
                        downloadProtectionResultsText(dataJson);
                    }
                }

                showResults(dataJson);
            } catch (err) {
                console.error('Protection Coordination request failed:', err);
                alert('Protection Coordination failed: ' + (err?.message || err));
            } finally {
                if (a && a.spinner && typeof a.spinner.stop === 'function') {
                    try { a.spinner.stop(); } catch (e) { /* ignore */ }
                }
            }
        });
    } catch (e) {
        console.error('protectionCoordinationPandaPower failed to start:', e);
        alert('Protection Coordination could not be started: ' + (e?.message || e));
    }
}

// Expose both as a module export and on window for the legacy Action wiring in app.min.js.
window.protectionCoordinationPandaPower = protectionCoordinationPandaPower;
window.downloadProtectionCoordinationReport = downloadProtectionResultsText;
export { protectionCoordinationPandaPower, downloadProtectionResultsText };
export default protectionCoordinationPandaPower;
