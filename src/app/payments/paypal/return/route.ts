import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { handlePaymentConfirmed } from "@/lib/payments/handler";
import { capturePaypalOrder } from "@/lib/payments/paypal";
import { createSupabasePaymentStore } from "@/lib/payments/store";
import { createAdminClient } from "@/lib/supabase/admin";

const safePath = (p: unknown, fallback: string) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : fallback);

/**
 * Where PayPal sends the customer after they approve. We capture the money here, verify the captured amount against
 * our order, grant the purchase, and send them on. Refreshing this page is harmless (capture and grant are idempotent).
 */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order");
  const token = request.nextUrl.searchParams.get("token"); // PayPal's order id
  const fail = (path = "/dashboard/billing") => NextResponse.redirect(new URL(`${path}${path.includes("?") ? "&" : "?"}payment=failed`, env.siteUrl));
  if (!orderId || !token) return fail();

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,provider,provider_ref,meta,status").eq("id", orderId).maybeSingle();
  if (!order || order.provider !== "paypal" || order.provider_ref !== token) return fail(); // the PayPal order must be the one we created
  const successPath = safePath(order.meta?.success_path, "/dashboard");
  const cancelPath = safePath(order.meta?.cancel_path, "/dashboard/billing");

  try {
    const capture = await capturePaypalOrder(token);
    if (!capture.completed || capture.currency !== "PHP") return fail(cancelPath);
    await handlePaymentConfirmed(
      { claimId: `paypal:${token}`, type: "paypal.capture", provider: "paypal", providerRef: token, paidCents: capture.paidCents },
      createSupabasePaymentStore(),
    );
  } catch (e) {
    console.error("paypal return failed", orderId, e);
    return fail(cancelPath);
  }
  return NextResponse.redirect(new URL(`${successPath}${successPath.includes("?") ? "&" : "?"}paid=1`, env.siteUrl));
}
