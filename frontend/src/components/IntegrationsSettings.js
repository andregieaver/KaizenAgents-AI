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
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  MessageCircle,
  Check,
  X,
  ExternalLink,
  Loader2,
  Settings,
  Trash2,
  RefreshCw
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
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    requiredScopes: ['pages_read_engagement', 'pages_manage_posts', 'pages_messaging']
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Manage Instagram comments and direct messages from your inbox',
    icon: Instagram,
    iconColor: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    features: ['Post comments', 'Story mentions', 'Direct messages'],
    authUrl: 'https://api.instagram.com/oauth/authorize',
    requiredScopes: ['instagram_basic', 'instagram_manage_comments', 'instagram_manage_messages']
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    description: 'Monitor and respond to tweets, mentions, and direct messages',
    icon: XIcon,
    iconColor: 'text-foreground',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
    features: ['Tweet replies', 'Mentions', 'Direct messages'],
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    requiredScopes: ['tweet.read', 'tweet.write', 'dm.read', 'dm.write']
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Engage with your LinkedIn company page comments and messages',
    icon: Linkedin,
    iconColor: 'text-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    features: ['Post comments', 'Company mentions', 'Messages'],
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    requiredScopes: ['r_organization_social', 'w_organization_social', 'rw_organization_admin']
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect WhatsApp Business API for customer messaging',
    icon: WhatsAppIcon,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    features: ['Customer messages', 'Template messages', 'Media sharing'],
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth', // WhatsApp uses Meta's OAuth
    requiredScopes: ['whatsapp_business_management', 'whatsapp_business_messaging']
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Manage YouTube video comments and community posts',
    icon: Youtube,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    features: ['Video comments', 'Community posts', 'Live chat'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    requiredScopes: ['youtube.force-ssl', 'youtube.readonly']
  }
];

const IntegrationsSettings = () => {
  const { token } = useAuth();
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [configDialog, setConfigDialog] = useState(null);
  const [configValues, setConfigValues] = useState({});

  useEffect(() => {
    fetchIntegrations();
  }, [token]);

  const fetchIntegrations = async () => {
    try {
      const response = await axios.get(`${API}/integrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIntegrations(response.data || {});
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      // Initialize with empty state if endpoint doesn't exist yet
      setIntegrations({});
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integration) => {
    // Open config dialog to collect API credentials
    setConfigDialog(integration);
    setConfigValues({
      app_id: '',
      app_secret: '',
      access_token: '',
      webhook_secret: ''
    });
  };

  const handleSaveConfig = async () => {
    if (!configDialog) return;
    
    setConnecting(configDialog.id);
    try {
      await axios.post(
        `${API}/integrations/${configDialog.id}/connect`,
        configValues,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`${configDialog.name} connected successfully!`);
      setConfigDialog(null);
      fetchIntegrations();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to connect ${configDialog.name}`);
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
      fetchIntegrations();
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

  const handleTestConnection = async (integrationId) => {
    setConnecting(integrationId);
    try {
      const response = await axios.post(
        `${API}/integrations/${integrationId}/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error(response.data.message || 'Connection test failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Connection test failed');
    } finally {
      setConnecting(null);
    }
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
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="font-heading">Social Media Integrations</CardTitle>
          <CardDescription>
            Connect your social media accounts to receive and respond to comments, 
            messages, and mentions directly from your unified inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {INTEGRATIONS.map((integration) => {
              const isConnected = integrations[integration.id]?.connected;
              const isEnabled = integrations[integration.id]?.enabled;
              const Icon = integration.icon;
              
              return (
                <div
                  key={integration.id}
                  className={`
                    relative rounded-lg border border-border p-4 transition-all
                    ${isConnected ? 'bg-card' : 'bg-muted/30'}
                  `}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`
                      flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center
                      ${integration.bgColor}
                    `}>
                      <Icon className={`h-6 w-6 ${integration.iconColor}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base">{integration.name}</h3>
                        {isConnected && (
                          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/30">
                            <Check className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {integration.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {integration.features.map((feature) => (
                          <Badge key={feature} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggle(integration.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTestConnection(integration.id)}
                            disabled={connecting === integration.id}
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
                            onClick={() => handleConnect(integration)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDisconnect(integration.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => handleConnect(integration)}
                          disabled={connecting === integration.id}
                        >
                          {connecting === integration.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            'Connect'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Connected account info */}
                  {isConnected && integrations[integration.id]?.account_name && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Connected as: <span className="font-medium text-foreground">{integrations[integration.id].account_name}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Info Card */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Webhook Configuration</CardTitle>
          <CardDescription>
            Configure these webhook URLs in your social media developer portals to receive real-time updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm break-all">
                {process.env.REACT_APP_BACKEND_URL}/api/webhooks/social
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${process.env.REACT_APP_BACKEND_URL}/api/webhooks/social`);
                  toast.success('Webhook URL copied!');
                }}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this URL as the callback/webhook endpoint when setting up your integrations in Facebook Developer Portal, 
              Twitter Developer Portal, LinkedIn Developer Portal, Google Cloud Console, etc.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {configDialog?.name}</DialogTitle>
            <DialogDescription>
              Enter your API credentials from the {configDialog?.name} developer portal.
              <a 
                href={getDocsUrl(configDialog?.id)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-1 text-primary hover:underline"
              >
                View setup guide <ExternalLink className="h-3 w-3" />
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
              <Input
                id="app_secret"
                type="password"
                placeholder="Enter your app secret"
                value={configValues.app_secret}
                onChange={(e) => setConfigValues(prev => ({ ...prev, app_secret: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="access_token">Access Token (Optional)</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="Enter access token if available"
                value={configValues.access_token}
                onChange={(e) => setConfigValues(prev => ({ ...prev, access_token: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                If you have a long-lived access token, enter it here. Otherwise, you'll be prompted to authenticate.
              </p>
            </div>
            
            {(configDialog?.id === 'facebook' || configDialog?.id === 'instagram' || configDialog?.id === 'whatsapp') && (
              <div className="space-y-2">
                <Label htmlFor="webhook_secret">Webhook Verify Token</Label>
                <Input
                  id="webhook_secret"
                  placeholder="Enter your webhook verify token"
                  value={configValues.webhook_secret}
                  onChange={(e) => setConfigValues(prev => ({ ...prev, webhook_secret: e.target.value }))}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Connect'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper function to get documentation URLs
function getDocsUrl(integrationId) {
  const docs = {
    facebook: 'https://developers.facebook.com/docs/pages/getting-started',
    instagram: 'https://developers.facebook.com/docs/instagram-api/getting-started',
    twitter: 'https://developer.twitter.com/en/docs/twitter-api/getting-started',
    linkedin: 'https://learn.microsoft.com/en-us/linkedin/marketing/getting-started',
    whatsapp: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    youtube: 'https://developers.google.com/youtube/v3/getting-started'
  };
  return docs[integrationId] || '#';
}

export default IntegrationsSettings;
