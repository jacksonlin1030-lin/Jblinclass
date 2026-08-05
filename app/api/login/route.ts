import { NextRequest, NextResponse } from "next/server";

const PASSWORD_COOKIE = "fc_pw";

export async function POST(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "伺服器尚未設定 APP_PASSWORD 環境變數" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.password !== expected) {
    return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASSWORD_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180, // 180 days
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASSWORD_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
