import { NextRequest, NextResponse } from "next/server";

interface ImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
}

const SEARCH_CACHE = new Map<string, { data: ImageCandidate[]; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 10;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// 1순위: DuckDuckGo 무료 검색
async function searchFromDuckDuckGo(query: string): Promise<ImageCandidate[]> {
  const initUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const initRes = await fetch(initUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });
  const html = await initRes.text();

  const vqdMatch =
    html.match(/vqd="([^"]+)"/) ||
    html.match(/vqd='([^']+)'/) ||
    html.match(/vqd=([0-9a-zA-Z_-]+)/);

  if (!vqdMatch || !vqdMatch[1]) return [];

  const apiUrl = new URL("https://duckduckgo.com/i.js");
  apiUrl.searchParams.set("l", "wt-wt");
  apiUrl.searchParams.set("o", "json");
  apiUrl.searchParams.set("q", query);
  apiUrl.searchParams.set("vqd", vqdMatch[1]);
  apiUrl.searchParams.set("f", ",,,");
  apiUrl.searchParams.set("p", "1");

  const imgRes = await fetch(apiUrl.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://duckduckgo.com/",
      Accept: "application/json, text/javascript, */*; q=0.01",
    },
  });

  if (!imgRes.ok) return [];

  const data = await imgRes.json();
  const results = Array.isArray(data.results) ? data.results : [];

  return results
    .filter((item: { image?: string }) => Boolean(item.image))
    .slice(0, 45)
    .map((item: { image?: string; thumbnail?: string; title?: string }) => ({
      url: item.image || "",
      thumbnail: item.thumbnail || item.image || "",
      title: item.title || "공식 이미지 후보",
    }));
}

// 2순위 백업: Bing 무료 이미지 검색
async function searchFromBing(query: string): Promise<ImageCandidate[]> {
  const bingUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=45&mmasync=1`;
  const res = await fetch(bingUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) return [];
  const html = await res.text();

  const candidates: ImageCandidate[] = [];
  const mRegex = /m="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = mRegex.exec(html)) !== null && candidates.length < 45) {
    try {
      const decoded = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&");
      const meta = JSON.parse(decoded);
      if (meta.murl) {
        candidates.push({
          url: meta.murl,
          thumbnail: meta.turl || meta.murl,
          title: meta.t || "공식 이미지 후보",
        });
      }
    } catch {
      // 파싱 실패 항목 건너뛰기
    }
  }

  return candidates;
}

async function runMultiEngine(query: string): Promise<ImageCandidate[]> {
  let results = await searchFromDuckDuckGo(query);
  if (results.length === 0) {
    results = await searchFromBing(query);
  }
  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const mode = searchParams.get("mode") || "general";

  if (!query || !query.trim()) {
    return NextResponse.json({ error: "검색어가 비어 있습니다." }, { status: 400 });
  }

  const cleanQuery = query.trim();
  const cacheKey = `${mode}:${cleanQuery.toLowerCase()}`;

  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ images: cached.data, source: "cache" });
  }

  try {
    let images: ImageCandidate[] = [];

    if (mode === "kuji") {
      // 이치방쿠지 전용 모드: 공식 사이트(1kuji.com) 우선 집중 검색
      const kujiOfficialQuery = `site:1kuji.com ${cleanQuery}`;
      images = await runMultiEngine(kujiOfficialQuery);

      // 결과가 적으면 반프레스토 구 공식 도메인(bpnavi.jp)도 함께 보충
      if (images.length < 6) {
        const bpnaviImages = await runMultiEngine(`site:bpnavi.jp ${cleanQuery}`);
        const seen = new Set(images.map((i) => i.url));
        for (const item of bpnaviImages) {
          if (!seen.has(item.url)) {
            seen.add(item.url);
            images.push(item);
          }
        }
      }

      // 공식 사이트 내 직링크가 적을 경우 一番くじ 공식 키워드로 보충
      if (images.length === 0) {
        images = await runMultiEngine(`一番くじ ${cleanQuery}`);
      }
    } else {
      // 일반 피규어 검색 모드
      images = await runMultiEngine(cleanQuery);

      if (images.length === 0) {
        const fallbackQuery = cleanQuery
          .replace(/1\/\d+/g, "")
          .replace(/\b(official|figure)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        if (fallbackQuery && fallbackQuery !== cleanQuery) {
          images = await searchFromBing(fallbackQuery);
        }
      }
    }

    if (images.length > 0) {
      SEARCH_CACHE.set(cacheKey, {
        data: images,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Multi-engine image search error:", error);
    return NextResponse.json(
      { error: "이미지 검색 중 일시적인 네트워크 오류가 발생했습니다. 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}