import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDepositConfirmedSocket } from "@/hooks/useSocketNotifications";
import { useToast } from "@/state/ToastContext";

/**
 * Lives under the authenticated shell: refreshes caches when the server emits `deposit:confirmed`
 * for the signed-in user room.
 */
export function DepositSocketBridge() {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const onConfirmed = useCallback(
    (p: { depositId: string; asset: string; amount: number }) => {
      const amt =
        typeof p.amount === "number" && Number.isFinite(p.amount)
          ? p.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })
          : String(p.amount);
      showToast(`Deposit confirmed — ${p.asset} ${amt} credited.`);
      void qc.invalidateQueries({ queryKey: ["portfolio"] });
      void qc.invalidateQueries({ queryKey: ["liquidity"] });
      void qc.invalidateQueries({ queryKey: ["history"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["borrow"] });
      void qc.invalidateQueries({ queryKey: ["transfers"] });
      window.dispatchEvent(new CustomEvent("oove:deposits-activity-refresh"));
      window.dispatchEvent(new CustomEvent("oove:notifications-refresh"));
    },
    [qc, showToast],
  );

  const onMarketPrices = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["portfolio"] });
  }, [qc]);

  useDepositConfirmedSocket(onConfirmed, { onMarketPrices });
  return null;
}
