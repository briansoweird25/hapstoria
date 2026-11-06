import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/env";

/** Refreshes the auth session and gates /dashboard routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const protectedPath = request.nextUrl.pathname.startsWith("/dashboard");
  if (!supabaseConfigured() || !url || !key) {
    // Misconfigured: public pages still load; protected pages send you to login rather than crashing.
    return protectedPath ? redirectToLogin(request) : response;
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims && protectedPath) return redirectToLogin(request);
  } catch (e) {
    console.error("proxy session refresh failed", e);
    if (protectedPath) return redirectToLogin(request);
  }
  return response;
}

function redirectToLogin(request: NextRequest) {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}
