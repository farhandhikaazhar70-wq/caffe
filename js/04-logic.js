'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 4: data awal & logika bisnis
   (stok, transaksi, pembatalan, ringkasan laporan, cadangan)
   =========================================================== */
(function (TN) {
  var u = TN.u, db = TN.db, L = TN.logic, S = TN.S;

  var DEFAULT_SETTINGS = {
    name: 'TOOS NGOPI', address: '', phone: '',
    footer: 'Terima kasih sudah ngopi di Toos Ngopi!',
    taxPct: 0, blockShort: false,
    qrisImage: '', bankInfo: '',
    lastBackup: 0, defaultPin: true, sampleData: true
  };

  /* ---------- Data awal (bahan & resep dari data lama Toos Ngopi) ---------- */
  function seedData() {
    function ing(id, name, unit, stock, min) { return { id: id, name: name, unit: unit, stock: stock, min: min, pkgPrice: 0, pkgSize: 0, cost: 0 }; }
    var ingredients = [
      ing('i-kopi', 'Biji Kopi', 'Gram', 1000, 200),
      ing('i-susu', 'Susu', 'Ml', 2000, 500),
      ing('i-aren', 'Gula Aren', 'Gram', 1000, 200),
      ing('i-cokelat', 'Bubuk Cokelat', 'Gram', 500, 100),
      ing('i-matcha', 'Matcha', 'Gram', 300, 100),
      ing('i-air', 'Air Mineral', 'Ml', 5000, 1000),
      ing('i-es', 'Es Batu', 'Gram', 3000, 500),
      ing('i-cup', 'Cup Plastik', 'Pcs', 100, 20),
      ing('i-sedotan', 'Sedotan', 'Pcs', 100, 20),
      ing('i-madu', 'Madu', 'Ml', 500, 100),
      ing('i-jeruk', 'Jeruk Nipis', 'Pcs', 30, 5)
    ];
    var now = Date.now();
    var products = [
      { id: 'p-kopisusu', name: 'Kopi Susu', category: 'Coffee', price: 12000, active: true, createdAt: now,
        recipe: [{ ing: 'i-kopi', qty: 15 }, { ing: 'i-susu', qty: 100 }, { ing: 'i-aren', qty: 15 }, { ing: 'i-cup', qty: 1 }] },
      { id: 'p-americano', name: 'Americano', category: 'Coffee', price: 10000, active: true, createdAt: now,
        recipe: [{ ing: 'i-kopi', qty: 15 }, { ing: 'i-air', qty: 150 }, { ing: 'i-cup', qty: 1 }] },
      { id: 'p-matcha', name: 'Matcha Latte', category: 'Non Coffee', price: 15000, active: true, createdAt: now,
        recipe: [{ ing: 'i-matcha', qty: 15 }, { ing: 'i-susu', qty: 120 }, { ing: 'i-cup', qty: 1 }] }
    ];
    var users = [{ id: 'u-owner', name: 'Owner', pin: '1234', role: 'owner' }];
    return { ingredients: ingredients, products: products, users: users };
  }

  /* ---------- Muat state ---------- */
  TN.load = function () {
    return db.open().then(function () { return db.kvGet('seeded', false); }).then(function (seeded) {
      if (seeded) return null;
      var d = seedData();
      return db.tx(['kv'], 'readwrite', function (st) {
        st.kv.put({ k: 'settings', v: DEFAULT_SETTINGS });
        st.kv.put({ k: 'users', v: d.users });
        st.kv.put({ k: 'products', v: d.products });
        st.kv.put({ k: 'ingredients', v: d.ingredients });
        st.kv.put({ k: 'seeded', v: true });
      }, true);
    }).then(function () { return TN.reload(); });
  };

  TN.reload = function () {
    return Promise.all([
      db.kvGet('settings', {}), db.kvGet('users', []),
      db.kvGet('products', []), db.kvGet('ingredients', [])
    ]).then(function (r) {
      S.settings = Object.assign({}, DEFAULT_SETTINGS, r[0]);
      S.users = r[1]; S.products = r[2]; S.ingredients = r[3];
    });
  };

  L.save = function (key) { return db.kvSet(key, S[key]); };

  /* ---------- Pencarian ---------- */
  L.ing = function (id) { return S.ingredients.find(function (i) { return i.id === id; }); };
  L.prod = function (id) { return S.products.find(function (p) { return p.id === id; }); };

  /* ---------- Harga modal (HPP) & ketersediaan ---------- */
  L.ingCost = function (i) { return i.pkgPrice > 0 && i.pkgSize > 0 ? i.pkgPrice / i.pkgSize : 0; };

  L.recipeCost = function (p) {
    if (!p.recipe || !p.recipe.length) return null;
    var total = 0;
    for (var k = 0; k < p.recipe.length; k++) {
      var r = p.recipe[k], i = L.ing(r.ing);
      if (!i || !(i.cost > 0)) return null;
      total += r.qty * i.cost;
    }
    return total;
  };

  L.maxServings = function (p) {
    if (!p.recipe || !p.recipe.length) return Infinity;
    var m = Infinity;
    for (var k = 0; k < p.recipe.length; k++) {
      var r = p.recipe[k], i = L.ing(r.ing);
      if (!i) return 0;
      m = Math.min(m, Math.floor((i.stock + 1e-9) / r.qty));
    }
    return Math.max(m, 0);
  };

  // items: [{pid, qty}] -> { ingredientId: jumlahBahan }
  L.usageFor = function (items) {
    var use = {};
    items.forEach(function (it) {
      var p = L.prod(it.pid);
      if (!p || !p.recipe) return;
      p.recipe.forEach(function (r) { use[r.ing] = u.round3((use[r.ing] || 0) + r.qty * it.qty); });
    });
    return use;
  };

  L.shortages = function (usage) {
    var out = [];
    Object.keys(usage).forEach(function (id) {
      var i = L.ing(id);
      if (i && i.stock + 1e-9 < usage[id]) out.push({ name: i.name, unit: i.unit, need: usage[id], have: i.stock });
    });
    return out;
  };

  L.totals = function (lines, disc, taxPct) {
    var subtotal = lines.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
    var d = 0;
    if (disc && disc.value > 0) {
      d = disc.type === 'pct' ? Math.round(subtotal * Math.min(disc.value, 100) / 100) : Math.min(Math.round(disc.value), subtotal);
    }
    var base = subtotal - d;
    var tax = Math.round(base * (taxPct || 0) / 100);
    return { subtotal: subtotal, discount: d, tax: tax, total: base + tax };
  };

  /* ---------- Simpan penjualan (atomik: transaksi + stok + riwayat stok) ---------- */
  L.commitSale = function (o) {
    var now = Date.now(), dk = u.dk(new Date(now));
    return db.kvGet('counter', null).then(function (c) {
      if (!c || c.dk !== dk) c = { dk: dk, n: 0 };
      c.n += 1;
      var id = dk + '-' + u.pad(c.n, 3);

      var usage = L.usageFor(o.lines.map(function (l) { return { pid: l.pid, qty: l.qty }; }));
      var ings = S.ingredients.map(function (i) { return Object.assign({}, i); });
      var logs = [];
      Object.keys(usage).forEach(function (iid) {
        var ing = ings.find(function (x) { return x.id === iid; });
        if (!ing) return;
        var before = ing.stock;
        ing.stock = u.round3(before - usage[iid]);
        logs.push({ ts: now, ing: iid, name: ing.name, unit: ing.unit, type: 'sale', delta: -usage[iid], before: before, after: ing.stock, note: 'Penjualan #' + u.pad(c.n, 3), ref: id });
      });

      var t = o.totals;
      var trx = {
        id: id, no: c.n, ts: now, dk: dk,
        cashier: o.cashier, customer: o.customer || '', type: o.type,
        items: o.lines.map(function (l) { return { pid: l.pid, name: l.name, price: l.price, qty: l.qty, note: l.note || '', cost: l.cost == null ? null : l.cost }; }),
        subtotal: t.subtotal, discount: { type: o.disc.type, value: o.disc.value, amount: t.discount },
        taxPct: o.taxPct, tax: t.tax, total: t.total,
        method: o.method, paid: o.paid, change: Math.max(o.paid - t.total, 0),
        usage: usage, status: 'paid', void: null
      };

      return db.tx(['kv', 'trx', 'stocklog'], 'readwrite', function (st) {
        st.kv.put({ k: 'counter', v: c });
        st.kv.put({ k: 'ingredients', v: ings });
        st.trx.put(trx);
        logs.forEach(function (l) { st.stocklog.add(l); });
      }).then(function () { S.ingredients = ings; return trx; });
    });
  };

  /* ---------- Batalkan transaksi (stok dikembalikan) ---------- */
  L.voidSale = function (trx, reason, by) {
    var now = Date.now();
    var ings = S.ingredients.map(function (i) { return Object.assign({}, i); });
    var logs = [];
    Object.keys(trx.usage || {}).forEach(function (iid) {
      var ing = ings.find(function (x) { return x.id === iid; });
      if (!ing) return;
      var before = ing.stock;
      ing.stock = u.round3(before + trx.usage[iid]);
      logs.push({ ts: now, ing: iid, name: ing.name, unit: ing.unit, type: 'void', delta: trx.usage[iid], before: before, after: ing.stock, note: 'Batal #' + u.pad(trx.no, 3), ref: trx.id });
    });
    var updated = Object.assign({}, trx, { status: 'void', void: { ts: now, by: by, reason: reason } });
    return db.tx(['kv', 'trx', 'stocklog'], 'readwrite', function (st) {
      st.kv.put({ k: 'ingredients', v: ings });
      st.trx.put(updated);
      logs.forEach(function (l) { st.stocklog.add(l); });
    }).then(function () { S.ingredients = ings; return updated; });
  };

  /* ---------- Pergerakan stok manual: in / out / adjust ---------- */
  L.stockMove = function (iid, type, qty, note) {
    var ings = S.ingredients.map(function (i) { return Object.assign({}, i); });
    var ing = ings.find(function (x) { return x.id === iid; });
    if (!ing) return Promise.reject(new Error('Bahan tidak ditemukan'));
    var before = ing.stock, after, delta;
    if (type === 'in') { delta = qty; after = before + qty; }
    else if (type === 'out') { delta = -qty; after = before - qty; }
    else { after = qty; delta = qty - before; }
    ing.stock = u.round3(after);
    var log = { ts: Date.now(), ing: iid, name: ing.name, unit: ing.unit, type: type, delta: u.round3(delta), before: before, after: ing.stock, note: note || '', ref: '' };
    return db.tx(['kv', 'stocklog'], 'readwrite', function (st) {
      st.kv.put({ k: 'ingredients', v: ings });
      st.stocklog.add(log);
    }).then(function () { S.ingredients = ings; });
  };

  /* ---------- Ringkasan laporan ---------- */
  function addTo(map, key, amount) {
    var r = map[key] || (map[key] = { count: 0, total: 0 });
    r.count += 1; r.total += amount;
  }
  L.summarize = function (list) {
    var s = { count: 0, revenue: 0, items: 0, discount: 0, tax: 0, cost: 0, costedNet: 0, costedCount: 0,
      voidCount: 0, voidTotal: 0, byMethod: {}, byType: {}, byCashier: {}, products: {}, days: {}, hours: new Array(24).fill(0) };
    list.forEach(function (t) {
      if (t.status === 'void') { s.voidCount++; s.voidTotal += t.total; return; }
      s.count++; s.revenue += t.total; s.discount += t.discount.amount; s.tax += t.tax;
      addTo(s.byMethod, t.method, t.total);
      addTo(s.byType, t.type, t.total);
      addTo(s.byCashier, t.cashier, t.total);
      var day = s.days[t.dk] || (s.days[t.dk] = { revenue: 0, count: 0 });
      day.revenue += t.total; day.count++;
      s.hours[new Date(t.ts).getHours()] += t.total;
      var allCosted = true, tcost = 0;
      t.items.forEach(function (it) {
        s.items += it.qty;
        var pr = s.products[it.name] || (s.products[it.name] = { name: it.name, qty: 0, revenue: 0, cost: 0, revenueCosted: 0 });
        pr.qty += it.qty; pr.revenue += it.price * it.qty;
        if (it.cost == null) allCosted = false;
        else { tcost += it.cost * it.qty; pr.cost += it.cost * it.qty; pr.revenueCosted += it.price * it.qty; }
      });
      if (allCosted) { s.costedCount++; s.cost += tcost; s.costedNet += t.subtotal - t.discount.amount; }
    });
    s.profit = s.costedNet - s.cost;
    s.margin = s.costedNet > 0 ? s.profit / s.costedNet : 0;
    s.avg = s.count ? s.revenue / s.count : 0;
    return s;
  };

  L.trxRange = function (from, to) {
    return db.byRange('trx', 'dk', from, to).then(function (l) { return l.sort(function (a, b) { return b.ts - a.ts; }); });
  };

  /* ---------- Cadangan ---------- */
  L.exportAll = function () {
    return Promise.all([db.all('trx'), db.all('stocklog'), db.kvGet('counter', null)]).then(function (r) {
      return {
        app: 'TOOS NGOPI POS', v: 1, exportedAt: new Date().toISOString(),
        kv: { settings: S.settings, users: S.users, products: S.products, ingredients: S.ingredients, counter: r[2] },
        trx: r[0], stocklog: r[1]
      };
    });
  };

  L.validateBackup = function (o) {
    return !!(o && o.app === 'TOOS NGOPI POS' && o.kv && Array.isArray(o.kv.products) && Array.isArray(o.kv.ingredients) &&
      Array.isArray(o.kv.users) && o.kv.users.some(function (x) { return x.role === 'owner'; }) &&
      o.kv.settings && typeof o.kv.settings === 'object' && Array.isArray(o.trx) && Array.isArray(o.stocklog));
  };

  L.importAll = function (o) {
    return db.tx(['kv', 'trx', 'stocklog'], 'readwrite', function (st) {
      st.kv.clear(); st.trx.clear(); st.stocklog.clear();
      st.kv.put({ k: 'seeded', v: true });
      st.kv.put({ k: 'settings', v: o.kv.settings });
      st.kv.put({ k: 'users', v: o.kv.users });
      st.kv.put({ k: 'products', v: o.kv.products });
      st.kv.put({ k: 'ingredients', v: o.kv.ingredients });
      if (o.kv.counter) st.kv.put({ k: 'counter', v: o.kv.counter });
      o.trx.forEach(function (t) { st.trx.put(t); });
      o.stocklog.forEach(function (l) { st.stocklog.put(l); });
    }).then(TN.reload);
  };

  L.clearTransactions = function () {
    return db.tx(['kv', 'trx', 'stocklog'], 'readwrite', function (st) {
      st.trx.clear(); st.stocklog.clear(); st.kv.delete('counter');
    });
  };
})(window.TN);
