import { useState, useEffect, useCallback } from 'react';
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

  const fetchData = useCallback(async () => {
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
      toast.error('Failed to load orchestration settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchOrchestrationRuns = async () => {
    setLoadingRuns(true);
    try {
      const response = await axios.get(`${API}/settings/orchestration/runs?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrchestrationRuns(response.data || []);
    } catch (error) {
      // Orchestration runs fetch failed silently
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
        mother_admin_agent_id: updates.mother_admin_agent_id,
        mother_user_agent_id: updates.mother_user_agent_id,
        allowed_child_agent_ids: updates.allowed_child_agent_ids ?? selectedChildren,
        policy: updates.policy ?? orchestrationConfig.policy
      };
      
      // If neither is explicitly set, keep current
      if (updates.mother_admin_agent_id === undefined && updates.mother_user_agent_id === undefined) {
        if (orchestrationConfig.mother_agent_type === 'admin') {
          configToSave.mother_admin_agent_id = orchestrationConfig.mother_agent_id;
        } else if (orchestrationConfig.mother_agent_type === 'company') {
          configToSave.mother_user_agent_id = orchestrationConfig.mother_agent_id;
        }
      }
      
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

  const selectMotherAgent = async (agentId, agentType) => {
    if (agentType === 'admin') {
      await updateOrchestrationConfig({ 
        mother_admin_agent_id: agentId,
        mother_user_agent_id: null 
      });
    } else {
      await updateOrchestrationConfig({ 
        mother_admin_agent_id: null,
        mother_user_agent_id: agentId 
      });
    }
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
    // Check if trying to enable orchestration on the Mother Agent
    const agent = userAgents.find(a => a.id === agentId);
    if (enabled && agent?.is_mother_agent) {
      toast.error('Cannot enable orchestration for the Mother Agent. The Mother Agent orchestrates other agents.');
      return;
    }
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
                Mother Agent (Coordinator)
              </CardTitle>
              <CardDescription>
                Select the AI agent that will analyze requests and delegate to specialized child agents.
                You can use your own company agent as the coordinator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Selection */}
              {orchestrationConfig.mother_agent_id && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="font-medium">Selected: {orchestrationConfig.mother_agent_name}</span>
                    <Badge variant="outline" className="ml-2">
                      {orchestrationConfig.mother_agent_type === 'admin' ? 'Admin Agent' : 'Company Agent'}
                    </Badge>
                  </div>
                </div>
              )}
              
              {/* Company Agents Section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  Your Company Agents (Recommended)
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Use one of your own agents as the coordinator. This agent will use your knowledge base and configurations.
                </p>
                {userAgents.filter(a => a.is_active).length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground p-3 border rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>No active company agents. Create agents in the Agents page first.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {userAgents.filter(a => a.is_active).map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => selectMotherAgent(agent.id, 'company')}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all",
                          orchestrationConfig.mother_agent_id === agent.id && orchestrationConfig.mother_agent_type === 'company'
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{agent.icon || '🤖'}</span>
                            <span className="font-medium text-sm">{agent.name}</span>
                          </div>
                          {orchestrationConfig.mother_agent_id === agent.id && orchestrationConfig.mother_agent_type === 'company' && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {agent.description || 'No description'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Admin Agents Section (Legacy/Advanced) */}
              {adminAgents.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-amber-500" />
                    System Agents (Advanced)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Admin-level agents created by super admins. Use these for system-wide orchestration.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {adminAgents.filter(a => a.is_active).map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => selectMotherAgent(agent.id, 'admin')}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all",
                          orchestrationConfig.mother_agent_id === agent.id && orchestrationConfig.mother_agent_type === 'admin'
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-border hover:border-amber-500/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-amber-500" />
                            <span className="font-medium text-sm">{agent.name}</span>
                          </div>
                          {orchestrationConfig.mother_agent_id === agent.id && orchestrationConfig.mother_agent_type === 'admin' && (
                            <CheckCircle2 className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {agent.model}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Child Agents Configuration */}
          <Card className="border border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Child Agents (Executors)
                  </CardTitle>
                  <CardDescription>
                    Configure which agents can be delegated to and their skill tags
                  </CardDescription>
                </div>
                {userAgents.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        for (const agent of userAgents) {
                          // Skip the Mother Agent - cannot be orchestrated
                          if (agent.is_mother_agent) continue;
                          if (!agent.orchestration_enabled) {
                            await toggleAgentOrchestrationEnabled(agent.id, true);
                          }
                        }
                      }}
                      disabled={saving}
                    >
                      Enable All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Exclude Mother Agent from child selection
                        const allIds = userAgents
                          .filter(a => a.orchestration_enabled && !a.is_mother_agent)
                          .map(a => a.id);
                        setSelectedChildren(allIds);
                        await updateOrchestrationConfig({ allowed_child_agent_ids: allIds });
                      }}
                      disabled={saving}
                    >
                      Allow All
                    </Button>
                  </div>
                )}
              </div>
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
                          {/* Debug: Log is_mother_agent value */}
                          {console.log(`Agent ${agent.name}: is_mother_agent = ${agent.is_mother_agent}`)}
                          {agent.is_mother_agent ? (
                            <div className="flex items-center gap-2 text-amber-500">
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                Mother Agent
                              </Badge>
                              <Info className="h-4 w-4" title="Mother Agent cannot be orchestrated" />
                            </div>
                          ) : (
                            <>
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
                            </>
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
