import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  Bot,
  Plus,
  Upload,
  Loader2,
  TestTube,
  History,
  Settings,
  Trash2,
  MessageSquare,
  X,
  Send,
  User,
  Edit,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import AgentVersionHistory from '../components/AgentVersionHistory';
import { AgentCardSkeleton } from '../components/LoadingStates';
import { NoAgentsState, ErrorState } from '../components/EmptyStates';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Agents = () => {
  const { token } = useAuth();
  const [agents, setAgents] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [versionHistoryAgent, setVersionHistoryAgent] = useState(null);
  const [testMessage, setTestMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [testing, setTesting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(null);
  const avatarInputRef = useRef(null);

  const [newAgent, setNewAgent] = useState({
    name: '',
    provider_id: '',
    model: '',
    system_prompt: '',
    temperature: 0.7,
    max_tokens: 2000,
    is_marketplace: false
  });

  const [editAgent, setEditAgent] = useState({
    name: '',
    provider_id: '',
    model: '',
    system_prompt: '',
    temperature: 0.7,
    max_tokens: 2000
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    try {
      const [agentsRes, providersRes] = await Promise.all([
        axios.get(`${API}/admin/agents`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/providers`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAgents(agentsRes.data);
      setProviders(providersRes.data.filter(p => p.is_active));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgent.name || !newAgent.provider_id || !newAgent.model || !newAgent.system_prompt) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(
        `${API}/admin/agents`,
        newAgent,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Agent created successfully');
      setShowCreateDialog(false);
      setNewAgent({
        name: '',
        provider_id: '',
        model: '',
        system_prompt: '',
        temperature: 0.7,
        max_tokens: 2000,
        is_marketplace: false
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create agent');
    }
  };

  const openEditDialog = (agent) => {
    setEditingAgent(agent);
    setEditAgent({
      name: agent.name,
      provider_id: agent.provider_id,
      model: agent.model,
      system_prompt: agent.system_prompt,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens
    });
    setShowEditDialog(true);
  };

  const handleUpdateAgent = async () => {
    if (!editAgent.name || !editAgent.model || !editAgent.system_prompt) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.put(
        `${API}/admin/agents/${editingAgent.id}`,
        editAgent,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Agent updated successfully');
      setShowEditDialog(false);
      setEditingAgent(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update agent');
    }
  };

  const handleAvatarUpload = async (agentId, file) => {
    if (!file) return;

    setUploadingAvatar(agentId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
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
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(null);
    }
  };

  const handleTestAgent = async () => {
    if (!testMessage.trim()) {
      toast.error('Please enter a test message');
      return;
    }

    setTesting(true);
    
    try {
      const response = await axios.post(
        `${API}/admin/agents/${selectedAgent.id}/test`,
        {
          message: testMessage,
          history: conversationHistory
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Add user message and agent response to conversation history
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: testMessage },
        { role: 'assistant', content: response.data.agent_response }
      ];
      
      setConversationHistory(newHistory);
      setTestMessage(''); // Clear the input field
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const clearConversation = () => {
    setConversationHistory([]);
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;

    try {
      await axios.delete(`${API}/admin/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete agent');
    }
  };

  const getAvatarSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${BACKEND_URL}${url}`;
    }
    return url;
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage AI agent personas
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create AI Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI agent persona with custom instructions
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name *</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g., Customer Support Specialist"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider *</Label>
                  <select
                    id="provider"
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                    value={newAgent.provider_id}
                    onChange={(e) => setNewAgent({ ...newAgent, provider_id: e.target.value, model: '' })}
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <select
                    id="model"
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                    value={newAgent.model}
                    onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
                    disabled={!newAgent.provider_id}
                  >
                    <option value="">Select model</option>
                    {newAgent.provider_id && providers
                      .find(p => p.id === newAgent.provider_id)
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
                  rows={6}
                  value={newAgent.system_prompt}
                  onChange={(e) => setNewAgent({ ...newAgent, system_prompt: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature: {newAgent.temperature}</Label>
                  <input
                    type="range"
                    id="temperature"
                    min="0"
                    max="2"
                    step="0.1"
                    value={newAgent.temperature}
                    onChange={(e) => setNewAgent({ ...newAgent, temperature: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    type="number"
                    id="max-tokens"
                    value={newAgent.max_tokens}
                    onChange={(e) => setNewAgent({ ...newAgent, max_tokens: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAgent}>
                Create Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agents Grid */}
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.filter(a => a.is_active).map((agent) => (
          <Card key={agent.id} className="border border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
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
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {agent.provider_name} • {agent.model}
                    </CardDescription>
                  </div>
                </div>
                {agent.is_marketplace && (
                  <Badge variant="secondary">Marketplace</Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Version */}
              <div className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Version {agent.version}</span>
              </div>

              {/* System Prompt Preview */}
              <div className="bg-muted/50 p-3 rounded-sm">
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {agent.system_prompt}
                </p>
              </div>

              {/* Config */}
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">Temp: {agent.temperature}</Badge>
                <Badge variant="outline">Tokens: {agent.max_tokens}</Badge>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="file"
                    ref={avatarInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleAvatarUpload(agent.id, e.target.files[0])}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar === agent.id}
                  >
                    {uploadingAvatar === agent.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(agent)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAgent(agent);
                      setShowTestDialog(true);
                      setTestMessage('');
                      setConversationHistory([]);
                    }}
                  >
                    <TestTube className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVersionHistoryAgent(agent);
                      setShowVersionHistory(true);
                    }}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => handleDeleteAgent(agent.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {agents.filter(a => a.is_active).length === 0 && (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-heading font-semibold mb-2">No agents created</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first AI agent to get started
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Agent Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AI Agent</DialogTitle>
            <DialogDescription>
              Update agent configuration (creates new version)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-agent-name">Agent Name *</Label>
              <Input
                id="edit-agent-name"
                placeholder="e.g., Customer Support Specialist"
                value={editAgent.name}
                onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-provider">Provider *</Label>
                <select
                  id="edit-provider"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={editAgent.provider_id}
                  onChange={(e) => setEditAgent({ ...editAgent, provider_id: e.target.value, model: '' })}
                  disabled
                >
                  <option value="">Select provider</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Provider cannot be changed</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-model">Model *</Label>
                <select
                  id="edit-model"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={editAgent.model}
                  onChange={(e) => setEditAgent({ ...editAgent, model: e.target.value })}
                >
                  <option value="">Select model</option>
                  {editAgent.provider_id && providers
                    .find(p => p.id === editAgent.provider_id)
                    ?.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-system-prompt">System Prompt *</Label>
              <Textarea
                id="edit-system-prompt"
                placeholder="You are a helpful customer support assistant..."
                rows={6}
                value={editAgent.system_prompt}
                onChange={(e) => setEditAgent({ ...editAgent, system_prompt: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-temperature">Temperature: {editAgent.temperature}</Label>
                <input
                  type="range"
                  id="edit-temperature"
                  min="0"
                  max="2"
                  step="0.1"
                  value={editAgent.temperature}
                  onChange={(e) => setEditAgent({ ...editAgent, temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-max-tokens">Max Tokens</Label>
                <Input
                  type="number"
                  id="edit-max-tokens"
                  value={editAgent.max_tokens}
                  onChange={(e) => setEditAgent({ ...editAgent, max_tokens: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAgent}>
              Update Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Test Agent: {selectedAgent?.name}</DialogTitle>
                <DialogDescription>
                  Full conversation test with context awareness
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearConversation}
                disabled={conversationHistory.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
            
            {/* Agent Configuration Info */}
            {selectedAgent && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="font-mono text-xs">{selectedAgent.model}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Temperature</p>
                    <p className="font-mono text-xs">{selectedAgent.temperature}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Tokens</p>
                    <p className="font-mono text-xs">{selectedAgent.max_tokens}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <Badge variant="secondary" className="text-xs">v{selectedAgent.version}</Badge>
                </div>
              </div>
            )}
          </DialogHeader>
          
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            {/* Conversation History */}
            <ScrollArea className="flex-1 pr-4">
              {conversationHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bot className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Start a conversation to test the agent
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversationHistory.map((msg, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
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
                      <div className={`flex-1 p-3 rounded-sm ${
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
                      <div className="flex-1 bg-primary/10 p-3 rounded-sm">
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
        </DialogContent>
      </Dialog>
      {/* Version History Dialog */}
      <AgentVersionHistory
        agentId={versionHistoryAgent?.id}
        agentName={versionHistoryAgent?.name}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        onRollback={() => {
          fetchData();
          setShowVersionHistory(false);
        }}
      />
    </div>
  );
};

export default Agents;
