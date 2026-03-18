import { Dialog } from '../Dialog.js';
import { DIALOG_STYLES } from '../utils/dialogStyles.js';

export class EconomicAnalysisResultsDialog extends Dialog {
    constructor(results, editorUi, options = {}) {
        super('Economic Analysis Results', 'Close');
        this.results = results || {};
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.hasLoads = options.hasLoads !== false;
        this.hasGenerators = options.hasGenerators !== false;
    }

    _createSummaryCards() {
        const currency = this.results.currency || 'EUR';
        const totalCapex = this.results.total_capex ?? 0;
        const totalLosses = this.results.total_power_losses_mw ?? 0;
        const totalEnergyMwh = this.results.total_energy_losses_mwh;
        const energyLossCost = this.results.energy_loss_cost;
        const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'CNY' ? '¥' : currency + ' ';
        const costCur = this.results.energy_loss_cost_currency || currency;
        const costSym = costCur === 'EUR' ? '€' : costCur === 'USD' ? '$' : costCur === 'CNY' ? '¥' : costCur + ' ';

        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '20px'
        });

        const cardStyle = {
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '12px 16px',
            border: '1px solid #e9ecef'
        };
        const labelStyle = { fontSize: '12px', color: '#6c757d', marginBottom: '4px' };
        const valueStyle = { fontSize: '18px', fontWeight: '600', color: '#212529' };

        const makeCard = (label, value) => {
            const card = document.createElement('div');
            Object.assign(card.style, cardStyle);
            const labelEl = document.createElement('div');
            Object.assign(labelEl.style, labelStyle);
            labelEl.textContent = label;
            const valueEl = document.createElement('div');
            Object.assign(valueEl.style, valueStyle);
            valueEl.textContent = value;
            card.appendChild(labelEl);
            card.appendChild(valueEl);
            return card;
        };

        grid.appendChild(makeCard('Total CAPEX', `${symbol} ${Number(totalCapex).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`));
        grid.appendChild(makeCard('Power Losses', `${Number(totalLosses).toFixed(4)} MW`));
        if (totalEnergyMwh != null) {
            const periodHours = this.results.energy_loss_period_hours ?? this.results.time_steps ?? 1;
            const lifetimeYears = this.results.lifetime_years ?? 30;
            const energyCard = makeCard(
                'Energy Losses (annual)',
                `${Number(totalEnergyMwh).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh`
            );
            const periodEl = document.createElement('div');
            periodEl.style.cssText = 'font-size: 11px; color: #6c757d; margin-top: 4px;';
            periodEl.textContent = periodHours > 1 ? `Over ${periodHours.toLocaleString()} hours/year` : '1 hour (snapshot)';
            energyCard.appendChild(periodEl);
            if (lifetimeYears > 1 && periodHours >= 8760) {
                const lifetimeMwh = totalEnergyMwh * lifetimeYears;
                const lifetimeEl = document.createElement('div');
                lifetimeEl.style.cssText = 'font-size: 11px; color: #6c757d; margin-top: 2px; font-weight: 500;';
                lifetimeEl.textContent = `${lifetimeYears} years: ${Number(lifetimeMwh).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MWh`;
                energyCard.appendChild(lifetimeEl);
            }
            grid.appendChild(energyCard);
        }
        if (energyLossCost != null && energyLossCost > 0) {
            const lifetimeYears = this.results.lifetime_years ?? 30;
            const costCard = makeCard(
                'Energy Loss Cost (annual)',
                `${costSym} ${Number(energyLossCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            );
            if (lifetimeYears > 1) {
                const lifetimeCost = energyLossCost * lifetimeYears;
                const lifetimeEl = document.createElement('div');
                lifetimeEl.style.cssText = 'font-size: 11px; color: #6c757d; margin-top: 4px; font-weight: 500;';
                lifetimeEl.textContent = `${lifetimeYears} years: ${costSym} ${Number(lifetimeCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                costCard.appendChild(lifetimeEl);
            }
            grid.appendChild(costCard);
        }

        const wrap = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = 'Economic Analysis Results';
        Object.assign(title.style, { margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#212529' });
        wrap.appendChild(title);
        wrap.appendChild(grid);
        return wrap;
    }

    createForm() {
        const form = document.createElement('div');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '12px 0'
        });

        const currency = this.results.currency || 'EUR';
        const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'CNY' ? '¥' : currency + ' ';
        const totalEnergyMwh = this.results.total_energy_losses_mwh;

        // CAPEX breakdown table
        const sectionTitleStyle = { margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#212529' };
        const sectionDividerStyle = { margin: '20px 0', borderTop: '1px solid #e9ecef' };

        const capexBreakdown = this.results.capex_breakdown || [];
        if (capexBreakdown.length > 0) {
            const capexSection = document.createElement('div');
            const capexDivider = document.createElement('div');
            Object.assign(capexDivider.style, sectionDividerStyle);
            capexSection.appendChild(capexDivider);
            const initialRows = 8;
            const allRows = capexBreakdown
                .map(r => [r.element_type || '', r.name || '', (r.cost ?? 0).toFixed(2)])
                .sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]));
            const headerRow = document.createElement('div');
            Object.assign(headerRow.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                flexWrap: 'wrap',
                gap: '8px'
            });
            const capexTitle = document.createElement('h4');
            capexTitle.textContent = 'CAPEX Breakdown';
            Object.assign(capexTitle.style, { margin: 0, fontSize: '15px', fontWeight: '600', color: '#212529' });
            headerRow.appendChild(capexTitle);
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = capexBreakdown.length > initialRows ? `Show all (${capexBreakdown.length})` : '';
            Object.assign(toggleBtn.style, {
                fontSize: '12px',
                color: '#48d800',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                textDecoration: 'underline'
            });
            let showingAll = false;
            const capexWrapper = document.createElement('div');
            Object.assign(capexWrapper.style, {
                maxHeight: '220px',
                overflowY: 'auto',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            });
            const renderCapexTable = (rows) => {
                capexWrapper.innerHTML = '';
                const tbl = this.createBreakdownTable(
                    ['Type', 'Name', `Cost (${currency})`],
                    rows,
                    { rightAlignLast: true, compact: true }
                );
                capexWrapper.appendChild(tbl);
            };
            renderCapexTable(showingAll ? allRows : allRows.slice(0, initialRows));
            if (capexBreakdown.length > initialRows) {
                headerRow.appendChild(toggleBtn);
                toggleBtn.addEventListener('click', () => {
                    showingAll = !showingAll;
                    toggleBtn.textContent = showingAll ? 'Show less' : `Show all (${capexBreakdown.length})`;
                    renderCapexTable(showingAll ? allRows : allRows.slice(0, initialRows));
                    capexWrapper.style.maxHeight = showingAll ? 'none' : '220px';
                    capexWrapper.style.overflowY = showingAll ? 'visible' : 'auto';
                });
            }
            capexSection.appendChild(headerRow);
            capexSection.appendChild(capexWrapper);
            form.appendChild(capexSection);
        }

        // Power losses breakdown table (collapsible, compact)
        const lossesBreakdown = this.results.power_losses_breakdown || [];
        if (lossesBreakdown.length > 0) {
            const lossesSection = document.createElement('div');
            const lossesDivider = document.createElement('div');
            Object.assign(lossesDivider.style, sectionDividerStyle);
            lossesSection.appendChild(lossesDivider);
            const initialRows = 8;
            const allRows = lossesBreakdown
                .map(r => [r.element_type || '', r.name || '', (r.pl_mw ?? 0).toFixed(4)])
                .sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]));
            const headerRow = document.createElement('div');
            Object.assign(headerRow.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                flexWrap: 'wrap',
                gap: '8px'
            });
            const lossesTitle = document.createElement('h4');
            lossesTitle.textContent = 'Power Losses Breakdown';
            Object.assign(lossesTitle.style, { margin: 0, fontSize: '15px', fontWeight: '600', color: '#212529' });
            headerRow.appendChild(lossesTitle);
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = lossesBreakdown.length > initialRows ? `Show all (${lossesBreakdown.length})` : '';
            Object.assign(toggleBtn.style, {
                fontSize: '12px',
                color: '#48d800',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                textDecoration: 'underline'
            });
            let showingAll = false;
            const tableWrapper = document.createElement('div');
            Object.assign(tableWrapper.style, {
                maxHeight: '220px',
                overflowY: 'auto',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            });
            const renderTable = (rows) => {
                tableWrapper.innerHTML = '';
                const tbl = this.createBreakdownTable(
                    ['Type', 'Name', 'Power Loss (MW)'],
                    rows,
                    { rightAlignLast: true, compact: true }
                );
                tableWrapper.appendChild(tbl);
            };
            renderTable(showingAll ? allRows : allRows.slice(0, initialRows));
            if (lossesBreakdown.length > initialRows) {
                headerRow.appendChild(toggleBtn);
                toggleBtn.addEventListener('click', () => {
                    showingAll = !showingAll;
                    toggleBtn.textContent = showingAll ? 'Show less' : `Show all (${lossesBreakdown.length})`;
                    renderTable(showingAll ? allRows : allRows.slice(0, initialRows));
                    tableWrapper.style.maxHeight = showingAll ? 'none' : '220px';
                    tableWrapper.style.overflowY = showingAll ? 'visible' : 'auto';
                });
            }
            lossesSection.appendChild(headerRow);
            lossesSection.appendChild(tableWrapper);
            form.appendChild(lossesSection);
        }

        // Load and generation profiles used for calculation (only show when model has those elements)
        const loadProfileValues = this.results.load_profile_values;
        const genProfileValues = this.results.generation_profile_values;
        const showLoadChart = this.hasLoads && Array.isArray(loadProfileValues) && loadProfileValues.length > 0;
        const showGenChart = this.hasGenerators && Array.isArray(genProfileValues) && genProfileValues.length > 0;
        if (showLoadChart || showGenChart) {
            const profilesSection = document.createElement('div');
            const profilesDivider = document.createElement('div');
            Object.assign(profilesDivider.style, sectionDividerStyle);
            profilesSection.appendChild(profilesDivider);
            const profilesTitle = document.createElement('h4');
            profilesTitle.textContent = 'Profiles used for calculation';
            Object.assign(profilesTitle.style, sectionTitleStyle);
            profilesSection.appendChild(profilesTitle);
            const loadProfileName = this.results.load_profile || 'constant';
            const genProfileName = this.results.generation_profile || 'constant';
            const descParts = [];
            if (showLoadChart) descParts.push(`Load: ${loadProfileName}`);
            if (showGenChart) descParts.push(`Generation: ${genProfileName}`);
            const hourCount = (loadProfileValues?.length || genProfileValues?.length) || 0;
            if (hourCount > 0) descParts.push(`(${hourCount} hours)`);
            const profileDesc = document.createElement('p');
            profileDesc.style.cssText = 'margin: 0 0 12px 0; color: #495057; font-size: 13px;';
            profileDesc.textContent = descParts.join(' | ');
            profilesSection.appendChild(profileDesc);
            const chartContainer = document.createElement('div');
            Object.assign(chartContainer.style, { display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' });
            const chartCardStyle = { border: '1px solid #dee2e6', borderRadius: '8px', padding: '12px', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
            if (showLoadChart) {
                const loadCard = document.createElement('div');
                Object.assign(loadCard.style, chartCardStyle);
                loadCard.appendChild(this._createProfileChart('Load scale factor', loadProfileValues, '#1976d2'));
                chartContainer.appendChild(loadCard);
            }
            if (showGenChart) {
                const genCard = document.createElement('div');
                Object.assign(genCard.style, chartCardStyle);
                genCard.appendChild(this._createProfileChart('Generation scale factor', genProfileValues, '#2e7d32'));
                chartContainer.appendChild(genCard);
            }
            profilesSection.appendChild(chartContainer);
            form.appendChild(profilesSection);
        }

        // Energy loss footnote (unique context only; main values are in summary cards)
        if (totalEnergyMwh != null) {
            const periodHours = this.results.energy_loss_period_hours ?? this.results.time_steps ?? 1;
            const lifetimeYears = this.results.lifetime_years ?? 30;
            const genProfile = this.results.generation_profile ?? '-';
            const footnote = document.createElement('p');
            footnote.style.cssText = 'margin: 16px 0 0 0; color: #6c757d; font-size: 12px; font-style: italic;';
            footnote.textContent = periodHours > 1
                ? `Calculated over ${periodHours} hours/year (generation profile: ${genProfile}). Lifetime: ${lifetimeYears} years.`
                : '1 hour equivalent, instantaneous snapshot.';
            form.appendChild(footnote);
        }

        if (capexBreakdown.length === 0 && lossesBreakdown.length === 0 && totalEnergyMwh == null && !this.results.error) {
            const noData = document.createElement('p');
            noData.textContent = 'No CAPEX or power losses data. Set cost per unit in the Economic tab of element dialogs.';
            noData.style.color = '#6c757d';
            noData.style.fontStyle = 'italic';
            form.appendChild(noData);
        }

        if (this.results.error) {
            const errDiv = document.createElement('div');
            errDiv.textContent = 'Error: ' + this.results.error;
            errDiv.style.color = '#dc3545';
            errDiv.style.padding = '8px';
            errDiv.style.backgroundColor = '#f8d7da';
            errDiv.style.borderRadius = '4px';
            form.insertBefore(errDiv, form.firstChild);
        }

        return form;
    }

    _createProfileChart(title, values, color) {
        const raw = values;
        let min = Math.min(...raw);
        let max = Math.max(...raw);
        // When min === max (e.g. constant profile), add padding so the line is centered vertically
        if (min === max) {
            const padVal = Math.max(0.2, min * 0.2);
            min = Math.max(0, min - padVal);
            max = max + padVal;
        }
        const range = max - min || 1;
        const w = 600;
        const h = 140;
        const pad = { top: 20, right: 12, bottom: 24, left: 44 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        // Downsample for readability: max ~400 points to avoid jagged/noisy lines
        const maxPoints = 400;
        let sample;
        if (raw.length <= maxPoints) {
            sample = raw;
        } else {
            const step = raw.length / maxPoints;
            sample = [];
            for (let i = 0; i < maxPoints; i++) {
                const idx = Math.min(Math.floor(i * step), raw.length - 1);
                sample.push(raw[idx]);
            }
        }

        const wrap = document.createElement('div');
        const label = document.createElement('div');
        label.textContent = title;
        label.style.cssText = 'font-size: 12px; font-weight: 500; margin-bottom: 4px; color: #495057;';
        wrap.appendChild(label);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.style.cssText = 'max-width: 100%; border: 1px solid #dee2e6; border-radius: 4px;';
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        const gridColor = '#e9ecef';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.font = '10px Arial';
        ctx.fillStyle = '#6c757d';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const yTicks = 5;
        const xTicks = 6;
        for (let i = 0; i <= yTicks; i++) {
            const y = pad.top + (chartH * (yTicks - i)) / yTicks;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + chartW, y);
            ctx.stroke();
            const val = min + (range * i) / yTicks;
            ctx.fillText(val.toFixed(2), pad.left - 6, y);
        }
        for (let i = 0; i <= xTicks; i++) {
            const x = pad.left + (chartW * i) / xTicks;
            ctx.beginPath();
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, pad.top + chartH);
            ctx.stroke();
        }

        // Data line and fill
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < sample.length; i++) {
            const x = pad.left + (i / (sample.length - 1 || 1)) * chartW;
            const y = pad.top + chartH - ((sample[i] - min) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.lineTo(pad.left + chartW, pad.top + chartH);
        ctx.lineTo(pad.left, pad.top + chartH);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        wrap.appendChild(canvas);
        const axisLegend = document.createElement('div');
        axisLegend.style.cssText = 'font-size: 11px; color: #6c757d; margin-top: 6px; line-height: 1.4;';
        axisLegend.innerHTML = `<strong>X-axis:</strong> Time (hours 0–${raw.length}) &nbsp;|&nbsp; <strong>Y-axis:</strong> Scale factor (multiplier). Range: ${min.toFixed(2)} – ${max.toFixed(2)}`;
        wrap.appendChild(axisLegend);
        return wrap;
    }

    _normalizeElementType(typ) {
        if (!typ || typeof typ !== 'string') return typ || '';
        const base = typ.replace(/\d+$/, '').trim() || typ;
        const colors = {
            Line: '#1976d2',
            Transformer: '#2e7d32',
            'Three Winding Transformer': '#388e3c',
            'DC Line': '#7b1fa2',
            Impedance: '#f57c00',
            'External Grid': '#5d4037',
            Generator: '#0288d1',
            'Static Generator': '#0097a7',
            Load: '#c62828',
            'Shunt Reactor': '#6a1b9a',
            Capacitor: '#00695c'
        };
        return { base, color: colors[base] || '#495057' };
    }

    createBreakdownTable(headers, rows, options = {}) {
        const compact = options.compact === true;
        const cellPad = compact ? '6px 8px' : '10px 12px';
        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: compact ? '12px' : '13px'
        });
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach((h, colIdx) => {
            const th = document.createElement('th');
            th.textContent = h;
            const align = options.rightAlignLast && colIdx === headers.length - 1 ? 'right' : 'left';
            Object.assign(th.style, {
                padding: cellPad,
                textAlign: align,
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                backgroundColor: '#495057',
                color: '#fff',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        rows.forEach((row, i) => {
            const tr = document.createElement('tr');
            Object.assign(tr.style, { backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' });
            tr.addEventListener('mouseenter', () => { tr.style.backgroundColor = '#e8f4fd'; });
            tr.addEventListener('mouseleave', () => { tr.style.backgroundColor = i % 2 === 0 ? '#fff' : '#f8fafc'; });
            row.forEach((cell, colIdx) => {
                const td = document.createElement('td');
                const align = options.rightAlignLast && colIdx === row.length - 1 ? 'right' : 'left';
                Object.assign(td.style, { padding: cellPad, borderBottom: '1px solid #e9ecef', textAlign: align });
                if (colIdx === 0 && cell) {
                    const { base, color } = this._normalizeElementType(cell);
                    const badge = document.createElement('span');
                    badge.textContent = base;
                    badge.style.cssText = `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${color}22; color: ${color};`;
                    td.appendChild(badge);
                } else {
                    td.textContent = cell;
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, { overflow: 'hidden' });
        wrapper.appendChild(table);
        return wrapper;
    }

    createTable(headers, rows, options = {}) {
        const compact = options.compact === true;
        const cellPad = compact ? '4px 6px' : '8px';
        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: compact ? '12px' : '13px'
        });
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach((h, colIdx) => {
            const th = document.createElement('th');
            th.textContent = h;
            const align = options.rightAlignLast && colIdx === headers.length - 1 ? 'right' : 'left';
            Object.assign(th.style, {
                padding: cellPad,
                textAlign: align,
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                backgroundColor: '#e9ecef'
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        rows.forEach((row, i) => {
            const tr = document.createElement('tr');
            Object.assign(tr.style, { backgroundColor: i % 2 === 0 ? '#fff' : '#f8f9fa' });
            tr.addEventListener('mouseenter', () => { tr.style.backgroundColor = '#f1f3f5'; });
            tr.addEventListener('mouseleave', () => { tr.style.backgroundColor = i % 2 === 0 ? '#fff' : '#f8f9fa'; });
            row.forEach((cell, colIdx) => {
                const td = document.createElement('td');
                td.textContent = cell;
                const align = options.rightAlignLast && colIdx === row.length - 1 ? 'right' : 'left';
                Object.assign(td.style, { padding: cellPad, borderBottom: '1px solid #dee2e6', textAlign: align });
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            overflow: 'hidden',
            ...(compact ? {} : {
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #dee2e6'
            })
        });
        wrapper.appendChild(table);
        return wrapper;
    }

    show() {
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
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

        if (this._createSummaryCards) {
            container.appendChild(this._createSummaryCards());
        }

        const form = this.createForm();
        container.appendChild(form);

        const buttonDiv = document.createElement('div');
        Object.assign(buttonDiv.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef'
        });
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            ...DIALOG_STYLES.button,
            width: 'auto',
            padding: '8px 24px'
        });
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.backgroundColor = DIALOG_STYLES.buttonHover.backgroundColor; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.backgroundColor = DIALOG_STYLES.button.backgroundColor; });
        closeBtn.onclick = () => {
            this.destroy();
            this.ui && typeof this.ui.hideDialog === 'function' && this.ui.hideDialog();
        };
        buttonDiv.appendChild(closeBtn);
        container.appendChild(buttonDiv);

        this.container = container;
        // Always use modal overlay so results are visible (avoids DrawIO dialog stacking issues)
        this._showResultsModal(container);
    }

    _showResultsModal(content) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10001'
        });

        const dialogBox = document.createElement('div');
        Object.assign(dialogBox.style, {
            ...DIALOG_STYLES.container,
            maxWidth: '800px',
            width: '90%',
            maxHeight: '85vh',
            overflow: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        });
        dialogBox.appendChild(content);

        overlay.appendChild(dialogBox);
        document.body.appendChild(overlay);
        this.modalOverlay = overlay;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.destroy();
                if (document.body.contains(overlay)) document.body.removeChild(overlay);
            }
        });
    }

    destroy() {
        if (this.modalOverlay && document.body.contains(this.modalOverlay)) {
            try { document.body.removeChild(this.modalOverlay); } catch (e) { /* ignore */ }
        }
        this.modalOverlay = null;
        this.container = null;
        this.results = null;
        super.destroy?.();
    }
}

globalThis.EconomicAnalysisResultsDialog = EconomicAnalysisResultsDialog;
