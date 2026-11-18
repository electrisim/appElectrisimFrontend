/**
 * Consent gate for Smartlook session recording in the app.
 *
 * Smartlook records clicks, mouse movement and page content, so it must not start before
 * the visitor opts in (GDPR Art. 6(1)(a), ePrivacy Art. 5(3)). The choice is kept in
 * localStorage under the same key the website uses; app.electrisim.com is a separate
 * origin, so the website's choice does not carry over and the app asks on its own.
 *
 * window.electrisimAnalyticsConsent.open() shows the choice again so a visitor can
 * withdraw consent as easily as they gave it. It is also added to the Help menu.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'electrisim_cookie_consent';
    var ACCEPTED = 'accepted';
    var REJECTED = 'rejected';
    var SMARTLOOK_KEY = '31f78a73918844d1c038266ca853b5b9bd7da408';
    var PRIVACY_URL = 'https://electrisim.com/privacy#cookies';

    function getConsent() {
        try {
            var v = localStorage.getItem(STORAGE_KEY);
            return v === ACCEPTED || v === REJECTED ? v : null;
        } catch (e) {
            return null;
        }
    }

    function setConsent(value) {
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch (e) { /* private mode: the choice lasts for this page only */ }
    }

    function loadSmartlook() {
        if (window.smartlook || window._electrisimSmartlookLoaded) return;
        if (getConsent() !== ACCEPTED) return; // choice may have changed during the deferral
        window._electrisimSmartlookLoaded = true;
        (function (d) {
            var o = window.smartlook = function () { o.api.push(arguments); };
            var h = d.getElementsByTagName('head')[0];
            var c = d.createElement('script');
            o.api = [];
            c.async = true;
            c.type = 'text/javascript';
            c.charset = 'utf-8';
            c.src = 'https://web-sdk.smartlook.com/recorder.js';
            h.appendChild(c);
        })(document);
        window.smartlook('init', SMARTLOOK_KEY, {
            region: 'eu',
            interceptors: {
                error: function (data) {
                    if (!data || !data.message) return true;
                    var msg = String(data.message);
                    if (/MetaMask|metamask|Failed to connect to MetaMask/i.test(msg)) return false;
                    // Benign Chromium resize noise (toolbar responsive layout, not an app defect)
                    if (/^ResizeObserver loop/i.test(msg)) return false;
                    return true;
                }
            }
        });
    }

    // Deferred so recording never competes with the first paint of the editor.
    function loadSmartlookDeferred() {
        var start = function () { setTimeout(loadSmartlook, 3000); };
        if (document.readyState === 'complete') start();
        else window.addEventListener('load', start);
    }

    function removeBanner() {
        var bar = document.getElementById('electrisimConsentBar');
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    }

    function showBanner() {
        if (!document.body || document.getElementById('electrisimConsentBar')) return;
        var previous = getConsent();

        var bar = document.createElement('div');
        bar.id = 'electrisimConsentBar';
        bar.setAttribute('role', 'dialog');
        bar.setAttribute('aria-live', 'polite');
        bar.setAttribute('aria-label', 'Session recording consent');
        bar.style.cssText = [
            'position:fixed', 'left:16px', 'bottom:16px', 'z-index:2147483000',
            'max-width:420px', 'box-sizing:border-box', 'padding:14px 16px',
            'background:#ffffff', 'color:#1f2937', 'border:1px solid #d1d5db',
            'border-radius:8px', 'box-shadow:0 6px 24px rgba(0,0,0,0.18)',
            'font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'
        ].join(';');

        var text = document.createElement('p');
        text.style.cssText = 'margin:0 0 10px 0';
        text.textContent = 'May we record how you use the app (clicks, mouse movement and errors, via Smartlook) ' +
            'to find and fix problems? Nothing is recorded unless you accept. ';
        var link = document.createElement('a');
        link.href = PRIVACY_URL;
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.cssText = 'color:#2f5bea;text-decoration:underline';
        link.textContent = 'Privacy policy';
        text.appendChild(link);
        if (previous) {
            var status = document.createElement('div');
            status.style.cssText = 'margin-top:6px;color:#6b7280';
            status.textContent = 'Current choice: ' + (previous === ACCEPTED ? 'recording allowed.' : 'recording off.');
            text.appendChild(status);
        }

        var buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

        function makeButton(label, primary) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            // Same size and weight for both choices, so rejecting is as easy as accepting.
            b.style.cssText = [
                'min-width:96px', 'padding:7px 14px', 'border-radius:6px', 'cursor:pointer',
                'font:inherit', 'font-weight:600',
                primary ? 'background:#2f5bea;color:#fff;border:1px solid #2f5bea'
                        : 'background:#fff;color:#1f2937;border:1px solid #9ca3af'
            ].join(';');
            return b;
        }

        var reject = makeButton('Reject', false);
        var accept = makeButton('Accept', true);

        reject.onclick = function () {
            setConsent(REJECTED);
            removeBanner();
            // A recorder that is already running cannot be unloaded; a reload stops it.
            if (window._electrisimSmartlookLoaded) window.location.reload();
        };
        accept.onclick = function () {
            setConsent(ACCEPTED);
            removeBanner();
            loadSmartlook();
        };

        buttons.appendChild(reject);
        buttons.appendChild(accept);
        bar.appendChild(text);
        bar.appendChild(buttons);
        document.body.appendChild(bar);
    }

    function showBannerWhenReady() {
        if (document.body) showBanner();
        else document.addEventListener('DOMContentLoaded', showBanner);
    }

    // Adds "Privacy & cookie settings" to the Help menu once the editor exists.
    function addHelpMenuEntry(attempt) {
        attempt = attempt || 0;
        var app = window.App || {};
        var ui = app._editorUi || app._instance ||
            (app.main && app.main.editor && app.main.editor.editorUi);
        var menu = ui && ui.menus && ui.menus.get && ui.menus.get('help');
        if (!menu || typeof menu.funct !== 'function') {
            if (attempt < 40) setTimeout(function () { addHelpMenuEntry(attempt + 1); }, 500);
            return;
        }
        if (menu._electrisimConsentEntry) return;
        menu._electrisimConsentEntry = true;
        var original = menu.funct;
        menu.funct = function (m, parent) {
            original.apply(this, arguments);
            m.addSeparator(parent);
            m.addItem('Privacy & cookie settings...', null, showBanner, parent);
        };
    }

    window.electrisimAnalyticsConsent = {
        get: getConsent,
        open: showBannerWhenReady
    };

    var consent = getConsent();
    if (consent === ACCEPTED) {
        loadSmartlookDeferred();
    } else if (consent === null) {
        showBannerWhenReady();
    }

    if (document.readyState === 'complete') addHelpMenuEntry();
    else window.addEventListener('load', function () { addHelpMenuEntry(); });
})();
