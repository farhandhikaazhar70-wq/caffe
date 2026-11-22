'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 12: halaman Pengaturan
   (toko, pembayaran, pengguna, cadangan, reset)
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, L = TN.logic, db = TN.db, esc = u.esc;
  var root = null;
  var P = TN.pages.pengaturan = { title: 'Pengaturan' };

  P.backup = function () {
    return L.exportAll().then(function (data) {
      u.download('toos-ngopi-cadangan-' + u.dk() + '.json', JSON.stringify(data), 'application/json');
      TN.S.settings.lastBackup = Date.now();
      return L.save('settings');
    }).then(function () { ui.toast('Cadangan diunduh', 'ok'); });
  };

  function resizeImage(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var r = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/png'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('File gambar tidak bisa dibaca')); };
      img.src = url;
    });
  }

  function openUser(usr) {
    var isNew = !usr, me = TN.auth.current();
    var x = usr ? Object.assign({}, usr) : { id: 'u-' + u.uid(), name: '', pin: '', role: 'kasir' };
    var m = ui.modal({
      title: isNew ? 'Tambah pengguna' : 'Ubah pengguna', size: 'sm',
      body: '<form id="uForm" class="stack"><label class="field"><span>Nama</span><input class="input" name="name" required maxlength="20" value="' + esc(x.name) + '" autocomplete="off"></label>' +
        '<label class="field"><span>Peran</span><select class="select" name="role"><option value="kasir"' + (x.role === 'kasir' ? ' selected' : '') + '>Kasir (Beranda, Kasir, Transaksi hari ini)</option><option value="owner"' + (x.role === 'owner' ? ' selected' : '') + '>Owner (semua akses)</option></select></label>' +
        '<label class="field"><span>PIN (4 angka)</span><input class="input" name="pin" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="' + esc(x.pin) + '" autocomplete="off"></label></form>',
      foot: (!isNew && x.id !== me.id ? '<button type="button" class="btn btn--danger btn--left" id="delU">Hapus</button>' : '') + '<button type="button" class="btn btn--ghost" data-close>Batal</button><button type="submit" form="uForm" class="btn btn--primary">Simpan</button>'
    });
    var f = m.el.querySelector('#uForm');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.elements.name.value.trim(), pin = f.elements.pin.value.trim(), role = f.elements.role.value;
      if (!/^\d{4}$/.test(pin)) { ui.toast('PIN harus 4 angka', 'bad'); return; }
      if (TN.S.users.some(function (o) { return o.id !== x.id && o.name.toLowerCase() === name.toLowerCase(); })) { ui.toast('Nama pengguna sudah dipakai', 'bad'); return; }
      if (!isNew && x.role === 'owner' && role !== 'owner' && TN.S.users.filter(function (o) { return o.role === 'owner'; }).length < 2) { ui.toast('Harus ada minimal satu Owner', 'bad'); return; }
      var pinChanged = isNew || pin !== x.pin;
      x.name = name; x.pin = pin; x.role = role;
      if (isNew) TN.S.users.push(x); else TN.S.users[TN.S.users.findIndex(function (o) { return o.id === x.id; })] = x;
      if (pinChanged && x.role === 'owner' && TN.S.settings.defaultPin && pin !== '1234') TN.S.settings.defaultPin = false;
      Promise.all([L.save('users'), L.save('settings')]).then(function () { m.close(); ui.toast('Pengguna disimpan', 'ok'); TN.refreshChrome(); draw(); });
    });
    var del = m.el.querySelector('#delU');
    if (del) del.addEventListener('click', function () {
      ui.confirm({ title: 'Hapus pengguna?', message: '"' + x.name + '" tidak akan bisa masuk lagi.', ok: 'Hapus', danger: true }).then(function (y) {
        if (!y) return;
        if (x.role === 'owner' && TN.S.users.filter(function (o) { return o.role === 'owner'; }).length < 2) { ui.toast('Harus ada minimal satu Owner', 'bad'); return; }
        TN.S.users = TN.S.users.filter(function (o) { return o.id !== x.id; });
        L.save('users').then(function () { m.close(); draw(); });
      });
    });
  }

  function draw() {
    var st = TN.S.settings, me = TN.auth.current();
    var lastB = st.lastBackup ? u.dateTime(st.lastBackup) : 'belum pernah';
    root.innerHTML = '<div class="stack stack--lg">' +
      (st.defaultPin ? '<div class="banner banner--warn">' + ui.icon('alert', 20) + '<span>PIN Owner masih bawaan (1234). Ganti lewat bagian Pengguna di bawah.</span></div>' : '') +

      '<section class="card"><div class="card__head"><h3>Toko & struk</h3></div><form id="fStore" class="stack"><div class="grid2">' +
      '<label class="field"><span>Nama toko</span><input class="input" name="name" required maxlength="40" value="' + esc(st.name) + '"></label>' +
      '<label class="field"><span>Telepon</span><input class="input" name="phone" maxlength="30" value="' + esc(st.phone) + '"></label>' +
      '<label class="field"><span>Alamat</span><input class="input" name="address" maxlength="120" value="' + esc(st.address) + '"></label>' +
      '<label class="field"><span>Pajak (%)</span><input class="input" name="taxPct" type="number" min="0" max="100" step="any" value="' + st.taxPct + '"></label></div>' +
      '<label class="field"><span>Pesan di bawah struk</span><input class="input" name="footer" maxlength="80" value="' + esc(st.footer) + '"></label>' +
      '<label class="check"><input type="checkbox" name="blockShort"' + (st.blockShort ? ' checked' : '') + '><span>Blokir penjualan jika stok bahan tidak cukup <span class="muted">(jika mati: tetap bisa jual, hanya diberi peringatan)</span></span></label>' +
      '<div><button class="btn btn--primary" type="submit">Simpan</button></div></form></section>' +

      '<section class="card"><div class="card__head"><h3>Pembayaran non-tunai</h3></div><form id="fPay" class="stack">' +
      '<div class="qrset">' + (st.qrisImage ? '<img src="' + esc(st.qrisImage) + '" alt="QRIS saat ini">' : '<div class="qrset__ph">Belum ada QRIS</div>') +
      '<div class="stack"><div class="btnrow"><button type="button" class="btn btn--ghost" id="qrPick">' + ui.icon('upload', 18) + ' Unggah gambar QRIS</button>' + (st.qrisImage ? '<button type="button" class="btn btn--ghost" id="qrDel">Hapus</button>' : '') + '</div><input type="file" id="qrFile" accept="image/*" hidden><p class="hint">Gambar QRIS toko Anda akan tampil di layar pembayaran.</p></div></div>' +
      '<label class="field"><span>Info rekening transfer</span><textarea class="input" name="bankInfo" rows="3" maxlength="300" placeholder="Contoh: BCA 1234567890 a.n. Toos Ngopi">' + esc(st.bankInfo) + '</textarea></label>' +
      '<div><button class="btn btn--primary" type="submit">Simpan</button></div></form></section>' +

      '<section class="card"><div class="card__head"><h3>Pengguna</h3><button class="btn btn--ghost btn--sm" data-adduser>' + ui.icon('plus', 16) + ' Tambah</button></div>' +
      '<ul class="list list--plain">' + TN.S.users.map(function (x) {
        return '<li><span><strong>' + esc(x.name) + '</strong> <span class="badge ' + (x.role === 'owner' ? 'badge--ok' : 'badge--muted') + '">' + (x.role === 'owner' ? 'Owner' : 'Kasir') + '</span>' + (x.id === me.id ? ' <span class="muted small">(Anda)</span>' : '') + '</span><button class="btn btn--ghost btn--sm" data-user="' + esc(x.id) + '">' + ui.icon('edit', 16) + ' Ubah</button></li>';
      }).join('') + '</ul></section>' +

      '<section class="card"><div class="card__head"><h3>Cadangan data</h3></div>' +
      '<p class="muted">Data tersimpan di browser perangkat ini. Unduh cadangan secara rutin (misalnya tiap tutup toko) dan simpan di Google Drive / kirim ke WhatsApp. Terakhir dicadangkan: <b>' + esc(lastB) + '</b>.</p>' +
      '<div class="btnrow"><button class="btn btn--primary" data-act="backup">' + ui.icon('download', 18) + ' Unduh cadangan</button>' +
      '<button class="btn btn--ghost" data-act="restore">' + ui.icon('upload', 18) + ' Pulihkan dari cadangan</button><input type="file" id="restoreFile" accept="application/json,.json" hidden></div>' +
      '<p class="hint" id="persistInfo"></p></section>' +

      '<section class="card card--danger"><div class="card__head"><h3>Zona hapus data</h3></div>' +
      '<p class="muted">Gunakan setelah masa uji coba. Unduh cadangan dulu.</p><div class="btnrow">' +
      '<button class="btn btn--danger" data-act="clearTrx">Hapus semua transaksi & riwayat stok</button>' +
      '<button class="btn btn--danger" data-act="clearMenu">Kosongkan menu & bahan contoh</button></div></section></div>';

    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) {
      var el = root.querySelector('#persistInfo');
      if (el) el.textContent = p ? 'Penyimpanan permanen aktif: browser tidak akan menghapus data otomatis.' : 'Tips: pasang aplikasi ke layar utama (Install) agar browser lebih jarang membersihkan data.';
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    var f = e.target, st = TN.S.settings;
    if (f.id === 'fStore') {
      st.name = f.elements.name.value.trim() || 'TOOS NGOPI'; st.phone = f.elements.phone.value.trim(); st.address = f.elements.address.value.trim();
      st.footer = f.elements.footer.value.trim(); st.taxPct = Math.min(Math.max(parseFloat(f.elements.taxPct.value) || 0, 0), 100);
      st.blockShort = f.elements.blockShort.checked;
    } else if (f.id === 'fPay') { st.bankInfo = f.elements.bankInfo.value.trim(); }
    else return;
    L.save('settings').then(function () { ui.toast('Pengaturan disimpan', 'ok'); TN.refreshChrome(); });
  }

  function onClick(e) {
    var a = e.target.closest('[data-act]'), usr = e.target.closest('[data-user]');
    if (e.target.closest('[data-adduser]')) { openUser(null); return; }
    if (usr) { openUser(TN.S.users.find(function (x) { return x.id === usr.dataset.user; })); return; }
    if (e.target.closest('#qrPick')) { root.querySelector('#qrFile').click(); return; }
    if (e.target.closest('#qrDel')) { TN.S.settings.qrisImage = ''; L.save('settings').then(draw); return; }
    if (!a) return;
    var act = a.dataset.act;
    if (act === 'backup') P.backup().then(draw).catch(function (er) { ui.toast('Gagal: ' + er.message, 'bad'); });
    else if (act === 'restore') root.querySelector('#restoreFile').click();
    else if (act === 'clearTrx') {
      ui.typeConfirm({ title: 'Hapus semua transaksi?', message: 'Seluruh transaksi dan riwayat stok akan dihapus permanen. Stok bahan saat ini tidak berubah.' }).then(function (y) {
        if (y) L.clearTransactions().then(function () { ui.toast('Transaksi dihapus', 'ok'); });
      });
    } else if (act === 'clearMenu') {
      ui.typeConfirm({ title: 'Kosongkan menu & bahan?', message: 'Semua menu, resep, dan bahan baku akan dihapus supaya Anda bisa mengisi data sendiri. Transaksi lama tetap tersimpan.' }).then(function (y) {
        if (!y) return;
        TN.S.products = []; TN.S.ingredients = []; TN.S.settings.sampleData = false; TN.pos.cart = [];
        Promise.all([L.save('products'), L.save('ingredients'), L.save('settings')]).then(function () { ui.toast('Menu & bahan dikosongkan', 'ok'); });
      });
    }
  }

  function onChange(e) {
    if (e.target.id === 'qrFile' && e.target.files[0]) {
      resizeImage(e.target.files[0], 800).then(function (url) { TN.S.settings.qrisImage = url; return L.save('settings'); }).then(function () { ui.toast('QRIS tersimpan', 'ok'); draw(); })
        .catch(function (er) { ui.toast(er.message, 'bad'); });
    }
    if (e.target.id === 'restoreFile' && e.target.files[0]) {
      var file = e.target.files[0]; e.target.value = '';
      file.text().then(function (txt) {
        var data; try { data = JSON.parse(txt); } catch (er) { ui.toast('File bukan JSON yang valid', 'bad'); return; }
        if (!L.validateBackup(data)) { ui.toast('Ini bukan file cadangan TOOS NGOPI POS yang valid', 'bad'); return; }
        return ui.confirm({ title: 'Pulihkan cadangan?', html: '<p class="msg">Cadangan berisi <b>' + data.trx.length + '</b> transaksi, <b>' + data.kv.products.length + '</b> menu, <b>' + data.kv.ingredients.length + '</b> bahan.<br><br>Semua data di perangkat ini akan <b>diganti</b>.</p>', ok: 'Pulihkan', danger: true }).then(function (y) {
          if (!y) return;
          return L.importAll(data).then(function () {
            if (!TN.auth.current()) { TN.auth.logout(); location.reload(); return; }
            ui.toast('Cadangan dipulihkan', 'ok'); TN.refreshChrome(); draw();
          });
        });
      }).catch(function (er) { ui.toast('Gagal memulihkan: ' + er.message, 'bad'); });
    }
  }

  P.render = function (el) {
    root = el; draw();
    el.onsubmit = onSubmit; el.onclick = onClick; el.onchange = onChange;
  };
})(window.TN);
