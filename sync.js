/* sync.js — window.ZhSync: локальный журнал событий прогресса «Туши» + синхронизация с zh-talk.
 * Контракт: /root/chinese/tools/zhapp/CONTRACT.md («sync.js → window.ZhSync»).
 * Зависимость одна: window.ZhProgress (progress.js). ES2019, без сборки.
 * Хранилище: IndexedDB `zh_tush` (events по id, meta), без IndexedDB — localStorage `zh_tush_events` / `zh_tush_meta`.
 * Курсор чтения двигает только GET /progress/events; POST отправляет очередь пакетами ≤ 500 (повторы по id безопасны). */
(function () {
  'use strict';
  var G = typeof window !== 'undefined' ? window : globalThis;
  var DEF_API = 'https://rpg.lavanto.ru/zh-api/';
  var K = { api: 'zh_talk_api', key: 'zh_talk_key', dev: 'zh_tush_dev', migrated: 'zh_tush_migrated', seed: 'zh_tush_seed',
    events: 'zh_tush_events', meta: 'zh_tush_meta', srs: 'zh_srs_v1' };
  var BATCH = 500, BATCH_BYTES = 1500000, IDB_TIMEOUT = 1500;

  var opts = { delay: 2000 };
  var inited = false, bound = false, timer = null, inflight = null, chain = Promise.resolve(), bePromise = null;
  var devCache = '';
  var mem = { ev: new Map(), queue: new Set(), cursor: 0 };
  /* доступность журнала (для показа при недоступном IndexedDB, см. state):
   * idbDown — IndexedDB есть, но не открылся/не принял журнал LS, работаем на localStorage;
   * own — события, записанные record() в этой загрузке; foreign — пришедшие с сервера или из позднего IndexedDB */
  var idbDown = false, own = new Set(), foreign = new Set();
  /* перенос zh_srs_v1 в этой загрузке: промис ставится синхронно (повторы ждут его же);
   * seedUnsaved — seed этой загрузки ещё не записан в хранилище (zh_srs_v1 тогда не перезаписываем) */
  var migrating = null, seedUnsaved = false;
  var listeners = [];

  /* ---------- localStorage (всё в try/catch) ---------- */
  function lsGet(k) { try { return G.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { G.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function isInt(x) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x; }
  function noop() {}
  function tzNow() { return -new Date().getTimezoneOffset(); }
  function P() { return G.ZhProgress; }

  /* ---------- настройки, ключ, устройство ---------- */
  function apiBase() { return String(opts.api || lsGet(K.api) || DEF_API).replace(/\/*$/, '/'); }
  function getKey() { return String(opts.key || lsGet(K.key) || ''); }
  function takeKey() {
    var h = '';
    try { h = (G.location && G.location.hash) || ''; } catch (e) { h = ''; }
    var m = /(?:^#|[#&])key=([^&]+)/.exec(h);
    if (!m) return false;
    var v; try { v = decodeURIComponent(m[1]); } catch (e) { v = m[1]; }
    lsSet(K.key, v);
    try {
      var rest = h.replace(/^#/, '').split('&').filter(function (p) { return p && p.indexOf('key=') !== 0; }).join('&');
      G.history.replaceState(null, '', G.location.pathname + G.location.search + (rest ? '#' + rest : ''));
    } catch (e) { /* нет history */ }
    return true;
  }
  function device() {
    if (devCache) return devCache;
    var d = lsGet(K.dev);
    if (!d) {
      d = 'd' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      lsSet(K.dev, d);
    }
    devCache = d;
    return d;
  }

  /* ---------- хранилища ---------- */
  function lsBackend() {
    function readEv() { try { var a = JSON.parse(lsGet(K.events) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function readMeta() { try { var m = JSON.parse(lsGet(K.meta) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } }
    function writeMeta(m) { return lsSet(K.meta, JSON.stringify(m)); }
    return {
      kind: 'ls',
      load: function () {
        var m = readMeta();
        return Promise.resolve({ events: readEv(), queue: Array.isArray(m.queue) ? m.queue : [], cursor: +m.cursor || 0 });
      },
      add: function (evs, queued) {
        var a = readEv(), have = new Set(a.map(function (e) { return e && e.id; }));
        evs.forEach(function (e) { if (!have.has(e.id)) { a.push(e); have.add(e.id); } });
        // localStorage переполнен — запись не удалась: сообщаем вызывающему (флаг переноса не ставится)
        if (!lsSet(K.events, JSON.stringify(a))) return Promise.reject(new Error('ls_full'));
        if (queued) {
          var m = readMeta(), q = new Set(m.queue || []);
          evs.forEach(function (e) { q.add(e.id); });
          m.queue = Array.from(q);
          if (writeMeta(m) === false) return Promise.reject(new Error('ls_full'));
        }
        return Promise.resolve();
      },
      unqueue: function (ids) {
        var m = readMeta(), drop = new Set(ids);
        m.queue = (m.queue || []).filter(function (id) { return !drop.has(id); }); writeMeta(m);
        return Promise.resolve();
      },
      setCursor: function (c) { var m = readMeta(); m.cursor = c; writeMeta(m); return Promise.resolve(); }
    };
  }

  function idbBackend() {
    return new Promise(function (resolve, reject) {
      var idb = G.indexedDB;
      if (!idb) { reject(new Error('no indexedDB')); return; }
      var rq;
      try { rq = idb.open('zh_tush', 1); } catch (e) { reject(e); return; }
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      rq.onerror = function () { reject(rq.error || new Error('idb error')); };
      rq.onblocked = function () { reject(new Error('idb blocked')); };
      rq.onsuccess = function () {
        var db = rq.result;
        function run(mode, fn) {
          return new Promise(function (res, rej) {
            var tx, out = {};
            try { tx = db.transaction(['events', 'meta'], mode); } catch (e) { rej(e); return; }
            tx.oncomplete = function () { res(out); };
            tx.onerror = tx.onabort = function () { rej(tx.error || new Error('idb tx')); };
            try { fn(tx.objectStore('events'), tx.objectStore('meta'), out); } catch (e) { try { tx.abort(); } catch (e2) { /* */ } rej(e); }
          });
        }
        function mod(metaStore, k, fn) {
          var g = metaStore.get(k);
          g.onsuccess = function () { var cur = g.result ? g.result.v : null; metaStore.put({ k: k, v: fn(cur) }); };
        }
        resolve({
          kind: 'idb',
          load: function () {
            return run('readonly', function (ev, me, out) {
              var a = ev.getAll(); a.onsuccess = function () { out.events = a.result || []; };
              var q = me.get('queue'); q.onsuccess = function () { out.queue = q.result && Array.isArray(q.result.v) ? q.result.v : []; };
              var c = me.get('cursor'); c.onsuccess = function () { out.cursor = c.result ? +c.result.v || 0 : 0; };
            }).then(function (o) { return { events: o.events || [], queue: o.queue || [], cursor: o.cursor || 0 }; });
          },
          add: function (evs, queued) {
            return run('readwrite', function (ev, me) {
              evs.forEach(function (e) { ev.put(e); });
              if (queued) mod(me, 'queue', function (cur) {
                var q = new Set(Array.isArray(cur) ? cur : []); evs.forEach(function (e) { q.add(e.id); }); return Array.from(q);
              });
            });
          },
          unqueue: function (ids) {
            return run('readwrite', function (ev, me) {
              mod(me, 'queue', function (cur) { var drop = new Set(ids); return (Array.isArray(cur) ? cur : []).filter(function (id) { return !drop.has(id); }); });
            });
          },
          setCursor: function (c) { return run('readwrite', function (ev, me) { me.put({ k: 'cursor', v: c }); }); },
          /* слияние журнала из localStorage (загрузка, где IndexedDB не открылся вовремя): события по id,
           * очередь — объединение, курсор — минимальный (повторное чтение безопасно: дедупликация по id) */
          importLs: function (evs, queue, cursor) {
            return run('readwrite', function (ev, me) {
              evs.forEach(function (e) { if (e && typeof e.id === 'string') ev.put(e); });
              mod(me, 'queue', function (cur) {
                var q = new Set(Array.isArray(cur) ? cur : []); queue.forEach(function (id) { q.add(id); }); return Array.from(q);
              });
              mod(me, 'cursor', function (cur) { return Math.min(+cur || 0, +cursor || 0); });
            });
          }
        });
      };
    });
  }

  function lsRemove(k) { try { G.localStorage.removeItem(k); } catch (e) { /* */ } }
  /* IndexedDB выбран: всё, что осталось в localStorage-журнале (прошлые загрузки с таймаутом IDB), переносим в IDB
   * и только после успешной транзакции удаляем ключи LS. Перенос не удался — работаем на LS, ничего не теряя. */
  function adoptLs(b) {
    return lsBackend().load().then(function (s) {
      if (!s.events.length && !s.queue.length) return b;
      return b.importLs(s.events, s.queue, s.cursor).then(function () {
        lsRemove(K.events); lsRemove(K.meta); return b;
      }, function () { idbDown = true; return lsBackend(); });
    });
  }
  /* LS выбран по таймауту, а IDB открылся позже: его события и очередь подмешиваем в память только для чтения
   * (в IDB они остаются, на следующей загрузке IDB подберёт и журнал LS) */
  function lateIdb(b) {
    b.load().then(function (s) {
      var n = 0;
      (s.events || []).forEach(function (e) { if (e && typeof e.id === 'string' && !mem.ev.has(e.id)) { mem.ev.set(e.id, e); foreign.add(e.id); n++; } });
      (s.queue || []).forEach(function (id) { if (mem.ev.has(id) && !mem.queue.has(id)) { mem.queue.add(id); n++; } });
      if (n) { schedule(); emit(); }
    }, noop);
  }
  function getBe() {
    if (bePromise) return bePromise;
    if (opts.storage === 'ls') { bePromise = Promise.resolve(lsBackend()); return bePromise; }
    idbDown = false;
    bePromise = new Promise(function (resolve) {
      var done = false;
      function fallback(down) { if (!done) { done = true; idbDown = !!down; resolve(lsBackend()); } }
      var t = setTimeout(function () { fallback(true); }, IDB_TIMEOUT);
      idbBackend().then(function (b) {
        if (done) { lateIdb(b); return; }
        done = true; clearTimeout(t); resolve(adoptLs(b).catch(function () { idbDown = true; return lsBackend(); }));
      }, function () { clearTimeout(t); fallback(!!G.indexedDB); });
    });
    return bePromise;
  }
  /* все обращения к хранилищу идут по цепочке: порядок записи и чтения сохраняется */
  function io(fn) {
    var p = chain.then(function () { return getBe(); }).then(fn);
    chain = p.then(noop, noop);
    return p;
  }

  function refresh() {
    return io(function (b) { return b.load(); }).then(function (s) {
      var stored = new Set();
      (s.events || []).forEach(function (e) {
        if (!e || typeof e.id !== 'string') return;
        stored.add(e.id);
        if (!mem.ev.has(e.id)) mem.ev.set(e.id, e);
      });
      var q = new Set(s.queue || []);
      mem.queue.forEach(function (id) { if (!stored.has(id)) q.add(id); }); // записано в этой вкладке, но не дошло до хранилища
      mem.queue = q;
      if ((s.cursor || 0) > mem.cursor) mem.cursor = s.cursor;
    }, noop);
  }

  /* ---------- уведомления ---------- */
  function emit() { listeners.slice().forEach(function (cb) { try { cb(); } catch (e) { /* */ } }); }
  function onChange(cb) {
    if (typeof cb !== 'function') return noop;
    listeners.push(cb);
    return function () { listeners = listeners.filter(function (x) { return x !== cb; }); };
  }

  /* ---------- init ---------- */
  function ensureInit() { if (!inited) init(); }
  function init(o) {
    if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { opts[k] = o[k]; });
    if (o && o.storage && bePromise) bePromise = null;
    inited = true;
    try { takeKey(); } catch (e) { /* */ }
    if (!bound) {
      bound = true;
      try {
        G.addEventListener('hashchange', function () { if (takeKey()) schedule(); });
        G.addEventListener('online', function () { schedule(); });
        G.addEventListener('pagehide', function () { flush(); });
        if (G.document) G.document.addEventListener('visibilitychange', function () { if (G.document.visibilityState === 'hidden') flush(); });
      } catch (e) { /* нет window */ }
    }
    return { api: apiBase(), hasKey: !!getKey(), device: device() };
  }
  function flush() { if (getKey() && mem.queue.size) sync({ keepalive: true }).catch(noop); }
  function schedule() {
    if (timer || opts.delay == null || !getKey()) return;
    timer = setTimeout(function () { timer = null; sync().catch(noop); }, Math.max(0, +opts.delay || 0));
  }

  /* ---------- запись событий ---------- */
  function record(kind, fields) {
    try {
      ensureInit();
      var Pr = P();
      if (!Pr || typeof Pr.newEvent !== 'function') return null;
      var e = Pr.newEvent(kind, fields || {}, Date.now(), tzNow(), device());
      mem.ev.set(e.id, e); mem.queue.add(e.id); own.add(e.id);
      io(function (b) { return b.add([e], true); }).catch(noop);
      schedule();
      emit();
      return e;
    } catch (err) { return null; }
  }
  function events() {
    try { ensureInit(); } catch (e) { /* */ }
    return refresh().then(function () {
      return Array.from(mem.ev.values()).sort(function (a, b) { return (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    });
  }

  /* ---------- HTTP ---------- */
  function http(method, path, body, keepalive) {
    var f = opts.fetch || G.fetch;
    if (typeof f !== 'function') return Promise.resolve({ status: 0, ok: false, json: null, net: true });
    var headers = { Authorization: 'Bearer ' + getKey() }, payload;
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    var init = { method: method, headers: headers, body: payload };
    if (keepalive && payload && payload.length < 60000) init.keepalive = true;
    var p;
    try { p = Promise.resolve(f.call(G, apiBase() + path, init)); } catch (e) { return Promise.resolve({ status: 0, ok: false, json: null, net: true }); }
    return p.then(function (r) {
      return Promise.resolve(r.json()).then(function (j) { return j; }, function () { return null; }).then(function (j) {
        return { status: r.status, ok: !!r.ok, json: j, net: false };
      });
    }, function () { return { status: 0, ok: false, json: null, net: true }; });
  }
  function errName(r) {
    if (r.net) return 'network';
    if (r.status === 401) return 'auth';
    if (r.status === 429) return 'rate_limit';
    return 'http_' + r.status;
  }
  function pickBatch(limit) {
    var out = [], bytes = 0;
    var ids = Array.from(mem.queue);
    for (var i = 0; i < ids.length && out.length < limit; i++) {
      var e = mem.ev.get(ids[i]);
      if (!e) { mem.queue.delete(ids[i]); continue; }
      var n = JSON.stringify(e).length;
      if (out.length && bytes + n > BATCH_BYTES) break;
      out.push(e); bytes += n;
    }
    out.sort(function (a, b) { return (a.ts - b.ts) || (a.id < b.id ? -1 : 1); });
    return out;
  }

  function sync(o) {
    if (inflight) return inflight;
    var keepalive = !!(o && o.keepalive);
    inflight = doSync(keepalive).then(function (r) { inflight = null; return r; }, function (e) {
      inflight = null; return { pushed: 0, pulled: 0, ok: false, error: String(e && e.message || e) };
    });
    return inflight;
  }
  async function doSync(keepalive) {
    var res = { pushed: 0, pulled: 0, ok: false, error: null };
    try {
      ensureInit();
      await refresh();
      if (!getKey()) { res.error = 'no_key'; return res; }
      /* 1. отправка очереди; курсор от POST не берём */
      var limit = BATCH;
      for (var guard = 0; guard < 2000; guard++) {
        var batch = pickBatch(limit);
        if (!batch.length) break;
        var r = await http('POST', 'progress/events', { events: batch }, keepalive);
        var ids;
        if (r.ok) {
          ids = batch.map(function (e) { return e.id; });
          ids.forEach(function (id) { mem.queue.delete(id); });
          await io(function (b) { return b.unqueue(ids); }).catch(noop);
          res.pushed += batch.length;
          continue;
        }
        var bad = -1;
        if (r.status === 422 && r.json && isInt(r.json.index) && batch[r.json.index]) bad = r.json.index;
        else if ((r.status === 413 || r.status === 400) && batch.length === 1) bad = 0;
        else if ((r.status === 413 || r.status === 400) && batch.length > 1) { limit = Math.ceil(batch.length / 2); continue; }
        if (bad >= 0) { /* сервер не принимает именно это событие — не даём ему блокировать очередь */
          var dropId = batch[bad].id;
          mem.queue.delete(dropId);
          await io(function (b) { return b.unqueue([dropId]); }).catch(noop);
          res.dropped = (res.dropped || 0) + 1;
          continue;
        }
        res.error = errName(r);
        return res;
      }
      /* 2. чтение: since=курсор до more:false */
      for (var page = 0; page < 5000; page++) {
        var prev = mem.cursor;
        var g = await http('GET', 'progress/events?since=' + prev, undefined, false);
        if (!g.ok || !g.json) { res.error = errName(g); return res; }
        var evs = Array.isArray(g.json.events) ? g.json.events : [];
        var fresh = [], confirmed = [];
        evs.forEach(function (e) {
          if (!e || typeof e.id !== 'string') return;
          if (!mem.ev.has(e.id)) { mem.ev.set(e.id, e); foreign.add(e.id); fresh.push(e); }
          if (mem.queue.has(e.id)) { mem.queue.delete(e.id); confirmed.push(e.id); }
        });
        if (fresh.length) await io(function (b) { return b.add(fresh, false); }).catch(noop);
        if (confirmed.length) await io(function (b) { return b.unqueue(confirmed); }).catch(noop);
        var c = g.json.cursor;
        if (isInt(c) && c > prev) { mem.cursor = c; await io(function (b) { return b.setCursor(c); }).catch(noop); }
        res.pulled += fresh.length;
        if (g.json.more !== true || !(mem.cursor > prev)) break;
      }
      res.ok = true;
      return res;
    } catch (e) {
      res.error = String(e && e.message || e);
      return res;
    } finally {
      if (res.pushed || res.pulled) emit();
    }
  }

  /* ---------- перенос старого zh_srs_v1 ---------- */
  function srsObj(raw) {
    var o = null;
    try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
    return o && typeof o === 'object' && Object.keys(o).length ? o : null;
  }
  function frozenSeed() {               // замороженный seed первого переноса (zh_tush_seed) или null
    var o = null;
    try { o = JSON.parse(lsGet(K.seed) || 'null'); } catch (e) { o = null; }
    return o && typeof o === 'object' && o.kind === 'srs_seed' && typeof o.id === 'string' && o.srs && typeof o.srs === 'object' ? o : null;
  }
  function ownSeed(list, id) {         // srs_seed этого браузера (устройство = zh_tush_dev, общий для вкладок) или тот же seed по id
    var dev = device();
    return list.some(function (e) { return e && e.kind === 'srs_seed' && (e.dev === dev || e.id === id); });
  }
  /* seed создаётся только здесь. Флаг zh_tush_migrated — только после записи seed в хранилище; до этого повторы в
   * пределах загрузки ловит промис migrating. Проверка «seed уже есть» и запись идут одной операцией цепочки io,
   * поэтому ответы этой загрузки попадают в хранилище после seed.
   * Seed замораживается при первом создании: событие синхронно, до любой async-записи и до первого ответа страницы,
   * сохраняется в zh_tush_seed (не удаляется). Повторная попытка (запись не удалась, флага нет) дописывает то же
   * событие с тем же id, а не строит новое из zh_srs_v1, уже изменённого ответами старой страницы: сервер и журнал
   * дедуплицируют по id, двух разных seed с одного браузера нет. */
  function migrateLegacy() {
    try {
      ensureInit();
      var Pr = P();
      if (!Pr || typeof Pr.fromLegacy !== 'function') return Promise.resolve(false); // без progress.js: флаг не ставим, ничего не пишем
      if (migrating) return migrating.then(function () { return false; });
      if (lsGet(K.migrated)) return Promise.resolve(false);
      var e = frozenSeed();
      if (!e) {                          // первая попытка переноса: seed из сырого zh_srs_v1
        var raw = lsGet(K.srs), obj = srsObj(raw);
        if (!obj) { lsSet(K.migrated, '1'); return Promise.resolve(false); }
        var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
        var bk = K.srs + '_backup_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
        if (lsGet(bk) == null) lsSet(bk, raw);
        e = Pr.fromLegacy(obj, Date.now(), tzNow(), device());
        lsSet(K.seed, JSON.stringify(e)); // заморозка; не удалась (localStorage переполнен) — перенос как раньше
      }
      seedUnsaved = true;
      migrating = io(function (b) {
        return b.load().then(function (s) {
          if (ownSeed(s.events || [], e.id) || ownSeed(Array.from(mem.ev.values()), e.id)) return false; // seed уже в журнале (другая вкладка)
          mem.ev.set(e.id, e); mem.queue.add(e.id);
          return b.add([e], true).then(function () { return true; });
        });
      }).then(function (made) {
        seedUnsaved = false;
        lsSet(K.migrated, '1');
        if (made) { schedule(); emit(); }
        return made;
      }, function () {                   // запись не удалась: флаг не ставим, zh_srs_v1 остаётся сырым до следующей загрузки
        if (!mem.ev.has(e.id)) { mem.ev.set(e.id, e); mem.queue.add(e.id); }
        emit();
        return true;
      });
      return migrating;
    } catch (err) { return Promise.resolve(false); }
  }

  /* журнал доступен: в нём seed, или события с сервера / из позднего IndexedDB, или (IndexedDB в порядке)
   * хоть одно событие не из этой загрузки. Иначе (IndexedDB не прочитан или журнал пуст) — показ по виртуальному seed */
  function journalReady(evs) {
    return evs.some(function (e) { return e.kind === 'srs_seed' || foreign.has(e.id) || (!idbDown && !own.has(e.id)); });
  }

  /* ---------- производное состояние ---------- */
  async function state(words, hsk) {
    ensureInit();
    var Pr = P();
    if (!Pr || typeof Pr.replay !== 'function') return null;   // без progress.js zh_srs_v1 не трогаем
    await migrateLegacy();               // иначе пересчёт затёр бы несохранённый прогресс zh_srs_v1
    var evs = await events();
    var done = !!lsGet(K.migrated) && !seedUnsaved;
    var legacy = done ? srsObj(lsGet(K.srs)) : null;
    /* виртуальный seed из zh_srs_v1: только для показа — не в памяти, не в хранилище, не на сервер */
    var virt = !!legacy && typeof Pr.fromLegacy === 'function' && !journalReady(evs);
    var list = virt ? [Pr.fromLegacy(legacy, 0, tzNow(), device())].concat(evs) : evs;
    var ro = {}; if (hsk) ro.hsk = hsk;
    var st = Pr.replay(list, words || [], ro);
    var out = st.srs || {};
    // zh_srs_v1 пишем только после надёжного переноса и не в режиме виртуального seed; непустой — пустым не затираем
    if (done && !virt && (Object.keys(out).length || !srsObj(lsGet(K.srs)))) { try { lsSet(K.srs, JSON.stringify(out)); } catch (e) { /* */ } }
    return st;
  }

  var api = {
    init: init, device: device, record: record, events: events, sync: sync, migrateLegacy: migrateLegacy,
    state: state, onChange: onChange,
    hasKey: function () { return !!getKey(); },
    pending: function () { return mem.queue.size; }
  };
  G.ZhSync = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  try { init(); } catch (e) { /* */ }
})();
