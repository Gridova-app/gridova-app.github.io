// build-i18n.mjs
// 하나의 소스(index.template.html)에서 언어별 정적 SEO 페이지를 생성한다.
// - 각 언어 텍스트를 HTML에 "구워 넣어" 크롤러가 즉시 읽게 함 (JS 주입 X)
// - 언어별 <title>/<meta description>/<html lang>/og:locale/canonical 지역화
// - hreflang 상호연결 + x-default
// - sitemap.xml 재생성
//
// 문구를 바꾸려면 index.template.html 만 수정하고 다시 실행:  node build-i18n.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://gridova-app.github.io';

// 1) 템플릿 확보 (최초 1회: 현재 index.html 을 소스로 스냅샷)
const TEMPLATE_PATH = join(ROOT, 'index.template.html');
if (!existsSync(TEMPLATE_PATH)) {
  copyFileSync(join(ROOT, 'index.html'), TEMPLATE_PATH);
  console.log('· 부트스트랩: index.html → index.template.html (앞으로 이 파일을 편집)');
}
const tpl = readFileSync(TEMPLATE_PATH, 'utf8');

// 2) 템플릿에서 I18N 사전 추출
const m = tpl.match(/const I18N = (\{[\s\S]*?\})\s*;\s*\n\s*function setLang/);
if (!m) throw new Error('I18N 사전을 템플릿에서 찾지 못함');
const I18N = eval('(' + m[1] + ')');

// 3) 언어 메타 (dir='' 은 루트=영어, x-default)
const LANGS = [
  { code: 'en', dir: '',   locale: 'en_US', name: 'English' },
  { code: 'ko', dir: 'ko', locale: 'ko_KR', name: '한국어' },
  { code: 'ja', dir: 'ja', locale: 'ja_JP', name: '日本語' },
  { code: 'de', dir: 'de', locale: 'de_DE', name: 'Deutsch' },
  { code: 'fr', dir: 'fr', locale: 'fr_FR', name: 'Français' },
  { code: 'es', dir: 'es', locale: 'es_ES', name: 'Español' },
  { code: 'pt', dir: 'pt', locale: 'pt_BR', name: 'Português' },
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');
const urlOf = dir => BASE + '/' + (dir ? dir + '/' : '');

// 모든 페이지 <head>에 넣을 hreflang 블록
function hreflangBlock() {
  const rows = LANGS.map(l => `<link rel="alternate" hreflang="${l.code}" href="${urlOf(l.dir)}" />`);
  rows.push(`<link rel="alternate" hreflang="x-default" href="${urlOf('')}" />`);
  return rows.join('\n');
}

function buildPage(L) {
  const dict = I18N[L.code] || I18N.en;
  const pageUrl = urlOf(L.dir);
  // 소셜(OG/Twitter)엔 감성 히어로 문구, 검색(<title>/description)엔 키워드 버전.
  //  seo_title/seo_desc 가 사전에 있으면 그걸, 없으면 히어로로 폴백.
  const socialTitle = 'Gridova — ' + dict.hero_h1;
  const metaTitle = 'Gridova — ' + (dict.seo_title || dict.hero_h1);
  const socialDesc = dict.hero_sub;
  const metaDesc = dict.seo_desc || dict.hero_sub;
  const ogImage = `${BASE}/images/${L.code}/03-home.png`;
  let h = tpl;

  // (a) 본문 텍스트 굽기: data-i18n 요소 내용을 번역으로 치환
  for (const [k, v] of Object.entries(dict)) {
    const re = new RegExp('data-i18n="' + k + '"([^>]*)>([\\s\\S]*?)</', 'g');
    h = h.replace(re, (_mm, attrs) => 'data-i18n="' + k + '"' + attrs + '>' + esc(v) + '</');
  }

  // (b) 스크린샷 경로를 해당 언어로 (없으면 영어로 폴백)
  h = h.replace(/src="images\/en\/([^"]+)"/g,
    (_mm, file) => `src="/images/${L.code}/${file}" onerror="this.onerror=null;this.src='/images/en/${file}'"`);

  // (c) <html lang>
  h = h.replace('<html lang="en">', `<html lang="${L.code}">`);

  // (d) <head> SEO 지역화
  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(metaTitle)}</title>`);
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, (_m, a, b) => a + escAttr(metaDesc) + b);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, (_m, a, b) => a + pageUrl + b);
  h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, (_m, a, b) => a + escAttr(socialTitle) + b);
  h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, (_m, a, b) => a + escAttr(socialDesc) + b);
  h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, (_m, a, b) => a + pageUrl + b);
  h = h.replace(/(<meta property="og:image" content=")[^"]*(")/, (_m, a, b) => a + ogImage + b);
  h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/, (_m, a, b) => a + escAttr(socialTitle) + b);
  h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/, (_m, a, b) => a + escAttr(socialDesc) + b);
  h = h.replace(/(<meta name="twitter:image" content=")[^"]*(")/, (_m, a, b) => a + ogImage + b);

  // og:locale 블록 재구성 (현재 언어 + 나머지 alternate)
  const ogLocale = `<meta property="og:locale" content="${L.locale}" />\n` +
    LANGS.filter(x => x.code !== L.code)
      .map(x => `<meta property="og:locale:alternate" content="${x.locale}" />`).join('\n');
  h = h.replace(/<meta property="og:locale" content="[^"]*" \/>[\s\S]*?<meta property="og:locale:alternate" content="pt_BR" \/>/, ogLocale);

  // JSON-LD url 지역화
  h = h.replace(/"url": "https:\/\/gridova-app\.github\.io\/"/, `"url": "${pageUrl}"`);

  // (e) canonical 뒤에 hreflang 삽입
  h = h.replace(`<link rel="canonical" href="${pageUrl}" />`,
    `<link rel="canonical" href="${pageUrl}" />\n${hreflangBlock()}`);

  // (f) 언어 스위처: 텍스트 교체가 아니라 해당 언어 URL로 이동
  const options = LANGS.map(x =>
    `<option value="${urlOf(x.dir)}"${x.code === L.code ? ' selected' : ''}>${x.name}</option>`).join('\n        ');
  const newSelect =
    `<select id="lang" aria-label="Language" onchange="if(this.value)location.href=this.value;">\n        ${options}\n      </select>`;
  h = h.replace(/<select id="lang"[\s\S]*?<\/select>/, newSelect);

  // (g) 내부 링크를 루트 절대경로로 (하위폴더 페이지에서도 안 깨지게)
  h = h.replace(/href="demos\.html"/g, 'href="/demos.html"');

  // (h) 런타임 i18n 스크립트 제거 (이제 정적이라 불필요)
  h = h.replace(/<script>\s*const I18N[\s\S]*?<\/script>/, '');

  return h;
}

// 4) 페이지 출력
for (const L of LANGS) {
  const outDir = L.dir ? join(ROOT, L.dir) : ROOT;
  if (L.dir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), buildPage(L), 'utf8');
  console.log(`· 생성: /${L.dir ? L.dir + '/' : ''}index.html  (${L.code})`);
}

// 5) sitemap.xml (언어별 URL + hreflang)
const sitemap =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(L => `  <url>
    <loc>${urlOf(L.dir)}</loc>
${LANGS.map(x => `    <xhtml:link rel="alternate" hreflang="${x.code}" href="${urlOf(x.dir)}" />`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf('')}" />
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
console.log('· 생성: sitemap.xml');
console.log('완료.');
