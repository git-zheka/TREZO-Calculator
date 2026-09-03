import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const ok = await verifyToken(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Під захистом усе, крім /login, статики і ICS-фіду.
   * Фід має власний секрет у шляху — інакше Google Календар не зміг би його читати.
   */
  matcher: ["/((?!login|api/ics|_next/static|_next/image|manifest.webmanifest|icon|favicon.ico).*)"],
};
