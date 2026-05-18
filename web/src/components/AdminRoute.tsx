import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";

import { isAdminEmail } from "@/lib/adminAccess";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-12 text-slate-600">
        <p className="text-sm font-medium">Checking admin session…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminEmail(user.email)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
