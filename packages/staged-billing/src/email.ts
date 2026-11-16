// Test support only. The JobsOxo app renders this block in its invoice email
// from server/email.ts; this is the minimal stand-in the shared test needs so
// the test file can stay identical to the app's. It is not exported from the
// package.
import { isStaged, stageDisplayName } from "./index";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

/** Contract context shown in the email for a staged invoice; empty for a standard one. */
export function stagedContextHtml(invoice: {
  stage?: string | null;
  stageNumber?: number | null;
  contractTotal?: string | number | null;
  previouslyInvoiced?: string | number | null;
  previouslyPaid?: string | number | null;
}): string {
  if (!isStaged(invoice.stage)) return "";
  const contract = Number(invoice.contractTotal) || 0;
  const invoiced = Number(invoice.previouslyInvoiced) || 0;
  const paid = Number(invoice.previouslyPaid) || 0;
  return [
    `<p><strong>${stageDisplayName(invoice.stage, invoice.stageNumber)}</strong> on a ${money(contract)} contract.</p>`,
    `<p><strong>Invoiced to date:</strong> ${money(invoiced)}<br><strong>Paid to date:</strong> ${money(paid)}</p>`,
  ].join("\n");
}
