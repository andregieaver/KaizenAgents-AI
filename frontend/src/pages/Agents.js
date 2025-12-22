import { useState, useEffect, useRef } from 'react';
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
  Globe
} from 'lucide-react';
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

  useEffect(() => {
    fetchAgents();
  }, [token]);

  const fetchAgents = async () => {
    try {
      const response = await axios.get(`${API}/agents/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

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
        
        <Button onClick={() => navigate('/dashboard/agents/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>

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
            <Link key={agent.id} to={`/dashboard/agents/${agent.id}`}>
              <Card className={`border transition-colors cursor-pointer h-full ${
                agent.is_active 
                  ? 'border-primary/50 bg-primary/5' 
                  : 'border-border hover:border-primary/30'
              }`}>
                <CardHeader>
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
                        <CardTitle className="text-lg flex items-center gap-2">
                          {agent.name}
                          {agent.is_active && (
                            <Badge className="bg-green-500 text-white">Active</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {agent.category} • {agent.config?.model || 'Default model'}
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
                      {agent.config?.system_prompt || 'No system prompt defined'}
                    </p>
                  </div>

                  {/* Config */}
                  <div className="flex gap-2 text-xs flex-wrap">
                    <Badge variant="outline">Temp: {agent.config?.temperature || 0.7}</Badge>
                    <Badge variant="outline">Tokens: {agent.config?.max_tokens || 2000}</Badge>
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
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="file"
                      ref={el => avatarInputRefs.current[agent.id] = el}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleAvatarUpload(agent.id, e.target.files[0])}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        avatarInputRefs.current[agent.id]?.click();
                      }}
                      disabled={uploadingAvatar === agent.id}
                      title="Upload Avatar"
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
                      title="Edit Agent"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      title="Copy Embed Code"
                      onClick={(e) => copyEmbedCode(agent.id, e)}
                    >
                      {copiedAgentId === agent.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Code className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteAgent(agent.id, e)}
                      title="Delete Agent"
                      disabled={agent.is_active}
                    >
                      <Trash2 className="h-4 w-4" />
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
          ))}
        </div>
      )}
    </div>
  );
};

export default Agents;
