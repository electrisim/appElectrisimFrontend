// eigenvalueAnalysis.js - ANDES small-signal (eigenvalue) engine
import { EigenvalueAnalysisDialog } from './dialogs/EigenvalueAnalysisDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

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

function stopSpinner(apka) {
    try {
        apka?.spinner?.stop();
        window.apka?.spinner?.stop();
    } catch (e) {
        console.warn('Spinner cleanup failed:', e);
    }
}

async function processResults(url, obj, apka) {
    try {
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
        let text = await response.text();
        text = text.replace(/:\s*-Infinity/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*NaN/g, ': null');
        const dataJson = JSON.parse(text);
        if (dataJson.error) {
            const msg = dataJson.message || 'Eigenvalue analysis failed.';
            const detail = dataJson.exception ? `\n\n${dataJson.exception}` : '';
            alert(msg + detail);
            return;
        }
        if (window.EigenvalueResultsDialog) {
            new window.EigenvalueResultsDialog(dataJson).show();
        } else {
            await import('./dialogs/EigenvalueResultsDialog.js');
            new window.EigenvalueResultsDialog(dataJson).show();
        }
    } catch (err) {
        if (err.message === 'server') {
            alert('Eigenvalue analysis server error. Check that the backend is running and ANDES is installed.');
            return;
        }
        console.error('Eigenvalue analysis error:', err);
        alert('Error processing eigenvalue results: ' + (err.message || err));
    } finally {
        stopSpinner(apka);
    }
}

window.eigenvalueAnalysisAndes = function (a, b, c) {
    const apka = a;
    const graph = b;

    if (!graph.isEnabled() || graph.isCellLocked(graph.getDefaultParent())) {
        return;
    }

    const dialog = new EigenvalueAnalysisDialog(a);
    dialog.show(async function (values) {
        if (!values || typeof values !== 'object') return;
        apka.spinner.spin(document.body, 'Running eigenvalue analysis (ANDES)...');

        const simulationParameters = {
            typ: 'EigenvalueAndes Parameters',
            frequency: String(values.frequency ?? '50'),
            sn_mva: String(values.sn_mva ?? '100'),
            n_modes: String(values.n_modes ?? '10'),
            user_email: getUserEmail()
        };

        try {
            const obj = prepareNetworkData(graph, simulationParameters, { removeResultCells: true });
            await processResults(ENV.backendUrl + '/', obj, apka);
        } catch (error) {
            console.error('Eigenvalue analysis preparation failed:', error);
            alert('Preparation failed: ' + (error.message || error));
            stopSpinner(apka);
        }
    });
};

export const eigenvalueAnalysisAndes = window.eigenvalueAnalysisAndes;
