'use strict';
/* ===========================================================
   TOOS NGOPI POS - Bagian 13: kerangka aplikasi
   (navigasi, peran, sinkron antar-tab, PWA)
   =========================================================== */
(function (TN) {
  var u = TN.u, ui = TN.ui, esc = u.esc;
  var NAV = [
    ['beranda', 'Beranda', 'home'], ['kasir', 'Kasir', 'pos'], ['transaksi', 'Transaksi', 'receipt'],
    ['menu', 'Menu', 'cup'], ['stok', 'Stok', 'box'], ['laporan', 'Laporan', 'chart'], ['pengaturan', 'Pengaturan', 'gear']
  ];
  var app = document.getElementById('app'), current = null;

  function navFor() { return NAV.filter(function (n) { return TN.auth.can(n[0]); }); }
  function pageFromHash() { var h = (location.hash || '').replace(/^#\/?/, ''); return TN.pages[h] ? h : null; }

  TN.go = function (page) { if (location.hash !== '#/' + page) location.hash = '#/' + page; else route(); };

  function shell() {
    var me = TN.auth.current(), items = navFor(), st = TN.S.settings;
    var main = items.slice(0, 4), more = items.slice(4);
    app.innerHTML =
      '<div class="shell"><nav class="rail" aria-label="Menu utama"><div class="rail__brand"><img src="img/logo.jpeg" alt="" width="44" height="44"></div>' +
      '<div class="rail__items">' + items.map(function (n) { return '<a class="rail__item" href="#/' + n[0] + '" data-page="' + n[0] + '">' + ui.icon(n[2], 22) + '<span>' + n[1] + '</span></a>'; }).join('') + '</div>' +
      '<button class="rail__item rail__out" data-logout>' + ui.icon('logout', 22) + '<span>Keluar</span></button></nav>' +
      '<div class="main"><header class="topbar"><div><h1 id="pageTitle"></h1><div class="muted small" id="shopName">' + esc(st.name) + '</div></div>' +
      '<div class="topbar__user"><span class="badge badge--muted">' + esc(me.name) + (me.name.toLowerCase() === (me.role === 'owner' ? 'owner' : 'kasir') ? '' : ' · ' + (me.role === 'owner' ? 'Owner' : 'Kasir')) + '</span><button class="icon-btn" data-logout aria-label="Keluar">' + ui.icon('logout') + '</button></div></header>' +
      '<main id="view" class="view" tabindex="-1"></main></div>' +
      '<nav class="bottomnav" aria-label="Menu utama">' + main.map(function (n) { return '<a href="#/' + n[0] + '" data-page="' + n[0] + '">' + ui.icon(n[2], 22) + '<span>' + n[1] + '</span></a>'; }).join('') +
      (more.length ? '<button type="button" data-more>' + ui.icon('more', 22) + '<span>Lainnya</span></button>' : '') + '</nav></div>';

    app.querySelectorAll('[data-logout]').forEach(function (b) { b.addEventListener('click', logout); });
    var mb = app.querySelector('[data-more]');
    if (mb) mb.addEventListener('click', function () {
      var m = ui.modal({ title: 'Menu lainnya', size: 'sm', body: '<div class="stack">' + more.map(function (n) {
        return '<a class="morelink" href="#/' + n[0] + '" data-close>' + ui.icon(n[2], 20) + ' ' + n[1] + '</a>'; }).join('') + '</div>' });
    });
  }

  function logout() {
    TN.auth.logout(); current = null; start();
  }

  function route() {
    var me = TN.auth.current();
    if (!me) return;
    var page = pageFromHash();
    if (!page || !TN.auth.can(page)) { page = TN.auth.can('beranda') ? 'beranda' : 'kasir'; if (location.hash !== '#/' + page) { history.replaceState(null, '', '#/' + page); } }
    current = page;
    var title = TN.pages[page].title;
    var t = document.getElementById('pageTitle'); if (t) t.textContent = title;
    document.title = title + ' · ' + TN.S.settings.name;
    app.querySelectorAll('[data-page]').forEach(function (a) {
      var on = a.dataset.page === page;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var view = document.getElementById('view');
    view.className = 'view view--' + page;
    view.onclick = view.oninput = view.onchange = view.onsubmit = null;
    TN.pages[page].render(view);
    view.scrollTop = 0;
  }

  // Dipanggil setelah pengaturan/pengguna berubah
  TN.refreshChrome = function () {
    var n = document.getElementById('shopName'); if (n) n.textContent = TN.S.settings.name;
  };

  function afterLogin(user) {
    shell();
    if (!location.hash || !pageFromHash()) history.replaceState(null, '', '#/' + (user.role === 'owner' ? 'beranda' : 'kasir'));
    route();
    if (user.role === 'owner' && TN.S.settings.defaultPin) {
      setTimeout(function () { ui.toast('PIN masih bawaan (1234). Ganti di Pengaturan.', 'warn'); }, 600);
    }
  }

  function start() {
    app.innerHTML = '';
    if (TN.auth.current()) { afterLogin(TN.auth.current()); return; }
    TN.auth.renderLogin(app, function (user) { afterLogin(user); });
  }

  function fatal(err) {
    app.innerHTML = '<div class="login"><div class="login__card"><h1>Penyimpanan tidak tersedia</h1><p class="muted">Aplikasi tidak bisa membuka database di browser ini. Pastikan tidak memakai mode Privat/Incognito dan buka lewat Chrome atau Safari biasa.</p><p class="hint">' + esc(err && err.message) + '</p><button class="btn btn--primary" onclick="location.reload()">Coba lagi</button></div></div>';
  }

  window.addEventListener('hashchange', function () { if (TN.auth.current()) route(); });

  // Jika tab lain mengubah data, muat ulang agar tidak saling menimpa
  TN.db.onRemoteChange(function () {
    if (ui.openModalCount() > 0) return;
    TN.reload().then(function () { if (TN.auth.current() && current && current !== 'kasir') route(); });
  });

  TN.boot = function () {
    TN.load().then(function () {
      TN.db.persist();
      start();
    }).catch(fatal);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache opsional */ });
    }
  };
})(window.TN);
