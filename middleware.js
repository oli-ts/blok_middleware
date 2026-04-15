import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/projects", "/contacts", "/companies", "/crm", "/admin"];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/contacts/:path*", "/companies/:path*", "/crm/:path*", "/admin/:path*"],
};
