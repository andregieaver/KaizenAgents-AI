import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import {
  Bot,
  Plus,
  Upload,
  Loader2,
  Trash2,
  Edit,
  Code,
  Copy,
  Check,
  Power,
  Globe,
  CheckSquare,
  Square,
  MessageSquare,
  Network,
  MoreHorizontal,
  X,
  Crown
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { AgentCardSkeleton } from '../components/LoadingStates';
import { NoAgentsState } from '../components/EmptyStates';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Agents = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(null);
  const [togglingAgent, setTogglingAgent] = useState(null);
  const [copiedAgentId, setCopiedAgentId] = useState(null);
  const avatarInputRefs = useRef({});
  
  // Bulk selection state
  const [selectedAgents, setSelectedAgents] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/agents/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgents(response.data);
    } catch (error) {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAvatarUpload = async (agentId, file) => {
    if (!file) return;

    setUploadingAvatar(agentId);
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
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(null);
    }
  };

  const handleToggleActive = async (agentId, isCurrentlyActive, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setTogglingAgent(agentId);
    try {
      if (isCurrentlyActive) {
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
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update agent');
    } finally {
      setTogglingAgent(null);
    }
  };

  const handleDeleteAgent = async (agentId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this agent?')) return;

    try {
      await axios.delete(`${API}/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent deleted');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete agent');
    }
  };

  const setMotherAgent = async (agentId, agentName, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await axios.post(`${API}/agents/${agentId}/set-mother`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${agentName} is now the Mother Agent`);
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set Mother Agent');
    }
  };

  const unsetMotherAgent = async (agentId, agentName, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await axios.post(`${API}/agents/${agentId}/unset-mother`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${agentName} is no longer the Mother Agent`);
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove Mother Agent');
    }
  };

  const getAvatarSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${BACKEND_URL}${url}`;
    }
    return url;
  };

  const getEmbedCode = (agentId) => {
    const baseUrl = BACKEND_URL?.replace('/api', '') || window.location.origin;
    return `<script src="${baseUrl}/widget.js" data-tenant-id="${user?.tenant_id}" data-agent-id="${agentId}" async></script>`;
  };

  const copyEmbedCode = (agentId, e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(getEmbedCode(agentId));
    setCopiedAgentId(agentId);
    toast.success('Embed code copied!');
    setTimeout(() => setCopiedAgentId(null), 2000);
  };

  // Bulk selection handlers
  const toggleAgentSelection = (agentId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const selectAllAgents = () => {
    setSelectedAgents(new Set(agents.map(a => a.id)));
  };

  const clearSelection = () => {
    setSelectedAgents(new Set());
  };

  const bulkUpdateAgents = async (updateData, successMessage) => {
    if (selectedAgents.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      await axios.post(`${API}/agents/bulk-update`, {
        agent_ids: Array.from(selectedAgents),
        ...updateData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(successMessage);
      fetchAgents();
      clearSelection();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update agents');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const bulkEnableForChannels = () => {
    bulkUpdateAgents({ channels_enabled: true }, `${selectedAgents.size} agent(s) enabled for channels`);
  };

  const bulkDisableForChannels = () => {
    bulkUpdateAgents({ channels_enabled: false }, `${selectedAgents.size} agent(s) disabled for channels`);
  };

  const bulkActivate = () => {
    bulkUpdateAgents({ is_active: true }, `${selectedAgents.size} agent(s) activated`);
  };

  const bulkDeactivate = () => {
    bulkUpdateAgents({ is_active: false }, `${selectedAgents.size} agent(s) deactivated`);
  };

  const bulkEnableOrchestration = () => {
    // Filter out Mother Agent from selection
    const motherAgent = agents.find(a => a.is_mother_agent && selectedAgents.has(a.id));
    if (motherAgent) {
      toast.info(`${motherAgent.name} is the Mother Agent and was excluded from orchestration`);
    }
    bulkUpdateAgents({ orchestration_enabled: true }, `Agent(s) enabled for orchestration (Mother Agent excluded)`);
  };

  const bulkDisableOrchestration = () => {
    bulkUpdateAgents({ orchestration_enabled: false }, `${selectedAgents.size} agent(s) disabled for orchestration`);
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage your AI agent personas. Each agent has its own embed code.
          </p>
        </div>
        
        {/* Desktop button with text */}
        <Button onClick={() => navigate('/dashboard/agents/new')} className="hidden sm:flex">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
        
        {/* Mobile circular icon button */}
        <Button 
          onClick={() => navigate('/dashboard/agents/new')} 
          size="icon"
          className="sm:hidden !h-12 !w-12 !rounded-full shadow-lg flex-shrink-0"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {agents.length > 0 && (
        <div className="flex items-center gap-2 sm:gap-4 mb-4 p-3 bg-muted/50 rounded-lg flex-wrap">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedAgents.size === agents.length && agents.length > 0}
              onCheckedChange={(checked) => checked ? selectAllAgents() : clearSelection()}
              aria-label="Select all agents"
            />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {selectedAgents.size === 0 
                ? 'Select all' 
                : `${selectedAgents.size} of ${agents.length} selected`}
            </span>
            <span className="text-sm text-muted-foreground sm:hidden">
              {selectedAgents.size > 0 ? selectedAgents.size : 'All'}
            </span>
          </div>
          
          {selectedAgents.size > 0 && (
            <>
              <Separator orientation="vertical" className="h-6 hidden sm:block" />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={bulkActionLoading}>
                    {bulkActionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4 mr-2" />
                    )}
                    <span className="hidden sm:inline">Bulk Actions</span>
                    <span className="sm:hidden">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={bulkActivate}>
                    <Power className="h-4 w-4 mr-2 text-green-500" />
                    Activate Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={bulkDeactivate}>
                    <Power className="h-4 w-4 mr-2 text-muted-foreground" />
                    Deactivate Selected
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={bulkEnableForChannels}>
                    <MessageSquare className="h-4 w-4 mr-2 text-blue-500" />
                    Enable for Channels
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={bulkDisableForChannels}>
                    <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                    Disable for Channels
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={bulkEnableOrchestration}>
                    <Network className="h-4 w-4 mr-2 text-purple-500" />
                    Enable for Orchestration
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={bulkDisableOrchestration}>
                    <Network className="h-4 w-4 mr-2 text-muted-foreground" />
                    Disable for Orchestration
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Clear</span>
              </Button>
            </>
          )}
        </div>
      )}

      {/* Agents Grid */}
      {loading ? (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <NoAgentsState onCreate={() => navigate('/dashboard/agents/new')} />
      ) : (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div key={agent.id} className="relative">
              {/* Selection checkbox */}
              <div 
                className="absolute top-3 left-3 z-10"
                onClick={(e) => toggleAgentSelection(agent.id, e)}
              >
                <Checkbox
                  checked={selectedAgents.has(agent.id)}
                  className="h-5 w-5 bg-background border-2"
                />
              </div>
              
              <Link to={`/dashboard/agents/${agent.id}`}>
                <Card className={`border-0 shadow-sm transition-colors cursor-pointer h-full ${
                  selectedAgents.has(agent.id)
                    ? 'ring-2 ring-primary'
                    : agent.is_active 
                      ? 'bg-primary/5 ring-1 ring-primary/30' 
                      : 'hover:shadow-md'
                }`}>
                  <CardHeader className="pl-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden text-2xl">
                          {getAvatarSrc(agent.profile_image_url) ? (
                            <img 
                              src={getAvatarSrc(agent.profile_image_url)} 
                              alt={agent.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            agent.icon || <Bot className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                            {agent.name}
                            {agent.is_mother_agent && (
                              <Badge className="bg-amber-500 text-white">
                                <Crown className="h-3 w-3 mr-1" />
                                Mother
                              </Badge>
                            )}
                            {agent.is_active && (
                              <Badge className="bg-green-500 text-white">Active</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs flex items-center gap-1 flex-wrap">
                            {agent.category} • {agent.config?.model || agent.config?.ai_model || 'Default model'}
                            {agent.channels_enabled && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                                Channels
                              </Badge>
                            )}
                            {agent.orchestration_enabled && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                <Network className="h-2.5 w-2.5 mr-0.5" />
                                Orch
                              </Badge>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      {agent.is_public && (
                        <Badge variant="secondary">
                          <Globe className="h-3 w-3 mr-1" />
                          Published
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description}
                  </p>

                  {/* System Prompt Preview */}
                  <div className="bg-muted/50 p-3 rounded-sm">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {agent.config?.system_prompt || agent.config?.ai_persona || 'No system prompt defined'}
                    </p>
                  </div>

                  {/* Config */}
                  <div className="flex gap-2 text-xs flex-wrap">
                    <Badge variant="outline">Temp: {agent.config?.temperature ?? 0.7}</Badge>
                    <Badge variant="outline">Tokens: {agent.config?.max_tokens ?? 2000}</Badge>
                    {agent.orchestration_enabled && (
                      <Badge variant="secondary">Orchestration</Badge>
                    )}
                  </div>

                  <Separator />

                  {/* Active Toggle */}
                  <div 
                    className="flex items-center justify-between p-2 rounded-sm bg-muted/30"
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center gap-2">
                      <Power className={`h-4 w-4 ${agent.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <Switch
                      checked={agent.is_active}
                      onCheckedChange={() => {}}
                      onClick={(e) => handleToggleActive(agent.id, agent.is_active, e)}
                      disabled={togglingAgent === agent.id}
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center justify-center gap-6 py-2">
                    <input
                      type="file"
                      ref={el => avatarInputRefs.current[agent.id] = el}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleAvatarUpload(agent.id, e.target.files[0])}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        avatarInputRefs.current[agent.id]?.click();
                      }}
                      disabled={uploadingAvatar === agent.id}
                      title="Upload Avatar"
                      className="h-10 w-10"
                    >
                      {uploadingAvatar === agent.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit Agent"
                      className="h-10 w-10"
                    >
                      <Edit className="h-5 w-5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Copy Embed Code"
                      onClick={(e) => copyEmbedCode(agent.id, e)}
                      className="h-10 w-10"
                    >
                      {copiedAgentId === agent.id ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <Code className="h-5 w-5" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-10 w-10 ${agent.is_mother_agent ? 'text-amber-500' : ''}`}
                      onClick={(e) => agent.is_mother_agent 
                        ? unsetMotherAgent(agent.id, agent.name, e) 
                        : setMotherAgent(agent.id, agent.name, e)
                      }
                      title={agent.is_mother_agent ? "Remove as Mother Agent" : "Set as Mother Agent"}
                    >
                      <Crown className="h-5 w-5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteAgent(agent.id, e)}
                      title="Delete Agent"
                      disabled={agent.is_active}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Embed Code Preview */}
                  <div className="bg-muted/50 p-2 rounded-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Embed Code</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={(e) => copyEmbedCode(agent.id, e)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        <span className="text-xs">Copy</span>
                      </Button>
                    </div>
                    <code className="text-[10px] text-muted-foreground block truncate">
                      {getEmbedCode(agent.id).slice(0, 60)}...
                    </code>
                  </div>
                </CardContent>
              </Card>
            </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Agents;
