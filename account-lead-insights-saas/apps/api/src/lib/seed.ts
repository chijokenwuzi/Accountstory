import { prisma } from "./prisma";
import { hashPassword } from "./auth";

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: {},
    create: { id: "seed-org", name: "Acme HVAC" }
  });

  const ownerPass = await hashPassword("Password123!");
  await prisma.user.upsert({
    where: { id: "seed-owner" },
    update: {},
    create: {
      id: "seed-owner",
      orgId: org.id,
      email: "owner@acme.com",
      name: "Owner User",
      role: "OWNER",
      passwordHash: ownerPass
    }
  });

  await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: {},
    create: { orgId: org.id, status: "TRIAL", plan: "starter" }
  });

  console.log("Seed complete");
}

main().finally(async () => prisma.$disconnect());
