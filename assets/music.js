/* ══════════════════════════════════════════════════════════════
   루앤루 · music.js — SVG 건반 렌더러 & 음악 헬퍼
   외부 라이브러리 0. 어떤 보이싱이든 건반 위에 그린다.
   window.MUSIC 로 노출.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var WHITE_PC = { 0: 1, 2: 1, 4: 1, 5: 1, 7: 1, 9: 1, 11: 1 };
  var BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function noteToMidi(s) {
    if (typeof s === 'number') return s;
    var m = /^([A-Ga-g])(#{1,2}|b{1,2}|)(-?\d+)$/.exec(String(s).trim());
    if (!m) return null;
    var acc = 0, i;
    for (i = 0; i < m[2].length; i++) acc += m[2][i] === '#' ? 1 : -1;
    return BASE[m[1].toUpperCase()] + acc + (parseInt(m[3], 10) + 1) * 12;
  }
  function pc(n) { return ((n % 12) + 12) % 12; }
  function isWhite(n) { return !!WHITE_PC[pc(n)]; }
  function midiToName(n, useFlats) {
    return (useFlats ? NAMES_FLAT : NAMES_SHARP)[pc(n)] + (Math.floor(n / 12) - 1);
  }
  function nameNoOct(n, useFlats) {
    return (useFlats ? NAMES_FLAT : NAMES_SHARP)[pc(n)];
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  /* marks: [{note:'F3'|midi, hand:'L'|'R', label?:'♭7', flat?:true}] */
  function normMarks(marks) {
    return (marks || []).map(function (m) {
      var midi = m.midi != null ? m.midi : noteToMidi(m.note);
      return { midi: midi, hand: (m.hand || 'R'), label: m.label, flat: m.flat !== false };
    }).filter(function (m) { return m.midi != null; });
  }

  function renderKeyboard(marks, opts) {
    opts = opts || {};
    marks = normMarks(marks);
    var W = opts.w || 30, H = opts.h || 130;
    var BW = Math.round(W * 0.60), BH = Math.round(H * 0.62);
    var lo, hi, ms = marks.map(function (m) { return m.midi; });
    if (opts.lo != null && opts.hi != null) { lo = opts.lo; hi = opts.hi; }
    else {
      var mn = ms.length ? Math.min.apply(null, ms) : 60;
      var mx = ms.length ? Math.max.apply(null, ms) : 72;
      lo = mn - 3; hi = mx + 3;
    }
    while (pc(lo) !== 0) lo--;    // snap down to a C
    while (pc(hi) !== 11) hi++;   // snap up to a B

    var whites = [], n, i;
    for (n = lo; n <= hi; n++) if (isWhite(n)) whites.push(n);
    var width = whites.length * W;
    var byMidi = {}; marks.forEach(function (m) { byMidi[m.midi] = m; });
    var xW = {}; whites.forEach(function (w, idx) { xW[w] = idx * W; });

    var svg = '<svg class="kbd" viewBox="0 0 ' + width + ' ' + H + '" width="' + width + '" height="' + H +
              '" role="img" aria-label="건반 보이싱">';
    // white keys first
    whites.forEach(function (w, idx) {
      var m = byMidi[w];
      svg += '<rect class="wk' + (m ? ' on-' + m.hand.toLowerCase() : '') + '" x="' + (idx * W) +
             '" y="0" width="' + W + '" height="' + H + '" rx="3"/>';
      if (m) {
        var lab = m.label != null ? m.label : nameNoOct(w, m.flat);
        svg += '<text class="klab wlab" x="' + (idx * W + W / 2) + '" y="' + (H - 10) + '">' + esc(lab) + '</text>';
      }
    });
    // black keys on top
    for (n = lo; n <= hi; n++) {
      if (isWhite(n)) continue;
      var lw = n - 1;                 // white key immediately to the left (always white)
      if (xW[lw] == null) continue;
      var bx = xW[lw] + W - BW / 2;
      var mb = byMidi[n];
      svg += '<rect class="bk' + (mb ? ' on-' + mb.hand.toLowerCase() : '') + '" x="' + bx +
             '" y="0" width="' + BW + '" height="' + BH + '" rx="2"/>';
      if (mb) {
        var lb = mb.label != null ? mb.label : nameNoOct(n, mb.flat);
        svg += '<text class="klab blab" x="' + (bx + BW / 2) + '" y="' + (BH - 8) + '">' + esc(lb) + '</text>';
      }
    }
    svg += '</svg>';
    return svg;
  }

  /* Build marks from LH + RH note lists.
     Each entry: 'F3'  OR  {note:'F3', label:'♭7'} */
  function voicing(lh, rh, opts) {
    opts = opts || {};
    var flat = opts.flat !== false;
    function mk(arr, hand) {
      return (arr || []).map(function (x) {
        if (typeof x === 'string') return { note: x, hand: hand, flat: flat };
        return { note: x.note, midi: x.midi, hand: hand, label: x.label, flat: flat };
      });
    }
    return mk(lh, 'L').concat(mk(rh, 'R'));
  }

  /* A little inline legend snippet for hands */
  function legend() {
    return '<div class="kbd-legend"><span><i class="lh"></i>왼손 (화성·컴핑)</span>' +
           '<span><i class="rh"></i>오른손 (멜로디·라인)</span></div>';
  }

  window.MUSIC = {
    noteToMidi: noteToMidi, midiToName: midiToName, nameNoOct: nameNoOct,
    isWhite: isWhite, renderKeyboard: renderKeyboard, voicing: voicing, legend: legend, esc: esc
  };
})();
