import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Bot,
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Settings,
  Globe,
  ShoppingCart,
  Languages,
  TestTube,
  Code,
  Database,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import ModerationFeedbackModal from '../components/ModerationFeedbackModal';

// Import tab components
import {
  AgentConfigurationTab,
  AgentKnowledgeTab,
  AgentLanguageTab,
  AgentIntegrationsTab,
  AgentTestTab,
  AgentEmbedTab,
  AgentChannelsTab,
  AgentToolsTab
} from '../components/agent';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AgentEdit = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isNew = !agentId || agentId === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [moderationResult, setModerationResult] = useState(null);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const avatarInputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Providers state
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  
  // Knowledge Base state
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState(null);

  const [agent, setAgent] = useState({
    id: null,
    name: '',
    description: '',
    category: 'General',
    icon: '🤖',
    profile_image_url: null,
    config: {
      system_prompt: '',
      ai_persona: '',
      temperature: 0.7,
      max_tokens: 2000,
      model: '',
      ai_model: '',
      provider_id: '',
      provider_name: '',
      response_language: null,
      language_mode: 'browser',
      scraping_domains: '',
      scraping_max_depth: 2,
      scraping_max_pages: 50,
      woocommerce: {
        enabled: false,
        store_url: '',
        consumer_key: '',
        consumer_secret: ''
      },
      shopify: {
        enabled: false,
        store_domain: '',
        access_token: ''
      }
    },
    is_active: false,
    is_public: false,
    orchestration_enabled: false,
    tags: [],
    channels_enabled: false,
    channel_config: {
      trigger_mode: 'mention',
      response_probability: 0.3,
      response_style: 'helpful',
      response_length: 'medium',
      formality: 0.5,
      creativity: 0.5,
      keywords: []
    }
  });

  // Helper functions
  const getSystemPrompt = () => agent.config?.system_prompt || agent.config?.ai_persona || '';
  const getTemperature = () => agent.config?.temperature ?? 0.7;
  const getMaxTokens = () => agent.config?.max_tokens ?? 2000;
  const getModel = () => agent.config?.model || agent.config?.ai_model || '';
  const getProviderId = useCallback(() => agent.config?.provider_id || '', [agent.config?.provider_id]);
  
  const getAvailableModels = () => {
    const providerId = getProviderId();
    if (!providerId) return [];
    const provider = providers.find(p => p.id === providerId);
    return provider?.models || [];
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAvatarSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${BACKEND_URL}${url}`;
    }
    return url;
  };

  // API functions
  const fetchAgentDocuments = useCallback(async (agentIdToFetch) => {
    try {
      const response = await axios.get(`${API}/agents/${agentIdToFetch}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploadedDocs(response.data || []);
    } catch (error) {
      // Documents fetch failed silently
    }
  }, [token]);

  const fetchScrapingStatus = useCallback(async (agentIdToFetch) => {
    try {
      const response = await axios.get(`${API}/agents/${agentIdToFetch}/scraping-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScrapingStatus(response.data);
    } catch (error) {
      // Silently fail
    }
  }, [token]);

  const fetchAgent = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const agentData = response.data;
      agentData.config = {
        ...agentData.config,
        scraping_domains: agentData.config?.scraping_domains || '',
        scraping_max_depth: agentData.config?.scraping_max_depth || 2,
        scraping_max_pages: agentData.config?.scraping_max_pages || 50,
        woocommerce: {
          enabled: false,
          store_url: '',
          consumer_key: '',
          consumer_secret: '',
          ...agentData.config?.woocommerce
        },
        shopify: {
          enabled: false,
          store_domain: '',
          access_token: '',
          ...agentData.config?.shopify
        }
      };
      setAgent(agentData);
      fetchAgentDocuments(agentId);
      fetchScrapingStatus(agentId);
    } catch (error) {
      toast.error('Failed to load agent');
      navigate('/dashboard/agents');
    } finally {
      setLoading(false);
    }
  }, [agentId, token, navigate, fetchAgentDocuments, fetchScrapingStatus]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    
    const allowedTypes = ['.pdf', '.txt', '.md', '.docx', '.csv'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      toast.error('Unsupported file type. Please upload PDF, TXT, MD, DOCX, or CSV files.');
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await axios.post(`${API}/agents/${agent.id}/documents`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Document uploaded successfully');
      fetchAgentDocuments(agent.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDocument = async (filename) => {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    
    try {
      await axios.delete(`${API}/agents/${agent.id}/documents/${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Document deleted');
      fetchAgentDocuments(agent.id);
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleTriggerScraping = async () => {
    const domains = agent.config?.scraping_domains;
    if (!domains) {
      toast.error('Please enter at least one domain to scrape');
      return;
    }
    
    setScraping(true);
    try {
      const response = await axios.post(`${API}/agents/${agent.id}/scrape`, {
        domains: domains.split(',').map(d => d.trim()).filter(Boolean),
        max_depth: agent.config?.scraping_max_depth || 2,
        max_pages: agent.config?.scraping_max_pages || 50
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScrapingStatus(response.data);
      toast.success('Scraping started. This may take a few minutes.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start scraping');
    } finally {
      setScraping(false);
    }
  };

  // Fetch providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await axios.get(`${API}/agents/providers/available`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProviders(response.data);
        
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
        // Providers fetch failed silently
      } finally {
        setLoadingProviders(false);
      }
    };
    
    if (token) {
      fetchProviders();
    }
  }, [token, isNew, getProviderId]);

  // Fetch agent
  useEffect(() => {
    if (!isNew) {
      fetchAgent();
    }
  }, [isNew, fetchAgent]);

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
          tags: agent.tags,
          channels_enabled: agent.channels_enabled,
          channel_config: agent.channel_config
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
          // Show detailed moderation feedback modal
          setModerationResult(response.data);
          setShowModerationModal(true);
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
        <TabsList className="w-full sm:w-auto flex flex-wrap">
          <TabsTrigger value="configuration" className="flex-1 sm:flex-none">
            <Settings className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex-1 sm:flex-none">
            <Database className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Knowledge</span>
          </TabsTrigger>
          <TabsTrigger value="language" className="flex-1 sm:flex-none">
            <Languages className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Language</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex-1 sm:flex-none">
            <ShoppingCart className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex-1 sm:flex-none">
            <MessageSquare className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Channels</span>
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

        <TabsContent value="configuration" className="space-y-4 sm:space-y-6">
          <AgentConfigurationTab
            agent={agent}
            setAgent={setAgent}
            isNew={isNew}
            providers={providers}
            loadingProviders={loadingProviders}
            getSystemPrompt={getSystemPrompt}
            getTemperature={getTemperature}
            getMaxTokens={getMaxTokens}
            getModel={getModel}
            getProviderId={getProviderId}
            getAvailableModels={getAvailableModels}
            getAvatarSrc={getAvatarSrc}
            handleToggleActive={handleToggleActive}
            handleAvatarUpload={handleAvatarUpload}
            uploadingAvatar={uploadingAvatar}
            avatarInputRef={avatarInputRef}
            token={token}
          />
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4 sm:space-y-6">
          <AgentKnowledgeTab
            agent={agent}
            setAgent={setAgent}
            isNew={isNew}
            uploadedDocs={uploadedDocs}
            uploading={uploading}
            scraping={scraping}
            scrapingStatus={scrapingStatus}
            handleFileUpload={handleFileUpload}
            handleDeleteDocument={handleDeleteDocument}
            handleTriggerScraping={handleTriggerScraping}
            fileInputRef={fileInputRef}
            formatFileSize={formatFileSize}
          />
        </TabsContent>

        <TabsContent value="language" className="space-y-4 sm:space-y-6">
          <AgentLanguageTab agent={agent} setAgent={setAgent} />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 sm:space-y-6">
          <AgentIntegrationsTab agent={agent} setAgent={setAgent} token={token} />
        </TabsContent>

        <TabsContent value="channels" className="space-y-4 sm:space-y-6">
          <AgentChannelsTab agent={agent} setAgent={setAgent} />
        </TabsContent>

        {!isNew && (
          <>
            <TabsContent value="test" className="space-y-4 sm:space-y-6">
              <AgentTestTab agent={agent} agentId={agentId} token={token} />
            </TabsContent>

            <TabsContent value="embed" className="space-y-4 sm:space-y-6">
              <AgentEmbedTab agent={agent} user={user} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Moderation Feedback Modal */}
      <ModerationFeedbackModal
        open={showModerationModal}
        onOpenChange={setShowModerationModal}
        reviewResult={moderationResult}
        agentName={agent.name}
        onEditAgent={() => {
          // Scroll to configuration tab
          document.querySelector('[value="configuration"]')?.click();
        }}
      />
    </div>
  );
};

export default AgentEdit;
