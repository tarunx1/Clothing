import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Runs a Serializable transaction, retrying Postgres serialization conflicts (P2034). */
export async function withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2028");
      if (!retryable || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1) + Math.random() * 30));
    }
  }
  throw new Error("Serializable transaction retry limit reached.");
}
