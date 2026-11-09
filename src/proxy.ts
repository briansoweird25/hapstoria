import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every page and API route (not static files), so an expiring session is always refreshed here, once, and the
  // new cookies are saved. Refresh tokens are single-use: if a page refreshed without saving, the user would be logged out.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};
