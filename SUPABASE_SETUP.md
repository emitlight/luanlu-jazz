# 기기 간 동기화 설정 (Supabase)

> 이걸 안 해도 앱은 완전히 동작합니다. 대신 진도가 **그 브라우저에만** 남습니다.
> 아래를 한 번 해두면 회사 PC·집 PC·노트북의 진도가 자동으로 합쳐집니다.
> 무료 티어로 충분합니다 (이 앱의 데이터는 다 합쳐도 수십 KB).

소요 시간 약 5분. **1~4는 직접 하셔야 하고**(계정 생성이라 대신 못 합니다), 5는 저에게 맡기시면 됩니다.

---

## 1. 프로젝트 만들기

1. https://supabase.com 접속 → **Start your project** → GitHub 계정으로 로그인
2. **New project**
   - Name: `luanlu` (아무거나)
   - Database Password: 아무거나 생성 후 **어딘가에 저장**(나중에 쓸 일은 거의 없습니다)
   - Region: `Northeast Asia (Seoul)` 권장
3. 생성까지 1~2분 기다립니다.

## 2. 테이블 만들기 (SQL 복사·붙여넣기)

왼쪽 메뉴 **SQL Editor** → **New query** → 아래를 통째로 붙여넣고 **Run**.

```sql
-- 진도·일지 저장 테이블 (사용자당 1행)
create table if not exists public.sync (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 행 수준 보안: 로그인한 본인 행 외에는 읽기·쓰기 전부 차단
alter table public.sync enable row level security;

drop policy if exists "own row select" on public.sync;
drop policy if exists "own row insert" on public.sync;
drop policy if exists "own row update" on public.sync;

create policy "own row select" on public.sync
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.sync
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.sync
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

> **이게 보안의 핵심입니다.** 뒤에서 공개 저장소에 올라가는 `anon key`는 공개되어도 되는 값이고,
> 실제 차단은 이 RLS가 합니다. 이 SQL을 실행하지 않으면 데이터가 무방비가 되니 반드시 실행하세요.

## 3. 내 계정 하나 만들기

왼쪽 메뉴 **Authentication** → **Users** → **Add user** → **Create new user**

- Email: 쓰실 이메일
- Password: 쓰실 비밀번호
- **Auto Confirm User 체크** ← 안 하면 메일 인증을 기다려야 합니다

이 이메일·비밀번호로 앱에서 로그인합니다. (혼자 쓰는 계정 하나면 충분합니다.)

## 4. 키 두 개 복사

왼쪽 메뉴 **Project Settings** → **API**

- **Project URL** — `https://xxxxxxxx.supabase.co`
- **anon / public** 키 — `eyJhbGciOi...` 로 시작하는 긴 문자열

> ⚠ **`service_role` 키는 절대 복사하지 마세요.** 그건 RLS를 무시하는 마스터 키입니다.
> 공개 저장소에 올라가면 데이터가 전부 노출됩니다. 필요한 건 **anon / public** 하나뿐입니다.

## 5. 앱에 넣기

`assets/config.js` 의 두 줄을 채우고 커밋·푸시하면 끝입니다.

```js
window.LUANLU_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...'
};
```

4번에서 복사한 값을 알려주시면 제가 넣고 배포까지 하겠습니다.

---

## 다 되면 쓰는 법

1. https://emitlight.github.io/luanlu-jazz/ → **나의 진도** → 맨 아래 **기기 간 동기화**
2. 3번에서 만든 이메일·비밀번호로 **로그인** (기기마다 한 번씩, 그 뒤로는 유지됩니다)
3. 이후 통과 기준을 체크하거나 일지를 쓰면 **자동 저장**됩니다
4. 다른 기기에서 같은 계정으로 로그인하면 **양쪽 기록이 합쳐집니다**

## 병합 규칙

기기 A와 B의 기록이 다르면 이렇게 합칩니다.

| 항목 | 규칙 |
|---|---|
| 통과 기준 · 모듈 완료 | **합집합** — 어느 기기에서든 체크했으면 체크된 것으로 |
| 연습일지 | id 기준 합침. 같은 기록을 양쪽에서 고쳤으면 **나중에 고친 쪽** |
| 삭제한 일지 | 삭제 목록을 따로 기록해 **되살아나지 않게** |

체크를 실수로 풀어도 다른 기기에 체크가 남아 있으면 다시 체크 상태로 돌아옵니다
(합집합 규칙이라 그렇습니다). 확실히 지우려면 두 기기 모두에서 풀어주세요.

## 동기화 없이 쓰기 (백업/이전)

설정을 안 해도 **나의 진도 → 기기 간 동기화**에 항상 있습니다.

- **⬇ 진도 내보내기** — `루앤루_진도_20260905.json` 파일로 저장
- **⬆ 가져오기** — 그 파일을 다른 기기에서 불러오면 위 병합 규칙대로 합쳐집니다

동기화를 켜둔 경우에도 가끔 내보내 두면 백업이 됩니다.
