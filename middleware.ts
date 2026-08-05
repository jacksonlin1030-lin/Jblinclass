import { NextRequest, NextResponse } from "next/server";

const PASSWORD_COOKIE = "fc_pw";
const PUBLIC_PATHS = ["/login", "/api/login"];

/**
 * Site-wide password gate. This is a deliberately lightweight scheme for a
 * single-user personal tool (not a full auth system): the cookie simply
 * holds the shared password value itself, set httpOnly by /api/login after a
 * correct submission. Vercel serves everything over HTTPS, so the cookie
 * isn't sent in the clear. /api/cron/* is exempt here because it's called by
 * Vercel's scheduler (no browser session) and instead checks its own
 * CRON_SECRET header inside the route.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.APP_PASSWORD;
  const cookie = req.cookies.get(PASSWORD_COOKIE)?.value;

  if (expected && cookie === expected) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未登入，請先到 /login 輸入密碼" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
