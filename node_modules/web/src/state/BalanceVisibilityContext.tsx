import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "oove.showPortfolioBalances";

function readStored(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "false") return false;
  if (v === "true") return true;
  return true;
}

type BalanceVisibilityContextValue = {
  /** When false, portfolio dollar/crypto amounts are masked (privacy). */
  showBalances: boolean;
  setShowBalances: (next: boolean) => void;
  toggleShowBalances: () => void;
};

const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue | null>(null);

export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [showBalances, setShowBalancesState] = useState<boolean>(readStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, showBalances ? "true" : "false");
  }, [showBalances]);

  const setShowBalances = useCallback((next: boolean) => {
    setShowBalancesState(next);
  }, []);

  const toggleShowBalances = useCallback(() => {
    setShowBalancesState((s) => !s);
  }, []);

  const value = useMemo(
    () => ({ showBalances, setShowBalances, toggleShowBalances }),
    [showBalances, setShowBalances, toggleShowBalances],
  );

  return <BalanceVisibilityContext.Provider value={value}>{children}</BalanceVisibilityContext.Provider>;
}

export function useBalanceVisibility() {
  const ctx = useContext(BalanceVisibilityContext);
  if (!ctx) throw new Error("useBalanceVisibility must be used within BalanceVisibilityProvider");
  return ctx;
}

const MASK = "••••••";

export function MaskedValue({ children }: { children: React.ReactNode }) {
  const { showBalances } = useBalanceVisibility();
  return <>{showBalances ? children : MASK}</>;
}
