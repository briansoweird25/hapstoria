import type { Provider } from "@/lib/payments/checkout";

const LABELS: Record<Provider, string> = { paymongo: "Pay with GCash / Maya / card", paypal: "Pay with PayPal" };

/** Submit buttons that carry the chosen payment provider. Render inside a <form> whose action reads `provider`. */
export function PayButtons({ providers, compact = false }: { providers: Provider[]; compact?: boolean }) {
  if (!providers.length) return <p className="text-sm text-muted">Payments aren&apos;t enabled yet.</p>;
  return (
    <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-2`}>
      {providers.map((p, i) => (
        <button key={p} name="provider" value={p} className={i === 0 ? "btn-primary" : "btn-ghost"}>{LABELS[p]}</button>
      ))}
    </div>
  );
}
