import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import {
  ShoppingCart,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AgentIntegrationsTab = ({ agent, setAgent, token }) => {
  const [testingWooCommerce, setTestingWooCommerce] = useState(false);
  const [showWooCommerceKeys, setShowWooCommerceKeys] = useState(false);
  const [testingShopify, setTestingShopify] = useState(false);
  const [showShopifyToken, setShowShopifyToken] = useState(false);

  const testWooCommerceConnection = async () => {
    if (!agent.config?.woocommerce?.store_url || 
        !agent.config?.woocommerce?.consumer_key ||
        !agent.config?.woocommerce?.consumer_secret) {
      toast.error('Please fill in all WooCommerce credentials');
      return;
    }
    setTestingWooCommerce(true);
    try {
      const response = await axios.post(
        `${API}/agents/test-woocommerce`,
        {
          store_url: agent.config.woocommerce.store_url,
          consumer_key: agent.config.woocommerce.consumer_key,
          consumer_secret: agent.config.woocommerce.consumer_secret
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(`Connected! Found ${response.data.product_count} products`);
      } else {
        toast.error(response.data.error || 'Connection failed');
      }
    } catch {
      toast.error(error.response?.data?.detail || 'Connection test failed');
    } finally {
      setTestingWooCommerce(false);
    }
  };

  const testShopifyConnection = async () => {
    if (!agent.config?.shopify?.store_domain || !agent.config?.shopify?.access_token) {
      toast.error('Please fill in Shopify store domain and access token');
      return;
    }
    setTestingShopify(true);
    try {
      const response = await axios.post(
        `${API}/agents/test-shopify`,
        {
          store_domain: agent.config.shopify.store_domain,
          access_token: agent.config.shopify.access_token
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success(`Connected! Store: ${response.data.shop_name}`);
      } else {
        toast.error(response.data.error || 'Connection failed');
      }
    } catch {
      toast.error(error.response?.data?.detail || 'Connection test failed');
    } finally {
      setTestingShopify(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* WooCommerce Integration */}
      <Card className="border border-border">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                WooCommerce Integration
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Connect your WooCommerce store to enable order lookups, refunds, and more
              </CardDescription>
            </div>
            <Switch
              checked={agent.config?.woocommerce?.enabled || false}
              onCheckedChange={(checked) => {
                setAgent(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    woocommerce: {
                      ...prev.config?.woocommerce,
                      enabled: checked
                    }
                  }
                }));
              }}
            />
          </div>
        </CardHeader>
        
        {agent.config?.woocommerce?.enabled && (
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wc_store_url">Store URL</Label>
                <Input
                  id="wc_store_url"
                  placeholder="https://your-store.com"
                  value={agent.config?.woocommerce?.store_url || ''}
                  onChange={(e) => {
                    setAgent(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        woocommerce: {
                          ...prev.config?.woocommerce,
                          store_url: e.target.value
                        }
                      }
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Your WooCommerce store URL (e.g., https://mystore.com)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="wc_consumer_key">Consumer Key</Label>
                <div className="relative">
                  <Input
                    id="wc_consumer_key"
                    type={showWooCommerceKeys ? 'text' : 'password'}
                    placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={agent.config?.woocommerce?.consumer_key || ''}
                    onChange={(e) => {
                      setAgent(prev => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          woocommerce: {
                            ...prev.config?.woocommerce,
                            consumer_key: e.target.value
                          }
                        }
                      }));
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowWooCommerceKeys(!showWooCommerceKeys)}
                  >
                    {showWooCommerceKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="wc_consumer_secret">Consumer Secret</Label>
                <Input
                  id="wc_consumer_secret"
                  type={showWooCommerceKeys ? 'text' : 'password'}
                  placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={agent.config?.woocommerce?.consumer_secret || ''}
                  onChange={(e) => {
                    setAgent(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        woocommerce: {
                          ...prev.config?.woocommerce,
                          consumer_secret: e.target.value
                        }
                      }
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Find these in WooCommerce → Settings → Advanced → REST API
                </p>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Available Capabilities</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Search orders by customer email</li>
                    <li>• Get order details and status</li>
                    <li>• Process refunds</li>
                    <li>• Update order status</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testWooCommerceConnection}
                  disabled={testingWooCommerce}
                >
                  {testingWooCommerce ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Shopify Integration */}
      <Card className="border border-border">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Shopify Integration
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Connect your Shopify store for order lookups and management
              </CardDescription>
            </div>
            <Switch
              checked={agent.config?.shopify?.enabled || false}
              onCheckedChange={(checked) => {
                setAgent(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    shopify: {
                      ...prev.config?.shopify,
                      enabled: checked
                    }
                  }
                }));
              }}
            />
          </div>
        </CardHeader>
        
        {agent.config?.shopify?.enabled && (
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shopify_domain">Store Domain</Label>
                <Input
                  id="shopify_domain"
                  placeholder="your-store.myshopify.com"
                  value={agent.config?.shopify?.store_domain || ''}
                  onChange={(e) => {
                    setAgent(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        shopify: {
                          ...prev.config?.shopify,
                          store_domain: e.target.value
                        }
                      }
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Your Shopify store domain (e.g., your-store.myshopify.com)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="shopify_token">Access Token</Label>
                <div className="relative">
                  <Input
                    id="shopify_token"
                    type={showShopifyToken ? 'text' : 'password'}
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={agent.config?.shopify?.access_token || ''}
                    onChange={(e) => {
                      setAgent(prev => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          shopify: {
                            ...prev.config?.shopify,
                            access_token: e.target.value
                          }
                        }
                      }));
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowShopifyToken(!showShopifyToken)}
                  >
                    {showShopifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create an Admin API access token in Shopify Admin → Settings → Apps
                </p>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Available Capabilities</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Search orders by email or order number</li>
                    <li>• View order details and status</li>
                    <li>• Check product availability</li>
                    <li>• Get shipping information</li>
                  </ul>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testShopifyConnection}
                  disabled={testingShopify}
                >
                  {testingShopify ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AgentIntegrationsTab;
