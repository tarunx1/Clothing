import "server-only";
import { prisma } from "@/lib/db/prisma";
import { sendOrderConfirmationEmail } from "@/lib/notifications/notificationService";

/**
 * Order confirmation email boundary. Uses the provider from Settings → Email;
 * `confirmationSentAt` is set only when the provider accepted the message, so
 * nothing is pretended and the email is never sent twice.
 */
export async function sendOrderConfirmation(orderId: string): Promise<{ sent: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { confirmationSentAt: true } });
  if (!order || order.confirmationSentAt) return { sent: false };
  const result = await sendOrderConfirmationEmail(orderId);
  if (result.sent) await prisma.order.update({ where: { id: orderId }, data: { confirmationSentAt: new Date() } });
  return { sent: result.sent };
}
