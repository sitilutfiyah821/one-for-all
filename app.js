/* One for All — tampilan dan interaksi (versi coba, data tersimpan di perangkat). */
(function () {
  'use strict';
  const C = window.OfaCore;
  const KEY = 'ofa-data-v1';
  const VERSI = '0.1 (versi coba)';

  /* ---------- Data ---------- */
  function migrate(d) {
    const base = C.defaultData();
    d.profile = Object.assign(base.profile, d.profile || {});
    d.projects = Array.isArray(d.projects) && d.projects.length ? d.projects : base.projects;
    d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
    d.fired = d.fired || {};
    return d;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { /* data rusak atau penyimpanan tidak tersedia */ }
    return C.defaultData();
  }
  let data = load();

  /* Tandai waktu ubah tiap jadwal & proyek, supaya sinkron tahu mana yang terbaru. */
  const seen = new Map();
  let primed = false;
  function stampChanges(stamp) {
    const t = Date.now();
    for (const [k, list] of [['t', data.tasks], ['p', data.projects]]) {
      for (const x of list) {
        const { updatedAt, ...rest } = x;
        const j = JSON.stringify(rest), key = k + x.id;
        if (stamp && primed && seen.get(key) !== j) x.updatedAt = t;
        seen.set(key, j);
      }
    }
    primed = true;
  }
  stampChanges(false);

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { toast('Gagal menyimpan di perangkat ini.'); }
    updateBadge();
  }
  function save() {
    stampChanges(true);
    persist();
    window.dispatchEvent(new CustomEvent('ofa:saved'));
  }

  const ui = { tab: 'hari', filter: 'all', sheet: null, week: 0 };

  /* ---------- Bantuan ---------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const proj = (id) => data.projects.find((p) => p.id === id);
  const pal = (p) => C.palet(p ? p.color : 'mint');
  const now = () => new Date();
  const today = () => C.ymd(now());
  const byDue = (a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99'));

  const ICONS = {
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    fwd: '<path d="M9 18l6-6-6-6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    gcal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'
  };
  const icon = (n, size, sw) => `<svg width="${size || 22}" height="${size || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

  function reminderText(list) {
    const labels = (list || []).map((r) => (C.PILIHAN_PENGINGAT.find((o) => o.id === r) || {}).label).filter(Boolean)
      .map((l) => (l === 'Tepat waktu' ? 'tepat waktu' : l === 'Pagi hari H' ? 'pagi hari H' : `${l} sebelum`));
    if (!labels.length) return 'Tanpa pengingat';
    if (labels.length === 1) return `Ingatkan ${labels[0]}`;
    return `Ingatkan ${labels.slice(0, -1).join(', ')}, dan ${labels[labels.length - 1]}`;
  }
  const isMuted = (p) => p.mutedUntil && new Date(p.mutedUntil) > now();

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg, actionLabel, actionFn, withOfa) {
    const el = $('#toast');
    el.innerHTML = `${withOfa ? `<span class="toast-ofa">${C.ofaSVG('senang', 30)}</span>` : ''}<span>${esc(msg)}</span>${actionLabel ? `<button type="button" id="toast-act">${esc(actionLabel)}</button>` : ''}`;
    el.hidden = false;
    if (actionLabel) $('#toast-act').onclick = () => { el.hidden = true; actionFn(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 6000 : 3500);
  }

  /* ---------- Bagian-bagian tampilan ---------- */
  function projectChip(p) {
    const c = pal(p);
    return `<span class="chip" style="background:${c.tint};color:${c.ink}">${esc(p ? p.name : 'Tanpa proyek')}</span>`;
  }

  function taskRow(t, opt) {
    opt = opt || {};
    const p = proj(t.projectId);
    const late = opt.late;
    return `<li class="task${t.done ? ' is-done' : ''}${late ? ' late' : ''}">
      <button type="button" class="check" data-act="toggle" data-id="${t.id}" aria-pressed="${t.done ? 'true' : 'false'}" aria-label="${t.done ? 'Batalkan selesai' : 'Tandai selesai'}: ${esc(t.title)}"><span>${t.done ? icon('check', 16, 3) : ''}</span></button>
      <button type="button" class="task-main" data-act="edit" data-id="${t.id}">
        <span class="task-title">${esc(t.title)}</span>
        <span class="task-meta">${projectChip(p)}${opt.showDate || late ? `<span>${esc(C.fmtDateShort(t.date))}</span>` : ''}${t.link ? `<span class="meta-ic" title="Ada tautan">${icon('link', 14)}</span>` : ''}${(t.postponed || 0) >= 2 ? `<span>ditunda ${t.postponed}×</span>` : ''}</span>
      </button>
      <span class="task-time">${t.time ? C.fmtTime(t.time) : '<span class="muted">—</span>'}</span>
      ${late ? `<div class="row-actions">
        <button type="button" class="mini dark" data-act="resched" data-id="${t.id}" data-to="0">Hari ini</button>
        <button type="button" class="mini" data-act="resched" data-id="${t.id}" data-to="1">Besok</button>
        <button type="button" class="mini" data-act="skip" data-id="${t.id}">Lewati</button>
      </div>` : ''}
    </li>`;
  }

  function dotsFor(dateS) {
    const ids = [...new Set(data.tasks.filter((t) => t.date === dateS && !t.skipped).map((t) => t.projectId))].slice(0, 3);
    return ids.map((id) => `<i style="background:${pal(proj(id)).c}"></i>`).join('');
  }

  function weekStrip() {
    const base = C.startOfDay(now());
    let html = '<div class="strip">';
    for (let i = 0; i < 7; i++) {
      const d = C.addDays(base, i), s = C.ymd(d);
      html += `<div class="day${i === 0 ? ' today' : ''}"><small>${C.HARI_PENDEK[d.getDay()]}</small><b>${d.getDate()}</b><span class="dots">${dotsFor(s)}</span></div>`;
    }
    return `${html}</div>`;
  }

  function nearest() {
    const t = today();
    return data.tasks.filter((x) => !x.done && !x.skipped && x.date > t).sort(byDue)[0];
  }

  /* ---------- Layar: Hari ini ---------- */
  function viewToday() {
    const n = now(), t = today();
    const mood = C.computeMood(data, n);
    const todays = data.tasks.filter((x) => x.date === t && !x.skipped);
    const done = todays.filter((x) => x.done).length;
    const pct = todays.length ? Math.round((done / todays.length) * 100) : 0;
    const f = (l) => (ui.filter === 'all' ? l : l.filter((x) => x.projectId === ui.filter));
    const overdue = f(data.tasks.filter((x) => !x.done && !x.skipped && x.date < t && C.daysBetween(C.parseYMD(x.date), n) <= 60)).sort(byDue);
    const list = f(todays).sort((a, b) => (a.done - b.done) || byDue(a, b));
    const in7 = C.ymd(C.addDays(n, 7));
    const soon = f(data.tasks.filter((x) => !x.done && !x.skipped && x.date > t && x.date <= in7)).sort(byDue).slice(0, 4);

    const chips = `<div class="chips" role="group" aria-label="Saring proyek">
      <button type="button" class="chipbtn${ui.filter === 'all' ? ' on' : ''}" data-act="filter" data-id="all" aria-pressed="${ui.filter === 'all'}">Semua</button>
      ${data.projects.map((p) => { const c = pal(p); const on = ui.filter === p.id; return `<button type="button" class="chipbtn" data-act="filter" data-id="${p.id}" aria-pressed="${on}" style="background:${c.tint};color:${c.ink};border-color:${on ? c.ink : 'transparent'}">${esc(p.name)}</button>`; }).join('')}
    </div>`;

    return `
      <header class="top"><div><p class="eyebrow">${esc(C.fmtDateLong(t))}</p><h1>Hari ini</h1></div>
        <button type="button" class="icon-btn" data-act="summary" aria-label="Buka ringkasan">${icon('bell')}</button></header>
      <section class="card hero" aria-label="Pesan Ofa">
        <div class="ofa">${C.ofaSVG(mood.mood, 84)}</div>
        <div class="hero-body"><p class="bubble">${esc(mood.text)}</p>
          ${todays.length ? `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres hari ini"><span style="width:${pct}%"></span></div><p class="small muted">${done} dari ${todays.length} selesai</p>` : ''}
        </div>
      </section>
      <form id="quick" class="quick" autocomplete="off">
        <label for="quick-in" class="sr">Catat cepat</label>
        <input id="quick-in" name="q" placeholder="Catat cepat: besok jam 3 kirim draft #niras" enterkeyhint="send">
        <button class="send" aria-label="Catat">${icon('send')}</button>
      </form>
      ${chips}
      ${overdue.length ? `<h2>Terlewat <span class="count">${overdue.length}</span></h2><ul class="list">${overdue.map((x) => taskRow(x, { late: true })).join('')}</ul>` : ''}
      <h2>Jadwal hari ini</h2>
      ${list.length ? `<ul class="list">${list.map((x) => taskRow(x)).join('')}</ul>`
        : `<p class="empty-line">Belum ada jadwal hari ini${ui.filter !== 'all' ? ' di proyek ini' : ''}. Coba ketik di kolom catat cepat di atas.</p>`}
      ${soon.length ? `<h2>Segera</h2><ul class="list">${soon.map((x) => taskRow(x, { showDate: true })).join('')}</ul>` : ''}`;
  }

  /* ---------- Layar: Kalender ---------- */
  function viewCalendar() {
    const base = C.startOfDay(now());
    let days = '';
    for (let i = 0; i < 14; i++) {
      const s = C.ymd(C.addDays(base, i));
      const l = data.tasks.filter((x) => x.date === s && !x.skipped).sort(byDue);
      if (!l.length) continue;
      const label = i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : C.fmtDateLong(s);
      days += `<h2 class="day-h">${esc(label)}</h2><ul class="list">${l.map((x) => taskRow(x)).join('')}</ul>`;
    }
    const far = C.ymd(C.addDays(base, 13));
    const later = data.tasks.filter((x) => !x.skipped && !x.done && x.date > far).sort(byDue);
    const near = nearest();
    return `
      <header class="top"><div><p class="eyebrow">14 hari ke depan</p><h1>Kalender</h1></div></header>
      <section class="card" aria-label="Intip minggu ini">
        <div class="row-between"><p class="card-title">Intip minggu ini</p>${near ? `<span class="small muted nowrap">Terdekat: ${esc(near.title)}, ${esc(C.fmtDateShort(near.date))}</span>` : ''}</div>
        ${weekStrip()}
      </section>
      ${days || `<div class="empty">${C.ofaSVG('tidur', 96)}<p class="muted">Dua minggu ke depan masih kosong. Waktunya santai!</p></div>`}
      ${later.length ? `<h2>Lebih jauh</h2><ul class="list">${later.map((x) => taskRow(x, { showDate: true })).join('')}</ul>` : ''}`;
  }

  /* ---------- Layar: Rapor ---------- */
  function viewReport() {
    const n = now();
    const ws = C.addDays(C.startOfWeek(n), 7 * ui.week);
    const isCurrent = ui.week === 0;
    const st = C.weekStats(data, ws, isCurrent ? n : null);
    const mood = C.reportMood(st, data, isCurrent);
    const we = C.addDays(ws, 6);
    const range = `${ws.getDate()} ${C.BULAN_PENDEK[ws.getMonth()]} – ${we.getDate()} ${C.BULAN_PENDEK[we.getMonth()]}`;
    const label = isCurrent ? 'Minggu ini' : ui.week === -1 ? 'Minggu lalu' : `${-ui.week} minggu lalu`;
    const stickers = C.stickerCount(data, n);
    const starColors = ['kuning', 'koral', 'ungu', 'mint', 'biru', 'pink'];

    return `
      <header class="top"><div><p class="eyebrow">${esc(range)}</p><h1>Rapor</h1></div>
        <div class="week-nav">
          <button type="button" class="icon-btn" data-act="week" data-d="-1" aria-label="Minggu sebelumnya">${icon('back')}</button>
          <button type="button" class="icon-btn" data-act="week" data-d="1" aria-label="Minggu berikutnya" ${isCurrent ? 'disabled' : ''}>${icon('fwd')}</button>
        </div></header>
      <p class="pill-label">${esc(label)}${isCurrent ? ' · dihitung dari jadwal yang sudah lewat waktunya' : ''}</p>
      <section class="card hero" aria-label="Pesan Ofa">
        <div class="ofa">${C.ofaSVG(mood.mood, 92)}</div>
        <div class="hero-body"><p class="bubble">${esc(mood.text)}</p>
          ${st.total ? `<div class="bar-row"><div class="bar" role="progressbar" aria-valuenow="${st.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Persentase selesai"><span style="width:${st.pct}%"></span></div><b class="pct">${st.pct}%</b></div>` : ''}
        </div>
      </section>
      ${st.perProject.length ? `<section class="card" aria-label="Per proyek"><p class="card-title">Per proyek</p><div class="pgrid">
        ${st.perProject.map((x) => `<span class="pname">${esc(x.project.name)}</span><div class="bar thin"><span style="width:${Math.round((x.done / x.total) * 100)}%;background:${pal(x.project).c}"></span></div><span class="pnum">${x.done}/${x.total}</span>`).join('')}
      </div></section>` : ''}
      ${st.unfinished.length ? `<h2>Belum selesai <span class="count">${st.unfinished.length}</span></h2><ul class="list">${st.unfinished.map((x) => taskRow(x, { late: x.date < today() || !isCurrent, showDate: true })).join('')}</ul>` : ''}
      <section class="card stickers" aria-label="Koleksi stiker">
        <div class="stars">${Array.from({ length: Math.min(stickers, 6) }, (_, i) => { const c = C.palet(starColors[i % 6]); return `<span style="background:${c.c};color:${c.ink}">${icon('star', 20)}</span>`; }).join('')}<span class="star-next">?</span></div>
        <div><p class="card-title">${stickers} stiker minggu sempurna</p><p class="small muted">Selesaikan semua jadwal seminggu untuk stiker berikutnya.</p></div>
      </section>`;
  }

  /* ---------- Kartu sinkron HP & laptop ---------- */
  function syncCard() {
    const S = window.OfaSync ? window.OfaSync.state : null;
    let body;
    if (!S || S.status === 'loading') {
      body = '<p class="small muted" style="margin:0">Menyiapkan sinkron… Pastikan HP atau laptop tersambung ke internet.</p>';
    } else if (S.status === 'off') {
      body = `<p class="small muted" style="margin:0">Masuk dengan akun Google supaya jadwal di HP dan laptop selalu sama. Lakukan di kedua perangkat dengan akun yang sama.</p>
        <button type="button" class="btn" data-act="sync-login">Masuk dengan Google</button>`;
    } else {
      const u = S.user || {};
      const when = S.lastSync ? C.fmtTime(C.hm(new Date(S.lastSync))) : '';
      const line = S.status === 'syncing' ? 'Menyambungkan…' : S.error ? S.error : `Tersinkron${when ? ` · terakhir ${when}` : ''}`;
      body = `<div class="sync-row">
          <span class="sync-dot${S.error ? ' warn' : ''}" aria-hidden="true"></span>
          <div class="grow"><p class="card-title">${esc(u.name || 'Akun Google')}</p><p class="small muted" style="margin:2px 0 0">${esc(u.email || '')}</p></div>
          <button type="button" class="mini" data-act="sync-logout">Keluar</button>
        </div>
        <p class="small${S.error ? ' warn-text' : ' muted'}" style="margin:0">${esc(line)}</p>`;
    }
    return `<section class="card" aria-label="Sinkron HP dan laptop"><p class="card-title">Sinkron HP &amp; laptop</p>${body}</section>`;
  }

  /* ---------- Layar: Proyek & pengaturan ---------- */
  function viewProjects() {
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const permText = { granted: 'Notifikasi menyala', denied: 'Notifikasi diblokir di pengaturan browser', default: 'Notifikasi belum dinyalakan', unsupported: 'Browser ini belum mendukung notifikasi' }[perm];
    const moods = [['senang', 'Senang'], ['panik', 'Panik kecil'], ['tidur', 'Tidur santai'], ['ngambek', 'Ngambek'], ['sedih', 'Sedih'], ['marah', 'Marah']];
    return `
      <header class="top"><div><p class="eyebrow">Atur sumber dan pengingat tiap proyek</p><h1>Proyek</h1></div></header>
      ${syncCard()}
      ${data.projects.map((p) => { const c = pal(p); const muted = isMuted(p); return `
        <section class="card proj">
          <div class="proj-head">
            <span class="badge" style="background:${c.c}">${esc(p.name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase())}</span>
            <div class="grow"><p class="card-title">${esc(p.name)}</p><p class="small muted">${p.kind === 'lomba' ? 'Lomba · ' : ''}${muted ? 'Dibisukan sampai besok' : `${data.tasks.filter((t) => t.projectId === p.id && !t.done && !t.skipped).length} jadwal aktif`}</p></div>
            <button type="button" class="switch" role="switch" aria-checked="${!muted}" aria-label="Notifikasi ${esc(p.name)}" data-act="mute" data-id="${p.id}"><span></span></button>
          </div>
          <div class="proj-foot"><p class="rule" style="background:${c.tint};color:${c.ink}">${esc(reminderText(p.reminders))}</p>
            <button type="button" class="icon-btn small-btn" data-act="edit-project" data-id="${p.id}" aria-label="Ubah ${esc(p.name)}">${icon('edit', 18)}</button></div>
        </section>`; }).join('')}
      <button type="button" class="dashed" data-act="new-project">${icon('plus', 20, 2.5)} Tambah proyek</button>

      <h2>Pengaturan</h2>
      <section class="card settings">
        <div class="set-row"><label for="set-name">Nama panggilan</label><input id="set-name" class="input compact" data-set="name" value="${esc(data.profile.name)}" maxlength="24"></div>
        <div class="set-row"><label for="set-time">Jam ringkasan pagi</label><input id="set-time" type="time" class="input compact" data-set="summaryTime" value="${esc(data.profile.summaryTime)}"></div>
        <div class="set-row"><span id="lbl-moods">Ofa boleh ngambek, marah, dan sedih</span><button type="button" class="switch" role="switch" aria-checked="${data.profile.moodsOn !== false}" aria-labelledby="lbl-moods" data-act="moods"><span></span></button></div>
        <div class="set-row"><span>${esc(permText)}</span>${perm === 'default' ? '<button type="button" class="mini dark" data-act="notif">Nyalakan</button>' : ''}</div>
      </section>
      <p class="small muted">Di versi coba, pengingat muncul selama app terbuka atau masih berjalan di latar. Supaya pasti berbunyi meski app tertutup, tekan tombol Google Calendar di jadwal penting.</p>

      <h2>Cadangan data</h2>
      <section class="card settings">
        <p class="small muted" style="margin:0">Kalau sudah masuk dengan Google, jadwal otomatis tersimpan online. Cadangan berkas tetap berguna sebagai simpanan tambahan.</p>
        <div class="btn-row">
          <button type="button" class="btn ghost" data-act="export">Simpan cadangan</button>
          <label class="btn ghost" for="import-file">Pulihkan</label>
          <input id="import-file" type="file" accept="application/json,.json" class="sr" data-act-change="import">
        </div>
        <button type="button" class="btn danger" data-act="reset">Hapus semua data</button>
      </section>

      <h2>Kenalan dengan Ofa</h2>
      <section class="card ofa-grid">
        ${moods.map(([m, l]) => `<figure>${C.ofaSVG(m, 64)}<figcaption>${l}</figcaption></figure>`).join('')}
      </section>
      <p class="small muted center">One for All · ${VERSI}</p>`;
  }

  /* ---------- Sheet ---------- */
  function sheetWrap(title, body, wide) {
    return `<div class="overlay" data-act="close-bg"><div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-head"><h2 id="sheet-title">${title}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Tutup">${icon('x')}</button></div>
      ${body}</div></div>`;
  }

  function taskSheet() {
    const s = ui.sheet;
    const t = s.id ? data.tasks.find((x) => x.id === s.id) : null;
    const pre = s.preset || {};
    const lombaProj = data.projects.find((p) => p.kind === 'lomba');
    const pid = t ? t.projectId : (pre.projectId || (ui.filter !== 'all' ? ui.filter : (data.lastProject && proj(data.lastProject) ? data.lastProject : data.projects[0].id)));
    const p = proj(pid);
    const lombaOn = !t && !!pre.lomba && p && p.kind === 'lomba';
    const v = t || { title: pre.title || '', date: pre.date || today(), time: pre.time || '', note: pre.note || '', link: pre.link || '' };
    const body = `
      <form id="task-form" novalidate>
        <div class="field"><span class="lbl" id="lbl-proj">Proyek</span>
          <div class="chips" role="group" aria-labelledby="lbl-proj">
            ${data.projects.map((pr) => { const c = pal(pr); const on = pr.id === pid; return `<button type="button" class="chipbtn" data-act="pick-project" data-id="${pr.id}" aria-pressed="${on}" style="${on ? `background:${c.tint};color:${c.ink};border-color:${c.ink}` : ''}">${esc(pr.name)}</button>`; }).join('')}
          </div>
          <input type="hidden" name="projectId" value="${esc(pid)}">
        </div>
        ${!t ? `<label class="lomba-toggle" id="lomba-toggle" ${p && p.kind === 'lomba' ? '' : 'hidden'}><input type="checkbox" name="lomba" ${lombaOn ? 'checked' : ''}> Mode lomba: isi tanggal pendaftaran, kirim karya, dan pengumuman sekaligus</label>` : ''}
        <div id="f-normal" ${lombaOn ? 'hidden' : ''}>
          <div class="field"><label for="f-title">Judul</label><input id="f-title" class="input" name="title" value="${esc(v.title)}" placeholder="Misalnya: Kirim draft artikel" maxlength="140"></div>
          <div class="grid2">
            <div class="field"><label for="f-date">Tanggal</label><input id="f-date" type="date" class="input" name="date" value="${esc(v.date)}"></div>
            <div class="field"><label for="f-time">Jam (boleh kosong)</label><input id="f-time" type="time" class="input" name="time" value="${esc(v.time || '')}"></div>
          </div>
        </div>
        <div id="f-lomba" ${lombaOn ? '' : 'hidden'}>
          <div class="field"><label for="f-lname">Nama lomba</label><input id="f-lname" class="input" name="lname" value="${esc(pre.title || '')}" placeholder="Tulis nama lombanya" maxlength="120"></div>
          <div class="grid2">
            <div class="field"><label for="f-l1">Batas pendaftaran</label><input id="f-l1" type="date" class="input" name="l1"></div>
            <div class="field"><label for="f-l2">Batas kirim karya</label><input id="f-l2" type="date" class="input" name="l2"></div>
          </div>
          <div class="field"><label for="f-l3">Pengumuman (boleh kosong)</label><input id="f-l3" type="date" class="input" name="l3"></div>
          <div class="tip">${C.ofaSVG('senang', 44)}<p>Malas mengetik? Salin tanggal dari poster pakai Google Lens atau Teks Langsung, lalu isi di sini.</p></div>
        </div>
        <div class="field"><label for="f-note">Catatan (boleh kosong)</label><textarea id="f-note" class="input" name="note" rows="2" maxlength="1000">${esc(v.note || '')}</textarea></div>
        <div class="field"><label for="f-link">Tautan (boleh kosong)</label><input id="f-link" type="url" class="input" name="link" value="${esc(v.link || '')}" placeholder="https://"></div>
        <p class="small muted" id="rem-info">${esc(reminderText(p ? p.reminders : []))}.</p>
        <p class="form-err" id="form-err" role="alert" hidden></p>
        <button type="submit" class="btn">${t ? 'Simpan perubahan' : 'Simpan jadwal'}</button>
        ${t ? `<div class="btn-row">
          <a class="btn ghost" href="${esc(C.googleCalendarLink(t, p ? p.name : ''))}" target="_blank" rel="noopener">${icon('gcal', 20)} Google Calendar</a>
          <button type="button" class="btn danger" data-act="delete-task" data-id="${t.id}">Hapus</button>
        </div>` : ''}
      </form>`;
    return sheetWrap(t ? 'Ubah jadwal' : 'Jadwal baru', body);
  }

  function projectSheet() {
    const p = ui.sheet.id ? proj(ui.sheet.id) : null;
    const v = p || { name: '', color: 'mint', reminders: ['1440', '60'], kind: 'umum', keywords: [] };
    const body = `
      <form id="project-form" novalidate>
        <div class="field"><label for="p-name">Nama proyek</label><input id="p-name" class="input" name="name" value="${esc(v.name)}" maxlength="40" placeholder="Misalnya: Nira's Library"></div>
        <div class="field"><span class="lbl" id="lbl-color">Warna</span>
          <div class="colors" role="radiogroup" aria-labelledby="lbl-color">
            ${C.PALET.map((c) => `<label class="color"><input type="radio" name="color" value="${c.key}" ${v.color === c.key ? 'checked' : ''}><span style="background:${c.c}" aria-hidden="true"></span><span class="sr">${c.key}</span></label>`).join('')}
          </div></div>
        <div class="field"><span class="lbl" id="lbl-kind">Jenis</span>
          <div class="chips" role="radiogroup" aria-labelledby="lbl-kind">
            <label class="chipradio"><input type="radio" name="kind" value="umum" ${v.kind !== 'lomba' ? 'checked' : ''}><span>Umum</span></label>
            <label class="chipradio"><input type="radio" name="kind" value="lomba" ${v.kind === 'lomba' ? 'checked' : ''}><span>Lomba (3 tanggal)</span></label>
          </div></div>
        <div class="field"><span class="lbl" id="lbl-rem">Ingatkan aku</span>
          <div class="chips" role="group" aria-labelledby="lbl-rem">
            ${C.PILIHAN_PENGINGAT.map((o) => `<label class="chipradio"><input type="checkbox" name="rem" value="${o.id}" ${(v.reminders || []).includes(o.id) ? 'checked' : ''}><span>${o.label}</span></label>`).join('')}
          </div></div>
        <div class="field"><label for="p-kw">Kata kunci catat cepat (pisahkan dengan koma)</label><input id="p-kw" class="input" name="keywords" value="${esc((v.keywords || []).join(', '))}" placeholder="misalnya: klien, revisi"></div>
        <p class="form-err" id="form-err" role="alert" hidden></p>
        <button type="submit" class="btn">${p ? 'Simpan proyek' : 'Tambah proyek'}</button>
        ${p && data.projects.length > 1 ? `<button type="button" class="btn danger" data-act="delete-project" data-id="${p.id}">Hapus proyek</button>` : ''}
      </form>`;
    return sheetWrap(p ? 'Ubah proyek' : 'Proyek baru', body);
  }

  function summarySheet() {
    const n = now(), t = today();
    const todays = data.tasks.filter((x) => x.date === t && !x.skipped && !x.done).sort(byDue);
    const mood = todays.length ? 'senang' : 'tidur';
    const groups = data.projects.map((p) => ({ p, l: todays.filter((x) => x.projectId === p.id) })).filter((g) => g.l.length);
    const near = nearest();
    const word = C.greetingWord(n);
    const body = `
      <div class="summary-top">${C.ofaSVG(mood, 108)}
        <p class="summary-hi">${word === 'Pagi' ? 'Selamat pagi' : `Selamat ${word.toLowerCase()}`}, ${esc(data.profile.name)}!</p>
        <p class="muted center">${todays.length ? `Ada ${todays.length} jadwal untukmu hari ini, ${esc(C.fmtDateLong(t))}.` : 'Hari ini belum ada jadwal. Nikmati harimu!'}</p></div>
      ${groups.map((g) => { const c = pal(g.p); return `<div class="card sum-card"><span class="dot" style="background:${c.c}"></span><div class="grow">
        <div class="row-between"><p class="card-title">${esc(g.p.name)}</p><span class="chip" style="background:${c.tint};color:${c.ink}">${g.l.length} jadwal</span></div>
        <p class="small muted">${g.l.map((x) => `${esc(x.title)}${x.time ? ` ${C.fmtTime(x.time)}` : ''}`).join(' · ')}</p></div></div>`; }).join('')}
      <section class="card" aria-label="Intip minggu ini">
        <div class="row-between"><p class="card-title">Intip minggu ini</p>${near ? `<span class="small muted nowrap">Terdekat: ${esc(near.title)}, ${esc(C.fmtDateShort(near.date))}</span>` : ''}</div>
        ${weekStrip()}
      </section>
      <button type="button" class="btn" data-act="close">Mulai hari ini</button>`;
    return sheetWrap('Ringkasan', body);
  }

  function welcomeSheet() {
    const body = `
      <div class="summary-top">${C.ofaSVG('senang', 116)}
        <p class="summary-hi">Halo, ${esc(data.profile.name)}! Aku Ofa.</p>
        <p class="muted center">Aku akan menjaga jadwal Niras, Lei Stuff, dan Nira Studio, lalu mengingatkanmu tepat waktu.</p></div>
      <div class="card"><p class="card-title">Coba ketik di kolom catat cepat:</p>
        <ul class="tips"><li>besok abis magrib kirim revisi logo ke klien</li><li>jumat posting reels jam 7 malam</li><li>batas kirim lomba puisi 5 desember</li></ul>
        <p class="small muted">Ofa otomatis menebak tanggal, jam, dan proyeknya. Tambahkan #niras, #leistuff, atau #nirastudio kalau ingin memilih proyek sendiri.</p></div>
      <div class="card"><p class="card-title">Pasang di layar utama</p><p class="small muted">Android (Chrome): menu ⋮ lalu "Instal aplikasi". iPhone (Safari): tombol Bagikan lalu "Tambahkan ke Layar Utama".</p></div>
      ${'Notification' in window && Notification.permission === 'default' ? '<button type="button" class="btn ghost" data-act="notif">Nyalakan notifikasi</button>' : ''}
      <button type="button" class="btn" data-act="close">Ayo mulai!</button>`;
    return sheetWrap('Selamat datang', body);
  }

  function resetSheet() {
    return sheetWrap('Hapus semua data?', `
      <div class="summary-top">${C.ofaSVG('sedih', 96)}<p class="muted center">Semua jadwal dan proyek akan terhapus${window.OfaSync && window.OfaSync.state.status === 'on' ? ', termasuk di semua perangkat yang tersinkron,' : ''} dan tidak bisa dikembalikan. Simpan cadangan dulu kalau ragu.</p></div>
      <button type="button" class="btn danger" data-act="reset-yes">Ya, hapus semuanya</button>
      <button type="button" class="btn ghost" data-act="close">Batal</button>`);
  }

  function renderSheet() {
    const s = ui.sheet;
    if (!s) return '';
    if (s.type === 'task') return taskSheet();
    if (s.type === 'project') return projectSheet();
    if (s.type === 'summary') return summarySheet();
    if (s.type === 'welcome') return welcomeSheet();
    if (s.type === 'reset') return resetSheet();
    return '';
  }

  /* ---------- Render ---------- */
  const TABS = [['hari', 'Hari ini', 'sun'], ['kalender', 'Kalender', 'cal'], ['rapor', 'Rapor', 'star'], ['proyek', 'Proyek', 'folder']];
  function renderBase() {
    const views = { hari: viewToday, kalender: viewCalendar, rapor: viewReport, proyek: viewProjects };
    const scroll = window.scrollY;
    // jaga isi kolom catat cepat & pengaturan yang sedang diketik
    const active = document.activeElement;
    const keepId = active && active.id && /INPUT|TEXTAREA/.test(active.tagName) && $('#app').contains(active) ? active.id : null;
    const keepVal = keepId ? active.value : null;
    $('#app').innerHTML = `
      <main class="main" id="main">${views[ui.tab]()}</main>
      ${ui.tab === 'hari' || ui.tab === 'kalender' ? `<button type="button" class="fab" data-act="new" aria-label="Tambah jadwal">${icon('plus', 28, 2.5)}</button>` : ''}
      <nav class="nav" aria-label="Navigasi utama">${TABS.map(([id, label, ic]) => `<button type="button" data-act="tab" data-id="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}><span>${icon(ic)}</span>${label}</button>`).join('')}</nav>`;
    if (keepId) { const el = document.getElementById(keepId); if (el) { el.value = keepVal; el.focus(); } }
    window.scrollTo(0, scroll);
  }
  function render() {
    renderBase();
    $('#sheet-root').innerHTML = renderSheet();
    document.body.classList.toggle('locked', !!ui.sheet);
  }
  /** Segarkan tampilan tanpa menutup formulir yang sedang dibuka. */
  function refresh() { if (ui.sheet && ui.sheet.type !== 'summary') renderBase(); else render(); }

  function openSheet(s) {
    ui.sheet = s;
    $('#sheet-root').innerHTML = renderSheet();
    document.body.classList.add('locked');
    const first = $('#sheet-root input:not([type=hidden]):not([type=checkbox]):not([type=radio]), #sheet-root .btn');
    if (first && s.type !== 'summary') setTimeout(() => first.focus(), 50);
  }
  function closeSheet() {
    ui.sheet = null;
    $('#sheet-root').innerHTML = '';
    document.body.classList.remove('locked');
    render();
  }

  /* ---------- Aksi ---------- */
  function addTask(fields) {
    const t = Object.assign({ id: C.uid(), done: false, skipped: false, postponed: 0, createdAt: new Date().toISOString() }, fields);
    data.tasks.push(t);
    data.lastProject = t.projectId;
    return t;
  }

  function quickAdd(text) {
    const r = C.parseQuick(text, now(), data.projects);
    if (!r.title) { toast('Tulis dulu apa yang mau dicatat, ya.'); return; }
    const pid = r.projectId || (ui.filter !== 'all' ? ui.filter : (data.lastProject && proj(data.lastProject) ? data.lastProject : data.projects[0].id));
    const t = addTask({ title: r.title, date: r.date || today(), time: r.time || null, projectId: pid, note: '', link: '' });
    save(); render();
    const p = proj(pid);
    toast(`Dicatat: ${t.title} · ${C.fmtDateShort(t.date)}${t.time ? ` ${C.fmtTime(t.time)}` : ''} · ${p.name}`, 'Ubah', () => openSheet({ type: 'task', id: t.id }));
  }

  function toggleTask(id) {
    const t = data.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    save(); render();
    if (t.done) {
      const todays = data.tasks.filter((x) => x.date === today() && !x.skipped);
      if (t.date === today() && todays.length && todays.every((x) => x.done)) toast(`Semua jadwal hari ini beres! Ofa bangga sama kamu, ${data.profile.name}!`, null, null, true);
      else toast(`Sip! "${t.title}" selesai.`, 'Urungkan', () => toggleTask(id));
    }
  }

  function saveTaskForm(form) {
    const fd = new FormData(form);
    const err = $('#form-err');
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    const projectId = fd.get('projectId');
    const note = String(fd.get('note') || '').trim();
    const link = String(fd.get('link') || '').trim();
    if (link && !/^https?:\/\//i.test(link)) return fail('Tautan harus diawali http:// atau https://');
    const s = ui.sheet;
    if (!s.id && fd.get('lomba')) {
      const name = String(fd.get('lname') || '').trim();
      const dates = [['l1', 'Daftar'], ['l2', 'Kirim karya'], ['l3', 'Pengumuman']].map(([k, l]) => [String(fd.get(k) || ''), l]).filter(([d]) => d);
      if (!name) return fail('Isi nama lombanya dulu.');
      if (!dates.length) return fail('Isi minimal satu tanggal lomba.');
      dates.forEach(([d, l]) => addTask({ title: `${l}: ${name}`, date: d, time: null, projectId, note, link }));
      save(); closeSheet();
      toast(`${dates.length} jadwal lomba dicatat. Pengingat bertahap sudah terpasang.`);
      return;
    }
    const title = String(fd.get('title') || '').trim();
    const date = String(fd.get('date') || '');
    const time = String(fd.get('time') || '') || null;
    if (!title) return fail('Judulnya belum diisi.');
    if (!date) return fail('Pilih tanggalnya dulu.');
    if (s.id) {
      const t = data.tasks.find((x) => x.id === s.id);
      if (!t.done && date > t.date) t.postponed = (t.postponed || 0) + 1;
      Object.assign(t, { title, date, time, projectId, note, link });
      if (t.skipped && date >= today()) t.skipped = false;
      data.lastProject = projectId;
      save(); closeSheet(); toast('Perubahan disimpan.');
    } else {
      addTask({ title, date, time, projectId, note, link });
      save(); closeSheet(); toast(`Dicatat: ${title} · ${C.fmtDateShort(date)}${time ? ` ${C.fmtTime(time)}` : ''}`);
    }
  }

  function saveProjectForm(form) {
    const fd = new FormData(form);
    const err = $('#form-err');
    const name = String(fd.get('name') || '').trim();
    if (!name) { err.textContent = 'Nama proyeknya belum diisi.'; err.hidden = false; return; }
    const fields = {
      name,
      color: fd.get('color') || 'mint',
      kind: fd.get('kind') || 'umum',
      reminders: fd.getAll('rem').map(String),
      keywords: String(fd.get('keywords') || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
    };
    if (ui.sheet.id) Object.assign(proj(ui.sheet.id), fields);
    else {
      let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyek';
      while (proj(id)) id += '-1';
      data.projects.push(Object.assign({ id, mutedUntil: null }, fields));
    }
    save(); closeSheet(); toast('Proyek disimpan.');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `one-for-all-cadangan-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Cadangan disimpan ke folder unduhan.');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.tasks) || !Array.isArray(obj.projects)) throw new Error('format');
        data = migrate(obj); save(); render();
        toast(`Cadangan dipulihkan: ${data.tasks.length} jadwal.`);
      } catch (e) { toast('Berkas ini bukan cadangan One for All.'); }
    };
    reader.readAsText(file);
  }

  async function enableNotif() {
    if (!('Notification' in window)) { toast('Browser ini belum mendukung notifikasi.'); return; }
    const r = await Notification.requestPermission();
    toast(r === 'granted' ? 'Notifikasi menyala. Ofa siap mengingatkan!' : 'Notifikasi tidak diizinkan.');
    if (ui.sheet && ui.sheet.type === 'welcome') openSheet(ui.sheet); else render();
  }

  async function notify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png' });
      else new Notification(title, { body, tag });
    } catch (e) { /* abaikan */ }
  }

  function updateBadge() {
    const n = data.tasks.filter((x) => x.date === today() && !x.done && !x.skipped).length;
    try {
      if ('setAppBadge' in navigator) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); }
    } catch (e) { /* tidak didukung */ }
  }

  /* ---------- Detak: pengingat, ringkasan, Ofa ---------- */
  let lastMinute = '';
  function tick() {
    const n = now();
    const due = C.dueReminders(data, n);
    if (due.length) {
      due.forEach((r) => { data.fired[r.key] = n.toISOString(); notify(r.title, r.body, r.key); });
      if (document.visibilityState === 'visible') toast(`${due[0].title} — ${due[0].body}`);
    }
    // bersihkan catatan pengingat lama
    const cutoff = n - 40 * 86400000;
    Object.keys(data.fired).forEach((k) => { if (new Date(data.fired[k]) < cutoff) delete data.fired[k]; });
    // ringkasan harian
    if (data.welcomed && data.lastSummary !== today() && C.hm(n) >= (data.profile.summaryTime || '06:00')) {
      data.lastSummary = today();
      const cnt = data.tasks.filter((x) => x.date === today() && !x.done && !x.skipped).length;
      if (document.visibilityState === 'visible' && !ui.sheet) openSheet({ type: 'summary' });
      else notify(`${C.greetingWord(n)}, ${data.profile.name}!`, cnt ? `Ada ${cnt} jadwal hari ini. Yuk lihat ringkasannya.` : 'Hari ini belum ada jadwal.', 'ringkasan');
    }
    if (due.length || data.lastSummary === today()) save();
    // segarkan tampilan tiap ganti menit, kecuali saat sedang mengetik
    const mm = C.hm(n);
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (mm !== lastMinute && !ui.sheet && !typing) { lastMinute = mm; render(); }
  }

  /* ---------- Event ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    if (act === 'close-bg') { if (e.target === el) closeSheet(); return; }
    switch (act) {
      case 'tab': ui.tab = id; ui.week = 0; render(); window.scrollTo(0, 0); break;
      case 'filter': ui.filter = id; render(); break;
      case 'toggle': toggleTask(id); break;
      case 'edit': openSheet({ type: 'task', id }); break;
      case 'new': openSheet({ type: 'task' }); break;
      case 'summary': openSheet({ type: 'summary' }); break;
      case 'close': closeSheet(); break;
      case 'resched': {
        const t = data.tasks.find((x) => x.id === id);
        t.date = C.ymd(C.addDays(now(), Number(el.dataset.to)));
        t.postponed = (t.postponed || 0) + 1;
        save(); render(); toast(`"${t.title}" dipindah ke ${el.dataset.to === '0' ? 'hari ini' : 'besok'}.`);
        break;
      }
      case 'skip': {
        const t = data.tasks.find((x) => x.id === id);
        t.skipped = true; save(); render();
        toast(`"${t.title}" dilewati.`, 'Urungkan', () => { t.skipped = false; save(); render(); });
        break;
      }
      case 'week': ui.week = Math.min(0, ui.week + Number(el.dataset.d)); render(); break;
      case 'mute': {
        const p = proj(id);
        p.mutedUntil = isMuted(p) ? null : C.addDays(now(), 1).toISOString();
        save(); render(); toast(isMuted(p) ? `${p.name} dibisukan sampai besok.` : `Notifikasi ${p.name} menyala lagi.`);
        break;
      }
      case 'moods': data.profile.moodsOn = data.profile.moodsOn === false; save(); render(); break;
      case 'notif': enableNotif(); break;
      case 'sync-login': if (window.OfaSync) window.OfaSync.signIn(); else toast('Sinkron belum siap. Periksa koneksi internet.'); break;
      case 'sync-logout': if (window.OfaSync) window.OfaSync.signOut(); break;
      case 'edit-project': openSheet({ type: 'project', id }); break;
      case 'new-project': openSheet({ type: 'project' }); break;
      case 'export': exportData(); break;
      case 'reset': openSheet({ type: 'reset' }); break;
      case 'reset-yes': try { localStorage.removeItem(KEY); } catch (er) { /* abaikan */ } data = C.defaultData(); data.welcomed = true; save(); closeSheet(); toast('Semua data dihapus.'); break;
      case 'delete-task': {
        const i = data.tasks.findIndex((x) => x.id === id);
        const [t] = data.tasks.splice(i, 1);
        save(); closeSheet();
        toast(`"${t.title}" dihapus.`, 'Urungkan', () => { data.tasks.push(t); save(); render(); });
        break;
      }
      case 'delete-project': {
        const p = proj(id);
        const n = data.tasks.filter((t) => t.projectId === id).length;
        if (n && !window.confirm(`Hapus ${p.name} beserta ${n} jadwalnya?`)) return;
        data.projects = data.projects.filter((x) => x.id !== id);
        data.tasks = data.tasks.filter((t) => t.projectId !== id);
        if (ui.filter === id) ui.filter = 'all';
        save(); closeSheet(); toast(`${p.name} dihapus.`);
        break;
      }
      case 'pick-project': {
        const form = el.closest('form');
        $$('[data-act="pick-project"]', form).forEach((b) => {
          const on = b === el; const c = pal(proj(b.dataset.id));
          b.setAttribute('aria-pressed', on);
          b.style.cssText = on ? `background:${c.tint};color:${c.ink};border-color:${c.ink}` : '';
        });
        form.projectId.value = id;
        const p = proj(id);
        $('#rem-info').textContent = `${reminderText(p.reminders)}.`;
        const tog = $('#lomba-toggle');
        if (tog) {
          tog.hidden = p.kind !== 'lomba';
          if (p.kind !== 'lomba' && form.lomba) { form.lomba.checked = false; $('#f-normal').hidden = false; $('#f-lomba').hidden = true; }
        }
        break;
      }
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'lomba' && el.closest('#task-form')) {
      $('#f-normal').hidden = el.checked; $('#f-lomba').hidden = !el.checked;
    }
    if (el.dataset.set) {
      const v = el.value.trim();
      if (el.dataset.set === 'name' && v) data.profile.name = v;
      if (el.dataset.set === 'summaryTime' && v) data.profile.summaryTime = v;
      save(); toast('Pengaturan disimpan.');
    }
    if (el.dataset.actChange === 'import' && el.files && el.files[0]) importData(el.files[0]);
  });

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'quick') { const v = f.q.value; f.q.value = ''; quickAdd(v); }
    if (f.id === 'task-form') saveTaskForm(f);
    if (f.id === 'project-form') saveProjectForm(f);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) closeSheet(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });

  /* ---------- Jembatan untuk sinkron (sync.js) ---------- */
  window.OfaApp = {
    getData: () => data,
    applyRemote(fn) {
      fn(data);
      data = migrate(data);
      stampChanges(false);
      persist();
      refresh();
    },
    toast
  };
  window.addEventListener('ofa:sync-status', () => { if (ui.tab === 'proyek') refresh(); });

  /* ---------- Mulai ---------- */
  function handleLaunchParams() {
    const q = new URLSearchParams(location.search);
    let sheet = null;
    if (q.has('share') || q.get('url') || q.get('text')) {
      const raw = `${q.get('text') || ''}`;
      const url = q.get('url') || (raw.match(/https?:\/\/\S+/) || [''])[0];
      const txt = raw.replace(url, '').trim();
      const isIG = /instagram\.com/i.test(url + raw);
      const lomba = data.projects.find((p) => p.kind === 'lomba');
      sheet = { type: 'task', preset: { link: url, title: (q.get('title') || txt.split('\n')[0] || '').slice(0, 120), projectId: isIG && lomba ? lomba.id : undefined, lomba: isIG && !!lomba } };
    } else if (q.get('aksi') === 'tambah') sheet = { type: 'task' };
    else if (q.get('aksi') === 'ringkasan') sheet = { type: 'summary' };
    if (q.toString()) history.replaceState(null, '', location.pathname);
    return sheet;
  }

  function start() {
    const launch = handleLaunchParams();
    render();
    if (!data.welcomed) {
      data.welcomed = true; data.lastSummary = today(); save();
      openSheet({ type: 'welcome' });
    } else if (launch) {
      openSheet(launch);
    }
    tick();
    setInterval(tick, 30000);
    updateBadge();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* tidak tersedia di pratinjau */ });
    }
  }
  start();
})();
