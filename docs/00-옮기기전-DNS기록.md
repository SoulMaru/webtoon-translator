# 네임서버 옮기기 전 DNS 기록

2026-08-29 (토) 09:15 KST, 가비아 권한 네임서버(`ns.gabia.co.kr`)에서 직접 확인.
문제가 생겼을 때 되돌릴 기준으로 남겨 둡니다.

## 옮기기 전 네임서버

```
ns.gabia.co.kr
ns1.gabia.co.kr
ns.gabia.net
```

## 걸려 있던 기록 전부

| 이름 | 종류 | 값 | TTL |
|---|---|---|---|
| saegimai.com | A | 157.230.252.194 | 1800 |
| www.saegimai.com | A | 157.230.252.194 | 1800 |

그 밖에는 **없음** — AAAA·MX·TXT·CAA·SRV 모두 비어 있었습니다.

## 확인한 것

- **메일 기록(MX)이 없습니다.** 이 도메인으로 주고받는 메일이 없으므로,
  네임서버를 옮겨도 끊길 메일이 없습니다.
- `157.230.252.194` 는 nginx가 **403 Forbidden** 을 돌려주고 있었습니다.
  내용이 걸려 있지 않은 빈 서버로 보입니다.
- 위 A 기록 두 줄은 어차피 Vercel 값으로 바꿀 것들입니다.

## 되돌리려면

가비아 네임서버 설정에서 위 세 줄을 다시 넣으면 원래대로 돌아갑니다.

---

## 옮긴 뒤 (2026-08-29 09:2x KST)

Cloudflare가 `saegimai.com` 에 배정한 네임서버:

```
ignat.ns.cloudflare.com
rihana.ns.cloudflare.com
```

요금제는 **Free (US$0)**. 계정 `Okmceo@gmail.com` 에는 등록된 결제 수단이 없습니다.

### Cloudflare가 가져간 기록

| 이름 | 종류 | 값 | 프록시 |
|---|---|---|---|
| saegimai.com | A | 157.230.252.194 | 꺼짐 (DNS 전용) |
| www | A | 157.230.252.194 | 꺼짐 (DNS 전용) |
| app | CNAME | ad312216a07c7e98.vercel-dns-017.com | 꺼짐 (DNS 전용) |

### 사전 조사에서 놓쳤던 것

`app.saegimai.com` 이 **Vercel로 향하는 CNAME** 이었습니다.
지난번 중단된 작업의 흔적으로 보이며, 지금은 `DEPLOYMENT_NOT_FOUND` 를 돌려줍니다.
지우지 않고 그대로 두었습니다. Vercel 설정을 마친 뒤에 정리하면 됩니다.

> 프록시는 셋 다 꺼야 합니다. Vercel 앞에 Cloudflare 프록시를 켜면 인증서가 서로 물립니다.

---

## 이전 완료 (2026-08-29 토 09:35 KST)

가비아 네임서버 변경 → 이메일 소유자 인증 → 적용. **설정 완료** 확인.

### 확인한 것

| 확인 항목 | 결과 |
|---|---|
| 구글 공개 DNS(8.8.8.8)가 보는 네임서버 | `ignat.ns.cloudflare.com` · `rihana.ns.cloudflare.com` |
| Cloudflare 존 상태 | 활성 ("이제 도메인이 Cloudflare로 보호됩니다") |
| A `saegimai.com` | 157.230.252.194 (그대로) |
| A `www` | 157.230.252.194 (그대로) |
| CNAME `app` | ad312216a07c7e98.vercel-dns-017.com (그대로) |
| 프록시 상태 | 셋 다 **DNS 전용** |
| `http://saegimai.com` 응답 | 403 — **이전과 동일** |

끊긴 순간 없이 넘어갔습니다.

### 걸렸던 것

Cloudflare 온보딩 화면(레코드 검토)에서 끈 프록시 토글이 **저장되지 않았습니다.**
활성화 뒤 실제 DNS 레코드 화면에서 세 줄을 하나씩 `편집` → 토글 → `저장` 해야 반영됐습니다.
나중에 레코드를 추가할 때도 온보딩 화면 토글은 믿지 말고 레코드 화면에서 확인해야 합니다.

### 다음에 할 일

1. Cloudflare Tunnel 연결 → `api.saegimai.com` ([02-터널-연결.md](02-터널-연결.md))
2. GitHub 저장소 + Vercel ([03-깃허브-버셀.md](03-깃허브-버셀.md))
3. Vercel 도메인 연결 시 A/CNAME 값을 Vercel이 주는 것으로 교체
   (지금 걸린 `157.230.252.194` 두 줄이 그때 바뀝니다)
4. 남은 `app` CNAME 정리 여부 결정
