/* Dilan — menampilkan timer, tenggat, dan pengingat di "pulau" Dilan pada laptop Windows.
   Dilan adalah aplikasi kecil di tengah atas layar; ia menerima pesan lewat ws://127.0.0.1:47615 (PROTOKOL Dilan §7).

   Cara pakai: <script src="dilan.js" data-aplikasi="niras" defer></script>   (atau data-aplikasi="ofa")

   Modul ini membaca data aplikasi di penyimpanan browser (localStorage) dan tidak mengubahnya sendiri. Satu-satunya
   penulisan: ketikan dari Dilan (Ctrl+Alt+Q) diteruskan ke jadwal atau Catatan One for All lewat window.OfaDilan (app.js),
   atau dititipkan untuk Bank ide Lei Stuff ("i: …", kunci 'dilan-ke-leistuff-v1').
   Di HP atau bila Dilan tidak berjalan, modul ini diam: tidak ada pesan, tidak ada notifikasi. */
(function () {
  'use strict';

  const skrip = document.currentScript;
  const APLIKASI = (skrip && skrip.dataset.aplikasi) || '';
  const ALAMAT = 'ws://127.0.0.1:47615/';
  const COBA_LAGI_MS = 20000;   // Dilan belum menyala: coba lagi diam-diam
  const PERIKSA_MS = 5000;      // periksa perubahan data aplikasi

  // Dilan hanya ada di Windows. Di HP jangan mencoba sama sekali (Chrome bisa meminta izin jaringan lokal).
  if (!/Windows/i.test(navigator.userAgent) || !('WebSocket' in window)) return;
  if (!/^https?:$/.test(location.protocol)) return;

  /* ---------- bantuan waktu ---------- */
  const dua = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
  /** Waktu lokal dengan zona, mis. 2026-11-21T20:15:00+07:00 (Dilan menghitung mundur sendiri dari sini). */
  function iso(d) {
    const z = -d.getTimezoneOffset();
    const tanda = z >= 0 ? '+' : '-';
    const a = Math.abs(z);
    return `${ymd(d)}T${dua(d.getHours())}:${dua(d.getMinutes())}:${dua(d.getSeconds())}${tanda}${dua(Math.floor(a / 60))}:${dua(a % 60)}`;
  }
  function baca(kunci) {
    try { return JSON.parse(localStorage.getItem(kunci) || 'null'); } catch (e) { return null; }
  }
  const potong = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* ---------- Niras: timer jam kerja + tenggat hari ini/telat ---------- */
  function aktivitasNiras() {
    const S = baca('niras.data.v1');
    if (!S || !Array.isArray(S.pekerjaan) || S.contoh === true) return [];
    const klien = (id) => (S.klien || []).find((k) => k.id === id);
    const keluar = [];

    const jalan = S.pekerjaan.find((k) => k.timerMulai);
    if (jalan && !isNaN(new Date(jalan.timerMulai))) {
      const kl = klien(jalan.klienId);
      keluar.push({
        id: 'timer', jenis: 'stopwatch', prioritas: 'berjalan',
        judul: potong(jalan.judul || 'Pekerjaan', 80),
        sub: kl ? potong(kl.nama, 60) + ' · timer kerja' : 'Timer kerja',
        judul_privat: 'Sesi kerja',
        mulai_pada: iso(new Date(jalan.timerMulai))
      });
    }

    const AKTIF = ['antre', 'jalan', 'review', 'revisi'];
    const hariIni = ymd(new Date());
    const kena = S.pekerjaan
      .filter((k) => k.tenggat && AKTIF.indexOf(k.status) >= 0 && k.tenggat <= hariIni)
      .sort((a, b) => b.tenggat.localeCompare(a.tenggat)); // hari ini dulu, lalu yang telat
    if (kena.length) {
      const telat = kena.filter((k) => k.tenggat < hariIni).length;
      const ini = kena.length - telat;
      const ringkas = [ini ? `${ini} tenggat hari ini` : '', telat ? `${telat} telat` : ''].filter(Boolean).join(' · ');
      const k0 = kena[0];
      const kl = klien(k0.klienId);
      keluar.push({
        id: 'tenggat', jenis: 'tenggat', prioritas: 'pengingat',
        judul: kena.length === 1 ? potong(k0.judul || 'Pekerjaan', 80) : ringkas,
        sub: kena.length === 1 ? [kl && potong(kl.nama, 40), ringkas].filter(Boolean).join(' · ') : 'Terdekat: ' + potong(k0.judul || 'Pekerjaan', 60),
        judul_privat: 'Tenggat pekerjaan'
      });
    }
    return keluar;
  }

  /* ---------- One for All: jadwal berjam yang dimulai dalam 60 menit ---------- */
  const OFA_SEBELUM_MS = 60 * 60000;  // muncul 60 menit sebelum jadwal
  const OFA_SESUDAH_MS = 5 * 60000;   // hilang 5 menit setelah jamnya lewat
  function aktivitasOfa() {
    const d = baca('ofa-data-v1');
    if (!d || !Array.isArray(d.tasks)) return [];
    const proyek = (id) => (d.projects || []).find((p) => p.id === id);
    const sekarang = Date.now();
    return d.tasks
      .filter((t) => t && t.date && t.time && !t.done && !t.skipped)
      .map((t) => ({ t, saat: new Date(`${t.date}T${t.time}:00`) }))
      .filter((x) => !isNaN(x.saat) && x.saat - sekarang <= OFA_SEBELUM_MS && sekarang - x.saat <= OFA_SESUDAH_MS)
      .sort((a, b) => a.saat - b.saat)
      .slice(0, 3)
      .map(({ t, saat }) => {
        const p = proyek(t.projectId);
        return {
          id: 'jadwal-' + String(t.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50),
          jenis: 'pengingat', prioritas: 'pengingat',
          judul: potong(t.title || 'Jadwal', 80),
          sub: [p && potong(p.name, 30), `pukul ${t.time.replace(':', '.')}`].filter(Boolean).join(' · '),
          judul_privat: 'Jadwal',
          selesai_pada: iso(saat)
        };
      });
  }

  /* ---------- One for All: menerima ketikan dari Dilan ---------- */
  /** Teks Markdown dari Dilan → baris pertama untuk catat cepat, sisanya catatan; tautan dari sumber bila ada. */
  function uraiKetikan(m) {
    const baris = String(m.teks || '').split('\n');
    let i = baris.findIndex((b) => b.trim());
    if (i < 0) i = 0;
    const pertama = (baris[i] || '').replace(/^\s*(?:- \[ \]\s*|>\s*)/, '').trim();
    const sisa = baris.slice(i + 1).join('\n').trim();
    const url = /^https?:\/\//i.test(m.sumber || '') ? m.sumber : ((m.teks || '').match(/https?:\/\/[^\s)\]>]+/) || [''])[0];
    const catatan = m.jenis === 'kutipan' ? String(m.teks || '').trim() : (sisa === url ? '' : sisa);
    return { teks: pertama, catatan, tautan: url };
  }
  /** "c: …" atau "catatan: …" (juga kutipan Ctrl+Alt+K dan tautan Ctrl+Alt+W) masuk ke Catatan, bukan jadwal. */
  const AWALAN_CATATAN = /^\s*(?:c|catatan)\s*:\s*/i;
  function keCatatan(m) {
    const mentah = String(m.teks || '');
    if (AWALAN_CATATAN.test(mentah)) return mentah.replace(AWALAN_CATATAN, '').trim();
    if (m.jenis === 'kutipan') return mentah.replace(/^> ?/gm, '').trim();   // catatan OfA teks biasa, tanpa tanda kutip Markdown
    if (m.jenis === 'tautan') return mentah.trim();
    return null;
  }
  /** "i: …" atau "ide: …" → Bank ide Lei Stuff. Lei Stuff aplikasi lain di alamat yang sama, jadi ide dititipkan di
      penyimpanan browser ('dilan-ke-leistuff-v1') dan diambil Lei Stuff saat dibuka (atau langsung, bila sedang terbuka). */
  const AWALAN_IDE = /^\s*(?:i|ide)\s*:\s*/i;
  const KOTAK_IDE = 'dilan-ke-leistuff-v1';
  function titipIde(teks) {
    let box = baca(KOTAK_IDE);
    if (!box || !Array.isArray(box.ide)) box = { v: 1, ide: [] };
    box.ide.push({ id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: teks, at: Date.now() });
    box.ide = box.ide.slice(-200);
    localStorage.setItem(KOTAK_IDE, JSON.stringify(box));
  }
  function tangkapOfa(m) {
    const balas = (tipe, teks) => ({ tipe, nomor: m.nomor, teks });
    const mentah = String(m.teks || '');
    if (AWALAN_IDE.test(mentah)) {
      const ide = mentah.replace(AWALAN_IDE, '').trim();
      if (!m.kirim) return balas('pratinjau', ide ? 'Ide baru untuk Lei Stuff: ' + potong(ide, 70) : 'Tulis idenya');
      if (!ide) return balas('gagal', 'Tulis dulu idenya');
      try { titipIde(ide); } catch (e) { return balas('gagal', 'Ide gagal disimpan'); }
      return balas('diterima', 'Ide ke Lei Stuff: ' + potong(ide, 50));
    }
    const O = window.OfaDilan;
    if (!O) return balas(m.kirim ? 'gagal' : 'pratinjau', 'Muat ulang tab One for All dulu');
    const isiCatatan = keCatatan(m);
    if (isiCatatan !== null) {
      if (!O.catatan) return balas(m.kirim ? 'gagal' : 'pratinjau', 'Muat ulang tab One for All dulu');
      if (!m.kirim) return balas('pratinjau', isiCatatan ? 'Catatan baru: ' + potong(isiCatatan.split('\n')[0], 70) : 'Tulis isi catatannya');
      const hc = O.catatan(isiCatatan);
      return hc.ok ? balas('diterima', hc.teks) : balas('gagal', hc.teks);
    }
    const u = uraiKetikan(m);
    if (!m.kirim) return balas('pratinjau', O.pratinjau(u.teks) || 'Tulis apa yang mau dicatat');
    const h = O.catat(u.teks, u.catatan, u.tautan);
    return h.ok ? balas('diterima', h.teks) : balas('gagal', h.teks);
  }

  const PROFIL = {
    niras: { nama: 'Niras', ikon: { huruf: 'N', warna: '#0F5F4E' }, ambil: aktivitasNiras },
    ofa: {
      nama: 'One for All', ikon: { huruf: 'O', warna: '#B5733F' }, ambil: aktivitasOfa,
      // Ketikan di Dilan (Ctrl+Alt+Q) jadi jadwal OfA; "c: …" jadi catatan; "i: …" jadi ide di Lei Stuff. Tanpa awalan bila OfA satu-satunya penerima; "/o" bila ada beberapa.
      daftar: { langganan: ['tangkap'], awalan_tangkap: '/o' },
      tangkap: tangkapOfa
    }
  };
  const profil = PROFIL[APLIKASI];
  if (!profil) return;

  /* ---------- sambungan ---------- */
  let ws = null;
  let siap = false;                 // sudah diterima_daftar
  let terkirim = new Map();         // id → JSON terakhir yang dikirim
  let tundaUlang = null;

  function kirim(pesan) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ v: 1 }, pesan)));
  }

  function selaraskan() {
    if (!siap) return;
    let daftar;
    try { daftar = profil.ambil(); } catch (e) { return; }
    const baru = new Map(daftar.map((a) => [a.id, JSON.stringify(a)]));
    terkirim.forEach((_, id) => { if (!baru.has(id)) kirim({ tipe: 'hapus', id }); });
    baru.forEach((json, id) => {
      if (terkirim.get(id) !== json) kirim(Object.assign({ tipe: 'aktivitas' }, JSON.parse(json)));
    });
    terkirim = baru;
  }

  function sambung() {
    clearTimeout(tundaUlang);
    try { ws = new WebSocket(ALAMAT); } catch (e) { jadwalkanUlang(); return; }
    ws.onopen = () => {
      siap = false;
      terkirim = new Map();
      kirim(Object.assign({ tipe: 'daftar', aplikasi: APLIKASI, nama: profil.nama, ikon: profil.ikon }, profil.daftar || {}));
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (m.tipe === 'diterima_daftar') { siap = true; selaraskan(); }
      else if (m.tipe === 'tangkap' && profil.tangkap && Number.isInteger(m.nomor)) {
        let jawab;
        try { jawab = profil.tangkap(m); } catch (er) { jawab = { tipe: m.kirim ? 'gagal' : 'pratinjau', nomor: m.nomor, teks: 'Gagal mencatat' }; }
        kirim(jawab);
      }
      else if (m.tipe === 'galat' && window.console) console.warn('[Dilan]', m.kode, m.pesan);
    };
    ws.onclose = () => { ws = null; siap = false; jadwalkanUlang(); };
    ws.onerror = () => { /* onclose menyusul */ };
  }
  function jadwalkanUlang() {
    clearTimeout(tundaUlang);
    tundaUlang = setTimeout(sambung, COBA_LAGI_MS);
  }

  setInterval(selaraskan, PERIKSA_MS);
  window.addEventListener('storage', selaraskan);           // berubah dari tab lain
  document.addEventListener('visibilitychange', selaraskan);
  sambung();
})();
