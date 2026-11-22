'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 9: halaman Menu (produk + resep)
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, L = TN.logic, esc = u.esc;
  var q = '', root = null;

  function margin(p) {
    var c = L.recipeCost(p);
    return c == null ? null : { cost: c, profit: p.price - c, pct: p.price > 0 ? (p.price - c) / p.price : 0 };
  }

  function draw() {
    var needle = q.trim().toLowerCase();
    var list = TN.S.products.filter(function (p) {
      return !needle || p.name.toLowerCase().indexOf(needle) >= 0 || p.category.toLowerCase().indexOf(needle) >= 0;
    }).sort(function (a, b) { return a.category.localeCompare(b.category) || a.name.localeCompare(b.name); });

    var rows = list.map(function (p) {
      var mg = margin(p);
      return '<tr><td data-label="Menu"><strong>' + esc(p.name) + '</strong>' + (p.active ? '' : ' <span class="badge badge--muted">Disembunyikan</span>') + '</td>' +
        '<td data-label="Kategori"><span><i class="dotc" style="background:' + u.catColor(p.category) + '"></i>' + esc(p.category) + '</span></td>' +
        '<td data-label="Harga" class="num">' + u.rp(p.price) + '</td>' +
        '<td data-label="HPP" class="num">' + (mg ? u.rp(mg.cost) : '<span class="muted">–</span>') + '</td>' +
        '<td data-label="Margin" class="num">' + (mg ? '<span class="' + (mg.pct < 0.3 ? 'txt-warn' : 'txt-ok') + '">' + Math.round(mg.pct * 100) + '%</span>' : '<span class="muted">–</span>') + '</td>' +
        '<td data-label="Resep">' + (p.recipe && p.recipe.length ? '<span class="badge badge--ok">' + p.recipe.length + ' bahan</span>' : '<span class="badge badge--muted">Tanpa resep</span>') + '</td>' +
        '<td class="act"><button class="btn btn--ghost btn--sm" data-edit="' + esc(p.id) + '">' + ui.icon('edit', 16) + ' Ubah</button></td></tr>';
    }).join('');

    root.querySelector('#menuBody').innerHTML = list.length ?
      '<div class="table-wrap"><table class="tbl tbl--stack"><thead><tr><th>Menu</th><th>Kategori</th><th class="num">Harga</th><th class="num">HPP</th><th class="num">Margin</th><th>Resep</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
      ui.empty(TN.S.products.length ? 'Menu tidak ditemukan' : 'Belum ada menu', TN.S.products.length ? '' : 'Klik "Tambah menu" untuk mulai.');
  }

  /* ---------- Form menu + resep ---------- */
  function openForm(prod) {
    var isNew = !prod;
    var p = prod ? JSON.parse(JSON.stringify(prod)) : { id: 'p-' + u.uid(), name: '', category: '', price: 0, active: true, recipe: [], createdAt: Date.now() };
    var cats = Array.from(new Set(TN.S.products.map(function (x) { return x.category; }))).filter(Boolean);
    var ings = TN.S.ingredients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

    function ingOptions(sel) {
      return ings.map(function (i) { return '<option value="' + esc(i.id) + '"' + (i.id === sel ? ' selected' : '') + ' data-unit="' + esc(i.unit) + '">' + esc(i.name) + '</option>'; }).join('');
    }
    function rowHTML(r) {
      var i = L.ing(r.ing);
      return '<div class="rrow"><select class="select" name="ing" aria-label="Bahan">' + ingOptions(r.ing) + '</select>' +
        '<input class="input" type="number" name="qty" min="0" step="any" value="' + (r.qty || '') + '" placeholder="Jumlah" aria-label="Jumlah bahan">' +
        '<span class="unit">' + esc(i ? i.unit : (ings[0] ? ings[0].unit : '')) + '</span>' +
        '<button type="button" class="icon-btn" data-rm aria-label="Hapus bahan">' + ui.icon('trash', 18) + '</button></div>';
    }

    var m = ui.modal({
      title: isNew ? 'Tambah menu' : 'Ubah menu', size: 'lg',
      body: '<form id="pForm" class="stack"><div class="grid2">' +
        '<label class="field"><span>Nama menu</span><input class="input" name="name" required maxlength="60" value="' + esc(p.name) + '" autocomplete="off"></label>' +
        '<label class="field"><span>Kategori</span><input class="input" name="category" required maxlength="30" list="catList" value="' + esc(p.category) + '" placeholder="Contoh: Coffee" autocomplete="off"><datalist id="catList">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
        '<label class="field"><span>Harga jual</span><input class="input" name="price" required inputmode="numeric" autocomplete="off"></label>' +
        '<label class="check"><input type="checkbox" name="active"' + (p.active ? ' checked' : '') + '><span>Tampilkan di Kasir</span></label></div>' +
        '<fieldset class="recipe"><legend>Resep (opsional)</legend>' +
        '<p class="hint">Dengan resep, stok bahan berkurang otomatis setiap menu terjual dan HPP dihitung.</p>' +
        (ings.length ? '<div id="rrows">' + p.recipe.map(rowHTML).join('') + '</div><button type="button" class="btn btn--ghost btn--sm" id="addRow">' + ui.icon('plus', 16) + ' Tambah bahan</button>' :
          '<div class="notice">Belum ada bahan baku. Tambahkan dulu di halaman Stok.</div>') +
        '<div class="hpp" id="hpp"></div></fieldset></form>',
      foot: (!isNew ? '<button type="button" class="btn btn--danger btn--left" id="delP">Hapus</button>' : '') + '<button type="button" class="btn btn--ghost" data-close>Batal</button><button type="submit" form="pForm" class="btn btn--primary">Simpan</button>'
    });
    var f = m.el.querySelector('#pForm'), price = f.elements.price;
    price.value = p.price ? String(p.price) : '';
    ui.money(price);

    function readRows() {
      var map = {};
      m.el.querySelectorAll('.rrow').forEach(function (r) {
        var id = r.querySelector('[name=ing]').value, qty = parseFloat(r.querySelector('[name=qty]').value);
        if (id && qty > 0) map[id] = u.round3((map[id] || 0) + qty);
      });
      return Object.keys(map).map(function (id) { return { ing: id, qty: map[id] }; });
    }
    function hpp() {
      var rec = readRows(), box = m.el.querySelector('#hpp'), pr = ui.moneyVal(price);
      if (!rec.length) { box.textContent = ''; return; }
      var cost = L.recipeCost({ recipe: rec });
      box.innerHTML = cost == null ? '<span class="muted">HPP belum bisa dihitung: isi harga beli bahan di halaman Stok.</span>' :
        'HPP <b>' + u.rp(cost) + '</b> · Laba <b>' + u.rp(pr - cost) + '</b> · Margin <b>' + (pr > 0 ? Math.round((pr - cost) / pr * 100) : 0) + '%</b>';
    }
    f.addEventListener('input', hpp);
    f.addEventListener('change', function (e) {
      if (e.target.name === 'ing') { var o = e.target.selectedOptions[0]; e.target.closest('.rrow').querySelector('.unit').textContent = o ? o.dataset.unit : ''; }
      hpp();
    });
    f.addEventListener('click', function (e) {
      if (e.target.closest('[data-rm]')) { e.target.closest('.rrow').remove(); hpp(); }
      if (e.target.closest('#addRow')) {
        var tmp = document.createElement('div'); tmp.innerHTML = rowHTML({ ing: ings[0].id, qty: '' });
        m.el.querySelector('#rrows').appendChild(tmp.firstChild); tmp.firstChild; hpp();
      }
    });
    hpp();

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.elements.name.value.trim(), cat = f.elements.category.value.trim(), pr = ui.moneyVal(price);
      if (!name || !cat) return;
      if (pr <= 0) { ui.toast('Harga jual harus lebih dari 0', 'bad'); return; }
      var dup = TN.S.products.some(function (x) { return x.id !== p.id && x.name.toLowerCase() === name.toLowerCase(); });
      if (dup) { ui.toast('Nama menu sudah dipakai', 'bad'); return; }
      p.name = name; p.category = cat; p.price = pr; p.active = f.elements.active.checked; p.recipe = readRows();
      if (isNew) TN.S.products.push(p);
      else TN.S.products[TN.S.products.findIndex(function (x) { return x.id === p.id; })] = p;
      L.save('products').then(function () { m.close(); ui.toast('Menu disimpan', 'ok'); draw(); }).catch(function (err) { ui.toast('Gagal menyimpan: ' + err.message, 'bad'); });
    });

    var del = m.el.querySelector('#delP');
    if (del) del.addEventListener('click', function () {
      ui.confirm({ title: 'Hapus menu?', message: '"' + p.name + '" akan dihapus dari daftar menu. Riwayat transaksi lama tetap aman. Jika hanya ingin menyembunyikan, hilangkan centang "Tampilkan di Kasir".', ok: 'Hapus', danger: true }).then(function (y) {
        if (!y) return;
        TN.S.products = TN.S.products.filter(function (x) { return x.id !== p.id; });
        TN.pos.cart = TN.pos.cart.filter(function (c) { return c.pid !== p.id; });
        L.save('products').then(function () { m.close(); ui.toast('Menu dihapus', 'ok'); draw(); });
      });
    });
  }

  TN.pages.menu = {
    title: 'Menu',
    render: function (el) {
      root = el;
      el.innerHTML = '<div class="stack stack--lg"><div class="toolbar"><label class="search search--wide">' + ui.icon('search', 18) + '<input id="mq" type="search" placeholder="Cari menu…" value="' + esc(q) + '" aria-label="Cari menu" autocomplete="off"></label>' +
        '<button class="btn btn--primary" data-add>' + ui.icon('plus', 18) + ' Tambah menu</button></div><section class="card card--flush" id="menuBody"></section></div>';
      draw();
      el.onclick = function (e) {
        if (e.target.closest('[data-add]')) { openForm(null); return; }
        var b = e.target.closest('[data-edit]');
        if (b) { var p = L.prod(b.dataset.edit); if (p) openForm(p); }
      };
      el.oninput = function (e) { if (e.target.id === 'mq') { q = e.target.value; draw(); } };
    }
  };
})(window.TN);
