import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "./components/ui/sonner";

// Pages
import HomePage from "./pages/HomePage";
import PricingPage from "./pages/PricingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EmailTemplates from "./pages/EmailTemplates";
import DashboardLayout from "./pages/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import CRM from "./pages/CRM";
import CustomerDetail from "./pages/CustomerDetail";
import Settings from "./pages/Settings";
import WidgetDemo from "./pages/WidgetDemo";
import SuperAdmin from "./pages/SuperAdmin";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import Providers from "./pages/Providers";
import Agents from "./pages/Agents";
import AgentEdit from "./pages/AgentEdit";
import StorageConfig from "./pages/StorageConfig";
import Analytics from "./pages/Analytics";
import RateLimits from "./pages/RateLimits";
import Marketplace from "./pages/Marketplace";
import Observability from "./pages/Observability";
import Billing from "./pages/Billing";
import Pricing from "./pages/Pricing";
import PlanManagement from "./pages/PlanManagement";
import Integrations from "./pages/Integrations";
import DiscountCodes from "./pages/DiscountCodes";
import Affiliates from "./pages/Affiliates";
import AdminPagesList from "./pages/AdminPagesList";
import PageEditor from "./pages/PageEditor";
import CustomPage from "./pages/CustomPage";
import GlobalComponents from "./pages/GlobalComponents";
import ComponentEditor from "./pages/ComponentEditor";
import MenusList from "./pages/MenusList";
import MenuEditor from "./pages/MenuEditor";
import FeatureGatesAdmin from "./pages/FeatureGatesAdmin";
import WaitlistAdmin from "./pages/WaitlistAdmin";
import CustomEmailsAdmin from "./pages/CustomEmailsAdmin";
import Messaging from "./pages/Messaging";
import KnowledgeBase from "./pages/KnowledgeBase";
import CompanyKnowledgeBase from "./pages/CompanyKnowledgeBase";
import CompanyKBEditor from "./pages/CompanyKBEditor";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Also check localStorage token for immediate redirect after login
  const hasToken = localStorage.getItem('token');
  if (isAuthenticated || hasToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/widget-demo" element={<WidgetDemo />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/privacy" element={<CustomPage />} />
      
      {/* Custom Pages Route - must be before catch-all */}
      <Route path="/page/:slug" element={<CustomPage />} />

      {/* Protected Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="conversations/:id" element={<ConversationDetail />} />
        <Route path="crm" element={<CRM />} />
        <Route path="crm/:customerId" element={<CustomerDetail />} />
        <Route path="messaging" element={<Messaging />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="team" element={<Team />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="knowledge-base" element={<KnowledgeBase />} />
        <Route path="admin" element={<SuperAdmin />} />
        <Route path="providers" element={<Providers />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/new" element={<AgentEdit />} />
        <Route path="agents/:agentId" element={<AgentEdit />} />
        <Route path="storage" element={<StorageConfig />} />
        <Route path="rate-limits" element={<RateLimits />} />
        <Route path="observability" element={<Observability />} />
        <Route path="billing" element={<Billing />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="admin/plans" element={<PlanManagement />} />
        <Route path="admin/feature-gates" element={<FeatureGatesAdmin />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="admin/discounts" element={<DiscountCodes />} />
        <Route path="admin/pages" element={<AdminPagesList />} />
        <Route path="admin/pages/create" element={<PageEditor />} />
        <Route path="admin/pages/edit/:slug" element={<PageEditor />} />
        <Route path="admin/components" element={<GlobalComponents />} />
        <Route path="admin/components/edit/:componentType" element={<ComponentEditor />} />
        <Route path="admin/menus" element={<MenusList />} />
        <Route path="admin/menus/create" element={<MenuEditor />} />
        <Route path="admin/menus/edit/:menuId" element={<MenuEditor />} />
        <Route path="admin/emails" element={<EmailTemplates />} />
        <Route path="admin/waitlist" element={<WaitlistAdmin />} />
        <Route path="admin/campaigns" element={<CustomEmailsAdmin />} />
        <Route path="affiliates" element={<Affiliates />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
