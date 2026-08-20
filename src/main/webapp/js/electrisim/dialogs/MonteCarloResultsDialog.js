import { attachBackdropCloseHandler } from '../utils/dialogStyles.js';

/** Displays the statistical results returned by native OpenDSS M1/M2/M3 solves. */
export class MonteCarloResultsDialog {
    constructor(results) {
        this.results = results || {};
    }

    show() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;';
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 6px 28px rgba(0,0,0,.35);max-width:1280px;width:95%;max-height:90vh;overflow:auto;padding:24px;margin:20px;font-family:Arial,sans-serif;color:#222;';
        const summary = this.results.summary || {};
        dialog.innerHTML = `<h2 style="margin:0 0 16px;">OpenDSS Monte Carlo Results (${this._escape(this.results.mode)})</h2>
            <div style="padding:12px 14px;margin-bottom:18px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;font-size:13px;">
                <b>Samples:</b> ${this._number(summary.n_samples)} &nbsp; <b>Converged:</b> ${this._number(summary.converged_count)}
                &nbsp; <b>Failed:</b> ${this._number(summary.failed_count)} &nbsp; <b>Distribution:</b> ${this._escape(this.results.random)}
            </div>`;
        this._appendTable(dialog, 'Bus voltage statistics [pu]', this.results.bus_stats || [], [
            ['name', 'Bus'], ['vmin', 'Min'], ['p5', 'P5'], ['p50', 'P50'], ['p95', 'P95'], ['vmax', 'Max'], ['vmean', 'Mean']
        ]);
        this._appendTable(dialog, 'Line loading statistics [%]', this.results.line_stats || [], [
            ['name', 'Line'], ['loading_mean', 'Mean'], ['p95', 'P95'], ['loading_max', 'Max']
        ]);
        const chartWrap = document.createElement('div');
        chartWrap.innerHTML = '<h3 style="margin:22px 0 10px;">Bus voltage percentiles</h3><div style="height:360px;position:relative;"><canvas></canvas></div>';
        dialog.appendChild(chartWrap);
        const close = document.createElement('button');
        close.textContent = 'Close';
        close.style.cssText = 'float:right;margin-top:20px;padding:8px 18px;background:#007bff;color:#fff;border:0;border-radius:4px;cursor:pointer;';
        close.onclick = () => overlay.remove();
        dialog.appendChild(close);
        overlay.appendChild(dialog);
        attachBackdropCloseHandler(overlay, dialog, () => overlay.remove());
        document.body.appendChild(overlay);
        this._ensureChartJs().then(() => this._drawChart(chartWrap.querySelector('canvas'))).catch((error) => {
            console.warn('Chart.js load failed; Monte Carlo chart omitted:', error);
        });
    }

    _appendTable(dialog, title, rows, columns) {
        const section = document.createElement('section');
        const header = columns.map(([, label]) => `<th style="padding:7px;text-align:left;border-bottom:1px solid #ddd;">${label}</th>`).join('');
        const body = rows.length ? rows.map(row => `<tr>${columns.map(([key]) => `<td style="padding:6px 7px;border-bottom:1px solid #eee;">${key === 'name' ? this._escape(row[key]) : this._number(row[key])}</td>`).join('')}</tr>`).join('') :
            `<tr><td colspan="${columns.length}" style="padding:8px;">No converged samples available.</td></tr>`;
        section.innerHTML = `<h3 style="margin:20px 0 8px;">${title}</h3><div style="overflow:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f5f5f5;">${header}</tr></thead><tbody>${body}</tbody></table></div>`;
        dialog.appendChild(section);
    }

    _drawChart(canvas) {
        const buses = this.results.bus_stats || [];
        if (!canvas || !buses.length || typeof window.Chart !== 'function') return;
        new window.Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: buses.map(bus => bus.name || bus.id),
                datasets: [
                    { label: 'P5', data: buses.map(bus => bus.p5), backgroundColor: '#91c7ae' },
                    { label: 'P50', data: buses.map(bus => bus.p50), backgroundColor: '#5470c6' },
                    { label: 'P95', data: buses.map(bus => bus.p95), backgroundColor: '#ee6666' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: 'Voltage [pu]' } } } }
        });
    }

    _ensureChartJs() {
        if (typeof window.Chart === 'function') return Promise.resolve();
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-chartjs-loader]');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', () => reject(new Error('Chart.js failed to load')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.dataset.chartjsLoader = 'true';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Chart.js failed to load'));
            document.head.appendChild(script);
        });
    }

    _number(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toFixed(4).replace(/\.?0+$/, '') : '-';
    }

    _escape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    }
}

export default MonteCarloResultsDialog;
