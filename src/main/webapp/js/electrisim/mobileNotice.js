/**
 * Mobile notice: tells phone and tablet visitors that Electrisim works best in a desktop
 * browser on a laptop or computer, and helps them send the link to that computer.
 *
 * - Phone: a sheet over the page with "Send link to my computer", "Copy link" and
 *   "Continue on this phone". The app keeps loading behind it, so continuing is quick.
 * - Tablet: a smaller card at the bottom of the screen; the full editor works there,
 *   but a mouse and keyboard make it easier.
 * - Shown once per browser tab; "Don't show this again" remembers the choice on the device.
 * - Never shown in embed mode, the lightbox / chromeless viewer, Electron or inside an iframe.
 * - URL parameter mobileNotice: 0 hides it, 1 or phone or tablet shows it on any device
 *   (for testing).
 *
 * Plain script (not a module) loaded with defer from index.html, so it runs before the
 * large app bundle has loaded. It injects its own styles. classifyDevice and decide have
 * no DOM access and are exported for scripts/mobile-notice.test.js.
 */
(function () {
    'use strict';

    var SESSION_KEY = 'electrisim.mobileNotice.seen';
    var OPT_OUT_KEY = 'electrisim.mobileNotice.optOut';
    var DOCS_URL = 'https://electrisim.com/documentation.html';
    var ROOT_ID = 'electrisim-mobile-notice';

    /**
     * Returns 'phone', 'tablet' or 'desktop'.
     * env: { ua, maxTouchPoints, screenW, screenH, coarse, anyFine }
     *  - coarse: the primary pointer is coarse (a finger)
     *  - anyFine: some pointer is fine (mouse, trackpad, stylus)
     */
    function classifyDevice(env) {
        var ua = env.ua || '';
        var shortSide = Math.min(env.screenW || 0, env.screenH || 0);
        // iPadOS reports a Mac user agent; only the touch points give it away.
        var iPadOS = /Macintosh/.test(ua) && (env.maxTouchPoints || 0) > 1;
        var touchOnly = !!env.coarse && !env.anyFine;

        if (/iPhone|iPod|Windows Phone|IEMobile|BlackBerry|BB10|Opera Mini/i.test(ua) ||
            /Android.*Mobile/i.test(ua)) {
            return 'phone';
        }
        if (/iPad|Tablet|Silk|Kindle|PlayBook/i.test(ua) || /Android/i.test(ua) || iPadOS) {
            return 'tablet';
        }
        // "Request desktop site" and unknown browsers: judge by the screen and the pointer.
        if (touchOnly) {
            return shortSide > 0 && shortSide < 600 ? 'phone' : 'tablet';
        }
        return 'desktop';
    }

    /**
     * Returns the variant to show ('phone' or 'tablet') or null.
     * opts: { device, params, embedded, seen, optedOut }
     */
    function decide(opts) {
        var p = opts.params || {};
        var force = p.mobileNotice;
        if (force === '0') return null;
        if (force === '1' || force === 'phone') return 'phone';
        if (force === 'tablet') return 'tablet';
        if (opts.embedded || opts.seen || opts.optedOut) return null;
        if (opts.device === 'phone' || opts.device === 'tablet') return opts.device;
        return null;
    }

    function parseParams(search) {
        var result = {};
        (search || '').replace(/^\?/, '').split('&').forEach(function (pair) {
            if (!pair) return;
            var i = pair.indexOf('=');
            var key = i < 0 ? pair : pair.substring(0, i);
            var value = i < 0 ? '' : pair.substring(i + 1);
            try {
                result[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
            } catch (e) {
                result[key] = value;
            }
        });
        return result;
    }

    /** The current address without the mobileNotice test parameter. */
    function linkForComputer(href) {
        try {
            var u = new URL(href);
            u.searchParams.delete('mobileNotice');
            return u.toString();
        } catch (e) {
            return href;
        }
    }

    var api = {
        classifyDevice: classifyDevice,
        decide: decide,
        parseParams: parseParams,
        linkForComputer: linkForComputer
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }
    window.ElectrisimMobileNotice = api;

    // ---------------------------------------------------------------- browser side

    function storageGet(store, key) {
        try { return window[store].getItem(key); } catch (e) { return null; }
    }
    function storageSet(store, key, value) {
        try {
            if (value == null) window[store].removeItem(key);
            else window[store].setItem(key, value);
        } catch (e) { /* private mode or blocked storage: the notice just shows again */ }
    }

    function media(query) {
        try { return !!(window.matchMedia && window.matchMedia(query).matches); } catch (e) { return false; }
    }

    function isEmbedded(params) {
        if (params.embed === '1' || params.lightbox === '1' || params.chrome === '0') return true;
        if (window.process && window.process.type) return true; // Electron
        try { return window.self !== window.top; } catch (e) { return true; }
    }

    function currentDevice() {
        return classifyDevice({
            ua: navigator.userAgent,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            screenW: (window.screen && window.screen.width) || window.innerWidth,
            screenH: (window.screen && window.screen.height) || window.innerHeight,
            coarse: media('(pointer: coarse)'),
            anyFine: media('(any-pointer: fine)')
        });
    }

    var ICONS = {
        laptop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M5 5.5h14a1 1 0 0 1 1 1V16H4V6.5a1 1 0 0 1 1-1z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M2 16h20l-1.2 2.2a1 1 0 0 1-.9.5H4.1a1 1 0 0 1-.9-.5z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M8 12.5l2.5-3 2 2 3-3.5"/></svg>',
        send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></svg>',
        copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15.5 5.5v-1a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1"/></svg>',
        check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>'
    };

    var CSS = [
        '#' + ROOT_ID + '{--emn-bg:#fff;--emn-panel:#f4f6f9;--emn-border:#dde2e8;--emn-text:#1f2328;--emn-muted:#5f6b7a;',
        '--emn-accent:#2f6fde;--emn-accent-hover:#245bc0;--emn-accent-soft:#e7effd;--emn-ok:#1a7f37;',
        'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;',
        'font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;color:var(--emn-text);-webkit-text-size-adjust:100%}',
        '#' + ROOT_ID + ' *{box-sizing:border-box}',
        '#' + ROOT_ID + '.emn-tablet{inset:auto 0 0 0;pointer-events:none}',
        '.emn-backdrop{position:absolute;inset:0;background:rgba(17,24,39,.45);animation:emn-fade .2s ease-out}',
        '.emn-sheet{position:relative;width:100%;max-width:480px;max-height:calc(100% - 12px);overflow-y:auto;-webkit-overflow-scrolling:touch;',
        'margin:0;padding:22px 20px calc(18px + env(safe-area-inset-bottom,0px));background:var(--emn-bg);',
        'border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.18);animation:emn-up .25s ease-out;outline:none}',
        '@media (min-width:520px){#' + ROOT_ID + '{align-items:center}.emn-sheet{border-radius:16px;margin:16px;box-shadow:0 12px 40px rgba(0,0,0,.25)}}',
        '.emn-tablet .emn-sheet{pointer-events:auto;max-width:560px;margin:0 16px 16px;padding:16px 18px;border:1px solid var(--emn-border);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.18)}',
        '.emn-head{display:flex;align-items:center;gap:12px;margin:0 0 10px}',
        '.emn-icon{flex:0 0 auto;width:44px;height:44px;padding:9px;border-radius:12px;background:var(--emn-accent-soft);color:var(--emn-accent)}',
        '.emn-tablet .emn-icon{width:36px;height:36px;padding:7px;border-radius:10px}',
        '.emn-icon svg,.emn-btn svg,.emn-docs svg,.emn-status svg{display:block;width:100%;height:100%}',
        '.emn-title{margin:0;font-size:19px;font-weight:700;line-height:1.25;letter-spacing:-.01em}',
        '.emn-tablet .emn-title{font-size:16px}',
        '.emn-text{margin:0 0 14px;color:var(--emn-muted)}',
        '.emn-tablet .emn-text{margin-bottom:12px;font-size:14px}',
        '.emn-where{display:flex;gap:10px;align-items:flex-start;margin:0 0 16px;padding:10px 12px;border-radius:10px;background:var(--emn-panel);font-size:14px}',
        '.emn-where b{font-weight:700;word-break:break-all}',
        '.emn-where .emn-tick{flex:0 0 auto;width:18px;height:18px;margin-top:1px;color:var(--emn-ok)}',
        '.emn-where .emn-tick svg{display:block;width:100%;height:100%}',
        '.emn-actions{display:flex;flex-direction:column;gap:8px}',
        '.emn-tablet .emn-actions{flex-direction:row;flex-wrap:wrap;justify-content:flex-end}',
        '.emn-btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;width:100%;margin:0;padding:10px 16px;',
        'border:1px solid transparent;border-radius:10px;font:inherit;font-weight:600;line-height:1.2;text-align:center;text-decoration:none;',
        'cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:background-color .12s,border-color .12s}',
        '.emn-tablet .emn-btn{width:auto;min-height:40px;font-size:14px}',
        '.emn-btn svg{flex:0 0 auto;width:18px;height:18px}',
        '.emn-primary{background:var(--emn-accent);color:#fff}',
        '.emn-secondary{background:var(--emn-bg);border-color:var(--emn-border);color:var(--emn-text)}',
        '.emn-ghost{background:none;color:var(--emn-muted);font-weight:500}',
        // :hover sticks after a tap on touch screens, so only devices with a real hover get it.
        '.emn-primary:active{background:var(--emn-accent-hover)}.emn-secondary:active,.emn-ghost:active{background:var(--emn-panel)}',
        '@media (hover:hover){.emn-primary:hover{background:var(--emn-accent-hover)}',
        '.emn-secondary:hover{background:var(--emn-panel)}.emn-ghost:hover{background:var(--emn-panel);color:var(--emn-text)}}',
        '.emn-btn:focus-visible,.emn-docs:focus-visible,.emn-optout input:focus-visible{outline:2px solid var(--emn-accent);outline-offset:2px}',
        '.emn-status{display:none;align-items:center;gap:6px;margin:10px 0 0;color:var(--emn-ok);font-size:14px;font-weight:600}',
        '.emn-status.is-visible{display:flex}',
        '.emn-status svg{flex:0 0 auto;width:16px;height:16px}',
        '.emn-status.is-error{color:#8a1c1c;font-weight:400;word-break:break-all}',
        '.emn-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;margin:14px 0 0;padding:12px 0 0;border-top:1px solid var(--emn-border);font-size:14px}',
        '.emn-tablet .emn-foot{margin-top:10px;padding-top:10px;font-size:13px}',
        '.emn-optout{display:flex;align-items:center;gap:8px;min-height:32px;color:var(--emn-muted);cursor:pointer}',
        '.emn-tablet .emn-optout{margin-right:auto;font-size:13px}',
        // Phone on its side: about 390px of height, so tighten everything and put the buttons in a row.
        '@media (max-height:500px) and (min-width:520px){',
        '.emn-phone .emn-sheet{max-width:660px;padding:14px 18px}',
        '.emn-phone .emn-head{margin-bottom:6px}.emn-phone .emn-icon{width:34px;height:34px;padding:6px;border-radius:9px}',
        '.emn-phone .emn-title{font-size:17px}.emn-phone .emn-text{margin-bottom:8px;font-size:14px}',
        '.emn-phone .emn-where{margin-bottom:10px;padding:7px 10px;font-size:13px}',
        '.emn-phone .emn-actions{flex-direction:row}.emn-phone .emn-btn{flex:1 1 auto;width:auto;min-height:40px;padding:8px 10px;font-size:14px;white-space:nowrap}',
        '.emn-phone .emn-foot{margin-top:8px;padding-top:6px}}',
        '.emn-optout input{width:18px;height:18px;margin:0;accent-color:var(--emn-accent)}',
        '.emn-docs{display:inline-flex;align-items:center;gap:6px;min-height:32px;color:var(--emn-accent);font-weight:600;text-decoration:none}',
        '.emn-docs svg{width:16px;height:16px}',
        '.emn-closing .emn-sheet,.emn-closing .emn-backdrop{opacity:0;transition:opacity .15s ease-in}',
        '@keyframes emn-up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}',
        '@keyframes emn-fade{from{opacity:0}to{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.emn-sheet,.emn-backdrop{animation:none}.emn-closing .emn-sheet,.emn-closing .emn-backdrop{transition:none}}'
    ].join('\n');

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function button(className, label, icon) {
        var b = el('button', 'emn-btn ' + className);
        b.type = 'button';
        if (icon) {
            var i = el('span');
            i.innerHTML = ICONS[icon]; // static markup from ICONS
            b.appendChild(i.firstChild);
        }
        b.appendChild(document.createTextNode(label));
        return b;
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, text.length);
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            if (ok) resolve(); else reject(new Error('copy failed'));
        });
    }

    function show(variant) {
        if (document.getElementById(ROOT_ID)) return;
        var phone = variant !== 'tablet';
        var url = linkForComputer(window.location.href);
        var host = window.location.host || 'app.electrisim.com';
        var previousFocus = document.activeElement;

        if (!document.getElementById(ROOT_ID + '-style')) {
            var style = el('style');
            style.id = ROOT_ID + '-style';
            style.textContent = CSS;
            document.head.appendChild(style);
        }

        var root = el('div', phone ? 'emn-phone' : 'emn-tablet');
        root.id = ROOT_ID;
        var backdrop = phone ? el('div', 'emn-backdrop') : null;
        if (backdrop) root.appendChild(backdrop);

        var sheet = el('div', 'emn-sheet');
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-labelledby', ROOT_ID + '-title');
        sheet.setAttribute('aria-describedby', ROOT_ID + '-text');
        if (phone) sheet.setAttribute('aria-modal', 'true');
        sheet.tabIndex = -1;

        var head = el('div', 'emn-head');
        var icon = el('div', 'emn-icon');
        icon.innerHTML = ICONS.laptop;
        var title = el('h2', 'emn-title', phone ? 'Electrisim works best on a computer' : 'Electrisim works best with a mouse and keyboard');
        title.id = ROOT_ID + '-title';
        head.appendChild(icon);
        head.appendChild(title);
        sheet.appendChild(head);

        var text = el('p', 'emn-text', phone
            ? 'Drawing single-line diagrams, editing element parameters and reading result tables need a large screen, a mouse and a keyboard. On a phone the menus are reduced and many dialogs do not fit the screen.'
            : 'You can use Electrisim on a tablet, but drawing diagrams, editing parameters and reading result tables is easier in a desktop browser on a laptop or computer.');
        text.id = ROOT_ID + '-text';
        sheet.appendChild(text);

        if (phone) {
            var where = el('div', 'emn-where');
            var tick = el('span', 'emn-tick');
            tick.innerHTML = ICONS.check;
            var whereText = el('span');
            whereText.appendChild(document.createTextNode('For the full experience, open '));
            whereText.appendChild(el('b', null, host));
            whereText.appendChild(document.createTextNode(' in Chrome, Edge, Firefox or Safari on a laptop or desktop computer.'));
            where.appendChild(tick);
            where.appendChild(whereText);
            sheet.appendChild(where);
        }

        var actions = el('div', 'emn-actions');
        var sendBtn = button(phone ? 'emn-primary' : 'emn-secondary', 'Send link to my computer', 'send');
        var copyBtn = phone ? button('emn-secondary', 'Copy link', 'copy') : null;
        var continueBtn = button(phone ? 'emn-ghost' : 'emn-primary', phone ? 'Continue on this phone' : 'Got it');
        actions.appendChild(sendBtn);
        if (copyBtn) actions.appendChild(copyBtn);
        actions.appendChild(continueBtn);
        sheet.appendChild(actions);

        var status = el('p', 'emn-status');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        sheet.appendChild(status);

        var optout = el('label', 'emn-optout');
        var optoutBox = document.createElement('input');
        optoutBox.type = 'checkbox';
        optout.appendChild(optoutBox);
        optout.appendChild(document.createTextNode("Don't show this again"));
        if (phone) {
            var foot = el('div', 'emn-foot');
            foot.appendChild(optout);
            var docs = el('a', 'emn-docs');
            docs.href = DOCS_URL;
            docs.target = '_blank';
            docs.rel = 'noopener';
            docs.innerHTML = ICONS.book;
            docs.appendChild(document.createTextNode('Read the documentation'));
            foot.appendChild(docs);
            sheet.appendChild(foot);
        } else {
            // Tablet: one row, the checkbox on the left and the buttons on the right.
            actions.insertBefore(optout, actions.firstChild);
        }
        root.appendChild(sheet);

        function setStatus(message, isError) {
            status.innerHTML = isError ? '' : ICONS.check;
            status.appendChild(document.createTextNode(message));
            status.className = 'emn-status is-visible' + (isError ? ' is-error' : '');
        }

        function mailLink() {
            var a = document.createElement('a');
            a.href = 'mailto:?subject=' + encodeURIComponent('Electrisim: open on my computer') +
                '&body=' + encodeURIComponent('Open Electrisim in a desktop browser on your laptop or computer:\n\n' + url + '\n');
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setStatus('Opening your email app. Send the link to yourself and open it on your computer.');
        }

        sendBtn.addEventListener('click', function () {
            if (navigator.share) {
                navigator.share({
                    title: 'Electrisim',
                    text: 'Open Electrisim in a desktop browser on your laptop or computer.',
                    url: url
                }).then(function () {
                    setStatus('Link shared. Open it on your computer to continue.');
                }).catch(function (err) {
                    if (err && err.name === 'AbortError') return; // the person closed the share sheet
                    mailLink();
                });
            } else {
                mailLink();
            }
        });

        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyText(url).then(function () {
                    setStatus('Link copied. Paste it into a browser on your computer.');
                }, function () {
                    setStatus('Copy this link: ' + url, true);
                });
            });
        }

        optoutBox.addEventListener('change', function () {
            storageSet('localStorage', OPT_OUT_KEY, optoutBox.checked ? '1' : null);
        });

        var closed = false;
        function close() {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKey, true);
            var reduce = media('(prefers-reduced-motion: reduce)');
            root.className += ' emn-closing';
            setTimeout(function () {
                if (root.parentNode) root.parentNode.removeChild(root);
            }, reduce ? 0 : 160);
            if (phone && previousFocus && previousFocus.focus && document.contains(previousFocus)) {
                try { previousFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
            }
        }

        function onKey(evt) {
            if (evt.key === 'Escape' || evt.key === 'Esc') {
                evt.stopPropagation();
                close();
                return;
            }
            if (phone && evt.key === 'Tab') {
                var items = sheet.querySelectorAll('button, a[href], input');
                if (!items.length) return;
                var first = items[0];
                var last = items[items.length - 1];
                if (evt.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
                    evt.preventDefault();
                    last.focus();
                } else if (!evt.shiftKey && document.activeElement === last) {
                    evt.preventDefault();
                    first.focus();
                }
            }
        }

        continueBtn.addEventListener('click', close);
        if (backdrop) backdrop.addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);

        document.body.appendChild(root);
        storageSet('sessionStorage', SESSION_KEY, '1');
        if (phone) {
            try { sheet.focus({ preventScroll: true }); } catch (e) { sheet.focus(); }
        }
        api.close = close;
    }

    api.show = show;

    function init() {
        var params = parseParams(window.location.search);
        var variant = decide({
            device: currentDevice(),
            params: params,
            embedded: isEmbedded(params),
            seen: storageGet('sessionStorage', SESSION_KEY) === '1',
            optedOut: storageGet('localStorage', OPT_OUT_KEY) === '1'
        });
        if (variant) show(variant);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
