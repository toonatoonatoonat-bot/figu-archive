import { NextRequest, NextResponse } from "next/server";

async function translateJaToKo(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=ko&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return trimmed;

    const data = await res.json();
    if (Array.isArray(data?.[0])) {
      const translated = data[0]
        .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
        .join("")
        .trim();
      return translated || trimmed;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const texts: string[] = Array.isArray(body?.texts) ? body.texts : [];

    if (texts.length === 0) {
      return NextResponse.json({ translations: [] });
    }

    const translations = await Promise.all(texts.map((t) => translateJaToKo(String(t || ""))));
    return NextResponse.json({ translations });
  } catch (error) {
    console.error("Translate API error:", error);
    return NextResponse.json({ error: "번역 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
