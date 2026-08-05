import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/guards/ProtectedRoute";
import { RoleRoute } from "@/auth/guards/RoleRoute";
import DemoModeBanner from "@/demo-entry";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import PendingApproval from "./pages/PendingApproval.tsx";
import OnboardingDeposit from "./pages/OnboardingDeposit.tsx";
import PendingFunding from "./pages/PendingFunding.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Performance from "./pages/Performance.tsx";
import SignalLog from "./pages/SignalLog.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
import AdminInvestor from "./pages/AdminInvestor.tsx";
import Unauthorized from "./pages/auth/Unauthorized.tsx";
import Forbidden from "./pages/auth/Forbidden.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DemoModeBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<Navigate replace to="/login" />} />
            <Route path="/reset-password" element={<Navigate replace to="/login" />} />
            <Route path="/register" element={<Navigate replace to="/login" />} />
            <Route path="/create-account" element={<Navigate replace to="/login" />} />
            <Route path="/pending" element={<PendingApproval />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/onboarding/deposit" element={<OnboardingDeposit />} />
            <Route path="/onboarding/pending-funding" element={<PendingFunding />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/401" element={<Unauthorized />} />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route path="/403" element={<Forbidden />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/signals" element={<SignalLog />} />
              <Route path="/signal-log" element={<SignalLog />} />
              <Route path="/profile" element={<Profile />} />

              <Route element={<RoleRoute allowedRoles={["admin"]} />}>
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/investors/:investorId" element={<AdminInvestor />} />
              </Route>
            </Route>

            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
