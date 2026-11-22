/* One for All — sinkron HP & laptop lewat Firebase (login Google + Firestore).
   Kalau Firebase tidak bisa dimuat (misalnya sedang offline), app tetap jalan dengan data di perangkat. */
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDocs, getDoc, onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const App = window.OfaApp;
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const state = { status: 'loading', user: null, error: null, lastSync: null };
const synced = { tasks: new Map(), projects: new Map(), notes: new Map(), profile: null };
let uid = null, unsubs = [], pushing = Promise.resolve();

const clean = (o) => JSON.parse(JSON.stringify(o));
const PROFILE_KEYS = ['name', 'summaryTime', 'moodsOn'];
const pickProfile = (p) => Object.fromEntries(PROFILE_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));

function emit(patch) {
  Object.assign(state, patch);
  window.dispatchEvent(new CustomEvent('ofa:sync-status', { detail: { ...state } }));
}

function userRef() { return doc(db, 'users', uid); }

/* ---------- Tulis perubahan lokal ke awan ---------- */
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => (op.del ? batch.delete(op.ref) : batch.set(op.ref, op.data)));
    await batch.commit();
  }
}

function collectChanges() {
  const d = App.getData();
  const ops = [];
  for (const [kind, list] of [['tasks', d.tasks], ['projects', d.projects], ['notes', d.notes || []]]) {
    const map = synced[kind];
    const ids = new Set();
    for (const item of list) {
      ids.add(item.id);
      const json = JSON.stringify(item);
      if (map.get(item.id) !== json) { ops.push({ ref: doc(userRef(), kind, item.id), data: clean(item) }); map.set(item.id, json); }
    }
    for (const id of [...map.keys()]) {
      if (!ids.has(id)) { ops.push({ ref: doc(userRef(), kind, id), del: true }); map.delete(id); }
    }
  }
  const prof = JSON.stringify(pickProfile(d.profile));
  if (prof !== synced.profile) { ops.push({ ref: userRef(), data: { profile: JSON.parse(prof), updatedAt: Date.now() } }); synced.profile = prof; }
  return ops;
}

function push() {
  if (!uid) return;
  const ops = collectChanges();
  if (!ops.length) return;
  pushing = pushing.then(() => commitOps(ops)).then(() => emit({ lastSync: Date.now(), error: null }))
    .catch((e) => emit({ error: pesanGalat(e) }));
}

/* ---------- Gabungkan data perangkat dengan data di awan (saat masuk) ---------- */
function mergeList(local, remote, lastSyncAt) {
  const byId = new Map(remote.map((x) => [x.id, x]));
  const out = [];
  for (const r of remote) {
    const l = local.find((x) => x.id === r.id);
    out.push(l && (l.updatedAt || 0) > (r.updatedAt || 0) ? l : r);
  }
  for (const l of local) {
    if (byId.has(l.id)) continue;
    // ada di perangkat tapi tidak di awan: baru dibuat di perangkat ini, atau sudah dihapus di perangkat lain
    if (!lastSyncAt || (l.updatedAt || 0) > lastSyncAt) out.push(l);
  }
  return out;
}

async function begin(user) {
  uid = user.uid;
  emit({ status: 'syncing', user: { name: user.displayName, email: user.email, photo: user.photoURL }, error: null });
  try {
    const [ts, ps, ns, prof] = await Promise.all([
      getDocs(collection(userRef(), 'tasks')), getDocs(collection(userRef(), 'projects')),
      getDocs(collection(userRef(), 'notes')), getDoc(userRef())
    ]);
    const rTasks = ts.docs.map((s) => s.data());
    const rProjects = ps.docs.map((s) => s.data());
    const rNotes = ns.docs.map((s) => s.data());
    const rProfile = prof.exists() ? prof.data().profile : null;
    const sameAccount = localStorage.getItem('ofa-sync-uid') === uid;
    const lastSyncAt = sameAccount ? Number(localStorage.getItem('ofa-sync-at') || 0) : 0;

    // catat keadaan awan sebagai titik awal, lalu gabungkan
    rTasks.forEach((t) => synced.tasks.set(t.id, JSON.stringify(t)));
    rProjects.forEach((p) => synced.projects.set(p.id, JSON.stringify(p)));
    rNotes.forEach((n) => synced.notes.set(n.id, JSON.stringify(n)));
    synced.profile = rProfile ? JSON.stringify(pickProfile(rProfile)) : null;

    App.applyRemote((d) => {
      d.tasks = mergeList(d.tasks, rTasks, lastSyncAt);
      if (rProjects.length) d.projects = mergeList(d.projects, rProjects, lastSyncAt);
      d.notes = mergeList(d.notes || [], rNotes, lastSyncAt);
      if (rProfile) Object.assign(d.profile, pickProfile(rProfile));
    });
    localStorage.setItem('ofa-sync-uid', uid);
    localStorage.setItem('ofa-sync-at', String(Date.now()));
    push(); // kirim yang hanya ada di perangkat ini
    listen();
    emit({ status: 'on', lastSync: Date.now() });
    if (!sameAccount) App.toast(rTasks.length ? 'Tersambung! Jadwal dari perangkat lain sudah masuk.' : 'Tersambung! Jadwal di perangkat ini sudah tersimpan online.');
  } catch (e) {
    emit({ status: 'on', error: pesanGalat(e) });
  }
}

/* ---------- Dengarkan perubahan dari perangkat lain ---------- */
function listen() {
  unsubs.forEach((u) => u()); unsubs = [];
  const apply = (kind) => (snap) => {
    const list = snap.docs.map((s) => s.data());
    if (kind === 'projects' && !list.length) return;
    const fresh = new Map(list.map((x) => [x.id, JSON.stringify(x)]));
    const map = synced[kind];
    const changed = list.length !== map.size || list.some((x) => map.get(x.id) !== fresh.get(x.id));
    synced[kind] = fresh;
    if (!changed) return;
    App.applyRemote((d) => { d[kind] = list; });
    localStorage.setItem('ofa-sync-at', String(Date.now()));
    emit({ lastSync: Date.now(), error: null });
  };
  unsubs.push(onSnapshot(collection(userRef(), 'tasks'), apply('tasks'), (e) => emit({ error: pesanGalat(e) })));
  unsubs.push(onSnapshot(collection(userRef(), 'projects'), apply('projects'), (e) => emit({ error: pesanGalat(e) })));
  unsubs.push(onSnapshot(collection(userRef(), 'notes'), apply('notes'), (e) => emit({ error: pesanGalat(e) })));
  unsubs.push(onSnapshot(userRef(), (s) => {
    const p = s.exists() ? s.data().profile : null;
    if (!p) return;
    const json = JSON.stringify(pickProfile(p));
    if (json === synced.profile) return;
    synced.profile = json;
    App.applyRemote((d) => { Object.assign(d.profile, pickProfile(p)); });
  }, (e) => emit({ error: pesanGalat(e) })));
}

function stop() {
  unsubs.forEach((u) => u()); unsubs = [];
  uid = null;
  synced.tasks.clear(); synced.projects.clear(); synced.notes.clear(); synced.profile = null;
}

function pesanGalat(e) {
  const code = (e && e.code) || '';
  if (code.includes('popup-closed')) return 'Jendela login ditutup sebelum selesai.';
  if (code.includes('network') || code === 'unavailable') return 'Sedang offline. Perubahan akan dikirim saat online lagi.';
  if (code.includes('unauthorized-domain')) return 'Alamat app ini belum diizinkan di Firebase.';
  if (code.includes('permission-denied')) return 'Akses ke data ditolak. Coba keluar lalu masuk lagi.';
  return 'Sinkron sedang bermasalah. Data tetap aman di perangkat ini.';
}

/* ---------- Masuk & keluar ---------- */
async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    emit({ error: null });
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e && e.code) || '';
    if (code.includes('popup-blocked') || code.includes('operation-not-supported') || code.includes('cancelled-popup')) {
      await signInWithRedirect(auth, provider);
    } else {
      emit({ error: pesanGalat(e) });
    }
  }
}

async function logOut() {
  await pushing.catch(() => {});
  stop();
  await signOut(auth);
  App.toast('Kamu sudah keluar. Jadwal tetap tersimpan di perangkat ini.');
}

window.OfaSync = { get state() { return { ...state }; }, signIn, signOut: logOut };
window.addEventListener('ofa:saved', push);

getRedirectResult(auth).catch((e) => emit({ error: pesanGalat(e) }));
onAuthStateChanged(auth, (user) => {
  if (user) { if (user.uid !== uid) begin(user); }
  else { stop(); emit({ status: 'off', user: null }); }
});
