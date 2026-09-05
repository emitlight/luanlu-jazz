/* ══════════════════════════════════════════════════════════════
   루앤루 · sync.js — 기기 간 진도·일지 동기화

   설계 원칙
   ① 로컬 우선(local-first): 모든 읽기·쓰기는 localStorage가 먼저다.
      동기화가 꺼져 있거나 오프라인이어도 앱은 완전히 동작한다.
   ② 합집합 병합: 기기 A에서 체크한 것과 기기 B에서 체크한 것을 모두 살린다.
      (개인 학습 기록이라 "지운 것"만 따로 추적하고 나머지는 합친다)
   ③ 외부 라이브러리 0: Supabase SDK 없이 REST + fetch만 사용한다.

   백엔드: Supabase(Postgres) · 테이블 public.sync · RLS로 본인 행만 접근
   ══════════════════════════════════════════════════════════════ */
(function () {
  var CFG = window.LUANLU_CONFIG || {};
  var URL_ = (CFG.SUPABASE_URL || '').replace(/\/+$/, '');
  var KEY  = CFG.SUPABASE_ANON_KEY || '';

  var LS = {
    course: 'luanlu.course.v1',
    progress: 'luanlu.progress.v1',
    diary: 'luanlu.diary.v1',
    diaryDel: 'luanlu.diarydel.v1',
    session: 'luanlu.session.v1',
    lastSync: 'luanlu.lastsync.v1'
  };

  function rd(k, dflt) { try { return JSON.parse(localStorage.getItem(k) || dflt); } catch (e) { return JSON.parse(dflt); } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ── 상태 ── */
  var state = {
    configured: !!(URL_ && KEY),
    status: 'off',        // off | signedout | idle | syncing | error
    email: null,
    lastSync: null,
    error: null,
    pending: false
  };
  var listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(snapshot()); } catch (e) {} }); }
  function snapshot() {
    return {
      configured: state.configured, status: state.status, email: state.email,
      lastSync: state.lastSync, error: state.error, pending: state.pending
    };
  }
  function setStatus(s, err) { state.status = s; state.error = err || null; emit(); }

  /* ── 로컬 스냅샷 ── */
  function localPayload() {
    return {
      v: 1,
      course: rd(LS.course, '{}'),
      progress: rd(LS.progress, '{}'),
      diary: rd(LS.diary, '[]'),
      diaryDeleted: rd(LS.diaryDel, '[]'),
      updatedAt: new Date().toISOString()
    };
  }
  function applyPayload(p) {
    if (!p) return;
    if (p.course) wr(LS.course, p.course);
    if (p.progress) wr(LS.progress, p.progress);
    if (p.diary) wr(LS.diary, p.diary);
    if (p.diaryDeleted) wr(LS.diaryDel, p.diaryDeleted);
  }

  /* ── 병합 ─────────────────────────────────────────────
     통과 기준·모듈 완료는 OR(둘 중 하나라도 체크했으면 체크).
     일지는 id 기준 합집합에서 삭제 목록을 뺀다. */
  function mergeCourse(a, b) {
    var out = {}, ids = {};
    Object.keys(a || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(b || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (id) {
      var ga = ((a || {})[id] || {}).g || [], gb = ((b || {})[id] || {}).g || [];
      var n = Math.max(ga.length, gb.length), g = [];
      for (var i = 0; i < n; i++) g[i] = (ga[i] || gb[i]) ? 1 : 0;
      out[id] = { g: g };
    });
    return out;
  }
  function mergeFlags(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { if ((a || {})[k]) out[k] = 1; });
    Object.keys(b || {}).forEach(function (k) { if ((b || {})[k]) out[k] = 1; });
    return out;
  }
  function mergeDiary(a, b, deleted) {
    var gone = {};
    (deleted || []).forEach(function (id) { gone[id] = 1; });
    var byId = {};
    (a || []).concat(b || []).forEach(function (e) {
      if (!e || !e.id || gone[e.id]) return;
      var prev = byId[e.id];
      if (!prev) { byId[e.id] = e; return; }
      // 같은 기록이 양쪽에 있으면 나중에 고친 쪽을 취한다
      var pm = prev.m || '', em = e.m || '';
      byId[e.id] = (em >= pm) ? e : prev;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (x, y) { return (y.date || '').localeCompare(x.date || '') || (y.id || '').localeCompare(x.id || ''); });
  }
  function mergeUnique(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (v) { if (!seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }
  function merge(local, remote) {
    if (!remote) return local;
    var deleted = mergeUnique(local.diaryDeleted, remote.diaryDeleted);
    return {
      v: 1,
      course: mergeCourse(local.course, remote.course),
      progress: mergeFlags(local.progress, remote.progress),
      diary: mergeDiary(local.diary, remote.diary, deleted),
      diaryDeleted: deleted,
      updatedAt: new Date().toISOString()
    };
  }

  /* ── Supabase REST ── */
  function api(path, opts) {
    opts = opts || {};
    var h = opts.headers || {};
    h.apikey = KEY;
    h['Content-Type'] = 'application/json';
    if (opts.auth !== false) {
      var s = rd(LS.session, 'null');
      if (s && s.access_token) h.Authorization = 'Bearer ' + s.access_token;
    }
    opts.headers = h;
    return fetch(URL_ + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var body = null;
        try { body = t ? JSON.parse(t) : null; } catch (e) { body = t; }
        if (!r.ok) {
          var msg = (body && (body.error_description || body.msg || body.message || body.error)) || ('HTTP ' + r.status);
          var err = new Error(msg); err.status = r.status; throw err;
        }
        return body;
      });
    });
  }

  function saveSession(s) {
    if (!s || !s.access_token) return;
    s.expires_at = Date.now() + ((s.expires_in || 3600) - 60) * 1000;
    wr(LS.session, s);
    state.email = (s.user && s.user.email) || state.email;
  }

  function ensureToken() {
    var s = rd(LS.session, 'null');
    if (!s || !s.access_token) return Promise.reject(new Error('로그인이 필요합니다'));
    if (s.expires_at && Date.now() < s.expires_at) return Promise.resolve(s);
    return api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', auth: false,
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (n) { saveSession(n); return n; });
  }

  /* ── 공개 API ── */
  var SYNC = {
    on: function (fn) { listeners.push(fn); fn(snapshot()); },
    state: snapshot,
    isConfigured: function () { return state.configured; },
    isSignedIn: function () { var s = rd(LS.session, 'null'); return !!(s && s.access_token); },

    signIn: function (email, password) {
      if (!state.configured) return Promise.reject(new Error('동기화가 설정되지 않았습니다'));
      setStatus('syncing');
      return api('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false,
        body: JSON.stringify({ email: email, password: password })
      }).then(function (s) {
        saveSession(s);
        return SYNC.sync();
      }).catch(function (e) {
        setStatus('signedout', e.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다' : e.message);
        throw e;
      });
    },

    signOut: function () {
      del(LS.session); del(LS.lastSync);
      state.email = null; state.lastSync = null;
      setStatus(state.configured ? 'signedout' : 'off');
      return Promise.resolve();
    },

    /* 원격에서 당겨와 로컬과 병합하고 다시 올린다 */
    sync: function () {
      if (!state.configured) return Promise.resolve(null);
      if (!SYNC.isSignedIn()) { setStatus('signedout'); return Promise.resolve(null); }
      setStatus('syncing');
      return ensureToken().then(function (s) {
        var uid = s.user && s.user.id;
        return api('/rest/v1/sync?select=data&user_id=eq.' + encodeURIComponent(uid)).then(function (rows) {
          var remote = (rows && rows[0] && rows[0].data) || null;
          var merged = merge(localPayload(), remote);
          applyPayload(merged);
          return api('/rest/v1/sync', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ user_id: uid, data: merged, updated_at: new Date().toISOString() })
          }).then(function () {
            state.lastSync = new Date().toISOString();
            wr(LS.lastSync, state.lastSync);
            state.pending = false;
            setStatus('idle');
            return merged;
          });
        });
      }).catch(function (e) {
        setStatus('error', e.message);
        throw e;
      });
    },

    /* 변경이 생겼을 때 호출 — 잠깐 모아서 한 번에 올린다 */
    touch: (function () {
      var t = null;
      return function () {
        if (!state.configured || !SYNC.isSignedIn()) return;
        state.pending = true; emit();
        clearTimeout(t);
        t = setTimeout(function () { SYNC.sync().catch(function () {}); }, 1500);
      };
    })(),

    /* ── 백업: 파일로 내보내기 / 가져오기 (동기화와 무관하게 항상 동작) ── */
    exportBlob: function () {
      var p = localPayload();
      p.exportedAt = new Date().toISOString();
      return new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    },
    exportName: function () {
      var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
      return '루앤루_진도_' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '.json';
    },
    importText: function (text) {
      var p = JSON.parse(text);
      if (!p || typeof p !== 'object') throw new Error('형식이 올바르지 않습니다');
      if (!p.course && !p.progress && !p.diary) throw new Error('루앤루 진도 파일이 아닙니다');
      var merged = merge(localPayload(), p);
      applyPayload(merged);
      SYNC.touch();
      return merged;
    },

    /* 진단용 요약 */
    summary: function () {
      var p = localPayload();
      var gates = 0;
      Object.keys(p.course).forEach(function (k) {
        (p.course[k].g || []).forEach(function (v) { if (v) gates++; });
      });
      return {
        gates: gates,
        modules: Object.keys(p.progress).filter(function (k) { return p.progress[k]; }).length,
        diary: p.diary.length
      };
    }
  };

  /* 초기 상태 */
  state.lastSync = rd(LS.lastSync, 'null');
  if (!state.configured) state.status = 'off';
  else if (SYNC.isSignedIn()) {
    var s0 = rd(LS.session, 'null');
    state.email = (s0 && s0.user && s0.user.email) || null;
    state.status = 'idle';
  } else state.status = 'signedout';

  window.LUANLU_SYNC = SYNC;

  /* 앱 로드 시 한 번 당겨온다 */
  if (state.configured && SYNC.isSignedIn()) {
    SYNC.sync().then(function () {
      if (window.LUANLU_RERENDER) window.LUANLU_RERENDER();
    }).catch(function () {});
  }
})();
