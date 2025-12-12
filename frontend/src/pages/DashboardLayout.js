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
  Shield,
  Users,
  User,
  Bot,
  Database,
  Bell,
  AlertTriangle
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { path: '/dashboard/conversations', icon: Inbox, label: 'Conversations' },
    { path: '/dashboard/team', icon: Users, label: 'Team' },
    { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  // Add admin link for super admins
  const adminNavItem = user?.is_super_admin 
    ? { path: '/dashboard/admin', icon: Shield, label: 'Super Admin', isAdmin: true }
    : null;
  
  const providersNavItem = user?.is_super_admin
    ? { path: '/dashboard/providers', icon: MessageSquare, label: 'AI Providers', isAdmin: true }
    : null;
  
  const agentsNavItem = user?.is_super_admin
    ? { path: '/dashboard/agents', icon: Bot, label: 'Agents', isAdmin: true }
    : null;
  
  const storageNavItem = user?.is_super_admin
    ? { path: '/dashboard/storage', icon: Database, label: 'Storage', isAdmin: true }
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
            {navItems.map((item) => (
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
            
            {/* Super Admin Links */}
            {(adminNavItem || providersNavItem || agentsNavItem || storageNavItem) && (
              <>
                <Separator className="my-3" />
                {providersNavItem && (
                  <Link
                    to={providersNavItem.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                      isActive(providersNavItem.path)
                        ? "bg-destructive text-destructive-foreground"
                        : "text-destructive hover:text-destructive hover:bg-destructive/10"
                    )}
                  >
                    <providersNavItem.icon className="h-4 w-4" />
                    {providersNavItem.label}
                  </Link>
                )}
                {agentsNavItem && (
                  <Link
                    to={agentsNavItem.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                      isActive(agentsNavItem.path)
                        ? "bg-destructive text-destructive-foreground"
                        : "text-destructive hover:text-destructive hover:bg-destructive/10"
                    )}
                  >
                    <agentsNavItem.icon className="h-4 w-4" />
                    {agentsNavItem.label}
                  </Link>
                )}
                {storageNavItem && (
                  <Link
                    to={storageNavItem.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                      isActive(storageNavItem.path)
                        ? "bg-destructive text-destructive-foreground"
                        : "text-destructive hover:text-destructive hover:bg-destructive/10"
                    )}
                  >
                    <storageNavItem.icon className="h-4 w-4" />
                    {storageNavItem.label}
                  </Link>
                )}
                {adminNavItem && (
                  <Link
                    to={adminNavItem.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors",
                      isActive(adminNavItem.path)
                        ? "bg-destructive text-destructive-foreground"
                        : "text-destructive hover:text-destructive hover:bg-destructive/10"
                    )}
                    data-testid="nav-super-admin"
                  >
                    <adminNavItem.icon className="h-4 w-4" />
                    {adminNavItem.label}
                  </Link>
                )}
              </>
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
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu className="h-5 w-5" />
          </Button>
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
      settings: 'Settings',
      agents: 'Agents',
      team: 'Team',
      profile: 'Profile',
      providers: 'Providers'
    };
    
    // If previous path was 'conversations' and this looks like an ID, show 'Details'
    if (index > 0 && allPaths[index - 1] === 'conversations' && !labels[path]) {
      return 'Details';
    }
    
    return labels[path] || path;
  };

  return (
    <div className="flex items-center gap-1 text-sm overflow-hidden">
      {paths.map((path, index) => (
        <span key={path} className="flex items-center gap-1 truncate">
          {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <span className={cn(
            'truncate',
            index === paths.length - 1 ? 'font-medium' : 'text-muted-foreground'
          )}>
            {getLabel(path, index, paths)}
          </span>
        </span>
      ))}
    </div>
  );
};

export default DashboardLayout;
