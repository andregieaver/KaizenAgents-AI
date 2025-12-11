import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import AgentConfiguration from '../components/AgentConfiguration';
import {
  Settings as SettingsIcon,
  Palette,
  Bot,
  Code,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  X,
  Loader2,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Settings = () => {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API}/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSettings(response.data);
        // Don't show the masked key in the input
        if (response.data.openai_api_key) {
          setApiKey('');
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [token]);

  const handleSave = async (field, value) => {
    setSaving(true);
    try {
      const response = await axios.put(
        `${API}/settings`,
        { [field]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSettings(response.data);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    await handleSave('openai_api_key', apiKey);
    setApiKey('');
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPEG, PNG, GIF, WebP, or SVG');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/settings/brand-logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Update local state with new logo URL
      const newLogoUrl = response.data.brand_logo;
      setSettings({ ...settings, brand_logo: newLogoUrl });
      toast.success('Brand logo updated!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    await handleSave('brand_logo', '');
    setSettings({ ...settings, brand_logo: '' });
  };

  const getLogoSrc = (url) => {
    if (!url) return null;
    // If it's a relative URL from our API, prepend the backend URL
    if (url.startsWith('/api/')) {
      return `${BACKEND_URL}${url}`;
    }
    return url;
  };

  const copyEmbedCode = () => {
    const code = `<script src="${window.location.origin}/widget.js" data-tenant-id="${user?.tenant_id}"></script>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Embed code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[400px] bg-muted rounded-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="settings-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure your support hub and widget</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="general" className="gap-2" data-testid="tab-general">
            <SettingsIcon className="h-4 w-4 hidden sm:block" />
            General
          </TabsTrigger>
          <TabsTrigger value="agent-config" className="gap-2" data-testid="tab-agent-config">
            <Sparkles className="h-4 w-4 hidden sm:block" />
            Agent
          </TabsTrigger>
          <TabsTrigger value="widget" className="gap-2" data-testid="tab-widget">
            <Palette className="h-4 w-4 hidden sm:block" />
            Widget
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2" data-testid="tab-ai">
            <Bot className="h-4 w-4 hidden sm:block" />
            AI
          </TabsTrigger>
          <TabsTrigger value="embed" className="gap-2" data-testid="tab-embed">
            <Code className="h-4 w-4 hidden sm:block" />
            Embed
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading">General Settings</CardTitle>
              <CardDescription>Basic information about your support hub</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="brand_name">Brand Name</Label>
                <Input
                  id="brand_name"
                  value={settings?.brand_name || ''}
                  onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })}
                  onBlur={(e) => handleSave('brand_name', e.target.value)}
                  placeholder="Your Company"
                  className="h-10 max-w-md"
                  data-testid="brand-name-input"
                />
                <p className="text-xs text-muted-foreground">This name appears in the chat widget header</p>
              </div>

              <div className="space-y-2">
                <Label>Brand Logo</Label>
                <div className="flex items-start gap-4">
                  {settings?.brand_logo ? (
                    <div className="relative">
                      <img
                        src={getLogoSrc(settings.brand_logo)}
                        alt="Brand logo"
                        className="h-24 w-24 object-contain rounded-sm border border-border bg-muted p-2"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={handleRemoveLogo}
                        disabled={uploadingLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-sm border border-dashed border-border bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="logo-file-input"
                    />
                    <Button
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="w-full max-w-xs"
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          {settings?.brand_logo ? 'Change Logo' : 'Upload Logo'}
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Upload a logo for the chat widget header. Max 5MB. Supported: JPEG, PNG, GIF, WebP, SVG
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-3 items-center">
                  <Input
                    type="color"
                    id="primary_color"
                    value={settings?.primary_color || '#0047AB'}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    onBlur={(e) => handleSave('primary_color', e.target.value)}
                    className="h-10 w-16 p-1 cursor-pointer"
                    data-testid="primary-color-input"
                  />
                  <Input
                    value={settings?.primary_color || '#0047AB'}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    onBlur={(e) => handleSave('primary_color', e.target.value)}
                    className="h-10 w-32 font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for buttons and accents in the widget</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select
                  value={settings?.date_format || 'MM/DD/YYYY'}
                  onValueChange={(value) => {
                    setSettings({ ...settings, date_format: value });
                    handleSave('date_format', value);
                  }}
                >
                  <SelectTrigger className="h-10 max-w-md" data-testid="date-format-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</SelectItem>
                    <SelectItem value="DD.MM.YYYY">DD.MM.YYYY (31.12.2024)</SelectItem>
                    <SelectItem value="DD MMM YYYY">DD MMM YYYY (31 Dec 2024)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choose how dates are displayed across the platform</p>
              </div>

              <div className="space-y-2">
                <Label>Time Format</Label>
                <Select
                  value={settings?.time_format || '12h'}
                  onValueChange={(value) => {
                    setSettings({ ...settings, time_format: value });
                    handleSave('time_format', value);
                  }}
                >
                  <SelectTrigger className="h-10 max-w-md" data-testid="time-format-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (3:45 PM)</SelectItem>
                    <SelectItem value="24h">24-hour (15:45)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choose between 12-hour or 24-hour time display</p>
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings?.timezone || 'UTC'}
                  onValueChange={(value) => {
                    setSettings({ ...settings, timezone: value });
                    handleSave('timezone', value);
                  }}
                >
                  <SelectTrigger className="h-10 max-w-md" data-testid="timezone-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                    <SelectItem value="America/New_York">America/New York (EST/EDT)</SelectItem>
                    <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                    <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los Angeles (PST/PDT)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Rome">Europe/Rome (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Madrid">Europe/Madrid (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Oslo">Europe/Oslo (CET/CEST)</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                    <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                    <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</SelectItem>
                    <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZDT/NZST)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select your local timezone for accurate time display</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Widget Settings */}
        <TabsContent value="widget">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading">Widget Appearance</CardTitle>
              <CardDescription>Customize how the chat widget looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Widget Position</Label>
                <Select
                  value={settings?.widget_position || 'bottom-right'}
                  onValueChange={(value) => {
                    setSettings({ ...settings, widget_position: value });
                    handleSave('widget_position', value);
                  }}
                >
                  <SelectTrigger className="h-10 max-w-md" data-testid="widget-position-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Widget Theme</Label>
                <Select
                  value={settings?.widget_theme || 'light'}
                  onValueChange={(value) => {
                    setSettings({ ...settings, widget_theme: value });
                    handleSave('widget_theme', value);
                  }}
                >
                  <SelectTrigger className="h-10 max-w-md" data-testid="widget-theme-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcome_message">Welcome Message</Label>
                <Textarea
                  id="welcome_message"
                  value={settings?.welcome_message || ''}
                  onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                  onBlur={(e) => handleSave('welcome_message', e.target.value)}
                  placeholder="Hi! How can we help you today?"
                  className="max-w-md resize-none"
                  rows={3}
                  data-testid="welcome-message-input"
                />
                <p className="text-xs text-muted-foreground">First message shown when a customer opens the widget</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading">AI Configuration</CardTitle>
              <CardDescription>Configure the AI assistant behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="openai_api_key" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  OpenAI API Key
                </Label>
                <div className="flex gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Input
                      id="openai_api_key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={settings?.openai_api_key ? 'Key configured (enter new to update)' : 'sk-...'}
                      className="h-10 pr-10 font-mono text-sm"
                      data-testid="api-key-input"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim() || saving}
                    data-testid="save-api-key-btn"
                  >
                    Save Key
                  </Button>
                </div>
                {settings?.openai_api_key && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    API key configured: {settings.openai_api_key}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    OpenAI Platform
                  </a>
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>AI Model</Label>
                <Select
                  value={settings?.ai_model || 'gpt-4o-mini'}
                  onValueChange={(value) => {
                    setSettings({ ...settings, ai_model: value });
                    handleSave('ai_model', value);
                  }}
                >
                  <SelectTrigger className="h-10 max-w-md" data-testid="ai-model-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast & Affordable)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (Most Capable)</SelectItem>
                    <SelectItem value="gpt-4.1">GPT-4.1 (Latest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>AI Tone</Label>
                <Select
                  value={settings?.ai_tone || 'friendly'}
                  onValueChange={(value) => {
                    setSettings({ ...settings, ai_tone: value });
                    handleSave('ai_tone', value);
                  }}
                >
                  <SelectTrigger className="h-10 max-w-md" data-testid="ai-tone-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai_persona">AI Persona</Label>
                <Textarea
                  id="ai_persona"
                  value={settings?.ai_persona || ''}
                  onChange={(e) => setSettings({ ...settings, ai_persona: e.target.value })}
                  onBlur={(e) => handleSave('ai_persona', e.target.value)}
                  placeholder="You are a helpful and friendly customer support assistant."
                  className="max-w-md resize-none"
                  rows={4}
                  data-testid="ai-persona-input"
                />
                <p className="text-xs text-muted-foreground">Define the AI&apos;s personality and behavior</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embed Settings */}
        <TabsContent value="embed">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading">Embed Widget</CardTitle>
              <CardDescription>Add the chat widget to your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Your Company ID</Label>
                <div className="flex gap-2 max-w-md">
                  <Input
                    value={user?.tenant_id || ''}
                    readOnly
                    className="h-10 font-mono text-sm bg-muted"
                    data-testid="tenant-id-display"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(user?.tenant_id || '');
                      toast.success('Company ID copied!');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Embed Code</Label>
                <p className="text-sm text-muted-foreground">Copy this code and paste it before the closing &lt;/body&gt; tag on your website.</p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-sm overflow-x-auto text-sm font-mono">
                    <code>{`<script src="${window.location.origin}/widget.js" data-tenant-id="${user?.tenant_id}"></script>`}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={copyEmbedCode}
                    data-testid="copy-embed-btn"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Test Your Widget</Label>
                <p className="text-sm text-muted-foreground">Preview how the widget will look on your site.</p>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/widget-demo?tenant=${user?.tenant_id}`, '_blank')}
                  data-testid="preview-widget-btn"
                >
                  Open Widget Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
