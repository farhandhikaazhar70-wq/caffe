'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 10: halaman Stok (bahan baku & riwayat)
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, L = TN.logic, db = TN.db, esc = u.esc;
  var tab = 'bahan', root = null, hf = { ing: '', type: '' };
  var TYPES = { in: 'Stok masuk', out: 'Stok keluar', adjust: 'Opname', sale: 'Penjualan', void: 'Pembatalan' };

  function usedBy(id) {
    return TN.S.products.filter(function (p) { return (p.recipe || []).some(function (r) { return r.ing === id; }); });
  }
  function status(i) {
    if (i.stock <= 0) return '<span class="badge badge--bad">Habis</span>';
    if (i.stock <= i.min) return '<span class="badge badge--warn">Hampir habis</span>';
    return '<span class="badge badge--ok">Aman</span>';
  }

  function drawBahan() {
    var list = TN.S.ingredients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var box = root.querySelector('#stokBody');
    if (!list.length) { box.innerHTML = ui.empty('Belum ada bahan baku', 'Klik "Tambah bahan" untuk mulai.'); return; }
    box.innerHTML = '<div class="table-wrap"><table class="tbl tbl--stack"><thead><tr><th>Bahan</th><th class="num">Stok</th><th class="num">Minimum</th><th class="num">Modal/unit</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (i) {
        return '<tr><td data-label="Bahan"><strong>' + esc(i.name) + '</strong><div class="muted small">' + usedBy(i.id).length + ' menu memakai</div></td>' +
          '<td data-label="Stok" class="num"><strong class="' + (i.stock <= 0 ? 'txt-bad' : '') + '">' + u.num(i.stock) + '</strong> ' + esc(i.unit) + '</td>' +
          '<td data-label="Minimum" class="num">' + u.num(i.min) + ' ' + esc(i.unit) + '</td>' +
          '<td data-label="Modal/unit" class="num">' + (i.cost > 0 ? u.rp(i.cost) : '<span class="muted">belum diisi</span>') + '</td>' +
          '<td data-label="Status">' + status(i) + '</td>' +
          '<td class="act"><div class="btnrow">' +
          '<button class="btn btn--ghost btn--sm" data-mv="in" data-id="' + esc(i.id) + '">+ Masuk</button>' +
          '<button class="btn btn--ghost btn--sm" data-mv="out" data-id="' + esc(i.id) + '">Keluar</button>' +
          '<button class="btn btn--ghost btn--sm" data-mv="adjust" data-id="' + esc(i.id) + '">Opname</button>' +
          '<button class="btn btn--ghost btn--sm" data-edit="' + esc(i.id) + '" aria-label="Ubah ' + esc(i.name) + '">' + ui.icon('edit', 16) + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function drawRiwayat() {
    var box = root.querySelector('#stokBody');
    box.innerHTML = '<div class="toolbar toolbar--pad"><div class="row"><label class="field field--inline"><span>Bahan</span><select class="select" id="hfIng"><option value="">Semua</option>' +
      TN.S.ingredients.map(function (i) { return '<option value="' + esc(i.id) + '"' + (i.id === hf.ing ? ' selected' : '') + '>' + esc(i.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field field--inline"><span>Jenis</span><select class="select" id="hfType"><option value="">Semua</option>' +
      Object.keys(TYPES).map(function (k) { return '<option value="' + k + '"' + (k === hf.type ? ' selected' : '') + '>' + TYPES[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<span class="muted small">300 catatan terbaru</span></div><div id="hist"><div class="loading">Memuat…</div></div>';
    db.recent('stocklog', 'ts', 300, function (l) { return (!hf.ing || l.ing === hf.ing) && (!hf.type || l.type === hf.type); }).then(function (rows) {
      var h = root.querySelector('#hist'); if (!h) return;
      h.innerHTML = rows.length ? '<div class="table-wrap"><table class="tbl tbl--stack"><thead><tr><th>Waktu</th><th>Bahan</th><th>Jenis</th><th class="num">Perubahan</th><th class="num">Stok akhir</th><th>Catatan</th></tr></thead><tbody>' +
        rows.map(function (l) {
          return '<tr><td data-label="Waktu">' + esc(u.dateTime(l.ts)) + '</td><td data-label="Bahan">' + esc(l.name) + '</td><td data-label="Jenis">' + esc(TYPES[l.type] || l.type) + '</td>' +
            '<td data-label="Perubahan" class="num ' + (l.delta < 0 ? 'txt-bad' : 'txt-ok') + '">' + (l.delta > 0 ? '+' : '') + u.num(l.delta) + ' ' + esc(l.unit) + '</td>' +
            '<td data-label="Stok akhir" class="num">' + u.num(l.after) + ' ' + esc(l.unit) + '</td><td data-label="Catatan">' + esc(l.note) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : ui.empty('Belum ada riwayat', 'Pergerakan stok akan tercatat di sini.');
    });
  }

  function draw() {
    root.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.tab === tab); });
    root.querySelector('[data-addbtn]').hidden = tab !== 'bahan';
    if (tab === 'bahan') drawBahan(); else drawRiwayat();
  }

  /* ---------- Form bahan ---------- */
  function openIngForm(ing) {
    var isNew = !ing;
    var i = ing ? Object.assign({}, ing) : { id: 'i-' + u.uid(), name: '', unit: 'Gram', stock: 0, min: 0, pkgPrice: 0, pkgSize: 0, cost: 0 };
    var m = ui.modal({
      title: isNew ? 'Tambah bahan baku' : 'Ubah bahan baku', size: 'md',
      body: '<form id="iForm" class="stack"><div class="grid2">' +
        '<label class="field"><span>Nama bahan</span><input class="input" name="name" required maxlength="50" value="' + esc(i.name) + '" autocomplete="off"></label>' +
        '<label class="field"><span>Satuan</span><input class="input" name="unit" required maxlength="12" list="unitList" value="' + esc(i.unit) + '" autocomplete="off"><datalist id="unitList"><option>Gram</option><option>Ml</option><option>Pcs</option><option>Sachet</option><option>Butir</option></datalist></label>' +
        (isNew ? '<label class="field"><span>Stok awal</span><input class="input" name="stock" type="number" min="0" step="any" value="' + i.stock + '"></label>' : '') +
        '<label class="field"><span>Stok minimum (peringatan)</span><input class="input" name="min" type="number" min="0" step="any" value="' + i.min + '"></label></div>' +
        '<fieldset class="recipe"><legend>Harga beli (untuk menghitung HPP)</legend><div class="grid2">' +
        '<label class="field"><span>Harga per kemasan</span><input class="input" name="pkgPrice" inputmode="numeric" autocomplete="off"></label>' +
        '<label class="field"><span>Isi per kemasan (<span id="uLbl">' + esc(i.unit) + '</span>)</span><input class="input" name="pkgSize" type="number" min="0" step="any" value="' + (i.pkgSize || '') + '"></label></div>' +
        '<div class="hpp" id="cpu"></div><p class="hint">Contoh: kopi 1 kg seharga Rp 150.000 → harga 150.000, isi 1000 (Gram).</p></fieldset></form>',
      foot: (!isNew ? '<button type="button" class="btn btn--danger btn--left" id="delI">Hapus</button>' : '') + '<button type="button" class="btn btn--ghost" data-close>Batal</button><button type="submit" form="iForm" class="btn btn--primary">Simpan</button>'
    });
    var f = m.el.querySelector('#iForm');
    f.elements.pkgPrice.value = i.pkgPrice ? String(i.pkgPrice) : ''; ui.money(f.elements.pkgPrice);
    function cpu() {
      var price = ui.moneyVal(f.elements.pkgPrice), size = parseFloat(f.elements.pkgSize.value) || 0;
      m.el.querySelector('#uLbl').textContent = f.elements.unit.value || '';
      m.el.querySelector('#cpu').innerHTML = price > 0 && size > 0 ? 'Modal per ' + esc(f.elements.unit.value) + ': <b>' + u.rp(price / size) + '</b>' : '<span class="muted">Modal per satuan belum dihitung</span>';
    }
    f.addEventListener('input', cpu); cpu();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.elements.name.value.trim(), unit = f.elements.unit.value.trim();
      if (!name || !unit) return;
      if (TN.S.ingredients.some(function (x) { return x.id !== i.id && x.name.toLowerCase() === name.toLowerCase(); })) { ui.toast('Nama bahan sudah dipakai', 'bad'); return; }
      i.name = name; i.unit = unit; i.min = Math.max(parseFloat(f.elements.min.value) || 0, 0);
      if (isNew) i.stock = Math.max(parseFloat(f.elements.stock.value) || 0, 0);
      i.pkgPrice = ui.moneyVal(f.elements.pkgPrice); i.pkgSize = parseFloat(f.elements.pkgSize.value) || 0; i.cost = L.ingCost(i);
      var go = function () {
        if (isNew) TN.S.ingredients.push(i); else TN.S.ingredients[TN.S.ingredients.findIndex(function (x) { return x.id === i.id; })] = i;
        return L.save('ingredients').then(function () { m.close(); ui.toast('Bahan disimpan', 'ok'); draw(); });
      };
      if (isNew && i.stock > 0) {
        // stok awal dicatat di riwayat
        var base = Object.assign({}, i, { stock: 0 });
        TN.S.ingredients.push(base);
        L.save('ingredients').then(function () { return L.stockMove(i.id, 'in', i.stock, 'Stok awal'); }).then(function () {
          var cur = L.ing(i.id); cur.name = i.name; cur.unit = i.unit; cur.min = i.min; cur.pkgPrice = i.pkgPrice; cur.pkgSize = i.pkgSize; cur.cost = i.cost;
          return L.save('ingredients');
        }).then(function () { m.close(); ui.toast('Bahan disimpan', 'ok'); draw(); }).catch(function (err) { ui.toast('Gagal: ' + err.message, 'bad'); });
      } else go().catch(function (err) { ui.toast('Gagal: ' + err.message, 'bad'); });
    });
    var del = m.el.querySelector('#delI');
    if (del) del.addEventListener('click', function () {
      var used = usedBy(i.id);
      if (used.length) {
        ui.modal({ title: 'Bahan masih dipakai', size: 'sm', body: '<p class="msg">"' + esc(i.name) + '" dipakai di resep: <b>' + esc(used.map(function (p) { return p.name; }).join(', ')) + '</b>. Hapus dari resep tersebut dulu.</p>', foot: '<button class="btn btn--primary" data-close>Mengerti</button>' });
        return;
      }
      ui.confirm({ title: 'Hapus bahan?', message: '"' + i.name + '" akan dihapus. Riwayat stoknya tetap tersimpan.', ok: 'Hapus', danger: true }).then(function (y) {
        if (!y) return;
        TN.S.ingredients = TN.S.ingredients.filter(function (x) { return x.id !== i.id; });
        L.save('ingredients').then(function () { m.close(); ui.toast('Bahan dihapus', 'ok'); draw(); });
      });
    });
  }

  /* ---------- Form pergerakan stok ---------- */
  function openMove(type, id) {
    var i = L.ing(id); if (!i) return;
    var T = { in: ['Stok masuk', 'Jumlah masuk', 'Simpan stok masuk'], out: ['Stok keluar', 'Jumlah keluar (terbuang/rusak)', 'Simpan stok keluar'], adjust: ['Opname stok', 'Stok sebenarnya di rak', 'Simpan hasil opname'] }[type];
    var m = ui.modal({
      title: T[0] + ': ' + i.name, size: 'sm',
      body: '<form id="mForm" class="stack"><p class="muted">Stok saat ini: <b>' + u.num(i.stock) + ' ' + esc(i.unit) + '</b></p>' +
        '<label class="field"><span>' + T[1] + ' (' + esc(i.unit) + ')</span><input class="input" name="qty" type="number" min="0" step="any" required autocomplete="off"></label>' +
        '<label class="field"><span>Catatan (opsional)</span><input class="input" name="note" maxlength="80" placeholder="' + (type === 'in' ? 'Contoh: belanja pasar' : type === 'out' ? 'Contoh: tumpah' : 'Contoh: hitung akhir bulan') + '" autocomplete="off"></label></form>',
      foot: '<button type="button" class="btn btn--ghost" data-close>Batal</button><button type="submit" form="mForm" class="btn btn--primary">' + T[2] + '</button>'
    });
    m.el.querySelector('#mForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var qty = parseFloat(this.elements.qty.value);
      if (!(qty >= 0) || (type !== 'adjust' && qty === 0)) { ui.toast('Isi jumlah dengan benar', 'bad'); return; }
      L.stockMove(id, type, qty, this.elements.note.value.trim()).then(function () { m.close(); ui.toast('Stok diperbarui', 'ok'); draw(); }).catch(function (err) { ui.toast('Gagal: ' + err.message, 'bad'); });
    });
  }

  TN.pages.stok = {
    title: 'Stok',
    render: function (el) {
      root = el;
      el.innerHTML = '<div class="stack stack--lg"><div class="toolbar"><div class="seg" role="tablist"><button type="button" role="tab" data-tab="bahan">Bahan baku</button><button type="button" role="tab" data-tab="riwayat">Riwayat stok</button></div>' +
        '<button class="btn btn--primary" data-addbtn data-add>' + ui.icon('plus', 18) + ' Tambah bahan</button></div><section class="card card--flush" id="stokBody"></section></div>';
      draw();
      el.onclick = function (e) {
        var t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; draw(); return; }
        if (e.target.closest('[data-add]')) { openIngForm(null); return; }
        var mv = e.target.closest('[data-mv]'); if (mv) { openMove(mv.dataset.mv, mv.dataset.id); return; }
        var ed = e.target.closest('[data-edit]'); if (ed) openIngForm(L.ing(ed.dataset.edit));
      };
      el.onchange = function (e) {
        if (e.target.id === 'hfIng') { hf.ing = e.target.value; drawRiwayat(); }
        if (e.target.id === 'hfType') { hf.type = e.target.value; drawRiwayat(); }
      };
    }
  };
})(window.TN);
