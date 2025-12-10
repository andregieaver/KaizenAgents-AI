import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
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
  Shield
} from 'lucide-react';
import { cn } from '../lib/utils';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { path: '/dashboard/conversations', icon: Inbox, label: 'Conversations' },
    { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  // Add admin link for super admins
  const adminNavItem = user?.is_super_admin 
    ? { path: '/dashboard/admin', icon: Shield, label: 'Super Admin', isAdmin: true }
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
            <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold">Support Hub</span>
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
            
            {/* Super Admin Link */}
            {adminNavItem && (
              <>
                <Separator className="my-3" />
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
              </>
            )}
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
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

  const getLabel = (path) => {
    const labels = {
      dashboard: 'Dashboard',
      conversations: 'Conversations',
      settings: 'Settings'
    };
    return labels[path] || path;
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      {paths.map((path, index) => (
        <span key={path} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className={index === paths.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
            {getLabel(path)}
          </span>
        </span>
      ))}
    </div>
  );
};

export default DashboardLayout;
