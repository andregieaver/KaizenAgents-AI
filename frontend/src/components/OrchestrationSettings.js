import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Loader2,
  Bot,
  Cpu,
  Network,
  CheckCircle2,
  XCircle,
  Tag,
  Plus,
  X,
  Activity,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrchestrationSettings = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Orchestration configuration
  const [orchestrationConfig, setOrchestrationConfig] = useState({
    enabled: false,
    mother_agent_id: null,
    mother_agent_name: null,
    mother_agent_type: null, // 'admin' or 'company'
    allowed_children_count: 0,
    available_children_count: 0,
    recent_runs_count: 0,
    policy: {}
  });
  
  // Admin agents (potential mothers - legacy)
  const [adminAgents, setAdminAgents] = useState([]);
  
  // User agents (company agents - can be mother or children)
  const [userAgents, setUserAgents] = useState([]);
  const [availableChildren, setAvailableChildren] = useState([]);
  
  // Orchestration runs
  const [orchestrationRuns, setOrchestrationRuns] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  
  // Selected children for orchestration
  const [selectedChildren, setSelectedChildren] = useState([]);
  
  // Tag input for child agents
  const [editingAgentTags, setEditingAgentTags] = useState(null);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, adminRes, userRes, childrenRes] = await Promise.all([
        axios.get(`${API}/settings/orchestration`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/agents`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/agents/`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/agents/orchestration/available-children`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setOrchestrationConfig(configRes.data);
      setAdminAgents(adminRes.data || []);
      setUserAgents(userRes.data || []);
      setAvailableChildren(childrenRes.data || []);
      
      // Set selected children based on config
      if (configRes.data.allowed_child_agent_ids) {
        setSelectedChildren(configRes.data.allowed_child_agent_ids);
      }
    } catch (error) {
      console.error('Error fetching orchestration data:', error);
      toast.error('Failed to load orchestration settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrchestrationRuns = async () => {
    setLoadingRuns(true);
    try {
      const response = await axios.get(`${API}/settings/orchestration/runs?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrchestrationRuns(response.data || []);
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoadingRuns(false);
    }
  };

  const updateOrchestrationConfig = async (updates) => {
    setSaving(true);
    try {
      // Build the full config object
      const configToSave = {
        enabled: updates.enabled ?? orchestrationConfig.enabled,
        mother_admin_agent_id: updates.mother_admin_agent_id ?? orchestrationConfig.mother_agent_id,
        allowed_child_agent_ids: updates.allowed_child_agent_ids ?? selectedChildren,
        policy: updates.policy ?? orchestrationConfig.policy
      };
      
      await axios.put(`${API}/settings/orchestration`, configToSave, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Orchestration settings saved');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleOrchestration = async () => {
    await updateOrchestrationConfig({ enabled: !orchestrationConfig.enabled });
  };

  const selectMotherAgent = async (agentId) => {
    await updateOrchestrationConfig({ mother_admin_agent_id: agentId });
  };

  const toggleChildAgent = async (agentId) => {
    const newSelected = selectedChildren.includes(agentId)
      ? selectedChildren.filter(id => id !== agentId)
      : [...selectedChildren, agentId];
    
    setSelectedChildren(newSelected);
    await updateOrchestrationConfig({ allowed_child_agent_ids: newSelected });
  };

  const updateAgentOrchestrationSettings = async (agentId, settings) => {
    try {
      await axios.patch(`${API}/agents/${agentId}/orchestration`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent settings updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update agent settings');
    }
  };

  const toggleAgentOrchestrationEnabled = async (agentId, enabled) => {
    await updateAgentOrchestrationSettings(agentId, { orchestration_enabled: enabled });
  };

  const addTagToAgent = async (agentId, tag) => {
    if (!tag.trim()) return;
    const agent = userAgents.find(a => a.id === agentId);
    const currentTags = agent?.tags || [];
    if (currentTags.includes(tag.toLowerCase().trim())) {
      toast.error('Tag already exists');
      return;
    }
    await updateAgentOrchestrationSettings(agentId, { 
      tags: [...currentTags, tag.toLowerCase().trim()] 
    });
    setNewTag('');
  };

  const removeTagFromAgent = async (agentId, tagToRemove) => {
    const agent = userAgents.find(a => a.id === agentId);
    const currentTags = agent?.tags || [];
    await updateAgentOrchestrationSettings(agentId, { 
      tags: currentTags.filter(t => t !== tagToRemove) 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <Card className="border border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading flex items-center gap-2">
                <Network className="h-5 w-5" />
                Orchestration Settings
              </CardTitle>
              <CardDescription>
                Configure the Mother/Child agent architecture for intelligent task delegation
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="orchestration-toggle" className="text-sm">
                {orchestrationConfig.enabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                id="orchestration-toggle"
                checked={orchestrationConfig.enabled}
                onCheckedChange={toggleOrchestration}
                disabled={saving}
              />
            </div>
          </div>
        </CardHeader>
        
        {orchestrationConfig.enabled && (
          <CardContent className="space-y-4">
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Cpu className="h-4 w-4" />
                  <span className="text-sm">Mother Agent</span>
                </div>
                <p className="font-semibold">
                  {orchestrationConfig.mother_agent_name || 'Not configured'}
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Bot className="h-4 w-4" />
                  <span className="text-sm">Available Children</span>
                </div>
                <p className="font-semibold">{orchestrationConfig.available_children_count}</p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm">Recent Runs (7d)</span>
                </div>
                <p className="font-semibold">{orchestrationConfig.recent_runs_count}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {orchestrationConfig.enabled && (
        <>
          {/* Mother Agent Selection */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                Mother Agent (Orchestrator)
              </CardTitle>
              <CardDescription>
                Select the AI agent that will analyze requests and delegate to child agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adminAgents.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground p-4 border rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span>No admin agents available. Create agents in the Super Admin panel.</span>
                </div>
              ) : (
                <Select
                  value={orchestrationConfig.mother_agent_id || ''}
                  onValueChange={selectMotherAgent}
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue placeholder="Select Mother Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminAgents.filter(a => a.is_active).map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <span>{agent.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {agent.model}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {orchestrationConfig.mother_agent_id && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p>The Mother agent will use the API key configured in its Admin Provider settings.</p>
                      <p className="mt-1">Ensure the provider has sufficient credits for orchestration calls.</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Child Agents Configuration */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Child Agents (Executors)
              </CardTitle>
              <CardDescription>
                Configure which agents can be delegated to and their skill tags
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userAgents.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground p-4 border rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span>No saved agents. Go to the Marketplace to save agents first.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {userAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className={cn(
                        "p-4 border rounded-lg transition-colors",
                        agent.orchestration_enabled ? "border-primary/50 bg-primary/5" : ""
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4" />
                            <span className="font-medium">{agent.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {agent.category}
                            </Badge>
                            {agent.is_active && (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {agent.description?.slice(0, 100)}...
                          </p>
                          
                          {/* Tags Section */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              Skill Tags (used by Mother for delegation)
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {(agent.tags || []).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="gap-1 cursor-pointer hover:bg-destructive/20"
                                  onClick={() => removeTagFromAgent(agent.id, tag)}
                                >
                                  {tag}
                                  <X className="h-3 w-3" />
                                </Badge>
                              ))}
                              {editingAgentTags === agent.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    placeholder="Add tag..."
                                    className="h-6 w-24 text-xs"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        addTagToAgent(agent.id, newTag);
                                      } else if (e.key === 'Escape') {
                                        setEditingAgentTags(null);
                                        setNewTag('');
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => {
                                      setEditingAgentTags(null);
                                      setNewTag('');
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="gap-1 cursor-pointer hover:bg-primary/10"
                                  onClick={() => setEditingAgentTags(agent.id)}
                                >
                                  <Plus className="h-3 w-3" />
                                  Add
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Enable/Disable Toggle */}
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`agent-${agent.id}-toggle`} className="text-xs text-muted-foreground">
                              Available for orchestration
                            </Label>
                            <Switch
                              id={`agent-${agent.id}-toggle`}
                              checked={agent.orchestration_enabled || false}
                              onCheckedChange={(checked) => toggleAgentOrchestrationEnabled(agent.id, checked)}
                            />
                          </div>
                          
                          {agent.orchestration_enabled && (
                            <div className="flex items-center gap-2 mt-2">
                              <Label htmlFor={`agent-${agent.id}-allowed`} className="text-xs text-muted-foreground">
                                Allow delegation
                              </Label>
                              <Switch
                                id={`agent-${agent.id}-allowed`}
                                checked={selectedChildren.includes(agent.id)}
                                onCheckedChange={() => toggleChildAgent(agent.id)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orchestration Runs / Audit Log */}
          <Card className="border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Recent Orchestration Runs
                  </CardTitle>
                  <CardDescription>
                    Audit log of orchestration decisions and delegations
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchOrchestrationRuns}
                  disabled={loadingRuns}
                >
                  {loadingRuns ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orchestrationRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orchestration runs yet</p>
                  <p className="text-sm">Runs will appear here when users interact with orchestration-enabled chat</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {orchestrationRuns.map((run) => (
                      <div
                        key={run.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={getStatusColor(run.status)}>
                                {run.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {run.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                                {run.status}
                              </Badge>
                              {run.requested_actions?.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Delegated
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm truncate">
                              {run.user_prompt}
                            </p>
                            {run.final_response && (
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                Response: {run.final_response.slice(0, 100)}...
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {new Date(run.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default OrchestrationSettings;
