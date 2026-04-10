import {
    RPCDialog,
    getGridTemplateRequirementsMw,
    getGridTemplateDisplayName,
    estimateRpcInstalledMw
} from './dialogs/RPCDialog.js';
import { RPCResultsDialog } from './dialogs/RPCResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

console.log('rpcAnalysis.js LOADED');

const getBackendUrl = () => {
    if (window.ENV && window.ENV.backendUrl) {
        return window.ENV.backendUrl + '/';
    }
    console.warn('ENV.backendUrl not found, using localhost fallback');
    return 'http://localhost:5000/';
};

function _removeRpcProgressOverlay() {
    const el = document.getElementById('rpc-progress-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

/** Live backend-style RPC logs (voltage level progress) while the request runs. */
function _createRpcProgressOverlay() {
    _removeRpcProgressOverlay();
    const wrap = document.createElement('div');
    wrap.id = 'rpc-progress-overlay';
    Object.assign(wrap.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        maxWidth: 'min(440px, calc(100vw - 40px))',
        maxHeight: 'min(240px, 35vh)',
        overflow: 'auto',
        background: 'rgba(33, 37, 41, 0.94)',
        color: '#e9ecef',
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        padding: '12px 14px',
        borderRadius: '8px',
        zIndex: '100002',
        boxShadow: '0 6px 28px rgba(0,0,0,0.4)',
        lineHeight: '1.5',
        border: '1px solid rgba(255,255,255,0.12)'
    });
    const title = document.createElement('div');
    title.textContent = 'RPC progress';
    Object.assign(title.style, {
        fontWeight: '600',
        marginBottom: '8px',
        color: '#adb5bd',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
    });
    wrap.appendChild(title);
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    wrap.appendChild(pre);
    document.body.appendChild(wrap);
    return { wrap, pre };
}

function _appendRpcProgressLine(state, text) {
    if (!state || !state.pre) return;
    state.pre.textContent += text + (text.endsWith('\n') ? '' : '\n');
    state.wrap.scrollTop = state.wrap.scrollHeight;
}

function rpcAnalysis(a, b, c) {
    console.log('RPC Analysis started');

    const editorUi = a || window.App?.main?.editor?.editorUi;
    if (!editorUi) {
        console.error('Editor UI not found');
        return;
    }
    const graph = editorUi.editor.graph;
    if (!graph) {
        console.error('Graph not found');
        return;
    }

    const dialog = new RPCDialog(editorUi);

    dialog.show(async (values) => {
        if (!values) {
            console.log('RPC dialog cancelled');
            return;
        }

        console.log('RPC parameters:', values);

        if (!values.pccBusId) {
            alert('Please select a PCC Bus');
            return;
        }
        if (!values.extGridId) {
            alert('Please select an External Grid');
            return;
        }

        const selectedGenIds = values.generatorIds || [];
        if (selectedGenIds.length === 0) {
            alert('Please select at least one generator');
            return;
        }

        const tplKeyPre = values.gridCodeTemplateKey || 'none';
        let reqRowsPre = Array.isArray(values.requirements) ? [...values.requirements] : [];
        reqRowsPre = reqRowsPre.filter(r => {
            const p = parseFloat(r.p) || 0;
            const qn = parseFloat(r.qMin) || 0;
            const qx = parseFloat(r.qMax) || 0;
            return Math.abs(p) + Math.abs(qn) + Math.abs(qx) > 1e-9;
        });
        if (reqRowsPre.length > 0 && tplKeyPre === 'none') {
            alert(
                'The requirements table has data. Please select a Grid Code Template above. ' +
                'Choose "Custom (manual table)" if you entered the points yourself, or pick a standard code. ' +
                'To run without grid-code overlay, remove all rows and keep "-- Select Grid Code Template --".'
            );
            return;
        }

        const app = a || window.App || window.apka;
        if (app && app.spinner) {
            app.spinner.spin(document.body, 'Running Reactive Power Capability analysis...');
        } else if (window.apka && window.apka.spinner) {
            window.apka.spinner.spin(document.body, 'Running Reactive Power Capability analysis...');
        }

        try {
            const voltageLevels = (values.voltageLevels || '1.0')
                .split(',')
                .map(s => parseFloat(s.trim()))
                .filter(v => !isNaN(v));

            // Resolve cell names from IDs
            const model = graph.getModel();
            const pccCell = model.getCell(values.pccBusId);
            const extGridCell = model.getCell(values.extGridId);

            const pccBusName = _getCellNetworkName(pccCell);
            const extGridName = _getCellNetworkName(extGridCell);

            const generatorNames = selectedGenIds.map(id => {
                const cell = model.getCell(id);
                return _getCellNetworkName(cell);
            }).filter(n => n !== null);

            // Build requirements: table rows, or scale the selected grid template if table is empty
            // (so the chosen grid code appears on the PQ chart without an extra "Apply" click).
            let requirementRows = Array.isArray(values.requirements) ? [...values.requirements] : [];
            // Drop placeholder rows (e.g. user clicked + Add Row but left 0,0,0) so template fallback still runs
            requirementRows = requirementRows.filter(r => {
                const p = parseFloat(r.p) || 0;
                const qn = parseFloat(r.qMin) || 0;
                const qx = parseFloat(r.qMax) || 0;
                return Math.abs(p) + Math.abs(qn) + Math.abs(qx) > 1e-9;
            });
            const tplKey = values.gridCodeTemplateKey || 'none';
            // Match backend / dialog "P Max = 0 → auto": use installed static-gen sum for template scaling
            let pRated = values.pRatedMw;
            if (!(pRated > 0)) {
                const pMax = parseFloat(values.pMaxMw);
                if (!isNaN(pMax) && pMax > 0) {
                    pRated = pMax;
                }
            }
            if (!(pRated > 0)) {
                pRated = estimateRpcInstalledMw(graph);
            }
            if (requirementRows.length === 0 && tplKey !== 'none' && tplKey !== 'custom_manual' && pRated > 0) {
                requirementRows = getGridTemplateRequirementsMw(tplKey, pRated);
            }
            const gridCodeTemplateName = tplKey !== 'none' ? getGridTemplateDisplayName(tplKey) : '';

            // { "vKey": { p_mw: [...], q_req_max_mvar: [...], q_req_min_mvar: [...] } }
            let requirements = null;
            if (requirementRows.length > 0) {
                const sorted = [...requirementRows].sort((a, b) => a.p - b.p);
                const reqObj = {};
                voltageLevels.forEach(v => {
                    const vKey = String(parseFloat(v).toFixed(4));
                    reqObj[vKey] = {
                        p_mw: sorted.map(r => r.p),
                        q_req_max_mvar: sorted.map(r => r.qMax),
                        q_req_min_mvar: sorted.map(r => r.qMin)
                    };
                });
                requirements = reqObj;
            }

            const coerceBool = (v) => {
                if (typeof v === 'string') {
                    return ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase());
                }
                return !!v;
            };

            const rpcParams = {
                typ: 'RPCAnalysisPandaPower Parameters',
                pcc_bus_name: pccBusName,
                ext_grid_name: extGridName,
                generator_names: generatorNames,
                voltage_levels: voltageLevels,
                p_min_mw: 0,
                p_max_mw: parseFloat(values.pMaxMw) || 0,
                p_steps: parseInt(values.pSteps, 10) || 10,
                q_capability_mode: values.qCapabilityMode || 'from_rating',
                limit_overloads: values.limitOverloads || false,
                run_control: coerceBool(values.rpc_run_control),
                max_loading_percent: parseFloat(values.maxLoadingPercent) || 100,
                requirements: requirements,
                grid_code_template_key: tplKey !== 'none' ? tplKey : null,
                grid_code_template_name: gridCodeTemplateName || null,
                frequency: parseFloat(values.frequency) || 50,
                user_email: _getUserEmail(),
                rpc_stream: true
            };

            const networkData = prepareNetworkData(graph, rpcParams, { removeResultCells: false });

            const in_data = {};
            const keys = Object.keys(networkData);
            for (const key of keys) {
                const item = networkData[key];
                if (item && item.typ) {
                    in_data[key] = item;
                }
            }

            const backendUrl = getBackendUrl();
            console.log('RPC Analysis - Sending to backend:', backendUrl);
            console.log('RPC Analysis - Generator names:', generatorNames);
            console.log('RPC Analysis - PCC bus name:', pccBusName);

            const progressPre = _createRpcProgressOverlay();

            const response = await fetch(backendUrl, {
                mode: 'cors',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/x-ndjson, application/json',
                    // Avoid compressed streaming body (harder to read incrementally in browser)
                    'Accept-Encoding': 'identity'
                },
                body: JSON.stringify(in_data)
            });

            if (!response.ok) {
                _removeRpcProgressOverlay();
                const errorText = await response.text();
                console.error('Server error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const ct = (response.headers.get('Content-Type') || '').toLowerCase();
            let dataJson = null;

            if (ct.includes('ndjson') && response.body && typeof response.body.getReader === 'function') {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n');
                    buffer = parts.pop() || '';
                    for (const line of parts) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        let evt;
                        try {
                            evt = JSON.parse(trimmed);
                        } catch (pe) {
                            console.warn('RPC stream parse line:', pe);
                            continue;
                        }
                        if (evt.type === 'progress' && typeof evt.message === 'string') {
                            _appendRpcProgressLine(progressPre, evt.message.trimEnd());
                        } else if (evt.type === 'error') {
                            _removeRpcProgressOverlay();
                            if (app && app.spinner) app.spinner.stop();
                            else if (window.apka && window.apka.spinner) window.apka.spinner.stop();
                            alert('RPC Analysis Error: ' + (evt.message || 'Unknown error'));
                            return;
                        } else if (evt.type === 'result' && evt.data) {
                            dataJson = evt.data;
                        }
                    }
                }
                if (buffer.trim()) {
                    try {
                        const evt = JSON.parse(buffer.trim());
                        if (evt.type === 'result' && evt.data) dataJson = evt.data;
                        if (evt.type === 'error') {
                            _removeRpcProgressOverlay();
                            if (app && app.spinner) app.spinner.stop();
                            else if (window.apka && window.apka.spinner) window.apka.spinner.stop();
                            alert('RPC Analysis Error: ' + (evt.message || 'Unknown error'));
                            return;
                        }
                    } catch (e) { /* ignore trailing garbage */ }
                }
            } else {
                let responseData;
                const contentEncoding = response.headers.get('Content-Encoding');
                if (contentEncoding === 'gzip' || contentEncoding === 'br') {
                    const buf = await response.arrayBuffer();
                    responseData = new TextDecoder('utf-8').decode(buf);
                } else {
                    responseData = await response.text();
                }
                dataJson = JSON.parse(responseData);
            }

            _removeRpcProgressOverlay();
            console.log('RPC Analysis response:', dataJson);

            if (app && app.spinner) app.spinner.stop();
            else if (window.apka && window.apka.spinner) window.apka.spinner.stop();

            if (!dataJson) {
                alert('RPC Analysis Error: empty response');
                return;
            }
            if (dataJson.error) {
                alert('RPC Analysis Error: ' + dataJson.error);
                return;
            }

            const resultsDialog = new RPCResultsDialog(editorUi);
            resultsDialog.show(dataJson);

        } catch (error) {
            console.error('RPC Analysis failed:', error);
            _removeRpcProgressOverlay();
            if (app && app.spinner) app.spinner.stop();
            else if (window.apka && window.apka.spinner) window.apka.spinner.stop();
            alert('Reactive Power Capability analysis failed: ' + error.message);
        }
    });
}

function _getCellNetworkName(cell) {
    try {
        if (!cell) return null;
        if (cell.mxObjectId) return cell.mxObjectId.replace('#', '_');
        return null;
    } catch (e) {
        return null;
    }
}

function _getUserEmail() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.email) return user.email;
        }
        return 'unknown@user.com';
    } catch (e) {
        return 'unknown@user.com';
    }
}

window.rpcAnalysis = rpcAnalysis;
