/* «Тушь» — занятия: карточки темы/повторения, экзамен урока, тоны, итог.
 * window.ZhSessions.mount(root, {kind, lesson, topic, words, state, record, onDone}) → {destroy()}.
 * События занятия: answer / boss / tone / session (поля — CONTRACT.md). XP и «до → после» — через ZhProgress.replay.
 * ES2019, без зависимостей. */
(function (root) {
  'use strict';

  /* ---------------- стили ---------------- */
  var CSS = [
    '.zs{--zs-bg:#f4efe4;--zs-band:#eae3d3;--zs-ink:#1c1a17;--zs-sub:#5d574d;--zs-red:#c8301f;--zs-line:#d8cfbd;--zs-mute:#8a8170;--zs-soft:#b8ae9a;',
    'box-sizing:border-box;width:100%;max-width:520px;margin:0 auto;min-height:100dvh;height:100dvh;display:flex;flex-direction:column;',
    'background:var(--zs-bg);color:var(--zs-ink);font-family:"Golos Text",system-ui,sans-serif;overflow-x:hidden;overflow-y:auto;padding:0 16px}',
    '.zs *,.zs *::before,.zs *::after{box-sizing:border-box}',
    '.zs button{font-family:inherit;line-height:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.zs button:focus{outline:none}',
    '.zs button:focus-visible{outline:2px solid var(--zs-ink);outline-offset:2px}',
    '.zs button:disabled{cursor:default}',
    '.zs-main:focus,.zs-res:focus{outline:none}',
    '.zs-hz{font-family:"Noto Serif SC","Songti SC",serif;font-weight:500}',
    '.zs-serif{font-family:Lora,Georgia,serif}',
    '.zs-head{display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 0}',
    '.zs-x{flex:none;width:44px;height:44px;border:0;background:none;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-left:-10px}',
    '.zs-x svg{width:22px;height:22px;stroke:var(--zs-ink);stroke-width:2;fill:none;stroke-linecap:round}',
    '.zs-segs{flex:1;display:flex;gap:3px;min-width:0}',
    '.zs-seg{flex:1;height:6px;border-radius:3px;background:var(--zs-line)}',
    '.zs-seg.ok{background:var(--zs-ink)}.zs-seg.miss{background:var(--zs-red)}.zs-seg.cur{background:var(--zs-soft)}',
    '.zs-xp{flex:none;min-width:44px;text-align:right;font-family:Lora,Georgia,serif;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--zs-ink)}',
    '.zs-main{flex:1 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px 0;gap:10px}',
    '.zs-cap{font-size:13px;color:var(--zs-sub)}',
    '.zs-big{--n:2;font-weight:700;font-size:clamp(40px,calc((min(100vw,520px) - 40px) / var(--n)),96px);line-height:1.15;margin:8px 0;white-space:nowrap;word-break:keep-all;max-width:100%}',
    '.zs-big>span{display:block;white-space:nowrap}',
    '.zs-big.boss{font-size:clamp(40px,calc((min(100vw,520px) - 40px) / var(--n)),84px)}',
    '.zs-py{font-family:Lora,Georgia,serif;font-size:22px;color:var(--zs-ink);overflow-wrap:anywhere}',
    '.zs-ru{font-size:20px;font-weight:500}',
    '.zs-ex{margin-top:14px;padding:14px 16px;border-top:1px solid var(--zs-line);border-bottom:1px solid var(--zs-line);width:100%;text-align:center;display:flex;flex-direction:column;gap:4px}',
    '.zs-expy{font-size:13px;color:var(--zs-sub);overflow-wrap:anywhere}',
    '.zs-ex .zs-hz{font-size:22px}.zs-ex b{color:var(--zs-red);font-weight:600}',
    '.zs-exru{font-size:14px;color:var(--zs-sub)}',
    '.zs-say{flex:none;width:48px;height:48px;border-radius:50%;border:1.5px solid var(--zs-ink);background:transparent;display:inline-flex;align-items:center;justify-content:center}',
    '.zs-say svg{width:22px;height:22px;stroke:var(--zs-ink);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.zs-stage{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--zs-sub);margin-top:4px}',
    '.zs-dots{display:inline-flex;gap:3px}.zs-dot{width:7px;height:7px;border-radius:50%;background:var(--zs-line)}.zs-dot.on{background:var(--zs-ink)}',
    '.zs-foot{position:sticky;bottom:0;z-index:1;flex:none;display:flex;gap:12px;background:var(--zs-bg);padding:12px 0 calc(16px + env(safe-area-inset-bottom,0px))}',
    '.zs .zs-btn{flex:1;min-height:56px;border-radius:12px;border:1.5px solid var(--zs-ink);background:transparent;color:var(--zs-ink);',
    'font-size:17px;font-weight:600;text-align:center;justify-content:center;align-items:center;display:inline-flex;padding:0 12px}',
    '.zs .zs-btn.pri{background:var(--zs-ink);border-color:var(--zs-ink);color:var(--zs-bg)}',
    '.zs .zs-btn.pri:disabled{background:transparent;border:1.5px solid var(--zs-line);color:var(--zs-mute)}',
    '.zs-seal{width:44px;height:44px;border:2px solid var(--zs-red);color:var(--zs-red);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;transform:rotate(-4deg)}',
    '.zs-bossh{display:flex;align-items:center;gap:12px;flex:1;min-width:0}',
    '.zs-bossh .zs-t,.zs-tt{font-family:Lora,Georgia,serif;font-size:17px;font-weight:600}',
    '.zs-bar{position:relative;height:8px;border-radius:4px;background:var(--zs-line);overflow:visible;width:100%}',
    '.zs-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--zs-ink)}',
    '.zs-bar i.gain{background:var(--zs-red);border-radius:0 4px 4px 0}',
    '.zs-mark{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--zs-red)}',
    '.zs-marklbl{position:absolute;top:12px;transform:translateX(-50%);font-size:12px;color:var(--zs-red)}',
    '.zs-opts{display:flex;flex-direction:column;gap:10px;width:100%;margin-top:8px}',
    '.zs .zs-opt{min-height:52px;width:100%;border-radius:12px;border:1.5px solid var(--zs-line);background:transparent;text-align:left;padding:10px 48px 10px 16px;font-size:17px;position:relative}',
    '.zs-opt .zs-hz{font-size:22px;white-space:nowrap}',
    '.zs .zs-opt.right{background:var(--zs-ink);border-color:var(--zs-ink);color:var(--zs-bg)}',
    '.zs .zs-opt.wrong{border:2px solid var(--zs-red);color:var(--zs-red)}',
    '.zs .zs-opt:disabled:not(.right):not(.wrong){color:var(--zs-sub)}',
    '.zs-opt .zs-ic{position:absolute;right:14px;top:50%;margin-top:-11px;width:22px;height:22px;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}',
    '.zs-opt.right .zs-ic{stroke:var(--zs-bg)}.zs-opt.wrong .zs-ic{stroke:var(--zs-red)}',
    '.zs-listen{flex:none;width:112px;height:112px;border-radius:50%;border:0;background:var(--zs-ink);display:flex;align-items:center;justify-content:center}',
    '.zs-listen svg{width:44px;height:44px;stroke:var(--zs-bg);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.zs .zs-slow{min-height:44px;border:1px solid var(--zs-soft);border-radius:999px;background:transparent;padding:0 18px;font-size:14px}',
    '.zs-syls{display:flex;gap:16px;justify-content:center;width:100%;margin-top:12px}',
    '.zs-syl{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1 1 0;min-width:0;max-width:240px}',
    '.zs-syl .zs-pl{font-family:Lora,Georgia,serif;font-size:22px;font-weight:600}',
    '.zs-tg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}',
    '.zs .zs-tb{min-height:56px;border-radius:10px;border:1.5px solid var(--zs-line);background:transparent;display:flex;align-items:center;justify-content:center}',
    '.zs-tb svg{width:40px;height:28px}',
    '.zs .zs-tb[aria-pressed="true"]{background:var(--zs-ink);border-color:var(--zs-ink)}',
    '.zs .zs-tb.right{background:var(--zs-ink);border:1.5px solid var(--zs-ink)}',
    '.zs .zs-tb.wrong{background:transparent;border:2px solid var(--zs-red)}',
    '.zs-streak{flex:none;display:flex;gap:3px;align-items:center}',
    '.zs-sd{width:8px;height:8px;border-radius:50%;border:1px solid var(--zs-soft)}.zs-sd.on{background:var(--zs-ink);border-color:var(--zs-ink)}',
    '.zs-res{flex:1 0 auto;display:flex;flex-direction:column;gap:18px;padding:28px 0 12px}',
    '.zs-resxp{font-family:Lora,Georgia,serif;font-size:48px;font-weight:700;line-height:1.1;color:var(--zs-ink)}',
    '.zs-row{display:flex;align-items:center;gap:12px}',
    '.zs-lv{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13px;color:var(--zs-sub)}',
    '.zs-lv b{font-weight:400}',
    '.zs-cnt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 0;border-top:1px solid var(--zs-line);border-bottom:1px solid var(--zs-line)}',
    '.zs-cnt b{display:block;font-family:Lora,Georgia,serif;font-size:28px;font-weight:600;font-variant-numeric:tabular-nums}',
    '.zs-cnt b.bad{color:var(--zs-red)}',
    '.zs-cnt span{font-size:12px;color:var(--zs-sub)}',
    '.zs-sec{display:flex;flex-direction:column;gap:8px}',
    '.zs-sec h3{margin:0;font-family:Lora,Georgia,serif;font-size:17px;font-weight:600;color:var(--zs-ink)}',
    '.zs-pass{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:15px;font-variant-numeric:tabular-nums}',
    '.zs-forgot{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}',
    '.zs-forgot li{display:flex;flex-direction:column;padding:8px 12px;border:1px solid var(--zs-red);border-radius:10px;max-width:100%}',
    '.zs-forgot .zs-hz{font-size:20px;white-space:nowrap;color:var(--zs-ink)}',
    '.zs-forgot span{color:var(--zs-sub);font-size:12px}',
    '.zs-forgot li.zs-more{border-color:var(--zs-line);justify-content:center;font-size:14px;color:var(--zs-sub)}',
    '.zs-tag{display:inline-block;padding:4px 10px;border-radius:8px;font-size:14px;font-weight:600}',
    '.zs-tag.ok{background:var(--zs-ink);color:var(--zs-bg)}.zs-tag.no{border:1px solid var(--zs-red);color:var(--zs-red)}',
    '.zs-quest{display:flex;align-items:center;gap:10px;font-size:15px}.zs-quest b{font-weight:600}',
    '.zs-qc{flex:none;width:20px;height:20px;border-radius:50%;background:var(--zs-red);display:flex;align-items:center;justify-content:center}',
    '.zs-qc svg{width:12px;height:12px;stroke:var(--zs-bg);stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.zs-empty{flex:1 0 auto;display:flex;align-items:center;justify-content:center;font-family:Lora,Georgia,serif;font-size:22px;font-weight:600}',
    '@media (max-width:380px){.zs-big.boss{font-size:clamp(40px,calc((min(100vw,520px) - 40px) / var(--n)),76px)}}'
  ].join('\n');

  function injectStyle(doc) {
    if (doc.getElementById('zs-style')) return;
    var st = doc.createElement('style');
    st.id = 'zs-style';
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------------- утилиты ---------------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'cls') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return e;
  }
  function btn(cls, label, onclick, extra) {
    var a = { type: 'button', cls: cls, onclick: onclick };
    if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
    var b = h('button', a);
    if (typeof label === 'string') b.textContent = label; else if (label) b.appendChild(label);
    return b;
  }
  var ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    say: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14"/></svg>',
    ok: '<svg class="zs-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    no: '<svg class="zs-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  var TONE_PATH = { 1: 'M6 6 H34', 2: 'M6 22 L34 6', 3: 'M6 12 Q16 28 22 22 T34 6', 4: 'M6 6 L34 22' };
  var TONE_NAME = { 1: 'Первый тон', 2: 'Второй тон', 3: 'Третий тон', 4: 'Четвёртый тон' };
  function toneSvg(t, color) {
    return '<svg viewBox="0 0 40 28" aria-hidden="true"><path d="' + TONE_PATH[t] + '" stroke="' + color +
      '" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>';
  }
  var SEAL_INFO = {
    words100: ['百', '100 слов'], words300: ['识', '300 слов'], words600: ['学', '600 слов'], hsk1: ['一', 'HSK 1'],
    boss1: ['印', 'Первый экзамен'], streak7: ['七', '7 дней'], streak30: ['月', '30 дней'],
    talk_clean: ['话', 'Без поправок'], tones100: ['声', '100 тонов']
  };
  var STAGE_RU = { 'new': 'новое', learning: 'учу', familiar: 'знакомые', strong: 'крепкие', mature: 'выученные' };
  var STAGE_IX = { 'new': 0, learning: 1, familiar: 2, strong: 3, mature: 4 };

  var CND = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function cnNumLocal(n) {
    n = Math.max(0, Math.floor(n));
    if (n <= 10) return n === 10 ? '十' : CND[n];
    if (n < 20) return '十' + CND[n % 10];
    if (n < 100) return CND[Math.floor(n / 10)] + '十' + (n % 10 ? CND[n % 10] : '');
    return String(n);
  }
  function topicName(lesson, t) {
    var A = root.ZhApp;
    try { if (A && typeof A.topicTitle === 'function') { var nm = A.topicTitle(lesson, Number(t)); if (nm) return nm; } } catch (e) { /* номер */ }
    return 'Тема ' + (Number(t) + 1);
  }
  function cnNum(n) {
    var A = root.ZhApp;
    try { if (A && typeof A.cnNum === 'function') return A.cnNum(n); } catch (e) { /* локальная */ }
    return cnNumLocal(n);
  }
  function localDate(d) {
    d = d || new Date();
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function lessonNum(id) { var m = /(\d+)/.exec(String(id || '')); return m ? parseInt(m[1], 10) : 0; }
  function rngOf(str) {
    var a = 2166136261;
    for (var i = 0; i < str.length; i++) { a ^= str.charCodeAt(i); a = Math.imul(a, 16777619); }
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function hzOf(w) { return w ? (w.hz || w.id) : ''; }
  function pyOf(w) { return w ? (w.pyw || w.py || '') : ''; }
  /* крупный иероглиф: размер под число знаков (--n); > 8 знаков — две строки поровну, без висячего знака */
  function bigHz(hz, extraCls) {
    var ch = Array.from(String(hz || '')), n = ch.length, kids = [hz];
    if (n > 8) {
      var k = Math.ceil(n / 2);
      kids = [h('span', null, [ch.slice(0, k).join('')]), h('span', null, [ch.slice(k).join('')])];
      n = k;
    }
    return h('div', { cls: 'zs-big zs-hz' + (extraCls ? ' ' + extraCls : ''), lang: 'zh-CN', style: '--n:' + Math.max(2, n) }, kids);
  }

  /* ---------------- речь ---------------- */
  function canSpeak() {
    return typeof root.speechSynthesis !== 'undefined' && root.speechSynthesis &&
      typeof root.SpeechSynthesisUtterance === 'function';
  }
  function speak(text, rate) {
    if (!canSpeak() || !text) return;
    try {
      root.speechSynthesis.cancel();
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = rate || 0.9;
      root.speechSynthesis.speak(u);
    } catch (e) { /* без звука */ }
  }

  /* ---------------- тоны: разбор пиньиня ---------------- */
  var MARKS = {
    'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
    'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
    'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
    'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
    'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
    'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
    'ń': ['n', 2], 'ň': ['n', 3], 'ǹ': ['n', 4], 'ḿ': ['m', 2]
  };
  var SYL_RE = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(iang|iong|uang|ueng|ian|iao|ing|uai|uan|üan|ang|eng|ong|ai|ao|an|ei|en|er|ia|ie|in|iu|ou|ua|ui|un|uo|ue|üe|ün|ü|a|o|e|i|u)$/;
  function stripMarks(s) {
    var plain = '', tone = 0, marks = 0;
    var src = String(s || '').normalize ? String(s || '').normalize('NFC') : String(s || '');
    for (var i = 0; i < src.length; i++) {
      var c = src.charAt(i), m = MARKS[c];
      if (m) { plain += m[0]; tone = m[1]; marks++; } else plain += c === 'v' ? 'ü' : c;
    }
    return { plain: plain, tone: tone, marks: marks };
  }
  function validPlain(p) {
    var m = SYL_RE.exec(p);
    if (!m) return false;
    if (!m[1] && /^[iuü]/.test(m[2])) return false;    // без инициали — только через y/w
    if (m[1] && m[2] === 'er') return false;
    return true;
  }
  /* слог → {raw, plain, tone 0..4, erhua} или null (не слог) */
  function parseSyllable(s) {
    var raw = String(s || '').toLowerCase().replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ]/g, '');
    if (!raw) return null;
    var st = stripMarks(raw);
    if (st.marks > 1) return null;
    if (validPlain(st.plain)) return { raw: raw, plain: st.plain, tone: st.tone, erhua: false };
    if (st.plain.length > 1 && st.plain.slice(-1) === 'r' && validPlain(st.plain.slice(0, -1)))
      return { raw: raw, plain: st.plain, tone: st.tone, erhua: true };
    return null;
  }
  function segOne(str, k, first) {
    if (k === 1) {
      if (!first && /^[aoe]/.test(stripMarks(str).plain)) return [];
      return parseSyllable(str) ? [[str]] : [];
    }
    var out = [];
    for (var i = 1; i < str.length; i++) {
      var head = str.slice(0, i);
      if (!first && /^[aoe]/.test(stripMarks(head).plain)) continue;
      if (!parseSyllable(head)) continue;
      segOne(str.slice(i), k - 1, false).forEach(function (rest) { out.push([head].concat(rest)); });
    }
    return out;
  }
  function segParts(parts, n) {
    if (!parts.length) return n === 0 ? [[]] : [];
    var out = [], left = parts.length - 1;
    for (var k = 1; k <= n - left; k++) {
      var heads = segOne(parts[0], k, true);
      if (!heads.length) continue;
      var tails = segParts(parts.slice(1), n - k);
      heads.forEach(function (a) { tails.forEach(function (b) { out.push(a.concat(b)); }); });
    }
    return out;
  }
  /* пиньинь слова → n слогов (строки) или null */
  function splitPinyin(py, n) {
    var parts = String(py || '').toLowerCase().trim().split(/[\s'’ʼ‘\-·]+/).filter(Boolean);
    if (!parts.length || n < 1) return null;
    var cands = segParts(parts, n);
    if (cands.length > 1) {
      var one = cands.filter(function (c) { return c.every(function (x) { return stripMarks(x).marks === 1; }); });
      if (one.length) cands = one;
    }
    return cands.length === 1 ? cands[0] : null;
  }
  /* задания тренажёра: слова из 1–2 иероглифов с разбираемым пиньинем */
  function toneTasks(words) {
    var seen = {}, out = [];
    (words || []).forEach(function (w) {
      var hz = hzOf(w), chars = Array.from(hz || '');
      if (!chars.length || chars.length > 2 || !/^[㐀-鿿]+$/.test(hz) || !w.py) return;
      // 一 и 不 меняют тон по соседу (yí ge, bú shì) — словарный тон расходится с произношением
      if (chars.length > 1 && /[一不]/.test(hz)) return;
      var syl = null;
      if (w.pys) {
        var ps = String(w.pys).trim().split(/\s+/);
        if (ps.length === chars.length) syl = ps;
      }
      if (!syl) syl = splitPinyin(w.py, chars.length);
      if (!syl) return;
      var items = syl.map(function (s) {
        var p = parseSyllable(s);
        return { raw: s, plain: p ? p.plain : s, tone: p ? p.tone : 0, ask: !!(p && p.tone > 0 && !p.erhua) };
      });
      if (!items.some(function (x) { return x.ask; })) return;
      // третий + третий: первый слог произносится вторым тоном (nǐ hǎo → ní hǎo)
      if (items.length === 2 && items[0].tone === 3 && items[1].tone === 3) return;
      var key = hz + '|' + w.py;
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ word: w, hz: hz, py: pyOf(w), syls: items });
    });
    return out;
  }

  /* ---------------- занятие: общий каркас ---------------- */
  var GAP_MS = 120000, MAX_SEC = 3600;
  function Pg() { return root.ZhProgress; }
  function tzNow() { return -new Date().getTimezoneOffset(); }
  var EMPTY_STATE = { srs: {}, xp: 0, level: 1, levelXp: 0, nextLevelXp: 300, quests: [], lessons: {}, seals: [], due: [] };

  function Session(holder, rootEl, opts) {
    var A = root.ZhApp || null;
    this.holder = holder;
    this.root = rootEl;
    this.opts = opts;
    this.kind = opts.kind;
    this.before = Array.isArray(opts._before) ? opts._before
      : (A && Array.isArray(A.events) ? A.events.slice() : []);
    var own = (opts.words || []).map(function (w) { return { id: hzOf(w), lesson: w.lesson, topic: w.topic }; });
    this.allWords = A && Array.isArray(A.words) && A.words.length ? A.words : own;
    this.hsk = A ? A.hsk : null;
    var dict = this.dict = {};
    (opts.words || []).forEach(function (w) { if (hzOf(w)) dict[hzOf(w)] = w; });
    this.events = [];
    this.answers = 0;
    this.S0 = this.replay(this.before);
    this.cur = this.S0;
    this.activeMs = 0;
    this.lastAct = Date.now();
    this.ended = false;
    this.sessionDone = false;
    this.closed = false;
    this.stats = { cards: 0, ok: 0, miss: 0, syl: 0, sylOk: 0, best: 0, score: 0, total: 0 };
    this.forgot = [];
    this.box = h('div', { cls: 'zs', 'data-kind': this.kind });
    rootEl.appendChild(this.box);
    var self = this;
    this.kbd = false;
    this.onKey = function (e) { self.kbd = true; if (e.key === 'Escape') { e.preventDefault(); self.exit(); } };
    this.onPtr = function () { self.kbd = false; };
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('pointerdown', this.onPtr, true);
  }
  var SP = Session.prototype;

  SP.replay = function (evs) {
    var P = Pg();
    if (!P || typeof P.replay !== 'function') return EMPTY_STATE;
    try { return P.replay(evs, this.allWords, { hsk: this.hsk }) || EMPTY_STATE; } catch (e) { return EMPTY_STATE; }
  };
  SP.touch = function () {
    var now = Date.now(), gap = now - this.lastAct;
    if (gap > 0 && gap <= GAP_MS) this.activeMs += gap;
    this.lastAct = now;
  };
  SP.emit = function (kind, fields) {
    this.touch();
    var P = Pg();
    var ev = P && P.newEvent ? P.newEvent(kind, fields, Date.now(), tzNow(), 'session')
      : Object.assign({ id: String(Math.random()), ts: Date.now(), tz: tzNow(), dev: 'session', kind: kind }, fields);
    this.events.push(ev);
    if (kind === 'answer' || kind === 'tone') this.answers++;
    try { if (typeof this.opts.record === 'function') this.opts.record(kind, fields); } catch (e) { /* запись — забота sync */ }
    this.cur = this.replay(this.before.concat(this.events));
    this.updXp();
  };
  SP.xpGain = function () { return Math.max(0, (this.cur.xp || 0) - (this.S0.xp || 0)); };
  SP.updXp = function () { if (this.xpEl) this.xpEl.textContent = '+' + this.xpGain(); };

  /* шапка: × + произвольная середина + XP */
  /* шапка: × + середина + справа XP (или свой узел right — у тонов серия) */
  SP.head = function (middle, exitLabel, right) {
    var self = this;
    var x = btn('zs-x', null, function () { self.exit(); }, { 'aria-label': exitLabel || 'Закончить занятие' });
    x.innerHTML = ICON.x;
    this.xpEl = right ? null : h('div', { cls: 'zs-xp', 'aria-label': 'Опыт за занятие' }, ['+' + this.xpGain()]);
    return h('div', { cls: 'zs-head' }, [x, middle, right || this.xpEl]);
  };
  /* смена экрана: фокус на контейнер содержимого (tabindex=-1, без кольца); с клавиатуры — на focusEl */
  SP.paint = function (nodes, focusEl) {
    this.box.innerHTML = '';
    var self = this;
    nodes.forEach(function (n) { if (n) self.box.appendChild(n); });
    var main = this.box.querySelector('.zs-main,.zs-res');
    if (main) main.setAttribute('tabindex', '-1');
    var target = this.kbd && focusEl ? focusEl : main;
    if (target && typeof target.focus === 'function') { try { target.focus({ preventScroll: true }); } catch (e) { /* нет фокуса */ } }
  };
  SP.wordMeta = function (w) {
    var o = this.opts;
    return {
      lesson: w && w.lesson != null ? w.lesson : (o.lesson || null),
      topic: w && w.topic != null ? w.topic : (o.topic == null ? null : o.topic)
    };
  };
  SP.addForgot = function (w) {
    var hz = hzOf(w);
    if (!this.forgot.some(function (x) { return hzOf(x) === hz; })) this.forgot.push(w);
  };

  SP.start = function () {
    if (this.kind === 'boss') return this.startBoss();
    if (this.kind === 'tones') return this.startTones();
    return this.startCards();
  };
  SP.exit = function () {
    if (this.closed) return;
    if (this.ended) return this.done();
    if (this.answers > 0) return this.finish({ aborted: true });
    this.done();
  };
  SP.done = function () {
    if (this.closed) return;
    this.destroy();
    var cb = this.opts.onDone;
    if (typeof cb === 'function') cb();
  };
  SP.destroy = function () {
    if (this.closed) return;
    this.closed = true;
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('pointerdown', this.onPtr, true);
    if (canSpeak()) { try { root.speechSynthesis.cancel(); } catch (e) { /* нет */ } }
    if (this.box && this.box.parentNode) this.box.parentNode.removeChild(this.box);
  };
  SP.again = function () {
    var o2 = Object.assign({}, this.opts, {
      _before: this.before.concat(this.events), state: this.cur, _attempt: (this.opts._attempt || 1) + 1
    });
    var r = this.root, holder = this.holder;
    this.destroy();
    var s = new Session(holder, r, o2);
    holder.cur = s;
    s.start();
  };
  SP.finish = function (extra) {
    if (this.ended) return;
    this.ended = true;
    if (extra && extra.empty) { this.renderEmpty(); return; }
    if (!this.sessionDone) {
      this.touch();
      this.sessionDone = true;
      this.seconds = Math.min(MAX_SEC, Math.round(this.activeMs / 1000));
      this.emit('session', { mode: this.kind, seconds: this.seconds, lesson: this.opts.lesson || null });
    }
    if (canSpeak()) { try { root.speechSynthesis.cancel(); } catch (e) { /* нет */ } }
    this.renderResult(extra || {});
  };

  /* ---------------- карточки: тема и повторение ---------------- */
  SP.cardTitle = function () {
    if (this.kind === 'review') return 'Повторение';
    var t = this.opts.topic;
    return t == null ? 'Урок ' + lessonNum(this.opts.lesson) : topicName(this.opts.lesson, t);
  };
  SP.startCards = function () {
    var o = this.opts, dict = this.dict, list;
    if (this.kind === 'review') {
      var due = (o.state && Array.isArray(o.state.due) ? o.state.due : this.S0.due) || [];
      var srs = this.S0.srs || {}, seen = {};
      list = due.filter(function (hz) { if (!dict[hz] || seen[hz]) return false; seen[hz] = 1; return true; })
        .map(function (hz, i) { return { w: dict[hz], i: i, r: srs[hz] }; });
      list.sort(function (a, b) {
        var da = a.r ? a.r.d : Infinity, db = b.r ? b.r.d : Infinity;
        if (da !== db) return da - db;
        var ba = a.r ? a.r.b : 0, bb = b.r ? b.r.b : 0;
        return ba !== bb ? ba - bb : a.i - b.i;
      });
      list = list.slice(0, 20).map(function (x) { return x.w; });
    } else {
      var seen2 = {};
      list = (o.words || []).filter(function (w) { var k = hzOf(w); if (!k || seen2[k]) return false; seen2[k] = 1; return true; });
    }
    if (!list.length) return this.finish({ empty: true });
    this.queue = list.slice();
    this.uniq = list.map(hzOf);
    this.seg = {};
    this.idx = 0;
    this.renderCard(false);
  };
  SP.segBar = function () {
    var self = this, cur = hzOf(this.queue[this.idx]);
    var done = this.uniq.filter(function (k) { return self.seg[k] === 'ok'; }).length;
    return h('div', { cls: 'zs-segs', role: 'img', 'aria-label': 'Пройдено ' + done + ' из ' + this.uniq.length },
      this.uniq.map(function (k) {
        var s = self.seg[k];
        return h('span', { cls: 'zs-seg' + (s === 'miss' ? ' miss' : s === 'ok' ? ' ok' : k === cur ? ' cur' : '') });
      }));
  };
  function exampleNode(ex, hz) {
    var kids = [], parts = String(ex).split(hz);
    parts.forEach(function (p, i) {
      if (p) kids.push(p);
      if (i < parts.length - 1) kids.push(h('b', { text: hz }));
    });
    return h('div', { cls: 'zs-hz', lang: 'zh-CN' }, kids);
  }
  function dotsNode(n, total) {
    var a = [];
    for (var i = 0; i < total; i++) a.push(h('span', { cls: 'zs-dot' + (i < n ? ' on' : '') }));
    return h('span', { cls: 'zs-dots', 'aria-hidden': 'true' }, a);
  }
  SP.renderCard = function (revealed) {
    var self = this, w = this.queue[this.idx], hz = hzOf(w), P = Pg();
    var kids = [
      h('div', { cls: 'zs-cap' }, [this.cardTitle() + ' · ' + (this.idx + 1) + ' / ' + this.queue.length]),
      bigHz(hz)
    ];
    var focus;
    if (revealed) {
      if (pyOf(w)) kids.push(h('div', { cls: 'zs-py' }, [pyOf(w)]));
      if (w.ru) kids.push(h('div', { cls: 'zs-ru' }, [w.ru]));
      if (canSpeak()) {
        var say = btn('zs-say', null, function () { speak(hz, 0.9); }, { 'aria-label': 'Произнести' });
        say.innerHTML = ICON.say;
        kids.push(say);
      }
      if (w.ex) {
        kids.push(h('div', { cls: 'zs-ex' }, [w.expy ? h('div', { cls: 'zs-expy' }, [w.expy]) : null,
          exampleNode(w.ex, hz), w.ex_ru ? h('div', { cls: 'zs-exru' }, [w.ex_ru]) : null]));
      }
      var rec = (this.cur.srs || {})[hz];
      var st0 = P && P.stageOf ? P.stageOf(rec) : 'new';
      var st1 = P && P.stageOf ? P.stageOf({ b: rec ? Math.min(rec.b + 1, 7) : 1, d: 0 }) : 'learning';
      kids.push(h('div', { cls: 'zs-stage' }, [dotsNode(STAGE_IX[st1], 4),
        STAGE_RU[st0] + (st1 !== st0 ? ' → ' + STAGE_RU[st1] : '')]));
      var no = btn('zs-btn miss', 'Не помню', function () { self.answerCard(false); });
      var yes = btn('zs-btn pri', 'Помню', function () { self.answerCard(true); });
      this.paint([this.head(this.segBar()), h('div', { cls: 'zs-main' }, kids), h('div', { cls: 'zs-foot' }, [no, yes])], yes);
      return;
    }
    focus = btn('zs-btn pri', 'Показать', function () { self.touch(); self.renderCard(true); });
    this.paint([this.head(this.segBar()), h('div', { cls: 'zs-main' }, kids), h('div', { cls: 'zs-foot' }, [focus])], focus);
  };
  SP.answerCard = function (ok) {
    if (this.ended) return;
    var w = this.queue[this.idx], hz = hzOf(w), m = this.wordMeta(w);
    this.emit('answer', { word: hz, ok: !!ok, mode: this.kind === 'review' ? 'review' : 'card', lesson: m.lesson, topic: m.topic });
    this.stats.cards++;
    if (ok) {
      this.stats.ok++;
      if (this.seg[hz] !== 'miss') this.seg[hz] = 'ok';
    } else {
      this.stats.miss++;
      this.seg[hz] = 'miss';
      this.addForgot(w);
      var at = this.idx + 4;
      if (at <= this.queue.length) this.queue.splice(at, 0, w); else this.queue.push(w);
    }
    this.idx++;
    if (this.idx >= this.queue.length) return this.finish({});
    this.renderCard(false);
  };

  /* ---------------- экзамен урока ---------------- */
  var BOSS_PASS = 0.8;
  function optField(type) { return type === 'ru2zh' ? 'hz' : type === 'py' ? 'py' : 'ru'; }
  function optValue(w, field) {
    if (field === 'hz') return hzOf(w);
    if (field === 'py') return String(pyOf(w)).trim();
    return String((w && w[field]) || '').trim();
  }
  SP.bossWords = function () {
    var L = String(this.opts.lesson), ws = (this.opts.words || []).filter(function (w) { return String(w.lesson) === L; });
    if (!ws.length) ws = (this.opts.words || []).map(function (w) { return Object.assign({}, w, { lesson: L }); });
    return ws;
  };
  SP.startBoss = function () {
    var P = Pg(), o = this.opts, dict = this.dict, att = o._attempt || 1;
    this.seed = String(o.lesson) + '|' + localDate() + (att > 1 ? '#' + att : '');
    this.lessonWordsList = this.bossWords();
    var src = this.lessonWordsList.map(function (w) { return Object.assign({}, w, { id: hzOf(w) }); });
    var qs = P && P.bossQuestions ? P.bossQuestions(o.lesson, src, this.seed) : [];
    this.qs = (qs || []).filter(function (q) { return dict[q.word]; });
    if (!this.qs.length) return this.finish({ empty: true });
    this.qi = 0;
    this.stats.total = this.qs.length;
    this.stats.score = 0;
    this.prepQuestion();
    this.renderBoss();
  };
  SP.bossOptions = function (q, qi) {
    var w = this.dict[q.word], field = optField(q.type), rnd = rngOf(this.seed + '|' + qi);
    var right = optValue(w, field), used = {};
    used[right.toLowerCase()] = 1;
    var pool = this.lessonWordsList.filter(function (x) { return hzOf(x) !== hzOf(w); });
    var same = shuffle(pool.filter(function (x) { return x.topic === q.topic; }), rnd);
    var other = shuffle(pool.filter(function (x) { return x.topic !== q.topic; }), rnd);
    var picked = [];
    same.concat(other).forEach(function (x) {
      if (picked.length >= 3) return;
      var v = optValue(x, field), k = v.toLowerCase();
      if (!v || used[k]) return;
      used[k] = 1;
      picked.push({ w: x, text: v, right: false });
    });
    return shuffle([{ w: w, text: right, right: true }].concat(picked), rnd);
  };
  SP.prepQuestion = function () {
    this.curQ = this.qs[this.qi];
    this.curOpts = this.bossOptions(this.curQ, this.qi);
    this.choice = null;
  };
  SP.renderBoss = function () {
    var self = this, q = this.curQ, w = this.dict[q.word], hz = hzOf(w), N = this.qs.length, k = this.stats.score;
    var title = h('div', { cls: 'zs-bossh' }, [
      h('span', { cls: 'zs-seal zs-hz', 'aria-hidden': 'true' }, ['印']),
      h('div', { style: 'text-align:left;min-width:0' }, [
        h('div', { cls: 'zs-t' }, ['Экзамен урока ' + cnNum(lessonNum(this.opts.lesson))]),
        h('div', { cls: 'zs-cap' }, ['вопрос ' + (this.qi + 1) + ' из ' + N + ' · верно ' + k])
      ])
    ]);
    var bar = h('div', { cls: 'zs-bar', role: 'img', 'aria-label': 'Верно ' + k + ' из ' + N + ', порог 80%' }, [
      h('i', { style: 'width:' + (100 * k / N).toFixed(1) + '%' }),
      h('span', { cls: 'zs-mark', style: 'left:80%' }),
      h('span', { cls: 'zs-marklbl', style: 'left:80%', 'aria-hidden': 'true' }, ['80%'])
    ]);
    var prompt = [], topicCap = q.topic != null ? h('div', { cls: 'zs-cap' }, [topicName(this.opts.lesson, q.topic)]) : null;
    if (q.type === 'ru2zh') {
      prompt.push(h('div', { cls: 'zs-cap' }, ['Как сказать']), h('div', { cls: 'zs-ru', style: 'font-size:26px' }, [w.ru || '']));
    } else if (q.type === 'audio' && canSpeak()) {
      var lis = btn('zs-listen', null, function () { speak(hz, 0.9); }, { 'aria-label': 'Прослушать' });
      lis.innerHTML = ICON.say;
      prompt.push(h('div', { cls: 'zs-cap' }, ['Что прозвучало']), lis);
    } else if (q.type === 'audio') {
      prompt.push(h('div', { cls: 'zs-cap' }, ['Что значит']), h('div', { cls: 'zs-py', style: 'font-size:32px' }, [pyOf(w) || hz]));
    } else {
      prompt.push(h('div', { cls: 'zs-cap' }, [q.type === 'py' ? 'Как читается' : 'Что значит']),
        bigHz(hz, 'boss'));
    }
    prompt.push(topicCap);
    var answered = this.choice != null;
    var opts = h('div', { cls: 'zs-opts', role: 'group', 'aria-label': 'Варианты ответа' }, this.curOpts.map(function (op, i) {
      var cls = 'zs-opt';
      var mark = null;
      if (answered && op.right) { cls += ' right'; mark = 'ok'; }
      else if (answered && i === self.choice) { cls += ' wrong'; mark = 'no'; }
      var b = btn(cls, null, function () { self.pickBoss(i); }, { disabled: answered });
      b.appendChild(op.text && optField(q.type) === 'hz' ? h('span', { cls: 'zs-hz', lang: 'zh-CN' }, [op.text]) : document.createTextNode(op.text));
      if (mark) {
        var ic = h('span', { role: 'img', 'aria-label': mark === 'ok' ? 'Верно' : 'Неверно' });
        ic.innerHTML = ICON[mark];
        b.appendChild(ic);
      }
      return b;
    }));
    prompt.push(opts);
    var next = btn(answered ? 'zs-btn pri' : 'zs-btn', 'Дальше', function () { self.nextBoss(); }, { disabled: !answered });
    this.paint([this.head(title, 'Выйти из экзамена'), bar, h('div', { cls: 'zs-main' }, prompt), h('div', { cls: 'zs-foot' }, [next])],
      answered ? next : null);
    if (!answered && q.type === 'audio' && canSpeak() && !this.spoke) { this.spoke = true; speak(hz, 0.9); }
  };
  SP.pickBoss = function (i) {
    if (this.choice != null || this.ended) return;
    var q = this.curQ, op = this.curOpts[i], w = this.dict[q.word];
    this.choice = i;
    this.emit('answer', { word: q.word, ok: !!op.right, mode: 'boss', lesson: this.opts.lesson || null, topic: q.topic == null ? null : q.topic });
    if (op.right) this.stats.score++; else this.addForgot(w);
    this.renderBoss();
  };
  SP.nextBoss = function () {
    if (this.choice == null || this.ended) return;
    this.qi++;
    this.spoke = false;
    if (this.qi >= this.qs.length) {
      this.bossDone = true;
      this.emit('boss', { lesson: this.opts.lesson || null, score: this.stats.score, total: this.qs.length });
      return this.finish({});
    }
    this.prepQuestion();
    this.renderBoss();
  };

  /* ---------------- тоны ---------------- */
  var STREAK_GOAL = 10, TONE_MAX = 20;
  SP.startTones = function () {
    var tasks = toneTasks(this.opts.words);
    if (!tasks.length) return this.finish({ empty: true });
    this.tasks = shuffle(tasks, Math.random).slice(0, TONE_MAX);
    this.ti = 0;
    this.streak = 0;
    this.prepTone();
    this.renderTone();
  };
  SP.prepTone = function () { this.sel = {}; this.checked = false; };
  SP.renderTone = function () {
    var self = this, t = this.tasks[this.ti], dots = [];
    for (var i = 0; i < STREAK_GOAL; i++) dots.push(h('span', { cls: 'zs-sd' + (i < this.streak ? ' on' : '') }));
    var mid = h('div', { style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-align:left' }, [
      h('div', { cls: 'zs-tt' }, ['Тоны · ' + (t.syls.length > 1 ? 'пары' : 'слоги')]),
      h('div', { cls: 'zs-cap' }, [this.streak + ' подряд из ' + STREAK_GOAL])
    ]);
    var streak = h('div', { cls: 'zs-streak', role: 'img', 'aria-label': 'Серия верных: ' + this.streak + ' из ' + STREAK_GOAL }, dots);
    var kids = [];
    if (canSpeak()) {
      var lis = btn('zs-listen', null, function () { self.touch(); speak(t.hz, 0.9); }, { 'aria-label': 'Прослушать' });
      lis.innerHTML = ICON.say;
      kids.push(lis, btn('zs-slow', 'Медленнее', function () { self.touch(); speak(t.hz, 0.6); }));
    }
    if (this.checked) {
      kids.push(h('div', { cls: 'zs-hz', lang: 'zh-CN', style: 'font-size:48px' }, [t.hz]), h('div', { cls: 'zs-py' }, [t.py]));
    }
    var syls = h('div', { cls: 'zs-syls' }, t.syls.map(function (s, si) {
      var col = [h('div', { cls: 'zs-pl' }, [s.plain])];
      if (!s.ask) { col.push(h('div', { cls: 'zs-cap' }, ['без тона'])); return h('div', { cls: 'zs-syl' }, col); }
      var grid = h('div', { cls: 'zs-tg', role: 'group', 'aria-label': 'Тон слога ' + s.plain }, [1, 2, 3, 4].map(function (tn) {
        var on = self.sel[si] === tn, cls = 'zs-tb';
        if (self.checked && tn === s.tone) cls += ' right';
        else if (self.checked && on) cls += ' wrong';
        var label = TONE_NAME[tn] + (on ? ', выбран' : '') + (self.checked && tn === s.tone ? ', верный' : '');
        var b = btn(cls, null, function () { self.pickTone(si, tn); },
          { 'aria-label': label, 'aria-pressed': on ? 'true' : 'false', disabled: self.checked, 'data-tone': self.checked ? tn : null });
        var col = self.checked ? (tn === s.tone ? '#f4efe4' : on ? '#c8301f' : '#1c1a17') : (on ? '#f4efe4' : '#1c1a17');
        b.innerHTML = toneSvg(tn, col);
        return b;
      }));
      col.push(grid);
      return h('div', { cls: 'zs-syl' }, col);
    }));
    kids.push(syls);
    var ready = t.syls.every(function (s, si) { return !s.ask || self.sel[si]; });
    var foot = this.checked ? btn('zs-btn pri', 'Дальше', function () { self.nextTone(); })
      : btn('zs-btn pri', 'Проверить', function () { self.checkTone(); }, { disabled: !ready });
    this.paint([this.head(mid, 'Закончить', streak), h('div', { cls: 'zs-main' }, kids), h('div', { cls: 'zs-foot' }, [foot])],
      this.checked ? foot : null);
  };
  SP.pickTone = function (si, tn) {
    if (this.checked) return;
    this.touch();
    this.sel[si] = tn;
    this.renderTone();
    if (!this.kbd) return;
    var b = this.box.querySelectorAll('.zs-syl')[si];
    b = b && b.querySelectorAll('.zs-tb')[tn - 1];
    if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* нет */ } }
  };
  SP.checkTone = function () {
    if (this.checked || this.ended) return;
    var self = this, t = this.tasks[this.ti];
    var asked = t.syls.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s.ask; });
    if (!asked.every(function (x) { return self.sel[x.i]; })) return;
    var good = asked.filter(function (x) { return self.sel[x.i] === x.s.tone; }).length, ok = good === asked.length;
    /* CONTRACT.md: одно событие на задание; у пары syllable — из двух слогов */
    this.emit('tone', { syllable: asked.map(function (x) { return x.s.raw; }).join(''), ok: ok });
    this.stats.syl += asked.length;
    this.stats.sylOk += good;
    this.streak = ok ? this.streak + 1 : 0;
    this.stats.best = Math.max(this.stats.best, this.streak);
    this.checked = true;
    this.renderTone();
  };
  SP.nextTone = function () {
    if (!this.checked || this.ended) return;
    this.ti++;
    if (this.streak >= STREAK_GOAL || this.ti >= this.tasks.length) return this.finish({});
    this.prepTone();
    this.renderTone();
  };

  /* ---------------- итог ---------------- */
  function pct(x) { return Math.round(Math.max(0, Math.min(1, x || 0)) * 100); }
  function progBar(a, b, label) {
    var pa = Math.max(0, Math.min(100, a)), pb = Math.max(pa, Math.min(100, b));
    return h('div', { cls: 'zs-bar', role: 'img', 'aria-label': label }, [
      h('i', { style: 'width:' + pa.toFixed(1) + '%' }),
      pb > pa ? h('i', { cls: 'gain', style: 'left:' + pa.toFixed(1) + '%;width:' + (pb - pa).toFixed(1) + '%' }) : null
    ]);
  }
  SP.bossPassed = function () {
    return !!this.bossDone && this.stats.total > 0 && this.stats.score / this.stats.total >= BOSS_PASS;
  };
  SP.renderResult = function (extra) {
    var self = this, S0 = this.S0, S1 = this.cur, o = this.opts, kind = this.kind, st = this.stats;
    var label = kind === 'boss' ? 'Экзамен урока ' + cnNum(lessonNum(o.lesson)) : kind === 'tones' ? 'Тоны' : this.cardTitle();
    var min = Math.max(1, Math.round((this.seconds || 0) / 60));
    var kids = [h('div', { cls: 'zs-cap' }, [label + ' · ' + min + ' мин'])];
    kids.push(h('div', { cls: 'zs-resxp' }, ['+' + this.xpGain() + ' XP']));

    var had = {};
    (S0.seals || []).forEach(function (s) { had[s] = 1; });
    (S1.seals || []).filter(function (s) { return !had[s]; }).forEach(function (s) {
      var inf = SEAL_INFO[s] || ['印', s];
      kids.push(h('div', { cls: 'zs-row zs-newseal', 'data-seal': s, role: 'img', 'aria-label': 'Новая печать: ' + inf[1] }, [
        h('span', { cls: 'zs-seal zs-hz', 'aria-hidden': 'true' }, [inf[0]]),
        h('span', { cls: 'zs-serif', 'aria-hidden': 'true' }, ['Печать «' + inf[1] + '»'])
      ]));
    });

    var L1 = S1.level || 1, up = L1 > (S0.level || 1), next = S1.nextLevelXp;
    var lvKids = [h('div', { cls: 'zs-lv' }, [h('b', { cls: 'zs-level' }, ['Уровень ' + cnNum(L1)]),
      h('span', { cls: 'zs-cap' }, [next ? 'до ' + cnNum(L1 + 1) + ' — ' + Math.max(0, next - (S1.levelXp || 0)) + ' XP' : 'максимум'])])];
    if (next) {
      var a = up ? 0 : 100 * (S0.levelXp || 0) / next, b = 100 * (S1.levelXp || 0) / next;
      lvKids.push(progBar(a, b, 'Уровень: ' + (S1.levelXp || 0) + ' из ' + next + ' XP'));
    } else lvKids.push(progBar(100, 100, 'Максимальный уровень'));
    if (up) lvKids.push(h('div', { cls: 'zs-cap zs-lvup', style: 'color:var(--zs-red);font-weight:600' }, ['Новый уровень']));
    kids.push(h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, lvKids));

    var cnt;
    if (kind === 'boss') cnt = [[this.answers, 'вопросов'], [st.score, 'верно'], [this.answers - st.score, 'ошибок', 1]];
    else if (kind === 'tones') cnt = [[st.syl, 'слогов'], [st.sylOk, 'верно'], [st.best, 'лучшая серия']];
    else cnt = [[st.cards, 'карточек'], [st.ok, 'помню'], [st.miss, 'не вспомнил', 1]];
    kids.push(h('div', { cls: 'zs-cnt' }, cnt.map(function (c) {
      return h('div', null, [h('b', { cls: c[2] && c[0] > 0 ? 'bad' : null }, [String(c[0])]), h('span', null, [c[1]])]);
    })));
    if (kind === 'boss') {
      var pass = this.bossPassed();
      kids.push(h('div', null, [h('span', { cls: 'zs-tag zs-verdict ' + (pass ? 'ok' : 'no') }, [pass ? 'Сдан' : 'Не сдан, нужно 80%'])]));
    }

    var L = o.lesson, l0 = (S0.lessons || {})[L], l1 = (S1.lessons || {})[L];
    if (kind === 'topic' && o.topic != null && l1) {
      var t0 = (l0 && l0.topics && l0.topics[o.topic]) || {}, t1 = (l1.topics && l1.topics[o.topic]) || {};
      kids.push(this.passSec('Тема', topicName(o.lesson, o.topic), t0.passed, t1.passed));
    } else if (kind === 'boss' && l1) {
      kids.push(this.passSec('Урок', 'Урок ' + lessonNum(L), l0 && l0.passed, l1.passed));
    }

    if (this.forgot.length) {
      var FMAX = 6, chips = this.forgot.slice(0, FMAX).map(function (w) {
        return h('li', null, [h('span', { cls: 'zs-hz', lang: 'zh-CN' }, [hzOf(w)]),
          h('span', null, [[pyOf(w), w.ru].filter(Boolean).join(' · ')])]);
      });
      if (this.forgot.length > FMAX) chips.push(h('li', { cls: 'zs-more' }, ['ещё ' + (this.forgot.length - FMAX)]));
      kids.push(h('div', { cls: 'zs-sec' }, [h('h3', null, ['Вернутся в повторение']), h('ul', { cls: 'zs-forgot' }, chips)]));
    }

    var q0 = {};
    (S0.quests || []).forEach(function (q) { if (q.done) q0[q.id] = 1; });
    var qd = (S1.quests || []).filter(function (q) { return q.done && !q0[q.id]; });
    if (qd.length) {
      kids.push(h('div', { cls: 'zs-sec' }, qd.map(function (q) {
        var qc = h('span', { cls: 'zs-qc', 'aria-hidden': 'true' });
        qc.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
        return h('div', { cls: 'zs-quest' }, [qc, h('span', null, ['Задание «' + q.title + '» ', h('b', null, ['+' + q.xp])])]);
      })));
    }

    var again = btn('zs-btn', 'Ещё раз', function () { self.again(); });
    var fin = btn('zs-btn pri', 'Готово', function () { self.done(); });
    this.xpEl = null;
    this.paint([h('div', { cls: 'zs-res', role: 'region', 'aria-label': 'Итог занятия' }, kids), h('div', { cls: 'zs-foot' }, [again, fin])], fin);
  };
  /* пустое занятие: только подпись и «Готово»; событие session не пишется */
  SP.renderEmpty = function () {
    var self = this;
    var msg = this.kind === 'review' ? 'Нечего повторять' : 'Нет заданий';
    var fin = btn('zs-btn pri', 'Готово', function () { self.done(); });
    this.xpEl = null;
    this.paint([h('div', { cls: 'zs-res zs-empty', role: 'region', 'aria-label': msg }, [msg]), h('div', { cls: 'zs-foot' }, [fin])], fin);
  };
  SP.passSec = function (head, title, p0, p1) {
    var a = pct(p0), b = pct(p1);
    return h('div', { cls: 'zs-sec' }, [h('h3', null, [head]),
      h('div', { cls: 'zs-pass' }, [h('span', null, [title]), h('span', { cls: 'zs-passv' }, [a + '% → ' + b + '%'])]),
      progBar(a, b, 'Пройдено ' + a + '% → ' + b + '%')]);
  };

  /* ---------------- экспорт ---------------- */
  var KINDS = { topic: 1, review: 1, boss: 1, tones: 1 };
  function mount(rootEl, opts) {
    opts = Object.assign({}, opts || {});
    if (!KINDS[opts.kind]) opts.kind = 'topic';
    injectStyle(rootEl.ownerDocument || document);
    var holder = { cur: null };
    var s = new Session(holder, rootEl, opts);
    holder.cur = s;
    try { s.start(); } catch (e) { s.destroy(); throw e; }
    return {
      destroy: function () { if (holder.cur) holder.cur.destroy(); },
      get session() { return holder.cur; }
    };
  }
  root.ZhSessions = {
    mount: mount,
    _tones: { parseSyllable: parseSyllable, splitPinyin: splitPinyin, toneTasks: toneTasks }
  };
})(typeof window !== 'undefined' ? window : this);
