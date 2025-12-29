import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';
import {
  MessageSquare,
  LayoutDashboard,
  Inbox,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Shield,
  Users,
  User,
  Bot,
  Database,
  Bell,
  AlertTriangle,
  BarChart3,
  CreditCard,
  DollarSign,
  Plug,
  Tag,
  Gift,
  FileText,
  Layout,
  Mail,
  ClipboardList,
  Send,
  Briefcase,
  Cog,
  BookOpen
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getAvatarSrc = (url) => {
  if (!url) return null;
  if (url.startsWith('/api/')) {
    return `${BACKEND_URL}${url}`;
  }
  return url;
};

const DashboardLayout = () => {
  const { user, logout, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [brandName, setBrandName] = useState('Support Hub');
  const [brandLogo, setBrandLogo] = useState(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState(null);
  const [adminExpanded, setAdminExpanded] = useState(false);

  useEffect(() => {
    const fetchBrandSettings = async () => {
      try {
        // Fetch user's company brand settings
        const response = await axios.get(`${API}/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data) {
          setBrandName(response.data.brand_name || 'Support Hub');
          setBrandLogo(response.data.brand_logo || null);
        }
      } catch {
        console.debug('Could not fetch brand settings, using defaults');
      }
    };

    if (token) {
      fetchBrandSettings();
    }
  }, [token]);

  // Fetch availability status
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const response = await axios.get(`${API}/profile/availability`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsAvailable(response.data.available);
      } catch {
        console.debug('Could not fetch availability');
      }
    };

    if (token) {
      fetchAvailability();
    }
  }, [token]);

  // Poll for pending transfers when available
  useEffect(() => {
    if (!isAvailable || !token) {
      return;
    }

    const fetchTransfers = async () => {
      try {
        const response = await axios.get(`${API}/transfers/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const transfers = response.data.transfers || [];
        setPendingTransfers(transfers);
        
        // Show popup for new transfer
        if (transfers.length > 0 && !currentTransfer) {
          setCurrentTransfer(transfers[0]);
          setShowTransferPopup(true);
        }
      } catch {
        console.debug('Could not fetch transfers');
      }
    };

    fetchTransfers();
    const interval = setInterval(fetchTransfers, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [isAvailable, token, currentTransfer]);

  const toggleAvailability = async () => {
    try {
      const newStatus = !isAvailable;
      await axios.post(`${API}/profile/availability?available=${newStatus}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAvailable(newStatus);
      toast.success(newStatus ? 'You are now available' : 'You are now unavailable');
    } catch {
      toast.error('Failed to update availability');
    }
  };

  const handleAcceptTransfer = async (transferId) => {
    try {
      const response = await axios.post(`${API}/transfers/${transferId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowTransferPopup(false);
      setCurrentTransfer(null);
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
      toast.success('Transfer accepted');
      navigate(`/dashboard/conversations/${response.data.conversation_id}`);
    } catch {
      toast.error('Failed to accept transfer');
    }
  };

  const handleDeclineTransfer = async (transferId) => {
    try {
      await axios.post(`${API}/transfers/${transferId}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowTransferPopup(false);
      setCurrentTransfer(null);
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
    } catch {
      toast.error('Failed to decline transfer');
    }
  };

  const getBrandLogoSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${BACKEND_URL}${url}`;
    }
    return url;
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Navigation items grouped by category
  const mainNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  ];
  
  const workNavItems = [
    { path: '/dashboard/conversations', icon: Inbox, label: 'Conversations' },
    { path: '/dashboard/messaging', icon: MessageSquare, label: 'Messaging' },
    { path: '/dashboard/crm', icon: Users, label: 'CRM' },
    { path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  ];
  
  const resourcesNavItems = [
    { path: '/marketplace', icon: Bot, label: 'Marketplace' },
    { path: '/dashboard/agents', icon: Bot, label: 'Agents' },
    { path: '/dashboard/team', icon: Users, label: 'Users' },
  ];
  
  const accountNavItems = [
    { path: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
    { path: '/dashboard/affiliates', icon: Gift, label: 'Affiliates' },
    { path: '/dashboard/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
    { path: '/dashboard/help', icon: HelpCircle, label: 'Help' },
    { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  // Super Admin items (collapsible)
  const superAdminNavItems = user?.is_super_admin ? [
    { path: '/dashboard/admin', icon: Shield, label: 'Super Admin' },
    { path: '/dashboard/providers', icon: MessageSquare, label: 'AI Providers' },
    { path: '/dashboard/storage', icon: Database, label: 'Storage' },
    { path: '/dashboard/rate-limits', icon: Shield, label: 'Rate Limits' },
    { path: '/dashboard/observability', icon: AlertTriangle, label: 'Observability' },
    { path: '/dashboard/admin/plans', icon: DollarSign, label: 'Plan Management' },
    { path: '/dashboard/admin/feature-gates', icon: Shield, label: 'Feature Gates' },
    { path: '/dashboard/integrations', icon: Plug, label: 'Integrations' },
    { path: '/dashboard/admin/discounts', icon: Tag, label: 'Discount Codes' },
    { path: '/dashboard/admin/pages', icon: FileText, label: 'Pages' },
    { path: '/dashboard/admin/emails', icon: Mail, label: 'Emails' },
    { path: '/dashboard/admin/waitlist', icon: ClipboardList, label: 'Waitlist' },
    { path: '/dashboard/admin/campaigns', icon: Send, label: 'Campaigns' },
  ] : [];
  
  // Owner-only items
  const ownerNavItems = user?.role === 'owner' ? [
    { path: '/dashboard/admin/components', icon: Layout, label: 'Global Components' },
    { path: '/dashboard/admin/menus', icon: Menu, label: 'Menus' },
  ] : [];

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { path: '/dashboard/conversations', icon: Inbox, label: 'Conversations' },
    { path: '/dashboard/messaging', icon: MessageSquare, label: 'Messaging' },
    { path: '/dashboard/crm', icon: Users, label: 'CRM' },
    { path: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/marketplace', icon: Bot, label: 'Marketplace' },
    { path: '/dashboard/team', icon: Users, label: 'Users' },
    { path: '/dashboard/agents', icon: Bot, label: 'Agents' },
    { path: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
    { path: '/dashboard/affiliates', icon: Gift, label: 'Affiliates' },
    { path: '/dashboard/knowledge-base', icon: BookOpen, label: 'Help' },
    { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  // Add admin link for super admins
  const adminNavItem = user?.is_super_admin 
    ? { path: '/dashboard/admin', icon: Shield, label: 'Super Admin', isAdmin: true }
    : null;
  
  const providersNavItem = user?.is_super_admin
    ? { path: '/dashboard/providers', icon: MessageSquare, label: 'AI Providers', isAdmin: true }
    : null;
  
  const storageNavItem = user?.is_super_admin
    ? { path: '/dashboard/storage', icon: Database, label: 'Storage', isAdmin: true }
    : null;

  const rateLimitsNavItem = user?.is_super_admin
    ? { path: '/dashboard/rate-limits', icon: Shield, label: 'Rate Limits', isAdmin: true }
    : null;

  const observabilityNavItem = user?.is_super_admin
    ? { path: '/dashboard/observability', icon: AlertTriangle, label: 'Observability', isAdmin: true }
    : null;

  const planManagementNavItem = user?.is_super_admin
    ? { path: '/dashboard/admin/plans', icon: DollarSign, label: 'Plan Management', isAdmin: true }
    : null;

  const featureGatesNavItem = user?.is_super_admin
    ? { path: '/dashboard/admin/feature-gates', icon: Shield, label: 'Feature Gates', isAdmin: true }
    : null;

  const integrationsNavItem = user?.is_super_admin
    ? { path: '/dashboard/integrations', icon: Plug, label: 'Integrations', isAdmin: true }
    : null;

  const discountCodesNavItem = user?.is_super_admin
    ? { path: '/dashboard/admin/discounts', icon: Tag, label: 'Discount Codes', isAdmin: true }
    : null;

  const pagesNavItem = user?.is_super_admin
    ? { path: '/dashboard/admin/pages', icon: FileText, label: 'Pages', isAdmin: true }
    : null;

  const componentsNavItem = user?.role === 'owner'
    ? { path: '/dashboard/admin/components', icon: Layout, label: 'Global Components', isAdmin: true }
    : null;

  const menusNavItem = user?.role === 'owner'
    ? { path: '/dashboard/admin/menus', icon: Menu, label: 'Menus', isAdmin: true }
    : null;

  const emailsNavItem = user?.is_super_admin
    ? { path: '/dashboard/admin/emails', icon: Mail, label: 'Emails', isAdmin: true }
    : null;

  const waitlistNavItem = user?.is_super_admin
    ? { path: '/dashboard/admin/waitlist', icon: ClipboardList, label: 'Waitlist', isAdmin: true }
    : null;

  const campaignsNavItem = user?.is_super_admin
    ? { path: '/dashboard/admin/campaigns', icon: Send, label: 'Campaigns', isAdmin: true }
    : null;

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="dashboard-layout">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transform transition-transform duration-200 lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
              {getBrandLogoSrc(brandLogo) ? (
                <img src={getBrandLogoSrc(brandLogo)} alt={brandName} className="h-full w-full object-contain" />
              ) : (
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              )}
            </div>
            <span className="font-heading font-bold">{brandName}</span>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-1">
            {/* Main */}
            {mainNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            
            {/* Work Section */}
            <div className="pt-3">
              <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Work</p>
              {workNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
            
            {/* Resources Section */}
            <div className="pt-3">
              <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Resources</p>
              {resourcesNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
            
            {/* Account Section */}
            <div className="pt-3">
              <p className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Account</p>
              {accountNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
            
            {/* Super Admin Section - Collapsible */}
            {(superAdminNavItems.length > 0 || ownerNavItems.length > 0) && (
              <div className="pt-3">
                <button
                  onClick={() => setAdminExpanded(!adminExpanded)}
                  className="flex items-center justify-between w-full px-3 mb-2 text-xs font-medium text-destructive uppercase tracking-wider hover:text-destructive/80 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    Admin
                  </span>
                  {adminExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                {adminExpanded && (
                  <div className="space-y-1">
                    {superAdminNavItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors",
                          isActive(item.path)
                            ? "bg-destructive text-destructive-foreground"
                            : "text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                    {ownerNavItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors",
                          isActive(item.path)
                            ? "bg-destructive text-destructive-foreground"
                            : "text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <Link 
            to="/dashboard/profile" 
            className="flex items-center gap-3 mb-3 p-2 -m-2 rounded-sm hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(false)}
            data-testid="nav-profile"
          >
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden relative">
              {getAvatarSrc(user?.avatar_url) ? (
                <img src={getAvatarSrc(user.avatar_url)} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-primary">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              )}
              {/* Availability indicator dot */}
              <div className={cn(
                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                isAvailable ? "bg-green-500" : "bg-gray-400"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </Link>
          
          {/* Availability Toggle */}
          <div 
            className="flex items-center justify-between p-2 mb-3 rounded-sm bg-muted/50 cursor-pointer"
            onClick={toggleAvailability}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                isAvailable ? "bg-green-500" : "bg-gray-400"
              )} />
              <span className="text-xs font-medium">
                {isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <Switch 
              checked={isAvailable} 
              onCheckedChange={toggleAvailability}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={toggleTheme}
              data-testid="sidebar-theme-toggle"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleLogout}
              data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Transfer Request Popup */}
      {showTransferPopup && currentTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full border border-border animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold">Customer Needs Help</h3>
                <p className="text-xs text-muted-foreground">
                  {currentTransfer.reason === 'customer_request' && 'Customer requested human assistance'}
                  {currentTransfer.reason === 'ai_limitation' && 'AI was unable to help'}
                  {currentTransfer.reason === 'negative_sentiment' && 'Customer appears frustrated'}
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">{currentTransfer.summary}</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDeclineTransfer(currentTransfer.id)}
                >
                  Decline
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleAcceptTransfer(currentTransfer.id)}
                >
                  Accept
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-6 gap-4">
          <Breadcrumb />
          
          {/* Transfer notification badge in header */}
          {pendingTransfers.length > 0 && !showTransferPopup && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto relative"
              onClick={() => {
                if (pendingTransfers.length > 0) {
                  setCurrentTransfer(pendingTransfers[0]);
                  setShowTransferPopup(true);
                }
              }}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                {pendingTransfers.length}
              </span>
            </Button>
          )}
          
          {/* Mobile menu button - far right */}
          <Button
            variant="ghost"
            size="icon"
            className={`lg:hidden h-9 w-9 ${pendingTransfers.length === 0 ? 'ml-auto' : ''}`}
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const Breadcrumb = () => {
  const location = useLocation();
  const paths = location.pathname.split('/').filter(Boolean);

  const getLabel = (path, index, allPaths) => {
    const labels = {
      dashboard: 'Dashboard',
      conversations: 'Conversations',
      analytics: 'Analytics',
      marketplace: 'Marketplace',
      settings: 'Settings',
      agents: 'Agents',
      team: 'Users',
      profile: 'Profile',
      providers: 'Providers',
      'rate-limits': 'Rate Limits',
      observability: 'Observability',
      billing: 'Billing',
      pricing: 'Pricing',
      admin: 'Admin',
      plans: 'Plan Management',
      integrations: 'Integrations',
      discounts: 'Discount Codes',
      affiliates: 'Affiliates',
      crm: 'CRM',
      users: 'Users',
      pages: 'Pages',
      menus: 'Menus',
      'feature-gates': 'Feature Gates',
      'email-templates': 'Email Templates',
      storage: 'Storage',
      waitlist: 'Waitlist',
      'custom-emails': 'Custom Emails'
    };
    
    // If previous path was 'conversations' and this looks like an ID, show 'Details'
    if (index > 0 && allPaths[index - 1] === 'conversations' && !labels[path]) {
      return 'Details';
    }
    
    // If previous path was 'crm' and path is 'customers', show 'Customers'
    if (path === 'customers') return 'Customers';
    
    // If it looks like a UUID or ID, show appropriate label based on parent
    if (index > 0 && !labels[path]) {
      const parent = allPaths[index - 1];
      if (parent === 'agents') return 'Edit Agent';
      if (parent === 'customers') return 'Customer Details';
      if (parent === 'pages') return 'Edit Page';
      return 'Details';
    }
    
    return labels[path] || path;
  };

  const getPath = (index) => {
    // Build the path up to and including the clicked item
    return '/' + paths.slice(0, index + 1).join('/');
  };

  return (
    <nav className="flex items-center gap-1 text-sm overflow-hidden" aria-label="Breadcrumb">
      {paths.map((path, index) => {
        const isLast = index === paths.length - 1;
        const label = getLabel(path, index, paths);
        const href = getPath(index);
        
        return (
          <span key={`${path}-${index}`} className="flex items-center gap-1 truncate">
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            {isLast ? (
              <span className="font-medium truncate" aria-current="page">
                {label}
              </span>
            ) : (
              <Link
                to={href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default DashboardLayout;
