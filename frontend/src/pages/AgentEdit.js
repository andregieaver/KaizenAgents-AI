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
  History,
  Trash2,
  Send,
  User,
  RotateCcw,
  Settings,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '../components/ui/scroll-area';
import AgentVersionHistory from '../components/AgentVersionHistory';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AgentEdit = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isNew = agentId === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const avatarInputRef = useRef(null);
  
  // Test conversation state
  const [testMessage, setTestMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [testing, setTesting] = useState(false);
  
  const [agent, setAgent] = useState({
    id: null,
    name: '',
    provider_id: '',
    model: '',
    system_prompt: '',
    temperature: 0.7,
    max_tokens: 2000,
    is_marketplace: false,
    avatar_url: null,
    version: 1
  });

  useEffect(() => {
    fetchProviders();
    if (!isNew) {
      fetchAgent();
    }
  }, [agentId, token]);

  const fetchProviders = async () => {
    try {
      const response = await axios.get(`${API}/admin/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProviders(response.data.filter(p => p.is_active));
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Failed to load providers');
    }
  };

  const fetchAgent = async () => {
    try {
      const response = await axios.get(`${API}/admin/agents/${agentId}`, {
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
    if (!agent.name || !agent.provider_id || !agent.model || !agent.system_prompt) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const response = await axios.post(
          `${API}/admin/agents`,
          agent,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Agent created successfully');
        navigate(`/dashboard/agents/${response.data.id}`);
      } else {
        await axios.put(
          `${API}/admin/agents/${agentId}`,
          agent,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Agent updated successfully');
        fetchAgent(); // Refresh to get new version
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;

    try {
      await axios.delete(`${API}/admin/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent deleted');
      navigate('/dashboard/agents');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete agent');
    }
  };

  const handleAvatarUpload = async (file) => {
    if (!file || isNew) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.post(
        `${API}/admin/agents/${agentId}/avatar`,
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
      const response = await axios.post(
        `${API}/admin/agents/${agentId}/test`,
        {
          message: testMessage,
          history: conversationHistory
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
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Test failed');
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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/agents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {getAvatarSrc(agent.avatar_url) ? (
                <img 
                  src={getAvatarSrc(agent.avatar_url)} 
                  alt={agent.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Bot className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {isNew ? 'Create New Agent' : agent.name || 'Edit Agent'}
              </h1>
              {!isNew && (
                <p className="text-sm text-muted-foreground">
                  Version {agent.version} • {agent.provider_name} • {agent.model}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Button variant="outline" onClick={() => setShowVersionHistory(true)}>
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
              <Button variant="outline" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isNew ? 'Create Agent' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          {!isNew && (
            <>
              <TabsTrigger value="test">
                <TestTube className="h-4 w-4 mr-2" />
                Test
              </TabsTrigger>
              <TabsTrigger value="embed">
                <Code className="h-4 w-4 mr-2" />
                Embed Code
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Configuration */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>Agent Details</CardTitle>
                  <CardDescription>Basic information about this agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Agent Name *</Label>
                    <Input
                      id="agent-name"
                      placeholder="e.g., Customer Support Specialist"
                      value={agent.name}
                      onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider">Provider *</Label>
                      <select
                        id="provider"
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        value={agent.provider_id}
                        onChange={(e) => setAgent({ ...agent, provider_id: e.target.value, model: '' })}
                        disabled={!isNew}
                      >
                        <option value="">Select provider</option>
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                      {!isNew && (
                        <p className="text-xs text-muted-foreground">Provider cannot be changed</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="model">Model *</Label>
                      <select
                        id="model"
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        value={agent.model}
                        onChange={(e) => setAgent({ ...agent, model: e.target.value })}
                        disabled={!agent.provider_id}
                      >
                        <option value="">Select model</option>
                        {agent.provider_id && providers
                          .find(p => p.id === agent.provider_id)
                          ?.models.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="system-prompt">System Prompt *</Label>
                    <Textarea
                      id="system-prompt"
                      placeholder="You are a helpful customer support assistant..."
                      rows={8}
                      value={agent.system_prompt}
                      onChange={(e) => setAgent({ ...agent, system_prompt: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Define the agent's personality, knowledge, and behavior
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>Model Parameters</CardTitle>
                  <CardDescription>Fine-tune the agent's response generation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="temperature">Temperature</Label>
                      <span className="text-sm font-mono text-muted-foreground">{agent.temperature}</span>
                    </div>
                    <input
                      type="range"
                      id="temperature"
                      min="0"
                      max="2"
                      step="0.1"
                      value={agent.temperature}
                      onChange={(e) => setAgent({ ...agent, temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower = more focused, Higher = more creative
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input
                      type="number"
                      id="max-tokens"
                      value={agent.max_tokens}
                      onChange={(e) => setAgent({ ...agent, max_tokens: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum length of the agent's responses
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Avatar */}
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>Agent Avatar</CardTitle>
                  <CardDescription>Visual representation of the agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {getAvatarSrc(agent.avatar_url) ? (
                        <img 
                          src={getAvatarSrc(agent.avatar_url)} 
                          alt={agent.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Bot className="h-12 w-12 text-primary" />
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

              {/* Quick Info */}
              {!isNew && (
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle>Agent Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Version</span>
                      <Badge variant="secondary">v{agent.version}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Agent ID</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{agent.id?.slice(0, 8)}...</code>
                    </div>
                    {agent.is_marketplace && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge>Marketplace</Badge>
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
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Test Conversation</CardTitle>
                    <CardDescription>Chat with this agent to test its responses</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConversationHistory([])}
                    disabled={conversationHistory.length === 0}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Conversation History */}
                  <ScrollArea className="h-[400px] pr-4">
                    {conversationHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Bot className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Start a conversation to test the agent
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {conversationHistory.map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              msg.role === 'user' 
                                ? 'bg-primary/10' 
                                : 'bg-primary'
                            }`}>
                              {msg.role === 'user' ? (
                                <User className="h-4 w-4 text-primary" />
                              ) : (
                                <Bot className="h-4 w-4 text-white" />
                              )}
                            </div>
                            <div className={`flex-1 p-3 rounded-lg ${
                              msg.role === 'user' 
                                ? 'bg-muted' 
                                : 'bg-primary/10'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {testing && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                              <Loader2 className="h-4 w-4 text-white animate-spin" />
                            </div>
                            <div className="flex-1 bg-primary/10 p-3 rounded-lg">
                              <p className="text-sm text-muted-foreground">Thinking...</p>
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
              <CardHeader>
                <CardTitle>Agent Embed Code</CardTitle>
                <CardDescription>
                  Add this specific agent as a chat widget on your website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Agent ID</Label>
                  <div className="flex gap-2 max-w-md">
                    <Input
                      value={agent.id || ''}
                      readOnly
                      className="h-10 font-mono text-sm bg-muted"
                    />
                    <Button
                      variant="outline"
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

                <div className="space-y-3">
                  <Label>Embed Code</Label>
                  <p className="text-sm text-muted-foreground">
                    Copy this code and paste it before the closing &lt;/body&gt; tag on your website.
                    This will show the chat widget with <strong>{agent.name}</strong> as the AI agent.
                  </p>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
                      <code>{getEmbedCode()}</code>
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

                <div className="space-y-3">
                  <Label>Test Your Widget</Label>
                  <p className="text-sm text-muted-foreground">
                    Preview how the widget will look with this agent.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/widget-demo?tenant=${user?.tenant_id}&agent=${agent.id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Widget Preview
                  </Button>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Key Attributes</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li><code className="bg-muted px-1 rounded">data-tenant-id</code> - Your company identifier</li>
                    <li><code className="bg-muted px-1 rounded">data-agent-id</code> - Specifies this particular agent</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Version History Dialog */}
      {!isNew && (
        <AgentVersionHistory
          agentId={agent.id}
          agentName={agent.name}
          open={showVersionHistory}
          onOpenChange={setShowVersionHistory}
          onRollback={() => {
            fetchAgent();
            setShowVersionHistory(false);
          }}
        />
      )}
    </div>
  );
};

export default AgentEdit;
