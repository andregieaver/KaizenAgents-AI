import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import {
  Bot,
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  Code,
  Copy,
  Check,
  TestTube,
  Trash2,
  Send,
  User,
  RotateCcw,
  Settings,
  ExternalLink,
  Power,
  Globe,
  Tag,
  ShoppingCart,
  Eye,
  EyeOff,
  Link,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '../components/ui/scroll-area';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AgentEdit = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  // Handle both direct /agents/new route (agentId is undefined) and fallback check
  const isNew = !agentId || agentId === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const avatarInputRef = useRef(null);
  
  // Providers state
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  
  // Test conversation state
  const [testMessage, setTestMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [testing, setTesting] = useState(false);
  
  // Categories
  const categories = [
    'Customer Support',
    'Sales',
    'Technical Support',
    'E-commerce',
    'General',
    'Other'
  ];

  const [agent, setAgent] = useState({
    id: null,
    name: '',
    description: '',
    category: 'General',
    icon: '🤖',
    profile_image_url: null,
    config: {
      system_prompt: '',
      ai_persona: '',  // Legacy field
      temperature: 0.7,
      max_tokens: 2000,
      model: '',
      ai_model: '',  // Legacy field
      provider_id: '',
      provider_name: '',
      woocommerce: {
        enabled: false,
        store_url: '',
        consumer_key: '',
        consumer_secret: ''
      }
    },
    is_active: false,
    is_public: false,
    orchestration_enabled: false,
    tags: []
  });
  
  // WooCommerce state
  const [testingWooCommerce, setTestingWooCommerce] = useState(false);
  const [showWooCommerceKeys, setShowWooCommerceKeys] = useState(false);

  // Helper to get system prompt (handles both new and legacy field names)
  const getSystemPrompt = () => {
    return agent.config?.system_prompt || agent.config?.ai_persona || '';
  };

  // Helper to get temperature
  const getTemperature = () => {
    return agent.config?.temperature ?? 0.7;
  };

  // Helper to get max tokens
  const getMaxTokens = () => {
    return agent.config?.max_tokens ?? 2000;
  };

  // Helper to get model
  const getModel = () => {
    return agent.config?.model || agent.config?.ai_model || '';
  };

  // Helper to get provider ID
  const getProviderId = () => {
    return agent.config?.provider_id || '';
  };

  // Get available models for selected provider
  const getAvailableModels = () => {
    const providerId = getProviderId();
    if (!providerId) return [];
    const provider = providers.find(p => p.id === providerId);
    return provider?.models || [];
  };

  // Fetch available providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await axios.get(`${API}/agents/providers/available`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProviders(response.data);
        
        // If creating new agent and no provider set, select the first one
        if (isNew && response.data.length > 0 && !getProviderId()) {
          const firstProvider = response.data[0];
          setAgent(prev => ({
            ...prev,
            config: {
              ...prev.config,
              provider_id: firstProvider.id,
              provider_name: firstProvider.name,
              model: firstProvider.default_model || firstProvider.models?.[0] || ''
            }
          }));
        }
      } catch (error) {
        console.error('Error fetching providers:', error);
        // Don't show error toast - providers might not be configured yet
      } finally {
        setLoadingProviders(false);
      }
    };
    
    if (token) {
      fetchProviders();
    }
  }, [token]);

  useEffect(() => {
    if (!isNew) {
      fetchAgent();
    }
  }, [agentId, token]);

  const fetchAgent = async () => {
    try {
      const response = await axios.get(`${API}/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgent(response.data);
    } catch (error) {
      console.error('Error fetching agent:', error);
      toast.error('Failed to load agent');
      navigate('/dashboard/agents');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agent.name || !agent.description) {
      toast.error('Please fill in agent name and description');
      return;
    }

    const systemPrompt = getSystemPrompt();
    if (!systemPrompt) {
      toast.error('Please provide a system prompt');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const createData = {
          name: agent.name,
          description: agent.description,
          category: agent.category,
          icon: agent.icon,
          system_prompt: systemPrompt,
          temperature: getTemperature(),
          max_tokens: getMaxTokens(),
          model: getModel() || null,
          provider_id: getProviderId() || null
        };
        
        const response = await axios.post(
          `${API}/agents/`,
          createData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Agent created successfully');
        navigate(`/dashboard/agents/${response.data.id}`);
      } else {
        const updateData = {
          name: agent.name,
          description: agent.description,
          category: agent.category,
          icon: agent.icon,
          system_prompt: systemPrompt,
          temperature: getTemperature(),
          max_tokens: getMaxTokens(),
          model: getModel(),
          provider_id: getProviderId(),
          orchestration_enabled: agent.orchestration_enabled,
          tags: agent.tags
        };
        
        await axios.patch(
          `${API}/agents/${agentId}`,
          updateData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Agent updated successfully');
        fetchAgent();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (agent.is_active) {
      toast.error('Cannot delete active agent. Please deactivate it first.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this agent?')) return;

    try {
      await axios.delete(`${API}/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent deleted');
      navigate('/dashboard/agents');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete agent');
    }
  };

  const handleToggleActive = async () => {
    try {
      if (agent.is_active) {
        await axios.post(`${API}/agents/${agentId}/deactivate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Agent deactivated');
      } else {
        await axios.post(`${API}/agents/${agentId}/activate`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Agent activated');
      }
      fetchAgent();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update agent');
    }
  };

  const handlePublish = async () => {
    if (!agent.is_active) {
      toast.error('Please activate the agent before publishing to marketplace');
      return;
    }
    
    setPublishing(true);
    try {
      if (agent.is_public) {
        await axios.post(`${API}/agents/${agentId}/unpublish`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Agent removed from marketplace');
      } else {
        const response = await axios.post(`${API}/agents/${agentId}/publish`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.approved) {
          toast.success('Agent published to marketplace!');
        } else {
          toast.error(`Publishing failed: ${response.data.issues?.join(', ') || 'Review failed'}`);
        }
      }
      fetchAgent();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to publish agent');
    } finally {
      setPublishing(false);
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file || isNew) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.post(
        `${API}/agents/${agentId}/upload-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Avatar uploaded');
      fetchAgent();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleTestAgent = async () => {
    if (!testMessage.trim() || isNew) return;

    setTesting(true);
    try {
      // Call the real AI test endpoint
      const response = await axios.post(
        `${API}/agents/${agentId}/test`,
        {
          message: testMessage,
          history: conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: testMessage },
        { role: 'assistant', content: response.data.agent_response }
      ];
      
      setConversationHistory(newHistory);
      setTestMessage('');
      
      // Show model info on first message
      if (conversationHistory.length === 0) {
        toast.success(`Using ${response.data.model_used} via ${response.data.provider_used}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Test failed';
      toast.error(errorMsg);
      console.error('Agent test error:', error);
    } finally {
      setTesting(false);
    }
  };

  const getAvatarSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${BACKEND_URL}${url}`;
    }
    return url;
  };

  const getEmbedCode = () => {
    const baseUrl = BACKEND_URL?.replace('/api', '') || window.location.origin;
    return `<script src="${baseUrl}/widget.js" data-tenant-id="${user?.tenant_id}" data-agent-id="${agent.id}" async></script>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    toast.success('Embed code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/agents')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden text-xl sm:text-2xl shrink-0">
              {getAvatarSrc(agent.profile_image_url) ? (
                <img 
                  src={getAvatarSrc(agent.profile_image_url)} 
                  alt={agent.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                agent.icon || <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                <span className="truncate">{isNew ? 'Create New Agent' : agent.name || 'Edit Agent'}</span>
                {agent.is_active && (
                  <Badge className="bg-green-500 text-white shrink-0">Active</Badge>
                )}
              </h1>
              {!isNew && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {agent.category} • {getModel() || 'Default model'}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {!isNew && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                className="hidden sm:flex"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden md:inline">{agent.is_public ? 'Unpublish' : 'Publish'}</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="sm:hidden"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive" 
                onClick={handleDelete}
                disabled={agent.is_active}
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">{isNew ? 'Create Agent' : 'Save'}</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="configuration" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto flex">
          <TabsTrigger value="configuration" className="flex-1 sm:flex-none">
            <Settings className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex-1 sm:flex-none">
            <ShoppingCart className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          {!isNew && (
            <>
              <TabsTrigger value="test" className="flex-1 sm:flex-none">
                <TestTube className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Test</span>
              </TabsTrigger>
              <TabsTrigger value="embed" className="flex-1 sm:flex-none">
                <Code className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Embed</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Main Configuration */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <Card className="border border-border">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Agent Details</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Basic information about this agent</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="agent-name" className="text-sm">Agent Name *</Label>
                      <Input
                        id="agent-name"
                        placeholder="e.g., Customer Support Specialist"
                        value={agent.name}
                        onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="agent-icon" className="text-sm">Icon</Label>
                      <Input
                        id="agent-icon"
                        placeholder="🤖"
                        value={agent.icon}
                        onChange={(e) => setAgent({ ...agent, icon: e.target.value })}
                        className="text-xl"
                        maxLength={2}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="A brief description of what this agent does..."
                      rows={2}
                      value={agent.description}
                      onChange={(e) => setAgent({ ...agent, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm">Category</Label>
                    <select
                      id="category"
                      className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                      value={agent.category}
                      onChange={(e) => setAgent({ ...agent, category: e.target.value })}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Provider and Model Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider" className="text-sm">AI Provider</Label>
                      <select
                        id="provider"
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        value={getProviderId()}
                        onChange={(e) => {
                          const selectedProvider = providers.find(p => p.id === e.target.value);
                          setAgent({ 
                            ...agent, 
                            config: { 
                              ...agent.config, 
                              provider_id: e.target.value,
                              provider_name: selectedProvider?.name || '',
                              // Reset model to provider's default when changing provider
                              model: selectedProvider?.default_model || selectedProvider?.models?.[0] || ''
                            }
                          });
                        }}
                        disabled={loadingProviders}
                      >
                        {loadingProviders ? (
                          <option value="">Loading providers...</option>
                        ) : providers.length === 0 ? (
                          <option value="">No providers configured</option>
                        ) : (
                          <>
                            <option value="">Select a provider</option>
                            {providers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name} ({provider.type})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {providers.length === 0 && !loadingProviders && (
                        <p className="text-xs text-amber-600">
                          No AI providers configured. Ask your admin to set one up.
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="model" className="text-sm">Model</Label>
                      <select
                        id="model"
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        value={getModel()}
                        onChange={(e) => setAgent({ 
                          ...agent, 
                          config: { ...agent.config, model: e.target.value, ai_model: e.target.value }
                        })}
                        disabled={!getProviderId() || loadingProviders}
                      >
                        {!getProviderId() ? (
                          <option value="">Select a provider first</option>
                        ) : getAvailableModels().length === 0 ? (
                          <>
                            <option value="">Enter model name</option>
                            <option value={getModel()} disabled={!getModel()}>
                              {getModel() || 'No models available'}
                            </option>
                          </>
                        ) : (
                          <>
                            <option value="">Select a model</option>
                            {getAvailableModels().map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                          </>
                        )}
                      </select>
                      {getProviderId() && getAvailableModels().length === 0 && (
                        <Input
                          placeholder="Enter model name (e.g., gpt-4o-mini)"
                          value={getModel()}
                          onChange={(e) => setAgent({ 
                            ...agent, 
                            config: { ...agent.config, model: e.target.value, ai_model: e.target.value }
                          })}
                          className="mt-2"
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt" className="text-sm">System Prompt *</Label>
                    <Textarea
                      id="system-prompt"
                      placeholder="You are a helpful customer support assistant..."
                      rows={6}
                      className="min-h-[120px] sm:min-h-[180px]"
                      value={getSystemPrompt()}
                      onChange={(e) => setAgent({ 
                        ...agent, 
                        config: { ...agent.config, system_prompt: e.target.value, ai_persona: e.target.value }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Define the agent's personality, knowledge, and behavior
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Model Parameters</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Fine-tune the agent's response generation</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="temperature" className="text-sm">Temperature</Label>
                      <span className="text-sm font-mono text-muted-foreground">{getTemperature()}</span>
                    </div>
                    <input
                      type="range"
                      id="temperature"
                      min="0"
                      max="2"
                      step="0.1"
                      value={getTemperature()}
                      onChange={(e) => setAgent({ 
                        ...agent, 
                        config: { ...agent.config, temperature: parseFloat(e.target.value) }
                      })}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower = more focused, Higher = more creative
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="max-tokens" className="text-sm">Max Tokens</Label>
                    <Input
                      type="number"
                      id="max-tokens"
                      value={getMaxTokens()}
                      onChange={(e) => setAgent({ 
                        ...agent, 
                        config: { ...agent.config, max_tokens: parseInt(e.target.value) }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum length of the agent's responses
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Moves below on mobile */}
            <div className="space-y-4 sm:space-y-6">
              {/* Avatar */}
              <Card className="border border-border">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Agent Avatar</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Visual representation of the agent</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                  <div className="flex justify-center">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden text-3xl sm:text-4xl">
                      {getAvatarSrc(agent.profile_image_url) ? (
                        <img 
                          src={getAvatarSrc(agent.profile_image_url)} 
                          alt={agent.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        agent.icon || <Bot className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
                      )}
                    </div>
                  </div>
                  
                  {!isNew && (
                    <>
                      <input
                        type="file"
                        ref={avatarInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleAvatarUpload(e.target.files[0])}
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Avatar
                      </Button>
                    </>
                  )}
                  {isNew && (
                    <p className="text-xs text-muted-foreground text-center">
                      Save the agent first to upload an avatar
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Status & Actions */}
              {!isNew && (
                <Card className="border border-border">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Agent Status</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Power className={`h-4 w-4 ${agent.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">
                          {agent.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <Switch
                        checked={agent.is_active}
                        onCheckedChange={handleToggleActive}
                      />
                    </div>
                    
                    {agent.is_public && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-primary" />
                        <span>Published to Marketplace</span>
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agent ID</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{agent.id?.slice(0, 8)}...</code>
                      </div>
                      {agent.created_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created</span>
                          <span>{new Date(agent.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Orchestration */}
              {!isNew && (
                <Card className="border border-border">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Orchestration</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Multi-agent coordination settings</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        <span className="text-sm">Enable Orchestration</span>
                      </div>
                      <Switch
                        checked={agent.orchestration_enabled}
                        onCheckedChange={(checked) => setAgent({ ...agent, orchestration_enabled: checked })}
                      />
                    </div>
                    
                    {agent.orchestration_enabled && (
                      <div className="space-y-2">
                        <Label>Tags (comma-separated)</Label>
                        <Input
                          placeholder="support, billing, technical"
                          value={agent.tags?.join(', ') || ''}
                          onChange={(e) => setAgent({ 
                            ...agent, 
                            tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Tags help the mother agent route requests
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Test Tab */}
        {!isNew && (
          <TabsContent value="test">
            <Card className="border border-border">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Test Conversation</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Chat with this agent to test its responses</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConversationHistory([])}
                    disabled={conversationHistory.length === 0}
                    className="self-start sm:self-auto"
                  >
                    <RotateCcw className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="space-y-4">
                  {/* Conversation History */}
                  <ScrollArea className="h-[300px] sm:h-[400px] pr-2 sm:pr-4">
                    {conversationHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                        <Bot className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Start a conversation to test the agent
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {conversationHistory.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-2 sm:gap-3">
                            <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              msg.role === 'user' 
                                ? 'bg-primary/10' 
                                : 'bg-primary'
                            }`}>
                              {msg.role === 'user' ? (
                                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                              ) : (
                                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                              )}
                            </div>
                            <div className={`flex-1 p-2.5 sm:p-3 rounded-lg ${
                              msg.role === 'user' 
                                ? 'bg-muted' 
                                : 'bg-primary/10'
                            }`}>
                              <p className="text-xs sm:text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {testing && (
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary flex items-center justify-center">
                              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white animate-spin" />
                            </div>
                            <div className="flex-1 bg-primary/10 p-2.5 sm:p-3 rounded-lg">
                              <p className="text-xs sm:text-sm text-muted-foreground">Thinking...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                  
                  {/* Input Area */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Input
                      placeholder="Type your test message..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleTestAgent()}
                      disabled={testing}
                    />
                    <Button onClick={handleTestAgent} disabled={testing || !testMessage.trim()}>
                      {testing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Embed Code Tab */}
        {!isNew && (
          <TabsContent value="embed">
            <Card className="border border-border">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Agent Embed Code</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Add this specific agent as a chat widget on your website
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4 sm:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-sm">Agent ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={agent.id || ''}
                      readOnly
                      className="h-10 font-mono text-xs sm:text-sm bg-muted flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(agent.id || '');
                        toast.success('Agent ID copied!');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-sm">Embed Code</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Copy this code and paste it before the closing &lt;/body&gt; tag on your website.
                    This will show the chat widget with <strong>{agent.name}</strong> as the AI agent.
                  </p>
                  <div className="relative">
                    <pre className="bg-muted p-3 sm:p-4 rounded-lg overflow-x-auto text-xs sm:text-sm font-mono">
                      <code className="break-all whitespace-pre-wrap">{getEmbedCode()}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={copyEmbedCode}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-sm">Test Your Widget</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Preview how the widget will look with this agent.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => window.open(`/widget-demo?tenant=${user?.tenant_id}&agent=${agent.id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Widget Preview
                  </Button>
                </div>

                <div className="bg-muted/50 p-3 sm:p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-xs sm:text-sm">Key Attributes</h4>
                  <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                    <li><code className="bg-muted px-1 rounded text-xs">data-tenant-id</code> - Your company identifier</li>
                    <li><code className="bg-muted px-1 rounded text-xs">data-agent-id</code> - Specifies this particular agent</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AgentEdit;
