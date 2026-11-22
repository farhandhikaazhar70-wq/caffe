'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 11: halaman Laporan
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, L = TN.logic, esc = u.esc;
  var st = { preset: '7d', from: null, to: null };

  function range(preset) {
    var t = u.dk();
    if (preset === 'today') return [t, t];
    if (preset === '7d') return [u.addDays(t, -6), t];
    if (preset === '30d') return [u.addDays(t, -29), t];
    if (preset === 'month') return [u.monthStart(t), t];
    if (preset === 'lastmonth') {
      var d = u.fromDk(u.monthStart(t)); d.setDate(0);
      return [u.monthStart(u.dk(d)), u.dk(d)];
    }
    return [st.from || t, st.to || t];
  }

  function compact(v) {
    if (v >= 1e6) return (Math.round(v / 1e5) / 10).toString().replace('.', ',') + ' jt';
    if (v >= 1e3) return Math.round(v / 1e3) + ' rb';
    return String(Math.round(v));
  }

  // Grafik batang SVG sederhana
  function barChart(data, title) {
    var W = 720, H = 240, pl = 44, pb = 28, pt = 12, pr = 8;
    var max = Math.max.apply(null, data.map(function (d) { return d.v; }).concat([1]));
    var step = Math.pow(10, Math.floor(Math.log10(max)));
    var top = Math.ceil(max / step) * step;
    if (top / step < 2) top = step * 2;
    var cw = (W - pl - pr) / data.length, bw = Math.min(cw * 0.7, 46);
    var every = Math.ceil(data.length / 14);
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(title) + '" preserveAspectRatio="xMidYMid meet">';
    for (var g = 0; g <= 4; g++) {
      var y = pt + (H - pt - pb) * (1 - g / 4);
      s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" class="chart__grid"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="chart__tick">' + compact(top * g / 4) + '</text>';
    }
    data.forEach(function (d, i) {
      var h = (H - pt - pb) * (d.v / top), x = pl + cw * i + (cw - bw) / 2, y2 = H - pb - h;
      s += '<g><title>' + esc(d.tip) + '</title><rect x="' + x + '" y="' + y2 + '" width="' + bw + '" height="' + Math.max(h, d.v > 0 ? 2 : 0) + '" rx="3" class="chart__bar"/></g>';
      if (i % every === 0) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" class="chart__tick">' + esc(d.label) + '</text>';
    });
    return s + '</svg>';
  }

  function chartData(s, from, to) {
    var out = [], i;
    if (from === to) {
      for (i = 0; i < 24; i++) out.push({ label: u.pad(i, 2), v: s.hours[i], tip: u.pad(i, 2) + ':00 – ' + u.rp(s.hours[i]) });
      return { data: out, title: 'Penjualan per jam' };
    }
    var days = Math.round((u.fromDk(to) - u.fromDk(from)) / 86400000) + 1;
    if (days > 92) {
      var months = {};
      Object.keys(s.days).forEach(function (k) { var mk = k.slice(0, 7); months[mk] = (months[mk] || 0) + s.days[k].revenue; });
      Object.keys(months).sort().forEach(function (mk) { out.push({ label: mk.slice(5) + '/' + mk.slice(2, 4), v: months[mk], tip: mk + ' – ' + u.rp(months[mk]) }); });
      return { data: out.length ? out : [{ label: '-', v: 0, tip: '' }], title: 'Penjualan per bulan' };
    }
    for (i = 0; i < days; i++) {
      var k = u.addDays(from, i), d = s.days[k];
      out.push({ label: u.dayMonth(k), v: d ? d.revenue : 0, tip: u.dateLabel(k) + ' – ' + u.rp(d ? d.revenue : 0) });
    }
    return { data: out, title: 'Penjualan per hari' };
  }

  function shareRows(map, names) {
    var total = Object.keys(map).reduce(function (a, k) { return a + map[k].total; }, 0);
    var keys = Object.keys(map).sort(function (a, b) { return map[b].total - map[a].total; });
    if (!keys.length) return '<p class="muted pad">Belum ada data.</p>';
    return '<ul class="share">' + keys.map(function (k) {
      var pct = total ? map[k].total / total : 0;
      return '<li><div class="share__top"><span>' + esc(names ? (names[k] || k) : k) + ' <span class="muted">(' + map[k].count + ')</span></span><strong>' + u.rp(map[k].total) + '</strong></div><div class="share__bar"><i style="width:' + Math.round(pct * 100) + '%"></i></div></li>';
    }).join('') + '</ul>';
  }

  function exportCSV(list, from, to) {
    var rows = [['No', 'Tanggal', 'Jam', 'Kasir', 'Tipe', 'Atas nama', 'Status', 'Metode', 'Menu', 'Qty', 'Harga satuan', 'Subtotal item', 'HPP satuan', 'Diskon transaksi', 'Pajak transaksi', 'Total transaksi']];
    list.slice().reverse().forEach(function (t) {
      t.items.forEach(function (it, idx) {
        rows.push([t.no, t.dk, u.time(t.ts), t.cashier, TN.TYPE[t.type] || t.type, t.customer, t.status === 'void' ? 'Batal' : 'Selesai', TN.METHOD[t.method] || t.method,
          it.name, it.qty, it.price, it.price * it.qty, it.cost == null ? '' : Math.round(it.cost), idx === 0 ? t.discount.amount : '', idx === 0 ? t.tax : '', idx === 0 ? t.total : '']);
      });
    });
    u.download('toos-ngopi-laporan-' + from + '_sd_' + to + '.csv', u.csv(rows), 'text/csv;charset=utf-8');
  }

  TN.pages.laporan = {
    title: 'Laporan',
    render: function (root) {
      var r = range(st.preset); st.from = r[0]; st.to = r[1];
      var today = u.dk();
      var presets = [['today', 'Hari ini'], ['7d', '7 hari'], ['30d', '30 hari'], ['month', 'Bulan ini'], ['lastmonth', 'Bulan lalu'], ['custom', 'Pilih tanggal']];

      L.trxRange(st.from, st.to).then(function (list) {
        var s = L.summarize(list), cd = chartData(s, st.from, st.to);
        var prods = Object.keys(s.products).map(function (k) { return s.products[k]; }).sort(function (a, b) { return b.qty - a.qty; });
        var label = st.from === st.to ? u.dateLabel(st.from) : u.dateLabel(st.from) + ' – ' + u.dateLabel(st.to);

        root.innerHTML = '<div class="stack stack--lg">' +
          '<div class="toolbar"><div class="chips">' + presets.map(function (p) { return '<button class="chip' + (st.preset === p[0] ? ' is-on' : '') + '" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
          '<button class="btn btn--ghost" data-csv' + (list.length ? '' : ' disabled') + '>' + ui.icon('download', 18) + ' Unduh CSV</button></div>' +
          (st.preset === 'custom' ? '<div class="row"><label class="field field--inline"><span>Dari</span><input type="date" class="input" id="rf" value="' + st.from + '" max="' + today + '"></label><label class="field field--inline"><span>Sampai</span><input type="date" class="input" id="rt" value="' + st.to + '" max="' + today + '"></label></div>' : '') +
          '<p class="muted">Periode: <b>' + esc(label) + '</b></p>' +
          '<div class="stats">' +
          '<div class="stat"><div class="stat__label">Omzet</div><div class="stat__value">' + u.rp(s.revenue) + '</div><div class="stat__sub">rata-rata ' + u.rp(s.avg) + ' / transaksi</div></div>' +
          '<div class="stat"><div class="stat__label">Transaksi</div><div class="stat__value">' + u.num(s.count) + '</div><div class="stat__sub">' + (s.voidCount ? s.voidCount + ' dibatalkan (' + u.rp(s.voidTotal) + ')' : 'tidak ada pembatalan') + '</div></div>' +
          '<div class="stat"><div class="stat__label">Item terjual</div><div class="stat__value">' + u.num(s.items) + '</div><div class="stat__sub">diskon ' + u.rp(s.discount) + '</div></div>' +
          '<div class="stat"><div class="stat__label">Laba kotor</div><div class="stat__value">' + (s.costedCount ? u.rp(s.profit) : '<span class="muted">–</span>') + '</div><div class="stat__sub">' +
          (s.costedCount ? 'margin ' + Math.round(s.margin * 100) + '% · HPP ' + u.rp(s.cost) + (s.costedCount < s.count ? '<br>dihitung dari ' + s.costedCount + ' dari ' + s.count + ' transaksi yang HPP-nya lengkap' : '') : 'HPP belum lengkap: isi resep & harga bahan') + '</div></div></div>' +
          '<section class="card"><div class="card__head"><h3>' + esc(cd.title) + '</h3></div>' + (s.count ? barChart(cd.data, cd.title) : ui.empty('Belum ada penjualan', 'Pada periode ini.')) + '</section>' +
          '<div class="cols">' +
          '<section class="card card--flush"><div class="card__head pad"><h3>Menu terlaris</h3></div>' + (prods.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Menu</th><th class="num">Terjual</th><th class="num">Omzet</th><th class="num">Laba</th></tr></thead><tbody>' +
            prods.slice(0, 15).map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="num">' + u.num(p.qty) + '</td><td class="num">' + u.rp(p.revenue) + '</td><td class="num">' + (p.revenueCosted === p.revenue ? u.rp(p.revenue - p.cost) : '<span class="muted">–</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted pad">Belum ada data.</p>') + '</section>' +
          '<div class="stack"><section class="card"><div class="card__head"><h3>Metode pembayaran</h3></div>' + shareRows(s.byMethod, TN.METHOD) + '</section>' +
          '<section class="card"><div class="card__head"><h3>Tipe pesanan</h3></div>' + shareRows(s.byType, TN.TYPE) + '</section>' +
          (Object.keys(s.byCashier).length > 1 ? '<section class="card"><div class="card__head"><h3>Per kasir</h3></div>' + shareRows(s.byCashier) + '</section>' : '') + '</div></div></div>';

        root.onclick = function (e) {
          var p = e.target.closest('[data-p]');
          if (p) { st.preset = p.dataset.p; TN.pages.laporan.render(root); return; }
          if (e.target.closest('[data-csv]')) exportCSV(list, st.from, st.to);
        };
        root.onchange = function (e) {
          if (e.target.id === 'rf' || e.target.id === 'rt') {
            var f = root.querySelector('#rf').value || today, t = root.querySelector('#rt').value || today;
            if (f > t) { var x = f; f = t; t = x; }
            st.from = f; st.to = t; TN.pages.laporan.render(root);
          }
        };
      });
    }
  };
})(window.TN);
