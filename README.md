# Toos Ngopi POS

Aplikasi kasir untuk cafe Toos Ngopi: pesanan, pembayaran (tunai / QRIS / transfer), struk, menu & resep,
stok bahan, laporan, dan cadangan data. Jalan di browser, bisa offline, tanpa server.

## Cara pakai cepat
1. Buka lewat server (tidak bisa langsung klik dua kali `index.html` kalau mau fitur offline/install):
   - Lokal: `python3 -m http.server 8000` lalu buka `http://localhost:8000`
   - Online: upload satu folder ini ke Netlify, Cloudflare Pages, atau GitHub Pages (HTTPS wajib untuk fitur Install).
2. Masuk: pengguna **Owner**, PIN **1234**. Segera ganti di Pengaturan > Pengguna.
3. Di HP/tablet: buka lewat Chrome, lalu menu > "Tambahkan ke layar utama" / Install.

## Isi awal
Bahan baku dan 3 menu (Kopi Susu, Americano, Matcha Latte) beserta resepnya diambil dari data lama.
Harga beli bahan masih kosong, jadi laba kotor baru muncul setelah diisi di Stok > Ubah bahan.
Untuk mulai dari kosong: Pengaturan > Zona hapus data > Kosongkan menu & bahan contoh.

## Hak akses
- **Owner**: semua halaman.
- **Kasir**: Beranda, Kasir, Transaksi hari ini (tanpa laba, tanpa membatalkan transaksi).

## Data
Disimpan di IndexedDB browser pada perangkat yang dipakai. Tiap perangkat punya data sendiri.
Unduh cadangan rutin di Pengaturan > Cadangan data. Cadangan bisa dipulihkan di perangkat lain.
PIN hanya kunci lokal di perangkat, bukan keamanan server.

## Struktur
    index.html, style.css, sw.js, manifest.webmanifest
    js/01-util.js ... 13-app.js   (berurutan, lihat komentar di tiap file)
    img/                          (logo & ikon)
Setelah mengubah file, naikkan `VERSION` di `sw.js` agar perangkat memuat versi baru.
