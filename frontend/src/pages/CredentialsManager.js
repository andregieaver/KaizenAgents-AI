import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { cn } from '../lib/utils';
import {
  Key,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Shield,
  Wrench,
  Clock,
  History
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialFormState = {
  name: '',
  site_domain: '',
  login_url: '',
  username: '',
  password: '',
  username_selector: '#username, input[name="username"], input[name="email"], input[type="email"]',
  password_selector: '#password, input[name="password"], input[type="password"]',
  submit_selector: 'button[type="submit"], input[type="submit"]',
  success_indicator: '',
  notes: ''
};

export default function CredentialsManager() {
  const { token } = useAuth();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const response = await axios.get(`${API}/credentials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredentials(response.data);
    } catch (error) {
      toast.error('Failed to fetch credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedCredential(null);
    setFormData(initialFormState);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleEdit = (credential) => {
    setSelectedCredential(credential);
    setFormData({
      name: credential.name || '',
      site_domain: credential.site_domain || '',
      login_url: credential.login_url || '',
      username: '', // Don't pre-fill sensitive data
      password: '',
      username_selector: credential.field_selectors?.username || initialFormState.username_selector,
      password_selector: credential.field_selectors?.password || initialFormState.password_selector,
      submit_selector: credential.field_selectors?.submit || initialFormState.submit_selector,
      success_indicator: credential.success_indicator || '',
      notes: credential.notes || ''
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleDelete = (credential) => {
    setSelectedCredential(credential);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedCredential) return;
    
    try {
      await axios.delete(`${API}/credentials/${selectedCredential.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credential deleted');
      fetchCredentials();
    } catch (error) {
      toast.error('Failed to delete credential');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedCredential(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        site_domain: formData.site_domain,
        login_url: formData.login_url,
        username_selector: formData.username_selector,
        password_selector: formData.password_selector,
        submit_selector: formData.submit_selector,
        success_indicator: formData.success_indicator || null,
        notes: formData.notes || null
      };

      // Only include credentials if provided
      if (formData.username) payload.username = formData.username;
      if (formData.password) payload.password = formData.password;

      if (selectedCredential) {
        // Update existing
        await axios.put(`${API}/credentials/${selectedCredential.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Credential updated');
      } else {
        // Create new - username and password required
        if (!formData.username || !formData.password) {
          toast.error('Username and password are required for new credentials');
          setSaving(false);
          return;
        }
        await axios.post(`${API}/credentials`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Credential created');
      }

      setDialogOpen(false);
      fetchCredentials();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const testCredential = async (credential) => {
    setTesting(credential.id);
    try {
      const response = await axios.post(`${API}/credentials/${credential.id}/test`, {
        take_screenshot: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTestResults(prev => ({
        ...prev,
        [credential.id]: response.data
      }));

      if (response.data.success) {
        toast.success('Login test successful!');
      } else {
        toast.error(response.data.error || 'Login test failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Test failed');
      setTestResults(prev => ({
        ...prev,
        [credential.id]: { success: false, error: error.message }
      }));
    } finally {
      setTesting(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Sub Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <Link to="/dashboard/agent-tools">
          <Button variant="outline" size="sm">
            <Wrench className="h-4 w-4 mr-2" /> Tools
          </Button>
        </Link>
        <Link to="/dashboard/agent-tools/credentials">
          <Button variant="default" size="sm">
            <Key className="h-4 w-4 mr-2" /> Credentials
          </Button>
        </Link>
        <Link to="/dashboard/agent-tools/scheduled-tasks">
          <Button variant="outline" size="sm">
            <Clock className="h-4 w-4 mr-2" /> Scheduled Tasks
          </Button>
        </Link>
        <Link to="/dashboard/agent-tools/logs">
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" /> Logs
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Credentials Manager</h1>
          <p className="text-muted-foreground">Securely store login credentials for AI agent automation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCredentials}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Credential
          </Button>
        </div>
      </div>

      {/* Security Notice */}
      <Card className="border-amber-500/50 bg-amber-500/10">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-400">Credentials are encrypted</p>
            <p className="text-sm text-amber-700 dark:text-amber-500">All credentials are stored using AES-128-CBC encryption. Passwords are never exposed in API responses.</p>
          </div>
        </CardContent>
      </Card>

      {/* Credentials List */}
      {credentials.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No credentials stored</h3>
            <p className="text-muted-foreground mb-4">Add credentials to enable AI agents to log into websites on your behalf.</p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Your First Credential
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {credentials.map(credential => {
            const result = testResults[credential.id];
            
            return (
              <Card key={credential.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Key className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{credential.name}</CardTitle>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Globe className="h-3 w-3" />
                          {credential.site_domain}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Used:</span>
                      <span className="ml-1 font-medium">{credential.use_count || 0}x</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last:</span>
                      <span className="ml-1 font-medium text-xs">
                        {credential.last_used ? formatDate(credential.last_used) : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Test Result */}
                  {result && (
                    <div className={cn(
                      "p-2 rounded text-xs",
                      result.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
                    )}>
                      <div className="flex items-center gap-1">
                        {result.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {result.success ? 'Login successful' : (result.error || 'Login failed')}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {credential.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{credential.notes}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => testCredential(credential)}
                      disabled={testing === credential.id}
                    >
                      {testing === credential.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Play className="h-4 w-4 mr-1" /> Test</>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(credential)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(credential)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCredential ? 'Edit Credential' : 'Add New Credential'}</DialogTitle>
            <DialogDescription>
              {selectedCredential 
                ? 'Update credential details. Leave username/password empty to keep existing values.'
                : 'Store encrypted credentials for AI agent authentication.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Credential Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My WordPress Admin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_domain">Site Domain *</Label>
                <Input
                  id="site_domain"
                  value={formData.site_domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, site_domain: e.target.value }))}
                  placeholder="example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login_url">Login URL *</Label>
              <Input
                id="login_url"
                value={formData.login_url}
                onChange={(e) => setFormData(prev => ({ ...prev, login_url: e.target.value }))}
                placeholder="https://example.com/wp-admin"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username {!selectedCredential && '*'}
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder={selectedCredential ? '(unchanged)' : 'admin@example.com'}
                  required={!selectedCredential}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {!selectedCredential && '*'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={selectedCredential ? '(unchanged)' : '••••••••'}
                    required={!selectedCredential}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Advanced Selectors */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Advanced Selectors (Optional)
              </summary>
              <div className="mt-4 space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="username_selector">Username Field Selector</Label>
                  <Input
                    id="username_selector"
                    value={formData.username_selector}
                    onChange={(e) => setFormData(prev => ({ ...prev, username_selector: e.target.value }))}
                    placeholder="CSS selector for username input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password_selector">Password Field Selector</Label>
                  <Input
                    id="password_selector"
                    value={formData.password_selector}
                    onChange={(e) => setFormData(prev => ({ ...prev, password_selector: e.target.value }))}
                    placeholder="CSS selector for password input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submit_selector">Submit Button Selector</Label>
                  <Input
                    id="submit_selector"
                    value={formData.submit_selector}
                    onChange={(e) => setFormData(prev => ({ ...prev, submit_selector: e.target.value }))}
                    placeholder="CSS selector for submit button"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="success_indicator">Success Indicator (Optional)</Label>
                  <Input
                    id="success_indicator"
                    value={formData.success_indicator}
                    onChange={(e) => setFormData(prev => ({ ...prev, success_indicator: e.target.value }))}
                    placeholder="CSS selector that appears after successful login"
                  />
                </div>
              </div>
            </details>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this credential"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {selectedCredential ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedCredential?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
