import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?google_error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL(`/settings?google_error=missing_code`, req.url));
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(new URL(`/settings?google_connected=1`, req.url));
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/settings?google_error=${encodeURIComponent(err.message ?? "unknown")}`, req.url)
    );
  }
}
