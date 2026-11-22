/**
 * Checks who sees the "Electrisim works best on a computer" notice (js/electrisim/mobileNotice.js):
 * phones get the full sheet, tablets the small card, desktops nothing, and the URL parameter,
 * embed mode and the remembered choices switch it off.
 * Run: node scripts/mobile-notice.test.js
 */
'use strict';
const path = require('path');
const notice = require(path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'mobileNotice.js'));

let failed = 0;
function check(name, actual, expected) {
    if (actual !== expected) {
        failed++;
        console.error('FAIL ' + name + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
}

const UA = {
    iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
    androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    oldIPad: 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1',
    mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    linuxDesktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
};
const touch = { coarse: true, anyFine: false };
const mouse = { coarse: false, anyFine: true };

const devices = [
    ['iPhone', { ua: UA.iPhone, maxTouchPoints: 5, screenW: 390, screenH: 844, ...touch }, 'phone'],
    ['Android phone, Chrome', { ua: UA.androidChrome, maxTouchPoints: 5, screenW: 412, screenH: 915, ...touch }, 'phone'],
    ['Android phone, Firefox', { ua: UA.androidFirefox, maxTouchPoints: 5, screenW: 412, screenH: 915, ...touch }, 'phone'],
    ['Android phone, "Request desktop site"', { ua: UA.linuxDesktop, maxTouchPoints: 5, screenW: 412, screenH: 915, ...touch }, 'phone'],
    ['Android tablet', { ua: UA.androidTablet, maxTouchPoints: 10, screenW: 800, screenH: 1280, ...touch }, 'tablet'],
    ['iPad, iPadOS 13+ (Mac user agent)', { ua: UA.mac, maxTouchPoints: 5, screenW: 820, screenH: 1180, ...touch }, 'tablet'],
    ['iPad, iOS 12', { ua: UA.oldIPad, maxTouchPoints: 5, screenW: 768, screenH: 1024, ...touch }, 'tablet'],
    ['Mac with trackpad', { ua: UA.mac, maxTouchPoints: 0, screenW: 1440, screenH: 900, ...mouse }, 'desktop'],
    ['Windows laptop with touch screen', { ua: UA.windows, maxTouchPoints: 10, screenW: 1920, screenH: 1080, coarse: false, anyFine: true }, 'desktop'],
    ['Windows desktop, small window', { ua: UA.windows, maxTouchPoints: 0, screenW: 1920, screenH: 1080, ...mouse }, 'desktop']
];
devices.forEach(([name, env, expected]) => check('classifyDevice: ' + name, notice.classifyDevice(env), expected));

const decide = (over) => notice.decide(Object.assign({ device: 'phone', params: {}, embedded: false, seen: false, optedOut: false }, over));
check('decide: phone', decide({}), 'phone');
check('decide: tablet', decide({ device: 'tablet' }), 'tablet');
check('decide: desktop', decide({ device: 'desktop' }), null);
check('decide: already seen in this tab', decide({ seen: true }), null);
check('decide: "Don\'t show this again"', decide({ optedOut: true }), null);
check('decide: embed / viewer / iframe', decide({ embedded: true }), null);
check('decide: ?mobileNotice=0', decide({ params: { mobileNotice: '0' } }), null);
check('decide: ?mobileNotice=1 on desktop', decide({ device: 'desktop', params: { mobileNotice: '1' } }), 'phone');
check('decide: ?mobileNotice=tablet after opting out', decide({ optedOut: true, params: { mobileNotice: 'tablet' } }), 'tablet');

check('parseParams', JSON.stringify(notice.parseParams('?a=1&mobileNotice=0&b=x%20y&flag')), JSON.stringify({ a: '1', mobileNotice: '0', b: 'x y', flag: '' }));
check('linkForComputer drops the test parameter',
    notice.linkForComputer('https://app.electrisim.com/?mobileNotice=1&lang=en#G123'), 'https://app.electrisim.com/?lang=en#G123');
check('linkForComputer keeps a plain address', notice.linkForComputer('https://app.electrisim.com/'), 'https://app.electrisim.com/');

if (failed) {
    console.error(failed + ' mobile notice check(s) failed');
    process.exit(1);
}
console.log('mobile notice: ' + (devices.length + 12) + ' checks passed');
