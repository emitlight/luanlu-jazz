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
    { id: 'home',     n: '01', label: '홈' },
    { id: 'course',   n: '02', label: '연습 코스' },
    { id: 'progress', n: '03', label: '나의 진도' },
    { id: 'diary',    n: '04', label: '연습일지' },
    { id: 'guide',    n: '05', label: '이용안내' }
  ];

  /* ── 진도 (localStorage, file:// 안전) ── */
  var PKEY = 'luanlu.progress.v1';
  function getProg() {
    try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch (e) { return {}; }
  }
  function setProg(p) {
    try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {}
  }
  function isDone(id) { return !!getProg()[id]; }
  function toggleDone(id) { var p = getProg(); if (p[id]) delete p[id]; else p[id] = 1; setProg(p); }
  function allModuleIds() { return Object.keys(D.modules); }
  function doneCount() { var p = getProg(), ids = allModuleIds(), c = 0; ids.forEach(function (i) { if (p[i]) c++; }); return c; }

  /* ── 코스 진도 (스텝별 통과 기준 체크) ── */
  var CKEY = 'luanlu.course.v1';
  function getCourse() { try { return JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { return {}; } }
  function setCourse(c) { try { localStorage.setItem(CKEY, JSON.stringify(c)); } catch (e) {} }
  function gatesOf(id) { var e = getCourse()[id]; return (e && e.g) || []; }
  function stepDone(id) {
    var st = C.byId(id); if (!st) return false;
    var g = gatesOf(id);
    for (var i = 0; i < st.gates.length; i++) if (!g[i]) return false;
    return true;
  }
  function toggleGate(id, i) {
    var c = getCourse(), e = c[id] || (c[id] = { g: [] });
    e.g = e.g || [];
    e.g[i] = e.g[i] ? 0 : 1;
    setCourse(c);
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

  /* ── 연습일지 (localStorage) ── */
  var DKEY = 'luanlu.diary.v1';
  var diaryEditId = null;
  function getDiary() { try { return JSON.parse(localStorage.getItem(DKEY) || '[]'); } catch (e) { return []; } }
  function setDiary(d) { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch (e) {} }
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
    var entry = { date: g('diary-date') || todayStr(), focus: g('diary-focus'), minutes: g('diary-min'), tempo: g('diary-tempo'), tasks: tasks, notes: g('diary-notes') };
    var d = getDiary();
    if (diaryEditId) { entry.id = diaryEditId; d = d.map(function (e) { return e.id === diaryEditId ? entry : e; }); diaryEditId = null; }
    else { entry.id = 'd' + new Date().getTime(); d.unshift(entry); }
    setDiary(d); render();
  }
  function toggleDiaryTask(id, idx) {
    var d = getDiary();
    d.forEach(function (e) { if (e.id === id && e.tasks && e.tasks[idx]) e.tasks[idx].done = !e.tasks[idx].done; });
    setDiary(d); render();
  }
  function delDiary(id) { var d = getDiary().filter(function (e) { return e.id !== id; }); setDiary(d); if (diaryEditId === id) diaryEditId = null; render(); }
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
        return '<div class="srow' + (isDoneS ? ' done' : '') + (isCur ? ' now' : '') + '" data-step="' + s.id + '">' +
          '<span class="sn">' + mark + '</span>' +
          '<span class="sc"><span class="sname">' + esc(s.title) + ' ' + badge + '</span>' +
            '<span class="sgoal">' + esc(s.goal) + '</span>' +
            '<span class="smeta">' + s.mins + '분 · ' + esc(s.days) +
              (s.song ? ' · <b>' + esc(songTitle(s.song.dec)) + '</b>' : '') + '</span></span>' +
          '<span class="parrow">›</span></div>';
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

    /* 3. 손 모양 (사다리 rung 또는 모듈 예시) */
    var kbd = '';
    var mod = s.mod ? D.modules[s.mod] : null;
    if (s.kbdFrom === 'mod' && mod && mod.example) {
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

    /* 7. 통과 기준 */
    var gateRows = s.gates.map(function (t, i) {
      return '<div class="check' + (g[i] ? ' done' : '') + '" data-gate="' + s.id + ':' + i + '">' +
        '<span class="box">✓</span><span class="cx">' + esc(t) + '</span></div>';
    }).join('');
    var passBanner = passed
      ? '<div class="passed">✓ 이 스텝을 통과했습니다' + (next ? ' — 다음은 <b>STEP ' + next.n + ' · ' + esc(next.title) + '</b>' : ' — 코스 완주!') + '</div>'
      : '<div class="kbd-cap" style="margin-top:9px">세 가지가 모두 체크되면 다음 스텝으로 넘어가세요. 며칠 걸려도 정상입니다 (' + esc(s.days) + ').</div>';
    var gateSec = '<div class="section"><h4>통과 기준 — 이게 되면 다음</h4>' + gateRows + passBanner + '</div>';

    /* 8. 기록 */
    var deeper = '<div class="cta-row" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<a class="btn solid" data-diarystep="' + s.id + '">📔 이 스텝으로 연습일지 쓰기</a></div>';

    var nav = '<div class="modnav">' +
      (prev ? '<a class="btn sm" data-step="' + prev.id + '">← STEP ' + prev.n + '</a>' : '<span></span>') +
      (next ? '<a class="btn sm" data-step="' + next.id + '">STEP ' + next.n + ' · ' + esc(next.title) + ' →</a>' : '<span></span>') +
    '</div>';

    var totalMin = s.drills.reduce(function (a, d) { return a + d.m; }, 0);

    return '<section class="view">' +
      backTo('course', '연습 코스') +
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
      '<div class="section"><h4>오늘 이렇게 연습하세요 · 총 ' + totalMin + '분</h4>' + drills + '</div>' +
      kbdSec + songSec + lecSec + listenSec + stuck + gateSec + deeper + deepSec + nav +
    '</section>';
  }

  /* ════════════════ 뷰: 이용안내 ════════════════ */
  function viewGuide() {
    var quick = [
      { t: '홈을 연다', d: '「이어서 하기」 카드에 오늘 할 스텝이 이미 정해져 있습니다. 고를 게 없습니다.' },
      { t: '그 스텝 한 장만 본다', d: '왜 지금 이걸 → 분 단위 드릴 → 손 모양 → 곡의 어느 구간 → 강의 1편 → 오늘 들을 것. 위에서 아래로만.' },
      { t: '피아노 앞에서 그대로 실행', d: '드릴에 적힌 시간(3분·7분·5분…)을 지키세요. 하루 15~30분이면 충분합니다.' },
      { t: '통과 기준 3개를 체크', d: '다 되면 다음 스텝이 자동으로 열립니다. 며칠~2주 걸리는 게 정상입니다.' },
      { t: '「이 스텝으로 연습일지 쓰기」', d: '드릴이 항목으로 자동 입력됩니다. 막힌 곳을 적어 복사 → 채팅에 붙여넣으면 검수해 드립니다.' }
    ];
    var quickHtml = '<div class="steps">' + quick.map(function (s) {
      return '<div class="s"><b>' + esc(s.t) + '</b> <span class="sd">' + esc(s.d) + '</span></div>';
    }).join('') + '</div>';

    var menus = [
      { ic: '🧭', route: 'home', t: '홈', what: '오늘 할 스텝 하나 + 전체 진행률.', how: '매일 여기부터 여세요. 「이어서 하기」만 누르면 됩니다.' },
      { ic: '🪜', route: 'course', t: '연습 코스 ★', what: '<b>매일 쓰는 화면.</b> 21개 하루치 연습 단위 + 사다리·심화·감상·강의 전체.', how: '스텝을 눌러 펼치고 드릴대로 연습 → 통과 기준 체크 → 다음 스텝.', main: true },
      { ic: '✅', route: 'progress', t: '나의 진도', what: '코스 진행률(막별) + 이론 모듈 체크리스트.', how: '스텝을 통과하면 자동으로 반영됩니다. 브라우저에 저장.' },
      { ic: '📔', route: 'diary', t: '연습일지', what: '날짜별 기록 · 체크리스트 · 메모.', how: '스텝 하단의 「이 스텝으로 연습일지 쓰기」로 항목 자동 입력 → 「선생님 검수용 복사」 → 채팅에 붙여넣기.' },
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
      '<b>홈 → 이어서 하기 → 그 한 장대로 연습 → 통과 기준 체크 → 일지.</b> 이 다섯 개 말고는 아무것도 안 해도 됩니다.</div>' +
      '<div class="eyebrow">메뉴 5개가 전부입니다</div>' +
      '<p class="body">카드를 누르면 해당 화면으로 바로 이동합니다.</p>' +
      '<div class="pathmap">' + menuHtml + '</div>' +
      '<div class="eyebrow">화면 기호 읽는 법</div>' + legend +
      '<div class="eyebrow">추천 루틴</div>' + routine +
      '<div class="eyebrow">자주 막히는 질문</div>' + faq +
      '<div class="callout tip" style="margin-top:16px"><span class="lab">팁</span>콘텐츠를 수정했는데 화면이 안 바뀌면 브라우저를 <b>하드 새로고침</b>(Ctrl+Shift+R)하세요. 진도·일지는 이 브라우저에 저장됩니다.</div>' +
      '<div class="cta-row" style="margin-top:18px;display:flex;gap:9px;flex-wrap:wrap"><a class="btn solid" data-go="course">연습 코스로 시작 →</a><a class="btn" data-go="home">홈으로</a></div>' +
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
  function render() {
    var r = parseHash();
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var html;
    var pill = LEGACY[r.view] ? 'course' : r.view;
    switch (r.view) {
      case 'guide': html = viewGuide(); break;
      case 'course': html = r.arg ? viewStep(r.arg) : viewCourse(); break;
      case 'progress': html = viewProgress(); break;
      case 'diary': html = viewDiary(r.arg); break;
      /* 구버전 북마크(#ladder·#technique·#decoder…) → 코스로 흡수됨 */
      case 'ladder': case 'technique': case 'decoder': case 'listen': case 'lectures':
        html = viewCourse(); break;
      default: html = viewHome();
    }
    app.innerHTML = html;
    setActivePill(pill);
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
    var t = ev.target.closest('[data-go],[data-step],[data-gate],[data-diarystep],[data-toggle],[data-focus],[data-diary],[data-dtask],[data-dedit],[data-ddel],[data-dcopy]');
    if (!t) return;

    if (t.hasAttribute('data-gate')) {
      var gp = t.getAttribute('data-gate').split(':');
      toggleGate(gp[0], +gp[1]);
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

  window.addEventListener('hashchange', render);
  renderPills();
  render();
})();
