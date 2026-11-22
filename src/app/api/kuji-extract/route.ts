import { NextRequest, NextResponse } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const NON_FIGURE_GOODS_REGEX =
  /(アクリル|クリアファイル|ラバー|タオル|缶バッジ|ステッカー|色紙|ストラップ|キーホルダー|グラス|マグカップ|タンブラー|コースター|ポーチ|トート|チャーム|ボード|ポスター|ノート|メモ|巾着|ぬいぐるみ|マスコット|ちょこのっこ|acrylic|clear\s*file|rubber|towel|badge|sticker|shikishi|strap|keychain|coaster|poster|plush)/i;

const FIGURE_PRIZE_REGEX =
  /(フィギュア|masterlise|sofvics|revible\s*moment|emotional\s*stories|world\s*collectable|ワーコレ|胸像|スタチュー|figure|statue|ラストワン賞|[a-d]賞)/i;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isNoiseAsset(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith("data:") || lower.endsWith(".svg") || lower.endsWith(".gif")) {
    return true;
  }
  return /(favicon|apple-touch-icon|logo|icon|sns|twitter|facebook|line|youtube|instagram|arrow|btn|button|loading|spinner|spacer|blank|pixel|noimage|no_image|dummy|qr)/i.test(
    lower
  );
}

function resolveAbsoluteUrl(raw: string, baseUrl: string): string | null {
  try {
    const cleaned = raw.replace(/&amp;/g, "&").trim();
    if (!cleaned) return null;
    const abs = new URL(cleaned, baseUrl).toString();
    return abs.startsWith("http") ? abs : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url")?.trim() || "";

  if (!targetUrl || !targetUrl.includes("1kuji.com")) {
    return NextResponse.json(
      { error: "유효한 1kuji.com 상품 페이지 주소를 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        Referer: "https://1kuji.com/",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `1kuji.com 페이지를 불러오지 못했습니다. (HTTP ${res.status})` },
        { status: res.status }
      );
    }

    const html = await res.text();
    const seen = new Set<string>();
    const results: { url: string; thumbnail: string; title: string }[] = [];

    const addCandidate = (
      rawUrl: string,
      label: string,
      contextText = "",
      forceAllow = false
    ) => {
      const abs = resolveAbsoluteUrl(rawUrl, targetUrl);
      if (!abs || isNoiseAsset(abs)) return;

      if (!forceAllow) {
        const meta = `${label} ${contextText}`;
        if (NON_FIGURE_GOODS_REGEX.test(meta) || NON_FIGURE_GOODS_REGEX.test(abs)) {
          return;
        }
        const lowerUrl = abs.toLowerCase();
        if (/[_-](prize[_-]?)?[e-z]([_.-]|$)/i.test(lowerUrl)) {
          return;
        }
        const isMatchedFigure =
          FIGURE_PRIZE_REGEX.test(meta) ||
          /(main|key|visual|kv|hero|figure|prize[_-]?[a-d]|last)/i.test(lowerUrl);
        if (!isMatchedFigure) return;
      }

      const key = abs.split("?")[0];
      if (seen.has(key)) return;
      seen.add(key);

      results.push({
        url: abs,
        thumbnail: abs,
        title: label,
      });
    };

    // 1순위: og:image (메인 키 비주얼)
    const metaRegex =
      /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = metaRegex.exec(html)) !== null) {
      const metaUrl = mMatch[1] || mMatch[2];
      if (metaUrl) addCandidate(metaUrl, "메인 키 비주얼 (대표 배너)", "", true);
    }

    // 2순위: 본문 내 피규어 <img> 태그
    const imgRegex = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = imgRegex.exec(html)) !== null) {
      const tag = iMatch[0];
      const src = iMatch[1];
      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      const label = altMatch?.[1]?.trim() || `피규어 공식 컷 #${results.length + 1}`;

      const startIdx = Math.max(0, iMatch.index - 120);
      const endIdx = Math.min(html.length, iMatch.index + tag.length + 180);
      const contextText = stripHtml(html.slice(startIdx, endIdx));

      addCandidate(src, label, contextText, false);
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: "추출할 수 있는 피규어 공식 이미지를 찾지 못했습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      images: results.slice(0, 25),
      count: results.length,
    });
  } catch (error) {
    console.error("1kuji extract error:", error);
    return NextResponse.json(
      { error: "1kuji.com 페이지 분석 중 네트워크 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
