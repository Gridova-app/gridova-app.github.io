# 랜딩 사이트 다국어(i18n) 정적 페이지 빌드 — 작업 정리

작성: 2026-07-09 (Windows Claude 작업분 정리)

## 무엇을 바꿨나 (한 줄)

원래 **`index.html` 1개**(자바스크립트로 언어 전환)였던 랜딩 사이트를 **언어별 정적 SEO 페이지 7개**로 나눴다.

## 왜 (배경)

- 기존 방식: 페이지는 하나였고, JS(`I18N` 사전 + `setLang`)가 런타임에 텍스트를 갈아끼웠다.
- 문제: **검색 크롤러는 JS로 주입한 텍스트를 제대로 못 읽는다** → 영어 외 언어는 사실상 색인이 안 됨(SEO 손해).
- 해결: 각 언어 문구를 **HTML에 미리 "구워 넣어"**(정적) 크롤러가 즉시 읽게 하고, 언어별 `<title>`/`description`/`hreflang` 등 메타를 지역화.

## 결과 구조

```
landing-site/
├─ index.template.html   ← 편집용 원본(소스). 문구/구조는 여기서만 고친다.
├─ build-i18n.mjs        ← 빌더. 템플릿 → 언어별 index.html 7개 + sitemap.xml 생성.
├─ index.html            ← 생성물: 영어(루트 = x-default)
├─ ko/index.html         ← 생성물: 한국어
├─ ja/index.html         ← 일본어
├─ de/index.html         ← 독일어
├─ fr/index.html         ← 프랑스어
├─ es/index.html         ← 스페인어
├─ pt/index.html         ← 포르투갈어(pt_BR)
├─ sitemap.xml           ← 생성물: 7개 언어 URL + hreflang 상호연결
└─ robots.txt            ← Sitemap 위치 지정
```

- **루트(`/index.html`)가 영어 = `x-default`**, 나머지는 하위 폴더(`/ko/`, `/ja/` …).
- 언어 코드/로케일: `en(en_US)·ko(ko_KR)·ja(ja_JP)·de(de_DE)·fr(fr_FR)·es(es_ES)·pt(pt_BR)`.

## 빌더(`build-i18n.mjs`)가 하는 일

`index.template.html` 안의 `const I18N = {…}` 사전을 파싱한 뒤, 언어마다 아래를 적용해 페이지를 굽는다.

| 단계 | 처리 |
|---|---|
| (a) 본문 텍스트 | `data-i18n="키"` 요소의 내용을 해당 언어 번역으로 치환(정적) |
| (b) 스크린샷 | `images/en/…` → `images/<lang>/…`, 없으면 `onerror`로 영어 폴백 |
| (c) 언어 속성 | `<html lang="…">` 지역화 |
| (d) head SEO | `<title>`·`description`·`canonical`·OG·Twitter 메타 지역화 |
| (e) hreflang | canonical 뒤에 7개 언어 + `x-default` 상호연결 링크 삽입 |
| (f) og:locale | 현재 언어 + 나머지 `alternate` 재구성 |
| (g) JSON-LD | 구조화 데이터 `url` 지역화 |
| (h) 언어 스위처 | 텍스트 교체가 아니라 **해당 언어 URL로 이동**하는 `<select>`로 교체 |
| (i) 내부 링크 | `demos.html` → `/demos.html`(루트 절대경로, 하위폴더에서도 안 깨지게) |
| (j) 런타임 스크립트 | 이제 정적이라 불필요 → 페이지에서 `const I18N…` 스크립트 **제거** |

또한 **`sitemap.xml`을 매번 재생성**(7개 언어 `<loc>` + 각 hreflang + `x-default`).

> 최초 실행 시 `index.template.html`이 없으면 현재 `index.html`을 복사해 템플릿으로 부트스트랩한다(그 이후로는 템플릿만 편집).

## 앞으로의 워크플로우 (중요)

- 문구·구조를 바꾸려면 **`index.template.html` 만 수정**한다. 생성된 `index.html`/`<lang>/index.html`은 직접 손대지 말 것(다음 빌드에서 덮어써짐).
- 다시 굽기:
  ```
  cd landing-site
  node build-i18n.mjs
  ```
- 실행하면 7개 `index.html` + `sitemap.xml`이 다시 생성된다.

## 배포

- 호스팅: **GitHub Pages** — `https://gridova-app.github.io/`(영어), `.../ko/`, `.../ja/` …
- `robots.txt`가 `sitemap.xml` 위치를 알려주고, sitemap의 hreflang이 검색엔진에 언어 대응을 알림.

## 참고: privacy-site 는 별개 (i18n 빌드 대상 아님)

- `../privacy-site/index.html` 은 **한 파일에 7개 언어**가 다 들어있고 상단 언어 버튼으로 앵커 점프하는 방식(예: `#ja`, `#de`).
- 이 빌더와 무관하며, MS Store 개인정보처리방침 URL로는 7개 언어 전부 이 한 URL을 넣어도 통과(앵커로 특정 언어 직행 가능). 자세한 배포법은 `../privacy-site/README.md`.
