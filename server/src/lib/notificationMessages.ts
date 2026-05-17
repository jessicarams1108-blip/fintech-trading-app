import type { HistoryEntry } from "../db/queries/history.js";

export type NotificationItem = {
  id: string;
  at: string;
  title: string;
  message: string;
  category: string;
  status: string;
  href: string;
  isPending: boolean;
};

const PENDING_STATUSES = new Set([
  "pending",
  "pending_review",
  "pending_admin",
  "queued",
  "submitted",
  "under_review",
  "processing",
]);

function isPendingStatus(status: string): boolean {
  return PENDING_STATUSES.has(status.toLowerCase());
}

function stripAdminCopy(text: string): string {
  return text
    .replace(/pending_admin/gi, "pending")
    .replace(/\badmin\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fmtAmount(asset: string | null, amount: string | null): string {
  if (!amount) return "";
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n)) return amount;
  const sym = asset && asset !== "USD" ? `${n.toLocaleString()} ${asset}` : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return sym;
}

export function historyEntryToNotification(entry: HistoryEntry): NotificationItem {
  const st = String(entry.status ?? "unknown").toLowerCase();
  const amt = fmtAmount(entry.asset, entry.amount);
  const pending = isPendingStatus(st);

  switch (entry.type) {
    case "deposit": {
      if (st === "confirmed") {
        return {
          id: entry.id,
          at: entry.at,
          category: "deposit",
          status: entry.status,
          isPending: false,
          title: "Deposit confirmed",
          message: amt ? `${amt} credited to your CashBox` : "Your deposit was credited",
          href: "/history?type=deposit",
        };
      }
      if (st === "rejected") {
        return {
          id: entry.id,
          at: entry.at,
          category: "deposit",
          status: entry.status,
          isPending: false,
          title: "Deposit rejected",
          message: entry.detail ?? "Review your proof and try again",
          href: "/deposit",
        };
      }
      return {
        id: entry.id,
        at: entry.at,
        category: "deposit",
        status: entry.status,
        isPending: true,
        title: "Deposit under review",
        message: amt ? `${amt} · waiting for operations` : "Your deposit proof is being reviewed",
        href: "/deposit",
      };
    }
    case "withdrawal": {
      return {
        id: entry.id,
        at: entry.at,
        category: "withdrawal",
        status: entry.status,
        isPending: pending,
        title: pending ? "Withdrawal pending" : st === "completed" ? "Withdrawal completed" : "Withdrawal update",
        message: amt ? `${amt}${entry.detail ? ` · ${entry.detail}` : ""}` : entry.detail ?? "Withdrawal request",
        href: "/history?type=withdrawal",
      };
    }
    case "borrow":
      return {
        id: entry.id,
        at: entry.at,
        category: "borrow",
        status: entry.status,
        isPending: pending,
        title: pending ? "Borrow pending" : "Borrow update",
        message: amt ? `${entry.asset ?? "USD"} borrow · ${amt}` : `Borrow position · ${entry.status}`,
        href: "/borrow",
      };
    case "borrow_request":
      return {
        id: entry.id,
        at: entry.at,
        category: "borrow",
        status: entry.status,
        isPending: pending,
        title: pending ? "Borrow request queued" : "Borrow request update",
        message: amt ? `Requested ${amt}` : "Borrow request awaiting approval",
        href: "/borrow",
      };
    case "transfer": {
      const send = entry.direction === "send";
      return {
        id: entry.id,
        at: entry.at,
        category: "transfer",
        status: entry.status,
        isPending: pending,
        title: send ? (pending ? "Transfer sending" : "Transfer sent") : pending ? "Transfer incoming" : "Transfer received",
        message: amt ? `${send ? "Sent" : "Received"} ${amt}` : entry.detail ?? "Internal transfer",
        href: "/transfers",
      };
    }
    case "fixed_savings": {
      if (st === "matured") {
        return {
          id: entry.id,
          at: entry.at,
          category: "fixed_savings",
          status: entry.status,
          isPending: false,
          title: "Fixed savings matured",
          message: entry.detail ? `${entry.detail} · withdraw to CashBox` : amt ? `${amt} ready to withdraw` : "Plan reached maturity",
          href: "/fixed-plans?tab=my",
        };
      }
      if (st === "withdrawn" || st === "renewed") {
        return {
          id: entry.id,
          at: entry.at,
          category: "fixed_savings",
          status: entry.status,
          isPending: false,
          title: st === "withdrawn" ? "Fixed savings withdrawn" : "Fixed savings renewed",
          message: entry.detail ?? (amt ? `${amt} payout` : "Plan closed"),
          href: "/fixed-plans?tab=my",
        };
      }
      return {
        id: entry.id,
        at: entry.at,
        category: "fixed_savings",
        status: entry.status,
        isPending: st === "active",
        title: "Fixed savings active",
        message: entry.detail ? `${entry.detail}${amt ? ` · ${amt}` : ""}` : amt ? `Locked ${amt}` : "Savings plan running",
        href: "/fixed-plans?tab=my",
      };
    }
    case "identity": {
      if (st === "approved" || st === "verified") {
        return {
          id: entry.id,
          at: entry.at,
          category: "identity",
          status: entry.status,
          isPending: false,
          title: "Identity verified",
          message: "You can borrow and use full platform features",
          href: "/settings",
        };
      }
      if (st === "rejected") {
        return {
          id: entry.id,
          at: entry.at,
          category: "identity",
          status: entry.status,
          isPending: false,
          title: "Identity verification declined",
          message: "Submit updated documents to continue",
          href: "/verify-identity",
        };
      }
      return {
        id: entry.id,
        at: entry.at,
        category: "identity",
        status: entry.status,
        isPending: true,
        title: "Identity under review",
        message: "We will notify you when verification completes",
        href: "/verify-identity",
      };
    }
    default: {
      const reason = entry.detail ?? "";
      if (entry.type === "fixed_savings" || /fixed_savings/i.test(reason)) {
          return {
            id: entry.id,
            at: entry.at,
            category: "fixed_savings",
            status: entry.status,
            isPending: false,
            title: /payout|withdraw/i.test(reason) ? "Fixed savings payout" : "Fixed savings",
            message: amt ? `${amt} · ${reason.replace(/_/g, " ")}` : reason.replace(/_/g, " "),
            href: "/fixed-plans?tab=my",
          };
      }
      const credit = entry.direction === "credit";
      return {
        id: entry.id,
        at: entry.at,
        category: entry.type === "ledger" ? "ledger" : entry.type,
        status: entry.status,
        isPending: false,
        title: entry.detail?.replace(/_/g, " ") ?? "Account activity",
        message: amt ? `${credit ? "+" : "-"}${amt}` : entry.detail ?? "Ledger entry",
        href: "/history?type=ledger",
      };
    }
  }
}

export function mapHistoryToNotifications(entries: HistoryEntry[], limit: number): NotificationItem[] {
  const seen = new Set<string>();
  const out: NotificationItem[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const n = historyEntryToNotification(e);
    out.push({
      ...n,
      title: stripAdminCopy(n.title),
      message: stripAdminCopy(n.message),
    });
    if (out.length >= limit) break;
  }
  return out;
}
