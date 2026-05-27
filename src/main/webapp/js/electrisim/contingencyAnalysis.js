// Import ContingencyDialog
import { ContingencyDialog } from './dialogs/ContingencyDialog.js';
import { ContingencyResultsDialog } from './dialogs/ContingencyResultsDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import { buildGraphCellLookupMap, resolveGraphCellForResult, formatResultNameHeader } from './utils/attributeUtils.js';

const COLOR_STATES = {
    DANGER: 'red',
    WARNING: 'orange',
    GOOD: 'green'
};

const RESULT_BOX_STYLE = 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';

function normalizeResultRow(row) {
    if (!row) return row;
    return {
        ...row,
        id: row.id ?? row.bus_id ?? row.line_id ?? row.trafo_id ?? row.gen_id ?? row.load_id
    };
}

function formatNumber(num, decimals = 3) {
    if (num == null || num === '' || num === 'NaN' || (typeof num === 'number' && Number.isNaN(num))) {
        return 'N/A';
    }
    return parseFloat(num).toFixed(decimals);
}

function replaceUnderscores(name) {
    return String(name || '').replace('_', '#');
}

function updateCellColor(grafka, cell, color) {
    if (!cell || !grafka?.getModel) return;
    const style = grafka.getModel().getStyle(cell) || '';
    let newStyle;
    if (typeof mxUtils !== 'undefined' && typeof mxConstants !== 'undefined') {
        newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
    } else {
        newStyle = `${style};strokeColor=${color}`;
    }
    grafka.setCellStyle(newStyle, [cell]);
}

function processVoltageColor(grafka, cell, vmPu, limits = {}) {
    const n = Number(vmPu);
    if (!Number.isFinite(n)) return;
    const minV = Number(limits.min_vm_pu ?? 0.95);
    const maxV = Number(limits.max_vm_pu ?? 1.05);
    const span = Math.max(maxV - minV, 0.02);
    const warnBand = Math.min(0.02, span * 0.4);
    let color = COLOR_STATES.GOOD;
    if (n < minV || n > maxV) color = COLOR_STATES.DANGER;
    else if (n < minV + warnBand || n > maxV - warnBand) color = COLOR_STATES.WARNING;
    updateCellColor(grafka, cell, color);
}

function processLoadingColor(grafka, cell, loadingPercent, limits = {}) {
    const n = Number(loadingPercent);
    if (!Number.isFinite(n)) return;
    const maxLoading = Number(limits.max_loading_percent ?? 100);
    const warnLoading = Math.max(maxLoading * 0.9, maxLoading - 10);
    let color = COLOR_STATES.GOOD;
    if (n > maxLoading) color = COLOR_STATES.DANGER;
    else if (n > warnLoading) color = COLOR_STATES.WARNING;
    updateCellColor(grafka, cell, color);
}

function findResultPlaceholder(graph, parentCell) {
    const fn = typeof window !== 'undefined' && window.findResultPlaceholder;
    return fn ? fn(graph, parentCell) : null;
}

function insertResultBox(graph, parentCell, resultString, opts) {
    const fn = typeof window !== 'undefined' && window.insertResultBox;
    if (fn) return fn(graph, parentCell, resultString, opts);
    if (!graph || !parentCell) return null;
    return graph.insertVertex(parentCell, null, resultString, opts?.positionX ?? 0, opts?.positionY ?? 1.0, opts?.width ?? 70, opts?.height ?? 50, RESULT_BOX_STYLE, true);
}

function findResultPlaceholderForComponent(graph, componentCell) {
    const fn = typeof window !== 'undefined' && window.findResultPlaceholderForComponent;
    return fn ? fn(graph, componentCell) : findResultPlaceholder(graph, componentCell);
}

// Error handlers
const handleNetworkErrors = (dataJson) => {
    if (dataJson.error) {
        console.error('Network error:', dataJson.error);
        alert('Network error: ' + dataJson.error);
        return true;
    }
    
    if (dataJson.errors && dataJson.errors.length > 0) {
        console.error('Multiple network errors:', dataJson.errors);
        alert('Network errors: ' + dataJson.errors.join(', '));
        return true;
    }
    
    return false;
};

function createElementProcessors(cellLookupMap, graph, limits) {
    const resolveCell = (row) => resolveGraphCellForResult(cellLookupMap, normalizeResultRow(row), graph);

    return {
        bus: (busData, b, grafka) => {
            if (!busData || !Array.isArray(busData)) return;
            const model = b.getModel();

            busData.forEach((bus) => {
                try {
                    const row = normalizeResultRow(bus);
                    const resultCell = resolveCell(row);
                    if (!resultCell) {
                        console.warn('Contingency: bus cell not found for id=', row.id, 'name=', row.name);
                        return;
                    }

                    const label = formatResultNameHeader(resultCell, replaceUnderscores(row.name), 'Bus');
                    const resultString = `${label}
U[pu]: ${formatNumber(row.vm_pu)}
U[deg]: ${formatNumber(row.va_degree)}
P[MW]: ${formatNumber(row.p_mw)}
Q[MVar]: ${formatNumber(row.q_mvar)}
(worst-case N-1)`;

                    const existing = findResultPlaceholder(grafka, resultCell);
                    if (existing) {
                        model.setValue(existing, resultString);
                    } else {
                        insertResultBox(grafka, resultCell, resultString, {
                            width: 80,
                            height: 76,
                            positionX: 0,
                            positionY: 1.0,
                            offsetXDelta: 40,
                            offsetYDelta: 35
                        });
                    }
                    processVoltageColor(grafka, resultCell, row.vm_pu, limits);
                } catch (error) {
                    console.error('Error processing contingency bus data:', error);
                }
            });
        },

        line: (lineData, b, grafka) => {
            if (!lineData || !Array.isArray(lineData)) return;
            const model = b.getModel();

            lineData.forEach((line) => {
                try {
                    const row = normalizeResultRow(line);
                    const resultCell = resolveCell(row);
                    if (!resultCell) {
                        console.warn('Contingency: line cell not found for id=', row.id, 'name=', row.name);
                        return;
                    }

                    const label = formatResultNameHeader(resultCell, replaceUnderscores(row.name), 'Line');
                    const resultString = `${label}
P_from[MW]: ${formatNumber(row.p_from_mw)}
Q_from[MVar]: ${formatNumber(row.q_from_mvar)}
Loading[%]: ${formatNumber(row.loading_percent, 1)}
(worst-case N-1)`;

                    const existing = findResultPlaceholder(grafka, resultCell);
                    if (existing) {
                        model.setValue(existing, resultString);
                    } else {
                        const labelka = insertResultBox(grafka, resultCell, resultString, {
                            width: 70,
                            height: 70,
                            positionX: 0.5,
                            positionY: 0,
                            isLine: true
                        });
                        if (labelka && grafka.orderCells) grafka.orderCells(true, [labelka]);
                    }
                    processLoadingColor(grafka, resultCell, row.loading_percent, limits);
                } catch (error) {
                    console.error('Error processing contingency line data:', error);
                }
            });
        },

        transformer: (transformerData, b, grafka) => {
            if (!transformerData || !Array.isArray(transformerData)) return;
            const model = b.getModel();

            transformerData.forEach((trafo) => {
                try {
                    const row = normalizeResultRow(trafo);
                    const resultCell = resolveCell(row);
                    if (!resultCell) {
                        console.warn('Contingency: transformer cell not found for id=', row.id, 'name=', row.name);
                        return;
                    }

                    const label = formatResultNameHeader(resultCell, replaceUnderscores(row.name), 'Transformer');
                    const resultString = `${label}
P_HV[MW]: ${formatNumber(row.p_hv_mw)}
Q_HV[MVar]: ${formatNumber(row.q_hv_mvar)}
Loading[%]: ${formatNumber(row.loading_percent, 1)}
(worst-case N-1)`;

                    const existing = findResultPlaceholderForComponent(grafka, resultCell)
                        || findResultPlaceholder(grafka, resultCell);
                    if (existing) {
                        model.setValue(existing, resultString);
                    } else {
                        insertResultBox(grafka, resultCell, resultString, {
                            width: 70,
                            height: 70,
                            positionX: 0.5,
                            positionY: 0
                        });
                    }
                    processLoadingColor(grafka, resultCell, row.loading_percent, limits);
                } catch (error) {
                    console.error('Error processing contingency transformer data:', error);
                }
            });
        }
    };
}

function getUserEmailForContingency() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user?.email) return user.email;
        }
        if (typeof getCurrentUser === 'function') {
            const currentUser = getCurrentUser();
            if (currentUser?.email) return currentUser.email;
        }
        if (window.getCurrentUser?.()?.email) return window.getCurrentUser().email;
        if (window.authHandler?.getCurrentUser?.()?.email) {
            return window.authHandler.getCurrentUser().email;
        }
    } catch (error) {
        console.warn('Error getting user email:', error);
    }
    return 'unknown@user.com';
}

function contingencyAnalysisPandaPower(a, b, c) {

    // Main processing function (FROM BACKEND TO FRONTEND)
    async function processNetworkData(url, obj, b, grafka, limits = {}) {
        try {
            const response = await fetch(url, {
                mode: "cors",
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(obj)
            });

            if (response.status !== 200) {
                const errText = await response.text();
                let errMsg = errText || response.statusText;
                try {
                    const errJson = JSON.parse(errText);
                    if (errJson.error) errMsg = errJson.error;
                } catch (e) { /* ignore */ }
                alert('Network error: ' + errMsg);
                return;
            }

            let text = await response.text();
            text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
            const dataJson = JSON.parse(text);
            console.log('Contingency Analysis dataJson', dataJson);

            if (handleNetworkErrors(dataJson)) {
                return;
            }

            const cellLookupMap = buildGraphCellLookupMap(b);
            const elementProcessors = createElementProcessors(cellLookupMap, b, limits);
            const model = b.getModel();
            model.beginUpdate();
            try {
                Object.entries(elementProcessors).forEach(([type, processor]) => {
                    if (dataJson[type]) {
                        processor(dataJson[type], b, grafka);
                    }
                });
            } finally {
                model.endUpdate();
                if (b.getView && b.getView().refresh) {
                    b.getView().refresh();
                }
            }

            showContingencyResults(dataJson);

        } catch (err) {
            console.error('Error processing contingency analysis data:', err);
        } finally {
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
        }
    }

    function showContingencyResults(dataJson) {
        try {
            const dlg = new ContingencyResultsDialog(dataJson);
            dlg.show();
        } catch (error) {
            console.error('Failed to show ContingencyResultsDialog:', error);
            alert('Contingency analysis finished but the results dialog failed to open: ' + (error?.message || error));
        }
    }

    let apka = a
    let grafka = b
    //FROM FRONTEND TO BACKEND
    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        // Use ContingencyDialog directly
        const dialog = new ContingencyDialog(a);
        dialog.show(async function (params) {
            apka.spinner.spin(document.body, "Running Contingency Analysis...");

            try {
                const simulationParameters = {
                    typ: "ContingencyAnalysisPandaPower Parameters",
                    element_type: params?.[0] ?? 'line',
                    voltage_limits: params?.[1] ?? 'true',
                    thermal_limits: params?.[2] ?? 'true',
                    min_vm_pu: params?.[3] ?? '0.95',
                    max_vm_pu: params?.[4] ?? '1.05',
                    max_loading_percent: params?.[5] ?? '100',
                    user_email: getUserEmailForContingency()
                };

                const limits = {
                    min_vm_pu: parseFloat(params?.[3] ?? '0.95'),
                    max_vm_pu: parseFloat(params?.[4] ?? '1.05'),
                    max_loading_percent: parseFloat(params?.[5] ?? '100')
                };

                const obj = prepareNetworkData(b, simulationParameters, { removeResultCells: false });
                console.log('Contingency Analysis data being sent to backend:');
                console.log(JSON.stringify(obj, null, 2));
                console.log('Using backend URL:', ENV.backendUrl);

                await processNetworkData(ENV.backendUrl + "/", obj, b, grafka, limits);
            } catch (error) {
                console.error('Contingency analysis failed:', error);
                alert('Contingency analysis failed: ' + (error.message || error));
                if (typeof apka !== 'undefined' && apka.spinner) {
                    apka.spinner.stop();
                }
            }
        });
    }
}

// Make contingencyAnalysisPandaPower available globally
globalThis.contingencyAnalysisPandaPower = contingencyAnalysisPandaPower;

// Export for module usage
export { contingencyAnalysisPandaPower }; 