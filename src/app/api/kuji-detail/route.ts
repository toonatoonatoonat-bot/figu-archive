import { NextRequest, NextResponse } from "next/server";

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

function isNoiseOrBrandLogo(url: string, altText = "", contextText = ""): boolean {
  const lowerUrl = url.toLowerCase();
  const combinedMeta = `${altText} ${contextText}`.toLowerCase();

  if (lowerUrl.startsWith("data:") || lowerUrl.endsWith(".svg") || lowerUrl.endsWith(".gif")) {
    return true;
  }

  if (
    /(club|ichibankuji|1kuji[_-]?logo|brand|site[_-]?logo|header|footer|common|shared|ogp|default|noimage|no_image|dummy|favicon|apple-touch-icon|logo|icon|sns|twitter|facebook|line|youtube|instagram|arrow|btn|button|loading|spinner|spacer|blank|pixel|qr|banner_app|campaign_bnr|member|guide|shop_search)/i.test(
      lowerUrl
    )
  ) {
    return true;
  }

  if (
    /(倶楽部|一番くじクラブ|会員登録|ログイン|公式ショップ|店舗検索|アプリ|lineアカウント|お問い合わせ|ヘルパー)/i.test(
      combinedMeta
    )
  ) {
    return true;
  }

  return false;
}

const NON_FIGURE_GOODS_REGEX =
  /(アクリル|クリアファイル|ラバー|タオル|缶バッジ|ステッカー|色紙|ストラップ|キーホルダー|グラス|マグカップ|タンブラー|コースター|ポーチ|トート|チャーム|ボード|ポスター|ノート|メモ|巾着|ぬいぐるみ|マスコット|ちょこのっこ|acrylic|clear\s*file|rubber|towel|badge|sticker|shikishi|strap|keychain|coaster|poster|plush)/i;

const FIGURE_PRIZE_REGEX =
  /(フィギュア|masterlise|gracemaster|sofvics|revible\s*moment|emotional\s*stories|world\s*collectable|ワーコレ|胸像|スタチュー|figure|statue|ラストワン賞|[a-d]賞)/i;

function resolveUrl(raw: string, baseUrl: string): string | null {
  try {
    const cleaned = raw.replace(/&amp;/g, "&").trim();
    if (!cleaned) return null;
    const abs = new URL(cleaned, baseUrl).toString();
    return abs.startsWith("http") ? abs : null;
  } catch {
    return null;
  }
}

async function isLargeEnoughImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT, Referer: "https://1kuji.com/" },
    });
    if (!res.ok) return false;
    const lenStr = res.headers.get("content-length");
    if (lenStr) {
      const bytes = Number(lenStr);
      if (bytes > 0 && bytes < 14500) return false;
    }
    return true;
  } catch {
    return true;
  }
}

interface ScoredImage {
  url: string;
  score: number;
}

async function fetchAutoAssortSpec(pageTitle: string, prizes: string[]) {
  let lotTotal = "";
  let prizeCounts = "";

  const cleanTitle = pageTitle
    .replace(/^一番くじ\s*/, "")
    .replace(/[-|｜].*$/, "")
    .trim();

  if (cleanTitle) {
    try {
      const q = encodeURIComponent(`一番くじ ${cleanTitle} アソート`);
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const searchHtml = await res.text();
        const searchText = stripHtml(searchHtml);

        const lotMatch = searchText.match(/(?:1ロット|全|計|総数)\s*([6-9][0-9]|100)\s*(?:本|個|枚)/);
        if (lotMatch) {
          lotTotal = `${lotMatch[1]}개`;
        }

        const gradeCountMap = new Map<string, string>();
        const countRegex = /([A-Z]賞|ラストワン賞)\s*[:：]?\s*([1-9][0-9]?)\s*(?:本|個|体|枚)/g;
        let m: RegExpExecArray | null;
        while ((m = countRegex.exec(searchText)) !== null) {
          const g = m[1].replace("賞", "상").replace("ラストワン", "라스트원");
          const c = Number(m[2]);
          if (c > 0 && c <= 30 && !gradeCountMap.has(g)) {
            gradeCountMap.set(g, `${g} ${c}개`);
          }
        }

        if (gradeCountMap.size >= 2) {
          prizeCounts = Array.from(gradeCountMap.values()).join(" / ");
          if (!lotTotal) lotTotal = "80개 (추정)";
        }
      }
    } catch {
      // 외부 검색 타임아웃 시 기본 추정치로 폴백
    }
  }

  if (!prizeCounts && prizes.length > 0) {
    const grades = prizes
      .map((p) => p.split(":")[0].trim())
      .filter((g) => /^[A-Z]賞$|ラストワン賞/.test(g));

    if (grades.length > 0) {
      const estimated = grades.map((g) => {
        const koG = g.replace("賞", "상").replace("ラストワン", "라스트원");
        if (koG === "라스트원상") return "라스트원 1개";
        if (/^[ABC]상$/.test(koG)) return `${koG} 2개(추정)`;
        return `${koG} 다수`;
      });
      prizeCounts = `${estimated.join(" / ")} ※공식 미공개 추정치`;
      if (!lotTotal) lotTotal = "80개 (표준 기준)";
    }
  }

  return { lotTotal, prizeCounts };
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url")?.trim() || "";

  if (!targetUrl || !targetUrl.includes("1kuji.com")) {
    return NextResponse.json(
      { error: "유효한 1kuji.com 상세 페이지 주소가 필요합니다." },
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
        { error: `상세 페이지 접근 실패 (HTTP ${res.status})` },
        { status: res.status }
      );
    }

    const html = await res.text();
    const plainText = stripHtml(html);

    const slugMatch = targetUrl.match(/\/products\/([a-zA-Z0-9_-]+)/);
    const productSlug = slugMatch?.[1]?.toLowerCase() || "";

    const descMatch =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i);
    const description = descMatch?.[1]?.trim() || "";

    const releaseMatch = plainText.match(/発売日[：:\s]*([^■●\n]{4,35})/);
    const priceMatch =
      plainText.match(/メーカー希望小売価格[：:\s]*([^■●\n]{4,30})/) ||
      plainText.match(/(1回\s*[0-9,]+円[^■●\n]{0,15})/);
    const storeMatch = plainText.match(/取扱店[：:\s]*([^■●\n]{4,60})/);

    const prizes: string[] = [];
    const seenPrizes = new Set<string>();
    const prizeRegex = /([A-Z]賞|ラストワン賞|ダブルチャンスキャンペーン)\s*([^\n■●<]{2,45})/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = prizeRegex.exec(plainText)) !== null) {
      const grade = pMatch[1].trim();
      const name = pMatch[2].trim();
      if (!seenPrizes.has(grade) && name.length >= 2) {
        seenPrizes.add(grade);
        const isFig = !NON_FIGURE_GOODS_REGEX.test(name);
        prizes.push(`${grade} : ${name}${isFig ? " [피규어]" : ""}`);
      }
      if (prizes.length >= 15) break;
    }

    const scoredMap = new Map<string, ScoredImage>();

    const registerCandidate = (
      raw: string,
      altText: string,
      contextText: string,
      orderIndex: number
    ) => {
      const abs = resolveUrl(raw, targetUrl);
      if (!abs || isNoiseOrBrandLogo(abs, altText, contextText)) return;

      const lowerUrl = abs.toLowerCase();
      const combinedMeta = `${altText} ${contextText}`.trim();

      // 피규어가 아닌 잡화 굿즈 제외
      if (NON_FIGURE_GOODS_REGEX.test(combinedMeta) || NON_FIGURE_GOODS_REGEX.test(lowerUrl)) {
        return;
      }
      if (!/フィギュア|figure/i.test(combinedMeta) && /[_-](prize[_-]?)?[f-z]([_.-]|$)/i.test(lowerUrl)) {
        return;
      }

      const hasSlug = Boolean(productSlug && lowerUrl.includes(productSlug));
      const isMainBanner =
        /(main|key|visual|kv|hero|mv|cover|top|banner)/i.test(lowerUrl) ||
        /メイン|キービジュアル/.test(combinedMeta) ||
        orderIndex <= 2;

      const isFigureItem =
        FIGURE_PRIZE_REGEX.test(combinedMeta) ||
        /(figure|prize[_-]?[a-d]|last)/i.test(lowerUrl);

      // 메인 배너, 상품 슬러그 이미지, 또는 피규어/상위 경품(A~D/라스트원) 이미지 모두 허용
      if (!hasSlug && !isMainBanner && !isFigureItem) return;

      let score = 100 - orderIndex;
      if (isMainBanner && hasSlug) {
        score += 1500;
      } else if (isMainBanner) {
        score += 1200;
      } else if (isFigureItem) {
        score += 500;
      }

      if (/prize[_-]?a|a賞/i.test(`${lowerUrl} ${altText}`)) score += 50;
      else if (/prize[_-]?b|b賞/i.test(`${lowerUrl} ${altText}`)) score += 40;
      else if (/prize[_-]?c|c賞/i.test(`${lowerUrl} ${altText}`)) score += 30;
      else if (/prize[_-]?d|d賞/i.test(`${lowerUrl} ${altText}`)) score += 20;
      else if (/last|ラストワン/i.test(`${lowerUrl} ${altText}`)) score += 10;

      const key = abs.split("?")[0];
      const existing = scoredMap.get(key);
      if (!existing || score > existing.score) {
        scoredMap.set(key, { url: abs, score });
      }
    };

    const ogImgMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImgMatch?.[1]) {
      registerCandidate(ogImgMatch[1], "メイン キービジュアル", "", 0);
    }

    // 0. <source srcset="..."> 및 style="background-image: url(...)" (메인 커버 배너용) 추출
    const bgRegex = /background-image\s*:\s*url\(["']?([^"')]+)["']?\)/gi;
    let bgMatch: RegExpExecArray | null;
    while ((bgMatch = bgRegex.exec(html.slice(0, 25000))) !== null) {
      registerCandidate(bgMatch[1], "メイン キービジュアル", "メイン", 0);
    }

    const sourceRegex = /<source[^>]+srcset=["']([^"'\s,]+)[^"']*["'][^>]*>/gi;
    let srcMatch: RegExpExecArray | null;
    while ((srcMatch = sourceRegex.exec(html.slice(0, 25000))) !== null) {
      registerCandidate(srcMatch[1], "メイン キービジュアル", "メイン", 0);
    }

    const imgRegex = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi;
    let iMatch: RegExpExecArray | null;
    let idx = 1;
    while ((iMatch = imgRegex.exec(html)) !== null) {
      const fullTag = iMatch[0];
      const src = iMatch[1];
      const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
      const altText = altMatch?.[1] || "";

      const startIdx = Math.max(0, iMatch.index - 120);
      const endIdx = Math.min(html.length, iMatch.index + fullTag.length + 180);
      const contextText = stripHtml(html.slice(startIdx, endIdx));

      registerCandidate(src, altText, contextText, idx++);
    }

    const preSorted = Array.from(scoredMap.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => item.url)
      .slice(0, 20);

    const sizeChecks = await Promise.all(
      preSorted.map(async (url) => ({ url, ok: await isLargeEnoughImage(url) }))
    );
    const finalImages = sizeChecks.filter((item) => item.ok).map((item) => item.url);

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? stripHtml(titleMatch[1]) : "";

    const onlineMatch = plainText.match(/(?:一番くじONLINE|オンライン販売)[^■●\n]{0,40}?(20[2-3][0-9]年[0-9]{1,2}月[0-9]{1,2}日[^■●\n]{0,20})/);
    const maxTryMatch = plainText.match(/(?:1会計につき|お一人様)\s*([0-9]+回まで)/);

    const { lotTotal, prizeCounts } = await fetchAutoAssortSpec(pageTitle, prizes);

    return NextResponse.json({
      releaseText: releaseMatch?.[1]?.trim() || "",
      priceText: priceMatch?.[1]?.trim() || "",
      storeText: storeMatch?.[1]?.trim() || "",
      onlineOpenDate: onlineMatch?.[1]?.trim() || "",
      maxPerTry: maxTryMatch?.[1]?.trim() || "",
      lotTotal,
      prizeCounts,
      description,
      prizes,
      images: finalImages,
    });
  } catch (error) {
    console.error("1kuji detail error:", error);
    return NextResponse.json(
      { error: "상세 데이터를 파싱하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}


