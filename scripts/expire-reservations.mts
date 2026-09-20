/** Releases stock held by abandoned checkouts. Schedule every few minutes (cron, Vercel Cron, etc.). */
const { expireAbandonedOrders } = await import("@/lib/services/orderService");
const { prisma } = await import("@/lib/db/prisma");
const expired = await expireAbandonedOrders();
console.log(JSON.stringify({ expired }));
await prisma.$disconnect();
