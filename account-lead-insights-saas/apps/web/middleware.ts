import { NextRequest, NextResponse } from "next/server";

function hasAliSession(request: NextRequest) {
  return Boolean(request.cookies.get("ali_session")?.value);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!hasAliSession(request)) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    const target = request.nextUrl.clone();
    target.pathname = "/dashboard";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup"]
};
