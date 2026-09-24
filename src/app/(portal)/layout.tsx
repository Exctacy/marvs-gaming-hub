import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  const [branch, branches] = await Promise.all([
    session.branchId
      ? prisma.branch.findUnique({
          where: { id: session.branchId },
          select: { name: true, code: true },
        })
      : null,
    session.role === "super_admin" || session.role === "management"
      ? prisma.branch.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <PortalShell
      user={{
        id: session.id,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
        branchId: session.branchId,
        mustChangePassword: session.mustChangePassword,
        branch: branch ? { name: branch.name, code: branch.code } : null,
      }}
      branches={branches}
      defaultBranchId={session.branchId}
    >
      {children}
    </PortalShell>
  );
}
