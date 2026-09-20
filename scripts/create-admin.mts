/**
 * Provision an admin or staff account. Nothing is hardcoded: the password comes
 * from ADMIN_PASSWORD or an interactive hidden prompt.
 *
 *   npm run admin:create -- --email owner@example.com --name "Store Owner" [--role ADMIN|STAFF] [--reset]
 *
 * --reset updates the password (and role/name) of an existing account and signs out its sessions.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

const { hashPassword, PASSWORD_MIN_LENGTH } = await import("@/lib/admin/password");
const { prisma } = await import("@/lib/db/prisma");

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "ADMIN" }, reset: { type: "boolean", default: false } },
});
const email = values.email?.trim().toLowerCase();
const role = values.role?.toUpperCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Pass --email with a valid address.");
if (role !== "ADMIN" && role !== "STAFF") throw new Error("--role must be ADMIN or STAFF.");

async function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error("Set ADMIN_PASSWORD or run in an interactive terminal.");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const output = rl as unknown as { _writeToOutput: (text: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  output._writeToOutput = (text) => { if (!muted || text.includes("\n")) output.output.write(muted ? "\n" : text); };
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
    muted = true;
  });
}

const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Password (min 12 characters): "));
if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
if (/^(password|admin|12345)/i.test(password)) throw new Error("Choose a less guessable password.");

const existing = await prisma.adminUser.findUnique({ where: { email } });
if (existing && !values.reset) throw new Error(`${email} already exists. Pass --reset to change its password.`);
const passwordHash = await hashPassword(password);
if (existing) {
  await prisma.adminUser.update({ where: { id: existing.id }, data: { passwordHash, role, active: true, ...(values.name ? { name: values.name } : {}) } });
  await prisma.adminSession.deleteMany({ where: { adminId: existing.id } });
  console.log(`Updated ${role.toLowerCase()} ${email}; existing sessions signed out.`);
} else {
  await prisma.adminUser.create({ data: { email, name: values.name?.trim() || email.split("@")[0], passwordHash, role } });
  console.log(`Created ${role.toLowerCase()} ${email}. Sign in at /admin/login.`);
}
await prisma.$disconnect();
