console.log('RPCResultsDialog.js LOADED');

export class RPCResultsDialog {
    constructor(editorUi) {
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.chartInstances = [];
    }

    show(results) {
        if (!results || !results.rpc_results) {
            alert('No RPC results to display.');
            return;
        }
        const data = results.rpc_results;
        this._createModal(data);
    }

    _createModal(data) {
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: '10001',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });

        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
            backgroundColor: '#fff', borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)', width: '920px', maxWidth: '95vw',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
        });

        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            padding: '16px 24px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        });
        const titleText = document.createElement('span');
        titleText.textContent = 'Reactive Power Capability — PQ Diagram';
        Object.assign(titleText.style, { fontWeight: '700', fontSize: '16px', color: '#212529' });
        titleBar.appendChild(titleText);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u00d7';
        Object.assign(closeBtn.style, {
            border: 'none', background: 'transparent', fontSize: '22px',
            cursor: 'pointer', color: '#6c757d', fontWeight: '700'
        });
        closeBtn.onclick = () => this.destroy();
        titleBar.appendChild(closeBtn);
        dialog.appendChild(titleBar);

        const summaryBar = this._createSummaryBar(data);
        dialog.appendChild(summaryBar);

        const content = document.createElement('div');
        Object.assign(content.style, {
            flex: '1 1 auto', overflowY: 'auto', padding: '20px 24px'
        });

        const voltageLevels = data.voltage_levels || [];
        if (voltageLevels.length === 0) {
            content.textContent = 'No voltage levels in results.';
        } else {
            const tabsHeader = document.createElement('div');
            Object.assign(tabsHeader.style, {
                display: 'flex', borderBottom: '2px solid #e9ecef', marginBottom: '16px', flexWrap: 'wrap'
            });
            const tabPanels = [];

            voltageLevels.forEach((v, i) => {
                const vKey = String(parseFloat(v).toFixed(4));
                const tab = document.createElement('div');
                tab.textContent = `${v} pu`;
                Object.assign(tab.style, {
                    padding: '10px 20px', cursor: 'pointer', fontSize: '14px',
                    borderBottom: i === 0 ? '2px solid #007bff' : '2px solid transparent',
                    color: i === 0 ? '#007bff' : '#6c757d',
                    fontWeight: i === 0 ? '600' : '400',
                    backgroundColor: i === 0 ? '#f0f7ff' : 'transparent',
                    borderTopLeftRadius: '4px', borderTopRightRadius: '4px',
                    transition: 'all 0.2s ease'
                });

                const panel = document.createElement('div');
                panel.style.display = i === 0 ? 'block' : 'none';

                const curveData = data.curves[vKey];
                if (curveData) {
                    const complianceVal = data.compliance ? data.compliance[vKey] : null;
                    const reqData = data.requirements ? data.requirements[vKey] : null;
                    this._buildChartPanel(panel, curveData, reqData, complianceVal, v, data);
                } else {
                    panel.textContent = `No data for voltage level ${v} pu (key: ${vKey})`;
                }

                tab.onclick = () => {
                    tabsHeader.querySelectorAll('div').forEach(t => {
                        t.style.borderBottomColor = 'transparent';
                        t.style.color = '#6c757d';
                        t.style.fontWeight = '400';
                        t.style.backgroundColor = 'transparent';
                    });
                    tab.style.borderBottomColor = '#007bff';
                    tab.style.color = '#007bff';
                    tab.style.fontWeight = '600';
                    tab.style.backgroundColor = '#f0f7ff';
                    tabPanels.forEach(p => p.style.display = 'none');
                    panel.style.display = 'block';
                };

                tabsHeader.appendChild(tab);
                tabPanels.push(panel);
            });

            content.appendChild(tabsHeader);
            tabPanels.forEach(p => content.appendChild(p));
        }

        if (data.warnings && data.warnings.length > 0) {
            const warnSection = document.createElement('div');
            Object.assign(warnSection.style, {
                marginTop: '16px', padding: '10px 14px', backgroundColor: '#fff3cd',
                border: '1px solid #ffc107', borderRadius: '6px', fontSize: '13px', color: '#856404'
            });
            const warnTitle = document.createElement('strong');
            warnTitle.textContent = 'Warnings:';
            warnSection.appendChild(warnTitle);
            const ul = document.createElement('ul');
            Object.assign(ul.style, { margin: '6px 0 0 0', paddingLeft: '20px' });
            data.warnings.forEach(w => {
                const li = document.createElement('li');
                li.textContent = w;
                ul.appendChild(li);
            });
            warnSection.appendChild(ul);
            content.appendChild(warnSection);
        }

        dialog.appendChild(content);

        const footerBar = document.createElement('div');
        Object.assign(footerBar.style, {
            padding: '12px 24px', borderTop: '1px solid #e9ecef',
            display: 'flex', justifyContent: 'flex-end', gap: '8px'
        });
        const downloadBtn = this._styledButton('Download CSV', '#28a745', '#218838');
        downloadBtn.onclick = () => this._downloadCSV(data);
        footerBar.appendChild(downloadBtn);

        const closeBtn2 = this._styledButton('Close', '#6c757d', '#5a6268');
        closeBtn2.onclick = () => this.destroy();
        footerBar.appendChild(closeBtn2);
        dialog.appendChild(footerBar);

        this.overlay.appendChild(dialog);
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.destroy(); };
        document.body.appendChild(this.overlay);
    }

    _createSummaryBar(data) {
        const bar = document.createElement('div');
        Object.assign(bar.style, {
            padding: '10px 24px', backgroundColor: '#f0f7ff', borderBottom: '1px solid #d6e9ff',
            display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', color: '#495057'
        });
        const items = [
            ['PCC Bus', data.pcc_bus_name || 'N/A'],
            ['Generators', data.generator_count || 0],
            ['Installed P', `${(data.total_installed_mw || 0).toFixed(1)} MW`],
            ['Voltage Levels', (data.voltage_levels || []).length]
        ];
        if (data.grid_code_template_name) {
            items.push(['Grid code requirement', data.grid_code_template_name]);
        }
        items.forEach(([label, val]) => {
            const span = document.createElement('span');
            span.innerHTML = `<strong>${label}:</strong> ${val}`;
            bar.appendChild(span);
        });
        return bar;
    }

    _buildChartPanel(panel, curveData, reqData, complianceVal, voltageLevel, fullData) {
        if (complianceVal !== null && complianceVal !== undefined) {
            const badge = document.createElement('div');
            Object.assign(badge.style, {
                display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
                fontSize: '13px', fontWeight: '600', marginBottom: '12px',
                backgroundColor: complianceVal ? '#d4edda' : '#f8d7da',
                color: complianceVal ? '#155724' : '#721c24',
                border: `1px solid ${complianceVal ? '#c3e6cb' : '#f5c6cb'}`
            });
            badge.textContent = complianceVal ? 'COMPLIANT — Requirements met' : 'NON-COMPLIANT — Requirements not met';
            panel.appendChild(badge);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 850;
        canvas.height = 450;
        Object.assign(canvas.style, { width: '100%', maxHeight: '450px' });
        panel.appendChild(canvas);

        this._loadChartJS().then(() => {
            this._renderChart(canvas, curveData, reqData, voltageLevel, fullData);
        });
    }

    _loadChartJS() {
        if (window.Chart) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Chart.js'));
            document.head.appendChild(script);
        });
    }

    _renderChart(canvas, curveData, reqData, voltageLevel, fullData) {
        const Chart = window.Chart;
        if (!Chart) {
            console.error('Chart.js not available');
            return;
        }

        const pArr = curveData.p_mw || [];
        const qMaxArr = curveData.q_max_mvar || [];
        const qMinArr = curveData.q_min_mvar || [];

        const capabilityMaxData = pArr.map((p, i) => ({ x: qMaxArr[i], y: p })).filter(d => d.x !== null);
        const capabilityMinData = pArr.map((p, i) => ({ x: qMinArr[i], y: p })).filter(d => d.x !== null);

        // Build the closed envelope: go from Q_min (bottom-left) up, then Q_max top-right down
        const envelopeData = [];
        // Q_min side (ascending P)
        for (let i = 0; i < pArr.length; i++) {
            if (qMinArr[i] !== null) envelopeData.push({ x: qMinArr[i], y: pArr[i] });
        }
        // Q_max side (descending P to close the loop)
        for (let i = pArr.length - 1; i >= 0; i--) {
            if (qMaxArr[i] !== null) envelopeData.push({ x: qMaxArr[i], y: pArr[i] });
        }

        const datasets = [
            {
                label: 'Capability Q_max',
                data: capabilityMaxData,
                borderColor: '#dc3545',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                pointRadius: 2,
                showLine: true,
                order: 1
            },
            {
                label: 'Capability Q_min',
                data: capabilityMinData,
                borderColor: '#dc3545',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                borderDash: [6, 3],
                pointRadius: 2,
                showLine: true,
                order: 1
            },
            {
                label: 'Capability Area',
                data: envelopeData,
                borderColor: 'transparent',
                backgroundColor: 'rgba(220, 53, 69, 0.08)',
                fill: true,
                pointRadius: 0,
                showLine: true,
                order: 3
            }
        ];

        if (reqData) {
            const reqP = reqData.p_mw || [];
            const reqQMax = reqData.q_req_max_mvar || [];
            const reqQMin = reqData.q_req_min_mvar || [];

            if (reqP.length > 0) {
                const reqMaxPts = reqP.map((p, i) => ({ x: reqQMax[i], y: p })).filter(d => d.x !== null && d.x !== undefined);
                const reqMinPts = reqP.map((p, i) => ({ x: reqQMin[i], y: p })).filter(d => d.x !== null && d.x !== undefined);

                const reqEnvelope = [];
                for (let i = 0; i < reqP.length; i++) {
                    if (reqQMin[i] != null) reqEnvelope.push({ x: reqQMin[i], y: reqP[i] });
                }
                for (let i = reqP.length - 1; i >= 0; i--) {
                    if (reqQMax[i] != null) reqEnvelope.push({ x: reqQMax[i], y: reqP[i] });
                }

                const reqLabelSuffix = fullData.grid_code_template_name
                    ? ' (grid code)'
                    : '';
                datasets.push({
                    label: `Required Q (overexcited)${reqLabelSuffix}`,
                    data: reqMaxPts,
                    borderColor: '#0d6efd',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 2,
                    showLine: true,
                    order: 2
                });
                datasets.push({
                    label: `Required Q (underexcited)${reqLabelSuffix}`,
                    data: reqMinPts,
                    borderColor: '#0d6efd',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    pointRadius: 2,
                    showLine: true,
                    order: 2
                });
                datasets.push({
                    label: 'Requirement Area',
                    data: reqEnvelope,
                    borderColor: 'transparent',
                    backgroundColor: 'rgba(13, 110, 253, 0.06)',
                    fill: true,
                    pointRadius: 0,
                    showLine: true,
                    order: 4
                });
            }
        }

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `PQ Diagram — PCC Voltage: ${voltageLevel} pu${
                            fullData.grid_code_template_name
                                ? ` · ${fullData.grid_code_template_name}`
                                : ''
                        }`,
                        font: { size: 15, weight: '600' },
                        color: '#212529'
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            filter: (item) => !item.text.includes('Area'),
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `Q: ${ctx.parsed.x?.toFixed(2)} Mvar, P: ${ctx.parsed.y?.toFixed(2)} MW`
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Q (Mvar)', font: { size: 13, weight: '600' } },
                        grid: { color: 'rgba(0,0,0,0.06)' }
                    },
                    y: {
                        title: { display: true, text: 'P (MW)', font: { size: 13, weight: '600' } },
                        grid: { color: 'rgba(0,0,0,0.06)' },
                        min: 0
                    }
                }
            }
        });
        this.chartInstances.push(chart);
    }

    _downloadCSV(data) {
        let csv = 'Voltage_pu,P_MW,Q_max_Mvar,Q_min_Mvar\n';
        const levels = data.voltage_levels || [];
        levels.forEach(v => {
            const vKey = String(parseFloat(v).toFixed(4));
            const curve = data.curves[vKey];
            if (!curve) return;
            const pArr = curve.p_mw || [];
            const qMax = curve.q_max_mvar || [];
            const qMin = curve.q_min_mvar || [];
            pArr.forEach((p, i) => {
                csv += `${v},${p},${qMax[i] != null ? qMax[i] : ''},${qMin[i] != null ? qMin[i] : ''}\n`;
            });
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RPC_PQ_Diagram_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    _styledButton(text, bg, hover) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '8px 18px', border: 'none', borderRadius: '4px',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer',
            backgroundColor: bg, color: '#fff', transition: 'background-color 0.2s'
        });
        btn.onmouseenter = () => btn.style.backgroundColor = hover;
        btn.onmouseleave = () => btn.style.backgroundColor = bg;
        return btn;
    }

    destroy() {
        this.chartInstances.forEach(c => { try { c.destroy(); } catch (e) { /* noop */ } });
        this.chartInstances = [];
        if (this.overlay && this.overlay.parentNode) {
            document.body.removeChild(this.overlay);
        }
        this.overlay = null;
    }
}

window.RPCResultsDialog = RPCResultsDialog;
