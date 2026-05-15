import { AdminDepositReviewTable } from "@/components/AdminDepositReviewTable";

export function AdminDepositsPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Operations</p>
        <h1 className="text-3xl font-semibold">Deposit review queue</h1>
      </div>
      <AdminDepositReviewTable />
    </div>
  );
}
