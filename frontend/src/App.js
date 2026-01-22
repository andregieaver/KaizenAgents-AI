import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "./components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

// Eager load auth-related pages for better UX (users need these immediately)
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import HomePage from "./pages/HomePage";
import PricingPage from "./pages/PricingPage";

// Lazy load dashboard and protected pages (loaded on demand)
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Conversations = lazy(() => import("./pages/Conversations"));
const ConversationDetail = lazy(() => import("./pages/ConversationDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const WidgetDemo = lazy(() => import("./pages/WidgetDemo"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const Team = lazy(() => import("./pages/Team"));
const Profile = lazy(() => import("./pages/Profile"));
const Providers = lazy(() => import("./pages/Providers"));
const Agents = lazy(() => import("./pages/Agents"));
const StorageConfig = lazy(() => import("./pages/StorageConfig"));
const Analytics = lazy(() => import("./pages/Analytics"));
const RateLimits = lazy(() => import("./pages/RateLimits"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Observability = lazy(() => import("./pages/Observability"));
const Billing = lazy(() => import("./pages/Billing"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PlanManagement = lazy(() => import("./pages/PlanManagement"));
const Integrations = lazy(() => import("./pages/Integrations"));
const DiscountCodes = lazy(() => import("./pages/DiscountCodes"));
const Affiliates = lazy(() => import("./pages/Affiliates"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const AdminPagesList = lazy(() => import("./pages/AdminPagesList"));
const PageEditor = lazy(() => import("./pages/PageEditor"));
const CustomPage = lazy(() => import("./pages/CustomPage"));
const GlobalComponents = lazy(() => import("./pages/GlobalComponents"));
const ComponentEditor = lazy(() => import("./pages/ComponentEditor"));
const MenusList = lazy(() => import("./pages/MenusList"));
const MenuEditor = lazy(() => import("./pages/MenuEditor"));
const FeatureGatesAdmin = lazy(() => import("./pages/FeatureGatesAdmin"));
const WaitlistAdmin = lazy(() => import("./pages/WaitlistAdmin"));
const CustomEmailsAdmin = lazy(() => import("./pages/CustomEmailsAdmin"));

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

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="analytics" element={<Analytics />} />
        <Route path="team" element={<Team />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<SuperAdmin />} />
        <Route path="providers" element={<Providers />} />
        <Route path="agents" element={<Agents />} />
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
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
