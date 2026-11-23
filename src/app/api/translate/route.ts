import { NextRequest, NextResponse } from "next/server";

const PRE_GLOSSARY: [RegExp, string][] = [
  [/一番くじ/g, "이치방쿠지"],
  [/ラストワン賞/g, "라스트원상"],
  [/ダブルチャンスキャンペーン/g, "더블찬스 캠페인"],
  [/ダブルチャンス/g, "더블찬스"],
  [/MASTERLISE\s*EXTRA/gi, "마스터라이즈 엑스트라"],
  [/MASTERLISE\s*EXPIECE/gi, "마스터라이즈 엑스피스"],
  [/MASTERLISE/gi, "마스터라이즈"],
  [/REVIBLE\s*MOMENT/gi, "리바이블 모멘트"],
  [/SOFVIMATES/gi, "소프비메이츠"],
  [/ちょこのっこ/g, "쵸코놋코"],
  [/きゅんキャラ/g, "큥캐릭터"],
  [/アクリルスタンド/g, "아크릴 스탠드"],
  [/クリアファイル/g, "클리어파일"],
  [/ラバーコースター/g, "러버 코스터"],
  [/ラバーチャーム/g, "러버 참"],
  [/ラバーストラップ/g, "러버 스트랩"],
  [/ビジュアルボード/g, "비주얼 보드"],
  [/タオルコレクション/g, "타월 컬렉션"],
  [/ハンドタオル/g, "핸드 타월"],
  [/グラスコレクション/g, "글라스 컬렉션"],
  [/フィギュア/g, "피규어"],
  [/ぬいぐるみ/g, "봉제인형"],
  [/メーカー希望小売価格/g, "권장 소비자가"],
  [/順次発売予定/g, "순차 발매 예정"],
  [/取扱店/g, "취급점"],
  [/店頭販売/g, "매장 판매"],
  [/オンライン販売/g, "온라인 판매"],
];

function applyPreGlossary(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PRE_GLOSSARY) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function polishKoreanKujiText(text: string): string {
  let out = text;
  const postFixes: [RegExp, string][] = [
    [/가장\s*복권|제일\s*복권|이치방\s*복권/g, "이치방쿠지"],
    [/마지막\s*하나\s*상|라스트\s*원\s*상/g, "라스트원상"],
    [/더블\s*찬스\s*캠페인/g, "더블찬스 캠페인"],
    [/더블\s*찬스/g, "더블찬스"],
    [/([A-Z])\s*상\s*피규어/g, "$1상 피규어"],
    [/([A-Z])\s*상\b/g, "$1상"],
    [/전\s*(\d+)\s*종/g, "총 $1종"],
    [/약\s*(\d+(?:\.\d+)?)\s*cm/gi, "약 $1cm"],
    [/1회\s*(\d[\d,]*)\s*엔\s*\(세금\s*포함\)/g, "1회 $1엔 (세금 포함)"],
    [/1회\s*(\d[\d,]*)\s*엔\s*\(세입\)/g, "1회 $1엔 (세금 포함)"],
    [/매장\s*판매\s*:\s*미정/g, "오프라인 매장: 추후 공개"],
    [/온라인\s*판매\s*:\s*미정/g, "온라인 쿠지: 추후 공개"],
    [/순차\s*발매\s*예정입니다\.?/g, "순차 발매 예정입니다."],
    [/발매\s*예정입니다\.?/g, "발매 예정입니다."],
    [/등장합니다\.?/g, "라인업으로 등장합니다."],
    [/ラインナップ/g, "라인업"],
    [/\s+([,.)\]])/g, "$1"],
    [/([(\[])\s+/g, "$1"],
    [/[ \t]{2,}/g, " "],
  ];
  for (const [pattern, replacement] of postFixes) {
    out = out.replace(pattern, replacement);
  }
  return out
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function translateJaToKo(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const preProcessed = applyPreGlossary(trimmed);
  if (!/[\u3040-\u30ff\u4e00-\u9faf]/.test(preProcessed)) {
    return polishKoreanKujiText(preProcessed);
  }
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=ko&dt=t&q=${encodeURIComponent(preProcessed)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return polishKoreanKujiText(preProcessed);
    const data = await res.json();
    if (Array.isArray(data?.[0])) {
      const translated = data[0]
        .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
        .join("")
        .trim();
      return polishKoreanKujiText(translated || preProcessed);
    }
    return polishKoreanKujiText(preProcessed);
  } catch {
    return polishKoreanKujiText(preProcessed);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const texts: string[] = Array.isArray(body?.texts) ? body.texts : [];
    if (texts.length === 0) return NextResponse.json({ translations: [] });
    const translations = await Promise.all(texts.map((t) => translateJaToKo(String(t || ""))));
    return NextResponse.json({ translations });
  } catch (error) {
    console.error("Translate API error:", error);
    return NextResponse.json({ error: "번역 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}