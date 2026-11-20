import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE_OPTIONS, SIGNED_OUT_PARAM, SIGN_IN_PATH } from "@/lib/auth";

/**
 * Runs before every page request:
 *  1. Refreshes the Supabase session and writes updated auth cookies.
 *  2. Sends signed-out visitors to /sign-in (remembering where they were going),
 *     and signed-in visitors away from /sign-in.
 *  3. Clears stale sessions (/sign-in?signed_out=1).
 */
export async function proxy(request: NextRequest) {
  // The app sends a session whose account no longer exists here (see
  // getDayContext). Drop the auth cookies and show sign-in.
  const { nextUrl } = request;
  if (request.method === "GET" && nextUrl.pathname === SIGN_IN_PATH && nextUrl.searchParams.has(SIGNED_OUT_PARAM)) {
    return clearSession(request);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Verifies the JWT and refreshes it if needed. Must run before any redirect.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;
  const onSignIn = pathname === SIGN_IN_PATH;

  if (!signedIn && !onSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN_PATH;
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return withCookies(NextResponse.redirect(url), response);
  }
  if (signedIn && onSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCookies(NextResponse.redirect(url), response);
  }
  return response;
}

/** Deletes the auth cookies and redirects to a clean /sign-in (so later posts don't clear again). */
function clearSession(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.search = "";
  const response = NextResponse.redirect(url);
  for (const { name } of request.cookies.getAll()) if (name.startsWith("sb-")) response.cookies.delete(name);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** Carries refreshed auth cookies over to a redirect response. */
function withCookies(redirect: NextResponse, from: NextResponse) {
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
