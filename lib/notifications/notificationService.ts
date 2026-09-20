import "server-only";
import { siteConfig } from "@/config/site";
import { paymentConfig } from "@/config/payment";
import { prisma } from "@/lib/db/prisma";
import { sendEmail, type EmailResult } from "@/lib/email/providers";
import { button, itemsTable, layout, paragraph } from "@/lib/email/templates";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/settings/settingsService";
import { sendSms } from "@/lib/sms/providers";
import { emitStoreEvent } from "@/lib/webhooks/dispatcher";

/**
 * Store notifications, gated by Settings → Notifications. Every sender is a
 * no-op (logged in development) when no provider is configured; nothing is
 * pretended to have been sent.
 */
async function brand() {
  const [general, branding, seo] = await Promise.all([getSettings("general"), getSettings("branding"), getSettings("seo")]);
  const siteUrl = (seo.canonicalBaseUrl || siteConfig.url).replace(/\/$/, "");
  const absolute = (url: string) => (url.startsWith("/") ? `${siteUrl}${url}` : url);
  return { storeName: general.storeName, logoUrl: branding.emailLogo ? absolute(branding.emailLogo) : branding.logoLight ? absolute(branding.logoLight) : null, color: branding.primaryColor, siteUrl, supportEmail: general.supportEmail };
}

const devLog = (result: EmailResult, what: string) => {
  if (!result.sent && process.env.NODE_ENV !== "production") console.info(`[email] ${what} not sent: ${result.error}`);
  return result;
};

async function orderView(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true, shippingAddress: true, shipment: true } });
}

type OrderView = NonNullable<Awaited<ReturnType<typeof orderView>>>;

function orderSummary(order: OrderView) {
  const money = (minor: bigint) => formatMoney(Number(minor) / 100, order.currency);
  const items = order.items.map((item) => ({ name: item.productName, detail: `${item.sizeName} / ${item.colorName}`, quantity: item.quantity, total: money(item.lineTotal) }));
  const totals = [
    { label: "Subtotal", value: money(order.subtotal) },
    { label: "Shipping", value: order.shippingAmount === BigInt(0) ? "Free" : money(order.shippingAmount) },
    ...(order.taxAmount > BigInt(0) ? [{ label: order.total === order.subtotal + order.shippingAmount ? "Tax (included)" : "Tax", value: money(order.taxAmount) }] : []),
    { label: "Total", value: money(order.total) },
  ];
  const text = `${order.items.map((item) => `${item.productName} (${item.sizeName}/${item.colorName}) × ${item.quantity}`).join("\n")}\nTotal: ${money(order.total)}`;
  return { html: itemsTable(items, totals), text };
}

/** Customer order confirmation. Returns whether an email actually left. */
export async function sendOrderConfirmationEmail(orderId: string): Promise<EmailResult> {
  const settings = await getSettings("notifications");
  if (!settings.orderConfirmation) return { sent: false, provider: "none", error: "Order confirmation emails are switched off." };
  const order = await orderView(orderId);
  if (!order) return { sent: false, provider: "none", error: "Order not found." };
  const b = await brand();
  const summary = orderSummary(order);
  const link = `${b.siteUrl}${paymentConfig.confirmationPath(order.publicToken)}`;
  const content = layout(b, `Thank you. Order ${order.orderNumber} is confirmed.`, `${paragraph("We’ve received your order and will let you know when it ships.")}${summary.html}${button(b, link, "View your order")}`, `We’ve received your order.\n\n${summary.text}\n\nView your order: ${link}`);
  return devLog(await sendEmail({ to: order.email, subject: `Order ${order.orderNumber} confirmed`, ...content }), "Order confirmation");
}

/** Team notice for a new paid order, and low-stock checks for what it sold. */
export async function notifyOrderPaid(orderId: string) {
  const settings = await getSettings("notifications");
  const order = await orderView(orderId);
  if (!order) return;
  if (settings.paymentConfirmation) {
    const b = await brand();
    const content = layout(b, `Payment received for ${order.orderNumber}`, paragraph(`We received ${formatMoney(Number(order.total) / 100, order.currency)}. Thank you.`), `We received ${formatMoney(Number(order.total) / 100, order.currency)}.`);
    devLog(await sendEmail({ to: order.email, subject: `Payment received — ${order.orderNumber}`, ...content }), "Payment receipt");
  }
  if (settings.adminNewOrder && settings.adminRecipients.length) {
    const b = await brand();
    const summary = orderSummary(order);
    const content = layout(b, `New order ${order.orderNumber}`, `${paragraph(`${order.email} placed an order.`)}${summary.html}`, `${order.email} placed an order.\n\n${summary.text}`);
    for (const to of settings.adminRecipients) devLog(await sendEmail({ to, subject: `New order ${order.orderNumber}`, ...content }), "New order notice");
  }
  await checkLowStock(order.items.map((item) => item.variantId).filter((id): id is string => Boolean(id)));
}

/** Emails the team and emits INVENTORY_LOW for variants at or below the threshold. */
export async function checkLowStock(variantIds: string[]) {
  if (!variantIds.length) return;
  const [{ lowStockThreshold }, settings] = await Promise.all([getSettings("inventory"), getSettings("notifications")]);
  const rows = await prisma.productVariant.findMany({ where: { id: { in: variantIds }, enabled: true }, include: { inventory: true, product: { select: { name: true } }, color: true, size: true } });
  const low = rows
    .map((row) => ({ sku: row.sku, name: `${row.product.name} — ${row.color.name} / ${row.size.name}`, available: (row.inventory?.quantity ?? 0) - (row.inventory?.reservedQuantity ?? 0) }))
    .filter((row) => row.available <= lowStockThreshold);
  if (!low.length) return;
  await emitStoreEvent("INVENTORY_LOW", { threshold: lowStockThreshold, variants: low.map(({ sku, available }) => ({ sku, available })) });
  if (settings.adminLowStock && settings.adminRecipients.length) {
    const b = await brand();
    const lines = low.map((row) => `${row.name} (${row.sku}): ${row.available} left`);
    const content = layout(b, "Low stock", lines.map(paragraph).join(""), lines.join("\n"));
    for (const to of settings.adminRecipients) devLog(await sendEmail({ to, subject: `Low stock: ${low.length} variant${low.length === 1 ? "" : "s"}`, ...content }), "Low stock notice");
  }
}

/** Customer notices and webhooks when an admin moves an order forward. */
export async function notifyOrderStatus(orderId: string, status: "SHIPPED" | "DELIVERED" | "CANCELLED" | "PROCESSING") {
  const order = await orderView(orderId);
  if (!order) return;
  const event = status === "SHIPPED" ? "ORDER_SHIPPED" : status === "DELIVERED" ? "ORDER_DELIVERED" : status === "CANCELLED" ? "ORDER_CANCELLED" : null;
  if (event) await emitStoreEvent(event, { orderNumber: order.orderNumber, ...(order.shipment?.trackingNumber && status === "SHIPPED" ? { carrier: order.shipment.carrier, trackingNumber: order.shipment.trackingNumber } : {}) });
  const settings = await getSettings("notifications");
  const b = await brand();
  const tracking = order.shipment?.trackingUrl ? button(b, order.shipment.trackingUrl, "Track your parcel") : "";
  if (status === "SHIPPED" && settings.orderShipped) {
    const detail = order.shipment?.trackingNumber ? `${order.shipment.carrier ?? "Tracking"}: ${order.shipment.trackingNumber}` : "It’s on its way.";
    devLog(await sendEmail({ to: order.email, subject: `Order ${order.orderNumber} has shipped`, ...layout(b, "Your order has shipped", `${paragraph(detail)}${tracking}`, `${detail}${order.shipment?.trackingUrl ? `\nTrack: ${order.shipment.trackingUrl}` : ""}`) }), "Shipped notice");
  }
  if (status === "DELIVERED" && settings.orderDelivered) {
    devLog(await sendEmail({ to: order.email, subject: `Order ${order.orderNumber} delivered`, ...layout(b, "Delivered", paragraph("Your order has been delivered. Enjoy it."), "Your order has been delivered.") }), "Delivered notice");
  }
  if (status === "CANCELLED" && settings.orderCancelled) {
    devLog(await sendEmail({ to: order.email, subject: `Order ${order.orderNumber} cancelled`, ...layout(b, "Your order was cancelled", paragraph("If you were charged, the refund is processed separately. Reply to this email with any questions."), "Your order was cancelled. If you were charged, the refund is processed separately.") }), "Cancelled notice");
  }
  const phone = order.shippingAddress?.phone;
  if (phone && ((status === "SHIPPED" && settings.smsOrderShipped) || (status === "DELIVERED" && settings.smsOrderDelivered))) {
    const result = await sendSms({ to: phone, body: `${b.storeName}: order ${order.orderNumber} ${status === "SHIPPED" ? "has shipped" : "was delivered"}.`, template: status === "SHIPPED" ? "shipped" : "delivered", variables: { order: order.orderNumber } });
    if (!result.sent && process.env.NODE_ENV !== "production") console.info(`[sms] ${status} text not sent: ${result.error}`);
  }
}
