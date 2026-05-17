import { Navigate, Route, Routes } from "react-router-dom";
import { AdminRoute } from "@/components/AdminRoute";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/layout/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { DepositPage } from "@/pages/DepositPage";
import { AdminDepositsPage } from "@/pages/AdminDepositsPage";
import { AdminIdentityVerificationsPage } from "@/pages/AdminIdentityVerificationsPage";
import { AdminConsolePage } from "@/pages/AdminConsolePage";
import { LoginPage } from "@/pages/LoginPage";
import { OoveLandingPage } from "@/pages/OoveLandingPage";
import { OnboardingCarousel } from "@/pages/onboarding/OnboardingCarousel";
import { SignupWizard } from "@/pages/signup/SignupWizard";
import { VerifyEmailPage } from "@/pages/signup/VerifyEmailPage";
import { RequestVerificationCodePage } from "@/pages/signup/RequestVerificationCodePage";
import { BorrowPage } from "@/pages/BorrowPage";
import { IdentityVerificationPage } from "@/pages/IdentityVerificationPage";
import { PortfolioPage } from "@/pages/PortfolioPage";
import { TransfersPage } from "@/pages/TransfersPage";
import { WatchlistPage } from "@/pages/WatchlistPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { FixedPlansPage } from "@/pages/FixedPlansPage";
import { FixedPlanCreatePage } from "@/pages/FixedPlanCreatePage";
import { AdminFixedSavingsPage } from "@/pages/AdminFixedSavingsPage";
import { AdminAiTradingPage } from "@/pages/AdminAiTradingPage";
import { AiTradingShell } from "@/layout/AiTradingShell";
import { AiTradingPortfolioPage } from "@/pages/ai-trading/AiTradingPortfolioPage";
import { AiTradingMarketsPage } from "@/pages/ai-trading/AiTradingMarketsPage";
import { AiTradingRunningPage } from "@/pages/ai-trading/AiTradingRunningPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OoveLandingPage />} />
      <Route path="/onboarding" element={<OnboardingCarousel />} />
      <Route path="/signup" element={<SignupWizard />} />
      <Route path="/verify/request" element={<RequestVerificationCodePage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AiTradingShell />}>
          <Route path="ai-trading" element={<AiTradingPortfolioPage />} />
          <Route path="ai-trading/markets" element={<AiTradingMarketsPage />} />
          <Route path="ai-trading/trade/:id" element={<AiTradingRunningPage />} />
        </Route>
        <Route element={<AppShell />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="deposit" element={<DepositPage />} />
          <Route path="borrow" element={<BorrowPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="fixed-plans" element={<FixedPlansPage />} />
          <Route path="fixed-plans/create/:planId" element={<FixedPlanCreatePage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verify-identity" element={<IdentityVerificationPage />} />
          <Route
            path="admin/console"
            element={
              <AdminRoute>
                <AdminConsolePage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/deposits"
            element={
              <AdminRoute>
                <AdminDepositsPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/identity"
            element={
              <AdminRoute>
                <AdminIdentityVerificationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/fixed-savings"
            element={
              <AdminRoute>
                <AdminFixedSavingsPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/ai-trading"
            element={
              <AdminRoute>
                <AdminAiTradingPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
