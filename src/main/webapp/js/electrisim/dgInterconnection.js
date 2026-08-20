// dgInterconnection.js - DG Interconnection Screening (OpenDSS) entry point
import { DgInterconnectionDialog } from './dialogs/DgInterconnectionDialog.js';
import { DgInterconnectionResultsDialog } from './dialogs/DgInterconnectionResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

console.log('dgInterconnection.js LOADED');

const getBackendUrl = () => {
    if (window.ENV && window.ENV.backendUrl) {
        return window.ENV.backendUrl + '/';
    }
    console.warn('ENV.backendUrl not found, using localhost fallback');
    return 'http://localhost:5000/';
};

function dgInterconnectionOpenDss(a, b, c) {
    const editorUi = a || window.App?.main?.editor?.editorUi;
    if (!editorUi) {
        console.error('Editor UI not found');
        return;
    }
    const graph = editorUi.editor?.graph;
    if (!graph) {
        console.error('Graph not found');
        return;
    }

    const dialog = new DgInterconnectionDialog(editorUi);
    dialog.show(async (values) => {
        if (!values) return;
        if (!values.derId) {
            alert('Please select a DER element (PVSystem, Storage, or Generator).');
            return;
        }

        const app = a || window.App || window.apka;
        if (app?.spinner) {
            try { app.spinner.spin(document.body, 'Running DG Interconnection Screening...'); } catch (e) { /* ignore */ }
        }

        try {
            const studyParams = {
                typ: 'DgInterconnectionOpenDss',
                poc_bus_id: values.pocBusId || '',
                der_id: values.derId,
                der_type: values.derType || 'PVSystem',
                proposed_kw: parseFloat(values.proposedKw || '500'),
                proposed_kva: values.proposedKva !== '' && values.proposedKva != null
                    ? parseFloat(values.proposedKva) : null,
                vmin_pu: parseFloat(values.vminPu || '0.95'),
                vmax_pu: parseFloat(values.vmaxPu || '1.05'),
                max_loading_percent: parseFloat(values.maxLoadingPercent || '100'),
                run_hosting_capacity: !!values.runHostingCapacity,
                hc_max_kw: parseFloat(values.hcMaxKw || '5000'),
                compare_invcontrol: !!values.compareInvControl,
                frequency: parseFloat(values.frequency || '50'),
                user_email: window.userEmail || window.USER_EMAIL || 'unknown@user.com'
            };

            const networkData = prepareNetworkData(graph, studyParams, {
                removeResultCells: false
            });

            // Restructure like BESS sizing: nested params + network elements
            const in_data = {};
            for (const key of Object.keys(networkData)) {
                const item = networkData[key];
                if (item && item.typ === 'DgInterconnectionOpenDss') {
                    in_data.dg_interconnection_params = { ...studyParams, ...item };
                } else {
                    in_data[key] = item;
                }
            }
            if (!in_data.dg_interconnection_params) {
                in_data.dg_interconnection_params = studyParams;
            }

            const url = getBackendUrl();
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip'
                },
                body: JSON.stringify(in_data)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const dataJson = await response.json();
            if (app?.spinner) {
                try { app.spinner.stop(); } catch (e) { /* ignore */ }
            }
            if (dataJson.error) {
                alert('DG Interconnection Screening: ' + (dataJson.message || 'unknown error'));
                return;
            }
            const resultsDialog = new DgInterconnectionResultsDialog(editorUi, dataJson);
            resultsDialog.show();
        } catch (err) {
            if (app?.spinner) {
                try { app.spinner.stop(); } catch (e) { /* ignore */ }
            }
            console.error('DG Interconnection Screening failed:', err);
            alert('DG Interconnection Screening failed: ' + (err?.message || err));
        }
    });
}

window.dgInterconnectionOpenDss = dgInterconnectionOpenDss;
export { dgInterconnectionOpenDss };
export default dgInterconnectionOpenDss;
