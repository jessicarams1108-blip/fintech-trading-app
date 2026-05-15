import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { socketOrigin } from "@/lib/apiBase";
import { useAuth } from "@/state/AuthContext";

export type DepositConfirmedPayload = {
  depositId: string;
  asset: string;
  amount: number;
};

/**
 * Subscribes to `deposit:confirmed` on the API Socket.IO namespace (same origin, `/socket.io`).
 * Uses a ref for the handler so the socket is not recreated on every render.
 */
export function useDepositConfirmedSocket(
  onConfirmed: (payload: DepositConfirmedPayload) => void,
  options?: { onMarketPrices?: () => void },
) {
  const { token } = useAuth();
  const cbRef = useRef(onConfirmed);
  cbRef.current = onConfirmed;
  const marketRef = useRef(options?.onMarketPrices);
  marketRef.current = options?.onMarketPrices;

  useEffect(() => {
    if (!token) return;

    let socket: Socket | null = null;
    try {
      // Default: polling first, then upgrade to WebSocket. Forcing ["websocket"] only breaks behind Vite’s dev proxy.
      socket = io(socketOrigin(), {
        path: "/socket.io",
        auth: { token },
        reconnectionAttempts: 6,
        reconnectionDelay: 1500,
      });
      socket.on("connect_error", (err: Error) => {
        const msg = err?.message ?? "";
        if (/unauthorized|Unauthorized|invalid token|jwt/i.test(msg)) {
          socket?.disconnect();
        }
      });
      socket.on("deposit:confirmed", (raw: unknown) => {
        const p = raw as { depositId?: string; asset?: string; amount?: number };
        cbRef.current({
          depositId: String(p.depositId ?? ""),
          asset: String(p.asset ?? ""),
          amount: typeof p.amount === "number" && Number.isFinite(p.amount) ? p.amount : Number(p.amount ?? 0),
        });
      });
      socket.on("market:prices", () => {
        marketRef.current?.();
      });
    } catch {
      /* offline / blocked websocket */
    }

    return () => {
      socket?.disconnect();
    };
  }, [token]);
}
