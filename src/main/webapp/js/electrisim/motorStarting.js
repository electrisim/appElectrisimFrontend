// motorStarting.js - Motor starting / voltage dip analysis engine
import { formatResultNameHeader } from './utils/attributeUtils.js';
import { MotorStartingDialog } from './dialogs/MotorStartingDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';
import {
    startSimulationProgress,
    settleSimulationProgress,
    formatDurationMs
} from './utils/simulationProgressOverlay.js';

window.motorStartingPandaPower = function (a, b, c) {
    const apka = a;
    const grafka = b;
    let simProgress = null;

    const STYLES = {
        label: {
            [mxConstants.STYLE_FONTSIZE]: '6',
            [mxConstants.STYLE_ALIGN]: 'ALIGN_LEFT'
        },
        line: {
            [mxConstants.STYLE_FONTSIZE]: '6',
            [mxConstants.STYLE_STROKE_OPACITY]: '0',
            [mxConstants.STYLE_STROKECOLOR]: 'white',
            [mxConstants.STYLE_STROKEWIDTH]: '0',
            [mxConstants.STYLE_OVERFLOW]: 'hidden'
        }
    };

    const formatNumber = (num, decimals = 3) => {
        if (num === null || num === undefined || num === 'NaN' || (typeof num === 'number' && isNaN(num))) {
            return 'N/A';
        }
        return parseFloat(num).toFixed(decimals);
    };

    const replaceUnderscores = (name) => String(name || '').replace('_', '#');

    function getUserEmail() {
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

    const resolveCell = (cell, graph, cellIdMap) => {
        const model = graph.getModel();
        const id = cell.id;
        const name = cell.name;
        const nameUnderscore = (name || '').replace('#', '_');
        const nameHash = (name || '').replace('_', '#');
        return (cellIdMap && (cellIdMap.get(id) || cellIdMap.get(nameUnderscore) || cellIdMap.get(nameHash)))
            || model.getCell(id)
            || model.getCell(nameUnderscore)
            || model.getCell(nameHash)
            || null;
    };

    function handleErrors(dataJson) {
        if (dataJson.error) {
            const msg = dataJson.message || 'Motor starting calculation failed.';
            const detail = dataJson.exception ? `\n\n${dataJson.exception}` : '';
            alert(msg + detail);
            return true;
        }
        return false;
    }

    const PASS_STYLE = 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#E8F5E9;strokeColor=#2E7D32;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=80;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#1B5E20;fontStyle=0;spacing=3';
    const FAIL_STYLE = 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#FFEBEE;strokeColor=#C62828;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=85;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#B71C1C;fontStyle=0;spacing=3';
    const NEUTRAL_STYLE = (typeof window !== 'undefined' && window.RESULT_BOX_STYLE)
        || 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';

    function upsertResultBox(graph, parent, resultString, style, size) {
        const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
        const insertFn = typeof window !== 'undefined' && window.insertResultBox;
        const existing = findFn ? findFn(graph, parent) : null;
        if (existing) {
            graph.getModel().setValue(existing, resultString);
            if (style) {
                try { graph.setCellStyle(style, [existing]); } catch (_) {}
            }
        } else if (insertFn) {
            const cell = insertFn(graph, parent, resultString, {
                width: size.w,
                height: size.h,
                positionX: 0,
                positionY: 1.0
            });
            if (cell && style) {
                try { graph.setCellStyle(style, [cell]); } catch (_) {}
            }
        } else {
            graph.insertVertex(parent, null, resultString, 0, 1.0, size.w, size.h, style || NEUTRAL_STYLE, true);
        }
    }

    const elementProcessors = {
        buses: (data, graph, _grafka, cellIdMap) => {
            data.forEach((cell) => {
                const resultCell = resolveCell(cell, graph, cellIdMap);
                if (!resultCell) {
                    console.warn('Motor starting: bus not found id=', cell.id, 'name=', cell.name);
                    return;
                }
                cell.name = replaceUnderscores(cell.name);
                const busLabel = formatResultNameHeader(resultCell, cell.name, 'Bus');
                const status = cell.pass === false ? 'FAIL' : 'PASS';
                const resultString = `${busLabel}
                Vbef[pu]: ${formatNumber(cell.vm_before)}
                Vdur[pu]: ${formatNumber(cell.vm_during)}
                Vaft[pu]: ${formatNumber(cell.vm_after)}
                Dip[%]: ${formatNumber(cell.dip_percent, 2)}
                ${status}`;
                const style = cell.pass === false ? FAIL_STYLE : PASS_STYLE;
                upsertResultBox(graph, resultCell, resultString, style, { w: 58, h: 72 });
            });
        },
        motors: (data, graph, _grafka, cellIdMap) => {
            data.forEach((cell) => {
                const resultCell = resolveCell(cell, graph, cellIdMap);
                if (!resultCell) return;
                cell.name = replaceUnderscores(cell.name);
                const motorLabel = formatResultNameHeader(resultCell, cell.name, 'Motor');
                const iStr = cell.i_start_ka != null
                    ? `Istart[kA]: ${formatNumber(cell.i_start_ka)}`
                    : `Istart[pu]: ${formatNumber(cell.i_start_pu)}`;
                const tStr = cell.start_time_s != null
                    ? `\n                tstart[s]: ${formatNumber(cell.start_time_s)}`
                    : '';
                const resultString = `${motorLabel}
                Method: ${cell.method || 'dol'}
                ${iStr}${tStr}`;
                upsertResultBox(graph, resultCell, resultString, NEUTRAL_STYLE, { w: 58, h: 58 });
            });
        }
    };

    async function processNetworkData(url, obj, graph, _grafka) {
        try {
            graph.getStylesheet().putCellStyle('labelstyle', STYLES.label);
            graph.getStylesheet().putCellStyle('lineStyle', STYLES.line);

            const overlay = simProgress?.overlay;
            overlay?.append('Sending request…', { time: true });
            const requestStart = performance.now();
            const response = await fetch(url, {
                mode: 'cors',
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip'
                },
                body: JSON.stringify(obj),
                signal: simProgress?.signal
            });

            if (response.status !== 200) {
                throw new Error('server');
            }

            let text = await response.text();
            text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
            const dataJson = JSON.parse(text);
            overlay?.append(`Response ${response.status} in ${formatDurationMs(performance.now() - requestStart)}`, { time: true });
            overlay?.append('Processing results…', { time: true });
            console.log('Motor starting backend response:', dataJson);

            if (handleErrors(dataJson)) {
                overlay?.remove();
                simProgress = null;
                return;
            }

            if (Array.isArray(dataJson.warnings) && dataJson.warnings.length > 0) {
                console.warn('Motor starting warnings:', dataJson.warnings);
            }

            const cellIdMap = new Map();
            const cells = graph.getModel().cells;
            if (cells && typeof cells === 'object') {
                Object.keys(cells).forEach((key) => {
                    const cell = cells[key];
                    if (cell && cell.id != null) {
                        cellIdMap.set(String(cell.id), cell);
                        if (cell.mxObjectId) {
                            cellIdMap.set(String(cell.mxObjectId), cell);
                            cellIdMap.set(String(cell.mxObjectId).replace('#', '_'), cell);
                            cellIdMap.set(String(cell.mxObjectId).replace('_', '#'), cell);
                        }
                    }
                });
            }

            const model = graph.getModel();
            model.beginUpdate();
            try {
                Object.entries(elementProcessors).forEach(([type, processor]) => {
                    if (dataJson[type]) {
                        processor(dataJson[type], graph, _grafka, cellIdMap);
                    }
                });
            } finally {
                model.endUpdate();
                if (graph.getView && graph.getView().refresh) {
                    graph.getView().refresh();
                }
            }

            // Detailed report dialog
            try {
                if (!window.MotorStartingResultsDialog) {
                    await import('./dialogs/MotorStartingResultsDialog.js');
                }
                if (window.MotorStartingResultsDialog) {
                    new window.MotorStartingResultsDialog(dataJson).show();
                }
            } catch (e) {
                console.warn('Motor starting results dialog failed:', e);
            }
            overlay?.append('Done.', { time: true });
            await settleSimulationProgress(overlay, null, simProgress?.abortController);
            simProgress = null;
        } catch (err) {
            const settled = await settleSimulationProgress(simProgress?.overlay, err, simProgress?.abortController);
            simProgress = null;
            if (settled.aborted) return;
            if (err.message === 'server') {
                alert('Motor starting server error. Check that the backend is running.');
                return;
            }
            alert('Error processing motor starting results. ' + err + '\n\nCheck input data or contact electrisim@electrisim.com');
        }
    }

    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        const dialog = new MotorStartingDialog(a);
        dialog.show(async function (values) {
            simProgress = startSimulationProgress({
                title: 'Motor starting progress',
                statusText: 'Running motor starting…',
                filePrefix: 'motor-starting'
            });
            simProgress.overlay.append('Preparing network data…', { time: true });

            if (!values || typeof values !== 'object') {
                simProgress.overlay.remove();
                simProgress = null;
                return;
            }

            const motorIds = values.motor_ids === 'all' || !values.motor_ids
                ? 'all'
                : values.motor_ids;

            const simulationParameters = {
                typ: 'MotorStartingPandaPower Parameters',
                mode: values.mode || 'steady',
                motor_ids: motorIds,
                starting_method: values.starting_method || 'dol',
                i_limit_pu: values.i_limit_pu || '3',
                at_tap_pu: values.at_tap_pu || '0.8',
                reactor_x_pu: values.reactor_x_pu || '0.25',
                voltage_limit_percent: values.voltage_limit_percent || '15',
                thermal_limit_percent: values.thermal_limit_percent || '100',
                t_start: values.t_start || '0.1',
                t_end: values.t_end || '5',
                frequency: values.frequency || '50',
                sn_mva: values.sn_mva || '100',
                user_email: getUserEmail()
            };

            try {
                const obj = prepareNetworkData(b, simulationParameters, { removeResultCells: false });
                console.log('Motor starting data prepared:', obj);
                processNetworkData(ENV.backendUrl + '/', obj, b, grafka);
            } catch (error) {
                console.error('Motor starting network preparation failed:', error);
                alert('Motor starting preparation failed: ' + (error.message || error));
                if (simProgress) {
                    simProgress.overlay.remove();
                    simProgress = null;
                }
            }
        });
    }
};

export const motorStartingPandaPower = window.motorStartingPandaPower;
