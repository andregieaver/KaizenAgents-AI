import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Loader2, RefreshCw, Globe, Search, Shield, Key, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const toolCategoryIcons = {
  browser: Globe,
  form: FileText,
  auth: Key,
  audit: Search,
  scheduler: Clock
};

const toolCategoryDescriptions = {
  browser: 'Navigate websites, take screenshots, extract content, and interact with page elements',
  form: 'Fill out and submit forms on websites with provided data',
  auth: 'Log into websites using securely stored credentials',
  audit: 'Perform SEO, accessibility, performance, and security audits on websites',
  scheduler: 'Create and manage scheduled automated tasks'
};

const toolCategoryNames = {
  browser: 'Browser',
  form: 'Forms',
  auth: 'Authentication',
  audit: 'Audits',
  scheduler: 'Scheduling'
};

const AgentToolsTab = ({ agent, setAgent, token, isNew }) => {
  const [availableTools, setAvailableTools] = useState({});
  const [enabledTools, setEnabledTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Fetch available tools catalog
  const fetchAvailableTools = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/agent-tools/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableTools(response.data.tools_by_category || {});
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    }
  }, [token]);

  // Fetch agent's current tool configuration
  const fetchAgentToolConfig = useCallback(async () => {
    if (isNew || !agent.id) return;
    
    try {
      const response = await axios.get(`${API}/agent-tools/agents/${agent.id}/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnabledTools(response.data.enabled_tools || []);
    } catch (error) {
      console.error('Failed to fetch agent tool config:', error);
    }
  }, [agent.id, token, isNew]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchAvailableTools();
      await fetchAgentToolConfig();
      setLoading(false);
    };
    init();
  }, [fetchAvailableTools, fetchAgentToolConfig]);

  // Save tool configuration to backend
  const saveToolConfig = async (newEnabledTools) => {
    if (isNew || !agent.id) {
      toast.error('Please save the agent first before configuring tools');
      return false;
    }

    setSaving(true);
    try {
      await axios.put(
        `${API}/agent-tools/agents/${agent.id}/config`,
        { enabled_tools: newEnabledTools },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEnabledTools(newEnabledTools);
      toast.success('Tools configuration saved');
      return true;
    } catch (error) {
      console.error('Failed to save tool config:', error);
      toast.error('Failed to save tools configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const getEnabledTools = () => {
    return enabledTools;
  };

  const toggleCategory = async (category) => {
    if (isNew) {
      toast.error('Please save the agent first before configuring tools');
      return;
    }

    const categoryTools = availableTools[category]?.map(t => t.name) || [];
    const currentEnabled = getEnabledTools();
    const allEnabled = categoryTools.every(t => currentEnabled.includes(t));
    
    let newEnabled;
    if (allEnabled) {
      // Disable all tools in category
      newEnabled = currentEnabled.filter(t => !categoryTools.includes(t));
    } else {
      // Enable all tools in category
      const toAdd = categoryTools.filter(t => !currentEnabled.includes(t));
      newEnabled = [...currentEnabled, ...toAdd];
    }
    
    // Save immediately to backend
    await saveToolConfig(newEnabled);
  };

  const isCategoryEnabled = (category) => {
    const categoryTools = availableTools[category]?.map(t => t.name) || [];
    const currentEnabled = getEnabledTools();
    return categoryTools.length > 0 && categoryTools.every(t => currentEnabled.includes(t));
  };

  const enabledCategoriesCount = Object.keys(availableTools).filter(cat => isCategoryEnabled(cat)).length;
  const totalCategories = Object.keys(availableTools).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agent Capabilities</CardTitle>
              <CardDescription>
                Enable the capabilities this agent needs. Each capability includes all related functions.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAvailableTools}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={enabledCategoriesCount > 0 ? "default" : "secondary"} className="text-sm">
              {enabledCategoriesCount} / {totalCategories} capabilities enabled
            </Badge>
            {enabledCategoriesCount === 0 && (
              <span className="text-sm text-muted-foreground">
                No capabilities enabled - agent cannot perform automated actions
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tool Categories - Simplified */}
      <div className="grid gap-3">
        {Object.entries(availableTools).map(([category, tools]) => {
          const CategoryIcon = toolCategoryIcons[category] || Globe;
          const isEnabled = isCategoryEnabled(category);
          const isExpanded = expandedCategory === category;
          
          return (
            <Card 
              key={category} 
              className={`transition-all ${isEnabled ? 'border-primary/30 bg-primary/5' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2.5 rounded-lg ${isEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {toolCategoryNames[category] || category}
                        </span>
                        {isEnabled && (
                          <Badge variant="default" className="text-xs">
                            Enabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {toolCategoryDescriptions[category]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="text-muted-foreground hover:text-foreground p-1"
                      title="View included functions"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`category-${category}`} className="text-sm font-medium">
                        {saving ? 'Saving...' : 'Enable'}
                      </Label>
                      <Switch
                        id={`category-${category}`}
                        checked={isEnabled}
                        onCheckedChange={() => toggleCategory(category)}
                        disabled={saving || isNew}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Expandable details showing included functions */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Includes {tools.length} functions:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tools.map(tool => (
                        <span
                          key={tool.name}
                          className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
                          title={tool.description}
                        >
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/50 bg-blue-500/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-400">About Capabilities</p>
              <p className="text-sm text-blue-700 dark:text-blue-500">
                The agent's AI will decide when to use enabled capabilities during conversations. 
                Only enable what's appropriate for this agent's purpose. 
                Authentication credentials are managed in the Credentials Manager.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentToolsTab;
