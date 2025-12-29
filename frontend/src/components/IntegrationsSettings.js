import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
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
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// X (Twitter) icon
const XIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// WhatsApp icon
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const INTEGRATIONS = [
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'Receive and respond to Facebook Page comments and messages',
    icon: Facebook,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    features: ['Page comments', 'Direct messages', 'Post mentions']
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Manage Instagram comments and direct messages',
    icon: Instagram,
    iconColor: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    features: ['Post comments', 'Story mentions', 'Direct messages']
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    description: 'Monitor and respond to tweets, mentions, and DMs',
    icon: XIcon,
    iconColor: 'text-foreground',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
    features: ['Tweet replies', 'Mentions', 'Direct messages']
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Engage with LinkedIn company page comments',
    icon: Linkedin,
    iconColor: 'text-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    features: ['Post comments', 'Company mentions']
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Connect WhatsApp Business for customer messaging',
    icon: WhatsAppIcon,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    features: ['Customer messages', 'Template messages']
  },
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Manage YouTube video comments',
    icon: Youtube,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    features: ['Video comments', 'Community posts']
  }
];

const IntegrationsSettings = () => {
  const { token } = useAuth();
  const [integrations, setIntegrations] = useState({});
  const [configStatus, setConfigStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    fetchIntegrations();
    fetchConfigStatus();
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const integration = urlParams.get('integration');
    
    if (oauthSuccess === 'true' && integration) {
      toast.success(`${integration} connected successfully!`);
      fetchIntegrations();
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=integrations');
    } else if (oauthError) {
      toast.error(`Failed to connect: ${oauthError}`);
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=integrations');
    }
  }, [token]);

  const fetchConfigStatus = async () => {
    try {
      const response = await axios.get(`${API}/integrations/config-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigStatus(response.data || {});
    } catch (error) {
      console.error('Failed to fetch config status:', error);
      // Default to all not configured
      setConfigStatus({});
    }
  };

  const fetchIntegrations = async () => {
    try {
      const response = await axios.get(`${API}/integrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIntegrations(response.data || {});
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integration) => {
    setConnecting(integration.id);
    try {
      const response = await axios.get(
        `${API}/integrations/${integration.id}/oauth-url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.oauth_url) {
        window.location.href = response.data.oauth_url;
      } else if (response.data.not_configured) {
        toast.error(`${integration.name} integration is not available yet. Contact support.`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to connect ${integration.name}`);
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

  const handleRefresh = async (integrationId) => {
    setConnecting(integrationId);
    try {
      await axios.post(
        `${API}/integrations/${integrationId}/refresh`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Connection refreshed');
      fetchIntegrations();
    } catch (error) {
      toast.error('Failed to refresh. Try reconnecting.');
    } finally {
      setConnecting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-muted rounded-lg" />
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
            Connect your social media accounts to receive and respond to comments and messages in your unified inbox.
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
                    rounded-lg border border-border p-4 transition-all
                    ${isConnected ? 'bg-card' : 'bg-muted/30'}
                  `}
                >
                  <div className="flex items-start gap-4">
                    <div className={`
                      flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center
                      ${integration.bgColor}
                    `}>
                      <Icon className={`h-6 w-6 ${integration.iconColor}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{integration.name}</h3>
                        {isConnected && (
                          <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/30">
                            <Check className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {integration.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {integration.features.map((feature) => (
                          <Badge key={feature} variant="secondary" className="text-xs">
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
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRefresh(integration.id)}
                            disabled={connecting === integration.id}
                            title="Refresh"
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
                          onClick={() => handleConnect(integration)}
                          disabled={connecting === integration.id}
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
                      <p className="text-sm text-muted-foreground">
                        Connected: <span className="font-medium text-foreground">{integrations[integration.id].account_name}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border border-border bg-muted/30">
        <CardHeader>
          <CardTitle className="font-heading text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              <span>Click <strong>Connect</strong> on any platform</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              <span>Authorize access to your account</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
              <span>Comments and messages flow into your inbox automatically</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsSettings;
