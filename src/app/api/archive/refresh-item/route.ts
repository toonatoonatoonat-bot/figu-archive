import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function parseKstMinutesAgo(updatedAt?: string): number {
  if (!updatedAt) return 9999;
  const m = updatedAt.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return 9999;
  const utcMs = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]) - 9,
    Number(m[5])
  );
  return (Date.now() - utcMs) / 60000;
}

export async function POST(req: Request) {
  try {
    const { itemId, patch } = await req.json();
    if (!itemId || !patch || typeof patch !== "object") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await adminSupabase
      .from("archive_store")
      .select("data")
      .eq("id", "main")
      .single();

    if (error || !data || !Array.isArray(data.data)) {
      return NextResponse.json({ error: "데이터를 불러오지 못했습니다." }, { status: 500 });
    }

    const items = data.data as Record<string, unknown>[];
    const idx = items.findIndex((it) => it.id === itemId);
    if (idx === -1) {
      return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
    }

    const target = items[idx];
    const minsAgo = parseKstMinutesAgo(typeof target.updatedAt === "string" ? target.updatedAt : undefined);
    if (minsAgo >= 0 && minsAgo < 10) {
      return NextResponse.json(
        { error: `이미 최근(${Math.max(1, Math.floor(minsAgo))}분 전)에 갱신되었습니다. 10분 후 다시 시도해 주세요.` },
        { status: 429 }
      );
    }

    const oldLot = typeof target.lotTotal === "string" ? target.lotTotal : "";
    const oldPrize = typeof target.prizeCounts === "string" ? target.prizeCounts : "";

    const updatedItem = {
      ...target,
      price: typeof patch.price === "string" && patch.price ? patch.price : target.price,
      lotTotal:
        oldLot && !oldLot.includes("표준 기준") && !oldLot.includes("추정")
          ? oldLot
          : patch.lotTotal || oldLot,
      maxPerTry: target.maxPerTry || patch.maxPerTry || "",
      offlineOpenDate: target.offlineOpenDate || patch.offlineOpenDate || "",
      onlineOpenDate: target.onlineOpenDate || patch.onlineOpenDate || "",
      prizeCounts:
        oldPrize && !oldPrize.includes("추정")
          ? oldPrize
          : patch.prizeCounts || oldPrize,
      updatedAt: typeof patch.updatedAt === "string" ? patch.updatedAt : target.updatedAt,
    };

    const nextItems = [...items];
    nextItems[idx] = updatedItem;

    const { error: saveErr } = await adminSupabase
      .from("archive_store")
      .upsert({
        id: "main",
        data: nextItems,
        updated_at: new Date().toISOString(),
      });

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, item: updatedItem });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "갱신 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}