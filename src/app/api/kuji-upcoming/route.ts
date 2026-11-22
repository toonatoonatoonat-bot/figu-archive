import { NextResponse } from "next/server";

export interface KujiScheduleItem {
  slug: string;
  title: string;
  series: string;
  releaseDate: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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

function guessSeriesFromTitle(title: string): string {
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

  for (const [pattern, koSeries] of map) {
    if (pattern.test(title)) return koSeries;
  }
  return "이치방쿠지 (2027 예정)";
}

async function fetchMonthSchedule(year: number, month: number): Promise<KujiScheduleItem[]> {
  const pageUrl = `https://1kuji.com/products?sale_year=${year}&sale_month=${month}`;
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      Referer: "https://1kuji.com/products",
    },
  });

  if (!res.ok) return [];
  const html = await res.text();

  const items: KujiScheduleItem[] = [];
  const seenSlugs = new Set<string>();
  const defaultDate = `${year}.${String(month).padStart(2, "0")} 예정`;

  // 1. HTML 카드(<a href="/products/...">) 기반 추출
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

    const dateMatch = rawText.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
    const formattedDate = dateMatch
      ? `${dateMatch[1]}.${dateMatch[2].padStart(2, "0")}.${dateMatch[3].padStart(2, "0")} 예정`
      : defaultDate;

    const priceMatch = rawText.match(/1回\s*([0-9,]+円)/);

    seenSlugs.add(slug);
    items.push({
      slug,
      title: titleCandidate,
      series: guessSeriesFromTitle(titleCandidate),
      releaseDate: formattedDate,
      price: priceMatch ? `1회 ${priceMatch[1]}` : "이치방쿠지 라인업",
      imageUrl,
      sourceUrl: `https://1kuji.com${path}`,
    });
  }

  // 2. SPA 인라인 JSON 데이터 백업 추출 (HTML 태그가 비어있을 경우 대비)
  if (items.length === 0) {
    const jsonSlugRegex = /"slug"\s*:\s*"([a-zA-Z0-9_-]+)"[\s\S]{0,600}?"name"\s*:\s*"([^"]+)"/g;
    let jMatch: RegExpExecArray | null;
    while ((jMatch = jsonSlugRegex.exec(html)) !== null) {
      const slug = jMatch[1];
      const name = jMatch[2];
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      items.push({
        slug,
        title: name,
        series: guessSeriesFromTitle(name),
        releaseDate: defaultDate,
        price: "이치방쿠지 라인업",
        imageUrl: "",
        sourceUrl: `https://1kuji.com/products/${slug}`,
      });
    }
  }

  return items;
}

export async function GET() {
  try {
    // 2027년 1월 ~ 4월 공식 스케줄 병렬 조회
    const targetMonths = [1, 2, 3, 4];
    const results = await Promise.all(
      targetMonths.map((month) => fetchMonthSchedule(2027, month))
    );

    const merged: KujiScheduleItem[] = [];
    const seen = new Set<string>();

    for (const list of results) {
      for (const item of list) {
        if (!seen.has(item.slug)) {
          seen.add(item.slug);
          merged.push(item);
        }
      }
    }

    if (merged.length === 0) {
      return NextResponse.json(
        {
          error:
            "1kuji.com에서 2027년 예정 목록을 직접 불러오지 못했습니다. 사이트 구조가 변경되었거나 일시적 차단 상태일 수 있습니다.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ items: merged, count: merged.length });
  } catch (error) {
    console.error("1kuji 2027 upcoming fetch error:", error);
    return NextResponse.json(
      { error: "1kuji.com 2027년 스케줄을 조회하는 중 네트워크 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
