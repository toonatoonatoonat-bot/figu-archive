import { NextRequest, NextResponse } from "next/server";
import { autoTranslateAndPolish } from "@/lib/ko-polisher";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const texts: string[] = Array.isArray(body?.texts) ? body.texts : [];
    if (texts.length === 0) return NextResponse.json({ translations: [] });

    const translations = await Promise.all(texts.map((t) => autoTranslateAndPolish(String(t || ""))));
    return NextResponse.json({ translations });
  } catch (error) {
    console.error("Translate API error:", error);
    return NextResponse.json({ error: "번역 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}