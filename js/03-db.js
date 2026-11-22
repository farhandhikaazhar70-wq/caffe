'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 3: penyimpanan (IndexedDB)
   Store: kv (pengaturan, menu, bahan, dll), trx (transaksi),
   stocklog (riwayat stok)
   =========================================================== */
(function (TN) {
  var db = TN.db, DB = null;
  var NAME = 'toos-ngopi-pos', VERSION = 1;
  var channel = null;
  try { channel = new BroadcastChannel('toos-ngopi-pos'); } catch (e) { channel = null; }

  function p(req) {
    return new Promise(function (res, rej) {
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }

  db.open = function () {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB tidak tersedia')); return; }
      var r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
        if (!d.objectStoreNames.contains('trx')) {
          var s = d.createObjectStore('trx', { keyPath: 'id' });
          s.createIndex('dk', 'dk');
          s.createIndex('ts', 'ts');
        }
        if (!d.objectStoreNames.contains('stocklog')) {
          var l = d.createObjectStore('stocklog', { keyPath: 'id', autoIncrement: true });
          l.createIndex('ts', 'ts');
        }
      };
      r.onsuccess = function () {
        DB = r.result;
        DB.onversionchange = function () { DB.close(); };
        resolve();
      };
      r.onerror = function () { reject(r.error || new Error('Gagal membuka database')); };
      r.onblocked = function () { reject(new Error('Database terblokir oleh tab lain')); };
    });
  };

  db.tx = function (names, mode, fn, silent) {
    return new Promise(function (resolve, reject) {
      var t = DB.transaction(names, mode), st = {};
      names.forEach(function (n) { st[n] = t.objectStore(n); });
      t.oncomplete = function () {
        if (mode === 'readwrite' && !silent && channel) channel.postMessage({ t: 'changed' });
        resolve();
      };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error || new Error('Transaksi database dibatalkan')); };
      fn(st, t);
    });
  };

  db.onRemoteChange = function (cb) { if (channel) channel.onmessage = function (e) { if (e.data && e.data.t === 'changed') cb(); }; };

  db.kvGet = function (k, def) {
    return p(DB.transaction('kv').objectStore('kv').get(k)).then(function (r) { return r ? r.v : def; });
  };
  db.kvSet = function (k, v) { return db.tx(['kv'], 'readwrite', function (st) { st.kv.put({ k: k, v: v }); }); };
  db.get = function (store, key) { return p(DB.transaction(store).objectStore(store).get(key)); };
  db.all = function (store) { return p(DB.transaction(store).objectStore(store).getAll()); };
  db.byRange = function (store, index, from, to) {
    return p(DB.transaction(store).objectStore(store).index(index).getAll(IDBKeyRange.bound(from, to)));
  };
  db.recent = function (store, index, limit, pred) {
    return new Promise(function (resolve, reject) {
      var out = [];
      var r = DB.transaction(store).objectStore(store).index(index).openCursor(null, 'prev');
      r.onsuccess = function () {
        var c = r.result;
        if (!c || out.length >= limit) { resolve(out); return; }
        if (!pred || pred(c.value)) out.push(c.value);
        c.continue();
      };
      r.onerror = function () { reject(r.error); };
    });
  };
  db.count = function (store) { return p(DB.transaction(store).objectStore(store).count()); };
  db.persist = function () {
    try {
      if (navigator.storage && navigator.storage.persist) return navigator.storage.persist();
    } catch (e) { /* abaikan */ }
    return Promise.resolve(false);
  };
})(window.TN);
