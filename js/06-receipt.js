'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 6: struk (tampil & cetak 58mm)
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, esc = u.esc;
  var METHOD = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer' };
  var TYPE = { dine: 'Makan di tempat', take: 'Dibawa pulang' };
  TN.METHOD = METHOD; TN.TYPE = TYPE;

  TN.receiptHTML = function (t) {
    var st = TN.S.settings;
    var rows = t.items.map(function (it) {
      return '<div class="r-row"><span>' + it.qty + '× ' + esc(it.name) + '</span><span>' + u.num(it.price * it.qty) + '</span></div>' +
        (it.note ? '<div class="r-note">' + esc(it.note) + '</div>' : '');
    }).join('');
    return '<div class="receipt">' +
      (t.status === 'void' ? '<div class="r-void">DIBATALKAN</div>' : '') +
      '<div class="r-head"><strong>' + esc(st.name) + '</strong>' +
      (st.address ? '<div>' + esc(st.address) + '</div>' : '') + (st.phone ? '<div>' + esc(st.phone) + '</div>' : '') + '</div>' +
      '<hr>' +
      '<div class="r-row"><span>No. pesanan</span><span>#' + u.pad(t.no, 3) + '</span></div>' +
      '<div class="r-row"><span>Tanggal</span><span>' + esc(u.dateTime(t.ts)) + '</span></div>' +
      '<div class="r-row"><span>Kasir</span><span>' + esc(t.cashier) + '</span></div>' +
      '<div class="r-row"><span>Tipe</span><span>' + esc(TYPE[t.type] || t.type) + '</span></div>' +
      (t.customer ? '<div class="r-row"><span>Atas nama</span><span>' + esc(t.customer) + '</span></div>' : '') +
      '<hr>' + rows + '<hr>' +
      '<div class="r-row"><span>Subtotal</span><span>' + u.num(t.subtotal) + '</span></div>' +
      (t.discount.amount > 0 ? '<div class="r-row"><span>Diskon' + (t.discount.type === 'pct' ? ' ' + t.discount.value + '%' : '') + '</span><span>-' + u.num(t.discount.amount) + '</span></div>' : '') +
      (t.tax > 0 ? '<div class="r-row"><span>Pajak ' + t.taxPct + '%</span><span>' + u.num(t.tax) + '</span></div>' : '') +
      '<div class="r-row r-total"><span>TOTAL</span><span>' + u.rp(t.total) + '</span></div>' +
      '<div class="r-row"><span>' + esc(METHOD[t.method] || t.method) + '</span><span>' + u.rp(t.paid) + '</span></div>' +
      (t.method === 'cash' ? '<div class="r-row"><span>Kembali</span><span>' + u.rp(t.change) + '</span></div>' : '') +
      (t.status === 'void' && t.void ? '<hr><div class="r-note">Dibatalkan ' + esc(u.dateTime(t.void.ts)) + ' oleh ' + esc(t.void.by) + '. Alasan: ' + esc(t.void.reason) + '</div>' : '') +
      '<hr><div class="r-foot">' + esc(st.footer) + '</div></div>';
  };

  TN.print = function (t) {
    var a = document.getElementById('print-area');
    if (!a) { a = document.createElement('div'); a.id = 'print-area'; document.body.appendChild(a); }
    a.innerHTML = TN.receiptHTML(t);
    window.print();
  };

  // opts: { fresh: bool (setelah transaksi baru), onChange: fn (setelah dibatalkan) }
  TN.showReceipt = function (t, opts) {
    opts = opts || {};
    var canVoid = TN.auth.isOwner() && t.status === 'paid' && !opts.fresh;
    var m = ui.modal({
      title: opts.fresh ? 'Pembayaran berhasil' : 'Struk #' + u.pad(t.no, 3), size: 'sm',
      body: (opts.fresh ? '<div class="success">' + ui.icon('check', 28) + '<span>Kembalian <b>' + u.rp(t.change) + '</b></span></div>' : '') + TN.receiptHTML(t),
      foot: (canVoid ? '<button type="button" class="btn btn--danger" data-void>Batalkan transaksi</button>' : '') +
        '<button type="button" class="btn btn--ghost" data-print>' + ui.icon('print', 18) + ' Cetak</button>' +
        '<button type="button" class="btn btn--primary" data-close>' + (opts.fresh ? 'Pesanan baru' : 'Tutup') + '</button>',
      noFocus: true
    });
    m.el.querySelector('[data-print]').addEventListener('click', function () { TN.print(t); });
    var v = m.el.querySelector('[data-void]');
    if (v) v.addEventListener('click', function () {
      ui.ask({ title: 'Batalkan transaksi #' + u.pad(t.no, 3), label: 'Alasan pembatalan', required: true, ok: 'Batalkan transaksi', hint: 'Stok bahan akan dikembalikan otomatis.' }).then(function (reason) {
        if (!reason) return;
        return TN.logic.voidSale(t, reason, TN.auth.current().name).then(function () {
          ui.toast('Transaksi dibatalkan, stok dikembalikan', 'ok');
          m.close();
          if (opts.onChange) opts.onChange();
        });
      }).catch(function (e) { ui.toast('Gagal membatalkan: ' + e.message, 'bad'); });
    });
    return m;
  };
})(window.TN);
