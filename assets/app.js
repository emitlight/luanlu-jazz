/* ══════════════════════════════════════════════════════════════
   루앤루 · app.js — 라우터 + 뷰 렌더러 + 진도추적
   ══════════════════════════════════════════════════════════════ */
(function () {
  var D = window.LUANLU, M = window.MUSIC, C = window.LUANLU_COURSE;
  var app = document.getElementById('app');
  var pillsEl = document.getElementById('pills');
  var esc = M.esc;

  /* ── 라우트 ──
     자료실(사다리·테크닉·디코더·감상·강의)은 별도 화면이 아니라
     스텝/코스 페이지 안에 접이식으로 인라인되어 있다. */
  var ROUTES = [
    { id: 'my',     n: '01', label: '마이러닝' },
    { id: 'course', n: '02', label: '코스 지도' },
    { id: 'diary',  n: '03', label: '연습일지' },
    { id: 'guide',  n: '04', label: '이용안내' }
  ];

  /* ── 동기화 (sync.js가 없으면 조용히 무시 — 앱은 로컬만으로 완전 동작) ── */
  function SY() { return window.LUANLU_SYNC || null; }
  function syncTouch() { var s = SY(); if (s) s.touch(); }

  /* ── 저장 실패를 조용히 삼키지 않는다 ──
     용량 초과·사파리 프라이빗 모드에서 쓰기가 실패해도 지금까지는 화면이 정상으로
     보였다(catch(e){} 5곳). 실패를 상태로 올려 배너로 알린다. */
  var storeFailed = false;
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); storeFailed = false; return true; }
    catch (e) { storeFailed = true; return false; }
  }
  function readLS(key, dflt) {
    try { return JSON.parse(localStorage.getItem(key) || dflt); } catch (e) { return JSON.parse(dflt); }
  }
  window.LUANLU_STORE_FAILED = function () { return storeFailed; };

  /* ── 변경 시각 도장 ──
     값마다 언제 바뀌었는지를 따로 기록한다. 이게 없어서 기기 간 병합이
     "합집합"밖에 고를 수 없었고 체크 해제가 되살아났다.
     키 형식: 'course.s06.1' / 'progress.shell' */
  var SKEY = 'luanlu.stamps.v1';
  function getStamps() { return readLS(SKEY, '{}'); }
  function stamp(k) { var st = getStamps(); st[k] = new Date().toISOString(); writeLS(SKEY, st); }
  window.LUANLU_STAMPS = getStamps;

  /* ── 진도 (localStorage, file:// 안전) ── */
  var PKEY = 'luanlu.progress.v1';
  function getProg() { return readLS(PKEY, '{}'); }
  function setProg(p) { writeLS(PKEY, p); syncTouch(); }
  function isDone(id) { return !!getProg()[id]; }
  function toggleDone(id) {
    var p = getProg(); if (p[id]) delete p[id]; else p[id] = 1;
    setProg(p); stamp('progress.' + id);
  }
  function allModuleIds() { return Object.keys(D.modules); }
  function doneCount() { var p = getProg(), ids = allModuleIds(), c = 0; ids.forEach(function (i) { if (p[i]) c++; }); return c; }

  /* ── 코스 진도 (스텝별 통과 기준 체크) ── */
  var CKEY = 'luanlu.course.v1';
  function getCourse() { return readLS(CKEY, '{}'); }
  function setCourse(c) { writeLS(CKEY, c); syncTouch(); }
  function gatesOf(id) { var e = getCourse()[id]; return (e && e.g) || []; }
  /* 완료 = '확정'까지 끝난 것. 예비 통과는 아직 완료가 아니다.
     단 구버전 데이터(prov/conf 없이 게이트만 찬 것)는 완료로 인정해 호환한다. */
  function stepDone(id) {
    var m = gateMeta(id);
    if (m.conf) return true;
    if (m.prov) return false;
    return gatesPassed(id);
  }
  function toggleGate(id, i) {
    var c = getCourse(), e = c[id] || (c[id] = { g: [] });
    e.g = e.g || [];
    e.g[i] = e.g[i] ? 0 : 1;
    setCourse(c);
    stamp('course.' + id + '.' + i);
    // 스텝을 통과하면 연결된 테크닉 모듈도 진도에 반영
    var st = C.byId(id);
    if (st && st.mod && stepDone(id) && !isDone(st.mod)) { var p = getProg(); p[st.mod] = 1; setProg(p); }
  }
  function courseDone() { return C.steps.filter(function (s) { return stepDone(s.id); }).length; }
  /* 아직 통과하지 못한 첫 스텝 = "오늘 할 것" */
  function currentStep() {
    for (var i = 0; i < C.steps.length; i++) if (!stepDone(C.steps[i].id)) return C.steps[i];
    return C.steps[C.steps.length - 1];
  }

  /* ── 연습 날짜 (스트릭) ──
     진행바는 5~14일에 한 칸 움직인다. 매일의 행동은 매일 보상해야 한다. */
  var DAYKEY = 'luanlu.days.v1';
  function getDays() { return readLS(DAYKEY, '{}'); }
  function markToday(minimal) {
    var d = getDays(), t = todayStr();
    if (d[t] !== 1) { d[t] = minimal ? 2 : 1; writeLS(DAYKEY, d); stamp('day.' + t); }
    syncTouch();
  }
  function dayDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function streakInfo() {
    var d = getDays(), t = todayStr(), n = 0, cur = t;
    if (!d[t]) { cur = shiftDay(t, -1); }
    while (d[cur]) { n++; cur = shiftDay(cur, -1); }
    var last = Object.keys(d).sort().pop() || null;
    return { count: n, days: d, today: !!d[t], last: last,
             gap: last ? dayDiff(last, t) : null };
  }
  function shiftDay(iso, delta) {
    var dt = new Date(iso + 'T00:00:00');
    dt.setDate(dt.getDate() + delta);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
  }

  /* ── 복습 덱 (Leitner 3상자: 1일 / 4일 / 11일) ──
     통과한 스텝은 currentStep()이 다시 주지 않는다. 앱이 직접 도래시킨다. */
  var RKEY = 'luanlu.review.v1';
  var BOXES = [1, 4, 11];
  function getReview() { return readLS(RKEY, '{}'); }
  function setReview(r) { writeLS(RKEY, r); syncTouch(); }
  function reviewEnroll(stepId) {
    var r = getReview();
    if (r[stepId]) return;
    r[stepId] = { box: 0, due: shiftDay(todayStr(), BOXES[0]) };
    setReview(r); stamp('review.' + stepId);
  }
  function reviewGrade(stepId, how) {
    var r = getReview(), c = r[stepId];
    if (!c) return;
    if (how === 'up') c.box = Math.min(c.box + 1, BOXES.length - 1);
    else if (how === 'down') c.box = Math.max(0, c.box - 2);
    c.due = shiftDay(todayStr(), BOXES[c.box]);
    c.last = todayStr();
    setReview(r); stamp('review.' + stepId);
  }
  /* 오늘 도래한 카드 — 상한 2장. 넘치면 오래 밀린 것부터 */
  function dueCards(limit) {
    var r = getReview(), t = todayStr(), out = [];
    Object.keys(r).forEach(function (id) {
      var c = r[id];
      if (c.last === t) return;              /* 오늘 이미 함 */
      if (c.due && c.due <= t) out.push({ id: id, box: c.box, due: c.due, over: dayDiff(c.due, t) });
    });
    out.sort(function (a, b) { return b.over - a.over; });
    return out.slice(0, limit == null ? 2 : limit);
  }
  function doneToday(stepId) {
    var c = getReview()[stepId];
    return !!(c && c.last === todayStr());
  }

  /* ── 2단 게이트 (콜드 스타트 확정) ──
     3개를 다 체크하면 '예비 통과'. 다음 날 워밍업 없이 첫 시도로 재통과해야 '확정'.
     어제의 성공은 위조할 수 없다. */
  function gateMeta(id) { return getCourse()[id] || {}; }
  function gatesPassed(id) {
    var st = C.byId(id); if (!st) return false;
    var g = gatesOf(id);
    for (var i = 0; i < st.gates.length; i++) if (!g[i]) return false;
    return true;
  }
  function stepPhase(id) {
    var m = gateMeta(id);
    if (m.conf) return 'confirmed';
    if (!gatesPassed(id)) return 'open';
    if (m.prov && m.prov < todayStr()) return 'due';   /* 확정 시도 가능 */
    return 'prov';                                      /* 오늘 예비 통과 */
  }
  function markProvisional(id) {
    var c = getCourse(); var e = c[id] || (c[id] = { g: [] });
    if (!e.prov) { e.prov = todayStr(); setCourse(c); stamp('course.' + id + '.prov'); }
  }
  function confirmStep(id) {
    var c = getCourse(); var e = c[id] || (c[id] = { g: [] });
    e.conf = todayStr(); setCourse(c); stamp('course.' + id + '.conf');
    reviewEnroll(id);
    var st = C.byId(id);
    if (st && st.mod && !isDone(st.mod)) { var p = getProg(); p[st.mod] = 1; setProg(p); stamp('progress.' + st.mod); }
  }
  function unconfirm(id) {   /* 확정 시도 실패 → 하루 더 */
    var c = getCourse(); var e = c[id]; if (!e) return;
    e.prov = todayStr(); delete e.conf;
    setCourse(c); stamp('course.' + id + '.prov');
  }

  /* ── 연습일지 (localStorage) ── */
  var DKEY = 'luanlu.diary.v1';
  var diaryEditId = null;
  function getDiary() { return readLS(DKEY, '[]'); }
  function setDiary(d) { writeLS(DKEY, d); syncTouch(); }
  function todayStr() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function escAttr(s) { return esc(s == null ? '' : String(s)).replace(/"/g, '&quot;'); }
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); return true; } catch (e) { return false; }
  }
  function saveDiaryFromForm() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var tasks = [];
    for (var i = 0; i < 5; i++) { var txt = g('diary-t' + i); if (txt) { var cb = document.getElementById('diary-c' + i); tasks.push({ text: txt, done: cb ? cb.checked : false }); } }
    var entry = { date: g('diary-date') || todayStr(), focus: g('diary-focus'), minutes: g('diary-min'), tempo: g('diary-tempo'), tasks: tasks, notes: g('diary-notes'), m: new Date().toISOString() };
    var d = getDiary();
    if (diaryEditId) { entry.id = diaryEditId; d = d.map(function (e) { return e.id === diaryEditId ? entry : e; }); diaryEditId = null; }
    else { entry.id = 'd' + new Date().getTime(); d.unshift(entry); }
    setDiary(d); render();
  }
  function toggleDiaryTask(id, idx) {
    var d = getDiary();
    d.forEach(function (e) { if (e.id === id && e.tasks && e.tasks[idx]) { e.tasks[idx].done = !e.tasks[idx].done; e.m = new Date().toISOString(); } });
    setDiary(d); render();
  }
  var DELKEY = 'luanlu.diarydel.v1';
  function delDiary(id) {
    var d = getDiary().filter(function (e) { return e.id !== id; });
    try {
      var gone = JSON.parse(localStorage.getItem(DELKEY) || '[]');
      if (gone.indexOf(id) < 0) { gone.push(id); localStorage.setItem(DELKEY, JSON.stringify(gone)); }
    } catch (e) {}
    setDiary(d); if (diaryEditId === id) diaryEditId = null; render();
  }
  function copyDiaryReview(id, btn) {
    var e = getDiary().filter(function (x) { return x.id === id; })[0]; if (!e) return;
    var L = ['[루앤루 연습일지 · 선생님 검수 요청]', '날짜: ' + e.date + (e.focus ? (' · 초점: ' + e.focus) : '')];
    var m = []; if (e.minutes) m.push(e.minutes + '분'); if (e.tempo) m.push(e.tempo + 'bpm'); if (m.length) L.push(m.join(' · '));
    if (e.tasks && e.tasks.length) { L.push('연습 항목:'); e.tasks.forEach(function (t) { L.push('  ' + (t.done ? '[완료] ' : '[미완] ') + t.text); }); }
    if (e.notes) L.push('메모: ' + e.notes);
    L.push('※ 위 연습을 재즈 피아노 교수 관점에서 검수·피드백 부탁합니다.');
    var ok = copyText(L.join('\n'));
    if (btn) { var old = btn.textContent; btn.textContent = ok ? '복사됨 ✓ 채팅에 붙여넣기' : '복사 실패 — 수동 선택'; setTimeout(function () { btn.textContent = old; }, 2400); }
  }

  /* ── 건반 렌더 헬퍼 ── */
  function midi(n) { return M.noteToMidi(n); }
  function chordKbd(chord, shared) {
    var marks = M.voicing(chord.lh, chord.rh);
    var opts = {};
    var lo = chord.lo || (shared && shared.lo), hi = chord.hi || (shared && shared.hi);
    if (lo && hi) { opts.lo = midi(lo); opts.hi = midi(hi); }
    return '<div class="kbd-block">' +
      '<div class="miniban">' + esc(chord.name) + '</div>' +
      '<div class="kbd-wrap">' + M.renderKeyboard(marks, opts) + '</div></div>';
  }
  function chordGroup(chords, cap, opts) {
    opts = opts || {};
    var html = '';
    chords.forEach(function (c) { html += chordKbd(c, opts.shared); });
    var hasBoth = chords.some(function (c) { return (c.lh && c.lh.length) && (c.rh && c.rh.length); });
    var legend = (opts.legend !== false && hasBoth) ? M.legend() : '';
    var caption = cap ? '<div class="kbd-cap">' + cap + '</div>' : '';
    return '<div class="kbd-group">' + html + legend + caption + '</div>';
  }

  /* ── 리듬 스트립(찰스턴) ── */
  function rhythmStrip() {
    var cells = '', hits = { 0: '1', 3: '&', 4: '', };
    var pattern = [1, 0, 0, 1, 0, 0, 0, 0]; // 1박 + 2박 뒤 &
    var labels  = ['1', '&', '2', '&', '3', '&', '4', '&'];
    for (var i = 0; i < 8; i++) {
      cells += '<div class="rc' + (pattern[i] ? ' hit' : '') + '"><span>' + labels[i] + '</span></div>';
    }
    return '<div class="rhythm"><div class="rhead">찰스턴 컴핑 리듬</div><div class="rcells">' + cells + '</div>' +
           '<div class="kbd-cap">■ = 왼손이 화음을 놓는 자리 (1박, 그리고 2박 뒤 업비트). 나머지는 여백.</div></div>';
  }

  /* ── 공통 UI ── */
  function backTo(route, label) {
    return '<a class="backlink" data-go="' + route + '">← ' + esc(label) + '</a>';
  }
  var ytSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12 2 23V1z"/></svg>';

  /* ════════════════ 뷰: 홈 ════════════════ */
  function viewHome() {
    var cur = currentStep(), ph = C.phase(cur.phase);
    var done = courseDone(), total = C.steps.length;
    var pct = Math.round(done / total * 100);
    var started = done > 0;

    var resume =
      '<div class="resume" data-step="' + cur.id + '">' +
        '<span class="rlab">' + (started ? '이어서 하기' : '여기서 시작') + '</span>' +
        '<div class="rmeta"><span class="rphase">' + esc(ph.n + ' · ' + ph.title) + '</span>' +
          '<span class="rn">STEP ' + cur.n + ' / ' + total + '</span></div>' +
        '<h3 class="rtitle">' + esc(cur.title) + '</h3>' +
        '<div class="rgoal">' + esc(cur.goal) + '</div>' +
        '<div class="rfoot"><span class="chip">하루 ' + cur.mins + '분</span>' +
          '<span class="chip">' + esc(cur.days) + '</span>' +
          (cur.song ? '<span class="chip">' + esc(songTitle(cur.song.dec)) + '</span>' : '') +
          '<span class="rgo">오늘의 연습 펼치기 →</span></div>' +
      '</div>';

    /* 한 스텝 안에 무엇이 들어 있는지 — 흩어진 메뉴가 어떻게 합쳐지는지 보여준다 */
    var anatomy = [
      { i: '🎯', t: '왜 지금 이걸', d: '앞 스텝에서 무엇을 했고 이게 어디로 이어지는지. 흐름이 끊기지 않습니다.' },
      { i: '⏱', t: '오늘 이렇게 (분 단위)', d: '워밍업 몇 분, 드릴 몇 분, 곡 적용 몇 분. 순서와 시간이 정해져 있습니다.' },
      { i: '🎹', t: '손 모양', d: '전환의 사다리 · 테크닉 가이드의 건반 그림을 그 자리에 가져옵니다.' },
      { i: '🎼', t: '곡의 어느 구간', d: '리얼북 디코더의 곡에서 <b>몇 마디를 어떻게</b>. "곡에 적용"이 추상적으로 끝나지 않습니다.' },
      { i: '🎥', t: '강의는 딱 한 편', d: '고르느라 시간 버리지 않도록 그 스텝에 맞는 영상 하나만.' },
      { i: '✅', t: '통과 기준', d: '이 3가지가 되면 다음 스텝. "언제 넘어가지?"를 없앴습니다.' }
    ].map(function (a) {
      return '<div class="anat"><span class="ai">' + a.i + '</span>' +
        '<span class="at"><b>' + esc(a.t) + '</b><span class="ad">' + a.d + '</span></span></div>';
    }).join('');

    var phaseline = C.phases.map(function (p) {
      var ss = C.stepsOf(p.id);
      var dn = ss.filter(function (s) { return stepDone(s.id); }).length;
      var state = dn === ss.length ? ' done' : (p.id === ph.id ? ' now' : '');
      return '<div class="pl' + state + (p.key ? ' key' : '') + '" data-go="course">' +
        '<span class="pln">' + p.n + '</span>' +
        '<span class="plt">' + esc(p.title) + '</span>' +
        '<span class="plc">' + dn + '/' + ss.length + '</span></div>';
    }).join('');

    return '<section class="view">' +
      '<div class="hero">' +
        '<div class="vision">코드를 <em>아는</em> 데서 멈춘 당신을,<br>리얼북 한 곡을 <em>연주하는</em> 데까지.</div>' +
        '<div class="sub2">흩어진 이론·영상·곡을 <b>하루치 연습 단위 21개</b>로 묶었습니다. ' +
        '매일 이 페이지를 열어 <b>지금 이 스텝 하나만</b> 하면 됩니다 — 무엇을 볼지 고르지 않아도 됩니다.</div>' +
        resume +
      '</div>' +

      '<div class="progbar-wrap" style="margin-top:18px"><div class="progbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="progstat">코스 진행 ' + done + ' / ' + total + ' 스텝 · ' + pct + '%</div></div>' +
      '<div class="phaseline">' + phaseline + '</div>' +

      '<div class="eyebrow">한 스텝 안에 들어 있는 것</div>' +
      '<p class="body">전환의 사다리 · 테크닉 가이드 · 리얼북 디코더 · 강의를 따로 찾아다니지 않습니다. ' +
      '한 스텝을 열면 그날 필요한 것만 <b>이 순서로</b> 들어 있습니다.</p>' +
      '<div class="anatgrid">' + anatomy + '</div>' +

      '<div class="callout tip" style="margin-top:16px"><span class="lab">따로 찾아다닐 곳이 없습니다</span>' +
      '전환의 사다리 · 테크닉 이론 · 리얼북 곡 분해 · 강의 · 감상은 <b>별도 메뉴가 아니라</b> 각 스텝 안에 들어 있습니다. ' +
      '위쪽은 오늘 할 연습, 맨 아래 <b>「더 깊게」</b>는 접혀 있는 전문(全文) — 막혔을 때만 펼치면 됩니다.</div>' +

      '<div class="cta-row" style="margin-top:16px;display:flex;gap:9px;flex-wrap:wrap">' +
        '<a class="btn solid" data-step="' + cur.id + '">STEP ' + cur.n + ' 시작 →</a>' +
        '<a class="btn" data-go="course">전체 코스 지도</a>' +
        '<a class="btn" data-go="diary">📔 연습일지</a></div>' +
    '</section>';
  }

  /* ════════════════ 공용 렌더러 ════════════════
     자료실 뷰를 없애고, 그 내용을 필요한 자리에 접이식으로 인라인한다. */
  function songById(id) { return D.decoder.filter(function (x) { return x.id === id; })[0]; }
  function songTitle(id) { var s = songById(id); return s ? s.title : id; }
  function songKey(id) { var s = songById(id); return s ? s.key : ''; }

  /* 접이식 블록 — <details>라 JS 없이도 열리고 접힌다 */
  function acc(icon, title, sub, body, open) {
    return '<details class="acc"' + (open ? ' open' : '') + '>' +
      '<summary><span class="ai">' + icon + '</span>' +
        '<span class="at"><b>' + title + '</b>' + (sub ? '<span class="as">' + sub + '</span>' : '') + '</span>' +
        '<span class="achev">' + chev() + '</span></summary>' +
      '<div class="accbody">' + body + '</div></details>';
  }

  /* ── 사다리 한 계단 전문 ── */
  function rungFull(i) {
    var r = D.ladder[i]; if (!r) return '';
    var prev = D.ladder[i - 1], next = D.ladder[i + 1];
    var body = r.rhythm ? rhythmStrip()
      : chordGroup(r.chords, null, { shared: { lo: r.lo, hi: r.hi } });
    var pts = '<ul class="pts">' + r.points.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>';
    var ctx = '<div class="rungctx">' +
      (prev ? '<span class="rc-p">← rung ' + prev.n + ' ' + esc(prev.name) + '</span>' : '<span></span>') +
      '<span class="rc-h">rung ' + r.n + ' · ' + esc(r.name) + '</span>' +
      (next ? '<span class="rc-n">rung ' + next.n + ' ' + esc(next.name) + ' →</span>' : '<span></span>') +
      '</div>';
    return ctx + body + pts;
  }

  /* ── 테크닉 모듈 전문 ── */
  function modFull(mid) {
    var m = D.modules[mid]; if (!m) return '';
    var lv = D.levels.filter(function (l) { return l.id === m.level; })[0];
    var steps = '<div class="steps">' + m.steps.map(function (x) {
      return '<div class="s"><b>' + esc(x.t) + '</b> <span class="sd">' + esc(x.d) + '</span></div>';
    }).join('') + '</div>';
    var ex = m.example ? '<div class="section"><h4>건반 예시</h4>' + chordGroup(m.example.chords, m.example.cap) + '</div>' : '';
    var rh = m.rhythm ? '<div class="section"><h4>컴핑 리듬</h4>' + rhythmStrip() + '</div>' : '';
    var mis = (m.mistakes && m.mistakes.length)
      ? '<div class="callout warn"><span class="lab">흔한 실수</span>' + m.mistakes.map(esc).join('<br>') + '</div>' : '';
    var lecs = (m.lectures && m.lectures.length)
      ? '<div class="section"><h4>이 주제의 강의</h4><div class="lecgroup">' +
        m.lectures.map(function (lid, i) { return lectureRow(D.lectures[lid], i); }).join('') + '</div></div>' : '';
    return '<div class="miniban">' + esc(lv ? lv.title : '') + ' · ' + esc(m.sub) + '</div>' +
      '<div class="section"><h4>개념</h4><p class="body" style="color:var(--ink)">' + esc(m.concept) + '</p></div>' +
      '<div class="callout play"><span class="lab">루아에게 왜</span>' + m.why + '</div>' +
      '<div class="section"><h4>연습 요령</h4>' + steps + '</div>' + ex + rh + mis + lecs;
  }

  /* ── 리얼북 디코더 곡 전문 (7단계) ── */
  function songFull(sid) {
    var song = songById(sid); if (!song) return '';
    var harmony = song.harmony.map(function (seg) {
      var bars = seg.bars.map(function (b) {
        var cls = /^ii|iiø/.test(b.f) ? 'ii' : (/^V/.test(b.f) ? 'V' : (/I|i\b|i$/.test(b.f) ? 'I' : ''));
        return '<div class="bar ' + cls + '">' + esc(b.c) + '<span class="fn">' + esc(b.f) + '</span></div>';
      }).join('');
      return '<div style="margin-top:10px"><div class="miniban">' + esc(seg.seg) + '</div><div class="prog">' + bars + '</div></div>';
    }).join('') +
    '<div class="prog-key"><span>▉ ii (서브도미넌트)</span><span>▉ V (도미넌트)</span><span>▉ I/i (토닉)</span></div>' +
    (/32/.test(song.form) ? '<div class="kbd-cap" style="margin-top:8px">※ 32마디(AABA·ABAC) 곡은 위 섹션이 화성의 뼈대이며 나머지 마디는 대개 A의 반복/변형입니다 — 전체 마디는 보유한 리얼북으로 확인하세요.</div>' : '');

    var recs = song.recordings.map(function (r) {
      return '<a class="track" href="' + D.yt(r.q) + '" target="_blank" rel="noopener">' +
        '<span class="ti"><span class="ar">' + esc(r.a) + '</span><span class="wk">' + esc(r.w) + '</span>' +
        '<span class="why">' + esc(r.why) + '</span></span>' +
        '<span class="go">' + ytSvg + '<span>YT</span></span></a>';
    }).join('');

    var otherSteps = C.stepsForSong(sid).map(function (x) {
      var st = C.byId(x);
      return '<a class="btn sm" data-step="' + x + '">' + (stepDone(x) ? '✓ ' : '') + 'STEP ' + st.n + ' · ' + esc(st.title) + '</a>';
    }).join('');

    return '<div class="miniban">' + esc(song.composer) + ' · ' + esc(song.year) + ' · ' + esc(song.key) + ' · ' + esc(song.genre) + '</div>' +
      '<div class="callout play" style="margin-top:10px"><span class="lab">왜 이 곡</span>' + song.why + '</div>' +
      '<div class="decstep">' + [
        { st: 'STEP 01 · 폼 & 로드맵', h: '곡의 구조', body: '<p class="body" style="color:var(--ink)">' + esc(song.form) + '</p><ul class="pts">' + song.roadmap.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' },
        { st: 'STEP 02 · 화성 분석', h: 'ii–V–I은 어디에?', body: harmony },
        { st: 'STEP 03 · 왼손 컴핑', h: '셸 → 가이드톤 → 루트리스', body: '<p class="body">' + esc(song.lh) + '</p>' },
        { st: 'STEP 04 · 오른손 처리', h: '멜로디 + 화성화', body: '<p class="body">' + esc(song.rh) + '</p>' },
        { st: 'STEP 05 · 즉흥 로드맵', h: '무엇을 어디에', body: '<ul class="pts">' + song.improv.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' },
        { st: 'STEP 06 · 추천 연주', h: '거장은 이렇게 쳤다', body: recs + '<div class="pick"><b>#1 추천</b> — ' + song.pick + '</div>' },
        { st: 'STEP 07 · 곡 전체 연습 플랜', h: '한 곡 완주까지', body: '<ul class="pts">' + song.practice.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' }
      ].map(function (x) {
        return '<div class="dstep"><span class="dot"></span><span class="st">' + x.st + '</span>' +
          '<div class="sh">' + esc(x.h) + '</div>' + x.body + '</div>';
      }).join('') + '</div>' +
      (otherSteps ? '<hr class="rule"><div class="miniban">이 곡을 쓰는 코스 스텝</div><div class="cta-row" style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap">' + otherSteps + '</div>' : '');
  }

  /* ── 그 스텝의 곡·구간을 실제 보이싱으로 ──
     course.js의 voice = {seg, from, to, form} 은 코드 심볼을 복제하지 않고
     content.js DECODER[].harmony[seg].bars[] 를 가리킨다 (단일 진실원 유지). */
  var FORM_KR = { shell: '셸 (루트+3+7)', guide: '가이드톤 (3·7)',
                  rootlessA: '루트리스 A형', rootlessB: '루트리스 B형' };
  function songVoicing(s) {
    if (!window.VOICING || !s.voice || !s.song) return null;
    var song = songById(s.song.dec);
    if (!song) return null;
    var seg = song.harmony[s.voice.seg || 0];
    if (!seg) return null;

    var syms = [];
    seg.bars.slice(s.voice.from || 0, s.voice.to == null ? 4 : s.voice.to)
      .forEach(function (b) {
        String(b.c).split('·').forEach(function (c) { c = c.trim(); if (c) syms.push(c); });
      });
    if (!syms.length) return null;

    var voiced = VOICING.progression(syms, s.voice.form || 'shell');
    var chords = voiced.filter(function (v) { return v.notes; }).map(function (v) {
      return { name: v.sym, lh: VOICING.marks(v, 'L'), rh: [] };
    });
    if (!chords.length) return null;

    var sp = VOICING.span(voiced, 2);
    return {
      chords: chords,
      lo: sp ? M.midiToName(sp.lo) : 'C3',
      hi: sp ? M.midiToName(sp.hi) : 'C5',
      cap: esc(song.title) + ' · ' + esc(song.key) + ' — ' +
           (FORM_KR[s.voice.form] || s.voice.form) + '. ' +
           esc(seg.seg) + '의 진행을 보이스리딩으로 이은 자리입니다.'
    };
  }

  /* ── 오늘 들을 것 (감상·음반을 스텝 안으로) ── */
  function listenPick(s) {
    if (!s.listen) return '';
    var e = D.listening.filter(function (x) { return x.id === s.listen.era; })[0];
    if (!e) return '';
    var it = s.listen.album != null ? (e.albums || [])[s.listen.album] : (e.tracks || [])[s.listen.track];
    if (!it) return '';
    var who = it.a, what = it.al || it.w, q = it.q || (it.a + ' ' + it.w);
    return '<div class="section"><h4>오늘 들을 것 · 1곡</h4>' +
      '<a class="track listenpick" href="' + D.yt(q) + '" target="_blank" rel="noopener">' +
        '<span class="ti"><span class="ar">' + esc(who) + '<span class="pf">' + esc(e.kr) + ' · ' + esc(e.yr) + '</span></span>' +
        '<span class="wk">' + esc(what) + '</span>' +
        '<span class="why">' + s.listen.why + '</span></span>' +
        '<span class="go">' + ytSvg + '<span>YT</span></span></a>' +
      '<div class="kbd-cap" style="margin-top:6px">연습 전후 5분. 손이 아니라 <b>귀</b>를 그 스텝에 맞추는 시간입니다.</div></div>';
  }


  /* ══════════════ 마이러닝 블록들 ══════════════ */

  /* 진도 링 — 의존성 없는 인라인 SVG */
  function ringSVG(pct, done, total) {
    var C0 = 2 * Math.PI * 40;
    var off = C0 * (1 - pct / 100);
    return '<svg class="ring" viewBox="0 0 88 88" role="img" aria-label="진행률 ' + pct + '퍼센트">' +
      '<g transform="rotate(-90 44 44)">' +
      '<circle class="rg-track" cx="44" cy="44" r="40"></circle>' +
      '<circle class="rg-val" cx="44" cy="44" r="40" stroke-dasharray="' + C0.toFixed(1) +
        '" stroke-dashoffset="' + off.toFixed(1) + '"></circle></g>' +
      '<text class="rg-pct" x="44" y="42">' + pct + '%</text>' +
      '<text class="rg-sub" x="44" y="60">' + done + '/' + total + '</text></svg>';
  }

  /* ① 오늘 이 한 장 — 상태에 따라 다섯 얼굴 */
  function blkToday() {
    var cur = currentStep(), ph = C.phase(cur.phase), total = C.steps.length;
    var sk = streakInfo();
    var phase = stepPhase(cur.id);
    var cls = 'is-resume', lab = '이어서 하기', act = 'STEP ' + cur.n + ' 열기 →', sub = esc(cur.goal), extra = '';

    if (courseDone() === 0 && !sk.count) { cls = 'is-start'; lab = '여기서 시작'; act = 'STEP ' + cur.n + ' 시작 →'; }
    if (phase === 'due') {
      cls = 'is-confirm'; lab = '◐ 확정 대기 · 어제 예비 통과';
      act = '워밍업 없이 첫 시도 →';
      sub = '어제 통과 기준을 다 채웠습니다. 오늘 <b>가장 먼저</b>, 워밍업 없이 대표 항목 하나만 다시 되면 확정입니다.';
      extra = '<a class="today-min" data-retry="' + cur.id + '">안 됐다 — 하루 더</a>';
    } else if (sk.gap != null && sk.gap >= 3) {
      cls = 'is-back'; lab = sk.gap + '일 만이네요';
      act = '줄인 오늘로 시작 →';
      sub = '오래 쉬었으니 오늘은 <b>복습 카드와 첫 드릴 하나</b>만 하세요. 그것만으로도 연속이 이어집니다.';
      extra = '<a class="today-min" data-min="' + cur.id + '">5분만 하기</a>';
    } else if (sk.today) {
      cls = 'is-done'; lab = '✓ 오늘 완료';
      sub = '오늘 몫은 끝냈습니다. 더 해도 좋지만, 안 해도 연속은 유지됩니다.';
      act = '📔 일지 쓰기 →';
      extra = '<a class="today-min" data-step="' + cur.id + '">한 번 더 보기</a>';
    } else {
      extra = '<a class="today-min" data-min="' + cur.id + '">5분만 하기</a>';
    }

    var actAttr = (cls === 'is-done') ? 'data-diarystep="' + cur.id + '"' : 'data-step="' + cur.id + '"';
    return '<section class="today ' + cls + '" data-step="' + cur.id + '">' +
      '<span class="today-lab">' + lab + '</span>' +
      '<div class="today-meta"><span class="tm-phase">' + esc(ph.n + ' · ' + ph.title) + '</span>' +
        '<span class="tm-n">STEP ' + cur.n + ' / ' + total + '</span></div>' +
      '<h2 class="today-title">' + esc(cur.title) + '</h2>' +
      '<div class="today-goal">' + sub + '</div>' +
      '<div class="today-chips"><span class="chip time">⏱ ' + cur.mins + '분</span>' +
        '<span class="chip">' + esc(cur.days) + '</span>' +
        (cur.key ? '<span class="pill solid">★ 핵심</span>' : '') +
        (cur.song ? '<span class="chip song">' + esc(songTitle(cur.song.dec)) + '</span>' : '') + '</div>' +
      '<a class="btn solid today-act" ' + actAttr + '>' + act + '</a>' + extra +
    '</section>';
  }

  /* ② 연속 기록 */
  function blkStreak() {
    var sk = streakInfo(), t = todayStr(), dots = '';
    for (var i = 6; i >= 0; i--) {
      var d = shiftDay(t, -i), v = sk.days[d];
      var c = v === 1 ? 'on' : v === 2 ? 'min' : 'off';
      if (i === 0) c += ' is-today';
      dots += '<i class="' + c + '"></i>';
    }
    var note = sk.count ? '5분 최소 실행도 연속으로 칩니다' : '오늘 5분만 해도 시작됩니다';
    return '<div class="streak">' +
      '<div class="sk-dots">' + dots + '</div>' +
      '<span class="sk-count">' + (sk.count ? sk.count + '일째' : '오늘이 1일째') + '</span>' +
      '<span class="sk-note">' + note + '</span></div>';
  }

  /* ③ 복습 덱 — 카드에서 이동 없이 그 자리에서 완결 */
  function blkRevdeck(compact) {
    var cards = dueCards(2);
    var doneList = Object.keys(getReview()).filter(doneToday);
    if (!cards.length && !doneList.length) {
      return compact ? '' :
        '<div class="revdeck"><div class="rd-head"><h4>오늘의 복습</h4></div>' +
        '<div class="rd-empty">오늘 도래한 복습이 없습니다 — 새 스텝을 통과하면 1일 뒤부터 여기 나옵니다.</div></div>';
    }
    var html = cards.map(function (c) {
      var st = C.byId(c.id); if (!st) return '';
      var rep = st.gates[0];
      return '<div class="revcard">' +
        '<div class="rc-src">STEP ' + st.n + ' · ' + esc(st.title) + ' · 상자 ' + (c.box + 1) +
          ' (' + BOXES[c.box] + '일 간격)' + (c.over > 0 ? ' · ' + c.over + '일 밀림' : '') + '</div>' +
        '<div class="rc-task">' + esc(st.drills[0].t) + ' — ' + st.drills[0].d + '</div>' +
        '<div class="rc-crit">판정 — ' + esc(rep) + '</div>' +
        '<div class="rc-acts">' +
          '<button class="btn ok" data-rev="' + c.id + ':up">됐다</button>' +
          '<button class="btn" data-rev="' + c.id + ':hold">애매</button>' +
          '<button class="btn warn" data-rev="' + c.id + ':down">안 됐다</button>' +
        '</div></div>';
    }).join('');
    html += doneList.map(function (id) {
      var st = C.byId(id); if (!st) return '';
      var c = getReview()[id];
      return '<div class="revcard is-done"><span class="rc-tick">✓</span>STEP ' + st.n + ' · ' +
        esc(st.title) + ' — 다음 ' + BOXES[c.box] + '일 뒤</div>';
    }).join('');
    return '<div class="revdeck"><div class="rd-head"><h4>오늘의 복습 · ' + cards.length + '장</h4>' +
      '<span class="pill out">워밍업 대신</span></div>' + html + '</div>';
  }

  /* ④ 진행 */
  function blkProgress() {
    var done = courseDone(), total = C.steps.length;
    var pct = Math.round(done / total * 100);
    var rows = C.phases.map(function (p) {
      var ss = C.stepsOf(p.id);
      var dn = ss.filter(function (x) { return stepDone(x.id); }).length;
      var w = Math.round(dn / ss.length * 100);
      return '<div class="prow" data-go="course"><span class="pw">' + esc(p.title) + '</span>' +
        '<span class="pbar"><i style="width:' + w + '%"></i></span>' +
        '<span class="pct">' + dn + '/' + ss.length + '</span></div>';
    }).join('');
    return '<div class="progblock">' + ringSVG(pct, done, total) +
      '<div class="phaserows" style="margin:0">' + rows + '</div></div>';
  }

  /* ⑤ 최근 연습 */
  function blkRecent() {
    var d = getDiary().slice(0, 3);
    if (!d.length) return '<div class="rd-empty">아직 기록이 없습니다 — 오늘 연습 뒤 「이 스텝으로 연습일지 쓰기」를 눌러보세요.</div>';
    return '<div class="recent">' + d.map(function (e) {
      var meta = [];
      if (e.minutes) meta.push(e.minutes + '분');
      if (e.tempo) meta.push(e.tempo + 'bpm');
      return '<div class="rcrow" data-go="diary"><span class="rc-date">' + esc(e.date) + '</span>' +
        '<span class="rc-focus">' + esc(e.focus || '(초점 미기재)') + '</span>' +
        '<span class="rc-meta">' + meta.join(' · ') + '</span></div>';
    }).join('') + '</div>';
  }

  /* ⑥ 시스템 배너 — 저장 실패는 조용히 넘어가지 않는다 */
  function renderSysbar() {
    var el = document.getElementById('sysbar');
    if (!el) return;
    if (window.LUANLU_STORE_FAILED && window.LUANLU_STORE_FAILED()) {
      el.innerHTML = '<div class="sysbar err"><span class="sb-dot"></span>' +
        '<span class="sb-msg">진도를 저장하지 못했습니다. 저장공간이 가득 찼거나 사생활 보호 모드일 수 있습니다. ' +
        '<b>지금 화면의 기록은 새로고침하면 사라집니다.</b></span>' +
        '<span class="sb-acts"><button class="btn sm" data-sync="export">지금 백업</button></span></div>';
      return;
    }
    var sy = SY && SY();
    if (sy) {
      var st = sy.state();
      if (st.pending && !navigator.onLine) {
        el.innerHTML = '<div class="sysbar wait"><span class="sb-dot"></span>' +
          '<span class="sb-msg">저장됨 · 동기화 대기 중 — 연결되면 자동으로 올라갑니다.</span></div>';
        return;
      }
    }
    el.innerHTML = '';
  }
  window.LUANLU_SYSBAR = renderSysbar;

  /* ══════════════ 뷰: 마이러닝 ══════════════ */
  function viewMy() {
    var vault =
      acc('深', '심화 트랙', '졸업 이후 · 순서 없이 관심 가는 것부터',
        C.extra.map(function (e) {
          var m = D.modules[e.mod], l = D.lectures[e.lec];
          return acc('·', esc(m.title), esc(e.why),
            modFull(e.mod) + (l ? '<div class="section"><h4>대표 강의</h4><div class="lecgroup">' + lectureRow(l, 0) + '</div></div>' : ''));
        }).join('')) +
      acc('💿', '시대별 감상', '연습 전후 5분, 귀를 맞추는 시간',
        D.listening.map(function (e) {
          var tr = e.tracks.map(function (t) {
            return '<a class="track" href="' + D.yt(t.a + ' ' + t.w) + '" target="_blank" rel="noopener">' +
              '<span class="ti"><span class="ar">' + esc(t.a) + (t.p ? '<span class="pf">🎹</span>' : '') + '</span>' +
              '<span class="wk">' + esc(t.w) + '</span></span>' +
              '<span class="go">' + ytSvg + '<span>YT</span></span></a>';
          }).join('');
          var al = (e.albums || []).map(function (a) {
            return '<a class="track" href="' + D.yt(a.q) + '" target="_blank" rel="noopener">' +
              '<span class="ti"><span class="ar">' + esc(a.a) + '</span><span class="wk">' + esc(a.al) + '</span>' +
              '<span class="why">' + esc(a.why) + '</span></span>' +
              '<span class="go">' + ytSvg + '<span>YT</span></span></a>';
          }).join('');
          return acc('·', esc(e.en) + ' <span class="faint">· ' + esc(e.kr) + '</span>', esc(e.yr),
            tr + (al ? '<div class="miniban" style="margin-top:12px">필청 음반</div>' + al : ''));
        }).join('')) +
      acc('🎥', '강의 전체 · 24편', '스텝마다 1편은 이미 그 안에 있습니다',
        D.levels.map(function (lv) {
          var order = D.lectureOrder[lv.id] || [];
          return '<div class="miniban" style="margin-top:14px">' + esc(lv.title) + '</div><div class="lecgroup">' +
            order.map(function (lid, i) { return lectureRow(D.lectures[lid], i); }).join('') + '</div>';
        }).join('')) +
      acc('🎼', '스탠다드 25곡', '졸업 후 다음 곡 고르기',
        '<div class="stdlist">' + D.standards.map(function (x) {
          return '<div class="std"><div class="std-main"><div class="std-head">' +
            '<span class="std-t">' + esc(x.t) + '</span> <span class="std-c">' + esc(x.c) + '</span>' +
            (x.first ? ' <span class="pill solid">첫곡</span>' : '') + '</div>' +
            '<div class="std-meta"><span class="chip">' + esc(x.key) + '</span><span class="chip">' + esc(x.form) + '</span>' +
            '<span class="chip">' + esc(x.tech) + '</span></div>' +
            '<div class="std-note">' + esc(x.note) + '</div></div>' +
            '<a class="go" href="' + D.yt(x.q) + '" target="_blank" rel="noopener">' + ytSvg + '<span>YT</span></a></div>';
        }).join('') + '</div>');

    return '<section class="view view--my">' +
      blkToday() +
      blkStreak() +
      blkRevdeck(false) +
      '<div class="eyebrow">진행</div>' + blkProgress() +
      '<div class="eyebrow">최근 연습</div>' + blkRecent() +
      '<div class="eyebrow">자료실</div>' +
      '<p class="body">코스를 하다 더 알고 싶을 때만 펼치세요. 각 스텝에 필요한 부분은 이미 그 안에 있습니다.</p>' +
      vault +
      '<div class="eyebrow">저장 · 동기화</div>' + syncPanel() +
    '</section>';
  }

  function viewCourse() {
    var cur = currentStep();
    var done = courseDone(), total = C.steps.length;
    var pct = Math.round(done / total * 100);

    var body = C.phases.map(function (p) {
      var ss = C.stepsOf(p.id);
      var dn = ss.filter(function (s) { return stepDone(s.id); }).length;
      var rows = ss.map(function (s) {
        var isDoneS = stepDone(s.id), isCur = s.id === cur.id;
        var mark = isDoneS ? '✓' : (isCur ? '▶' : String(s.n));
        var g = gatesOf(s.id), part = g.filter(Boolean).length;
        var badge = isDoneS ? '<span class="tag">완료</span>'
          : (isCur ? '<span class="tag">지금 여기</span>'
          : (part ? '<span class="badge soft">' + part + '/' + s.gates.length + '</span>' : ''));
        var ph = stepPhase(s.id);
        var cls = isDoneS ? 'is-done' : (ph === 'prov' || ph === 'due' ? 'is-prov' : (isCur ? 'is-now' : 'is-future'));
        var gg = gatesOf(s.id), part = gg.filter(Boolean).length;
        var mini = (!isDoneS && part) ? '<div class="sc-mini"><i style="width:' +
          Math.round(part / s.gates.length * 100) + '%"></i></div>' : '';
        var pill = isDoneS ? '<span class="pill ok">✓ 확정</span>'
          : ph === 'due' ? '<span class="pill prov">◐ 확정 대기</span>'
          : ph === 'prov' ? '<span class="pill prov">◐ 예비 통과</span>'
          : (isCur ? '<span class="pill solid">지금 여기</span>' : (s.key ? '<span class="pill solid">★ 핵심</span>' : ''));
        var glyph = isDoneS ? '✓' : (ph === 'prov' || ph === 'due' ? '◐' : (isCur ? '▶' : String(s.n)));
        return '<div class="stepcard ' + cls + '" data-step="' + s.id + '">' +
          '<span class="sc-n">' + glyph + '</span>' +
          '<div class="sc-body"><div class="sc-title">' + esc(s.title) + ' ' + pill + '</div>' + mini +
            '<div class="sc-goal">' + esc(s.goal) + '</div>' +
            '<div class="sc-meta"><span class="chip time">⏱ ' + s.mins + '분</span>' +
              '<span class="chip">' + esc(s.days) + '</span>' +
              (s.song ? '<span class="chip song">' + esc(songTitle(s.song.dec)) + '</span>' : '') +
              (part && !isDoneS ? '<span class="chip">' + part + '/' + s.gates.length + ' 통과</span>' : '') +
            '</div></div>' +
          '<span class="sc-state">›</span></div>';
      }).join('');
      return '<div class="phase' + (p.key ? ' key' : '') + '">' +
        '<div class="phead"><span class="pnum">' + p.n + '</span>' +
          '<span class="pinfo"><span class="pname">' + esc(p.title) +
            (p.key ? '<span class="kx">핵심</span>' : '') + '</span>' +
            '<span class="pgoal">' + esc(p.goal) + '</span>' +
            '<span class="pmeta">' + esc(p.weeks) + ' · ' + dn + '/' + ss.length + ' 스텝 완료</span></span></div>' +
        '<div class="srows">' + rows + '</div></div>';
    }).join('');

    /* 이 코스가 오르는 사다리 — 8계단 압축 스트립 (각 계단 → 해당 스텝) */
    var ladderStrip = D.ladder.map(function (r, i) {
      var sid = C.stepForRung(i), st = sid && C.byId(sid);
      return '<div class="lstep' + (r.key ? ' key' : '') + (st ? '' : ' nostep') + '"' +
        (st ? ' data-step="' + st.id + '"' : '') + '>' +
        '<span class="ln">' + r.n + '</span>' +
        '<span class="lt"><b>' + esc(r.name) + (r.key ? ' ★' : '') + '</b>' +
          '<span class="ld">' + esc(r.tagline) + '</span>' +
          (st ? '<span class="lgo">STEP ' + st.n + '</span>' : '<span class="lgo faint">방향 확인용</span>') +
        '</span></div>';
    }).join('<span class="larrow">→</span>');

    /* 예비 점검 — 모듈 전문을 그 자리에 접이식으로 */
    var pre = C.prereq.map(function (p) {
      var m = D.modules[p.mod];
      return acc('基', esc(m.title), esc(p.why), modFull(p.mod));
    }).join('');

    /* 심화 트랙 — 모듈 전문 + 강의 */
    var extra = C.extra.map(function (e) {
      var m = D.modules[e.mod], l = D.lectures[e.lec];
      return acc('深', esc(m.title), esc(e.why),
        modFull(e.mod) + (l ? '<div class="section"><h4>대표 강의</h4><div class="lecgroup">' + lectureRow(l, 0) + '</div></div>' : ''));
    }).join('');

    /* 다음 곡 사이클 + 스탠다드 25곡 */
    var nc = C.nextCycle;
    var cycleHtml = '<div class="steps">' + nc.cycle.map(function (c) {
      var st = C.byId(c.s);
      return '<div class="s"><b data-step="' + c.s + '" class="brasstext" style="cursor:pointer">STEP ' + st.n + '</b> ' +
        '<span class="sd">' + esc(c.d) + '</span></div>';
    }).join('') + '</div>';
    var stdHtml = '<p class="body">' + nc.pickNote + '</p><div class="stdlist">' + D.standards.map(function (s) {
      return '<div class="std"><div class="std-main">' +
        '<div class="std-head"><span class="std-t">' + esc(s.t) + '</span> <span class="std-c">' + esc(s.c) + '</span>' +
          (s.first ? ' <span class="tag">첫곡</span>' : '') +
          (s.dec ? ' <span class="badge soft">코스에 분해 있음</span>' : '') + '</div>' +
        '<div class="std-meta"><span class="chip">' + esc(s.key) + '</span><span class="chip">' + esc(s.form) + '</span>' +
          '<span class="chip">Lv.' + esc(s.lvl) + '</span><span class="chip">' + esc(s.tech) + '</span></div>' +
        '<div class="std-note">' + esc(s.note) + ' · 필청: ' + esc(s.rec) + '</div></div>' +
        '<a class="go" href="' + D.yt(s.q) + '" target="_blank" rel="noopener">' + ytSvg + '<span>YT</span></a></div>';
    }).join('') + '</div>';

    /* 시대별 감상 전체 — 스텝에서 하루 1곡씩 나눠 듣지만, 통째로도 볼 수 있게 */
    var eras = D.listening.map(function (e) {
      var tracks = e.tracks.map(function (t) {
        return '<a class="track" href="' + D.yt(t.a + ' ' + t.w) + '" target="_blank" rel="noopener">' +
          '<span class="ti"><span class="ar">' + esc(t.a) + (t.p ? '<span class="pf">🎹</span>' : '') + '</span>' +
          '<span class="wk">' + esc(t.w) + '</span></span>' +
          '<span class="go">' + ytSvg + '<span>YT</span></span></a>';
      }).join('');
      var albums = (e.albums || []).map(function (al) {
        return '<a class="track" href="' + D.yt(al.q) + '" target="_blank" rel="noopener">' +
          '<span class="ti"><span class="ar">' + esc(al.a) + '</span><span class="wk">' + esc(al.al) + '</span>' +
          '<span class="why">' + esc(al.why) + '</span></span>' +
          '<span class="go">' + ytSvg + '<span>YT</span></span></a>';
      }).join('');
      var figs = '<div class="figrow">' + e.figures.map(function (f) { return '<span class="fig">' + esc(f) + '</span>'; }).join('') + '</div>';
      var lv = (e.lv || []).map(function (mid) {
        var sids = C.stepsForMod(mid);
        return sids.length
          ? '<a class="btn sm" data-step="' + sids[0] + '">STEP ' + C.byId(sids[0]).n + ' · ' + esc(D.modules[mid].title) + '</a>'
          : '<span class="chip">' + esc(D.modules[mid].title) + ' (심화)</span>';
      }).join('');
      return acc('💿', esc(e.en) + ' <span class="faint">· ' + esc(e.kr) + '</span>', esc(e.yr) + ' — ' + esc(e.desc),
        figs + '<div class="miniban" style="margin-top:12px">대표 곡</div>' + tracks +
        (albums ? '<div class="miniban" style="margin-top:12px">필청 음반</div>' + albums : '') +
        '<div class="callout play" style="margin-top:12px"><span class="lab">치려면</span>' + esc(e.play) +
        '<div class="cta-row" style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap">' + lv + '</div></div>');
    }).join('');

    /* 강의 전체 목록 + 채널 지형도 */
    var chans = D.channels.map(function (c) {
      return '<div class="chan"><b>' + esc(c.n) + '</b> <span class="who">· ' + esc(c.who) + '</span>' +
        '<span class="cd">' + esc(c.d) + '</span></div>';
    }).join('');
    var allLecs = D.levels.map(function (lv) {
      var order = D.lectureOrder[lv.id] || [];
      return '<div class="miniban" style="margin-top:14px">' + esc(lv.title) + '</div><div class="lecgroup">' +
        order.map(function (lid, i) { return lectureRow(D.lectures[lid], i); }).join('') + '</div>';
    }).join('');

    return '<section class="view">' +
      '<div class="eyebrow first">연습 코스</div>' +
      '<h2>21개의 연습 단위 — 위에서 아래로만 가면 됩니다</h2>' +
      '<p class="body">각 스텝은 <b>하루치 연습 하나</b>입니다. 원리 · 이론 · 곡 분해 · 강의 · 감상이 <b>스텝 한 장 안에</b> 들어 있고, ' +
      '통과 기준을 다 체크하면 다음 스텝으로 넘어갑니다. <b>하루 15~40분</b> · 스텝당 며칠~2주 · 전체 약 4~6개월.</p>' +

      '<div class="progbar-wrap"><div class="progbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="progstat">' + done + ' / ' + total + ' 스텝 완료 · ' + pct + '%</div></div>' +

      '<div class="callout tip"><span class="lab">지금 여기</span>' +
      '<a class="brasstext" data-step="' + cur.id + '">STEP ' + cur.n + ' · ' + esc(cur.title) + '</a> — ' + esc(cur.goal) + '</div>' +

      '<div class="eyebrow">이 코스가 오르는 사다리</div>' +
      '<p class="body">같은 ii–V–I(Dm7–G7–Cmaj7)이 8계단에 걸쳐 바뀝니다. 이게 코스 전체의 뼈대이고, ' +
      '아래 21스텝은 이 계단들을 <b>실제로 오르는 방법</b>입니다. 계단을 누르면 해당 스텝으로 갑니다.</p>' +
      '<div class="ladderstrip">' + ladderStrip + '</div>' +

      '<div class="eyebrow">21스텝</div>' +
      '<div class="courseflow">' + body + '</div>' +

      '<div class="eyebrow">코스 시작 전 · 흔들리면 여기부터</div>' +
      '<p class="body">7th 코드나 코드 심볼이 아직 불안하면 이 셋을 먼저. 이미 안다면 건너뛰어도 됩니다. (펼치면 전문이 나옵니다.)</p>' +
      pre +

      '<div class="eyebrow">졸업 이후 ① · 다음 곡으로 사이클 반복</div>' +
      '<p class="body">' + nc.intro + '</p>' + cycleHtml +
      acc('🎼', '흔히 연주되는 스탠다드 25곡', '리얼북에서 자주 콜되는 곡 — 다음 곡 고르기', stdHtml) +

      '<div class="eyebrow">졸업 이후 ② · 심화 트랙</div>' +
      '<p class="body">코스가 아니라 <b>취향</b>입니다. 관심 가는 것부터 순서 없이.</p>' + extra +

      '<div class="eyebrow">참고 ① · 시대별 감상 전체</div>' +
      '<p class="body">각 스텝의 「오늘 들을 것」이 여기서 하루 1곡씩 배분됩니다. 통째로 훑고 싶을 때만 펼치세요.</p>' + eras +

      '<div class="eyebrow">참고 ② · 강의 전체 목록</div>' +
      '<p class="body">스텝마다 필요한 1편은 이미 그 안에 있습니다. 이 목록은 더 파고들 때만.</p>' +
      acc('🎥', '채널 지형도 · 8개', '어느 채널이 어떤 성격인지', '<div class="chanlist">' + chans + '</div>') +
      acc('🎥', '레벨별 강의 24편', '커리큘럼 순서대로', allLecs) +
    '</section>';
  }

  /* ════════════════ 뷰: 스텝 (하루치 연습 단위) ════════════════ */
  function viewStep(id) {
    var s = C.byId(id);
    if (!s) return viewCourse();
    var p = C.phase(s.phase), total = C.steps.length;
    var prev = s.idx > 0 ? C.steps[s.idx - 1] : null;
    var next = s.idx < total - 1 ? C.steps[s.idx + 1] : null;
    var g = gatesOf(s.id), passed = stepDone(s.id);

    /* 1. 왜 지금 이걸 */
    var bridge = '<div class="callout play"><span class="lab">왜 지금 이걸</span>' + s.bridge + '</div>';

    /* 2. 타임박스 드릴 */
    var drills = '<div class="drills">' + s.drills.map(function (d, i) {
      return '<div class="drill"><span class="dm">' + d.m + '분</span>' +
        '<span class="dc"><b>' + esc(d.t) + '</b><span class="dd">' + d.d + '</span></span></div>';
    }).join('') + '</div>';

    /* 3. 손 모양
       곡이 붙은 스텝은 그 곡의 실제 코드로 그린다(voicing.js). 예전에는 조와 무관하게
       사다리 rung(C장조 고정)을 재사용해서, Autumn Leaves 스텝에 C장조 건반이 나왔다. */
    var kbd = '', kbdCap = '';
    var mod = s.mod ? D.modules[s.mod] : null;
    var vc = s.voice && s.song ? songVoicing(s) : null;

    if (vc && vc.chords.length) {
      kbd = chordGroup(vc.chords, vc.cap, { shared: { lo: vc.lo, hi: vc.hi } });
    } else if (s.kbdFrom === 'mod' && mod && mod.example) {
      kbd = chordGroup(mod.example.chords, mod.example.cap);
    } else if (s.rung != null && D.ladder[s.rung]) {
      var r = D.ladder[s.rung];
      kbd = r.rhythm ? rhythmStrip()
          : chordGroup(r.chords, '전환의 사다리 rung ' + r.n + ' · ' + esc(r.tagline), { shared: { lo: r.lo, hi: r.hi } });
    } else if (mod && mod.example) {
      kbd = chordGroup(mod.example.chords, mod.example.cap);
    }
    var kbdSec = kbd ? '<div class="section"><h4>손 모양</h4>' + kbd + '</div>' : '';

    /* 4. 곡에 적용 */
    var songSec = '';
    if (s.song) {
      songSec = '<div class="section"><h4>곡의 어느 구간을</h4>' +
        '<div class="songbox">' +
          '<div class="sbhead"><span class="sbt">' + esc(songTitle(s.song.dec)) + '</span>' +
            '<span class="sbk">' + esc(songKey(s.song.dec)) + '</span></div>' +
          '<div class="sbwhere"><span class="lab">구간</span>' + esc(s.song.where) + '</div>' +
          '<div class="sbdo"><span class="lab">할 일</span>' + s.song.do + '</div>' +
        '</div></div>';
    }

    /* 5. 강의 딱 한 편 */
    var lecSec = '';
    if (s.lec && D.lectures[s.lec]) {
      lecSec = '<div class="section"><h4>강의는 이 한 편만</h4>' +
        '<div class="lecgroup">' + lectureRow(D.lectures[s.lec], 0) + '</div>' +
        '<div class="kbd-cap" style="margin-top:6px">여러 편 보지 마세요. 이 스텝에 필요한 건 이 영상 하나입니다.</div></div>';
    }

    /* 5-b. 오늘 들을 것 (감상) */
    var listenSec = listenPick(s);

    /* 5-c. 더 깊게 — 자료실을 이 자리에 접이식으로 인라인 (기본은 접힘) */
    var deepParts = [];
    if (mod) deepParts.push(acc('📚', '이론 전문 · ' + esc(mod.title), esc(mod.sub), modFull(s.mod)));
    if (s.rung != null && D.ladder[s.rung]) {
      var rr = D.ladder[s.rung];
      deepParts.push(acc('📐', '사다리 rung ' + rr.n + ' 전문 · ' + esc(rr.name), esc(rr.tagline), rungFull(s.rung)));
    }
    if (s.song) {
      deepParts.push(acc('🎼', '곡 전문 · ' + esc(songTitle(s.song.dec)),
        '폼 · 화성 분석 · 왼손 · 오른손 · 즉흥 · 추천 연주 · 전체 플랜', songFull(s.song.dec)));
    }
    if (s.more && s.more.length) {
      deepParts.push(acc('🎥', '더 볼 강의 · ' + s.more.length + '편', '오늘은 안 봐도 됩니다',
        '<div class="lecgroup">' + s.more.map(function (l, i) { return lectureRow(D.lectures[l], i); }).join('') + '</div>'));
    }
    var deepSec = deepParts.length
      ? '<div class="section"><h4>더 깊게 <span class="faint" style="letter-spacing:0;text-transform:none">— 오늘 안 열어도 됩니다</span></h4>' +
        '<div class="kbd-cap" style="margin-bottom:9px">위 연습이 다 됐는데 더 알고 싶을 때만 펼치세요. 막히지 않았다면 그냥 지나가는 게 맞습니다.</div>' +
        deepParts.join('') + '</div>'
      : '';

    /* 6. 막히면 */
    var stuck = '';
    var qa = (s.stuck || []).map(function (x) {
      return '<div class="qa"><div class="q">' + esc(x.q) + '</div><div class="a">' + x.a + '</div></div>';
    }).join('');
    var mis = (mod && mod.mistakes && mod.mistakes.length)
      ? '<div class="callout warn" style="margin-top:10px"><span class="lab">흔한 실수</span>' + mod.mistakes.map(esc).join('<br>') + '</div>' : '';
    if (qa || mis) stuck = '<div class="section"><h4>막히면</h4>' + qa + mis + '</div>';

    /* 7. 통과 기준 — 2단 (예비 → 확정) */
    var phase = stepPhase(s.id);
    var gateRows = s.gates.map(function (t, i) {
      return '<div class="check' + (g[i] ? ' done' : '') + '" data-gate="' + s.id + ':' + i + '">' +
        '<span class="box">✓</span><span class="cx">' + esc(t) + '</span></div>';
    }).join('');
    var meta = gateMeta(s.id);
    var tier1 = '<div class="gt-tier gt-prov">' +
      '<div class="gt-head"><span class="gt-num">1</span>오늘 확인 — 예비 통과</div>' +
      '<div class="gt-sub">조건·수행·판정이 적힌 대로. 오늘 다 되면 예비 통과입니다.</div>' +
      gateRows +
      (phase !== 'open'
        ? '<div class="provbanner">◐ <b>예비 통과</b> — 확정은 내일입니다. 내일 <b>워밍업 없이 첫 시도</b>로 아래 대표 항목을 다시 통과하면 확정됩니다. 어제의 성공은 위조할 수 없습니다.</div>'
        : '<div class="kbd-cap" style="margin-top:9px">며칠 걸려도 정상입니다 (' + esc(s.days) + ').</div>') +
      '</div>';

    var t2cls = phase === 'due' ? '' : (phase === 'confirmed' ? '' : ' is-locked');
    var tier2 = '<div class="gt-tier gt-conf' + t2cls + '">' +
      '<div class="gt-head"><span class="gt-num">2</span>내일 확정 — 워밍업 없이 첫 시도' +
        (phase === 'prov' ? '<span class="lockchip">내일 열림 · ' + shiftDay(todayStr(), 1) + '</span>' : '') +
      '</div>' +
      '<div class="gt-sub">피아노에 앉아 <b>가장 먼저</b> 이것부터. 되면 확정, 안 되면 하루 더.</div>' +
      (phase === 'confirmed'
        ? '<div class="passed">✓ <b>확정 통과</b>' + (next ? ' — 다음은 STEP ' + next.n + ' · ' + esc(next.title) : ' — 코스 완주!') + '</div>'
        : '<div class="check big' + (phase === 'confirmed' ? ' done' : '') + '" data-conf="' + s.id + '">' +
          '<span class="box">✓</span><span class="cx">' + esc(s.gates[0]) + ' — <b>첫 시도로</b></span></div>' +
          (phase === 'due' ? '<div class="cta-row" style="margin-top:10px"><a class="btn sm warn" data-retry="' + s.id + '">안 됐다 — 하루 더</a></div>' : '')) +
      '</div>';

    var gateSec = '<div class="section"><h4>통과 기준 — 이게 되면 다음</h4>' +
      '<div class="gatebox">' + tier1 + tier2 + '</div></div>';

    /* 7-b. 이 소리가 나면 틀린 것 — 접히지 않는다 */
    var earSec = '';
    if (s.ear && s.ear.length) {
      earSec = '<div class="errbox"><div class="eb-head">👂 이 소리가 나면 틀린 것</div>' +
        s.ear.map(function (e) {
          return '<div class="ebrow"><span class="eb-x">✗</span><div>' +
            '<div class="eb-bad">' + esc(e.bad) + '</div>' +
            '<div class="eb-why">' + e.why + '</div>' +
            '<div class="eb-fix"><span class="eb-tag">고치기</span>' + e.fix + '</div>' +
          '</div></div>';
        }).join('') + '</div>';
    }

    /* 8. 기록 */
    var deeper = '<div class="cta-row" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<a class="btn solid" data-diarystep="' + s.id + '">📔 이 스텝으로 연습일지 쓰기</a></div>';

    var nav = '<div class="modnav">' +
      (prev ? '<a class="btn sm" data-step="' + prev.id + '">← STEP ' + prev.n + '</a>' : '<span></span>') +
      (next ? '<a class="btn sm" data-step="' + next.id + '">STEP ' + next.n + ' · ' + esc(next.title) + ' →</a>' : '<span></span>') +
    '</div>';

    var totalMin = s.drills.reduce(function (a, d) { return a + d.m; }, 0);

    return '<section class="view view--step">' +
      backTo('course', '코스 지도') +
      '<div class="stephead' + (s.key ? ' key' : '') + '">' +
        '<div class="shmeta"><span class="shphase">' + esc(p.n + ' · ' + p.title) + '</span>' +
          '<span class="shn">STEP ' + s.n + ' / ' + total + '</span>' +
          (passed ? '<span class="tag">완료</span>' : '') + '</div>' +
        '<h2>' + esc(s.title) + '</h2>' +
        '<div class="shgoal">' + esc(s.goal) + '</div>' +
        '<div class="shchips"><span class="chip">하루 ' + s.mins + '분</span><span class="chip">' + esc(s.days) + '</span>' +
          (s.song ? '<span class="chip">' + esc(songTitle(s.song.dec)) + '</span>' : '') + '</div>' +
      '</div>' +
      bridge +
      (s.note ? '<div class="callout tip"><span class="lab">참고</span>' + s.note + '</div>' : '') +
      blkRevdeck(true) +
      '<div class="section"><h4>오늘 이렇게 연습하세요 · 총 ' + totalMin + '분</h4>' + drills + '</div>' +
      kbdSec + earSec + songSec + lecSec + listenSec + stuck + gateSec + deeper + deepSec + nav +
      '<div class="stepbar">' +
        '<a class="btn" href="#course/' + s.id + '" data-scrollgate="1">통과 기준으로 ↓</a>' +
        '<a class="btn solid" data-diarystep="' + s.id + '">📔 일지</a>' +
      '</div>' +
    '</section>';
  }

  /* ════════════════ 뷰: 이용안내 ════════════════ */
  function viewGuide() {
    var quick = [
      { t: '마이러닝을 연다', d: '맨 위 카드에 오늘 할 스텝이 이미 정해져 있습니다. 고를 게 없습니다.' },
      { t: '그 스텝 한 장만 본다', d: '왜 지금 이걸 → 분 단위 드릴 → 손 모양 → 곡의 어느 구간 → 강의 1편 → 오늘 들을 것. 위에서 아래로만.' },
      { t: '피아노 앞에서 그대로 실행', d: '드릴에 적힌 시간(3분·7분·5분…)을 지키세요. 하루 15~30분이면 충분합니다.' },
      { t: '통과 기준 3개를 체크', d: '다 되면 다음 스텝이 자동으로 열립니다. 며칠~2주 걸리는 게 정상입니다.' },
      { t: '「이 스텝으로 연습일지 쓰기」', d: '드릴이 항목으로 자동 입력됩니다. 막힌 곳을 적어 복사 → 채팅에 붙여넣으면 검수해 드립니다.' }
    ];
    var quickHtml = '<div class="steps">' + quick.map(function (s) {
      return '<div class="s"><b>' + esc(s.t) + '</b> <span class="sd">' + esc(s.d) + '</span></div>';
    }).join('') + '</div>';

    var menus = [
      { ic: '🎯', route: 'my', t: '마이러닝 ★', what: '<b>매일 여는 화면.</b> 오늘 할 것 · 연속 기록 · 복습 · 진행 · 자료실.', how: '맨 위 카드 하나만 누르면 됩니다. 나머지는 내려가며 보면 되는 것들입니다.', main: true },
      { ic: '🗺', route: 'course', t: '코스 지도', what: '21스텝 전체 조망 + 전환의 사다리 8계단.', how: '고르는 곳이 아니라 <b>어디까지 왔는지 보는 곳</b>입니다.' },
      { ic: '📔', route: 'diary', t: '연습일지', what: '날짜별 기록 · 체크리스트 · 메모.', how: '스텝 하단 「이 스텝으로 연습일지 쓰기」 → 「선생님 검수용 복사」 → 채팅에 붙여넣기.' },
      { ic: '📖', route: 'guide', t: '이용안내', what: '지금 이 페이지.', how: '처음 한 번만 읽으면 됩니다.' }
    ];
    var menuHtml = menus.map(function (m) {
      return '<div class="pnode' + (m.main ? ' here' : '') + '" data-go="' + m.route + '"><span class="pi">' + m.ic + '</span>' +
        '<span class="pt"><h3>' + m.t + '</h3><span class="pd"><b style="color:var(--ink)">' + m.what + '</b><br>' + m.how + '</span></span>' +
        '<span class="parrow">›</span></div>';
    }).join('');

    var legend = '<div class="callout"><span class="lab" style="color:var(--brass)">화면 기호</span>' +
      '<div style="margin-top:8px">' + MUSIC.legend() + '</div>' +
      '<div style="margin-top:10px;font-size:13px;line-height:1.9">' +
      '건반의 <b style="color:#A9C6DA">파란 건반</b> = 왼손(화성·컴핑), <b style="color:#E3B589">주황 건반</b> = 오른손(멜로디·라인). 건반 위 글자는 음이름 또는 도수(R·♭3·♭7·9…).<br>' +
      '<span class="badge">핵심</span> 꼭 짚고 갈 모듈 · <span class="mono">✓ / ○</span> 완료 여부 · <span class="mono">YT</span> 유튜브 검색으로 새 탭 열림' +
      '</div></div>';

    var routine = '<div class="steps">' +
      '<div class="s"><b>매일</b> <span class="sd">지금 스텝 하나. 드릴에 적힌 시간(15~30분)만 지키면 됩니다. 새 스텝을 서둘러 열지 마세요.</span></div>' +
      '<div class="s"><b>연습 직후</b> <span class="sd">「이 스텝으로 연습일지 쓰기」 — 안 된 항목과 막힌 곳을 한 줄이라도.</span></div>' +
      '<div class="s"><b>연습 전후 5분</b> <span class="sd">스텝의 「오늘 들을 것」 1곡 — 손이 아니라 귀를 그 스텝에 맞추는 시간.</span></div>' +
      '<div class="s"><b>주 1회</b> <span class="sd">통과 기준을 점검하고, 일지를 복사해 채팅에 붙여넣어 검수받기.</span></div>' +
      '</div>';

    var faq = '<div class="qa"><div class="q">스텝을 언제 넘어가나요?</div>' +
      '<div class="a">각 스텝 하단의 <b>통과 기준 3개</b>가 모두 체크될 때. 날짜가 아니라 <b>기준</b>으로 넘어갑니다. 한 스텝에 2주가 걸려도 정상입니다.</div></div>' +
      '<div class="qa"><div class="q">뒤 스텝이 궁금해서 먼저 봐도 되나요?</div>' +
      '<div class="a">봐도 됩니다(잠겨 있지 않습니다). 다만 <b>연습은 순서대로</b> 하세요 — 각 스텝은 앞 스텝의 결과를 재료로 씁니다.</div></div>' +
      '<div class="qa"><div class="q">중간에 막혀서 되돌아가도 되나요?</div>' +
      '<div class="a">권장합니다. 예를 들어 STEP 13에서 왼손이 멈추면 STEP 08로 3일 돌아가세요. 후퇴가 아니라 정상 경로입니다.</div></div>' +
      '<div class="qa"><div class="q">전환의 사다리·테크닉 이론·곡 전체 분해는 어디 갔나요?</div>' +
      '<div class="a">별도 메뉴를 없애고 <b>각 스텝 맨 아래 「더 깊게」</b> 안에 접어 넣었습니다. 그 스텝에 해당하는 rung 전문 · 이론 전문 · 곡 7단계 분해가 그 자리에 그대로 있습니다. ' +
      '전체를 통으로 보려면 <b>연습 코스</b> 페이지 하단(심화 트랙 · 시대별 감상 · 강의 전체 · 스탠다드 25곡).</div></div>' +
      '<div class="qa"><div class="q">「더 깊게」는 매번 열어야 하나요?</div>' +
      '<div class="a">아니요. <b>기본은 접혀 있고, 안 열어도 연습이 됩니다.</b> 위쪽 드릴만으로 막히지 않으면 그냥 지나가는 게 맞습니다.</div></div>';

    return '<section class="view">' +
      '<div class="eyebrow first">이용 안내</div>' +
      '<h2>루앤루, 이렇게 쓰세요</h2>' +
      '<p class="body">코드는 아는데 재즈로 못 치는 분을 위한 서비스입니다. ' +
      '<b>매일 할 일은 하나뿐입니다 — 지금 스텝을 열고, 적힌 대로 연습하고, 통과 기준을 체크한다.</b> ' +
      '이론·곡 분해·강의·감상은 따로 찾아다닐 필요 없이 <b>그 스텝 안에</b> 다 들어 있습니다.</p>' +
      '<div class="eyebrow">하루 사용법 · 5단계</div>' + quickHtml +
      '<div class="callout tip"><span class="lab">한 줄 요약</span>' +
      '<b>마이러닝 → 오늘 카드 → 그 한 장대로 연습 → 통과 기준 체크 → 일지.</b> 이 다섯 개 말고는 아무것도 안 해도 됩니다.</div>' +
      '<div class="eyebrow">메뉴 4개가 전부입니다</div>' +
      '<p class="body">카드를 누르면 해당 화면으로 바로 이동합니다.</p>' +
      '<div class="pathmap">' + menuHtml + '</div>' +
      '<div class="eyebrow">화면 기호 읽는 법</div>' + legend +
      '<div class="eyebrow">추천 루틴</div>' + routine +
      '<div class="eyebrow">자주 막히는 질문</div>' + faq +
      '<div class="callout tip" style="margin-top:16px"><span class="lab">팁</span>콘텐츠를 수정했는데 화면이 안 바뀌면 브라우저를 <b>하드 새로고침</b>(Ctrl+Shift+R)하세요. 진도·일지는 이 브라우저에 저장됩니다.</div>' +
      '<div class="cta-row" style="margin-top:18px;display:flex;gap:9px;flex-wrap:wrap"><a class="btn solid" data-go="my">마이러닝으로 →</a><a class="btn" data-go="course">코스 지도</a></div>' +
    '</section>';
  }

  /* ════════════════ 강의 행 렌더러 (스텝·코스에서 공용) ════════════════ */
  /* ════════════════ 뷰: 강의 큐레이션 ════════════════ */
  function lectureRow(l, i) {
    if (!l) return '';
    return '<a class="lecture" href="' + l.url + '" target="_blank" rel="noopener">' +
      '<span class="idx">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="lc"><span class="who">' + esc(l.who) + '</span>' +
      '<span class="top">' + esc(l.topic) + '</span><span class="lw">' + esc(l.w) + '</span></span>' +
      '<span class="go">' + ytSvg + '<span>YT</span></span></a>';
  }


  /* ════════════════ 동기화 패널 (나의 진도 안) ════════════════ */
  function syncPanel() {
    var S = SY();
    var sum = S ? S.summary() : null;
    var st = S ? S.state() : { configured: false, status: 'off' };

    var counts = sum
      ? '<div class="syncnums"><span><b>' + sum.gates + '</b> 통과 기준</span>' +
        '<span><b>' + sum.modules + '</b> 모듈</span>' +
        '<span><b>' + sum.diary + '</b> 일지</span></div>'
      : '';

    var backup = '<div class="cta-row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn sm" data-sync="export">⬇ 진도 내보내기 (.json)</button>' +
      '<label class="btn sm" style="cursor:pointer;margin:0">⬆ 가져오기<input type="file" accept=".json,application/json" id="sync-file" style="display:none"></label>' +
      '</div>';

    var body;
    if (!st.configured) {
      body = '<div class="kbd-cap">이 브라우저에만 저장됩니다. 다른 기기와 이어지지 않습니다 — ' +
        '아래 <b>내보내기 / 가져오기</b>로 옮기거나, 설정을 넣으면 자동 동기화가 켜집니다.</div>' + backup;
    } else if (st.status === 'signedout') {
      body = '<div class="kbd-cap">로그인하면 이 기기의 진도가 다른 기기와 자동으로 합쳐집니다.</div>' +
        '<div class="dform-3" style="margin-top:10px;grid-template-columns:1fr 1fr auto">' +
          '<div><label class="fld">이메일</label><input type="email" id="sync-email" autocomplete="username"></div>' +
          '<div><label class="fld">비밀번호</label><input type="password" id="sync-pw" autocomplete="current-password"></div>' +
          '<div style="display:flex;align-items:flex-end"><button class="btn solid" data-sync="signin">로그인</button></div>' +
        '</div>' +
        (st.error ? '<div class="syncerr">' + esc(st.error) + '</div>' : '') + backup;
    } else {
      var label = st.status === 'syncing' ? '동기화 중…'
                : st.status === 'error' ? '동기화 실패'
                : st.pending ? '변경사항 저장 대기 중…' : '동기화됨';
      var when = st.lastSync ? new Date(st.lastSync).toLocaleString('ko-KR') : '아직 없음';
      body = '<div class="syncstat ' + st.status + '"><span class="dot"></span>' + esc(label) +
        '<span class="who">' + esc(st.email || '') + '</span></div>' +
        '<div class="kbd-cap" style="margin-top:8px">마지막 동기화 · ' + esc(when) + '</div>' +
        (st.error ? '<div class="syncerr">' + esc(st.error) + '</div>' : '') +
        '<div class="cta-row" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn sm" data-sync="now">지금 동기화</button>' +
          '<button class="btn sm" data-sync="signout">로그아웃</button>' +
        '</div>' + backup;
    }

    return '<div class="eyebrow">기기 간 동기화</div>' +
      '<div class="card pad">' + counts + body + '</div>';
  }

  /* ════════════════ 뷰: 나의 진도 ════════════════ */
  function viewProgress() {
    var total = allModuleIds().length, done = doneCount();
    var pct = total ? Math.round(done / total * 100) : 0;
    var checks = D.levels.map(function (lv) {
      var rows = lv.modules.map(function (mid) {
        var m = D.modules[mid], dn = isDone(mid);
        var sids = C.stepsForMod(mid);
        var where = sids.length
          ? sids.map(function (x) { return 'STEP ' + C.byId(x).n; }).join('·')
          : '심화';
        return '<div class="check' + (dn ? ' done' : '') + '" data-toggle="' + mid + '">' +
          '<span class="box">✓</span><span class="cx"><span class="cl">' + lv.id.toUpperCase() + ' · ' + esc(lv.title) +
          ' · ' + where + '</span><br>' + esc(m.title) + '</span></div>';
      }).join('');
      return '<div class="eyebrow">' + esc(lv.title) + '</div>' + rows;
    }).join('');

    /* 코스 진행 — 이게 실제 진도다 */
    var cdone = courseDone(), ctotal = C.steps.length;
    var cpct = Math.round(cdone / ctotal * 100);
    var cur = currentStep();
    var phaseRows = C.phases.map(function (p) {
      var ss = C.stepsOf(p.id);
      var dn = ss.filter(function (s) { return stepDone(s.id); }).length;
      var w = Math.round(dn / ss.length * 100);
      return '<div class="prow" data-go="course"><span class="pw">' + esc(p.title) + '</span>' +
        '<span class="pbar"><i style="width:' + w + '%"></i></span>' +
        '<span class="pct">' + dn + '/' + ss.length + '</span></div>';
    }).join('');

    return '<section class="view">' +
      '<div class="eyebrow first">나의 진도</div>' +
      '<h2>지금 어디쯤 왔나</h2>' +

      '<div class="progbar-wrap"><div class="progbar"><i style="width:' + cpct + '%"></i></div>' +
      '<div class="progstat">연습 코스 ' + cdone + ' / ' + ctotal + ' 스텝 완료 · ' + cpct + '%</div></div>' +
      '<div class="phaserows">' + phaseRows + '</div>' +
      '<div class="callout tip"><span class="lab">다음 할 것</span>' +
      '<a class="brasstext" data-step="' + cur.id + '">STEP ' + cur.n + ' · ' + esc(cur.title) + '</a> — ' + esc(cur.goal) + '</div>' +

      '<div class="eyebrow">이론 모듈 체크리스트 <span style="color:var(--ink-faint)">· 보조</span></div>' +
      '<p class="body">스텝을 통과하면 연결된 모듈이 자동으로 체크됩니다. 각 줄의 <b>STEP 번호</b>가 그 이론을 다루는 스텝입니다 ' +
      '(전문은 그 스텝의 「더 깊게」 안에). 「심화」는 졸업 후 트랙이라 직접 체크하세요. ' +
      '(' + done + ' / ' + total + ' 모듈 · ' + pct + '%)</p>' +
      checks +
      syncPanel() +
      '<div class="callout tip" style="margin-top:18px"><span class="lab">최종 목표</span>' +
      '<b><a class="brasstext" data-step="s21">STEP 21</a></b> — Autumn Leaves를 인트로–테마–솔로–엔딩까지 혼자 완주하기.</div>' +
    '</section>';
  }

  /* ════════════════ 뷰: 연습일지 ════════════════ */
  function viewDiary(stepId) {
    var entries = getDiary();
    var editing = diaryEditId ? entries.filter(function (e) { return e.id === diaryEditId; })[0] : null;
    var ed = editing || { date: todayStr(), focus: '', minutes: '', tempo: '', tasks: [], notes: '' };

    /* 스텝에서 넘어온 경우 — 그날의 드릴을 그대로 연습 항목으로 채워준다 */
    var fromStep = null;
    if (!editing && stepId && C.byId(stepId)) {
      fromStep = C.byId(stepId);
      ed = {
        date: todayStr(),
        focus: 'STEP ' + fromStep.n + ' · ' + fromStep.title,
        minutes: String(fromStep.mins), tempo: '',
        tasks: fromStep.drills.slice(0, 5).map(function (d) { return { text: d.m + '분 · ' + d.t, done: false }; }),
        notes: ''
      };
    }

    var taskRows = '';
    for (var i = 0; i < 5; i++) {
      var t = ed.tasks[i] || { text: '', done: false };
      taskRows += '<div class="dtask-row"><input type="checkbox" id="diary-c' + i + '"' + (t.done ? ' checked' : '') + '>' +
        '<input type="text" id="diary-t' + i + '" placeholder="연습 항목 ' + (i + 1) + '" value="' + escAttr(t.text) + '"></div>';
    }
    /* 초점 칩 = 현재 스텝 주변 5개 (지금 하는 연습이 바로 후보로 뜨게) */
    var cs = fromStep || currentStep();
    var from = Math.max(0, Math.min(cs.idx - 1, C.steps.length - 5));
    var chips = C.steps.slice(from, from + 5).map(function (s) {
      var c = 'STEP ' + s.n + ' · ' + s.title;
      return '<span class="fchip' + (s.id === cs.id ? ' on' : '') + '" data-focus="' + escAttr(c) + '">' + esc(c) + '</span>';
    }).join('');

    var form = '<div class="card pad diary-form">' +
      '<div class="miniban">' + (editing ? '기록 편집' : '새 연습 기록') + '</div>' +
      '<div class="dform-3" style="margin-top:10px">' +
        '<div><label class="fld">날짜</label><input type="date" id="diary-date" value="' + escAttr(ed.date) + '"></div>' +
        '<div><label class="fld">연습시간(분)</label><input type="number" id="diary-min" min="0" value="' + escAttr(ed.minutes) + '" placeholder="30"></div>' +
        '<div><label class="fld">템포(bpm)</label><input type="number" id="diary-tempo" min="0" value="' + escAttr(ed.tempo) + '" placeholder="90"></div>' +
      '</div>' +
      '<div style="margin-top:12px"><label class="fld">오늘의 초점</label><input type="text" id="diary-focus" value="' + escAttr(ed.focus) + '" placeholder="예: 셸 보이싱 · Fly Me to the Moon (C)"></div>' +
      '<div class="focuschips">' + chips + '</div>' +
      '<div style="margin-top:12px"><label class="fld">연습 항목 (체크 = 완료)</label>' + taskRows + '</div>' +
      '<div style="margin-top:12px"><label class="fld">메모 · 느낀 점 / 막힌 곳 / 질문</label><textarea id="diary-notes" placeholder="예: G7에서 셸이 흔들림. 3도(B) 위치가 헷갈림. 스윙 8분음표가 아직 어색.">' + esc(ed.notes || '') + '</textarea></div>' +
      '<div class="cta-row" style="margin-top:14px">' +
        '<button class="btn solid" data-diary="save">' + (editing ? '수정 저장' : '기록 저장') + '</button>' +
        (editing ? '<button class="btn" data-diary="cancel">취소</button>' : '') +
      '</div>' +
    '</div>';

    var list;
    if (!entries.length) {
      list = '<div class="callout">아직 기록이 없습니다. 위에서 오늘 연습을 기록하고, 끝나면 <b>「선생님 검수용 복사」</b>로 복사해 채팅에 붙여넣으세요 — 재즈 교수처럼 검수해 드립니다.</div>';
    } else {
      list = entries.map(function (e) {
        var done = (e.tasks || []).filter(function (x) { return x.done; }).length;
        var tasks = (e.tasks || []).map(function (x, idx) {
          return '<div class="check' + (x.done ? ' done' : '') + '" data-dtask="' + e.id + ':' + idx + '"><span class="box">✓</span><span class="cx">' + esc(x.text) + '</span></div>';
        }).join('');
        var meta = []; if (e.minutes) meta.push(esc(e.minutes) + '분'); if (e.tempo) meta.push(esc(e.tempo) + 'bpm');
        meta.push('완료 ' + done + '/' + (e.tasks ? e.tasks.length : 0));
        return '<div class="dentry card pad">' +
          '<div class="dhead"><div><span class="ddate">' + esc(e.date) + '</span> <span class="dfocus">' + esc(e.focus || '(초점 미기재)') + '</span></div>' +
          '<span class="dmeta">' + meta.join(' · ') + '</span></div>' +
          (tasks ? '<div class="dtasks">' + tasks + '</div>' : '') +
          (e.notes ? '<div class="dnote">' + esc(e.notes) + '</div>' : '') +
          '<div class="cta-row" style="margin-top:12px">' +
            '<button class="btn sm" data-dcopy="' + e.id + '">📋 선생님 검수용 복사</button>' +
            '<button class="btn sm" data-dedit="' + e.id + '">편집</button>' +
            '<button class="btn sm" data-ddel="' + e.id + '">삭제</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    return '<section class="view">' +
      (fromStep ? backTo('course/' + fromStep.id, 'STEP ' + fromStep.n + ' · ' + fromStep.title) : '') +
      '<div class="eyebrow first">연습 일지</div>' +
      '<h2>연습을 기록하고, 검수받으세요</h2>' +
      (fromStep ? '<div class="callout tip"><span class="lab">자동 입력됨</span>STEP ' + fromStep.n +
        '의 연습 항목이 아래에 채워졌습니다. 실제로 한 것만 체크하고, 막힌 곳을 메모에 적어 「선생님 검수용 복사」로 보내세요.</div>' : '') +
      '<p class="body">매 연습을 날짜별로 남기세요. 항목을 <b>체크</b>하고 <b>메모</b>를 적은 뒤, 끝나면 <b>「선생님 검수용 복사」</b> 버튼으로 복사해 채팅에 붙여넣으면 — 제가 재즈 피아노 교수처럼 검수·피드백해 드립니다. (이 기기 브라우저에 저장됩니다.)</p>' +
      form +
      '<div class="eyebrow">지난 기록 (' + entries.length + ')</div>' +
      list +
    '</section>';
  }

  /* ── SVG chevron ── */
  function chev() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  }

  /* ── 라우터 ── */
  function parseHash() {
    var h = (location.hash || '#home').replace(/^#/, '');
    var parts = h.split('/');
    return { view: parts[0] || 'home', arg: parts[1] || null };
  }
  var keepScroll = false;
  var LEGACY = { ladder: 1, technique: 1, decoder: 1, listen: 1, lectures: 1 };
  var TOMY = { home: 1, progress: 1 };
  function render() {
    var r = parseHash();
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var html;
    var pill = LEGACY[r.view] ? 'course' : (TOMY[r.view] ? 'my' : r.view);
    switch (r.view) {
      case 'my': html = viewMy(); break;
      case 'guide': html = viewGuide(); break;
      case 'course': html = r.arg ? viewStep(r.arg) : viewCourse(); break;
      case 'diary': html = viewDiary(r.arg); break;
      /* 홈·진도는 마이러닝이 흡수 — 옛 북마크 유지 */
      case 'home': case 'progress': html = viewMy(); break;
      /* 구버전 북마크(#ladder·#technique·#decoder…) → 코스로 흡수됨 */
      case 'ladder': case 'technique': case 'decoder': case 'listen': case 'lectures':
        html = viewCourse(); break;
      default: html = viewMy();
    }
    app.innerHTML = html;
    setActivePill(pill);
    renderSysbar();
    if (keepScroll) { keepScroll = false; window.scrollTo({ top: y, behavior: 'auto' }); }
    else { window.scrollTo({ top: 0, behavior: 'auto' }); if (app.focus) app.focus(); }
  }
  function go(view, arg) { location.hash = '#' + view + (arg ? '/' + arg : ''); }

  function renderPills() {
    pillsEl.innerHTML = ROUTES.map(function (r) {
      return (r.sep ? '<span class="pillsep">' + esc(r.sep) + '</span>' : '') +
        '<button class="pill' + (r.id === 'course' ? ' main' : '') + '" data-go="' + r.id + '">' +
        '<span class="n">' + r.n + '</span>' + esc(r.label) + '</button>';
    }).join('');
  }
  function setActivePill(view) {
    [].forEach.call(pillsEl.querySelectorAll('.pill'), function (p) {
      p.classList.toggle('on', p.getAttribute('data-go') === view);
    });
  }

  /* ── 이벤트 위임 ── */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-go],[data-step],[data-gate],[data-conf],[data-retry],[data-rev],[data-min],[data-diarystep],[data-toggle],[data-focus],[data-diary],[data-dtask],[data-dedit],[data-ddel],[data-dcopy],[data-sync]');
    if (!t) return;

    /* 복습 카드 채점 — 그 자리에서 완결, 이동 없음 */
    if (t.hasAttribute('data-rev')) {
      var rp = t.getAttribute('data-rev').split(':');
      reviewGrade(rp[0], rp[1]); markToday(false);
      keepScroll = true; render(); return;
    }
    /* 확정 통과 (콜드 스타트) */
    if (t.hasAttribute('data-conf')) {
      confirmStep(t.getAttribute('data-conf')); markToday(false);
      keepScroll = true; render(); return;
    }
    /* 확정 실패 — 하루 더 */
    if (t.hasAttribute('data-retry')) {
      ev.preventDefault();
      unconfirm(t.getAttribute('data-retry')); markToday(false);
      keepScroll = true; render(); return;
    }
    /* 최소 실행 티어 — 5분만 해도 연속 유지 */
    if (t.hasAttribute('data-min')) {
      ev.preventDefault(); markToday(true);
      go('course', t.getAttribute('data-min')); return;
    }


    if (t.hasAttribute('data-sync')) {
      var act = t.getAttribute('data-sync'), S = SY();
      if (!S) return;
      if (act === 'export') {
        var blob = S.exportBlob(), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = S.exportName();
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        return;
      }
      if (act === 'signin') {
        var em = (document.getElementById('sync-email') || {}).value || '';
        var pw = (document.getElementById('sync-pw') || {}).value || '';
        if (!em || !pw) return;
        t.textContent = '로그인 중…';
        S.signIn(em.trim(), pw).then(function () { keepScroll = true; render(); })
          .catch(function () { keepScroll = true; render(); });
        return;
      }
      if (act === 'signout') { S.signOut().then(function () { keepScroll = true; render(); }); return; }
      if (act === 'now') {
        t.textContent = '동기화 중…';
        S.sync().then(function () { keepScroll = true; render(); })
          .catch(function () { keepScroll = true; render(); });
        return;
      }
      return;
    }

    if (t.hasAttribute('data-gate')) {
      var gp = t.getAttribute('data-gate').split(':');
      toggleGate(gp[0], +gp[1]);
      if (gatesPassed(gp[0])) markProvisional(gp[0]);
      markToday(false);
      keepScroll = true;
      render();
      return;
    }
    if (t.hasAttribute('data-step')) { ev.preventDefault(); go('course', t.getAttribute('data-step')); return; }
    if (t.hasAttribute('data-diarystep')) { ev.preventDefault(); go('diary', t.getAttribute('data-diarystep')); return; }

    if (t.hasAttribute('data-focus')) { var fi = document.getElementById('diary-focus'); if (fi) fi.value = t.getAttribute('data-focus'); return; }
    if (t.hasAttribute('data-diary')) { var act = t.getAttribute('data-diary'); if (act === 'save') saveDiaryFromForm(); else if (act === 'cancel') { diaryEditId = null; render(); } return; }
    if (t.hasAttribute('data-dtask')) { var pp = t.getAttribute('data-dtask').split(':'); toggleDiaryTask(pp[0], +pp[1]); return; }
    if (t.hasAttribute('data-dedit')) { diaryEditId = t.getAttribute('data-dedit'); render(); window.scrollTo({ top: 0, behavior: 'auto' }); return; }
    if (t.hasAttribute('data-ddel')) { delDiary(t.getAttribute('data-ddel')); return; }
    if (t.hasAttribute('data-dcopy')) { copyDiaryReview(t.getAttribute('data-dcopy'), t); return; }

    if (t.hasAttribute('data-toggle')) {
      var id = t.getAttribute('data-toggle');
      toggleDone(id);
      t.classList.toggle('done');
      // 진도 뷰라면 상단 바 갱신
      if (parseHash().view === 'progress') render();
      return;
    }
    if (t.hasAttribute('data-go')) { ev.preventDefault(); go(t.getAttribute('data-go')); return; }
  });

  document.addEventListener('change', function (ev) {
    if (!ev.target || ev.target.id !== 'sync-file') return;
    var f = ev.target.files && ev.target.files[0], S = SY();
    if (!f || !S) return;
    var rdr = new FileReader();
    rdr.onload = function () {
      try { S.importText(String(rdr.result)); alert('가져왔습니다. 기존 기록과 합쳐졌습니다.'); }
      catch (e) { alert('가져오기 실패: ' + e.message); }
      keepScroll = true; render();
    };
    rdr.readAsText(f);
  });

  window.LUANLU_RERENDER = function () { keepScroll = true; render(); };
  window.addEventListener('hashchange', render);
  renderPills();
  render();
})();
