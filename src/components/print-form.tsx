"use client";

import { useActionState, useState } from "react";
import { createPrintOrder, type PrintFormState } from "@/app/dashboard/events/[id]/print/actions";
import { MIN_QUANTITY, printPriceCents, type PrintMode } from "@/lib/print";

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PrintForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(createPrintOrder.bind(null, eventId), {} as PrintFormState);
  const [qty, setQty] = useState(50);
  const [mode, setMode] = useState<PrintMode>("host");
  const price = qty >= MIN_QUANTITY ? printPriceCents({ quantity: qty, mode }) : null;
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} className="input" {...props} /></div>
  );
  return (
    <form action={action} className="card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="quantity">Number of cards</label>
          <input id="quantity" name="quantity" type="number" min={MIN_QUANTITY} max={1000} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="mode">Delivery</label>
          <select id="mode" name="mode" className="input" value={mode} onChange={(e) => setMode(e.target.value as PrintMode)}>
            <option value="host">Ship all cards to me</option>
            <option value="guests">Mail to each guest (we&apos;ll email you to collect addresses)</option>
          </select>
        </div>
        {field("name", "Recipient name", { required: true, autoComplete: "name" })}
        {field("phone", "Phone (for the courier)", { autoComplete: "tel" })}
        {field("line1", "Address line 1", { required: true, autoComplete: "address-line1" })}
        {field("line2", "Address line 2", { autoComplete: "address-line2" })}
        {field("city", "City", { required: true, autoComplete: "address-level2" })}
        {field("region", "State / province", { autoComplete: "address-level1" })}
        {field("postal_code", "Postal code", { required: true, autoComplete: "postal-code" })}
        {field("country", "Country (2-letter code, e.g. PH, US)", { required: true, maxLength: 2, autoComplete: "country", style: { textTransform: "uppercase" } })}
      </div>
      {price && (
        <p className="rounded-xl bg-champagne-soft p-3 text-sm" aria-live="polite">
          {qty} × {usd(price.unitCents)} + {mode === "host" ? "shipping" : "mailing"} {usd(price.shippingCents)} = <strong>{usd(price.totalCents)}</strong>
        </p>
      )}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary" disabled={pending || !price}>{pending ? "Starting checkout…" : "Pay and order"}</button>
    </form>
  );
}
