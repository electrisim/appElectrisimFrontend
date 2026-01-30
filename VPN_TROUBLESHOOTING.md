# VPN / Corporate Network Troubleshooting

## Symptom

When using the Electrisim app over a **corporate VPN**, load flow (and other calculations) may fail with:

- **Browser console:** `Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID` for `web-production-*.up.railway.app`
- **App:** "Failed to fetch" or no results returned after submitting a calculation

Without VPN (e.g. on another laptop or network), the same calculation works.

## Cause

Many corporate VPNs perform **SSL/TLS inspection** (man-in-the-middle). Traffic to the calculation backend is intercepted and re-encrypted with the organisation’s certificate. If the browser does not trust that certificate, it blocks the connection and reports `ERR_CERT_AUTHORITY_INVALID`. The app then sees a "Failed to fetch" error and cannot receive results.

## What we cannot fix from the app

We cannot disable certificate validation or change how the VPN handles HTTPS. The backend uses a valid public certificate (e.g. Let’s Encrypt); the failure is due to the VPN replacing it with a cert the browser does not trust.

## What users can do

1. **Disconnect from VPN** when running calculations, then reconnect if needed.
2. **Use another network or device** (e.g. home Wi‑Fi or mobile hotspot) to run the calculation.
3. **Ask IT** to:
   - Add the organisation’s root CA certificate to the device/browser trust store so the browser trusts the inspected connection, or
   - Exclude the Electrisim backend host (`web-production-*.up.railway.app`) from SSL inspection so the original certificate is used.

## In-app message

When a connection failure is detected (e.g. "Failed to fetch"), the app now shows a message that explains the VPN/certificate case and suggests the steps above. No code change is required on the user side beyond following that guidance or involving IT.
