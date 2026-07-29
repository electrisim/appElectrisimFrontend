// arcFlash.js - IEEE 1584-2018 Arc Flash analysis engine
import { formatResultNameHeader, enrichResultJsonWithDialogNames } from './utils/attributeUtils.js';
import { ArcFlashDialog } from './dialogs/ArcFlashDialog.js';
import { ArcFlashResultsDialog } from './dialogs/ArcFlashResultsDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

window.arcFlashPandaPower = function (a, b, c) {
    const apka = a;
    const grafka = b;

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
            const msg = dataJson.message || 'Arc flash calculation failed.';
            const detail = dataJson.exception ? `\n\n${dataJson.exception}` : '';
            alert(msg + detail);
            return true;
        }
        return false;
    }

    const elementProcessors = {
        arc_flash: (data, graph, _grafka, cellIdMap) => {
            const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
            const insertFn = typeof window !== 'undefined' && window.insertResultBox;
            const fallbackStyle = (typeof window !== 'undefined' && window.RESULT_BOX_STYLE)
                || 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';

            data.forEach((cell) => {
                const resultCell = resolveCell(cell, graph, cellIdMap);
                if (!resultCell) {
                    console.warn('Arc flash: could not find busbar cell for id=', cell.id, 'name=', cell.name);
                    return;
                }
                cell.name = replaceUnderscores(cell.name);

                // Compact on-canvas label — full details are in ArcFlashResultsDialog
                const busLabel = formatResultNameHeader(resultCell, cell.name, 'Bus');
                const methodTag = cell.method && cell.method !== 'IEEE1584-2018'
                    ? `\n${cell.method}`
                    : '';
                const resultString = `${busLabel}
IE ${formatNumber(cell.incident_energy_cal_cm2, 2)}
PPE Cat ${cell.ppe_category ?? 'N/A'}${methodTag}`;

                const parent = resultCell;
                const existing = findFn ? findFn(graph, parent) : null;
                if (existing) {
                    graph.getModel().setValue(existing, resultString);
                } else if (insertFn) {
                    insertFn(graph, parent, resultString, { width: 48, height: 48, positionX: 0, positionY: 1.0 });
                } else {
                    graph.insertVertex(parent, null, resultString, 0, 1.0, 48, 48, fallbackStyle, true);
                }
            });
        }
    };

    async function processNetworkData(url, obj, graph, _grafka) {
        try {
            graph.getStylesheet().putCellStyle('labelstyle', STYLES.label);
            graph.getStylesheet().putCellStyle('lineStyle', STYLES.line);

            const response = await fetch(url, {
                mode: 'cors',
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip'
                },
                body: JSON.stringify(obj)
            });

            if (response.status !== 200) {
                throw new Error('server');
            }

            const dataJson = await response.json();
            console.log('Arc flash backend response:', dataJson);

            if (handleErrors(dataJson)) {
                return;
            }

            if (Array.isArray(dataJson.warnings) && dataJson.warnings.length > 0) {
                console.warn('Arc flash warnings:', dataJson.warnings);
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

            try {
                enrichResultJsonWithDialogNames(dataJson, graph);
                const rows = Array.isArray(dataJson.arc_flash) ? dataJson.arc_flash : [];
                rows.forEach((row) => {
                    if (row.dialogName) {
                        row.name = row.dialogName;
                    }
                });
                const dlg = new ArcFlashResultsDialog(dataJson);
                dlg.show();
            } catch (dlgErr) {
                console.error('Failed to show ArcFlashResultsDialog:', dlgErr);
                alert('Arc flash finished, but the results dialog failed to open. Check the console.');
            }
        } catch (err) {
            if (err.message === 'server') return;
            alert('Error processing arc flash results. ' + err + '\n\nCheck input data or contact electrisim@electrisim.com');
        } finally {
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
        }
    }

    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        const dialog = new ArcFlashDialog(a);
        dialog.show(async function (values) {
            apka.spinner.spin(document.body, 'Waiting for arc flash results...');

            if (!values || typeof values !== 'object') {
                apka.spinner.stop();
                return;
            }

            const simulationParameters = {
                typ: 'ArcFlashPandaPower Parameters',
                electrode_config: values.electrode_config || 'VCB',
                working_distance_mm: values.working_distance_mm || '455',
                conductor_gap_mm: values.conductor_gap_mm || '25',
                enclosure_height_mm: values.enclosure_height_mm || '508',
                enclosure_width_mm: values.enclosure_width_mm || '508',
                enclosure_depth_mm: values.enclosure_depth_mm || '508',
                clearing_time_s: values.clearing_time_s || '0.2',
                clearing_time_min_s: values.clearing_time_min_s || values.clearing_time_s || '0.2',
                user_email: getUserEmail()
            };

            try {
                const obj = prepareNetworkData(b, simulationParameters, { removeResultCells: false });
                console.log('Arc flash data prepared:', obj);
                processNetworkData(ENV.backendUrl + '/', obj, b, grafka);
            } catch (error) {
                console.error('Arc flash network preparation failed:', error);
                alert('Arc flash preparation failed: ' + (error.message || error));
                if (typeof apka !== 'undefined' && apka.spinner) {
                    apka.spinner.stop();
                }
            }
        });
    }
};

export const arcFlashPandaPower = window.arcFlashPandaPower;
