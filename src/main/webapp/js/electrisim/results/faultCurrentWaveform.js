/**
 * Fault current waveform: what the r.m.s. short-circuit result looks like in time.
 *
 * Takes a bus row of a short-circuit run (Ik", ip, Rk, Xk) and draws i(t) for the three phases:
 * the AC component plus the decaying DC component that depends on the instant the fault starts.
 * Shows the peak, and the DC component and asymmetrical current at breaker contact parting,
 * against the 45 ms time constant standard breakers are tested with (IEC 62271-100).
 *
 * Assumptions, also shown to the user:
 *  - the AC component stays at Ik" (far-from-generator fault); near machines it decays;
 *  - one DC time constant, taken from the IEC 60909 peak factor kappa = ip / (sqrt(2) Ik")
 *    when ip is available (the same R/X the standard uses for i_dc), else from Xk / Rk.
 */
(function (root) {
    'use strict';

    var SQRT2 = Math.SQRT2;
    var DEG = Math.PI / 180;
    var STANDARD_TAU_MS = 45;
    var PHASE_COLOURS = ['#d62828', '#e09f00', '#1d6fd8'];
    var PHASE_NAMES = ['L1', 'L2', 'L3'];

    function num(v) {
        if (v === null || v === undefined || v === '') return null;
        var n = Number(v);
        return isFinite(n) ? n : null;
    }

    /** R/X behind the IEC 60909 peak factor kappa = 1.02 + 0.98 exp(-3 R/X). */
    function rxFromKappa(kappa) {
        if (!(kappa > 1.0201) || !(kappa < 1.9999)) return null;
        return -Math.log((kappa - 1.02) / 0.98) / 3;
    }

    function kappaFromRx(rx) {
        return 1.02 + 0.98 * Math.exp(-3 * rx);
    }

    /**
     * Build the waveform model for one bus row.
     * @returns {object|null} null when the row has no usable current
     */
    function buildModel(row, opts) {
        opts = opts || {};
        var ik = num(row.ikss_ka);
        if (ik === null) ik = num(row.i_first_sym_ka);
        if (ik === null || ik <= 0) return null;
        var ip = num(row.ip_ka);
        if (ip === null) ip = num(row.i_first_peak_ka);
        var f = num(opts.frequency) || 50;
        var rk = num(row.rk_ohm);
        var xk = num(row.xk_ohm);
        var xrPoint = (rk !== null && xk !== null && Math.abs(rk) > 1e-12) ? Math.abs(xk / rk) : null;
        var xrAnsi = num(row.xr_first);

        var xr = null;
        var source = '';
        var kappaIec = (ip !== null && ip > 0) ? ip / (SQRT2 * ik) : null;
        var rx = kappaIec !== null && xrAnsi === null ? rxFromKappa(kappaIec) : null;
        if (xrAnsi !== null && xrAnsi > 0) {
            xr = xrAnsi;
            source = 'X/R of the ANSI study';
        } else if (rx !== null && rx > 0) {
            xr = 1 / rx;
            source = 'IEC 60909 peak factor κ';
        } else if (xrPoint !== null) {
            xr = xrPoint;
            source = 'Xk / Rk at the fault point';
        } else {
            xr = 10;
            source = 'assumed X/R = 10 (no R and X in the results)';
        }
        xr = Math.min(Math.max(xr, 0.05), 500);
        var omega = 2 * Math.PI * f;
        return {
            ik: ik,
            ipStudy: ip,
            kappaStudy: kappaIec,
            xr: xr,
            xrPoint: xrPoint,
            xrSource: source,
            f: f,
            omega: omega,
            phi: Math.atan(xr),
            tau: xr / omega,            // DC time constant [s]
            threePhase: (opts.faultType || '3ph') === '3ph',
            faultType: opts.faultType || '3ph',
            label: opts.label || String(row.name || '')
        };
    }

    /** Instantaneous current of phase k (0, 1, 2) in kA; alphaDeg is the L1 voltage angle at fault start. */
    function phaseCurrent(m, k, alphaDeg, t) {
        var th = alphaDeg * DEG - k * 120 * DEG - m.phi;
        return SQRT2 * m.ik * (Math.sin(m.omega * t + th) - Math.sin(th) * Math.exp(-t / m.tau));
    }

    /** DC component of phase k in kA. */
    function phaseDc(m, k, alphaDeg, t) {
        var th = alphaDeg * DEG - k * 120 * DEG - m.phi;
        return -SQRT2 * m.ik * Math.sin(th) * Math.exp(-t / m.tau);
    }

    function phaseCount(m) { return m.threePhase ? 3 : 1; }

    /** Largest instantaneous current over the phases and the first cycles. */
    function findPeak(m, alphaDeg, steps) {
        var n = steps || 720;
        var span = 1.5 / m.f;
        var best = { ka: 0, abs: 0, t: 0, phase: 0 };
        for (var k = 0; k < phaseCount(m); k++) {
            for (var i = 0; i <= n; i++) {
                var t = span * i / n;
                var v = phaseCurrent(m, k, alphaDeg, t);
                if (Math.abs(v) > best.abs) best = { ka: v, abs: Math.abs(v), t: t, phase: k };
            }
        }
        return best;
    }

    /** Closing angle that gives L1 its highest peak (close to a voltage zero). */
    function worstAngle(m) {
        var best = 0;
        var bestAbs = -1;
        var single = { ik: m.ik, omega: m.omega, phi: m.phi, tau: m.tau, f: m.f, threePhase: false };
        for (var a = 0; a < 360; a += 1) {
            var p = findPeak(single, a, 240).abs;
            if (p > bestAbs + 1e-12) { bestAbs = p; best = a; }
        }
        // refine to 0.1 degree
        for (var d = -1; d <= 1.0001; d += 0.1) {
            var q = findPeak(single, best + d, 480).abs;
            if (q > bestAbs + 1e-12) { bestAbs = q; best = best + d; }
        }
        return ((best % 360) + 360) % 360;
    }

    /** Breaker duty at contact parting, for the phase with the full DC offset. */
    function breakerDuty(m, tcpMs) {
        var t = Math.max(0, tcpMs) / 1000;
        var dcFraction = Math.exp(-t / m.tau);
        var stdFraction = Math.exp(-tcpMs / STANDARD_TAU_MS);
        return {
            dcPercent: 100 * dcFraction,
            dcKa: SQRT2 * m.ik * dcFraction,
            asymKa: m.ik * Math.sqrt(1 + 2 * dcFraction * dcFraction),
            standardDcPercent: 100 * stdFraction,
            standardAsymKa: m.ik * Math.sqrt(1 + 2 * stdFraction * stdFraction),
            exceedsStandard: m.tau * 1000 > STANDARD_TAU_MS * 1.02
        };
    }

    function defaultWindowMs(m) {
        var cycles = Math.ceil(Math.max(5, Math.min(10, 2.2 * m.tau * m.f)));
        return Math.round(1000 * cycles / m.f);
    }

    function fmtKa(v) {
        if (v === null || v === undefined || !isFinite(v)) return '—';
        var a = Math.abs(v);
        return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
    }

    function niceStep(span, target) {
        var raw = span / Math.max(1, target);
        var pow = Math.pow(10, Math.floor(Math.log10(raw)));
        var f = raw / pow;
        return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
    }

    function verdictText(m, duty, tcpMs) {
        var tauMs = m.tau * 1000;
        if (duty.exceedsStandard) {
            return 'DC time constant ' + tauMs.toFixed(0) + ' ms is above the 45 ms of a standard breaker: ' +
                duty.dcPercent.toFixed(0) + ' % DC at contact parting, against ' + duty.standardDcPercent.toFixed(0) + ' % in the type test.';
        }
        return 'DC time constant ' + tauMs.toFixed(0) + ' ms is within the 45 ms of a standard breaker: ' +
            duty.dcPercent.toFixed(0) + ' % DC at contact parting (' + tcpMs + ' ms), ' + duty.standardDcPercent.toFixed(0) + ' % covered by the type test.';
    }

    /**
     * Draw the chart.
     * state: { alphaDeg, tcpMs, windowMs, progress (0..1, how much of the time axis is revealed) }
     * opts:  { poster, unit, title, subtitle }
     */
    function drawFaultWaveformChart(ctx, W, H, m, state, opts) {
        opts = opts || {};
        var poster = !!opts.poster;
        var u = opts.unit || Math.min(W, H) / 1000;
        var font = function (px, weight) {
            return (weight || 400) + ' ' + Math.round(px * u) + 'px -apple-system, "Segoe UI", Arial, sans-serif';
        };
        var alpha = state.alphaDeg;
        var tcpMs = state.tcpMs;
        var winMs = state.windowMs;
        var p = Math.max(0, Math.min(1, state.progress == null ? 1 : state.progress));
        var nPh = phaseCount(m);
        var duty = breakerDuty(m, tcpMs);
        var peak = findPeak(m, alpha);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        var top = 26 * u;
        if (poster) {
            ctx.fillStyle = '#12263a';
            // the title shrinks to fit, so long numbers never run off the image
            var titlePx = 46;
            ctx.font = font(titlePx, 700);
            while (titlePx > 28 && ctx.measureText(opts.title || '').width > W - 96 * u) {
                titlePx -= 2;
                ctx.font = font(titlePx, 700);
            }
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.fillText(opts.title || '', 48 * u, 44 * u);
            ctx.fillStyle = '#5c6b7a';
            ctx.font = font(26, 400);
            ctx.fillText(opts.subtitle || '', 48 * u, 104 * u);
            top = 170 * u;
        }
        var footer = poster ? 250 * u : 0;
        var left = (poster ? 120 : 78) * u;
        var right = W - (poster ? 60 : 30) * u;
        var bottom = H - footer - (poster ? 96 : 62) * u;
        var plotW = right - left;
        var plotH = bottom - top;

        // The scale does not depend on the closing angle, so the picture stays still while the angle moves.
        var worstPossible = kappaFromRx(1 / m.xr) * SQRT2 * m.ik;
        var yAbs = Math.max(worstPossible, m.ipStudy || 0, peak.abs) * 1.2;
        var yStep = niceStep(2 * yAbs, 8);
        yAbs = Math.ceil(yAbs / yStep) * yStep;
        var X = function (ms) { return left + (ms / winMs) * plotW; };
        var Y = function (ka) { return top + plotH / 2 - (ka / yAbs) * (plotH / 2); };

        // grid
        ctx.strokeStyle = '#e6eaee';
        ctx.lineWidth = Math.max(1, 1.2 * u);
        ctx.fillStyle = '#5c6b7a';
        ctx.font = font(poster ? 22 : 17);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (var y = -yAbs; y <= yAbs + 1e-9; y += yStep) {
            ctx.beginPath(); ctx.moveTo(left, Y(y)); ctx.lineTo(right, Y(y)); ctx.stroke();
            ctx.fillText(Math.abs(y) < 1e-9 ? '0' : (yStep >= 1 ? y.toFixed(0) : y.toFixed(1)), left - 10 * u, Y(y));
        }
        var xStep = niceStep(winMs, 8);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (var x = 0; x <= winMs + 1e-9; x += xStep) {
            ctx.beginPath(); ctx.moveTo(X(x), top); ctx.lineTo(X(x), bottom); ctx.stroke();
            ctx.fillText(String(Math.round(x)), X(x), bottom + 10 * u);
        }
        ctx.strokeStyle = '#9aa7b4';
        ctx.lineWidth = Math.max(1, 1.6 * u);
        ctx.strokeRect(left, top, plotW, plotH);
        ctx.beginPath(); ctx.moveTo(left, Y(0)); ctx.lineTo(right, Y(0)); ctx.stroke();
        ctx.fillStyle = '#33475b';
        ctx.font = font(poster ? 24 : 18, 600);
        ctx.fillText('Time after the fault starts [ms]', left + plotW / 2, bottom + (poster ? 46 : 36) * u);
        ctx.save();
        ctx.translate(left - (poster ? 84 : 56) * u, top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = 'middle';
        ctx.fillText('Fault current [kA]', 0, 0);
        ctx.restore();

        // right-aligned text with a light backing, so it stays readable over the traces
        var backedText = function (text, xRight, yy, baseline, colour) {
            var tw = ctx.measureText(text).width;
            var th = (poster ? 26 : 19) * u;
            ctx.fillStyle = 'rgba(255,255,255,0.82)';
            ctx.fillRect(xRight - tw - 5 * u, baseline === 'bottom' ? yy - th : yy - 2 * u, tw + 10 * u, th + 2 * u);
            ctx.fillStyle = colour;
            ctx.textAlign = 'right';
            ctx.textBaseline = baseline;
            ctx.fillText(text, xRight, yy);
        };

        // symmetrical peak band
        var symPeak = SQRT2 * m.ik;
        ctx.setLineDash([10 * u, 8 * u]);
        ctx.strokeStyle = '#8795a3';
        ctx.lineWidth = Math.max(1, 1.6 * u);
        [symPeak, -symPeak].forEach(function (v) {
            ctx.beginPath(); ctx.moveTo(left, Y(v)); ctx.lineTo(right, Y(v)); ctx.stroke();
        });
        ctx.setLineDash([]);
        var symLabel = 'AC peak without offset: ±' + fmtKa(symPeak) + ' kA';

        // closing angle read-out sits in the top right corner; its box is drawn last
        var a360 = Math.round(((alpha % 360) + 360) % 360) % 360;
        var read = 'fault starts at ' + a360 + '° of the ' + (nPh > 1 ? 'L1 ' : '') + 'voltage wave';
        ctx.font = font(poster ? 22 : 15, 600);
        var rw = ctx.measureText(read).width + 24 * u;
        var rh = (poster ? 38 : 28) * u;
        var rx0 = right - 12 * u - rw;
        var ry0 = top + 12 * u;

        // peak from the study (ip), on the side of the largest peak
        ctx.font = font(poster ? 20 : 14, 600);
        var ipLabel = null;
        if (m.ipStudy) {
            var sign = peak.ka < 0 ? -1 : 1;
            ctx.strokeStyle = '#c92a2a';
            ctx.lineWidth = Math.max(1, 2 * u);
            ctx.setLineDash([4 * u, 5 * u]);
            ctx.beginPath(); ctx.moveTo(left, Y(sign * m.ipStudy)); ctx.lineTo(right, Y(sign * m.ipStudy)); ctx.stroke();
            ctx.setLineDash([]);
            // above its line at the top, below it at the bottom; pushed under the line if the read-out is in the way
            var above = sign > 0 && Y(m.ipStudy) - (poster ? 30 : 22) * u > ry0 + rh;
            ipLabel = { text: 'ip from the study: ' + fmtKa(m.ipStudy) + ' kA', y: Y(sign * m.ipStudy) + (above ? -5 : 5) * u, base: above ? 'bottom' : 'top' };
        }

        // traces, revealed up to the playhead
        var tNowMs = winMs * p;
        var N = Math.max(600, Math.round(plotW / Math.max(1, u) * 1.2));
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, Math.max(0, X(tNowMs) - left) + 1, plotH);
        ctx.clip();
        // DC component of the phase with the largest offset
        var dcPhase = 0;
        var dcBest = -1;
        for (var k0 = 0; k0 < nPh; k0++) {
            var d0 = Math.abs(phaseDc(m, k0, alpha, 0));
            if (d0 > dcBest) { dcBest = d0; dcPhase = k0; }
        }
        ctx.strokeStyle = PHASE_COLOURS[dcPhase];
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(1, 2.2 * u);
        ctx.setLineDash([9 * u, 7 * u]);
        ctx.beginPath();
        for (var i = 0; i <= N; i++) {
            var tms = winMs * i / N;
            var v = phaseDc(m, dcPhase, alpha, tms / 1000);
            if (i === 0) ctx.moveTo(X(tms), Y(v)); else ctx.lineTo(X(tms), Y(v));
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        for (var k = nPh - 1; k >= 0; k--) {
            ctx.strokeStyle = PHASE_COLOURS[k];
            ctx.lineWidth = Math.max(1.5, (k === peak.phase ? 4.4 : 3) * u);
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (var j = 0; j <= N; j++) {
                var tj = winMs * j / N;
                var vj = phaseCurrent(m, k, alpha, tj / 1000);
                if (j === 0) ctx.moveTo(X(tj), Y(vj)); else ctx.lineTo(X(tj), Y(vj));
            }
            ctx.stroke();
        }
        ctx.restore();

        // labels of the two reference levels, over the traces
        ctx.font = font(poster ? 20 : 14, 600);
        backedText(symLabel, right - 10 * u, Y(-symPeak) + 6 * u, 'top', '#5c6b7a');
        if (ipLabel) backedText(ipLabel.text, right - 10 * u, ipLabel.y, ipLabel.base, '#c92a2a');

        // peak marker
        var peakMs = peak.t * 1000;
        if (tNowMs >= peakMs) {
            ctx.fillStyle = PHASE_COLOURS[peak.phase];
            ctx.beginPath(); ctx.arc(X(peakMs), Y(peak.ka), 9 * u, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, 2 * u);
            ctx.stroke();
            var ptxt = 'peak ' + fmtKa(peak.abs) + ' kA at ' + peakMs.toFixed(1) + ' ms' + (nPh > 1 ? ' (' + PHASE_NAMES[peak.phase] + ')' : '');
            ctx.font = font(poster ? 22 : 15, 700);
            var pw = ctx.measureText(ptxt).width + 18 * u;
            var ph = (poster ? 36 : 26) * u;
            var px = X(peakMs) + 16 * u;
            var py = Y(peak.ka) - ph / 2;
            py = Math.max(top + 4 * u, Math.min(bottom - ph - 4 * u, py));
            ctx.fillStyle = '#12263a';
            ctx.fillRect(px, py, pw, ph);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(ptxt, px + 9 * u, py + ph / 2);
        }

        // contact parting
        if (tcpMs > 0 && tcpMs < winMs && tNowMs >= tcpMs) {
            var cx = X(tcpMs);
            ctx.strokeStyle = '#6f42c1';
            ctx.lineWidth = Math.max(1.5, 3 * u);
            ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();
            var dcNow = phaseDc(m, dcPhase, alpha, tcpMs / 1000);
            ctx.fillStyle = '#6f42c1';
            ctx.beginPath(); ctx.arc(cx, Y(dcNow), 7 * u, 0, Math.PI * 2); ctx.fill();
            var lines = ['breaker contacts part: ' + tcpMs + ' ms', 'DC component up to ' + duty.dcPercent.toFixed(0) + ' % of the AC peak'];
            ctx.font = font(poster ? 21 : 14, 700);
            var cw = Math.max(ctx.measureText(lines[0]).width, ctx.measureText(lines[1]).width) + 18 * u;
            var lh = (poster ? 30 : 21) * u;
            var ch = lines.length * lh + 10 * u;
            var bx = cx + 10 * u;
            if (bx + cw > right - 4 * u) bx = cx - 10 * u - cw;
            var by = bottom - ch - 10 * u;
            ctx.fillStyle = '#6f42c1';
            ctx.fillRect(bx, by, cw, ch);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            lines.forEach(function (t, li) { ctx.fillText(t, bx + 9 * u, by + 5 * u + lh / 2 + li * lh); });
        }

        // playhead with the instantaneous values
        if (p < 1) {
            ctx.strokeStyle = '#12263a';
            ctx.lineWidth = Math.max(1, 2 * u);
            ctx.beginPath(); ctx.moveTo(X(tNowMs), top); ctx.lineTo(X(tNowMs), bottom); ctx.stroke();
            for (var kk = 0; kk < nPh; kk++) {
                ctx.fillStyle = PHASE_COLOURS[kk];
                ctx.beginPath(); ctx.arc(X(tNowMs), Y(phaseCurrent(m, kk, alpha, tNowMs / 1000)), 6 * u, 0, Math.PI * 2); ctx.fill();
            }
        }

        // closing angle read-out
        ctx.font = font(poster ? 22 : 15, 600);
        ctx.fillStyle = 'rgba(255,255,255,0.93)';
        ctx.strokeStyle = '#c9d2db';
        ctx.lineWidth = Math.max(1, 1.2 * u);
        ctx.fillRect(rx0, ry0, rw, rh);
        ctx.strokeRect(rx0, ry0, rw, rh);
        ctx.fillStyle = '#12263a';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(read, rx0 + 12 * u, ry0 + rh / 2);

        if (poster) {
            var fy = H - footer + 6 * u;
            ctx.font = font(21, 400);
            ctx.textBaseline = 'middle';
            var lx = 48 * u;
            for (var q = 0; q < nPh; q++) {
                var lab = nPh > 1 ? 'Phase ' + PHASE_NAMES[q] : 'Fault current';
                ctx.fillStyle = PHASE_COLOURS[q];
                ctx.fillRect(lx, fy - 3 * u, 26 * u, 6 * u);
                ctx.fillStyle = '#33475b';
                ctx.textAlign = 'left';
                ctx.fillText(lab, lx + 34 * u, fy);
                lx += ctx.measureText(lab).width + 62 * u;
            }
            ctx.fillStyle = '#33475b';
            ctx.fillText('- - -  DC component', lx, fy);
            fy += 46 * u;
            var facts = [
                ['#33475b', 'Result of the study: Ik″ = ' + fmtKa(m.ik) + ' kA r.m.s.'],
                ['#c92a2a', 'Highest peak: ' + fmtKa(worstPossible) + ' kA, ' + (worstPossible / m.ik).toFixed(2) + ' × Ik″ (X/R = ' + m.xr.toFixed(1) + ')'],
                ['#6f42c1', 'At contact parting (' + tcpMs + ' ms): up to ' + duty.dcPercent.toFixed(0) + ' % DC, ' + fmtKa(duty.asymKa) + ' kA asymmetrical'],
                [duty.exceedsStandard ? '#e8590c' : '#198754', 'DC time constant ' + (m.tau * 1000).toFixed(0) + ' ms, standard breaker test: 45 ms (' + duty.standardDcPercent.toFixed(0) + ' % DC)']
            ];
            ctx.font = font(25, 600);
            facts.forEach(function (fct) {
                ctx.fillStyle = fct[0];
                ctx.beginPath(); ctx.arc(60 * u, fy, 9 * u, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#12263a';
                ctx.textAlign = 'left';
                ctx.fillText(fct[1], 82 * u, fy);
                fy += 39 * u;
            });
            ctx.fillStyle = '#8795a3';
            ctx.font = font(20, 400);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('electrisim.com', W - 40 * u, H - 22 * u);
        }
        ctx.restore();
    }

    /**
     * Animation used by Play and by the video: the waveform draws itself at the worst closing
     * angle, then the angle turns one full circle so the offset moves from phase to phase.
     */
    var TL = { lead: 600, draw: 4200, hold1: 900, sweep: 5600, hold2: 2200 };
    TL.total = TL.lead + TL.draw + TL.hold1 + TL.sweep + TL.hold2;

    function timeline(elapsedMs, baseAlpha) {
        var t = elapsedMs - TL.lead;
        if (t <= 0) return { progress: 0, alpha: baseAlpha, done: false };
        if (t < TL.draw) return { progress: t / TL.draw, alpha: baseAlpha, done: false };
        t -= TL.draw + TL.hold1;
        if (t <= 0) return { progress: 1, alpha: baseAlpha, done: false };
        if (t < TL.sweep) {
            var s = t / TL.sweep;
            var eased = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
            return { progress: 1, alpha: baseAlpha + 360 * eased, done: false };
        }
        return { progress: 1, alpha: baseAlpha, done: elapsedMs >= TL.total };
    }

    // ------------------------------------------------------------------ dialog

    var OVERLAY_ID = 'electrisim-fault-waveform-overlay';

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function button(text, colour) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = 'padding:7px 14px;background:' + colour + ';color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;';
        return b;
    }

    function labelled(text, el) {
        var l = document.createElement('label');
        l.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:#343a40;';
        l.appendChild(document.createTextNode(text));
        l.appendChild(el);
        return l;
    }

    function readPref(key, fallback) {
        try {
            var v = localStorage.getItem('electrisimFaultWaveform.' + key);
            return v === null ? fallback : v;
        } catch (_) { return fallback; }
    }

    function savePref(key, value) {
        try { localStorage.setItem('electrisimFaultWaveform.' + key, String(value)); } catch (_) { /* ignore */ }
    }

    function busLabel(row, nameOf) {
        var n = row.dialogName || '';
        if (!n) { try { n = nameOf ? nameOf(row) : ''; } catch (_) { n = ''; } }
        n = String(n || row.name || row.id || '').replace(/_/g, '#');
        return /^\d+$/.test(n) ? 'Bus ' + n : n;
    }

    /**
     * Open the viewer for a short-circuit result.
     * opts: { nameOf(row) -> display name, busId (row to preselect) }
     */
    function showFaultCurrentWaveform(dataJson, opts) {
        opts = opts || {};
        var data = dataJson || {};
        var isAnsi = data.standard === 'ANSI/IEEE C37' ||
            ((data.busbars || []).length > 0 && num(data.busbars[0].i_first_sym_ka) !== null);
        var faultType = (data.study_params && data.study_params.fault_type) || data.fault_type || opts.faultType || '3ph';
        var rows = (data.busbars || []).filter(function (b) {
            var ik = num(b.ikss_ka);
            if (ik === null) ik = num(b.i_first_sym_ka);
            return ik !== null && ik > 0;
        }).map(function (b) { return { row: b, label: busLabel(b, opts.nameOf) }; });
        rows.sort(function (a, b) {
            return (num(b.row.ikss_ka) || num(b.row.i_first_sym_ka) || 0) - (num(a.row.ikss_ka) || num(a.row.i_first_sym_ka) || 0);
        });
        if (!rows.length) {
            window.alert('There is no bus with a short-circuit current in these results. Run a short circuit first.');
            return null;
        }

        var old = document.getElementById(OVERLAY_ID);
        if (old) old.remove();

        var st = {
            index: 0,
            frequency: num(data.frequency_hz) || num(readPref('frequency', '')) || (isAnsi ? 60 : 50),
            tcpMs: num(readPref('tcpMs', '')) || 50,
            alphaDeg: 0,
            progress: 1,
            windowMs: 100,
            model: null,
            timer: null
        };
        if (opts.busId !== undefined && opts.busId !== null) {
            for (var r0 = 0; r0 < rows.length; r0++) {
                if (String(rows[r0].row.id) === String(opts.busId)) { st.index = r0; break; }
            }
        }

        var overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px;';
        var box = document.createElement('div');
        box.style.cssText = "background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.28);max-width:1180px;width:100%;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#212529;";
        overlay.appendChild(box);

        var header = document.createElement('div');
        header.style.cssText = 'padding:16px 24px;border-bottom:1px solid #e9ecef;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
        header.innerHTML = '<h2 style="margin:0;font-size:18px;font-weight:700;">Fault Current Waveform</h2>';
        var closeX = document.createElement('button');
        closeX.textContent = '×';
        closeX.title = 'Close';
        closeX.style.cssText = 'border:none;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#6c757d;padding:0 4px;';
        header.appendChild(closeX);
        box.appendChild(header);

        var body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow-y:auto;padding:18px 24px;';
        box.appendChild(body);

        var verdict = document.createElement('div');
        var tiles = document.createElement('div');
        tiles.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px;';
        body.appendChild(verdict);
        body.appendChild(tiles);

        // inputs
        var inputs = document.createElement('div');
        inputs.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin:4px 0 10px;';
        var inputCss = 'padding:5px 8px;border:1px solid #ced4da;border-radius:6px;font-size:13px;';
        var busSel = document.createElement('select');
        busSel.style.cssText = inputCss + 'max-width:260px;';
        rows.forEach(function (r, i) {
            var o = document.createElement('option');
            o.value = String(i);
            o.textContent = r.label + '  (' + fmtKa(num(r.row.ikss_ka) || num(r.row.i_first_sym_ka)) + ' kA)';
            busSel.appendChild(o);
        });
        busSel.value = String(st.index);
        var freqSel = document.createElement('select');
        freqSel.style.cssText = inputCss;
        [50, 60].forEach(function (f) {
            var o = document.createElement('option');
            o.value = String(f);
            o.textContent = f + ' Hz';
            freqSel.appendChild(o);
        });
        freqSel.value = String(st.frequency === 60 ? 60 : 50);
        st.frequency = Number(freqSel.value);
        var tcpIn = document.createElement('input');
        tcpIn.type = 'number';
        tcpIn.min = '5';
        tcpIn.max = '500';
        tcpIn.step = '5';
        tcpIn.value = String(st.tcpMs);
        tcpIn.style.cssText = inputCss + 'width:70px;';
        tcpIn.title = 'Time from the start of the fault until the breaker contacts separate: relay time plus the minimum opening time of the breaker.';
        var angle = document.createElement('input');
        angle.type = 'range';
        angle.min = '0';
        angle.max = '359';
        angle.step = '1';
        angle.style.cssText = 'width:200px;';
        angle.title = 'Angle of the voltage wave at the instant the fault starts. It decides how much DC offset each phase gets.';
        var angleOut = document.createElement('span');
        angleOut.style.cssText = 'font-size:13px;font-variant-numeric:tabular-nums;min-width:36px;';
        var worstBtn = button('Worst case', '#c92a2a');
        worstBtn.title = 'Set the angle that gives the highest peak';
        var zeroBtn = button('No offset', '#6c757d');
        zeroBtn.title = 'Set the angle at which phase L1 has no DC component';
        inputs.appendChild(labelled('Fault at', busSel));
        inputs.appendChild(labelled('Frequency', freqSel));
        inputs.appendChild(labelled('Contacts part after [ms]', tcpIn));
        var angleWrap = labelled('Fault starts at', angle);
        angleWrap.appendChild(angleOut);
        inputs.appendChild(angleWrap);
        inputs.appendChild(worstBtn);
        inputs.appendChild(zeroBtn);
        body.appendChild(inputs);

        var controls = document.createElement('div');
        controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 8px;';
        var playBtn = button('▶ Play', '#0b5ed7');
        var pngTall = button('Save image 1080×1350', '#198754');
        var pngWide = button('Save image 1920×1080', '#198754');
        var videoBtn = button('Export video', '#6f42c1');
        var csvBtn = button('Download CSV', '#6c757d');
        var status = document.createElement('span');
        status.style.cssText = 'font-size:12px;color:#6c757d;';
        [playBtn, pngTall, pngWide, videoBtn, csvBtn, status].forEach(function (el) { controls.appendChild(el); });
        body.appendChild(controls);

        var wrap = document.createElement('div');
        wrap.style.cssText = 'border:1px solid #dee2e6;border-radius:8px;overflow:hidden;background:#fff;';
        var canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;width:100%;height:auto;';
        wrap.appendChild(canvas);
        body.appendChild(wrap);

        var legend = document.createElement('div');
        legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:#495057;margin:8px 0 12px;';
        body.appendChild(legend);

        var notes = document.createElement('div');
        notes.style.cssText = 'font-size:12px;color:#6c757d;line-height:1.55;margin-top:6px;';
        body.appendChild(notes);

        var footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 24px;border-top:1px solid #e9ecef;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;background:#fafbfc;';
        var closeBtn = button('Close', '#007bff');
        footer.appendChild(closeBtn);
        box.appendChild(footer);

        function chartState() {
            return { alphaDeg: st.alphaDeg, tcpMs: st.tcpMs, windowMs: st.windowMs, progress: st.progress };
        }

        function titles() {
            var m = st.model;
            return {
                title: fmtKa(m.ik) + ' kA in the report. ' + fmtKa(kappaFromRx(1 / m.xr) * SQRT2 * m.ik) + ' kA at the peak.',
                subtitle: (m.faultType === '3ph' ? 'Three-phase' : m.faultType === '1ph' ? 'Single-phase' : 'Two-phase') +
                    ' short circuit at ' + m.label + ' · ' + m.f + ' Hz · X/R = ' + m.xr.toFixed(1)
            };
        }

        function drawScreen() {
            var cssW = Math.max(480, wrap.clientWidth || 900);
            var cssH = Math.round(Math.min(520, Math.max(340, cssW * 0.46)));
            var dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(cssW * dpr);
            canvas.height = Math.round(cssH * dpr);
            drawFaultWaveformChart(canvas.getContext('2d'), canvas.width, canvas.height, st.model, chartState(), { unit: dpr * 0.82 });
        }

        function tile(value, label, sub, colour) {
            return '<div style="padding:12px 14px;background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;text-align:center;">' +
                '<div style="font-size:21px;font-weight:700;color:' + colour + ';line-height:1.2;">' + esc(value) + '</div>' +
                '<div style="font-size:11px;color:#6c757d;margin-top:4px;text-transform:uppercase;letter-spacing:0.03em;">' + esc(label) + '</div>' +
                '<div style="font-size:11px;color:#868e96;margin-top:2px;">' + esc(sub) + '</div></div>';
        }

        function renderText() {
            var m = st.model;
            var duty = breakerDuty(m, st.tcpMs);
            var peak = findPeak(m, st.alphaDeg);
            var worst = kappaFromRx(1 / m.xr) * SQRT2 * m.ik;
            var colour = duty.exceedsStandard ? '#e8590c' : '#198754';
            verdict.style.cssText = 'padding:12px 16px;margin-bottom:14px;border-radius:8px;border-left:6px solid ' + colour + ';background:#f8f9fa;font-size:14px;line-height:1.55;';
            verdict.innerHTML = '<strong>' + esc(fmtKa(m.ik)) + ' kA r.m.s. becomes a peak of up to ' + esc(fmtKa(worst)) + ' kA</strong> (' +
                (worst / m.ik).toFixed(2) + ' × Ik″), depending on the instant the fault starts.<br>' + esc(verdictText(m, duty, st.tcpMs)) +
                (duty.exceedsStandard ? ' Check the breaker against its rated DC component or a special time constant (60, 75 or 120 ms).' : '');
            tiles.innerHTML =
                tile(fmtKa(m.ik) + ' kA', 'Ik″ from the study', 'symmetrical, r.m.s.', '#12263a') +
                tile(fmtKa(peak.abs) + ' kA', 'Peak at this angle', (m.ipStudy ? 'ip from the study: ' + fmtKa(m.ipStudy) + ' kA' : 'highest possible: ' + fmtKa(worst) + ' kA'), '#c92a2a') +
                tile((m.tau * 1000).toFixed(0) + ' ms', 'DC time constant', 'X/R = ' + m.xr.toFixed(1), colour) +
                tile(duty.dcPercent.toFixed(0) + ' %', 'DC at contact parting', 'standard breaker: ' + duty.standardDcPercent.toFixed(0) + ' %', '#6f42c1') +
                tile(fmtKa(duty.asymKa) + ' kA', 'Asymmetrical breaking current', 'r.m.s., AC and DC together', '#6f42c1');
            legend.innerHTML = '';
            for (var k = 0; k < phaseCount(m); k++) {
                legend.innerHTML += '<span><span style="display:inline-block;width:18px;height:4px;background:' + PHASE_COLOURS[k] +
                    ';vertical-align:middle;margin-right:6px;border-radius:2px;"></span>' + (m.threePhase ? 'Phase ' + PHASE_NAMES[k] : 'Fault current') + '</span>';
            }
            legend.innerHTML += '<span>- - - DC component of the phase with the largest offset</span>';
            var a360 = Math.round(((st.alphaDeg % 360) + 360) % 360) % 360;
            angle.value = String(a360);
            angleOut.textContent = a360 + '°';
            notes.innerHTML = [
                'The curve is built from the study result: an AC component of √2·Ik″ and a DC component that decays with the time constant X/(ω·R).',
                'X/R comes from: ' + m.xrSource + '.' + (m.xrPoint !== null && Math.abs(m.xrPoint - m.xr) / m.xr > 0.05
                    ? ' Xk/Rk at the fault point alone would give ' + m.xrPoint.toFixed(1) + '.' : ''),
                'The AC component is kept constant (fault far from generators). Close to generators and motors it decays, so the real current is lower later on and the DC share at contact parting is higher than shown.',
                'Contact parting time is the relay time plus the minimum opening time of the breaker. A standard breaker is type-tested with a DC time constant of 45 ms (IEC 62271-100).',
                isAnsi ? '' : 'Short circuits to IEC 60909 are calculated at 50 Hz in Electrisim; the frequency here only sets the time axis and the time constant.'
            ].filter(Boolean).map(function (n) { return '<div>• ' + esc(n) + '</div>'; }).join('');
        }

        function rebuild(resetAngle) {
            var entry = rows[st.index];
            st.model = buildModel(entry.row, { frequency: st.frequency, faultType: faultType, label: entry.label });
            st.windowMs = defaultWindowMs(st.model);
            if (resetAngle) st.alphaDeg = worstAngle(st.model);
            renderText();
            drawScreen();
        }

        function stopPlay() {
            if (st.timer) clearInterval(st.timer);
            st.timer = null;
            playBtn.textContent = '▶ Play';
        }

        function closeAll() {
            stopPlay();
            window.removeEventListener('resize', drawScreen);
            overlay.remove();
        }

        closeX.onclick = closeAll;
        closeBtn.onclick = closeAll;
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeAll(); });
        window.addEventListener('resize', drawScreen);

        busSel.onchange = function () { stopPlay(); st.progress = 1; st.index = Number(busSel.value) || 0; rebuild(true); };
        freqSel.onchange = function () {
            stopPlay(); st.progress = 1;
            st.frequency = Number(freqSel.value) || 50;
            savePref('frequency', st.frequency);
            rebuild(true);
        };
        tcpIn.onchange = function () {
            var v = Math.round(num(tcpIn.value) || 50);
            st.tcpMs = Math.max(5, Math.min(500, v));
            tcpIn.value = String(st.tcpMs);
            savePref('tcpMs', st.tcpMs);
            renderText();
            drawScreen();
        };
        angle.oninput = function () {
            stopPlay(); st.progress = 1;
            st.alphaDeg = Number(angle.value) || 0;
            renderText();
            drawScreen();
        };
        worstBtn.onclick = function () { stopPlay(); st.progress = 1; st.alphaDeg = worstAngle(st.model); renderText(); drawScreen(); };
        zeroBtn.onclick = function () {
            stopPlay(); st.progress = 1;
            st.alphaDeg = ((st.model.phi / DEG) % 360 + 360) % 360;
            renderText();
            drawScreen();
        };

        playBtn.onclick = function () {
            if (st.timer) { stopPlay(); st.progress = 1; st.alphaDeg = worstAngle(st.model); renderText(); drawScreen(); return; }
            var base = worstAngle(st.model);
            var start = performance.now();
            playBtn.textContent = '■ Stop';
            st.timer = setInterval(function () {
                var tl = timeline(performance.now() - start + TL.lead, base);
                st.progress = tl.progress;
                st.alphaDeg = tl.alpha;
                renderText();
                drawScreen();
                if (tl.done) stopPlay();
            }, 1000 / 30);
        };

        function fileStem() {
            return 'electrisim_fault_waveform_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        }

        function download(href, name, revoke) {
            var a = document.createElement('a');
            a.href = href;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 4000);
        }

        function savePng(w, h) {
            var c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            var t = titles();
            drawFaultWaveformChart(c.getContext('2d'), w, h, st.model,
                { alphaDeg: st.alphaDeg, tcpMs: st.tcpMs, windowMs: st.windowMs, progress: 1 },
                { poster: true, title: t.title, subtitle: t.subtitle });
            download(c.toDataURL('image/png'), fileStem() + '_' + w + 'x' + h + '.png', false);
        }

        function exportVideo(w, h) {
            return new Promise(function (resolve, reject) {
                if (typeof MediaRecorder === 'undefined') { reject(new Error('MediaRecorder is missing')); return; }
                var c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                var ctx = c.getContext('2d');
                var t = titles();
                var m = st.model;
                var base = worstAngle(m);
                var draw = function (tl) {
                    drawFaultWaveformChart(ctx, w, h, m,
                        { alphaDeg: tl.alpha, tcpMs: st.tcpMs, windowMs: st.windowMs, progress: tl.progress },
                        { poster: true, title: t.title, subtitle: t.subtitle });
                };
                draw(timeline(0, base));
                var types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
                var mime = null;
                for (var i = 0; i < types.length; i++) {
                    if (MediaRecorder.isTypeSupported(types[i])) { mime = types[i]; break; }
                }
                if (!mime) { reject(new Error('no supported video format')); return; }
                var recorder = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6000000 });
                var chunks = [];
                recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
                recorder.onerror = function (e) { reject(e.error || new Error('recording failed')); };
                recorder.onstop = function () {
                    var ext = mime.indexOf('video/mp4') === 0 ? 'mp4' : 'webm';
                    var name = fileStem() + '_' + w + 'x' + h + '.' + ext;
                    download(URL.createObjectURL(new Blob(chunks, { type: mime.split(';')[0] })), name, true);
                    resolve(name);
                };
                var start = performance.now();
                recorder.start();
                // A timer, not requestAnimationFrame: animation frames stop when the window is covered.
                var timer = setInterval(function () {
                    var tl = timeline(performance.now() - start, base);
                    draw(tl);
                    if (tl.done) { clearInterval(timer); recorder.stop(); }
                }, 1000 / 30);
            });
        }

        function downloadCsv() {
            var m = st.model;
            var n = phaseCount(m);
            var head = ['t_ms'];
            for (var k = 0; k < n; k++) head.push('i_' + PHASE_NAMES[k] + '_kA', 'i_dc_' + PHASE_NAMES[k] + '_kA');
            var out = [head.join(',')];
            var steps = Math.round(st.windowMs * 10);
            for (var i = 0; i <= steps; i++) {
                var t = i / 10000;
                var line = [(i / 10).toFixed(1)];
                for (var q = 0; q < n; q++) {
                    line.push(phaseCurrent(m, q, st.alphaDeg, t).toFixed(4), phaseDc(m, q, st.alphaDeg, t).toFixed(4));
                }
                out.push(line.join(','));
            }
            download(URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/csv;charset=utf-8;' })), fileStem() + '.csv', true);
        }

        pngTall.onclick = function () { savePng(1080, 1350); };
        pngWide.onclick = function () { savePng(1920, 1080); };
        csvBtn.onclick = downloadCsv;
        videoBtn.onclick = function () {
            videoBtn.disabled = true;
            status.textContent = 'Recording… about ' + Math.round(TL.total / 1000) + ' s';
            exportVideo(1080, 1350).then(function (name) {
                status.textContent = 'Saved ' + name;
            }).catch(function (e) {
                status.textContent = 'Video export is not available in this browser: ' + ((e && e.message) || e);
            }).then(function () { videoBtn.disabled = false; });
        };

        document.body.appendChild(overlay);
        rebuild(true);
        return overlay;
    }

    var api = {
        buildModel: buildModel,
        phaseCurrent: phaseCurrent,
        phaseDc: phaseDc,
        findPeak: findPeak,
        worstAngle: worstAngle,
        breakerDuty: breakerDuty,
        rxFromKappa: rxFromKappa,
        kappaFromRx: kappaFromRx,
        defaultWindowMs: defaultWindowMs,
        timeline: timeline,
        drawFaultWaveformChart: drawFaultWaveformChart
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.ElectrisimFaultWaveform = api;
        if (typeof document !== 'undefined') root.showFaultCurrentWaveform = showFaultCurrentWaveform;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
