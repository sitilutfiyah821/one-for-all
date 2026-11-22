/* One for All — inti app: tanggal, pengurai catat cepat, Ofa, mood, rapor, pengingat.
   Tidak menyentuh tampilan, jadi bisa diuji dengan Node. */
(function (root) {
  'use strict';

  /* ---------- Tanggal ---------- */
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d) => { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }; // Senin
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtTime = (t) => (t ? t.replace(':', '.') : '');
  const fmtDateLong = (s) => { const d = parseYMD(s); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`; };
  const fmtDateShort = (s) => { const d = parseYMD(s); return `${HARI_PENDEK[d.getDay()]} ${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`; };
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

  /** Waktu tenggat sebuah tugas (tanpa jam dianggap 08.00). */
  function dueAt(task) {
    const d = parseYMD(task.date);
    const [h, m] = (task.time || '08:00').split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }

  /* ---------- Data bawaan ---------- */
  const PALET = [
    { key: 'koral', c: '#FF8A7A', tint: '#FFE1DC', ink: '#8A2E22' },
    { key: 'kuning', c: '#FFC94D', tint: '#FFF0C7', ink: '#7A5200' },
    { key: 'ungu', c: '#B9A4FF', tint: '#ECE5FF', ink: '#4B3699' },
    { key: 'mint', c: '#7FD8B5', tint: '#DDF5EC', ink: '#1F6B50' },
    { key: 'biru', c: '#8CC8FF', tint: '#E1F0FF', ink: '#1F4E7A' },
    { key: 'pink', c: '#FF9EC4', tint: '#FFE3EE', ink: '#8A2350' }
  ];
  const palet = (key) => PALET.find((p) => p.key === key) || PALET[3];

  /** Pilihan pengingat. min = menit sebelum tenggat; 'pagi' = jam 07.00 di hari H. */
  const PILIHAN_PENGINGAT = [
    { id: '20160', label: '14 hari' }, { id: '10080', label: '7 hari' }, { id: '4320', label: '3 hari' },
    { id: '1440', label: '1 hari' }, { id: '180', label: '3 jam' }, { id: '60', label: '1 jam' },
    { id: '0', label: 'Tepat waktu' }, { id: 'pagi', label: 'Pagi hari H' }
  ];

  function defaultData() {
    return {
      v: 1,
      profile: { name: 'Nira', summaryTime: '06:00', moodsOn: true },
      projects: [
        { id: 'niras', name: 'Niras', color: 'koral', reminders: ['4320', '1440', 'pagi'], mutedUntil: null, kind: 'umum',
          keywords: ['klien', 'revisi', 'brief', 'invoice', 'pesanan', 'draft'] },
        { id: 'lei-stuff', name: 'Lei Stuff', color: 'kuning', reminders: ['20160', '10080', '4320', '1440'], mutedUntil: null, kind: 'lomba',
          keywords: ['lomba', 'kompetisi', 'sayembara', 'pendaftaran', 'karya'] },
        { id: 'nira-studio', name: 'Nira Studio', color: 'ungu', reminders: ['60', '0'], mutedUntil: null, kind: 'umum',
          keywords: ['posting', 'post', 'reels', 'carousel', 'konten', 'feed', 'story', 'upload'] }
      ],
      tasks: [],
      notes: [],
      fired: {},
      lastSummary: null
    };
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

  /* ---------- Pengurai catat cepat (tanpa AI) ---------- */
  const BULAN_RE = {
    januari: 0, jan: 0, februari: 1, feb: 1, maret: 2, mar: 2, april: 3, apr: 3, mei: 4, juni: 5, jun: 5,
    juli: 6, jul: 6, agustus: 7, agu: 7, agt: 7, ags: 7, september: 8, sept: 8, sep: 8, oktober: 9, okt: 9,
    november: 10, nov: 10, nop: 10, desember: 11, des: 11
  };
  const HARI_RE = { minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };
  const WAKTU_IBADAH = [
    [/\b(?:abis|habis|setelah|ba'?da|sehabis)\s+(?:sholat\s+|salat\s+|shalat\s+)?subuh\b/i, '05:30'],
    [/\b(?:abis|habis|setelah|ba'?da|sehabis)\s+(?:sholat\s+|salat\s+|shalat\s+)?(?:zuhur|dzuhur|dhuhur|lohor)\b/i, '12:30'],
    [/\b(?:abis|habis|setelah|ba'?da|sehabis)\s+(?:sholat\s+|salat\s+|shalat\s+)?(?:ashar|asar)\b/i, '15:30'],
    [/\b(?:abis|habis|setelah|ba'?da|sehabis)\s+(?:sholat\s+|salat\s+|shalat\s+)?(?:magrib|maghrib)\b/i, '18:30'],
    [/\b(?:abis|habis|setelah|ba'?da|sehabis)\s+(?:sholat\s+|salat\s+|shalat\s+)?(?:isya|isya'|isyak)\b/i, '19:30']
  ];

  function parseQuick(input, now, projects) {
    let text = ` ${String(input || '')} `;
    const take = (re) => {
      const m = re.exec(text);
      if (m) text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
      return m;
    };
    const today = startOfDay(now);
    let date = null, time = null, projectId = null;

    // Proyek lewat tagar: #niras, #leistuff, #nirastudio
    let m = take(/#([\p{L}\p{N}_-]+)/u);
    if (m && projects) {
      const tag = slug(m[1]);
      const p = projects.find((pr) => slug(pr.name).startsWith(tag) || slug(pr.id).startsWith(tag));
      if (p) projectId = p.id;
    }

    // Tanggal
    if ((m = take(/\b(?:hari\s+ini|nanti|ntar)\b/i))) date = today;
    else if ((m = take(/\bbesok\s+lusa\b/i))) date = addDays(today, 2);
    else if ((m = take(/\b(?:besok|bsk|esok)\b/i))) date = addDays(today, 1);
    else if ((m = take(/\blusa\b/i))) date = addDays(today, 2);
    else if ((m = take(/\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|ags|sept|sep|okt|nov|nop|des)\b(?:\s+(\d{4}))?/i))) {
      const mon = BULAN_RE[m[2].toLowerCase()];
      let y = m[3] ? Number(m[3]) : today.getFullYear();
      let d = new Date(y, mon, Number(m[1]));
      if (!m[3] && d < today) d = new Date(y + 1, mon, Number(m[1]));
      date = d;
    } else if ((m = take(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) {
      let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear();
      let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      if (!m[3] && d < today) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]));
      date = d;
    } else if ((m = take(/\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|ahad)(\s+depan)?\b/i)) ||
               (m = take(/\b(minggu)(?=\s+(?:pagi|siang|sore|malam|jam|pukul)|\s+depan\s+(?:pagi|siang|sore|malam|jam|pukul))(\s+depan)?\b/i))) {
      const target = HARI_RE[(m[1] || 'minggu').toLowerCase()];
      if (m[2]) {
        // "Jumat depan" = Jumat di minggu berikutnya (minggu dimulai Senin)
        date = addDays(startOfWeek(today), 7 + ((target + 6) % 7));
      } else {
        date = addDays(today, (target - today.getDay() + 7) % 7);
      }
    } else if ((m = take(/\bminggu\s+depan\b/i))) date = addDays(today, 7);

    // Jam
    for (const [re, t] of WAKTU_IBADAH) { if (!time && take(re)) time = t; }
    if (!time && (m = take(/\b(?:jam|pukul|pkl\.?)\s*(\d{1,2})(?:[.:](\d{2}))?(?:\s*(pagi|siang|sore|malam))?\b/i))) {
      time = adjustHour(Number(m[1]), Number(m[2] || 0), m[3]);
    } else if (!time && (m = take(/\b(\d{1,2})[.:](\d{2})(?:\s*(pagi|siang|sore|malam))?\b/))) {
      time = adjustHour(Number(m[1]), Number(m[2]), m[3]);
    }
    if (!time && (m = take(/\b(pagi|siang|sore|malam)\b/i))) {
      time = { pagi: '08:00', siang: '12:00', sore: '16:00', malam: '19:00' }[m[1].toLowerCase()];
    }
    if (time && !date) date = today;

    // Proyek lewat kata kunci
    if (!projectId && projects) {
      const low = String(input).toLowerCase();
      const hit = projects.find((p) => (p.keywords || []).some((k) => new RegExp(`\\b${k}`, 'i').test(low)));
      if (hit) projectId = hit.id;
    }

    let title = text.replace(/\s+/g, ' ').trim()
      .replace(/^(?:terus|lalu|dan|trus|tolong|ingetin|ingatkan|catat)\s+/i, '')
      .replace(/\s+(?:terus|lalu|dan|trus|ya|yaa|nih)$/i, '')
      .replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '');
    if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

    return { title, date: date ? ymd(date) : null, time, projectId };
  }

  function adjustHour(h, min, part) {
    if (h > 23 || min > 59) return null;
    const p = (part || '').toLowerCase();
    if (p === 'siang' && h < 6) h += 12;
    if (p === 'sore' && h < 12) h += 12;
    if (p === 'malam' && h >= 5 && h < 12) h += 12;
    if (p === 'pagi' && h === 12) h = 0;
    return `${pad(h)}:${pad(min)}`;
  }

  /* ---------- Ofa si kapibara ---------- */
  const FLAME = (fill) => `<path d="M0 -10 C5 -5 7 0 5 4 C3 8 -3 8 -5 4 C-7 0 -3 -4 0 -10 Z" fill="${fill}"/>`;
  const FLAME_IN = '<path d="M0 -4 C2 -1 3 2 2 4 C1 6 -1 6 -2 4 C-3 2 -1 0 0 -4 Z" fill="#FFD24D"/>';
  const OFA_PARTS = {
    senang: {
      back: '<ellipse cx="-40" cy="150" rx="8" ry="14" fill="#B07D4C"/><ellipse cx="40" cy="150" rx="8" ry="14" fill="#B07D4C"/>',
      face: '<path d="M-6 114 Q0 119 6 114" fill="none" stroke="#5A3A22" stroke-width="1.5" stroke-linecap="round"/><path d="M-27 88 Q-22 82 -17 88" fill="none" stroke="#2B2B2B" stroke-width="2" stroke-linecap="round"/><path d="M17 88 Q22 82 27 88" fill="none" stroke="#2B2B2B" stroke-width="2" stroke-linecap="round"/><ellipse cx="-34" cy="101" rx="5" ry="3" fill="#FF9EB1"/><ellipse cx="34" cy="101" rx="5" ry="3" fill="#FF9EB1"/><circle cx="0" cy="52" r="12" fill="#FFB347" stroke="#E8912A"/><ellipse cx="6" cy="40" rx="6" ry="3" fill="#7FD8B5"/><path d="M-62 70 L-58 62 L-54 70 L-58 78 Z" fill="#FFC94D"/><path d="M56 84 L59 78 L62 84 L59 90 Z" fill="#FFC94D"/>'
    },
    panik: {
      back: '<ellipse cx="-40" cy="146" rx="8" ry="14" fill="#B07D4C"/><ellipse cx="40" cy="146" rx="8" ry="14" fill="#B07D4C"/>',
      face: '<ellipse cx="0" cy="115" rx="5" ry="4" fill="#5A3A22"/><circle cx="-22" cy="85" r="7" fill="#fff"/><circle cx="22" cy="85" r="7" fill="#fff"/><circle cx="-22" cy="86" r="3.5" fill="#2B2B2B"/><circle cx="22" cy="86" r="3.5" fill="#2B2B2B"/><ellipse cx="-34" cy="101" rx="5" ry="3" fill="#FF9EB1"/><ellipse cx="34" cy="101" rx="5" ry="3" fill="#FF9EB1"/><path d="M56 62 Q50 74 56 78 Q62 74 56 62 Z" fill="#9FD3FF"/><rect x="-14" y="30" width="28" height="22" rx="4" fill="#FFF6E9" stroke="#FF8A7A" stroke-width="1.5"/><rect x="-14" y="30" width="28" height="7" rx="3" fill="#FF8A7A"/><line x1="-6" y1="42" x2="6" y2="42" stroke="#FF8A7A" stroke-width="1.5"/>'
    },
    tidur: {
      back: '<path d="M-52 168 Q0 150 52 168 L52 172 Q52 202 22 202 L-22 202 Q-52 202 -52 172 Z" fill="#B9A4FF"/>',
      face: '<path d="M-5 115 Q0 118 5 115" fill="none" stroke="#5A3A22" stroke-width="1.5" stroke-linecap="round"/><path d="M-28 86 Q-22 90 -16 86" fill="none" stroke="#2B2B2B" stroke-width="2" stroke-linecap="round"/><path d="M16 86 Q22 90 28 86" fill="none" stroke="#2B2B2B" stroke-width="2" stroke-linecap="round"/><ellipse cx="-34" cy="101" rx="5" ry="3" fill="#FF9EB1"/><ellipse cx="34" cy="101" rx="5" ry="3" fill="#FF9EB1"/><text x="42" y="60" font-size="12" font-weight="700" fill="#7A6656" font-family="Nunito,sans-serif">z</text><text x="51" y="46" font-size="14" font-weight="700" fill="#7A6656" font-family="Nunito,sans-serif">z</text><text x="61" y="31" font-size="16" font-weight="700" fill="#7A6656" font-family="Nunito,sans-serif">z</text>'
    },
    ngambek: {
      back: '<ellipse cx="-4" cy="148" rx="34" ry="8" fill="#B07D4C" stroke="#8E5E36"/><ellipse cx="4" cy="157" rx="34" ry="8" fill="#B07D4C" stroke="#8E5E36"/><circle cx="-56" cy="52" r="6" fill="#ECE6DE" stroke="#BDB3A6"/><circle cx="-64" cy="40" r="4" fill="#ECE6DE" stroke="#BDB3A6"/><circle cx="56" cy="52" r="6" fill="#ECE6DE" stroke="#BDB3A6"/><circle cx="64" cy="40" r="4" fill="#ECE6DE" stroke="#BDB3A6"/>',
      face: '<path d="M-6 118 Q0 112 6 118" fill="none" stroke="#5A3A22" stroke-width="1.5" stroke-linecap="round"/><line x1="-31" y1="76" x2="-15" y2="83" stroke="#2B2B2B" stroke-width="3" stroke-linecap="round"/><line x1="31" y1="76" x2="15" y2="83" stroke="#2B2B2B" stroke-width="3" stroke-linecap="round"/><circle cx="-22" cy="90" r="3.5" fill="#2B2B2B"/><circle cx="22" cy="90" r="3.5" fill="#2B2B2B"/><ellipse cx="-34" cy="102" rx="7" ry="4" fill="#FF7A7A"/><ellipse cx="34" cy="102" rx="7" ry="4" fill="#FF7A7A"/><path d="M-4 40 Q0 44 -4 48 M8 40 Q4 44 8 48 M-2 38 Q2 42 6 38 M-2 50 Q2 46 6 50" fill="none" stroke="#E5484D" stroke-width="2.5" stroke-linecap="round"/>'
    },
    sedih: {
      under: '<circle cx="58" cy="194" r="10" fill="#FFB347" stroke="#E8912A"/><ellipse cx="64" cy="183" rx="5" ry="2.5" fill="#7FD8B5"/>',
      back: '<ellipse cx="-44" cy="160" rx="8" ry="14" fill="#B07D4C"/><ellipse cx="44" cy="160" rx="8" ry="14" fill="#B07D4C"/><ellipse cx="-44" cy="80" rx="10" ry="6" fill="#A87444"/><ellipse cx="44" cy="80" rx="10" ry="6" fill="#A87444"/>',
      noEars: true,
      face: '<path d="M-6 118 Q0 113 6 118" fill="none" stroke="#5A3A22" stroke-width="1.5" stroke-linecap="round"/><line x1="-30" y1="81" x2="-16" y2="76" stroke="#2B2B2B" stroke-width="2.5" stroke-linecap="round"/><line x1="30" y1="81" x2="16" y2="76" stroke="#2B2B2B" stroke-width="2.5" stroke-linecap="round"/><circle cx="-22" cy="89" r="4" fill="#2B2B2B"/><circle cx="22" cy="89" r="4" fill="#2B2B2B"/><circle cx="-20.5" cy="87.5" r="1.5" fill="#fff"/><circle cx="23.5" cy="87.5" r="1.5" fill="#fff"/><path d="M27 95 Q23 103 27 107 Q31 103 27 95 Z" fill="#9FD3FF"/><ellipse cx="-34" cy="101" rx="5" ry="3" fill="#FF9EB1"/><ellipse cx="-12" cy="32" rx="14" ry="10" fill="#D6DCE5"/><ellipse cx="6" cy="27" rx="16" ry="12" fill="#D6DCE5"/><ellipse cx="22" cy="33" rx="11" ry="8" fill="#D6DCE5"/><line x1="-10" y1="46" x2="-12" y2="53" stroke="#9FD3FF" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="44" x2="2" y2="51" stroke="#9FD3FF" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="45" x2="16" y2="52" stroke="#9FD3FF" stroke-width="2" stroke-linecap="round"/>'
    },
    marah: {
      back: '<ellipse cx="-46" cy="136" rx="8" ry="14" fill="#B07D4C"/><ellipse cx="46" cy="136" rx="8" ry="14" fill="#B07D4C"/><circle cx="-48" cy="122" r="8" fill="#A87444"/><circle cx="48" cy="122" r="8" fill="#A87444"/>',
      face: `<line x1="-33" y1="74" x2="-13" y2="82" stroke="#2B2B2B" stroke-width="3.5" stroke-linecap="round"/><line x1="33" y1="74" x2="13" y2="82" stroke="#2B2B2B" stroke-width="3.5" stroke-linecap="round"/><g transform="translate(-22,90)">${FLAME('#FF6B3D')}${FLAME_IN}</g><g transform="translate(22,90)">${FLAME('#FF6B3D')}${FLAME_IN}</g><ellipse cx="-35" cy="103" rx="7" ry="4" fill="#FF5C5C"/><ellipse cx="35" cy="103" rx="7" ry="4" fill="#FF5C5C"/><rect x="-9" y="110" width="18" height="8" rx="3" fill="#fff" stroke="#5A3A22" stroke-width="1.5"/><line x1="-3" y1="110" x2="-3" y2="118" stroke="#5A3A22"/><line x1="3" y1="110" x2="3" y2="118" stroke="#5A3A22"/><g transform="translate(0,46) scale(2)">${FLAME('#FF6B3D')}${FLAME_IN}</g><g transform="translate(-56,58) scale(1.1)">${FLAME('#FF8A4D')}</g><g transform="translate(56,58) scale(1.1)">${FLAME('#FF8A4D')}</g>`
    }
  };

  function ofaSVG(mood, size, label) {
    const p = OFA_PARTS[mood] || OFA_PARTS.senang;
    const w = size || 120, h = Math.round(w * 200 / 150);
    const ears = p.noEars ? '' : '<circle cx="-34" cy="66" r="9" fill="#A87444"/><circle cx="34" cy="66" r="9" fill="#A87444"/>';
    return `<svg width="${w}" height="${h}" viewBox="-75 10 150 200" role="img" aria-label="${label || `Ofa sedang ${mood}`}">` +
      (p.under || '') +
      '<ellipse cx="-22" cy="200" rx="12" ry="6" fill="#8E5E36"/><ellipse cx="22" cy="200" rx="12" ry="6" fill="#8E5E36"/>' +
      '<rect x="-52" y="110" width="104" height="92" rx="44" fill="#C8925E" stroke="#8E5E36"/><ellipse cx="0" cy="170" rx="30" ry="24" fill="#E3B888"/>' +
      p.back + ears +
      '<rect x="-44" y="62" width="88" height="66" rx="30" fill="#C8925E" stroke="#8E5E36"/><rect x="-26" y="94" width="52" height="30" rx="14" fill="#A87444"/>' +
      '<ellipse cx="-8" cy="104" rx="2.5" ry="2" fill="#5A3A22"/><ellipse cx="8" cy="104" rx="2.5" ry="2" fill="#5A3A22"/>' +
      p.face + '</svg>';
  }

  /* ---------- Suasana hati Ofa hari ini ---------- */
  function greetingWord(now) {
    const h = now.getHours();
    if (h < 11) return 'Pagi';
    if (h < 15) return 'Siang';
    if (h < 18) return 'Sore';
    return 'Malam';
  }

  function computeMood(data, now) {
    const name = data.profile.name || 'Nira';
    const todayS = ymd(now);
    const active = data.tasks.filter((t) => !t.skipped);
    const todayTasks = active.filter((t) => t.date === todayS);
    const doneToday = todayTasks.filter((t) => t.done).length;
    const overdue = active.filter((t) => !t.done && dueAt(t) < now && daysBetween(parseYMD(t.date), now) <= 30 &&
      (t.date < todayS || (t.time && now - dueAt(t) > 30 * 60000)));
    const tunda = active.find((t) => !t.done && (t.postponed || 0) >= 3);
    const soon = todayTasks.filter((t) => !t.done && t.time && dueAt(t) >= now && dueAt(t) - now <= 3 * 3600000)
      .sort((a, b) => dueAt(a) - dueAt(b))[0];
    const next = todayTasks.filter((t) => !t.done).sort((a, b) => dueAt(a) - dueAt(b))[0];
    const g = greetingWord(now);
    const neg = data.profile.moodsOn !== false;

    if (neg && now.getHours() >= 20 && todayTasks.length > 0 && doneToday === 0) {
      return { mood: 'marah', text: `${name}! Sudah malam dan belum ada satu pun jadwal yang dicentang. Ayo kerjakan satu dulu, Ofa tungguin!` };
    }
    if (neg && overdue.length) {
      return { mood: 'ngambek', text: `Hmph! Ada ${overdue.length} jadwal yang lewat tenggat, ${name}. Jadwal ulang yuk, biar Ofa nggak ngambek lagi.` };
    }
    if (neg && tunda) {
      return { mood: 'sedih', text: `"${tunda.title}" sudah ditunda ${tunda.postponed} kali, ${name}… Kita cicil sedikit hari ini, yuk?` };
    }
    if (soon) {
      return { mood: 'panik', text: `${name}, "${soon.title}" jam ${fmtTime(soon.time)} sebentar lagi! Ayo, ayo!` };
    }
    if (overdue.length) { // ekspresi negatif dimatikan
      return { mood: 'panik', text: `${name}, ada ${overdue.length} jadwal yang lewat tenggat. Yuk jadwal ulang.` };
    }
    if (todayTasks.length === 0) {
      return { mood: 'tidur', text: `Hari ini kosong, ${name}. Waktunya santai… atau catat rencana baru.` };
    }
    if (doneToday === todayTasks.length) {
      return { mood: 'senang', text: `Hebat, ${name}! Semua ${todayTasks.length} jadwal hari ini beres. Ofa bangga!` };
    }
    const sisa = todayTasks.length - doneToday;
    const nextTxt = next ? ` Berikutnya: ${next.title}${next.time ? ` jam ${fmtTime(next.time)}` : ''}.` : '';
    return { mood: 'senang', text: `${g}, ${name}! Ada ${sisa} jadwal lagi hari ini.${nextTxt} Semangat!` };
  }

  /* ---------- Rapor mingguan ---------- */
  /** until (Date, opsional): untuk minggu berjalan, hitung hanya jadwal yang sudah selesai
      atau yang tenggatnya sudah lewat, supaya Ofa tidak menilai jadwal yang belum waktunya. */
  function weekStats(data, weekStart, until) {
    const s = ymd(weekStart);
    const e = ymd(addDays(weekStart, 6));
    const list = data.tasks.filter((t) => !t.skipped && t.date >= s && t.date <= e &&
      (!until || t.done || dueAt(t) <= until));
    const done = list.filter((t) => t.done).length;
    const perProject = data.projects.map((p) => {
      const l = list.filter((t) => t.projectId === p.id);
      return { project: p, total: l.length, done: l.filter((t) => t.done).length };
    }).filter((x) => x.total > 0);
    return {
      start: s, end: e, total: list.length, done,
      pct: list.length ? Math.round((done / list.length) * 100) : 0,
      perProject,
      unfinished: list.filter((t) => !t.done).sort((a, b) => dueAt(a) - dueAt(b))
    };
  }

  function reportMood(st, data, isCurrent) {
    const name = data.profile.name || 'Nira';
    const neg = data.profile.moodsOn !== false;
    if (st.total === 0) return { mood: 'tidur', text: `Belum ada jadwal di minggu ini, ${name}. Ofa rebahan dulu ya.` };
    const sisa = st.total - st.done;
    if (st.pct === 100) return { mood: 'senang', text: `Sempurna, ${name}! Semua ${st.total} jadwal beres. ${isCurrent ? 'Pertahankan sampai Minggu, ya!' : 'Ini stiker untukmu!'}` };
    if (st.pct >= 70) return { mood: 'senang', text: `Keren, ${name}! ${st.done} dari ${st.total} jadwal beres. Tinggal ${sisa} lagi menuju minggu sempurna!` };
    if (st.pct >= 40) return { mood: 'panik', text: `Lumayan, ${name}! ${st.done} dari ${st.total} beres. Yuk kejar ${sisa} sisanya!` };
    if (neg) return { mood: 'marah', text: `${name}! Baru ${st.done} dari ${st.total} jadwal yang beres. Ayo bangkit, Ofa tunggu!` };
    return { mood: 'sedih', text: `Minggu yang berat ya, ${name}. Pelan-pelan kita atur ulang bareng.` };
  }

  function stickerCount(data, now) {
    if (!data.tasks.length) return 0;
    const thisWeek = startOfWeek(now);
    const first = data.tasks.reduce((min, t) => (t.date < min ? t.date : min), ymd(thisWeek));
    let w = startOfWeek(parseYMD(first)), n = 0;
    while (w < thisWeek) {
      const st = weekStats(data, w);
      if (st.total > 0 && st.done === st.total) n++;
      w = addDays(w, 7);
    }
    return n;
  }

  /* ---------- Pengingat ---------- */
  function phraseUntil(min) {
    if (min <= 0) return 'sekarang';
    if (min < 60) return `${min} menit lagi`;
    if (min < 1440) return `${Math.round(min / 60)} jam lagi`;
    return `${Math.round(min / 1440)} hari lagi`;
  }

  function dueReminders(data, now) {
    const out = [];
    for (const t of data.tasks) {
      if (t.done || t.skipped) continue;
      const p = data.projects.find((x) => x.id === t.projectId);
      if (!p) continue;
      if (p.mutedUntil && new Date(p.mutedUntil) > now) continue;
      const due = dueAt(t);
      for (const r of (t.reminders || p.reminders || [])) {
        let fireAt, label;
        if (r === 'pagi') {
          fireAt = parseYMD(t.date); fireAt.setHours(7, 0, 0, 0);
          if (fireAt > due) continue;
          label = t.time ? `hari ini jam ${fmtTime(t.time)}` : 'hari ini';
        } else {
          const min = Number(r);
          fireAt = new Date(due - min * 60000);
          label = phraseUntil(min);
        }
        const key = `${t.id}|${r}|${t.date}|${t.time || ''}`;
        if (fireAt <= now && now - fireAt < 12 * 3600000 && !data.fired[key]) {
          out.push({ key, task: t, project: p, title: `${p.name}: ${t.title}`, body: `Tenggat ${label}.` });
        }
      }
    }
    return out;
  }

  /* ---------- Google Calendar ---------- */
  function googleCalendarLink(task, projectName) {
    const d = task.date.replace(/-/g, '');
    let dates;
    if (task.time) {
      const s = dueAt(task), e = new Date(s.getTime() + 60 * 60000);
      const f = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
      dates = `${f(s)}/${f(e)}`;
    } else {
      dates = `${d}/${ymd(addDays(parseYMD(task.date), 1)).replace(/-/g, '')}`;
    }
    let tz = 'Asia/Jakarta';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* biarkan */ }
    const q = new URLSearchParams({ action: 'TEMPLATE', text: `[${projectName}] ${task.title}`, dates, ctz: tz,
      details: [task.note, task.link].filter(Boolean).join('\n') + (task.note || task.link ? '\n\n' : '') + 'Dari One for All' });
    return `https://calendar.google.com/calendar/render?${q.toString()}`;
  }

  const api = {
    HARI, HARI_PENDEK, BULAN, BULAN_PENDEK, PALET, PILIHAN_PENGINGAT,
    pad, ymd, parseYMD, addDays, startOfDay, startOfWeek, hm, fmtTime, fmtDateLong, fmtDateShort, daysBetween, dueAt,
    palet, defaultData, uid, parseQuick, ofaSVG, computeMood, weekStats, reportMood, stickerCount, dueReminders,
    googleCalendarLink, greetingWord
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OfaCore = api;
})(typeof window !== 'undefined' ? window : this);
