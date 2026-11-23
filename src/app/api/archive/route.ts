import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { createClient } from "@supabase/supabase-js";
import seedData from "@/data/archive-seed.json";
import { autoTranslateArchiveItem, hasJapaneseChars } from "@/lib/ko-polisher";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function needsAutoClean(item: Record<string, unknown>): boolean {
  const combined = `${item.title || ""} ${item.series || ""} ${item.releaseDate || ""} ${item.summary || ""} ${item.content || ""}`;
  return (
    hasJapaneseChars(combined) ||
    /(?:商品カテゴリー|挑戦方法|会員登録|이치\s*반\s*쿠지|라스트\s*원\s*상|하즐레\s*없는)/.test(combined)
  );
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase
      .from("archive_store")
      .select("data")
      .eq("id", "main")
      .single();

    if (error || !data || !Array.isArray(data.data)) {
      const cleanedSeed = await Promise.all(
        (seedData as Record<string, unknown>[]).map((it) => autoTranslateArchiveItem(it))
      );
      const adminSupabase = createClient(supabaseUrl, serviceKey);
      await adminSupabase
        .from("archive_store")
        .upsert({ id: "main", data: cleanedSeed });
      return NextResponse.json({ items: cleanedSeed });
    }

    const rawItems = data.data as Record<string, unknown>[];
    if (rawItems.some(needsAutoClean)) {
      let processed = 0;
      const cleanedItems = [...rawItems];
      for (let i = 0; i < cleanedItems.length; i++) {
        if (needsAutoClean(cleanedItems[i]) && processed < 6) {
          cleanedItems[i] = await autoTranslateArchiveItem(cleanedItems[i]);
          processed++;
        }
      }
      if (processed > 0) {
        const adminSupabase = createClient(supabaseUrl, serviceKey);
        await adminSupabase
          .from("archive_store")
          .upsert({
            id: "main",
            data: cleanedItems,
            updated_at: new Date().toISOString(),
          });
      }
      return NextResponse.json({ items: cleanedItems }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
    }

    return NextResponse.json({ items: rawItems }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return NextResponse.json({ items: seedData });
  }
}

export async function POST(req: Request) {
  try {
    const { password, items } = await req.json();
    const cookieHeader = req.headers.get("cookie") || "";
    const hasAdminCookie = cookieHeader.includes("figu_admin") || cookieHeader.includes("admin");
    if ((!password || password !== process.env.ADMIN_PASSWORD) && !hasAdminCookie) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const normalizedItems = Array.isArray(items)
      ? await Promise.all(
          (items as Record<string, unknown>[]).map((it) =>
            needsAutoClean(it) ? autoTranslateArchiveItem(it) : Promise.resolve(it)
          )
        )
      : items;

    const adminSupabase = createClient(supabaseUrl, serviceKey);
    const { error } = await adminSupabase
      .from("archive_store")
      .upsert({
        id: "main",
        data: normalizedItems,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}