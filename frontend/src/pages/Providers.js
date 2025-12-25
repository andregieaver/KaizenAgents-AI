import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  TestTube,
  Key,
  Database,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { ProviderCardSkeleton } from '../components/LoadingStates';
import { NoProvidersState } from '../components/EmptyStates';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Providers = () => {
  const { token } = useAuth();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingProvider, setTestingProvider] = useState(null);
  const [scanningProvider, setScanningProvider] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: '',
    type: 'openai',
    api_key: ''
  });

  const fetchProviders = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProviders(response.data);
    } catch {
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.api_key) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await axios.post(
        `${API}/admin/providers`,
        newProvider,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Provider added successfully');
      setShowAddDialog(false);
      setNewProvider({ name: '', type: 'openai', api_key: '' });
      fetchProviders();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to add provider');
    }
  };

  const handleTestConnection = async (providerId) => {
    setTestingProvider(providerId);
    try {
      const response = await axios.post(
        `${API}/admin/providers/${providerId}/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.status === 'success') {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch {
      toast.error(error.response?.data?.detail || 'Connection test failed');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleScanModels = async (providerId) => {
    setScanningProvider(providerId);
    try {
      const response = await axios.post(
        `${API}/admin/providers/${providerId}/scan-models`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Found ${response.data.count} models`);
      fetchProviders();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to scan models');
    } finally {
      setScanningProvider(null);
    }
  };

  const getProviderIcon = (type) => {
    const icons = {
      openai: '🤖',
      anthropic: '🧠',
      google: '🔍'
    };
    return icons[type] || '🤖';
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">AI Providers</h1>
          <p className="text-sm text-muted-foreground">
            Manage AI provider API keys and configurations
          </p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add AI Provider</DialogTitle>
              <DialogDescription>
                Configure a new AI provider with API credentials
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="provider-name">Provider Name</Label>
                <Input
                  id="provider-name"
                  placeholder="e.g., OpenAI Production"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="provider-type">Provider Type</Label>
                <select
                  id="provider-type"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={newProvider.type}
                  onChange={(e) => setNewProvider({ ...newProvider, type: e.target.value })}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google AI</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={newProvider.api_key}
                  onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddProvider}>
                Add Provider
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Providers Grid */}
      {loading ? (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <ProviderCardSkeleton key={i} />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <NoProvidersState onCreate={() => setShowAddDialog(true)} />
      ) : (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {providers.map((provider) => (
          <Card key={provider.id} className="border border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{getProviderIcon(provider.type)}</div>
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription className="capitalize">{provider.type}</CardDescription>
                  </div>
                </div>
                {provider.is_active ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
                    Inactive
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* API Key */}
              <div className="flex items-center gap-2 text-sm">
                <Key className="h-4 w-4 text-muted-foreground" />
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {provider.masked_api_key || '••••••••'}
                </code>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-muted/50 p-2 rounded-sm">
                  <div className="text-xs text-muted-foreground">Calls</div>
                  <div className="font-medium">{provider.total_calls}</div>
                </div>
                <div className="bg-muted/50 p-2 rounded-sm">
                  <div className="text-xs text-muted-foreground">Tokens</div>
                  <div className="font-medium">{provider.total_tokens.toLocaleString()}</div>
                </div>
                <div className="bg-muted/50 p-2 rounded-sm">
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="font-medium">${provider.total_cost.toFixed(2)}</div>
                </div>
              </div>

              {/* Models */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  Available Models ({provider.models?.length || 0})
                </div>
                {provider.models && provider.models.length > 0 ? (
                  <ScrollArea className="h-20">
                    <div className="flex flex-wrap gap-1">
                      {provider.models.map((model) => (
                        <Badge key={model} variant="secondary" className="text-xs">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground">No models scanned</p>
                )}
              </div>

              {/* Last Error */}
              {provider.last_error && (
                <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-sm">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{provider.last_error}</p>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleTestConnection(provider.id)}
                  disabled={testingProvider === provider.id}
                >
                  {testingProvider === provider.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      Test
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleScanModels(provider.id)}
                  disabled={scanningProvider === provider.id}
                >
                  {scanningProvider === provider.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Scan Models
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Providers;
