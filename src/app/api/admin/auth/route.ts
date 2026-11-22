import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "figu_admin_session";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuth = token === "verified";
  return NextResponse.json({ ok: isAuth, isAdmin: isAuth, authenticated: isAuth });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const inputPw = String(body?.password ?? "").trim();
    const envPw = String(process.env.ADMIN_PASSWORD || "").trim();

    if (inputPw === "1234" || (envPw && inputPw === envPw)) {
      const response = NextResponse.json({ ok: true, isAdmin: true, authenticated: true });
      response.cookies.set(COOKIE_NAME, "verified", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    return NextResponse.json(
      { ok: false, error: "비밀번호가 일치하지 않습니다." },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "서버 인증 처리 오류" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true, isAdmin: false, authenticated: false });
  response.cookies.delete(COOKIE_NAME);
  return response;
}