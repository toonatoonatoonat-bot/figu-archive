import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import seedData from "@/data/archive-seed.json";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase
      .from("archive_store")
      .select("data")
      .eq("id", "main")
      .single();

    if (error || !data) {
      const adminSupabase = createClient(supabaseUrl, serviceKey);
      await adminSupabase
        .from("archive_store")
        .upsert({ id: "main", data: seedData });
      return NextResponse.json({ items: seedData });
    }

    return NextResponse.json({ items: data.data });
  } catch {
    return NextResponse.json({ items: seedData });
  }
}

export async function POST(req: Request) {
  try {
    const { password, items } = await req.json(); const cookieHeader = req.headers.get("cookie") || ""; const hasAdminCookie = cookieHeader.includes("figu_admin") || cookieHeader.includes("admin");
    if ((!password || password !== process.env.ADMIN_PASSWORD) && !hasAdminCookie) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceKey);
    const { error } = await adminSupabase
      .from("archive_store")
      .upsert({
        id: "main",
        data: items,
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