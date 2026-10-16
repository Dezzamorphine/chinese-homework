/* zhapp/progress.js — правила прогресса «Тушь» (волна 1).
 *
 * Контракт: /root/chinese/tools/zhapp/CONTRACT.md, PRD: /root/docs/private/2026-10-16-zh-app-tush.md.
 * UMD: window.ZhProgress в браузере, module.exports в node. ES2019, без зависимостей, без DOM и сети.
 * Всё производное считается из журнала событий функцией replay(); она детерминирована:
 * дедуп по id (остаётся первое вхождение), сортировка по (ts, id).
 *
 * Принятые толкования мест, где контракт допускает варианты (самое простое прозрачное):
 *  1. srs_seed: сначала сливаются ВСЕ seed-события (по слову побеждает больший n, затем больший d, затем
 *     больший b, затем больший l — порядок seed не важен), потом поверх применяются answer в порядке (ts, id).
 *  2. answer любого mode обновляет SRS (как grade() старых страниц: n++ всегда, l++ при ошибке).
 *  3. XP за answer: mode learn/card/test/review — база 2 (review в таблице XP не назван, считаем как карточку);
 *     первый в жизни ok по слову — 5, ok по просроченному (d < day до ответа) — 3; boss/tone/listen — 1 без
 *     надбавок; неизвестный mode — 0. «Первый в жизни ok» — у слова нет ни одного прежнего ok-ответа любого
 *     mode и в слитом seed b < 1. Потолок «3 раза в день» считает только ответы, принёсшие XP > 0.
 *  4. Пройдено (passed) — слово имеет хотя бы один ok-ответ или seed с b ≥ 1; не убывает.
 *  5. Задания дня фиксируются при ПЕРВОМ событии локального дня (состояние перед ним); если событий за
 *     today нет — строятся из итогового состояния. Прогресс — по событиям этого дня, XP — один раз.
 *     (1) «повторить»: слова с d ≤ day (просроченные и ошибочные сегодня), по (d, hz), N = min(20, их число);
 *         прогресс — сколько разных слов из этого списка получили ok за день.
 *         Если таких 0 — «выучить новые»: текущий урок = урок последнего события с полем lesson, если в нём
 *         есть непройденные слова, иначе первый по порядку words урок с непройденными; цель = min(10, непройденных),
 *         прогресс — разные слова урока с первым в жизни ok за день. Непройденных нигде нет — цель 0, не
 *         выполняется и XP не даёт.
 *     (2) «тема»: среди начатых (passed > 0) тема с минимальной прочностью, при равенстве — первая по порядку
 *         words; начатых нет — первая тема. Прогресс — число ok-ответов (не разных) по словам темы.
 *     (3) «тоны или разговор»: выполнено, если за день есть 10 ok-событий kind=tone подряд ИЛИ 3 talk_turn.
 *         Показывается вариант, который ближе к цели (variant: 'tones' | 'talk'). answer mode=tone сюда не идёт.
 *  6. Серия: день засчитан при сумме session.seconds ≥ 120 или ≥ 10 answer. Заморозка +1 при каждом
 *     streak % 7 === 0 (максимум 2); пропущенный прошедший день тратит заморозку (серия не растёт и не рвётся),
 *     без заморозки серия = 0. Сегодня не засчитан — серия до вчера.
 *  7. week: скользящие 7 локальных дней [today-6..today] и предыдущие 7; XP задания — в его день.
 *  8. Уровень 50 — потолок: levelXp = остаток сверх, nextLevelXp = null.
 *  9. Печати постоянны (условие хоть раз выполнялось): words100/300/600 и hsk1 отслеживаются по ходу replay;
 *     tones100 — 100 ok-событий kind=tone; talk_clean — сессия talk_turn, где у всех реплик corrected === false.
 * 10. stages считаются по объединению слов из words и записей srs; new — слова из words без записи.
 * 11. boss.best — лучшая доля score/total (0..1); XP 100 только при первом score/total ≥ 0.8 по уроку.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZhProgress = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IV = [0, 1, 2, 4, 7, 15, 30, 60];
  var B_MAX = IV.length - 1;
  var DAY_MS = 86400000;
  var MAX_LEVEL = 50;
  var XP_BASE2 = { learn: 1, card: 1, test: 1, review: 1 };
  var XP_BASE1 = { boss: 1, tone: 1, listen: 1 };
  var WORD_XP_TIMES_PER_DAY = 3;
  var TALK_XP = 3, TALK_XP_DAY_CAP = 60, TONE_XP = 1, BOSS_XP = 100, BOSS_PASS = 0.8;
  var STREAK_SECONDS = 120, STREAK_ANSWERS = 10, FREEZE_EVERY = 7, FREEZE_MAX = 2;
  var DEFAULT_GOAL = 10;
  var BOSS_SIZE = 25;
  var TEST_TYPES = ['zh2ru', 'ru2zh', 'audio', 'py'];
  var SEALS = ['words100', 'words300', 'words600', 'hsk1', 'boss1', 'streak7', 'streak30', 'talk_clean', 'tones100'];
  var MATURE_SEALS = [['words100', 100], ['words300', 300], ['words600', 600]];

  function dayOf(ts, tz) { return Math.floor((ts + (tz || 0) * 60000) / DAY_MS); }
  function localTz() { return -new Date().getTimezoneOffset(); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function stageOf(rec) {
    if (!rec) return 'new';
    var b = rec.b;
    return b <= 2 ? 'learning' : b <= 4 ? 'familiar' : b === 5 ? 'strong' : 'mature';
  }
  function strengthOf(rec, today) {
    if (!rec) return 0;
    var s = rec.b / B_MAX;
    if (rec.d < today) s *= Math.pow(0.5, (today - rec.d) / Math.max(IV[rec.b], 1));
    return s;
  }
  function levelCost(L) { return 200 + 100 * L; }
  function levelFromXp(xp) {
    var L = 1, rest = xp;
    while (L < MAX_LEVEL && rest >= levelCost(L)) { rest -= levelCost(L); L++; }
    return { level: L, levelXp: rest, nextLevelXp: L < MAX_LEVEL ? levelCost(L) : null };
  }

  function cleanRec(r) {
    if (!r || typeof r !== 'object' || !isNum(r.b) || !isNum(r.d)) return null;
    var b = Math.max(0, Math.min(B_MAX, Math.floor(r.b)));
    return { b: b, d: Math.floor(r.d), n: isNum(r.n) ? Math.floor(r.n) : 0, l: isNum(r.l) ? Math.floor(r.l) : 0 };
  }
  function seedBetter(a, c) { // a лучше текущей c?
    if (a.n !== c.n) return a.n > c.n;
    if (a.d !== c.d) return a.d > c.d;
    if (a.b !== c.b) return a.b > c.b;
    return a.l > c.l;
  }

  /* Индекс слов: уроки → темы → id. Порядок — порядок первого появления в words. */
  function buildIndex(words) {
    var lessons = new Map(), topics = [], topicByKey = new Map(), ids = [], idSet = new Set();
    (words || []).forEach(function (w) {
      if (!w || typeof w.id !== 'string') return;
      var lesson = w.lesson == null ? '' : String(w.lesson);
      var ti = isNum(w.topic) ? w.topic : 0;
      if (!idSet.has(w.id)) { idSet.add(w.id); ids.push(w.id); }
      var L = lessons.get(lesson);
      if (!L) { L = { id: lesson, ids: [], set: new Set(), topics: [] }; lessons.set(lesson, L); }
      if (!L.set.has(w.id)) { L.set.add(w.id); L.ids.push(w.id); }
      var key = lesson + '\u0001' + ti, T = topicByKey.get(key);
      if (!T) { T = { lesson: lesson, topic: ti, ids: [], set: new Set() }; topicByKey.set(key, T); topics.push(T); L.topics.push(T); }
      if (!T.set.has(w.id)) { T.set.add(w.id); T.ids.push(w.id); }
    });
    return { lessons: lessons, topics: topics, ids: ids };
  }

  function avgOver(ids, srs, today, everOk) {
    var n = ids.length, p = 0, s = 0;
    for (var i = 0; i < n; i++) {
      if (everOk.has(ids[i])) p++;
      s += strengthOf(srs.get(ids[i]), today);
    }
    return { passed: n ? p / n : 0, strength: n ? s / n : 0, started: p > 0 };
  }

  function replay(events, words, opts) {
    opts = opts || {};
    var today = isNum(opts.today) ? opts.today : dayOf(Date.now(), localTz());
    var idx = buildIndex(words);
    var hsk = opts.hsk && typeof opts.hsk === 'object' ? opts.hsk : null;

    // дедуп по id + сортировка (ts, id)
    var seen = new Set(), list = [];
    (events || []).forEach(function (e) {
      if (!e || typeof e.id !== 'string' || !isNum(e.ts) || seen.has(e.id)) return;
      seen.add(e.id); list.push(e);
    });
    list.sort(function (a, b) { return a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });

    var srs = new Map(), everOk = new Set();
    // 1) слияние всех seed
    list.forEach(function (e) {
      if (e.kind !== 'srs_seed' || !e.srs || typeof e.srs !== 'object') return;
      Object.keys(e.srs).forEach(function (hz) {
        var r = cleanRec(e.srs[hz]); if (!r) return;
        var c = srs.get(hz);
        if (!c || seedBetter(r, c)) srs.set(hz, r);
      });
    });
    srs.forEach(function (r, hz) { if (r.b >= 1) everOk.add(hz); });

    // счётчики для постоянных печатей
    var hsk1 = hsk && Array.isArray(hsk['1']) ? new Set(hsk['1']) : null;
    var matureNow = 0, matureMax = 0, hsk1Known = 0, hsk1Reached = false;
    srs.forEach(function (r, hz) { if (r.b >= 6) matureNow++; if (hsk1 && hsk1.has(hz) && r.b >= 3) hsk1Known++; });
    function checkMarks() {
      if (matureNow > matureMax) matureMax = matureNow;
      if (hsk1 && hsk1.size > 0 && hsk1Known === hsk1.size) hsk1Reached = true;
    }
    checkMarks();

    var xp = 0, xpByDay = new Map(), wordXpTimes = new Map(), talkXpByDay = new Map();
    var answersByDay = new Map(), secondsByDay = new Map();
    var goal = DEFAULT_GOAL, currentLesson = null;
    var boss = new Map(), tonesOk = 0, talkSessions = new Map();
    var questDays = new Map();

    function addXp(day, x) { if (x <= 0) return; xp += x; xpByDay.set(day, (xpByDay.get(day) || 0) + x); }
    function bump(map, day, x) { map.set(day, (map.get(day) || 0) + x); }

    function genQuests(day) {
      // (1) повторение или новые
      var q1;
      // первые 20 должных по (d, hz) без полной сортировки (genQuests зовётся на каждый день журнала)
      var dueCount = 0, top = [];
      srs.forEach(function (r, hz) {
        if (r.d > day) return;
        dueCount++;
        var last = top.length === 20 ? top[19] : null;
        if (last && (r.d > last[0] || (r.d === last[0] && hz > last[1]))) return;
        var pos = top.length;
        while (pos > 0 && (top[pos - 1][0] > r.d || (top[pos - 1][0] === r.d && top[pos - 1][1] > hz))) pos--;
        top.splice(pos, 0, [r.d, hz]);
        if (top.length > 20) top.pop();
      });
      if (dueCount) {
        var N = top.length, list1 = top.map(function (x) { return x[1]; });
        q1 = { id: 'review', title: 'Повторить ' + N + ' слов', target: N, xp: 30, progress: 0, done: false,
          words: list1, _set: new Set(list1), _got: new Set() };
      } else {
        var L = null;
        var cur = currentLesson != null ? idx.lessons.get(currentLesson) : null;
        var unpassed = function (Lx) { return Lx.ids.filter(function (hz) { return !everOk.has(hz); }).length; };
        if (cur && unpassed(cur) > 0) L = cur;
        else idx.lessons.forEach(function (Lx) { if (!L && unpassed(Lx) > 0) L = Lx; });
        var target = L ? Math.min(10, unpassed(L)) : 0;
        q1 = { id: 'new', title: target ? 'Выучить ' + target + ' новых слов урока' : 'Новых слов нет',
          target: target, xp: 30, progress: 0, done: false, lesson: L ? L.id : null, _set: L ? L.set : new Set() };
      }
      // (2) самая слабая начатая тема
      var best = null, bestS = Infinity;
      for (var i = 0; i < idx.topics.length; i++) {
        var T = idx.topics[i], started = false;
        for (var j = 0; j < T.ids.length && !started; j++) started = everOk.has(T.ids[j]);
        if (!started) continue;
        var a = avgOver(T.ids, srs, day, everOk);
        if (a.strength < bestS) { bestS = a.strength; best = T; }
      }
      if (!best && idx.topics.length) best = idx.topics[0];
      var q2 = { id: 'topic', title: '15 верных ответов по слабой теме', target: 15, xp: 30, progress: 0, done: false,
        lesson: best ? best.lesson : null, topic: best ? best.topic : null, _set: best ? best.set : new Set() };
      // (3) тоны или разговор
      var q3 = { id: 'tones', title: 'Тоны: 10 верных подряд', target: 10, xp: 40, progress: 0, done: false,
        variant: 'tones', _run: 0, _best: 0, _talk: 0 };
      return [q1, q2, q3];
    }
    function questsFor(day) {
      var q = questDays.get(day);
      if (!q) { q = genQuests(day); questDays.set(day, q); }
      return q;
    }
    function settle(q, day) {
      if (!q.done && q.target > 0 && q.progress >= q.target) { q.done = true; addXp(day, q.xp); }
    }
    function settleQ3(q, day) {
      var tonesDone = q._best >= 10, talkDone = q._talk >= 3;
      if (q._talk / 3 > q._best / 10) { q.variant = 'talk'; q.title = 'Разговор: 3 реплики'; q.target = 3; q.progress = Math.min(q._talk, 3); }
      else { q.variant = 'tones'; q.title = 'Тоны: 10 верных подряд'; q.target = 10; q.progress = Math.min(q._best, 10); }
      if (!q.done && (tonesDone || talkDone)) { q.done = true; addXp(day, q.xp); }
    }

    // 2) остальные события по порядку
    for (var k = 0; k < list.length; k++) {
      var e = list[k];
      if (e.kind === 'srs_seed') continue;
      var day = dayOf(e.ts, isNum(e.tz) ? e.tz : 0);
      var Q = questsFor(day);
      if (e.lesson != null && e.kind !== 'settings') currentLesson = String(e.lesson);

      if (e.kind === 'answer') {
        var hz = e.word;
        if (typeof hz !== 'string' || !hz) continue;
        var ok = e.ok === true, rec = srs.get(hz);
        var oldB = rec ? rec.b : -1, wasOverdue = rec ? rec.d < day : false, first = ok && !everOk.has(hz);
        if (!rec) { rec = { b: 0, d: day, n: 0, l: 0 }; srs.set(hz, rec); }
        rec.n++;
        if (ok) { rec.b = Math.min(rec.b + 1, B_MAX); rec.d = day + IV[rec.b]; }
        else { rec.l++; rec.b = Math.max(0, rec.b - 2); rec.d = day; }
        if ((oldB >= 6) !== (rec.b >= 6)) matureNow += rec.b >= 6 ? 1 : -1;
        if (hsk1 && hsk1.has(hz) && (oldB >= 3) !== (rec.b >= 3)) hsk1Known += rec.b >= 3 ? 1 : -1;
        checkMarks();

        var x = 0;
        if (ok) {
          if (XP_BASE2[e.mode] === 1) x = first ? 5 : wasOverdue ? 3 : 2;
          else if (XP_BASE1[e.mode] === 1) x = 1;
        }
        if (x > 0) {
          var wk = hz + '\u0001' + day, times = wordXpTimes.get(wk) || 0;
          if (times < WORD_XP_TIMES_PER_DAY) { wordXpTimes.set(wk, times + 1); addXp(day, x); }
        }
        if (ok) everOk.add(hz);
        bump(answersByDay, day, 1);

        if (ok) {
          var q1 = Q[0];
          if (q1.id === 'review') { if (q1._set.has(hz) && !q1._got.has(hz)) { q1._got.add(hz); q1.progress++; } }
          else if (first && q1._set.has(hz)) q1.progress++;
          settle(q1, day);
          if (Q[1]._set.has(hz)) { Q[1].progress++; settle(Q[1], day); }
        }
      } else if (e.kind === 'session') {
        if (isNum(e.seconds) && e.seconds > 0) bump(secondsByDay, day, e.seconds);
      } else if (e.kind === 'talk_turn') {
        var talkGot = talkXpByDay.get(day) || 0, add = Math.min(TALK_XP, TALK_XP_DAY_CAP - talkGot);
        if (add > 0) { talkXpByDay.set(day, talkGot + add); addXp(day, add); }
        var sk = String(e.session), sess = talkSessions.get(sk);
        if (!sess) { sess = { clean: true }; talkSessions.set(sk, sess); }
        if (e.corrected !== false) sess.clean = false;
        Q[2]._talk++; settleQ3(Q[2], day);
      } else if (e.kind === 'tone') {
        var q3 = Q[2];
        if (e.ok === true) { tonesOk++; addXp(day, TONE_XP); q3._run++; if (q3._run > q3._best) q3._best = q3._run; }
        else q3._run = 0;
        settleQ3(q3, day);
      } else if (e.kind === 'boss') {
        var lid = String(e.lesson), br = boss.get(lid) || { passed: false, best: 0 };
        var ratio = isNum(e.score) && isNum(e.total) && e.total > 0 ? e.score / e.total : 0;
        if (ratio > br.best) br.best = ratio;
        if (ratio >= BOSS_PASS && !br.passed) { br.passed = true; addXp(day, BOSS_XP); }
        boss.set(lid, br);
      } else if (e.kind === 'settings') {
        if (isNum(e.goal_minutes) && e.goal_minutes > 0) goal = e.goal_minutes;
      }
    }

    // серия и заморозки
    var counted = new Set(), minDay = Infinity;
    function markCounted(d) { if (d <= today) { counted.add(d); if (d < minDay) minDay = d; } }
    secondsByDay.forEach(function (s, d) { if (s >= STREAK_SECONDS) markCounted(d); });
    answersByDay.forEach(function (n, d) { if (n >= STREAK_ANSWERS) markCounted(d); });
    var streak = 0, freezes = 0, maxStreak = 0;
    for (var d = minDay; d <= today && isFinite(minDay); d++) {
      if (counted.has(d)) {
        streak++;
        if (streak % FREEZE_EVERY === 0) freezes = Math.min(FREEZE_MAX, freezes + 1);
        if (streak > maxStreak) maxStreak = streak;
      } else if (d < today) {
        if (freezes > 0) freezes--;
        else streak = 0;
      }
    }

    // уроки и темы
    var lessonsOut = {};
    idx.lessons.forEach(function (L) {
      var a = avgOver(L.ids, srs, today, everOk), maxT = -1;
      L.topics.forEach(function (T) { if (T.topic > maxT) maxT = T.topic; });
      var topics = [];
      for (var t = 0; t <= maxT; t++) topics.push({ passed: 0, strength: 0 });
      L.topics.forEach(function (T) { var b = avgOver(T.ids, srs, today, everOk); topics[T.topic] = { passed: b.passed, strength: b.strength }; });
      var br = boss.get(L.id);
      lessonsOut[L.id] = { passed: a.passed, strength: a.strength, topics: topics,
        boss: br ? { passed: br.passed, best: br.best } : { passed: false, best: 0 } };
    });

    // ступени, due, srs наружу
    var stages = { new: 0, learning: 0, familiar: 0, strong: 0, mature: 0 };
    idx.ids.forEach(function (hz) { if (!srs.has(hz)) stages.new++; });
    var srsOut = {}, due = [];
    srs.forEach(function (r, hz) {
      stages[stageOf(r)]++;
      srsOut[hz] = { b: r.b, d: r.d, n: r.n, l: r.l };
      if (r.d <= today) due.push([r.d, hz]);
    });
    due.sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0); });

    // HSK
    var hskOut = {};
    if (hsk) Object.keys(hsk).forEach(function (lv) {
      if (!Array.isArray(hsk[lv])) return; // служебные поля файла (source, license, version)
      var arr = Array.from(new Set(hsk[lv])), known = 0;
      arr.forEach(function (hz) { var r = srs.get(hz); if (r && r.b >= 3) known++; });
      hskOut[lv] = { known: known, total: arr.length };
    });

    // печати
    var got = new Set();
    MATURE_SEALS.forEach(function (m) { if (matureMax >= m[1]) got.add(m[0]); });
    if (hsk1Reached) got.add('hsk1');
    boss.forEach(function (b) { if (b.passed) got.add('boss1'); });
    if (maxStreak >= 7) got.add('streak7');
    if (maxStreak >= 30) got.add('streak30');
    talkSessions.forEach(function (s) { if (s.clean) got.add('talk_clean'); });
    if (tonesOk >= 100) got.add('tones100');
    var seals = SEALS.filter(function (s) { return got.has(s); });

    // задания сегодня
    var todayQ = questDays.get(today) || genQuests(today);
    var quests = todayQ.map(function (q) {
      var o = { id: q.id, title: q.title, progress: q.progress, target: q.target, xp: q.xp, done: q.done };
      if (q.words) o.words = q.words.slice();
      if (q.id === 'new') o.lesson = q.lesson;
      if (q.id === 'topic') { o.lesson = q.lesson; o.topic = q.topic; }
      if (q.id === 'tones') o.variant = q.variant;
      return o;
    });

    var week = { xp: 0, prevXp: 0 };
    xpByDay.forEach(function (v, d) {
      if (d <= today && d > today - 7) week.xp += v;
      else if (d <= today - 7 && d > today - 14) week.prevXp += v;
    });
    var calendar = {};
    secondsByDay.forEach(function (s, d) { calendar[d] = s / 60; });
    var todayMinutes = (secondsByDay.get(today) || 0) / 60;
    var lv = levelFromXp(xp);

    return {
      today: today,
      srs: srsOut,
      xp: xp, level: lv.level, levelXp: lv.levelXp, nextLevelXp: lv.nextLevelXp,
      streak: streak, freezes: freezes,
      todayMinutes: todayMinutes, goalMinutes: goal, goalDone: todayMinutes >= goal,
      quests: quests,
      lessons: lessonsOut,
      stages: stages,
      hsk: hskOut,
      seals: seals,
      due: due.map(function (x) { return x[1]; }),
      week: week,
      calendar: calendar
    };
  }

  /* Экзамен урока: min(25, слов) разных слов, поровну из тем (по кругу, остаток — первым темам),
     детерминированно от seed; тип вопроса — из типов «Теста». */
  function hashSeed(seed) {
    var s = String(seed), h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function rng(seed) {
    var a = hashSeed(seed);
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function bossQuestions(lesson, words, seed) {
    var idx = buildIndex((words || []).filter(function (w) { return w && String(w.lesson) === String(lesson); }));
    var L = idx.lessons.get(String(lesson));
    if (!L) return [];
    var rnd = rng(String(lesson) + '|' + String(seed));
    var topics = L.topics.slice().sort(function (a, b) { return a.topic - b.topic; })
      .map(function (T) { return { topic: T.topic, ids: shuffle(T.ids, rnd), pos: 0 }; });
    var count = Math.min(BOSS_SIZE, L.ids.length), taken = new Set(), picked = [];
    while (picked.length < count) {
      var progressed = false;
      for (var i = 0; i < topics.length && picked.length < count; i++) {
        var T = topics[i];
        while (T.pos < T.ids.length && taken.has(T.ids[T.pos])) T.pos++;
        if (T.pos < T.ids.length) { var hz = T.ids[T.pos++]; taken.add(hz); picked.push({ word: hz, topic: T.topic }); progressed = true; }
      }
      if (!progressed) break;
    }
    return shuffle(picked, rnd).map(function (q) {
      return { word: q.word, topic: q.topic, type: TEST_TYPES[Math.floor(rnd() * TEST_TYPES.length)] };
    });
  }

  function uuid4() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var h = '';
    for (var i = 0; i < 32; i++) {
      var r = Math.floor(Math.random() * 16);
      if (i === 12) r = 4; else if (i === 16) r = (r & 3) | 8;
      h += r.toString(16);
    }
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  var RESERVED = { id: 1, ts: 1, tz: 1, dev: 1, kind: 1 };
  function newEvent(kind, fields, now, tz, dev) {
    var e = { id: uuid4(), ts: isNum(now) ? now : Date.now(), tz: isNum(tz) ? tz : localTz(), dev: dev || '', kind: kind };
    if (fields) Object.keys(fields).forEach(function (k) { if (!RESERVED[k]) e[k] = fields[k]; });
    return e;
  }
  function fromLegacy(srsObj, now, tz, dev) {
    var copy = {};
    if (srsObj && typeof srsObj === 'object') Object.keys(srsObj).forEach(function (hz) { var r = cleanRec(srsObj[hz]); if (r) copy[hz] = r; });
    return newEvent('srs_seed', { srs: copy }, now, tz, dev);
  }
  function toLegacySrs(state) { return state.srs; }

  return {
    IV: IV, SEALS: SEALS, TEST_TYPES: TEST_TYPES,
    replay: replay, bossQuestions: bossQuestions, dayOf: dayOf, newEvent: newEvent,
    fromLegacy: fromLegacy, toLegacySrs: toLegacySrs,
    stageOf: stageOf, strengthOf: strengthOf, levelFromXp: levelFromXp
  };
});
