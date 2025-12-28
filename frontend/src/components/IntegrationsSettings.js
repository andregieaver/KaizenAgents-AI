import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import {
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Check,
  ExternalLink,
  Loader2,
  Trash2,
  RefreshCw,
  Copy,
  Settings,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// X (Twitter) icon component
const XIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// WhatsApp icon component
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const INTEGRATIONS = [
  {
    id: 'facebook',
    name: 'Meta (Facebook)',
    description: 'Connect your Facebook Page to receive and respond to comments and messages',
    icon: Facebook,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    features: ['Page comments', 'Direct messages', 'Post mentions'],
    provider: 'meta',
    docsUrl: 'https://developers.facebook.com/docs/development/create-an-app',
    scopes: 'pages_read_engagement,pages_manage_posts,pages_messaging,pages_show_list'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Manage Instagram comments and direct messages from your inbox',
    icon: Instagram,
    iconColor: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    features: ['Post comments', 'Story mentions', 'Direct messages'],
    provider: 'meta',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api/getting-started',
    scopes: 'instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list'
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    description: 'Monitor and respond to tweets, mentions, and direct messages',
    icon: XIcon,
    iconColor: 'text-foreground',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
    features: ['Tweet replies', 'Mentions', 'Direct messages'],
    provider: 'twitter',
    docsUrl: 'https://developer.twitter.com/en/portal/dashboard',
    scopes: 'tweet.read tweet.write users.read dm.read dm.write offline.access'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Engage with your LinkedIn company page comments and messages',
    icon: Linkedin,
    iconColor: 'text-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    features: ['Post comments', 'Company mentions', 'Messages'],
    provider: 'linkedin',
    docsUrl: 'https://www.linkedin.com/developers/apps',
    scopes: 'r_organization_social,w_organization_social,rw_organization_admin'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect WhatsApp Business API for customer messaging',
    icon: WhatsAppIcon,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    features: ['Customer messages', 'Template messages', 'Media sharing'],
    provider: 'meta',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    scopes: 'whatsapp_business_management,whatsapp_business_messaging'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Manage YouTube video comments and community posts',
    icon: Youtube,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    features: ['Video comments', 'Community posts', 'Live chat'],
    provider: 'google',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    scopes: 'https://www.googleapis.com/auth/youtube.force-ssl'
  }
];

const IntegrationsSettings = () => {
  const { token } = useAuth();
  const [integrations, setIntegrations] = useState({});
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [configDialog, setConfigDialog] = useState(null);
  const [configValues, setConfigValues] = useState({ app_id: '', app_secret: '' });
  const [showSecrets, setShowSecrets] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const integration = urlParams.get('integration');
    
    if (oauthSuccess === 'true' && integration) {
      toast.success(`${integration} connected successfully!`);
      fetchData();
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=integrations');
    } else if (oauthError) {
      toast.error(`Failed to connect: ${oauthError}`);
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=integrations');
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [integrationsRes, configsRes] = await Promise.all([
        axios.get(`${API}/integrations`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/integrations/configs`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setIntegrations(integrationsRes.data || {});
      setConfigs(configsRes.data || {});
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureApp = (integration) => {
    const existingConfig = configs[integration.provider] || {};
    setConfigValues({
      app_id: existingConfig.app_id || '',
      app_secret: '' // Never show existing secret
    });
    setConfigDialog(integration);
  };

  const handleSaveConfig = async () => {
    if (!configDialog) return;
    
    setSavingConfig(true);
    try {
      await axios.post(
        `${API}/integrations/configs/${configDialog.provider}`,
        configValues,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${configDialog.provider} app configured successfully!`);
      setConfigDialog(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleConnect = async (integration) => {
    // Check if OAuth app is configured for this provider
    if (!configs[integration.provider]?.configured) {
      toast.error(`Please configure your ${integration.provider} app credentials first`);
      handleConfigureApp(integration);
      return;
    }
    
    setConnecting(integration.id);
    try {
      const response = await axios.get(
        `${API}/integrations/${integration.id}/oauth-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.oauth_url) {
        window.location.href = response.data.oauth_url;
      } else {
        toast.error('Failed to generate authorization URL');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to initiate connection`);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId) => {
    try {
      await axios.delete(`${API}/integrations/${integrationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Integration disconnected');
      fetchData();
    } catch (error) {
      toast.error('Failed to disconnect integration');
    }
  };

  const handleToggle = async (integrationId, enabled) => {
    try {
      await axios.patch(
        `${API}/integrations/${integrationId}`,
        { enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIntegrations(prev => ({
        ...prev,
        [integrationId]: { ...prev[integrationId], enabled }
      }));
      toast.success(`Integration ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update integration');
    }
  };

  const handleRefresh = async (integrationId) => {
    setConnecting(integrationId);
    try {
      await axios.post(
        `${API}/integrations/${integrationId}/refresh`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Token refreshed successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to refresh token. You may need to reconnect.');
    } finally {
      setConnecting(null);
    }
  };

  const copyWebhookUrl = () => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/webhooks/social`;
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL copied!');
  };

  // Group integrations by provider
  const providers = {
    meta: { name: 'Meta (Facebook, Instagram, WhatsApp)', integrations: INTEGRATIONS.filter(i => i.provider === 'meta') },
    twitter: { name: 'X (Twitter)', integrations: INTEGRATIONS.filter(i => i.provider === 'twitter') },
    linkedin: { name: 'LinkedIn', integrations: INTEGRATIONS.filter(i => i.provider === 'linkedin') },
    google: { name: 'Google (YouTube)', integrations: INTEGRATIONS.filter(i => i.provider === 'google') }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Integrations Card */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="font-heading">Social Media Integrations</CardTitle>
          <CardDescription>
            Connect your social media accounts to receive and respond to comments and messages in your unified inbox.
            Each integration requires you to first configure your own OAuth app credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-4">
            {Object.entries(providers).map(([providerId, provider]) => {
              const isConfigured = configs[providerId]?.configured;
              
              return (
                <AccordionItem key={providerId} value={providerId} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{provider.name}</span>
                      {isConfigured ? (
                        <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/30">
                          <Check className="h-3 w-3 mr-1" />
                          App Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 dark:bg-amber-950/30">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Setup Required
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    {/* App Configuration Section */}
                    <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">OAuth App Credentials</p>
                          <p className="text-xs text-muted-foreground">
                            {isConfigured 
                              ? `App ID: ${configs[providerId]?.app_id_masked || '••••••••'}`
                              : 'Configure your app credentials to enable connections'
                            }
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigureApp(provider.integrations[0])}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {isConfigured ? 'Update' : 'Configure'}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Individual Integrations */}
                    <div className="space-y-3">
                      {provider.integrations.map((integration) => {
                        const isConnected = integrations[integration.id]?.connected;
                        const isEnabled = integrations[integration.id]?.enabled;
                        const Icon = integration.icon;
                        
                        return (
                          <div
                            key={integration.id}
                            className={`
                              rounded-lg border border-border p-4 transition-all
                              ${isConnected ? 'bg-card' : 'bg-muted/30'}
                              ${!isConfigured ? 'opacity-60' : ''}
                            `}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`
                                flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center
                                ${integration.bgColor}
                              `}>
                                <Icon className={`h-5 w-5 ${integration.iconColor}`} />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm">{integration.name}</h4>
                                  {isConnected && (
                                    <Badge variant="outline" className="text-green-600 border-green-600/30 text-xs">
                                      Connected
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {integration.description}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {integration.features.map((feature) => (
                                    <Badge key={feature} variant="secondary" className="text-xs py-0">
                                      {feature}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex-shrink-0 flex items-center gap-2">
                                {isConnected ? (
                                  <>
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={(checked) => handleToggle(integration.id, checked)}
                                      disabled={!isConfigured}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRefresh(integration.id)}
                                      disabled={connecting === integration.id}
                                      title="Refresh token"
                                    >
                                      {connecting === integration.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDisconnect(integration.id)}
                                      title="Disconnect"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleConnect(integration)}
                                    disabled={connecting === integration.id || !isConfigured}
                                  >
                                    {connecting === integration.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Connect
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {isConnected && integrations[integration.id]?.account_name && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                  Connected: <span className="font-medium text-foreground">{integrations[integration.id].account_name}</span>
                                  {integrations[integration.id]?.expires_at && (
                                    <span className="ml-2">
                                      (Expires: {new Date(integrations[integration.id].expires_at).toLocaleDateString()})
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Webhook Info Card */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Webhook URL</CardTitle>
          <CardDescription>
            Add this URL to your OAuth app's webhook/callback settings to receive real-time notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-sm break-all">
              {process.env.REACT_APP_BACKEND_URL}/api/webhooks/social
            </code>
            <Button variant="ghost" size="sm" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {configDialog?.provider} App</DialogTitle>
            <DialogDescription>
              Enter your OAuth app credentials. You can create an app at:
              <a 
                href={configDialog?.docsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-1 text-primary hover:underline"
              >
                {configDialog?.provider === 'meta' && 'Meta for Developers'}
                {configDialog?.provider === 'twitter' && 'Twitter Developer Portal'}
                {configDialog?.provider === 'linkedin' && 'LinkedIn Developer Portal'}
                {configDialog?.provider === 'google' && 'Google Cloud Console'}
                <ExternalLink className="h-3 w-3" />
              </a>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="app_id">App ID / Client ID</Label>
              <Input
                id="app_id"
                placeholder="Enter your app ID"
                value={configValues.app_id}
                onChange={(e) => setConfigValues(prev => ({ ...prev, app_id: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="app_secret">App Secret / Client Secret</Label>
              <div className="relative">
                <Input
                  id="app_secret"
                  type={showSecrets[configDialog?.provider] ? 'text' : 'password'}
                  placeholder={configs[configDialog?.provider]?.configured ? '••••••••••••••••' : 'Enter your app secret'}
                  value={configValues.app_secret}
                  onChange={(e) => setConfigValues(prev => ({ ...prev, app_secret: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecrets(prev => ({ ...prev, [configDialog?.provider]: !prev[configDialog?.provider] }))}
                >
                  {showSecrets[configDialog?.provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {configs[configDialog?.provider]?.configured 
                  ? 'Leave empty to keep the existing secret'
                  : 'This will be encrypted and stored securely'
                }
              </p>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Redirect URI:</strong> Add this to your app's allowed redirect URIs:
              </p>
              <code className="text-xs break-all">
                {process.env.REACT_APP_BACKEND_URL}/api/integrations/oauth/callback
              </code>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={savingConfig || !configValues.app_id}>
              {savingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegrationsSettings;
