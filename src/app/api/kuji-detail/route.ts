import { NextRequest, NextResponse } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url")?.trim();
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return NextResponse.json({ error: "유효한 URL이 필요합니다." }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `상세 페이지 응답 오류 (${res.status})` }, { status: 502 });
    }

    const html = await res.text();
    const plainText = stripHtml(html);

    // 1. 이미지 추출 (og:image + 본문 내 고해상도 상품 이미지)
    const imageSet = new Set<string>();
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]) {
      try {
        imageSet.add(new URL(ogMatch[1].replace(/&amp;/g, "&"), targetUrl).toString());
      } catch {}
    }

    const imgRegex = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/gi;
    let imgM: RegExpExecArray | null;
    while ((imgM = imgRegex.exec(html)) !== null) {
      const rawSrc = imgM[1].replace(/&amp;/g, "&");
      if (
        !rawSrc ||
        rawSrc.startsWith("data:") ||
        /(logo|icon|banner_ad|btn|button|sns|twitter|facebook|line|avatar|profile|spacer|pixel)/i.test(rawSrc)
      ) {
        continue;
      }
      try {
        const absUrl = new URL(rawSrc, targetUrl).toString();
        if (
          /\.(jpg|jpeg|png|webp)(\?|$)/i.test(absUrl) &&
          (absUrl.includes("1kuji") ||
            absUrl.includes("prtimes") ||
            absUrl.includes("h-kuji") ||
            absUrl.includes("taito") ||
            absUrl.includes("segaplaza") ||
            absUrl.includes("charahiroba") ||
            absUrl.includes("sanrio") ||
            absUrl.includes("animate"))
        ) {
          imageSet.add(absUrl);
        }
      } catch {}
      if (imageSet.size >= 14) break;
    }

    // 2. 1회 가격 추출 (1回 825円 / 1回¥825 / 1回750円 등)
    const priceMatch =
      plainText.match(/1回\s*[¥￥]?\s*([0-9,]{3,5})\s*円(?:\s*[（(]税込[）)])?/) ||
      plainText.match(/価格[：:\s]*1回\s*[¥￥]?\s*([0-9,]{3,5})\s*円/) ||
      plainText.match(/[¥￥]\s*([0-9,]{3,5})\s*[（(]税込[）)]/);
    const priceText = priceMatch ? `1회 ${priceMatch[1]}엔 (세금 포함)` : "";

    // 3. 발매일 추출
    const dateMatch =
      plainText.match(/発売日[：:\s]*(20\d{2}年\d{1,2}月(?:\d{1,2}日)?)/) ||
      plainText.match(/(20\d{2}年\d{1,2}月\d{1,2}日)(?:（[^）]+）)?(?:より|から)?(?:順次)?(?:発売|販売)/);
    const releaseText = dateMatch ? dateMatch[1] : "";

    // 4. 취급점 / 판매처 추출
    const storeMatch = plainText.match(/取扱店[：:\s]*([^。]{4,60})/);
    const storeText = storeMatch ? storeMatch[1].trim() : "";

    // 5. 공식 소개 요약 추출 (meta description 우선)
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch?.[1]
      ? stripHtml(descMatch[1]).slice(0, 260)
      : "";

    // 6. 경품 등급 라인업 추출 (A賞, B賞, C賞, ラストワン賞 등)
    const prizeRegex = /([A-Zラストワンダブルチャンス]+賞[：:\s]+[^。\n<]{3,45})/g;
    const prizesSet = new Set<string>();
    let pm: RegExpExecArray | null;
    while ((pm = prizeRegex.exec(plainText)) !== null) {
      const cleaned = pm[1].trim();
      if (cleaned.length >= 5 && cleaned.length <= 50) {
        prizesSet.add(cleaned);
      }
      if (prizesSet.size >= 12) break;
    }

    return NextResponse.json({
      images: Array.from(imageSet),
      priceText,
      releaseText,
      storeText,
      description,
      prizes: Array.from(prizesSet),
    });
  } catch (error) {
    console.error("Kuji detail fetch error:", error);
    return NextResponse.json({ error: "상세 정보를 가져오는 중 오류가 발생했습니다." }, { status: 500 });
  }
}