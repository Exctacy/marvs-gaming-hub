"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { Sidebar } from "./sidebar";

interface BranchContextValue {
  branchId: string | null;
  setBranchId: (id: string) => void;
}

export interface PortalUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  branchId: string | null;
  mustChangePassword: boolean;
}

const PortalUserContext = createContext<PortalUser | null>(null);

const BranchContext = createContext<BranchContextValue>({
  branchId: null,
  setBranchId: () => {},
});

export function useBranch() {
  return useContext(BranchContext);
}

export function usePortalUser() {
  return useContext(PortalUserContext);
}

interface PortalShellProps {
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    branchId: string | null;
    mustChangePassword: boolean;
    branch?: { name: string; code: string } | null;
  };
  branches: { id: string; name: string; code: string }[];
  defaultBranchId?: string | null;
  children: React.ReactNode;
}

export function PortalShell({ user, branches, defaultBranchId, children }: PortalShellProps) {
  const canSwitchBranch = user.role === "super_admin" || user.role === "management";
  const fallbackBranchId = defaultBranchId || branches[0]?.id || null;
  const [branchId, setBranchIdState] = useState<string | null>(fallbackBranchId);
  const branchStorageKey = `marvs-active-branch:${user.id}`;

  useEffect(() => {
    if (!canSwitchBranch) return;

    const storedBranchId = window.localStorage.getItem(branchStorageKey);
    if (storedBranchId && branches.some((branch) => branch.id === storedBranchId)) {
      setBranchIdState(storedBranchId);
    }
  }, [branchStorageKey, canSwitchBranch, branches]);

  const setBranchId = (id: string) => {
    if (!id || !branches.some((branch) => branch.id === id)) return;
    setBranchIdState(id);
    if (canSwitchBranch) {
      window.localStorage.setItem(branchStorageKey, id);
    }
  };

  return (
    <PortalUserContext.Provider value={user}>
      <BranchContext.Provider value={{ branchId, setBranchId }}>
        <div className="min-h-screen bg-slate-50">
          <Sidebar user={user} />
          <main className="lg:pl-64 min-h-screen">
            <div className="p-4 sm:p-6 lg:p-8 pt-14 lg:pt-6">{children}</div>
          </main>
        </div>
      </BranchContext.Provider>
    </PortalUserContext.Provider>
  );
}
