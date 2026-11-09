/** The site charges in Philippine pesos. Amounts are integer centavos everywhere (₱1,999.00 = 199900). */
export const CURRENCY = "PHP";

export function formatPeso(cents: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: CURRENCY, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

/** PayPal wants a decimal string like "1999.00". */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}
