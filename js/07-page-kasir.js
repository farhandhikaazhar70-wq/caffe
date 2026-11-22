'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 7: halaman Kasir
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, L = TN.logic, esc = u.esc;

  // Pesanan berjalan disimpan di memori supaya tidak hilang saat pindah halaman
  var pos = TN.pos = { cat: 'Semua', q: '', cart: [], type: 'dine', customer: '', disc: { type: 'rp', value: 0 }, sheet: false };
  var root = null, paying = false;

  function lines() {
    return pos.cart.map(function (c) {
      var p = L.prod(c.pid);
      return p ? { pid: p.id, name: p.name, price: p.price, qty: c.qty, note: c.note || '', cost: L.recipeCost(p) } : null;
    }).filter(Boolean);
  }
  function totals() { return L.totals(lines(), pos.disc, TN.S.settings.taxPct); }

  /* ---------- Menggambar ---------- */
  function drawCats() {
    var cats = ['Semua'];
    TN.S.products.forEach(function (p) { if (p.active && cats.indexOf(p.category) < 0) cats.push(p.category); });
    var el = root.querySelector('#cats');
    el.innerHTML = cats.map(function (c) {
      return '<button type="button" class="chip' + (c === pos.cat ? ' is-on' : '') + '" data-act="cat" data-v="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }

  function drawTiles() {
    var q = pos.q.trim().toLowerCase();
    var list = TN.S.products.filter(function (p) {
      return p.active && (pos.cat === 'Semua' || p.category === pos.cat) &&
        (!q || p.name.toLowerCase().indexOf(q) >= 0 || p.category.toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return a.category.localeCompare(b.category) || a.name.localeCompare(b.name); });

    var el = root.querySelector('#tiles');
    if (!TN.S.products.length) { el.innerHTML = ui.empty('Belum ada menu', 'Tambahkan menu di halaman Menu.'); return; }
    if (!list.length) { el.innerHTML = ui.empty('Menu tidak ditemukan', 'Coba kata kunci atau kategori lain.'); return; }

    el.innerHTML = list.map(function (p) {
      var max = L.maxServings(p), inCart = (pos.cart.find(function (c) { return c.pid === p.id; }) || {}).qty || 0;
      var out = max <= 0, block = out && TN.S.settings.blockShort;
      return '<button type="button" class="tile' + (out ? ' is-out' : '') + '" data-act="add" data-id="' + esc(p.id) + '" style="--c:' + u.catColor(p.category) + '"' + (block ? ' disabled' : '') + '>' +
        '<span class="tile__cat">' + esc(p.category) + '</span>' +
        '<span class="tile__name">' + esc(p.name) + '</span>' +
        '<span class="tile__price">' + u.rp(p.price) + '</span>' +
        (out ? '<span class="tile__warn">Bahan habis</span>' : (max <= 5 && max !== Infinity ? '<span class="tile__warn tile__warn--soft">Sisa ±' + max + '</span>' : '')) +
        (inCart ? '<span class="tile__badge" aria-label="' + inCart + ' di pesanan">' + inCart + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function drawOrder() {
    var ls = lines(), t = L.totals(ls, pos.disc, TN.S.settings.taxPct), st = TN.S.settings;
    var count = ls.reduce(function (s, l) { return s + l.qty; }, 0);

    var body = ls.length ? ls.map(function (l) {
      return '<div class="line"><div class="line__main"><div class="line__name">' + esc(l.name) + '</div>' +
        '<div class="line__price">' + u.rp(l.price) + '</div>' +
        '<button type="button" class="link" data-act="note" data-id="' + esc(l.pid) + '">' + (l.note ? esc(l.note) : '+ Catatan') + '</button></div>' +
        '<div class="stepper"><button type="button" data-act="dec" data-id="' + esc(l.pid) + '" aria-label="Kurangi ' + esc(l.name) + '">' + ui.icon('minus', 16) + '</button>' +
        '<span aria-live="polite">' + l.qty + '</span>' +
        '<button type="button" data-act="inc" data-id="' + esc(l.pid) + '" aria-label="Tambah ' + esc(l.name) + '">' + ui.icon('plus', 16) + '</button></div>' +
        '<div class="line__total">' + u.rp(l.price * l.qty) + '</div></div>';
    }).join('') : '<div class="order__empty">' + ui.icon('cart', 34) + '<p>Ketuk menu untuk menambah pesanan</p></div>';

    root.querySelector('#order').innerHTML =
      '<div class="order__head"><div><h2>Pesanan</h2><span class="muted">' + count + ' item</span></div>' +
      '<div class="order__tools"><button type="button" class="btn btn--ghost btn--sm" data-act="clear"' + (ls.length ? '' : ' disabled') + '>' + ui.icon('trash', 16) + ' Kosongkan</button>' +
      '<button type="button" class="icon-btn order__close" data-act="sheet" aria-label="Tutup pesanan">' + ui.icon('x') + '</button></div></div>' +
      '<div class="order__meta"><div class="seg" role="radiogroup" aria-label="Tipe pesanan">' +
      '<button type="button" role="radio" aria-checked="' + (pos.type === 'dine') + '" class="' + (pos.type === 'dine' ? 'is-on' : '') + '" data-act="type" data-v="dine">Makan di tempat</button>' +
      '<button type="button" role="radio" aria-checked="' + (pos.type === 'take') + '" class="' + (pos.type === 'take' ? 'is-on' : '') + '" data-act="type" data-v="take">Dibawa pulang</button></div>' +
      '<input class="input" id="customer" placeholder="Atas nama / no. meja (opsional)" value="' + esc(pos.customer) + '" aria-label="Atas nama atau nomor meja" autocomplete="off"></div>' +
      '<div class="order__lines">' + body + '</div>' +
      '<div class="order__sum">' +
      '<div class="sumrow"><span>Subtotal</span><span>' + u.rp(t.subtotal) + '</span></div>' +
      '<div class="sumrow"><button type="button" class="link" data-act="disc">' + (t.discount > 0 ? 'Ubah diskon' : '+ Tambah diskon') + '</button><span>' + (t.discount > 0 ? '-' + u.rp(t.discount) : '') + '</span></div>' +
      (st.taxPct > 0 ? '<div class="sumrow"><span>Pajak ' + st.taxPct + '%</span><span>' + u.rp(t.tax) + '</span></div>' : '') +
      '<div class="sumrow sumrow--total"><span>Total</span><span>' + u.rp(t.total) + '</span></div>' +
      '<button type="button" class="btn btn--primary btn--lg btn--block" data-act="pay"' + (ls.length ? '' : ' disabled') + '>Bayar ' + (ls.length ? u.rp(t.total) : '') + '</button></div>';

    var bar = root.querySelector('#cartbar');
    if (bar) {
      bar.hidden = !ls.length;
      bar.innerHTML = '<span>' + ui.icon('cart', 20) + ' ' + count + ' item</span><strong>' + u.rp(t.total) + '</strong><span>Lihat pesanan</span>';
    }
    root.querySelector('.pos').classList.toggle('sheet-open', pos.sheet && ls.length > 0);
  }

  function drawAll() { drawCats(); drawTiles(); drawOrder(); }

  /* ---------- Aksi keranjang ---------- */
  function stockOk(pid, qty) {
    if (!TN.S.settings.blockShort) return true;
    var test = pos.cart.filter(function (c) { return c.pid !== pid; }).map(function (c) { return { pid: c.pid, qty: c.qty }; });
    test.push({ pid: pid, qty: qty });
    var sh = L.shortages(L.usageFor(test));
    if (sh.length) { ui.toast('Stok ' + sh[0].name + ' tidak cukup', 'bad'); return false; }
    return true;
  }
  function setQty(pid, qty) {
    var c = pos.cart.find(function (x) { return x.pid === pid; });
    if (qty <= 0) { pos.cart = pos.cart.filter(function (x) { return x.pid !== pid; }); }
    else if (c) { if (!stockOk(pid, qty)) return; c.qty = qty; }
    else { if (!stockOk(pid, qty)) return; pos.cart.push({ pid: pid, qty: qty, note: '' }); }
    drawTiles(); drawOrder();
  }
  function qtyOf(pid) { var c = pos.cart.find(function (x) { return x.pid === pid; }); return c ? c.qty : 0; }

  function resetOrder() {
    pos.cart = []; pos.customer = ''; pos.disc = { type: 'rp', value: 0 }; pos.sheet = false; pos.type = 'dine';
  }

  function openDiscount() {
    var d = pos.disc, type = d.type;
    var m = ui.modal({
      title: 'Diskon', size: 'sm',
      body: '<form id="dForm" class="stack"><div class="seg" id="dSeg"><button type="button" data-t="rp" class="' + (type === 'rp' ? 'is-on' : '') + '">Rupiah (Rp)</button><button type="button" data-t="pct" class="' + (type === 'pct' ? 'is-on' : '') + '">Persen (%)</button></div>' +
        '<label class="field"><span id="dLabel">Nilai diskon</span><input class="input" id="dVal" inputmode="numeric" value="' + (d.value || '') + '" autocomplete="off"></label></form>',
      foot: '<button type="button" class="btn btn--ghost" data-reset>Hapus diskon</button><button type="submit" form="dForm" class="btn btn--primary">Terapkan</button>'
    });
    var val = m.el.querySelector('#dVal');
    ui.money(val);
    m.el.querySelector('#dSeg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      type = b.dataset.t;
      m.el.querySelectorAll('#dSeg button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      val.focus();
    });
    m.el.querySelector('[data-reset]').addEventListener('click', function () { pos.disc = { type: 'rp', value: 0 }; m.close(); drawOrder(); });
    m.el.querySelector('#dForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = ui.moneyVal(val);
      if (type === 'pct' && v > 100) { ui.toast('Diskon persen maksimal 100', 'bad'); return; }
      pos.disc = { type: type, value: v }; m.close(); drawOrder();
    });
  }

  /* ---------- Pembayaran ---------- */
  function suggestions(total) {
    var set = {};
    [5000, 10000, 20000, 50000, 100000].forEach(function (step) {
      var v = Math.ceil(total / step) * step;
      if (v > total) set[v] = 1;
    });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; }).slice(0, 3);
  }

  function openPay() {
    var ls = lines();
    if (!ls.length || paying) return;
    var st = TN.S.settings, t = L.totals(ls, pos.disc, st.taxPct);
    var usage = L.usageFor(ls.map(function (l) { return { pid: l.pid, qty: l.qty }; }));
    var shortList = L.shortages(usage);

    if (shortList.length && st.blockShort) {
      ui.modal({ title: 'Stok bahan tidak cukup', size: 'sm',
        body: '<p class="msg">Pesanan tidak bisa diproses:</p><ul class="list">' + shortList.map(function (s) {
          return '<li>' + esc(s.name) + ': butuh ' + u.num(s.need) + ' ' + esc(s.unit) + ', tersedia ' + u.num(s.have) + '</li>';
        }).join('') + '</ul>', foot: '<button type="button" class="btn btn--primary" data-close>Mengerti</button>' });
      return;
    }

    var method = 'cash';
    var m = ui.modal({
      title: 'Pembayaran', size: 'md', dismiss: true,
      body: '<div class="pay"><div class="pay__total"><span>Total tagihan</span><strong>' + u.rp(t.total) + '</strong></div>' +
        '<div class="seg seg--3" id="mSeg" role="radiogroup" aria-label="Metode pembayaran"><button type="button" class="is-on" role="radio" aria-checked="true" data-m="cash">Tunai</button>' +
        '<button type="button" role="radio" aria-checked="false" data-m="qris">QRIS</button><button type="button" role="radio" aria-checked="false" data-m="transfer">Transfer</button></div>' +
        '<div id="payBody"></div></div>',
      foot: '<button type="button" class="btn btn--ghost" data-close>Batal</button><button type="button" class="btn btn--primary btn--lg" id="payOk" disabled>Selesaikan pembayaran</button>',
      noFocus: true
    });
    var body = m.el.querySelector('#payBody'), ok = m.el.querySelector('#payOk'), cash = null;

    function paidAmount() { return method === 'cash' ? ui.moneyVal(cash) : t.total; }
    function refresh() {
      var paid = paidAmount(), valid = paid >= t.total;
      ok.disabled = !valid;
      if (method === 'cash') {
        var info = m.el.querySelector('#chg');
        info.className = 'chg ' + (valid ? 'chg--ok' : 'chg--bad');
        info.innerHTML = valid ? '<span>Kembalian</span><strong>' + u.rp(paid - t.total) + '</strong>' : '<span>Kurang</span><strong>' + u.rp(Math.max(t.total - paid, 0)) + '</strong>';
      }
    }
    function drawMethod() {
      if (method === 'cash') {
        body.innerHTML = '<label class="field"><span>Uang diterima</span><input class="input input--xl" id="cash" autocomplete="off" placeholder="0"></label>' +
          '<div class="quick"><button type="button" class="btn btn--ghost" data-q="' + t.total + '">Uang pas</button>' +
          suggestions(t.total).map(function (v) { return '<button type="button" class="btn btn--ghost" data-q="' + v + '">' + u.num(v) + '</button>'; }).join('') + '</div>' +
          '<div id="chg" class="chg"></div>';
        cash = body.querySelector('#cash'); ui.money(cash); cash.focus();
        cash.addEventListener('input', refresh);
      } else if (method === 'qris') {
        body.innerHTML = (st.qrisImage ? '<div class="qris"><img src="' + esc(st.qrisImage) + '" alt="Kode QRIS pembayaran"></div>' : '<div class="notice">Gambar QRIS belum diunggah. Tambahkan di Pengaturan, atau tunjukkan QRIS dari kasir secara manual.</div>') +
          '<p class="hint">Pastikan pembayaran sudah masuk sebelum menekan tombol selesai.</p>';
      } else {
        body.innerHTML = '<div class="notice">' + (st.bankInfo ? esc(st.bankInfo).replace(/\n/g, '<br>') : 'Info rekening belum diisi di Pengaturan.') + '</div>' +
          '<p class="hint">Pastikan transfer sudah diterima sebelum menekan tombol selesai.</p>';
      }
      refresh();
    }
    m.el.querySelector('#mSeg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      method = b.dataset.m;
      m.el.querySelectorAll('#mSeg button').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b); });
      drawMethod();
    });
    body.addEventListener('click', function (e) {
      var q = e.target.closest('[data-q]'); if (!q) return;
      cash.value = Number(q.dataset.q).toLocaleString('id-ID'); refresh(); ok.focus();
    });

    function submit() {
      if (ok.disabled || paying) return;
      paying = true; ok.disabled = true;
      var me = TN.auth.current();
      L.commitSale({ lines: ls, totals: t, disc: pos.disc, taxPct: st.taxPct, type: pos.type, customer: pos.customer.trim(), method: method, paid: paidAmount(), cashier: me ? me.name : '-' })
        .then(function (trx) {
          paying = false; m.close(); resetOrder(); drawAll();
          TN.showReceipt(trx, { fresh: true });
          if (shortList.length) ui.toast('Stok ' + shortList.map(function (s) { return s.name; }).join(', ') + ' kurang. Cek menu Stok.', 'warn');
        })
        .catch(function (e) { paying = false; ok.disabled = false; ui.toast('Gagal menyimpan transaksi: ' + e.message, 'bad'); });
    }
    ok.addEventListener('click', submit);
    m.el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && method === 'cash' && e.target === cash) { e.preventDefault(); submit(); } });
    drawMethod();
  }

  /* ---------- Event ---------- */
  function onClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var id = b.dataset.id, act = b.dataset.act;
    if (act === 'cat') { pos.cat = b.dataset.v; drawCats(); drawTiles(); }
    else if (act === 'add') setQty(id, qtyOf(id) + 1);
    else if (act === 'inc') setQty(id, qtyOf(id) + 1);
    else if (act === 'dec') setQty(id, qtyOf(id) - 1);
    else if (act === 'type') { pos.type = b.dataset.v; drawOrder(); }
    else if (act === 'disc') openDiscount();
    else if (act === 'pay') openPay();
    else if (act === 'sheet') { pos.sheet = !pos.sheet; drawOrder(); }
    else if (act === 'clear') {
      ui.confirm({ title: 'Kosongkan pesanan?', message: 'Semua item di pesanan ini akan dihapus.', ok: 'Kosongkan', danger: true }).then(function (y) { if (y) { resetOrder(); drawAll(); } });
    } else if (act === 'note') {
      var c = pos.cart.find(function (x) { return x.pid === id; });
      ui.ask({ title: 'Catatan item', label: 'Misal: less sugar, tanpa es', value: c ? c.note : '', ok: 'Simpan' }).then(function (v) { if (v !== null && c) { c.note = v; drawOrder(); } });
    }
  }

  TN.pages.kasir = {
    title: 'Kasir',
    render: function (el) {
      root = el;
      el.innerHTML = '<div class="pos">' +
        '<section class="pos__menu" aria-label="Daftar menu"><div class="pos__tools">' +
        '<label class="search">' + ui.icon('search', 18) + '<input id="q" type="search" placeholder="Cari menu…" value="' + esc(pos.q) + '" aria-label="Cari menu" autocomplete="off"></label>' +
        '<div class="chips" id="cats"></div></div><div class="tiles" id="tiles"></div></section>' +
        '<aside class="pos__order" id="order" aria-label="Pesanan"></aside>' +
        '<button type="button" class="cartbar" id="cartbar" data-act="sheet" hidden></button></div>';
      drawAll();
      el.onclick = onClick;
      el.oninput = function (e) {
        if (e.target.id === 'q') { pos.q = e.target.value; drawTiles(); }
        else if (e.target.id === 'customer') pos.customer = e.target.value;
      };
    }
  };
})(window.TN);
