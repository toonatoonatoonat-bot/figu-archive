import { NextRequest, NextResponse } from "next/server";

export type KujiBrandName =
  | "이치방쿠지"
  | "세가 럭키 쿠지"
  | "모두의 쿠지"
  | "아타리 쿠지"
  | "타이토 쿠지"
  | "해피쿠지"
  | "애니쿠지";

export interface KujiLiveProduct {
  slug: string;
  kujiBrand: KujiBrandName;
  maker: string;
  title: string;
  series: string;
  releaseDate: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
  isUpcoming: boolean;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const KO_TO_JP_SERIES: [RegExp, string][] = [
  [/봇치더락|봇치\s*더\s*록|봇치/gi, "ぼっち・ざ・ろっく"],
  [/에반게리온|에바/gi, "エヴァンゲリオン"],
  [/드래곤볼/gi, "ドラゴンボール"],
  [/원피스/gi, "ワンピース"],
  [/귀멸의\s*칼날|귀멸/gi, "鬼滅の刃"],
  [/주술회전/gi, "呪術廻戦"],
  [/체인소맨/gi, "チェンソーマン"],
  [/나의\s*히어로\s*아카데미아|나히아|히로아카/gi, "僕のヒーローアカデミア"],
  [/나루토/gi, "NARUTO"],
  [/블리치/gi, "BLEACH"],
  [/헌터헌터|헌터x헌터/gi, "HUNTER×HUNTER"],
  [/죠죠/gi, "ジョジョ"],
  [/블루\s*아카이브|블루아카/gi, "ブルーアーカイブ"],
  [/원신/gi, "原神"],
  [/건담/gi, "ガンダム"],
  [/포켓몬/gi, "ポケモン"],
  [/치이카와|먼작귀/gi, "ちいかわ"],
  [/커비/gi, "カービィ"],
  [/산리오/gi, "サンリオ"],
  [/원펀맨/gi, "ワンパンマン"],
  [/진격의\s*거인/gi, "進撃の巨人"],
  [/하이큐/gi, "ハイキュー"],
  [/프리렌/gi, "フリーレン"],
  [/코난/gi, "コナン"],
  [/세일러문/gi, "セーラームーン"],
  [/하츠네\s*미쿠|미쿠/gi, "初音ミク"],
  [/이치방쿠지|제일복권|세가\s*럭키\s*쿠지|모두의\s*쿠지|아타리\s*쿠지|타이토\s*쿠지|해피쿠지|애니쿠지/gi, ""],
];

function toJapaneseQuery(raw: string): string {
  let q = raw.trim();
  for (const [pattern, jp] of KO_TO_JP_SERIES) {
    q = q.replace(pattern, jp);
  }
  return q.replace(/\s+/g, " ").trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'").replace(/&#x2F;/gi, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function guessKoreanSeries(title: string, defaultSeries = "쿠지 라인업"): string {
  const map: [RegExp, string][] = [
    [/エヴァンゲリオン|evangelion/i, "신세기 에반게리온"],
    [/ドラゴンボール|dragon\s*ball/i, "드래곤볼"],
    [/ワンピース|one\s*piece/i, "원피스"],
    [/鬼滅の刃|demon\s*slayer/i, "귀멸의 칼날"],
    [/呪術廻戦|jujutsu/i, "주술회전"],
    [/チェンソーマン|chainsaw/i, "체인소맨"],
    [/僕のヒーローアカデミア|ヒロアカ/i, "나의 히어로 아카데미아"],
    [/NARUTO|ナルト/i, "나루토"],
    [/BLEACH|ブリーチ/i, "블리치"],
    [/HUNTER×HUNTER|ハンター/i, "헌터×헌터"],
    [/ジョジョ/i, "죠죠의 기묘한 모험"],
    [/ぼっち・ざ・ろっく/i, "봇치 더 록!"],
    [/ブルーアーカイブ/i, "블루 아카이브"],
    [/原神/i, "원신"],
    [/ガンダム/i, "기동전사 건담"],
    [/ポケモン|ポケットモンスター/i, "포켓몬스터"],
    [/ちいかわ/i, "치이카와"],
    [/カービィ/i, "별의 커비"],
    [/サンリオ|ハローキティ|シナモロール|クロミ|マイメロディ|ポムポムプリン|ハンギョドン|ポチャッコ/i, "산리오 캐릭터즈"],
    [/ワンパンマン/i, "원펀맨"],
    [/進撃の巨人/i, "진격의 거인"],
    [/ハイキュー/i, "하이큐!!"],
    [/フリーレン/i, "장송의 프리렌"],
    [/コナン/i, "명탐정 코난"],
    [/初音ミク|ミク/i, "하츠네 미쿠"],
    [/マーベル|MARVEL|スパイダーマン/i, "마블 코믹스"],
    [/プロセカ|プロジェクトセカイ/i, "프로젝트 세카이"],
    [/ダンガンロンパ/i, "단간론파"],
    [/刀剣乱舞/i, "도검난무"],
    [/あんさんぶるスターズ|あんスタ/i, "앙상블 스타즈!!"],
    [/ハイキュー/i, "하이큐!!"],
    [/龍が如く/i, "용과 같이"],
    [/ペルソナ/i, "페르소나"],
    [/ソニック/i, "소닉 더 헤지혹"],
  ];

  for (const [pattern, ko] of map) {
    if (pattern.test(title)) return ko;
  }
  return defaultSeries;
}

function getDateSortScore(releaseDate: string): number {
  const m = releaseDate.match(/(20\d{2})[.\-/년\s]*(\d{1,2})(?:[.\-/월\s]*(\d{1,2}))?/);
  if (!m) return 0;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = m[3] ? Number(m[3]) : 15;
  return year * 10000 + month * 100 + day;
}

function extractDateString(rawText: string, fallbackDate: string): string {
  const fullDateMatch = rawText.match(/(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})/);
  const monthOnlyMatch = rawText.match(/(20\d{2})[年./-](\d{1,2})/);
  if (fullDateMatch) {
    return `${fullDateMatch[1]}.${fullDateMatch[2].padStart(2, "0")}.${fullDateMatch[3].padStart(2, "0")}`;
  }
  if (monthOnlyMatch) {
    return `${monthOnlyMatch[1]}.${monthOnlyMatch[2].padStart(2, "0")} 발매`;
  }
  return fallbackDate;
}

function parse1kujiHtml(html: string, fallbackDate = "이전 회차"): KujiLiveProduct[] {
  const results: KujiLiveProduct[] = [];
  const seenSlugs = new Set<string>();
  const linkRegex = /<a[^>]+href=["'](\/products\/([a-zA-Z0-9_-]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const slug = `1kuji-${match[2]}`;
    const inner = match[3];
    if (!match[2] || match[2] === "products" || seenSlugs.has(slug)) continue;

    const imgMatch = inner.match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i);
    const altMatch = inner.match(/alt=["']([^"']+)["']/i);
    const rawText = stripHtml(inner);
    const titleCandidate = (altMatch?.[1] || rawText || "").trim();
    if (!titleCandidate || titleCandidate.length < 4) continue;

    let imageUrl = "";
    if (imgMatch?.[1]) {
      try {
        imageUrl = new URL(imgMatch[1].replace(/&amp;/g, "&"), "https://1kuji.com").toString();
      } catch {}
    }

    const formattedDate = extractDateString(rawText, fallbackDate);
    const priceMatch = rawText.match(/1回\s*([0-9,]+円)/);
    const sortScore = getDateSortScore(formattedDate);
    const isUpcoming = sortScore >= 20261122 || /予定/.test(formattedDate);

    seenSlugs.add(slug);
    results.push({
      slug,
      kujiBrand: "이치방쿠지",
      maker: "반다이 스피리츠 (BANDAI SPIRITS)",
      title: titleCandidate,
      series: guessKoreanSeries(titleCandidate, "이치방쿠지 라인업"),
      releaseDate: formattedDate,
      price: priceMatch ? `1회 ${priceMatch[1]}` : "이치방쿠지",
      imageUrl,
      sourceUrl: `https://1kuji.com${path}`,
      isUpcoming,
    });
  }
  return results;
}

function parseGenericBrandHtml(
  html: string,
  config: {
    baseUrl: string;
    linkPattern: RegExp;
    slugPrefix: string;
    kujiBrand: KujiBrandName;
    maker: string;
    defaultSeries: string;
    titleKeywordFilter?: RegExp;
  }
): KujiLiveProduct[] {
  const results: KujiLiveProduct[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = config.linkPattern.exec(html)) !== null) {
    const rawHref = match[1];
    const idToken = (match[2] || match[3] || rawHref).replace(/[^a-zA-Z0-9_-]/g, "").slice(-28);
    const slug = `${config.slugPrefix}-${idToken}`;
    if (!idToken || seen.has(slug)) continue;

    const anchorInner = match[match.length - 1] || "";
    const startCtx = Math.max(0, match.index - 260);
    const endCtx = Math.min(html.length, match.index + match[0].length + 360);
    const contextBlock = html.slice(startCtx, endCtx);

    const imgMatch =
      anchorInner.match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i) ||
      contextBlock.match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i);
    const altMatch = anchorInner.match(/alt=["']([^"']+)["']/i);
    const rawText = stripHtml(anchorInner) || stripHtml(contextBlock);
    const titleCandidate = (altMatch?.[1] || stripHtml(anchorInner) || "").trim();

    if (!titleCandidate || titleCandidate.length < 4) continue;
    if (config.titleKeywordFilter && !config.titleKeywordFilter.test(`${titleCandidate} ${rawText}`)) {
      continue;
    }

    let sourceUrl = "";
    let imageUrl = "";
    try {
      sourceUrl = new URL(rawHref.replace(/&amp;/g, "&"), config.baseUrl).toString();
      if (imgMatch?.[1] && !imgMatch[1].startsWith("data:")) {
        imageUrl = new URL(imgMatch[1].replace(/&amp;/g, "&"), config.baseUrl).toString();
      }
    } catch {
      continue;
    }

    const formattedDate = extractDateString(rawText, "최신 라인업");
    const priceMatch = rawText.match(/1回\s*([0-9,]+円)/);
    const sortScore = getDateSortScore(formattedDate);
    const isUpcoming = sortScore === 0 || sortScore >= 20261122 || /予定/.test(formattedDate);

    seen.add(slug);
    results.push({
      slug,
      kujiBrand: config.kujiBrand,
      maker: config.maker,
      title: titleCandidate,
      series: guessKoreanSeries(titleCandidate, config.defaultSeries),
      releaseDate: formattedDate,
      price: priceMatch ? `1회 ${priceMatch[1]}` : config.kujiBrand,
      imageUrl,
      sourceUrl,
      isUpcoming,
    });
  }

  return results;
}

// PR TIMES 일본 공식 보도자료 검색 API/HTML을 통한 5대 브랜드 공식 출시 발표 수집 (봇 차단 없음)
async function searchBrandViaPrTimes(
  keyword: string,
  config: {
    slugPrefix: string;
    kujiBrand: KujiBrandName;
    maker: string;
    defaultSeries: string;
    mustMatchTitle: RegExp;
  }
): Promise<KujiLiveProduct[]> {
  try {
    const url = `https://prtimes.jp/main/action.php?run=html&page=searchkey&search_word=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const results: KujiLiveProduct[] = [];
    const seen = new Set<string>();
    const articleRegex = /<a[^>]+href=["'](\/main\/html\/rd\/p\/([0-9.]+)\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;

    while ((m = articleRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = `${config.slugPrefix}-pr-${m[2].replace(/\./g, "_")}`;
      if (seen.has(slug)) continue;

      const inner = m[3];
      const startCtx = Math.max(0, m.index - 250);
      const endCtx = Math.min(html.length, m.index + m[0].length + 450);
      const ctx = html.slice(startCtx, endCtx);

      const title = stripHtml(inner)
        .replace(/^【[^】]+】/, "")
        .trim();
      if (!title || title.length < 6) continue;
      if (!config.mustMatchTitle.test(title)) continue;

      const imgMatch =
        inner.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i) ||
        ctx.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
      let imageUrl = "";
      if (imgMatch?.[1] && !imgMatch[1].startsWith("data:")) {
        try {
          imageUrl = new URL(imgMatch[1].replace(/&amp;/g, "&"), "https://prtimes.jp").toString();
        } catch {}
      }

      const dateStr = extractDateString(stripHtml(ctx), "공식 발표");
      const priceMatch = stripHtml(ctx).match(/1回\s*([0-9,]+円)/);

      seen.add(slug);
      results.push({
        slug,
        kujiBrand: config.kujiBrand,
        maker: config.maker,
        title,
        series: guessKoreanSeries(title, config.defaultSeries),
        releaseDate: dateStr,
        price: priceMatch ? `1회 ${priceMatch[1]}` : config.kujiBrand,
        imageUrl,
        sourceUrl: `https://prtimes.jp${path}`,
        isUpcoming: true,
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function hydrateMissingThumbnails(items: KujiLiveProduct[]): Promise<KujiLiveProduct[]> {
  const targets = items.filter((it) => !it.imageUrl && it.sourceUrl).slice(0, 24);
  if (targets.length === 0) return items;

  const urlToImg = new Map<string, string>();
  await Promise.allSettled(
    targets.map(async (item) => {
      try {
        const res = await fetch(item.sourceUrl, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) return;
        const html = await res.text();
        const ogMatch =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogMatch?.[1]) {
          const abs = new URL(ogMatch[1].replace(/&amp;/g, "&"), item.sourceUrl).toString();
          if (abs.startsWith("http")) urlToImg.set(item.sourceUrl, abs);
        }
      } catch {}
    })
  );

  return items.map((it) =>
    !it.imageUrl && urlToImg.has(it.sourceUrl)
      ? { ...it, imageUrl: urlToImg.get(it.sourceUrl)! }
      : it
  );
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("q")?.trim() || "";
  const brandFilter = request.nextUrl.searchParams.get("brand")?.trim() || "전체";
  const jpQuery = toJapaneseQuery(rawQuery);

  try {
    const fetchTasks: Promise<KujiLiveProduct[]>[] = [];

    const fetchText = async (url: string, referer: string) => {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
          Referer: referer,
        },
        signal: AbortSignal.timeout(6500),
      });
      return res.ok ? await res.text() : "";
    };

    // 1. 이치방쿠지 (1kuji.com)
    if (brandFilter === "전체" || brandFilter === "이치방쿠지") {
      const urls = jpQuery
        ? [
            { url: `https://1kuji.com/search?word=${encodeURIComponent(jpQuery)}&page=1`, fb: "최신 회차" },
            { url: `https://1kuji.com/search?word=${encodeURIComponent(jpQuery)}&page=2`, fb: "이전 회차" },
          ]
        : [
            { url: "https://1kuji.com/products?sale_year=2027&sale_month=2", fb: "2027.02 예정" },
            { url: "https://1kuji.com/products?sale_year=2027&sale_month=1", fb: "2027.01 예정" },
            { url: "https://1kuji.com/products?sale_year=2026&sale_month=12", fb: "2026.12 예정" },
            { url: "https://1kuji.com/products?sale_year=2026&sale_month=11", fb: "2026.11 발매" },
          ];

      for (const u of urls) {
        fetchTasks.push(
          fetchText(u.url, "https://1kuji.com/")
            .then((html) => parse1kujiHtml(html, u.fb))
            .catch(() => [])
        );
      }
    }

    // 2. 세가 럭키 쿠지 (segaplaza.jp + PR TIMES 공식 보도자료)
    if (brandFilter === "전체" || brandFilter === "세가 럭키 쿠지") {
      fetchTasks.push(
        fetchText("https://segaplaza.jp/lp/lottery/", "https://segaplaza.jp/")
          .then((html) =>
            parseGenericBrandHtml(html, {
              baseUrl: "https://segaplaza.jp",
              linkPattern: /<a[^>]+href=["'](\/(?:lp|prize|channel)\/[^"']*?([a-zA-Z0-9_-]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
              slugPrefix: "sega",
              kujiBrand: "세가 럭키 쿠지",
              maker: "SEGA (세가)",
              defaultSeries: "세가 럭키 쿠지 라인업",
              titleKeywordFilter: /ラッキーくじ|くじ/,
            })
          )
          .catch(() => [])
      );
      fetchTasks.push(
        searchBrandViaPrTimes(`セガ ラッキーくじ ${jpQuery}`.trim(), {
          slugPrefix: "sega",
          kujiBrand: "세가 럭키 쿠지",
          maker: "SEGA (세가)",
          defaultSeries: "세가 럭키 쿠지 라인업",
          mustMatchTitle: /ラッキーくじ/,
        })
      );
    }

    // 3. 모두의 쿠지 (charahiroba.com + PR TIMES 공식 보도자료)
    if (brandFilter === "전체" || brandFilter === "모두의 쿠지") {
      fetchTasks.push(
        fetchText("https://charahiroba.com/minkuji/", "https://charahiroba.com/")
          .then((html) =>
            parseGenericBrandHtml(html, {
              baseUrl: "https://charahiroba.com",
              linkPattern: /<a[^>]+href=["'](\/minkuji\/[^"']+?([a-zA-Z0-9_-]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
              slugPrefix: "minkuji",
              kujiBrand: "모두의 쿠지",
              maker: "FuRyu (후류)",
              defaultSeries: "모두의 쿠지 라인업",
            })
          )
          .catch(() => [])
      );
      fetchTasks.push(
        searchBrandViaPrTimes(`みんなのくじ フリュー ${jpQuery}`.trim(), {
          slugPrefix: "minkuji",
          kujiBrand: "모두의 쿠지",
          maker: "FuRyu (후류)",
          defaultSeries: "모두의 쿠지 라인업",
          mustMatchTitle: /みんなのくじ/,
        })
      );
    }

    // 4. 타이토 쿠지 (taito.co.jp + PR TIMES 공식 보도자료)
    if (brandFilter === "전체" || brandFilter === "타이토 쿠지") {
      fetchTasks.push(
        fetchText("https://www.taito.co.jp/taitokuji", "https://www.taito.co.jp/")
          .then((html) =>
            parseGenericBrandHtml(html, {
              baseUrl: "https://www.taito.co.jp",
              linkPattern: /<a[^>]+href=["'](\/taitokuji\/item\/([a-zA-Z0-9_-]+))["'][^>]*>([\s\S]*?)<\/a>/gi,
              slugPrefix: "taito",
              kujiBrand: "타이토 쿠지",
              maker: "TAITO (타이토)",
              defaultSeries: "타이토 쿠지 라인업",
            })
          )
          .catch(() => [])
      );
      fetchTasks.push(
        searchBrandViaPrTimes(`タイトーくじ ${jpQuery}`.trim(), {
          slugPrefix: "taito",
          kujiBrand: "타이토 쿠지",
          maker: "TAITO (타이토)",
          defaultSeries: "타이토 쿠지 라인업",
          mustMatchTitle: /タイトーくじ/,
        })
      );
    }

    // 5. 해피쿠지 (h-kuji.com + PR TIMES 공식 보도자료)
    if (brandFilter === "전체" || brandFilter === "해피쿠지") {
      fetchTasks.push(
        fetchText("https://www.h-kuji.com/goods/", "https://www.h-kuji.com/")
          .then((html) =>
            parseGenericBrandHtml(html, {
              baseUrl: "https://www.h-kuji.com",
              linkPattern: /<a[^>]+href=["'](https?:\/\/www\.h-kuji\.com\/goods\/([a-zA-Z0-9_-]+)\/?|\/goods\/([a-zA-Z0-9_-]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
              slugPrefix: "happykuji",
              kujiBrand: "해피쿠지",
              maker: "Sunny Side Up (써니사이드업)",
              defaultSeries: "해피쿠지 라인업",
            })
          )
          .catch(() => [])
      );
      fetchTasks.push(
        searchBrandViaPrTimes(`Happyくじ ${jpQuery}`.trim(), {
          slugPrefix: "happykuji",
          kujiBrand: "해피쿠지",
          maker: "Sunny Side Up (써니사이드업)",
          defaultSeries: "해피쿠지 라인업",
          mustMatchTitle: /Happyくじ/i,
        })
      );
    }

    // 6. 아타리 쿠지 (sanrio.co.jp + PR TIMES 공식 보도자료)
    if (brandFilter === "전체" || brandFilter === "아타리 쿠지") {
      fetchTasks.push(
        fetchText("https://www.sanrio.co.jp/news/?category=atarikuji", "https://www.sanrio.co.jp/")
          .then((html) =>
            parseGenericBrandHtml(html, {
              baseUrl: "https://www.sanrio.co.jp",
              linkPattern: /<a[^>]+href=["'](\/news\/[^"']*?([a-zA-Z0-9_-]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
              slugPrefix: "sanrio",
              kujiBrand: "아타리 쿠지",
              maker: "Sanrio (산리오)",
              defaultSeries: "산리오 캐릭터즈",
              titleKeywordFilter: /当た?りくじ/,
            })
          )
          .catch(() => [])
      );
      fetchTasks.push(
        searchBrandViaPrTimes(`当りくじ ${jpQuery}`.trim(), {
          slugPrefix: "sanrio",
          kujiBrand: "아타리 쿠지",
          maker: "Sanrio (산리오)",
          defaultSeries: "산리오 캐릭터즈",
          mustMatchTitle: /当た?りくじ/,
        })
      );
    }

    // 7. 애니쿠지 (animate-onlineshop.jp + PR TIMES 공식 보도자료)
    if (brandFilter === "전체" || brandFilter === "애니쿠지") {
      fetchTasks.push(
        fetchText(
          `https://www.animate-onlineshop.jp/products/list.php?mode=search&smt=${encodeURIComponent(`アニくじ ${jpQuery}`.trim())}`,
          "https://www.animate-onlineshop.jp/"
        )
          .then((html) =>
            parseGenericBrandHtml(html, {
              baseUrl: "https://www.animate-onlineshop.jp",
              linkPattern: /<a[^>]+href=["'](\/pn\/[^"']*?([a-zA-Z0-9_-]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
              slugPrefix: "anikuji",
              kujiBrand: "애니쿠지",
              maker: "Animate (애니메이트)",
              defaultSeries: "애니쿠지 라인업",
              titleKeywordFilter: /アニくじ/,
            })
          )
          .catch(() => [])
      );
      fetchTasks.push(
        searchBrandViaPrTimes(`アニくじ アニメイト ${jpQuery}`.trim(), {
          slugPrefix: "anikuji",
          kujiBrand: "애니쿠지",
          maker: "Animate (애니메이트)",
          defaultSeries: "애니쿠지 라인업",
          mustMatchTitle: /アニくじ/,
        })
      );
    }

    const htmlList = await Promise.all(fetchTasks);
    const seen = new Set<string>();
    const merged: KujiLiveProduct[] = [];

    for (const list of htmlList) {
      for (const item of list) {
        const dedupeKey = `${item.kujiBrand}-${item.title.replace(/\s+/g, "").toLowerCase()}`;
        if (!seen.has(item.slug) && !seen.has(dedupeKey)) {
          seen.add(item.slug);
          seen.add(dedupeKey);
          merged.push(item);
        }
      }
    }

    const filteredMerged = jpQuery
      ? merged.filter((item) => {
          const hay = `${item.title} ${item.series} ${item.kujiBrand}`.toLowerCase();
          const tokens = jpQuery
            .toLowerCase()
            .split(/[\s・×]+/)
            .filter((t) => t.length >= 2);
          if (tokens.length === 0) return hay.includes(jpQuery.toLowerCase());
          return tokens.every((t) => hay.includes(t)) || hay.includes(rawQuery.toLowerCase());
        })
      : merged;

    filteredMerged.sort((a, b) => {
      if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;
      return getDateSortScore(b.releaseDate) - getDateSortScore(a.releaseDate);
    });

    const balancedMerged =
      brandFilter === "전체"
        ? (() => {
            const perBrandCount = new Map<string, number>();
            return filteredMerged.filter((it) => {
              const cnt = perBrandCount.get(it.kujiBrand) || 0;
              if (cnt >= 30) return false;
              perBrandCount.set(it.kujiBrand, cnt + 1);
              return true;
            });
          })()
        : filteredMerged;
    const finalSliced = await hydrateMissingThumbnails(balancedMerged.slice(0, 150));
    return NextResponse.json({
      query: jpQuery || `${brandFilter} 통합 라인업`,
      items: finalSliced,
      count: filteredMerged.length,
    });
  } catch (error) {
    console.error("Multi-brand kuji search error:", error);
    return NextResponse.json(
      { error: "쿠지 공식 라인업을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}