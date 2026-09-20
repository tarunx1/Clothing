import "server-only";

/** Minimal, inline-styled transactional templates. All interpolated text is escaped. */
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

interface Brand { storeName: string; logoUrl: string | null; color: string; siteUrl: string; supportEmail: string }

export function layout(brand: Brand, title: string, bodyHtml: string, bodyText: string) {
  const logo = brand.logoUrl ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.storeName)}" height="28" style="height:28px">` : `<strong style="font-size:16px;letter-spacing:-.02em">${escapeHtml(brand.storeName)}</strong>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#161616">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e2dc;border-radius:8px"><tr><td style="padding:28px">
${logo}
<h1 style="margin:28px 0 12px;font-size:22px;letter-spacing:-.01em">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:28px 0 0;color:#8d8d85;font-size:12px">${escapeHtml(brand.storeName)}${brand.supportEmail ? ` · ${escapeHtml(brand.supportEmail)}` : ""}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${brand.storeName}\n\n${title}\n\n${bodyText}\n\n${brand.supportEmail ? `Questions? ${brand.supportEmail}` : ""}`.trim();
  return { html, text };
}

export const button = (brand: Brand, href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;background:${escapeHtml(brand.color)};color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">${escapeHtml(label)}</a></p>`;

export const paragraph = (text: string) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#3d3d38">${escapeHtml(text)}</p>`;

export function itemsTable(items: { name: string; detail: string; quantity: number; total: string }[], totals: { label: string; value: string }[]) {
  const rows = items.map((item) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px"><strong>${escapeHtml(item.name)}</strong><br><span style="color:#8d8d85">${escapeHtml(item.detail)} · Qty ${item.quantity}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px">${escapeHtml(item.total)}</td></tr>`).join("");
  const sums = totals.map((row) => `<tr><td style="padding:4px 0;font-size:13px;color:#66665f">${escapeHtml(row.label)}</td><td align="right" style="padding:4px 0;font-size:13px">${escapeHtml(row.value)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}${sums}</table>`;
}
