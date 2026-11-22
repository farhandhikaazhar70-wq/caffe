'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 8: halaman Beranda & Transaksi
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, L = TN.logic, esc = u.esc;

  function stat(label, value, sub, cls) {
    return '<div class="stat' + (cls ? ' ' + cls : '') + '"><div class="stat__label">' + esc(label) + '</div><div class="stat__value">' + value + '</div>' + (sub ? '<div class="stat__sub">' + sub + '</div>' : '') + '</div>';
  }
  function trxRow(t) {
    var items = t.items.map(function (i) { return i.qty + '× ' + i.name; }).join(', ');
    return '<button type="button" class="trow' + (t.status === 'void' ? ' is-void' : '') + '" data-trx="' + esc(t.id) + '">' +
      '<span class="trow__no">#' + u.pad(t.no, 3) + '</span>' +
      '<span class="trow__main"><span class="trow__items">' + esc(items) + '</span><span class="trow__meta">' + esc(u.time(t.ts)) + ' · ' + esc(t.cashier) + (t.customer ? ' · ' + esc(t.customer) : '') + '</span></span>' +
      '<span class="badge badge--muted">' + esc(TN.METHOD[t.method] || t.method) + '</span>' +
      (t.status === 'void' ? '<span class="badge badge--bad">Batal</span>' : '') +
      '<span class="trow__total">' + u.rp(t.total) + '</span></button>';
  }

  /* ================= BERANDA ================= */
  TN.pages.beranda = {
    title: 'Beranda',
    render: function (root) {
      var me = TN.auth.current(), st = TN.S.settings, owner = TN.auth.isOwner(), today = u.dk();
      root.innerHTML = '<div class="stack stack--lg"><div class="loading">Memuat…</div></div>';

      L.trxRange(today, today).then(function (list) {
        var s = L.summarize(list);
        var low = TN.S.ingredients.filter(function (i) { return i.stock <= i.min; });
        var days = st.lastBackup ? Math.floor((Date.now() - st.lastBackup) / 86400000) : null;
        var banners = '';
        if (owner && st.defaultPin) banners += '<div class="banner banner--warn">' + ui.icon('alert', 20) + '<span>PIN Owner masih bawaan (1234). Ganti sekarang agar aman.</span><button class="btn btn--sm btn--dark" data-go="pengaturan">Ganti PIN</button></div>';
        if (owner && (days === null || days >= 7)) banners += '<div class="banner">' + ui.icon('download', 20) + '<span>' + (days === null ? 'Data belum pernah dicadangkan.' : 'Terakhir dicadangkan ' + days + ' hari lalu.') + ' Data tersimpan di perangkat ini, jadi cadangkan secara rutin.</span><button class="btn btn--sm btn--dark" data-act="backup">Unduh cadangan</button></div>';

        root.innerHTML = '<div class="stack stack--lg">' + banners +
          '<div class="hello"><div><h2>Halo, ' + esc(me.name) + '</h2><p class="muted">' + esc(u.weekdayLabel(today)) + '</p></div><button class="btn btn--primary btn--lg" data-go="kasir">' + ui.icon('pos', 20) + ' Mulai jualan</button></div>' +
          '<div class="stats">' + stat('Penjualan hari ini', u.rp(s.revenue)) + stat('Transaksi', u.num(s.count), s.voidCount ? s.voidCount + ' dibatalkan' : '') + stat('Item terjual', u.num(s.items)) +
          (owner ? stat('Laba kotor', s.costedCount ? u.rp(s.profit) : '<span class="muted">–</span>', s.costedCount ? (s.costedCount < s.count ? 'dari ' + s.costedCount + ' dari ' + s.count + ' transaksi (HPP lengkap)' : 'margin ' + Math.round(s.margin * 100) + '%') : 'isi harga bahan untuk menghitung') : '') + '</div>' +
          '<div class="cols">' +
          '<section class="card"><div class="card__head"><h3>Transaksi terakhir</h3><button class="link" data-go="transaksi">Lihat semua</button></div>' +
          (list.length ? '<div class="tlist">' + list.slice(0, 6).map(trxRow).join('') + '</div>' : ui.empty('Belum ada transaksi hari ini', 'Transaksi akan muncul di sini.')) + '</section>' +
          (owner ? '<section class="card"><div class="card__head"><h3>Bahan hampir habis</h3><button class="link" data-go="stok">Kelola stok</button></div>' +
            (low.length ? '<ul class="list list--plain">' + low.map(function (i) {
              return '<li><span>' + esc(i.name) + '</span><span class="badge ' + (i.stock <= 0 ? 'badge--bad' : 'badge--warn') + '">' + u.num(i.stock) + ' ' + esc(i.unit) + '</span></li>';
            }).join('') + '</ul>' : ui.empty('Semua stok aman', '')) + '</section>' : '') + '</div></div>';

        root.onclick = function (e) {
          var g = e.target.closest('[data-go]'); if (g) { TN.go(g.dataset.go); return; }
          var t = e.target.closest('[data-trx]');
          if (t) { var tr = list.find(function (x) { return x.id === t.dataset.trx; }); if (tr) TN.showReceipt(tr, { onChange: function () { TN.pages.beranda.render(root); } }); return; }
          if (e.target.closest('[data-act="backup"]')) TN.pages.pengaturan.backup().then(function () { TN.pages.beranda.render(root); });
        };
      });
    }
  };

  /* ================= TRANSAKSI ================= */
  var tf = { from: null, to: null };

  TN.pages.transaksi = {
    title: 'Transaksi',
    render: function (root) {
      var owner = TN.auth.isOwner(), today = u.dk();
      if (!owner || !tf.from) { tf.from = today; tf.to = today; }

      function load() {
        L.trxRange(tf.from, tf.to).then(function (list) {
          var s = L.summarize(list);
          var range = tf.from === tf.to ? u.weekdayLabel(tf.from) : u.dateLabel(tf.from) + ' – ' + u.dateLabel(tf.to);
          root.innerHTML = '<div class="stack stack--lg">' +
            '<div class="toolbar">' + (owner ?
              '<div class="row"><label class="field field--inline"><span>Dari</span><input type="date" class="input" id="from" value="' + tf.from + '" max="' + today + '"></label>' +
              '<label class="field field--inline"><span>Sampai</span><input type="date" class="input" id="to" value="' + tf.to + '" max="' + today + '"></label>' +
              '<button class="btn btn--ghost" data-q="today">Hari ini</button><button class="btn btn--ghost" data-q="yest">Kemarin</button></div>' :
              '<div><strong>Hari ini</strong><div class="muted">' + esc(range) + '</div></div>') +
            '<div class="toolbar__sum"><span><b>' + s.count + '</b> transaksi</span><span><b>' + u.rp(s.revenue) + '</b></span></div></div>' +
            '<section class="card">' + (list.length ? '<div class="tlist">' + list.map(trxRow).join('') + '</div>' : ui.empty('Tidak ada transaksi', 'Pada ' + range + '.')) + '</section></div>';

          root.onclick = function (e) {
            var t = e.target.closest('[data-trx]');
            if (t) { var tr = list.find(function (x) { return x.id === t.dataset.trx; }); if (tr) TN.showReceipt(tr, { onChange: load }); return; }
            var q = e.target.closest('[data-q]');
            if (q) { tf.from = tf.to = (q.dataset.q === 'today' ? today : u.addDays(today, -1)); load(); }
          };
          root.onchange = function (e) {
            if (e.target.id === 'from' || e.target.id === 'to') {
              var f = root.querySelector('#from').value || today, t2 = root.querySelector('#to').value || today;
              if (f > t2) { var x = f; f = t2; t2 = x; }
              tf.from = f; tf.to = t2; load();
            }
          };
        });
      }
      load();
    }
  };
})(window.TN);
