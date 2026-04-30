/* =========================================================================
 *  Electrisim - Snapshot Store
 *  -----------------------------------------------------------------------
 *  Browser-side persistence for Load Flow result JSON snapshots.
 *  Used by the Scenario Compare feature to remember a "Baseline" run and
 *  diff it against the current run.
 *
 *  Primary storage: IndexedDB (DB "electrisim", store "snapshots" + meta).
 *  Fallback:        localStorage (latest snapshot + baseline only).
 *
 *  Public API attached to window:
 *    saveSnapshot(dataJson, opts)                  -> Promise<id>
 *    listSnapshots()                               -> Promise<[meta...]>
 *    getSnapshot(id)                               -> Promise<full record | null>
 *    setBaselineSnapshot(id)                       -> Promise<void>
 *    getBaselineSnapshot()                         -> Promise<full record | null>
 *    clearBaselineSnapshot()                       -> Promise<void>
 *    getLatestSnapshotId()                         -> Promise<id | null>
 *    deleteSnapshot(id)                            -> Promise<void>
 *
 *  Records:
 *    { id, label, ts, engine, counts, dataJson }
 *  where counts = { buses, lines, transformers, generators, loads }
 * =========================================================================
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    const DB_NAME    = 'electrisim';
    const DB_VERSION = 1;
    const STORE_SNAP = 'snapshots';
    const STORE_META = 'meta';
    const META_KEY   = 'state';
    const LS_KEY     = 'electrisim.snapshotStore.fallback';
    const MAX_KEEP   = 10;            // rolling cap on non-baseline snapshots

    /* ---------------------------------------------------------------------
     *  Helpers
     * ------------------------------------------------------------------- */
    function newId(engine) {
        const ts   = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        return `${(engine || 'sim').toLowerCase()}-${ts}-${rand}`;
    }

    function autoLabel(engine, counts) {
        const eng = engine ? engine[0].toUpperCase() + engine.slice(1) : 'Run';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const size = counts ? `${counts.buses || 0}b·${counts.lines || 0}l` : '';
        return size ? `${eng} ${time} (${size})` : `${eng} ${time}`;
    }

    function len(x) { return Array.isArray(x) ? x.length : 0; }

    function summariseCounts(dataJson) {
        if (!dataJson || typeof dataJson !== 'object') return {};
        const tr3 = dataJson.transformers3W || dataJson.transformers3w || [];
        return {
            buses:        len(dataJson.busbars),
            lines:        len(dataJson.lines),
            transformers: len(dataJson.transformers) + len(tr3),
            generators:
                len(dataJson.generators) +
                len(dataJson.staticgenerators) +
                len(dataJson.asymmetricstaticgenerators) +
                len(dataJson.pvsystems) +
                len(dataJson.externalgrids),
            loads:
                len(dataJson.loads) +
                len(dataJson.asymmetricloads) +
                len(dataJson.motors),
        };
    }

    function inferEngine(dataJson) {
        try {
            if (dataJson && (dataJson.engine || dataJson.solver)) {
                return String(dataJson.engine || dataJson.solver).toLowerCase().includes('opendss')
                    ? 'opendss' : 'pandapower';
            }
            if (dataJson && Array.isArray(dataJson.opendss_commands)) return 'opendss';
        } catch (e) {}
        return 'pandapower';
    }

    /* ---------------------------------------------------------------------
     *  IndexedDB layer (preferred)
     * ------------------------------------------------------------------- */
    let _dbPromise = null;
    function openDb() {
        if (_dbPromise) return _dbPromise;
        if (typeof indexedDB === 'undefined') {
            _dbPromise = Promise.reject(new Error('IndexedDB unavailable'));
            return _dbPromise;
        }
        _dbPromise = new Promise((resolve, reject) => {
            let req;
            try { req = indexedDB.open(DB_NAME, DB_VERSION); }
            catch (e) { reject(e); return; }
            req.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                if (!db.objectStoreNames.contains(STORE_SNAP)) {
                    const s = db.createObjectStore(STORE_SNAP, { keyPath: 'id' });
                    s.createIndex('ts', 'ts', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(STORE_META, { keyPath: 'k' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error || new Error('IndexedDB open failed'));
            req.onblocked = () => reject(new Error('IndexedDB open blocked'));
        }).catch((err) => {
            _dbPromise = null;
            throw err;
        });
        return _dbPromise;
    }

    function tx(db, names, mode) {
        return db.transaction(Array.isArray(names) ? names : [names], mode || 'readonly');
    }

    function reqToPromise(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    }

    async function idbPutSnapshot(record) {
        const db = await openDb();
        const t  = tx(db, STORE_SNAP, 'readwrite');
        const s  = t.objectStore(STORE_SNAP);
        await reqToPromise(s.put(record));
        return new Promise((resolve, reject) => {
            t.oncomplete = () => resolve(record.id);
            t.onerror    = () => reject(t.error);
            t.onabort    = () => reject(t.error || new Error('idb tx aborted'));
        });
    }

    async function idbGetSnapshot(id) {
        const db = await openDb();
        const t  = tx(db, STORE_SNAP, 'readonly');
        return reqToPromise(t.objectStore(STORE_SNAP).get(id));
    }

    async function idbListSnapshots() {
        const db = await openDb();
        const t  = tx(db, STORE_SNAP, 'readonly');
        const all = await reqToPromise(t.objectStore(STORE_SNAP).getAll());
        return (all || []).map(stripDataJson).sort((a, b) => b.ts - a.ts);
    }

    async function idbDeleteSnapshot(id) {
        const db = await openDb();
        const t  = tx(db, STORE_SNAP, 'readwrite');
        await reqToPromise(t.objectStore(STORE_SNAP).delete(id));
    }

    async function idbGetMeta() {
        const db = await openDb();
        const t  = tx(db, STORE_META, 'readonly');
        const r  = await reqToPromise(t.objectStore(STORE_META).get(META_KEY));
        return r || { k: META_KEY, baselineId: null, latestId: null };
    }

    async function idbPutMeta(meta) {
        const db = await openDb();
        const t  = tx(db, STORE_META, 'readwrite');
        const m  = Object.assign({ k: META_KEY }, meta || {});
        await reqToPromise(t.objectStore(STORE_META).put(m));
    }

    async function idbPrune(keepCount, baselineId) {
        const db = await openDb();
        const t  = tx(db, STORE_SNAP, 'readwrite');
        const s  = t.objectStore(STORE_SNAP);
        const all = await reqToPromise(s.getAll());
        const sorted = (all || []).sort((a, b) => b.ts - a.ts);
        let kept = 0;
        for (const rec of sorted) {
            if (rec.id === baselineId) continue;
            kept++;
            if (kept > keepCount) {
                try { s.delete(rec.id); } catch (e) { /* ignore */ }
            }
        }
    }

    function stripDataJson(rec) {
        if (!rec) return rec;
        const { dataJson, ...rest } = rec;
        return rest;
    }

    /* ---------------------------------------------------------------------
     *  localStorage fallback (very limited; one current + one baseline)
     * ------------------------------------------------------------------- */
    const LS_LIMIT_BYTES = 4 * 1024 * 1024; // ~4 MB

    function lsRead() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return { snapshots: {}, baselineId: null, latestId: null };
            return JSON.parse(raw);
        } catch (e) {
            return { snapshots: {}, baselineId: null, latestId: null };
        }
    }

    function lsWrite(state) {
        try {
            const json = JSON.stringify(state);
            if (json.length > LS_LIMIT_BYTES) {
                // Drop the oldest non-baseline first.
                const ids = Object.keys(state.snapshots || {})
                    .filter((id) => id !== state.baselineId)
                    .sort((a, b) => (state.snapshots[a].ts || 0) - (state.snapshots[b].ts || 0));
                while (ids.length > 0 && JSON.stringify(state).length > LS_LIMIT_BYTES) {
                    const drop = ids.shift();
                    delete state.snapshots[drop];
                    if (state.latestId === drop) state.latestId = null;
                }
            }
            localStorage.setItem(LS_KEY, JSON.stringify(state));
            return true;
        } catch (e) {
            console.warn('[SnapshotStore] localStorage write failed:', e);
            return false;
        }
    }

    /* ---------------------------------------------------------------------
     *  Capability detection — try IndexedDB, fall back transparently.
     * ------------------------------------------------------------------- */
    let _useIdb = null;
    async function useIdb() {
        if (_useIdb !== null) return _useIdb;
        try {
            await openDb();
            _useIdb = true;
        } catch (e) {
            console.warn('[SnapshotStore] IndexedDB unavailable, using localStorage:', e && e.message);
            _useIdb = false;
        }
        return _useIdb;
    }

    /* ---------------------------------------------------------------------
     *  Public API
     * ------------------------------------------------------------------- */
    async function saveSnapshot(dataJson, opts) {
        if (!dataJson || typeof dataJson !== 'object') {
            throw new Error('saveSnapshot: dataJson is required');
        }
        opts = opts || {};
        const engine = (opts.engine || inferEngine(dataJson) || 'pandapower').toLowerCase();
        const counts = summariseCounts(dataJson);
        const record = {
            id:       newId(engine),
            label:    opts.label || autoLabel(engine, counts),
            ts:       Date.now(),
            engine:   engine,
            counts:   counts,
            dataJson: dataJson,
        };

        if (await useIdb()) {
            try {
                await idbPutSnapshot(record);
                const meta = await idbGetMeta();
                meta.latestId = record.id;
                await idbPutMeta(meta);
                await idbPrune(MAX_KEEP, meta.baselineId);
                return record.id;
            } catch (e) {
                console.warn('[SnapshotStore] IDB save failed, falling back to LS:', e);
                _useIdb = false;
            }
        }

        const state = lsRead();
        state.snapshots = state.snapshots || {};
        state.snapshots[record.id] = record;
        state.latestId = record.id;
        // Keep only baseline + latest in LS to stay under quota.
        Object.keys(state.snapshots).forEach((id) => {
            if (id !== state.baselineId && id !== state.latestId) delete state.snapshots[id];
        });
        lsWrite(state);
        return record.id;
    }

    async function getSnapshot(id) {
        if (!id) return null;
        if (await useIdb()) {
            try { return (await idbGetSnapshot(id)) || null; }
            catch (e) { console.warn('[SnapshotStore] IDB get failed:', e); _useIdb = false; }
        }
        const state = lsRead();
        return (state.snapshots && state.snapshots[id]) || null;
    }

    async function listSnapshots() {
        if (await useIdb()) {
            try { return await idbListSnapshots(); }
            catch (e) { console.warn('[SnapshotStore] IDB list failed:', e); _useIdb = false; }
        }
        const state = lsRead();
        return Object.values(state.snapshots || {})
            .map(stripDataJson)
            .sort((a, b) => b.ts - a.ts);
    }

    async function getLatestSnapshotId() {
        if (await useIdb()) {
            try {
                const meta = await idbGetMeta();
                return meta.latestId || null;
            } catch (e) { _useIdb = false; }
        }
        return lsRead().latestId || null;
    }

    async function setBaselineSnapshot(id) {
        if (!id) throw new Error('setBaselineSnapshot: id is required');
        if (await useIdb()) {
            try {
                const exists = await idbGetSnapshot(id);
                if (!exists) throw new Error(`Snapshot ${id} not found`);
                const meta = await idbGetMeta();
                meta.baselineId = id;
                await idbPutMeta(meta);
                return;
            } catch (e) {
                if (/not found/.test(e && e.message)) throw e;
                console.warn('[SnapshotStore] IDB setBaseline failed, falling back to LS:', e);
                _useIdb = false;
            }
        }
        const state = lsRead();
        if (!state.snapshots || !state.snapshots[id]) {
            throw new Error(`Snapshot ${id} not found`);
        }
        state.baselineId = id;
        lsWrite(state);
    }

    async function getBaselineSnapshot() {
        if (await useIdb()) {
            try {
                const meta = await idbGetMeta();
                if (!meta.baselineId) return null;
                return (await idbGetSnapshot(meta.baselineId)) || null;
            } catch (e) { _useIdb = false; }
        }
        const state = lsRead();
        if (!state.baselineId) return null;
        return (state.snapshots && state.snapshots[state.baselineId]) || null;
    }

    async function clearBaselineSnapshot() {
        if (await useIdb()) {
            try {
                const meta = await idbGetMeta();
                meta.baselineId = null;
                await idbPutMeta(meta);
                return;
            } catch (e) { _useIdb = false; }
        }
        const state = lsRead();
        state.baselineId = null;
        lsWrite(state);
    }

    async function deleteSnapshot(id) {
        if (!id) return;
        if (await useIdb()) {
            try {
                await idbDeleteSnapshot(id);
                const meta = await idbGetMeta();
                if (meta.baselineId === id) meta.baselineId = null;
                if (meta.latestId   === id) meta.latestId   = null;
                await idbPutMeta(meta);
                return;
            } catch (e) { _useIdb = false; }
        }
        const state = lsRead();
        if (state.snapshots) delete state.snapshots[id];
        if (state.baselineId === id) state.baselineId = null;
        if (state.latestId   === id) state.latestId   = null;
        lsWrite(state);
    }

    /* ---------------------------------------------------------------------
     *  Expose
     * ------------------------------------------------------------------- */
    window.saveSnapshot           = saveSnapshot;
    window.getSnapshot            = getSnapshot;
    window.listSnapshots          = listSnapshots;
    window.getLatestSnapshotId    = getLatestSnapshotId;
    window.setBaselineSnapshot    = setBaselineSnapshot;
    window.getBaselineSnapshot    = getBaselineSnapshot;
    window.clearBaselineSnapshot  = clearBaselineSnapshot;
    window.deleteSnapshot         = deleteSnapshot;

    // Internals exposed for tests
    window._snapshotStoreInternals = {
        summariseCounts,
        inferEngine,
        autoLabel,
        newId,
    };
})();
