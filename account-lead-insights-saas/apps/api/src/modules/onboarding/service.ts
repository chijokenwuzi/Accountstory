export async function persistOnboardingStep(
  prisma: { onboardingStep: { upsert: (args: any) => Promise<any> } },
  orgId: string,
  stepName: string,
  dataJson: unknown,
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE"
) {
  return prisma.onboardingStep.upsert({
    where: { orgId_stepName: { orgId, stepName } },
    update: { dataJson, status },
    create: { orgId, stepName, dataJson, status }
  });
}
