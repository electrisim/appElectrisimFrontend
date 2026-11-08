/**
 * Styled replacement for window.alert, matching confirmDialog.js.
 *
 * Loaded as a plain script before everything else, so the ~300 existing alert() calls get it
 * without changes. Unlike the native alert it does not block: code after alert() keeps running
 * (no caller relies on the pause; none navigates away right after an alert).
 *
 * The plain-text message is shaped for reading:
 *  - "X failed: reason" becomes the title "X failed" and the body "Reason".
 *  - "Title:\n\n..." (e.g. "Short circuit warnings:") becomes the title.
 *  - Lines starting with "•", "-" or "*" become a list.
 *  - A trailing paragraph that looks like a raw exception ("empty net.motor") goes into a
 *    collapsed "Technical details" block.
 * Several alerts in a row are queued and shown one at a time. window.nativeAlert keeps the old one.
 */
(function () {
    'use strict';
    if (window.__electrisimStyledAlert) return;
    window.__electrisimStyledAlert = true;
    window.nativeAlert = window.alert.bind(window);

    var VARIANTS = {
        error: { accent: '#dc2626', soft: '#fef2f2', border: '#fca5a5', icon: '✕', button: '#dc2626', hover: '#b91c1c', title: 'Something went wrong' },
        warning: { accent: '#d97706', soft: '#fffbeb', border: '#fcd34d', icon: '⚠', button: '#d97706', hover: '#b45309', title: 'Please check' },
        success: { accent: '#16a34a', soft: '#f0fdf4', border: '#86efac', icon: '✓', button: '#16a34a', hover: '#15803d', title: 'Done' },
        info: { accent: '#2563eb', soft: '#eff6ff', border: '#93c5fd', icon: 'i', button: '#2563eb', hover: '#1d4ed8', title: 'Notice' }
    };

    function palette() {
        var dark = false;
        try { dark = typeof Editor !== 'undefined' && typeof Editor.isDarkMode === 'function' && Editor.isDarkMode(); } catch (e) { /* ignore */ }
        return dark
            ? { panel: '#1e293b', text: '#e2e8f0', title: '#f8fafc', muted: '#94a3b8', line: '#334155', footer: '#172033', code: '#0f172a', ghost: '#1e293b', ghostBorder: '#475569', ghostText: '#cbd5e1' }
            : { panel: '#ffffff', text: '#334155', title: '#0f172a', muted: '#64748b', line: '#f1f5f9', footer: '#fafafa', code: '#f8fafc', ghost: '#ffffff', ghostBorder: '#cbd5e1', ghostText: '#475569' };
    }

    function variantFor(text) {
        if (/\b(warning|warnings|assum)/i.test(text) && !/\bfail/i.test(text)) return 'warning';
        if (/\b(fail(ed|ure)?|error|could not|couldn't|cannot|can't|unable|invalid|not found|no \w+( \w+)? found|missing|denied|not allowed|not converge)/i.test(text)) return 'error';
        if (/\b(success(fully)?|saved|exported|copied|completed?|downloaded)\b/i.test(text)) return 'success';
        if (/\b(please|check|select|make sure|must|required|not supported)\b/i.test(text)) return 'warning';
        return 'info';
    }

    function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

    // Short, lowercase, no sentence punctuation: a raw exception string rather than prose.
    function looksTechnical(p) {
        if (/Traceback|^\s+at |Exception\b|Error:/m.test(p)) return true;
        return p.length < 200 && !/\n/.test(p) && /^[a-z_'"(\[]/.test(p) && !/[.!?]$/.test(p);
    }

    function parse(raw) {
        var text = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();
        var variant = variantFor(text);
        var title = '';
        var paragraphs = text.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);

        // "Title:" alone as the first paragraph.
        if (paragraphs.length > 1 && /^[^\n.]{3,70}:$/.test(paragraphs[0])) {
            title = paragraphs.shift().slice(0, -1);
        } else if (paragraphs.length) {
            // "Load flow failed: reason" -> title + reason.
            var m = /^([A-Z][^:\n]{2,70}?\b(failed|error|warnings?|not available|unavailable))\s*:\s*([\s\S]+)$/i.exec(paragraphs[0]);
            if (m) {
                title = m[1];
                paragraphs[0] = capitalise(m[3].trim());
            }
        }

        var details = '';
        if (paragraphs.length > 1 && looksTechnical(paragraphs[paragraphs.length - 1])) {
            details = paragraphs.pop();
        }
        return { variant: variant, title: title || VARIANTS[variant].title, paragraphs: paragraphs, details: details, raw: text };
    }

    function ensureKeyframes() {
        if (document.getElementById('electrisim-alert-keyframes')) return;
        var style = document.createElement('style');
        style.id = 'electrisim-alert-keyframes';
        style.textContent = '@keyframes electrisimAlertIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'
            + '.electrisim-alert-btn:focus{outline:none}'
            + '.electrisim-alert-btn:focus-visible{outline:2px solid #94a3b8;outline-offset:2px}'
            + '.electrisim-alert-body ul{margin:0 0 12px;padding:0 0 0 18px}'
            + '.electrisim-alert-body li{margin:0 0 6px}'
            + '.electrisim-alert-body p{margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere}';
        document.head.appendChild(style);
    }

    function el(tag, style, text) {
        var node = document.createElement(tag);
        if (style) Object.assign(node.style, style);
        if (text != null) node.textContent = text;
        return node;
    }

    function renderParagraph(container, p, theme) {
        var lines = p.split('\n');
        var isList = lines.every(function (l) { return /^\s*[•\-*]\s+/.test(l); });
        if (isList && lines.length) {
            var ul = el('ul');
            lines.forEach(function (l) { ul.appendChild(el('li', null, l.replace(/^\s*[•\-*]\s+/, ''))); });
            container.appendChild(ul);
            return;
        }
        // "• item" paragraphs that follow each other read as one list.
        var single = /^\s*[•]\s+([\s\S]+)$/.exec(p);
        if (single) {
            var last = container.lastElementChild;
            if (!last || last.tagName !== 'UL') { last = el('ul'); container.appendChild(last); }
            last.appendChild(el('li', null, single[1]));
            return;
        }
        container.appendChild(el('p', null, p));
    }

    var queue = [];
    var open = false;

    function showNext() {
        if (open || !queue.length) return;
        if (!document.body) { document.addEventListener('DOMContentLoaded', showNext, { once: true }); return; }
        open = true;
        var info = parse(queue.shift());
        var theme = VARIANTS[info.variant];
        var c = palette();
        ensureKeyframes();

        var overlay = el('div', {
            position: 'fixed', inset: '0', backgroundColor: 'rgba(15,23,42,0.45)', zIndex: '2000000020',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        });
        overlay.setAttribute('role', 'presentation');

        var panel = el('div', {
            backgroundColor: c.panel, borderRadius: '12px', boxShadow: '0 20px 48px rgba(15,23,42,0.25)',
            width: 'min(480px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif', animation: 'electrisimAlertIn .16s ease-out',
            borderTop: '4px solid ' + theme.accent
        });
        panel.setAttribute('role', info.variant === 'error' || info.variant === 'warning' ? 'alertdialog' : 'dialog');
        panel.setAttribute('aria-modal', 'true');

        var header = el('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 22px 6px' });
        var icon = el('div', {
            flexShrink: '0', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: theme.soft,
            border: '1px solid ' + theme.border, color: theme.accent, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: info.variant === 'info' ? '18px' : '17px', fontWeight: '700',
            fontFamily: info.variant === 'info' ? 'Georgia, serif' : 'inherit'
        }, theme.icon);
        var titleEl = el('h2', { margin: '0', fontSize: '17px', fontWeight: '700', color: c.title, lineHeight: '1.3' }, info.title);
        titleEl.id = 'electrisim-alert-title-' + Date.now();
        panel.setAttribute('aria-labelledby', titleEl.id);
        header.appendChild(icon);
        header.appendChild(titleEl);

        var body = el('div', { padding: '8px 22px 4px 70px', color: c.text, fontSize: '14px', lineHeight: '1.55', overflowY: 'auto' });
        body.className = 'electrisim-alert-body';
        info.paragraphs.forEach(function (p) { renderParagraph(body, p, theme); });

        if (info.details) {
            var det = el('details', { margin: '0 0 12px', fontSize: '12px', color: c.muted });
            var sum = el('summary', { cursor: 'pointer', userSelect: 'none' }, 'Technical details');
            var pre = el('pre', {
                margin: '6px 0 0', padding: '8px 10px', background: c.code, border: '1px solid ' + c.line,
                borderRadius: '6px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '160px',
                overflowY: 'auto', fontFamily: 'Consolas, Menlo, monospace', fontSize: '12px', color: c.text
            }, info.details);
            det.appendChild(sum);
            det.appendChild(pre);
            body.appendChild(det);
        }

        var footer = el('div', { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 22px 16px', borderTop: '1px solid ' + c.line, backgroundColor: c.footer });
        var btnBase = { padding: '8px 18px', fontSize: '14px', fontWeight: '600', borderRadius: '8px', cursor: 'pointer', lineHeight: '1.2' };

        var copy = null;
        if (info.variant === 'error' || info.variant === 'warning') {
            copy = el('button', Object.assign({}, btnBase, { background: c.ghost, color: c.ghostText, border: '1px solid ' + c.ghostBorder }), 'Copy');
            copy.type = 'button';
            copy.className = 'electrisim-alert-btn';
            copy.title = 'Copy the message, e.g. to send to electrisim@electrisim.com';
            copy.addEventListener('click', function () {
                var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 1500); };
                try {
                    navigator.clipboard.writeText(info.raw).then(done, function () {});
                } catch (e) { /* clipboard unavailable */ }
            });
            footer.appendChild(copy);
        }

        var ok = el('button', Object.assign({}, btnBase, { background: theme.button, color: '#fff', border: 'none', minWidth: '84px' }), 'OK');
        ok.type = 'button';
        ok.className = 'electrisim-alert-btn';
        ok.addEventListener('mouseenter', function () { ok.style.background = theme.hover; });
        ok.addEventListener('mouseleave', function () { ok.style.background = theme.button; });
        footer.appendChild(ok);

        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        overlay.appendChild(panel);

        var previousFocus = document.activeElement;
        function close() {
            document.removeEventListener('keydown', onKey, true);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            open = false;
            try { if (previousFocus && previousFocus.focus) previousFocus.focus(); } catch (e) { /* ignore */ }
            showNext();
        }
        function onKey(e) {
            if (e.key === 'Escape' || (e.key === 'Enter' && (!copy || document.activeElement !== copy))) {
                e.preventDefault();
                e.stopPropagation();
                close();
            } else if (e.key === 'Tab') {
                // Keep focus inside the dialog.
                var buttons = footer.querySelectorAll('button');
                var first = buttons[0], last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
        ok.addEventListener('click', close);
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey, true);

        document.body.appendChild(overlay);
        ok.focus();
    }

    window.alert = function (message) {
        queue.push(message);
        showNext();
    };
    window.electrisimAlert = window.alert;
})();
