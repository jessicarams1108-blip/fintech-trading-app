import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./state/ThemeContext";
import { BalanceVisibilityProvider } from "./state/BalanceVisibilityContext";
import { AuthProvider } from "./state/AuthContext";
import { ToastProvider } from "./state/ToastContext";
import { QueryProvider } from "./providers/QueryProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BalanceVisibilityProvider>
          <QueryProvider>
            <ThemeProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </ThemeProvider>
          </QueryProvider>
        </BalanceVisibilityProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
