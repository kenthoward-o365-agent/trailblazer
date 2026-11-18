import { format } from "date-fns";
import { parseLocalDate } from "./dateUtils";

export interface FolioPrintPosting {
  posting_date: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  posting_type?: string;
  accounts?: { code?: string | null; name?: string | null } | null;
}

export interface FolioPrintGuest {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface FolioPrintReservation {
  confirmation_number?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  adults_count?: number | null;
  children_count?: number | null;
  site_number?: string | null;
}

export interface FolioPrintProperty {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone1?: string | null;
  email?: string | null;
}

export type FolioPrintMode = "detail" | "summary";

export interface BuildFolioHtmlOptions {
  mode: FolioPrintMode;
  property: FolioPrintProperty | null;
  guest: FolioPrintGuest | null;
  reservation: FolioPrintReservation | null;
  postings: FolioPrintPosting[];
  balance: number;
  siteTerminology?: string;
  title?: string;
  // When true, omit auto window.print() script (used for iframe preview)
  suppressAutoPrint?: boolean;
}

const fmtCurrency = (amount: number) =>
  `$${Math.abs(amount).toFixed(2)}${amount < 0 ? " CR" : ""}`;

function summarize(postings: FolioPrintPosting[]) {
  const map = postings.reduce(
    (acc, p) => {
      const key = p.accounts?.code || "OTHER";
      const name =
        p.accounts?.name || (p.posting_type === "payment" ? "Payments" : "Other");
      if (!acc[key]) {
        acc[key] = { code: key, name, debits: 0, credits: 0, descriptions: [] as string[] };
      }
      acc[key].debits += p.debit_amount || 0;
      acc[key].credits += p.credit_amount || 0;
      if (p.description?.trim()) acc[key].descriptions.push(p.description.trim());
      return acc;
    },
    {} as Record<
      string,
      { code: string; name: string; debits: number; credits: number; descriptions: string[] }
    >,
  );
  const rows = Object.values(map).sort((a, b) => a.code.localeCompare(b.code));
  const totals = {
    debits: rows.reduce((s, r) => s + r.debits, 0),
    credits: rows.reduce((s, r) => s + r.credits, 0),
  };
  return { rows, totals };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const e = (v: unknown) => (v == null ? "" : escapeHtml(String(v)));

export function buildFolioHtml(opts: BuildFolioHtmlOptions): string {
  const {
    mode,
    property,
    guest,
    reservation,
    postings,
    balance,
    siteTerminology = "Site",
    title,
    suppressAutoPrint,
  } = opts;

  const detailRows = postings
    .map((p) => {
      const d = parseLocalDate(p.posting_date);
      const dateStr = d ? format(d, "MM/dd") : "";
      return `
        <tr>
          <td>${e(dateStr)}</td>
          <td>${e(p.accounts?.name || "-")}</td>
          <td>${e(p.description || "")}</td>
          <td class="text-right">${p.debit_amount ? fmtCurrency(p.debit_amount) : ""}</td>
          <td class="text-right credit">${p.credit_amount ? fmtCurrency(p.credit_amount) : ""}</td>
          <td class="text-right">${fmtCurrency(p.running_balance)}</td>
        </tr>`;
    })
    .join("");

  const { rows: summaryRows, totals: summaryTotals } = summarize(postings);
  const summaryHtml = summaryRows
    .map((row) => {
      const uniq = [...new Set(row.descriptions)].slice(0, 3).join(", ");
      const trunc = uniq.length > 40 ? uniq.substring(0, 37) + "..." : uniq;
      return `
        <tr>
          <td class="mono">${e(row.code)}</td>
          <td>${e(row.name)}</td>
          <td>${e(trunc)}</td>
          <td class="text-right">${row.debits > 0 ? fmtCurrency(row.debits) : ""}</td>
          <td class="text-right credit">${row.credits > 0 ? fmtCurrency(row.credits) : ""}</td>
        </tr>`;
    })
    .join("");

  const tableContent =
    mode === "detail"
      ? `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Account Name</th>
            <th>Description</th>
            <th class="text-right">Debit</th>
            <th class="text-right">Credit</th>
            <th class="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>${detailRows || `<tr><td colspan="6" style="text-align:center;padding:12px;color:#666;">No postings yet</td></tr>`}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="5"><strong>Balance Due</strong></td>
            <td class="text-right"><strong>${fmtCurrency(balance)}</strong></td>
          </tr>
        </tfoot>
      </table>`
      : `
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Account</th>
            <th>Details</th>
            <th class="text-right">Total Charges</th>
            <th class="text-right">Total Payments</th>
          </tr>
        </thead>
        <tbody>${summaryHtml || `<tr><td colspan="5" style="text-align:center;padding:12px;color:#666;">No postings yet</td></tr>`}</tbody>
        <tfoot>
          <tr class="subtotal-row">
            <td colspan="3"><strong>Totals</strong></td>
            <td class="text-right"><strong>${fmtCurrency(summaryTotals.debits)}</strong></td>
            <td class="text-right credit"><strong>${fmtCurrency(summaryTotals.credits)}</strong></td>
          </tr>
          <tr class="total-row">
            <td colspan="4"><strong>Balance Due</strong></td>
            <td class="text-right"><strong>${fmtCurrency(balance)}</strong></td>
          </tr>
        </tfoot>
      </table>`;

  const propAddress = [property?.address, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(", ");
  const guestAddress = [guest?.address, guest?.city, guest?.state, guest?.zip]
    .filter(Boolean)
    .join(", ");
  const inDate = reservation?.check_in_date ? parseLocalDate(reservation.check_in_date) : null;
  const outDate = reservation?.check_out_date ? parseLocalDate(reservation.check_out_date) : null;

  const docTitle = title || `Folio - ${guest?.first_name || ""} ${guest?.last_name || ""}`.trim();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${e(docTitle)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 14px 18px; max-width: 820px; margin: 0 auto; line-height: 1.35; color: #111; }
  .header { text-align: center; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 10px; }
  .header h1 { font-size: 16px; margin: 0 0 2px 0; }
  .header .sub { color: #555; font-size: 10px; margin: 0; }
  .badge { display: inline-block; margin-top: 4px; padding: 2px 8px; border: 1px solid #333; border-radius: 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .guest-info { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 10px; }
  .guest-info p { margin: 0; }
  .guest-info .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px; }
  th { background: #f0f0f0; font-weight: bold; }
  .text-right { text-align: right; }
  .credit { color: #059669; }
  .mono { font-family: monospace; }
  .subtotal-row td { border-top: 1px solid #666; background: #fafafa; }
  .total-row td { border-top: 2px solid #333; background: #f4f4f4; }
  .footer { text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 10px; }
  @media print { @page { margin: 0.4cm; size: auto; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${e(property?.name || "Property")}</h1>
    ${propAddress ? `<p class="sub">${e(propAddress)}</p>` : ""}
    ${property?.phone1 || property?.email ? `<p class="sub">${e([property?.phone1, property?.email].filter(Boolean).join(" · "))}</p>` : ""}
    <div class="badge">Guest Folio — ${mode === "detail" ? "Detail" : "Summary"}</div>
  </div>
  <div class="guest-info">
    <div class="left">
      <p><strong>${e(`${guest?.first_name || ""} ${guest?.last_name || ""}`.trim() || "Guest")}</strong></p>
      ${guestAddress ? `<p>${e(guestAddress)}</p>` : ""}
      ${guest?.email ? `<p>${e(guest.email)}</p>` : ""}
      ${guest?.phone ? `<p>${e(guest.phone)}</p>` : ""}
    </div>
    <div class="right">
      <p>${e(siteTerminology)} ${e(reservation?.site_number || "N/A")}</p>
      <p>${e(inDate ? format(inDate, "MM/dd/yyyy") : "")} – ${e(outDate ? format(outDate, "MM/dd/yyyy") : "")}</p>
      <p>Confirmation #${e(reservation?.confirmation_number || "N/A")}</p>
      ${reservation?.adults_count != null ? `<p>${e(reservation.adults_count)} adults${reservation?.children_count ? `, ${e(reservation.children_count)} children` : ""}</p>` : ""}
    </div>
  </div>
  ${tableContent}
  <div class="footer">Printed ${e(format(new Date(), "MM/dd/yyyy HH:mm"))} · Thank you for staying with us.</div>
  ${suppressAutoPrint ? "" : `<script>window.onload=function(){setTimeout(function(){window.print();},150);}<\/script>`}
</body>
</html>`;
}
