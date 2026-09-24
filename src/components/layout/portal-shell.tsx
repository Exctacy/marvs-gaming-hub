"use client";

import { useState, createContext, useContext } from "react";
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
  const [branchId, setBranchId] = useState<string | null>(defaultBranchId || branches[0]?.id || null);

  return (
    <PortalUserContext.Provider value={user}>
      <BranchContext.Provider value={{ branchId, setBranchId }}>
        <div className="min-h-screen bg-slate-50">
          <Sidebar
            user={user}
            branches={branches}
            currentBranchId={branchId}
            onBranchChange={setBranchId}
          />
          <main className="lg:pl-64 min-h-screen">
            <div className="p-4 sm:p-6 lg:p-8 pt-14 lg:pt-6">{children}</div>
          </main>
        </div>
      </BranchContext.Provider>
    </PortalUserContext.Provider>
  );
}
