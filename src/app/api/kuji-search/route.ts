import { NextRequest, NextResponse } from "next/server";

export interface KujiLiveProduct {
  slug: string;
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
  [/이치방쿠지|제일복권/gi, ""],
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
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function guessKoreanSeries(title: string): string {
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
    [/サンリオ/i, "산리오 캐릭터즈"],
    [/ワンパンマン/i, "원펀맨"],
    [/進撃の巨人/i, "진격의 거인"],
    [/ハイキュー/i, "하이큐!!"],
    [/フリーレン/i, "장송의 프리렌"],
  ];

  for (const [pattern, ko] of map) {
    if (pattern.test(title)) return ko;
  }
  return "이치방쿠지 라인업";
}

function getDateSortScore(releaseDate: string): number {
  const m = releaseDate.match(/(20\d{2})[.\-/년\s]*(\d{1,2})(?:[.\-/월\s]*(\d{1,2}))?/);
  if (!m) return 0;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = m[3] ? Number(m[3]) : 15;
  return year * 10000 + month * 100 + day;
}

function parseProductsFromHtml(html: string, fallbackDate = "이전 회차"): KujiLiveProduct[] {
  const results: KujiLiveProduct[] = [];
  const seenSlugs = new Set<string>();

  const linkRegex = /<a[^>]+href=["'](\/products\/([a-zA-Z0-9_-]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const slug = match[2];
    const inner = match[3];

    if (!slug || slug === "products" || seenSlugs.has(slug)) continue;

    const imgMatch = inner.match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i);
    const altMatch = inner.match(/alt=["']([^"']+)["']/i);

    const rawText = stripHtml(inner);
    const titleCandidate = (altMatch?.[1] || rawText || "").trim();
    if (!titleCandidate || titleCandidate.length < 4) continue;

    let imageUrl = "";
    if (imgMatch && imgMatch[1]) {
      try {
        imageUrl = new URL(imgMatch[1].replace(/&amp;/g, "&"), "https://1kuji.com").toString();
      } catch {
        imageUrl = "";
      }
    }

    const fullDateMatch = rawText.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
    const monthOnlyMatch = rawText.match(/(20\d{2})年(\d{1,2})月/);
    let formattedDate = fallbackDate;
    if (fullDateMatch) {
      formattedDate = `${fullDateMatch[1]}.${fullDateMatch[2].padStart(2, "0")}.${fullDateMatch[3].padStart(2, "0")}`;
    } else if (monthOnlyMatch) {
      formattedDate = `${monthOnlyMatch[1]}.${monthOnlyMatch[2].padStart(2, "0")} 발매`;
    }

    const priceMatch = rawText.match(/1回\s*([0-9,]+円)/);
    const sortScore = getDateSortScore(formattedDate);
    // 2026년 11월 22일 기준 이후는 예정작(최신), 그 이전은 발매 완료된 그전 회차
    const isUpcoming = sortScore >= 20261122 || /予定/.test(formattedDate);

    seenSlugs.add(slug);
    results.push({
      slug,
      title: titleCandidate,
      series: guessKoreanSeries(titleCandidate),
      releaseDate: formattedDate,
      price: priceMatch ? `1회 ${priceMatch[1]}` : "이치방쿠지",
      imageUrl,
      sourceUrl: `https://1kuji.com${path}`,
      isUpcoming,
    });
  }

  return results;
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("q")?.trim() || "";
  const jpQuery = toJapaneseQuery(rawQuery);

  try {
    const urlsToFetch: { url: string; fallbackDate: string }[] = [];

    if (jpQuery) {
      // 키워드 검색 시 최신순(1페이지) + 그전 회차(2~3페이지)까지 동시 조회
      urlsToFetch.push(
        { url: `https://1kuji.com/search?word=${encodeURIComponent(jpQuery)}&page=1`, fallbackDate: "최신 회차" },
        { url: `https://1kuji.com/search?word=${encodeURIComponent(jpQuery)}&page=2`, fallbackDate: "이전 회차" },
        { url: `https://1kuji.com/search?word=${encodeURIComponent(jpQuery)}&page=3`, fallbackDate: "이전 회차" },
        { url: `https://1kuji.com/products/search?word=${encodeURIComponent(jpQuery)}`, fallbackDate: "공식 검색" }
      );
    } else {
      // 전체 조회 시 2027년 예정작(1~3월) + 2026년 최신(11~12월) + 그전 발매작(7~10월) 동시 조회
      urlsToFetch.push(
        { url: "https://1kuji.com/products?sale_year=2027&sale_month=3", fallbackDate: "2027.03 예정" },
        { url: "https://1kuji.com/products?sale_year=2027&sale_month=2", fallbackDate: "2027.02 예정" },
        { url: "https://1kuji.com/products?sale_year=2027&sale_month=1", fallbackDate: "2027.01 예정" },
        { url: "https://1kuji.com/products?sale_year=2026&sale_month=12", fallbackDate: "2026.12 예정" },
        { url: "https://1kuji.com/products?sale_year=2026&sale_month=11", fallbackDate: "2026.11 발매" },
        { url: "https://1kuji.com/products?sale_year=2026&sale_month=10", fallbackDate: "2026.10 발매" },
        { url: "https://1kuji.com/products?sale_year=2026&sale_month=9", fallbackDate: "2026.09 발매" },
        { url: "https://1kuji.com/products?sale_year=2026&sale_month=8", fallbackDate: "2026.08 발매" },
        { url: "https://1kuji.com/products?sale_year=2026&sale_month=7", fallbackDate: "2026.07 발매" }
      );
    }

    const htmlList = await Promise.all(
      urlsToFetch.map(async ({ url, fallbackDate }) => {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
              Referer: "https://1kuji.com/",
            },
          });
          if (!res.ok) return [];
          const html = await res.text();
          return parseProductsFromHtml(html, fallbackDate);
        } catch {
          return [];
        }
      })
    );

    const seen = new Set<string>();
    const merged: KujiLiveProduct[] = [];

    for (const list of htmlList) {
      for (const item of list) {
        if (!seen.has(item.slug)) {
          seen.add(item.slug);
          merged.push(item);
        }
      }
    }

    // 검색어가 있을 경우 제목/시리즈에 키워드가 포함된 항목만 엄격 필터링
    const filteredMerged = jpQuery
      ? merged.filter((item) => {
          const hay = `${item.title} ${item.series}`.toLowerCase();
          const tokens = jpQuery
            .toLowerCase()
            .split(/[\s・×]+/)
            .filter((t) => t.length >= 2);
          if (tokens.length === 0) return hay.includes(jpQuery.toLowerCase());
          return tokens.every((t) => hay.includes(t)) || hay.includes(rawQuery.toLowerCase());
        })
      : merged;

    // 1순위: 최신/예정작(내림차순) -> 2순위: 그전 발매작(내림차순)
    filteredMerged.sort((a, b) => {
      if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;
      const scoreDiff = getDateSortScore(b.releaseDate) - getDateSortScore(a.releaseDate);
      if (scoreDiff !== 0) return scoreDiff;
      return 0;
    });

    return NextResponse.json({
      query: jpQuery || "최신 예정 + 이전 회차 전체",
      items: filteredMerged.slice(0, 60),
      count: filteredMerged.length,
    });
  } catch (error) {
    console.error("1kuji live search error:", error);
    return NextResponse.json(
      { error: "1kuji.com 최신 정보를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}


