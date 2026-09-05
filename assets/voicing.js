/* ══════════════════════════════════════════════════════════════
   루앤루 · voicing.js — 코드 심볼 → 실제 보이싱 생성기
   외부 라이브러리 0. window.VOICING 으로 노출.

   왜 필요한가
   ───────────
   지금까지 건반 그림은 사다리(C장조 Dm7–G7–Cmaj7) 고정 예시를 재사용했다.
   그래서 Autumn Leaves(G/Em) 스텝에서도 C장조 건반이 그려졌다 — 텍스트는
   Am7–D7–Gmaj7을 지시하는데 그림은 다른 조를 보여주는 상태.
   이 엔진은 코드 심볼에서 실제 음을 계산해 그 조의 건반을 그린다.

   설계 원칙
   ───────────
   ① 철자는 다이어토닉으로. 음높이(pitch class)가 아니라 도수(degree)로 계산한다.
      A7의 3도는 C♯이지 D♭이 아니다. Cdim7의 7도는 B♭♭이지 A가 아니다.
   ② 음역은 하나의 규칙으로. 왼손 보이싱 최저음 F3~C4, 최고음 E4 이하.
      (감사 B1 — 셸/가이드톤/루트리스가 같은 자리에서 살이 붙어야 한다)
   ③ 보이스리딩은 직전 보이싱 기준 최소 이동으로 옥타브를 고른다.
   ══════════════════════════════════════════════════════════════ */
(function () {

  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /* ── 표기 정규화: 재즈 관례(♭♯)와 ASCII(b#)를 함께 받는다 ── */
  function normSym(s) {
    return String(s || '').trim()
      .replace(/♭/g, 'b').replace(/♯/g, '#')
      .replace(/[Δ△]/g, 'maj7')
      .replace(/ø/g, 'm7b5')
      .replace(/[°º∘]/g, 'dim');
  }

  /* ── 코드 심볼 파싱 → { root:{letter,acc}, quality } ── */
  function parse(sym) {
    var s = normSym(sym);
    var m = /^([A-G])(bb|b|##|#|)(.*)$/.exec(s);
    if (!m) return null;
    var acc = 0, i;
    for (i = 0; i < m[2].length; i++) acc += m[2][i] === '#' ? 1 : -1;
    var q = (m[3] || '').trim();

    var quality =
      /^dim7?$/.test(q)            ? 'dim7' :
      /^m7b5$/.test(q)             ? 'm7b5' :
      /^(m|min|-)6$/.test(q)       ? 'm6'   :
      /^(m|min|-)(maj7|Maj7)$/.test(q) ? 'mMaj7' :
      /^(m|min|-)7/.test(q)        ? 'm7'   :
      /^(m|min|-)$/.test(q)        ? 'm7'   :   /* 리얼북의 Em은 재즈에선 Em7로 연주 */
      /^(maj7|M7|ma7)/.test(q)     ? 'maj7' :
      /^6\/9$/.test(q)             ? '69'   :
      /^6$/.test(q)                ? '6'    :
      /^7/.test(q)                 ? '7'    :
      /^$/.test(q)                 ? 'maj7' :   /* 단독 대문자는 장3화음 → maj7 취급 */
      null;
    if (!quality) return null;

    /* 변형 텐션 (♯11, ♭9 …) — 지금은 ♯11만 실제 음으로 반영 */
    var alt = { sharp11: /#11/.test(q), flat9: /b9/.test(q), sharp9: /#9/.test(q), flat13: /b13/.test(q) };
    return { letter: m[1], acc: acc, quality: quality, alt: alt, sym: String(sym).trim() };
  }

  /* ── 도수 → 음이름 (다이어토닉 철자) ──
     deg: 1,3,5,7,9,11,13 / semis: 루트로부터의 반음 수 */
  function degreeNote(root, deg, semis) {
    var li = LETTERS.indexOf(root.letter);
    var steps = (deg - 1) % 7;                        /* 9→2, 11→3, 13→5 */
    var letter = LETTERS[(li + steps) % 7];
    /* 루트에서 그 글자까지의 자연 반음 거리 */
    var natDist = ((NAT[letter] - NAT[root.letter]) % 12 + 12) % 12;
    var want = ((semis % 12) + 12) % 12;
    var accid = want - natDist;
    if (accid > 6) accid -= 12;
    if (accid < -6) accid += 12;
    accid += root.acc;                                /* 루트 자체의 임시표 반영 */
    return { letter: letter, acc: accid, semis: semis };
  }

  function accStr(a) {
    return a === 0 ? '' : a > 0 ? new Array(a + 1).join('#') : new Array(-a + 1).join('b');
  }
  function pretty(n) {
    return n.letter + (n.acc === 0 ? '' : n.acc > 0
      ? new Array(n.acc + 1).join('♯') : new Array(-n.acc + 1).join('♭'));
  }
  /* music.js가 먹는 형태: 'Bbb3' 같은 절대 음이름 */
  function withOctave(n, oct) { return n.letter + accStr(n.acc) + oct; }

  /* ── 품질별 구성음 (도수 → 반음) ── */
  var FORMULA = {
    maj7:  { 3: 4, 5: 7, 7: 11, 9: 14, 13: 21 },
    7:     { 3: 4, 5: 7, 7: 10, 9: 14, 13: 21 },
    m7:    { 3: 3, 5: 7, 7: 10, 9: 14, 13: 21 },
    m7b5:  { 3: 3, 5: 6, 7: 10, 9: 14, 11: 17 },
    dim7:  { 3: 3, 5: 6, 7: 9 },
    6:     { 3: 4, 5: 7, 6: 9, 9: 14 },
    m6:    { 3: 3, 5: 7, 6: 9, 9: 14 },
    69:    { 3: 4, 5: 7, 6: 9, 9: 14 },
    mMaj7: { 3: 3, 5: 7, 7: 11, 9: 14 }
  };

  function tone(ch, deg) {
    var f = FORMULA[ch.quality];
    if (!f || f[deg] == null) return null;
    var semis = f[deg];
    if (deg === 11 && ch.alt.sharp11) semis = 18;
    return degreeNote(ch, deg, semis);
  }

  /* 6화음은 7도 자리를 6도가 대신한다 */
  function seventhDeg(ch) {
    return (ch.quality === '6' || ch.quality === 'm6' || ch.quality === '69') ? 6 : 7;
  }

  /* ══════════════ 보이싱 정의 ══════════════
     반환: [{deg, label, note}] — 낮은 음부터 */
  function degreesFor(kind, ch) {
    var sev = seventhDeg(ch);
    var dom = (ch.quality === '7');
    var dimish = (ch.quality === 'dim7' || ch.quality === 'm7b5');

    switch (kind) {
      case 'shell':
        /* 루트+3+7. 단 ♭5가 코드의 정체인 경우(m7♭5·dim7) 5도를 반드시 포함 */
        return dimish ? [1, 3, 5, sev] : [1, 3, sev];

      case 'guide':
        /* 3도와 7도만 */
        return [3, sev];

      case 'rootlessA':
        /* m7·maj7 = 3-5-7-9 / dom7 = 3-13-7-9 (5도를 13으로 대체) */
        if (dimish) return [3, 5, sev, 9];
        return dom ? [3, 13, sev, 9] : [3, 5, sev, 9];

      case 'rootlessB':
        /* A형의 위 두 음을 아래로: 7-9-3-5 / dom7 = 7-9-3-13 */
        if (dimish) return [sev, 9, 3, 5];
        return dom ? [sev, 9, 3, 13] : [sev, 9, 3, 5];

      default:
        return [1, 3, 5, sev];
    }
  }

  var DEG_LABEL = {
    1: 'R', 3: '3', 5: '5', 6: '6', 7: '7', 9: '9', 11: '11', 13: '13'
  };
  function labelFor(ch, deg) {
    var n = deg === 1 ? { semis: 0 } : tone(ch, deg);
    if (!n) return DEG_LABEL[deg] || String(deg);
    var base = DEG_LABEL[deg] || String(deg);
    /* 단3도·단7도·감5도는 ♭ 표기를 붙여준다 (학습자가 도수를 읽게) */
    if (deg === 3 && n.semis === 3) return '♭3';
    if (deg === 7 && n.semis === 10) return '♭7';
    if (deg === 7 && n.semis === 9) return '♭♭7';
    if (deg === 5 && n.semis === 6) return '♭5';
    if (deg === 13 && ch.alt.flat13) return '♭13';
    if (deg === 11 && ch.alt.sharp11) return '♯11';
    return base;
  }

  /* ── 음역 규칙 (감사 B1) ── */
  var LH_LO = 52;   /* E3 — 가이드톤 2성부가 앉는 자리까지 */
  var LH_HI = 64;   /* E4 */

  function pcOf(n) { return ((NAT[n.letter] + n.acc) % 12 + 12) % 12; }

  /* 도수 목록 → 실제 midi 배치.
     anchor(직전 보이싱의 midi 배열)가 있으면 이동량이 최소가 되게 옥타브를 고른다. */
  function place(ch, degs, anchor, lo, hi, allowInv) {
    lo = lo == null ? LH_LO : lo;
    hi = hi == null ? LH_HI : hi;

    var notes = degs.map(function (d) {
      var n = d === 1 ? degreeNote(ch, 1, 0) : tone(ch, d);
      return n ? { deg: d, n: n, pc: pcOf(n) } : null;
    }).filter(Boolean);
    if (!notes.length) return null;

    /* 전위(어느 음을 밑에 깔지)와 옥타브를 모두 훑어 이동량이 최소인 배치를 고른다.
       가이드톤이 "반음 하나만 움직인다"가 되려면 전위 탐색이 필수다 —
       3도를 항상 밑에 깔면 Dm7(F·C) → G7(B·F)가 되어 두 음이 다 움직인다.
       정답은 G7(F·B): F가 제자리에 남고 C→B 반음 하나만 움직인다. */
    var best = null;
    /* allowInv가 false면 회전 없음 — 셸은 루트가 맨 아래여야 하고,
       루트리스 A형(3도 최저)·B형(7도 최저)은 그 배치가 곧 정의다. */
    var rots = allowInv ? notes.length : 1;
    for (var rot = 0; rot < rots; rot++) {
      var order = notes.slice(rot).concat(notes.slice(0, rot));
      for (var base = lo; base <= hi; base++) {
        if (order[0].pc !== ((base % 12) + 12) % 12) continue;
        var midis = [base], prev = base, i;
        for (i = 1; i < order.length; i++) {
          var m = prev + (((order[i].pc - (prev % 12)) % 12 + 12) % 12);
          if (m === prev) m += 12;                   /* 같은 음 중복 방지 */
          midis.push(m); prev = m;
        }
        if (midis[midis.length - 1] > hi + 12) continue;   /* 너무 벌어지면 버림 */

        var cost;
        if (anchor && anchor.length) {
          /* 공통음은 0점. 움직인 음만 거리로 계산 → 최소 이동이 이긴다 */
          cost = 0;
          midis.forEach(function (mm) {
            cost += Math.min.apply(null, anchor.map(function (a) { return Math.abs(a - mm); }));
          });
          /* 음역 중심에서 너무 벗어나는 배치에 약한 벌점 */
          cost += Math.abs(midis[0] - 57) * 0.05;
        } else {
          /* 앵커가 없으면(진행의 첫 코드) 음역 하단에 가깝게 —
             셸의 위 두 음이 그대로 가이드톤이 되는 자리를 잡기 위해서다.
             Dm7 가이드톤이 C4·F4가 아니라 F3·C4로 나와야 한다. */
          cost = midis[0] - lo;
        }
        if (!best || cost < best.cost) best = { order: order, midis: midis, cost: cost };
      }
    }
    if (!best) return null;

    return best.order.map(function (t, i) {
      var oct = Math.floor(best.midis[i] / 12) - 1;
      return {
        deg: t.deg,
        label: labelFor(ch, t.deg),
        name: pretty(t.n),
        note: withOctave(t.n, oct),
        midi: best.midis[i]
      };
    });
  }

  /* ══════════════ 공개 API ══════════════ */
  var VOICING = {
    parse: parse,

    /* 코드 하나를 한 가지 보이싱으로.
       opts: {anchor:[midi], lo, hi} */
    voice: function (sym, kind, opts) {
      var ch = parse(sym);
      if (!ch) return null;
      opts = opts || {};
      var degs = degreesFor(kind || 'shell', ch);
      var v = place(ch, degs, opts.anchor, opts.lo, opts.hi, (kind || 'shell') === 'guide');
      if (!v) return null;
      return { sym: String(sym).trim(), quality: ch.quality, kind: kind || 'shell', notes: v };
    },

    /* 진행 전체를 보이스리딩으로 이어서.
       syms: ['Am7','D7','Gmaj7'] → [{sym, notes:[...]}, ...] */
    progression: function (syms, kind, opts) {
      opts = opts || {};
      var anchor = opts.anchor || null, out = [];
      (syms || []).forEach(function (s) {
        var v = VOICING.voice(s, kind, { anchor: anchor, lo: opts.lo, hi: opts.hi });
        if (v) { anchor = v.notes.map(function (n) { return n.midi; }); out.push(v); }
        else out.push({ sym: String(s).trim(), notes: null, error: '해석 불가' });
      });
      return out;
    },

    /* music.js의 renderKeyboard가 먹는 marks 배열로 변환 */
    marks: function (voiced, hand) {
      if (!voiced || !voiced.notes) return [];
      return voiced.notes.map(function (n) {
        return { note: n.note, hand: hand || 'L', label: n.label };
      });
    },

    /* 진행의 음역 전체를 덮는 lo/hi (건반 그림 범위 맞추기용) */
    span: function (voicedList, pad) {
      var all = [];
      (voicedList || []).forEach(function (v) {
        if (v && v.notes) v.notes.forEach(function (n) { all.push(n.midi); });
      });
      if (!all.length) return null;
      pad = pad == null ? 2 : pad;
      return { lo: Math.min.apply(null, all) - pad, hi: Math.max.apply(null, all) + pad };
    },

    /* 12조 — 재즈 관례 표기 */
    KEYS: ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D', 'G'],

    /* 이조: 심볼의 루트를 다른 조로 옮긴다 (드릴용) */
    transpose: function (sym, semis) {
      var ch = parse(sym);
      if (!ch) return null;
      var from = ((NAT[ch.letter] + ch.acc) % 12 + 12) % 12;
      var to = ((from + semis) % 12 + 12) % 12;
      /* 조표가 단순한 철자를 고른다 */
      var FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
      var root = FLATS[to];
      return root.replace(/b/g, '♭') + normSym(ch.sym).replace(/^[A-G](bb|b|##|#|)/, '');
    }
  };

  window.VOICING = VOICING;
})();
