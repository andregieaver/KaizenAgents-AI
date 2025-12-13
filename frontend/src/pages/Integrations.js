import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import { 
  Plug, 
  Loader2, 
  Save, 
  Eye, 
  EyeOff, 
  CreditCard, 
  Code, 
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Integrations = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTestKeys, setShowTestKeys] = useState(false);
  const [showLiveKeys, setShowLiveKeys] = useState(false);
  
  // Stripe settings
  const [stripeSettings, setStripeSettings] = useState({
    use_live_mode: false,
    test_secret_key: '',
    test_publishable_key: '',
    test_webhook_secret: '',
    live_secret_key: '',
    live_publishable_key: '',
    live_webhook_secret: ''
  });
  
  // Code injection settings
  const [codeInjection, setCodeInjection] = useState({
    head_code: '',
    body_start_code: '',
    body_end_code: ''
  });

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/integrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.stripe) {
        setStripeSettings(prev => ({
          ...prev,
          ...response.data.stripe,
          // Mask existing keys if they exist
          test_secret_key: response.data.stripe.test_secret_key_set ? '••••••••••••••••' : '',
          test_webhook_secret: response.data.stripe.test_webhook_secret_set ? '••••••••••••••••' : '',
          live_secret_key: response.data.stripe.live_secret_key_set ? '••••••••••••••••' : '',
          live_webhook_secret: response.data.stripe.live_webhook_secret_set ? '••••••••••••••••' : ''
        }));
      }
      
      if (response.data.code_injection) {
        setCodeInjection(response.data.code_injection);
      }
    } catch (error) {
      console.error('Error fetching integration settings:', error);
      toast.error('Failed to load integration settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStripe = async () => {
    setSaving(true);
    try {
      // Only send keys that have been changed (not masked)
      const payload = {
        use_live_mode: stripeSettings.use_live_mode,
        test_publishable_key: stripeSettings.test_publishable_key
      };
      
      // Only include secret keys if they've been changed
      if (!stripeSettings.test_secret_key.includes('••••')) {
        payload.test_secret_key = stripeSettings.test_secret_key;
      }
      if (!stripeSettings.test_webhook_secret.includes('••••')) {
        payload.test_webhook_secret = stripeSettings.test_webhook_secret;
      }
      if (stripeSettings.live_publishable_key) {
        payload.live_publishable_key = stripeSettings.live_publishable_key;
      }
      if (!stripeSettings.live_secret_key.includes('••••') && stripeSettings.live_secret_key) {
        payload.live_secret_key = stripeSettings.live_secret_key;
      }
      if (!stripeSettings.live_webhook_secret.includes('••••') && stripeSettings.live_webhook_secret) {
        payload.live_webhook_secret = stripeSettings.live_webhook_secret;
      }

      await axios.put(`${API}/admin/integrations/stripe`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Stripe settings saved successfully');
      fetchSettings(); // Refresh to get masked values
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save Stripe settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCodeInjection = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/integrations/code-injection`, codeInjection, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Code injection settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save code injection settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Plug className="h-8 w-8" />
          Integrations
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage third-party integrations and custom code injection
        </p>
      </div>

      <Tabs defaultValue="stripe" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stripe" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Stripe
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Injection
          </TabsTrigger>
        </TabsList>

        {/* Stripe Tab */}
        <TabsContent value="stripe" className="space-y-6">
          {/* Mode Toggle */}
          <Card className="border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stripe Mode</CardTitle>
                  <CardDescription>
                    Switch between test and live mode for payment processing
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-sm font-medium",
                    !stripeSettings.use_live_mode && "text-amber-600"
                  )}>
                    Test
                  </span>
                  <Switch
                    checked={stripeSettings.use_live_mode}
                    onCheckedChange={(checked) => 
                      setStripeSettings(prev => ({ ...prev, use_live_mode: checked }))
                    }
                  />
                  <span className={cn(
                    "text-sm font-medium",
                    stripeSettings.use_live_mode && "text-green-600"
                  )}>
                    Live
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {stripeSettings.use_live_mode ? (
                <Alert className="border-green-500 bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700">
                    <strong>Live Mode Active:</strong> Real payments will be processed. Ensure your live keys are configured correctly.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-amber-500 bg-amber-500/10">
                  <Info className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700">
                    <strong>Test Mode Active:</strong> No real payments will be processed. Use Stripe test cards for testing.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Test Keys */}
          <Card className="border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Test Keys
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      Test Mode
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Use test keys for development and testing. No real charges will be made.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTestKeys(!showTestKeys)}
                >
                  {showTestKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_publishable_key">Publishable Key</Label>
                <Input
                  id="test_publishable_key"
                  type={showTestKeys ? "text" : "password"}
                  value={stripeSettings.test_publishable_key}
                  onChange={(e) => setStripeSettings(prev => ({ 
                    ...prev, 
                    test_publishable_key: e.target.value 
                  }))}
                  placeholder="pk_test_..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Public key used in frontend. Safe to expose.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test_secret_key">Secret Key</Label>
                <Input
                  id="test_secret_key"
                  type={showTestKeys ? "text" : "password"}
                  value={stripeSettings.test_secret_key}
                  onChange={(e) => setStripeSettings(prev => ({ 
                    ...prev, 
                    test_secret_key: e.target.value 
                  }))}
                  placeholder="sk_test_..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Keep this secret. Used for server-side API calls.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test_webhook_secret">Webhook Signing Secret</Label>
                <Input
                  id="test_webhook_secret"
                  type={showTestKeys ? "text" : "password"}
                  value={stripeSettings.test_webhook_secret}
                  onChange={(e) => setStripeSettings(prev => ({ 
                    ...prev, 
                    test_webhook_secret: e.target.value 
                  }))}
                  placeholder="whsec_..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Used to verify webhook signatures. Get from Stripe Dashboard → Webhooks.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Live Keys */}
          <Card className="border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Live Keys
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      Production
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Use live keys for production. Real charges will be made.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLiveKeys(!showLiveKeys)}
                >
                  {showLiveKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-500 bg-red-500/10 mb-4">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-700">
                  <strong>Warning:</strong> Live keys process real payments. Handle with care.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="live_publishable_key">Publishable Key</Label>
                <Input
                  id="live_publishable_key"
                  type={showLiveKeys ? "text" : "password"}
                  value={stripeSettings.live_publishable_key}
                  onChange={(e) => setStripeSettings(prev => ({ 
                    ...prev, 
                    live_publishable_key: e.target.value 
                  }))}
                  placeholder="pk_live_..."
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="live_secret_key">Secret Key</Label>
                <Input
                  id="live_secret_key"
                  type={showLiveKeys ? "text" : "password"}
                  value={stripeSettings.live_secret_key}
                  onChange={(e) => setStripeSettings(prev => ({ 
                    ...prev, 
                    live_secret_key: e.target.value 
                  }))}
                  placeholder="sk_live_..."
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="live_webhook_secret">Webhook Signing Secret</Label>
                <Input
                  id="live_webhook_secret"
                  type={showLiveKeys ? "text" : "password"}
                  value={stripeSettings.live_webhook_secret}
                  onChange={(e) => setStripeSettings(prev => ({ 
                    ...prev, 
                    live_webhook_secret: e.target.value 
                  }))}
                  placeholder="whsec_..."
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveStripe} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Stripe Settings
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Code Injection Tab */}
        <TabsContent value="code" className="space-y-6">
          <Alert className="border-amber-500 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700">
              <strong>Caution:</strong> Only add code from trusted sources. Malicious scripts can compromise security.
            </AlertDescription>
          </Alert>

          {/* Head Code */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Head Code</CardTitle>
              <CardDescription>
                Code injected into the {'<head>'} section. Use for meta tags, analytics scripts, or CSS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={codeInjection.head_code}
                onChange={(e) => setCodeInjection(prev => ({ 
                  ...prev, 
                  head_code: e.target.value 
                }))}
                placeholder={`<!-- Example: Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_TRACKING_ID');
</script>`}
                className="font-mono text-sm min-h-[150px]"
              />
            </CardContent>
          </Card>

          {/* Body Start Code */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Body Start Code</CardTitle>
              <CardDescription>
                Code injected right after the opening {'<body>'} tag. Use for no-script fallbacks or early-loading scripts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={codeInjection.body_start_code}
                onChange={(e) => setCodeInjection(prev => ({ 
                  ...prev, 
                  body_start_code: e.target.value 
                }))}
                placeholder={`<!-- Example: Google Tag Manager (noscript) -->
<noscript>
  <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXX"
  height="0" width="0" style="display:none;visibility:hidden"></iframe>
</noscript>`}
                className="font-mono text-sm min-h-[150px]"
              />
            </CardContent>
          </Card>

          {/* Body End Code */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Body End Code (Footer)</CardTitle>
              <CardDescription>
                Code injected before the closing {'</body>'} tag. Use for chat widgets, tracking pixels, or deferred scripts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={codeInjection.body_end_code}
                onChange={(e) => setCodeInjection(prev => ({ 
                  ...prev, 
                  body_end_code: e.target.value 
                }))}
                placeholder={`<!-- Example: Intercom Chat Widget -->
<script>
  window.intercomSettings = {
    api_base: "https://api-iam.intercom.io",
    app_id: "YOUR_APP_ID"
  };
</script>
<script>
  (function(){var w=window;var ic=w.Intercom;...})();
</script>`}
                className="font-mono text-sm min-h-[150px]"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveCodeInjection} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Code Injection
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integrations;
