# One for All (OfA) — versi coba 0.1

Pengingat jadwal harian untuk Niras, Lei Stuff, Nira Studio, dan proyek lainnya, ditemani Ofa si kapibara.

## Meluncurkan lewat GitHub Pages (gratis)

1. **Ekstrak** berkas zip ini. Isinya folder `one-for-all`.
2. **Buat repository baru** di GitHub: klik **New**, beri nama `one-for-all`, pilih **Public**, lalu **Create repository**.
   GitHub Pages gratis hanya untuk repository publik. Yang terunggah hanya kode app; jadwalmu tidak ikut, karena jadwal tersimpan di HP-mu sendiri.
3. **Unggah file**: di halaman repository, klik **Add file → Upload files**, lalu seret *semua isi* folder `one-for-all` (termasuk folder `icons`). Klik **Commit changes**.
4. **Nyalakan Pages**: buka **Settings → Pages**. Di bagian *Build and deployment*, pilih **Deploy from a branch**, branch **main**, folder **/ (root)**, lalu **Save**.
5. Tunggu 1–2 menit. Alamat app-mu akan muncul di halaman itu, bentuknya:
   `https://NAMA-AKUN-GITHUB.github.io/one-for-all/`

## Memasang di HP

- **Android (Chrome):** buka alamat tadi → menu **⋮** → **Instal aplikasi**.
- **iPhone (Safari):** buka alamat tadi → tombol **Bagikan** → **Tambahkan ke Layar Utama**.
- Setelah terpasang, buka OfA dari ikon kapibara, lalu tekan **Nyalakan notifikasi**.

## Memperbarui app nanti

Unggah file yang berubah ke repository yang sama, lalu buka `sw.js` dan ganti `const VERSI = 'ofa-v1'` menjadi `'ofa-v2'` (dan seterusnya). Tanpa langkah ini, HP bisa tetap memakai versi lama.

## Catat cepat (tanpa AI, gratis)

| Ketik | Hasil |
| --- | --- |
| `besok abis magrib kirim revisi logo ke klien` | Besok 18.30 · Niras |
| `jumat posting reels jam 7 malam` | Jumat 19.00 · Nira Studio |
| `daftar lomba cerpen 21/11` | 21 November · Lei Stuff |
| `Jumat depan jam 10 rapat #niras` | Jumat minggu depan 10.00 · Niras |

Kata yang dikenali: hari ini, besok, lusa, nama hari (+ "depan"), tanggal (21/11 atau 5 desember), jam (jam 3 sore, 15.30), pagi/siang/sore/malam, dan abis subuh/zuhur/ashar/magrib/isya. Proyek ditebak dari kata kunci (bisa diubah di menu Proyek) atau dipilih dengan tagar `#niras`, `#leistuff`, `#nirastudio`.

## Yang perlu diketahui di versi coba

- **Data tersimpan di perangkat ini saja.** HP dan laptop belum tersinkron. Simpan cadangan secara berkala lewat **Proyek → Cadangan data**.
- **Pengingat muncul selama app terbuka atau masih berjalan di latar.** Untuk jadwal penting, buka jadwalnya lalu tekan **Google Calendar**, supaya Google Calendar ikut mengingatkan meski app tertutup.
- **Bagikan dari Instagram** (postingan lomba langsung jadi formulir Lei Stuff) bekerja di Android setelah app terpasang. Di iPhone, isi jadwalnya lewat tombol +.
- **Tersambung dengan Niras** (sitilutfiyah821.github.io/niras) di perangkat yang sama: tenggat pekerjaan di Niras otomatis jadi jadwal di proyek Niras, dan jadwal OfA di proyek Niras muncul di kotak "Dari Ofa" di Beranda Niras. Berlaku selama keduanya dibuka di browser yang sama (Chrome Android).
- **Tersambung dengan Lei Stuff** (sitilutfiyah821.github.io/lei-stuff) di perangkat yang sama: tiap lomba di Lei Stuff otomatis jadi jadwal di proyek Lei Stuff (batas pendaftaran, batas kirim karya, dan pengumuman). Kalau tanggal atau status lomba diubah di Lei Stuff, jadwalnya ikut berubah; lomba yang dihapus ikut hilang. Lomba yang kamu catat di OfA muncul di kotak "Dari Ofa" di halaman Lomba Lei Stuff, siap dijadikan lomba tanpa menggandakan jadwal.
- Belum ada di versi ini: sinkron antar-perangkat, sambungan otomatis ke Google Calendar, chat dengan Claude, dan WhatsApp. Semua sudah direncanakan di dokumen konsep.

## Isi folder

- `index.html` — tampilan dan gaya app
- `core.js` — logika: catat cepat, suasana hati Ofa, rapor, pengingat
- `app.js` — layar dan tombol
- `sw.js` — supaya app bisa dibuka tanpa internet dan notifikasi bisa diketuk
- `manifest.webmanifest` — nama, ikon, pintasan, dan fitur bagikan
- `icons/` — ikon Ofa
