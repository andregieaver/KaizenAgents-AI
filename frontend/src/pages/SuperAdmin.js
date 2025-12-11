import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  Shield,
  Building2,
  Users,
  MessageSquare,
  Settings,
  Trash2,
  Crown,
  Activity,
  Database,
  Bell,
  Eye,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SuperAdmin = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);

  const fetchData = async () => {
    try {
      const [statsRes, settingsRes, tenantsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/platform-stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/platform-settings`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/tenants`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setPlatformStats(statsRes.data);
      setPlatformSettings(settingsRes.data);
      setTenants(tenantsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_super_admin) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token, user?.is_super_admin]);

  // Check if user is super admin (after hooks)
  if (!loading && !user?.is_super_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const updatePlatformSettings = async (field, value) => {
    try {
      const response = await axios.put(
        `${API}/admin/platform-settings`,
        { [field]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPlatformSettings(response.data);
      toast.success('Platform settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const viewTenantDetails = async (tenantId) => {
    try {
      const response = await axios.get(
        `${API}/admin/tenants/${tenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTenantDetails(response.data);
      setSelectedTenant(tenantId);
    } catch (error) {
      toast.error('Failed to load tenant details');
    }
  };

  const deleteTenant = async (tenantId) => {
    try {
      await axios.delete(
        `${API}/admin/tenants/${tenantId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Tenant deleted successfully');
      setSelectedTenant(null);
      setTenantDetails(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete tenant');
    }
  };

  const toggleSuperAdmin = async (userId, currentStatus) => {
    try {
      const endpoint = currentStatus 
        ? `${API}/admin/users/${userId}/revoke-super-admin`
        : `${API}/admin/users/${userId}/make-super-admin`;
      
      await axios.post(endpoint, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(currentStatus ? 'Super admin revoked' : 'Super admin granted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="super-admin-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-sm bg-destructive/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight">
            Super Admin Panel
          </h1>
          <p className="text-muted-foreground">Platform-wide settings and management</p>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Total Companies"
          value={platformStats?.total_tenants || 0}
          color="blue"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Total Users"
          value={platformStats?.total_users || 0}
          color="green"
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Total Conversations"
          value={platformStats?.total_conversations || 0}
          color="orange"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Active (7 days)"
          value={platformStats?.active_conversations_7d || 0}
          color="purple"
        />
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="settings" className="gap-2" data-testid="admin-tab-settings">
            <Settings className="h-4 w-4 hidden sm:block" />
            Platform
          </TabsTrigger>
          <TabsTrigger value="tenants" className="gap-2" data-testid="admin-tab-tenants">
            <Building2 className="h-4 w-4 hidden sm:block" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2" data-testid="admin-tab-users">
            <Users className="h-4 w-4 hidden sm:block" />
            Users
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2" data-testid="admin-tab-database">
            <Database className="h-4 w-4 hidden sm:block" />
            Database
          </TabsTrigger>
        </TabsList>

        {/* Platform Settings Tab */}
        <TabsContent value="settings">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading">Platform Settings</CardTitle>
              <CardDescription>Configure platform-wide settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="platform_name">Platform Name</Label>
                <Input
                  id="platform_name"
                  value={platformSettings?.platform_name || ''}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, platform_name: e.target.value })}
                  onBlur={(e) => updatePlatformSettings('platform_name', e.target.value)}
                  className="h-10 max-w-md"
                  data-testid="platform-name-input"
                />
              </div>

              <div className="flex items-center justify-between max-w-md">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-xs text-muted-foreground">Disable access for non-admin users</p>
                </div>
                <Switch
                  checked={platformSettings?.maintenance_mode || false}
                  onCheckedChange={(checked) => {
                    setPlatformSettings({ ...platformSettings, maintenance_mode: checked });
                    updatePlatformSettings('maintenance_mode', checked);
                  }}
                  data-testid="maintenance-mode-switch"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="max_tenants">Maximum Companies</Label>
                <Input
                  id="max_tenants"
                  type="number"
                  value={platformSettings?.max_tenants || 1000}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, max_tenants: parseInt(e.target.value) })}
                  onBlur={(e) => updatePlatformSettings('max_tenants', parseInt(e.target.value))}
                  className="h-10 max-w-md"
                  data-testid="max-tenants-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_ai_model">Default AI Model</Label>
                <Input
                  id="default_ai_model"
                  value={platformSettings?.default_ai_model || 'gpt-4o-mini'}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, default_ai_model: e.target.value })}
                  onBlur={(e) => updatePlatformSettings('default_ai_model', e.target.value)}
                  className="h-10 max-w-md"
                  data-testid="default-model-input"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="announcement" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Platform Announcement
                </Label>
                <Textarea
                  id="announcement"
                  value={platformSettings?.announcement || ''}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, announcement: e.target.value })}
                  onBlur={(e) => updatePlatformSettings('announcement', e.target.value)}
                  placeholder="Enter a platform-wide announcement..."
                  className="max-w-md resize-none"
                  rows={3}
                  data-testid="announcement-input"
                />
                <p className="text-xs text-muted-foreground">This message will be shown to all users</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenants Tab */}
        <TabsContent value="tenants">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="font-heading">All Companies</CardTitle>
                <CardDescription>{tenants.length} total companies</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="divide-y divide-border">
                    {tenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedTenant === tenant.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => viewTenantDetails(tenant.id)}
                        data-testid="tenant-row"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{tenant.brand_name || tenant.name}</p>
                            <p className="text-xs text-muted-foreground">{tenant.id}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right text-xs text-muted-foreground">
                              <p>{tenant.conversation_count} conversations</p>
                              <p>{tenant.user_count} users</p>
                            </div>
                            {tenant.has_api_key && (
                              <Badge variant="secondary" className="text-xs">API Key</Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Tenant Details */}
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="font-heading">Company Details</CardTitle>
                <CardDescription>
                  {selectedTenant ? 'View and manage company' : 'Select a company to view details'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tenantDetails ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="font-medium">{tenantDetails.tenant.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {format(new Date(tenantDetails.tenant.created_at), 'PP')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Brand</p>
                        <p className="font-medium">{tenantDetails.settings?.brand_name || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">AI Model</p>
                        <p className="font-medium">{tenantDetails.settings?.ai_model || 'Default'}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted rounded-sm text-center">
                        <p className="font-heading text-2xl font-bold">{tenantDetails.stats.total_users}</p>
                        <p className="text-xs text-muted-foreground">Users</p>
                      </div>
                      <div className="p-3 bg-muted rounded-sm text-center">
                        <p className="font-heading text-2xl font-bold">{tenantDetails.stats.total_conversations}</p>
                        <p className="text-xs text-muted-foreground">Conversations</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-sm font-medium mb-2">Users</p>
                      <div className="space-y-2">
                        {tenantDetails.users.map((u) => (
                          <div key={u.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-sm">
                            <div>
                              <p className="text-sm font-medium">{u.name}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                            <Badge variant="outline">{u.role}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" data-testid="delete-tenant-btn">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Company
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the company and ALL associated data including
                            users, conversations, messages, and settings. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTenant(selectedTenant)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Tenant
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Select a tenant from the list</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading">All Users</CardTitle>
              <CardDescription>{users.length} total users across all tenants</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border">
                  {users.map((u) => (
                    <div key={u.id} className="p-4 flex items-center justify-between" data-testid="user-row">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          {u.is_super_admin ? (
                            <Crown className="h-5 w-5 text-amber-500" />
                          ) : (
                            <span className="text-sm font-medium">{u.name?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{u.name}</p>
                            {u.is_super_admin && (
                              <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                                Super Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm">{u.tenant_name}</p>
                          <Badge variant="outline" className="text-xs">{u.role}</Badge>
                        </div>
                        {u.email !== 'andre@humanweb.no' && (
                          <Button
                            variant={u.is_super_admin ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => toggleSuperAdmin(u.id, u.is_super_admin)}
                            data-testid="toggle-admin-btn"
                          >
                            {u.is_super_admin ? 'Revoke' : 'Grant Admin'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading">Database Statistics</CardTitle>
              <CardDescription>Overview of database collections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-sm text-center">
                  <p className="font-heading text-3xl font-bold">{platformStats?.total_tenants || 0}</p>
                  <p className="text-sm text-muted-foreground">Tenants</p>
                </div>
                <div className="p-4 bg-muted rounded-sm text-center">
                  <p className="font-heading text-3xl font-bold">{platformStats?.total_users || 0}</p>
                  <p className="text-sm text-muted-foreground">Users</p>
                </div>
                <div className="p-4 bg-muted rounded-sm text-center">
                  <p className="font-heading text-3xl font-bold">{platformStats?.total_conversations || 0}</p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
                <div className="p-4 bg-muted rounded-sm text-center">
                  <p className="font-heading text-3xl font-bold">{platformStats?.total_messages || 0}</p>
                  <p className="text-sm text-muted-foreground">Messages</p>
                </div>
              </div>

              <Separator className="my-6" />

              <div>
                <h3 className="font-heading font-semibold mb-4">Tenant Breakdown</h3>
                <div className="space-y-2">
                  {platformStats?.tenants?.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-sm">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{t.conversations} conversations</span>
                        <span>{t.users} users</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    orange: 'bg-orange-500/10 text-orange-600',
    purple: 'bg-purple-500/10 text-purple-600'
  };

  return (
    <Card className="border border-border" data-testid="admin-stat-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`h-10 w-10 rounded-sm flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
        <p className="font-heading text-3xl font-bold tracking-tight mb-1">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
};

export default SuperAdmin;
