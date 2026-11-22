/* Service worker: aplikasi tetap bisa dibuka tanpa internet.
   Naikkan VERSION setiap kali file aplikasi diubah. */
var VERSION = 'toos-ngopi-pos-v1';
var FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/01-util.js', './js/02-ui.js', './js/03-db.js', './js/04-logic.js', './js/05-auth.js', './js/06-receipt.js',
  './js/07-page-kasir.js', './js/08-page-beranda-transaksi.js', './js/09-page-menu.js', './js/10-page-stok.js',
  './js/11-page-laporan.js', './js/12-page-pengaturan.js', './js/13-app.js',
  './img/logo.jpeg', './img/favicon.png', './img/icon-192.png', './img/icon-512.png', './img/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Cache dulu, lalu perbarui di latar belakang
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(e.request).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return hit || caches.match('./index.html'); });
    return hit || net;
  }));
});
