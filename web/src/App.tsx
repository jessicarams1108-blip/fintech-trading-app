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
import { SupportPage } from "@/pages/SupportPage";
import { AdminSupportPage } from "@/pages/AdminSupportPage";
import { FixedPlansPage } from "@/pages/FixedPlansPage";
import { FixedPlanCreatePage } from "@/pages/FixedPlanCreatePage";
import { AdminFixedSavingsPage } from "@/pages/AdminFixedSavingsPage";
import { AdminAiTradingPage } from "@/pages/AdminAiTradingPage";
import { AiTradingPortfolioPage } from "@/pages/ai-trading/AiTradingPortfolioPage";
import { AiTradingMarketsPage } from "@/pages/ai-trading/AiTradingMarketsPage";
import { AiTradingRunningPage } from "@/pages/ai-trading/AiTradingRunningPage";
import { AiTradingInboxPage } from "@/pages/ai-trading/AiTradingInboxPage";
import { AiTradingAgentPage } from "@/pages/ai-trading/AiTradingAgentPage";
import { PublicLightTheme } from "@/components/PublicLightTheme";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLightTheme><OoveLandingPage /></PublicLightTheme>} />
      <Route path="/onboarding" element={<PublicLightTheme><OnboardingCarousel /></PublicLightTheme>} />
      <Route path="/signup" element={<PublicLightTheme><SignupWizard /></PublicLightTheme>} />
      <Route path="/verify/request" element={<PublicLightTheme><RequestVerificationCodePage /></PublicLightTheme>} />
      <Route path="/verify" element={<PublicLightTheme><VerifyEmailPage /></PublicLightTheme>} />
      <Route path="/login" element={<PublicLightTheme><LoginPage /></PublicLightTheme>} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="ai-trading" element={<AiTradingPortfolioPage />} />
          <Route path="ai-trading/markets" element={<AiTradingMarketsPage />} />
          <Route path="ai-trading/trade/:id" element={<AiTradingRunningPage />} />
          <Route path="ai-trading/inbox" element={<AiTradingInboxPage />} />
          <Route path="ai-trading/agent" element={<AiTradingAgentPage />} />
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
          <Route path="support" element={<SupportPage />} />
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
          <Route
            path="admin/support"
            element={
              <AdminRoute>
                <AdminSupportPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
