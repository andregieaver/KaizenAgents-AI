import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Loader2, RefreshCw, Globe, Search, Shield, Zap, Key, Clock, FileText, Accessibility, Link as LinkIcon } from 'lucide-react';
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
  browser: 'Navigate websites, take screenshots, click elements',
  form: 'Fill and submit forms on websites',
  auth: 'Log into websites using stored credentials',
  audit: 'Perform SEO, accessibility, security audits',
  scheduler: 'Schedule recurring tool executions'
};

const AgentToolsTab = ({ agent, setAgent, token, isNew }) => {
  const [availableTools, setAvailableTools] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableTools();
  }, []);

  const fetchAvailableTools = async () => {
    try {
      const response = await axios.get(`${API}/agent-tools/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableTools(response.data.tools_by_category || {});
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEnabledTools = () => {
    return agent.config?.enabled_tools || [];
  };

  const toggleTool = (toolName) => {
    const currentEnabled = getEnabledTools();
    let newEnabled;
    
    if (currentEnabled.includes(toolName)) {
      newEnabled = currentEnabled.filter(t => t !== toolName);
    } else {
      newEnabled = [...currentEnabled, toolName];
    }
    
    setAgent(prev => ({
      ...prev,
      config: {
        ...prev.config,
        enabled_tools: newEnabled
      }
    }));
  };

  const toggleCategory = (category) => {
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
    
    setAgent(prev => ({
      ...prev,
      config: {
        ...prev.config,
        enabled_tools: newEnabled
      }
    }));
  };

  const isCategoryFullyEnabled = (category) => {
    const categoryTools = availableTools[category]?.map(t => t.name) || [];
    const currentEnabled = getEnabledTools();
    return categoryTools.length > 0 && categoryTools.every(t => currentEnabled.includes(t));
  };

  const isCategoryPartiallyEnabled = (category) => {
    const categoryTools = availableTools[category]?.map(t => t.name) || [];
    const currentEnabled = getEnabledTools();
    const enabledCount = categoryTools.filter(t => currentEnabled.includes(t)).length;
    return enabledCount > 0 && enabledCount < categoryTools.length;
  };

  const enabledCount = getEnabledTools().length;
  const totalTools = Object.values(availableTools).flat().length;

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
              <CardTitle>Tool Permissions</CardTitle>
              <CardDescription>
                Configure which tools this agent can use. Tools allow agents to perform actions like browsing websites, filling forms, and running audits.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAvailableTools}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">
              {enabledCount} / {totalTools} tools enabled
            </Badge>
            {enabledCount === 0 && (
              <span className="text-sm text-muted-foreground">
                No tools enabled - agent cannot perform any automated actions
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tool Categories */}
      <div className="grid gap-4">
        {Object.entries(availableTools).map(([category, tools]) => {
          const CategoryIcon = toolCategoryIcons[category] || Globe;
          const isFullyEnabled = isCategoryFullyEnabled(category);
          const isPartiallyEnabled = isCategoryPartiallyEnabled(category);
          
          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base capitalize flex items-center gap-2">
                        {category} Tools
                        <Badge variant={isFullyEnabled ? "default" : isPartiallyEnabled ? "secondary" : "outline"}>
                          {tools.filter(t => getEnabledTools().includes(t.name)).length}/{tools.length}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {toolCategoryDescriptions[category] || `${category} related tools`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`category-${category}`} className="text-sm text-muted-foreground">
                      Enable All
                    </Label>
                    <Switch
                      id={`category-${category}`}
                      checked={isFullyEnabled}
                      onCheckedChange={() => toggleCategory(category)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tools.map(tool => {
                    const isEnabled = getEnabledTools().includes(tool.name);
                    
                    return (
                      <div
                        key={tool.name}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="font-medium text-sm truncate">{tool.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {tool.description}
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleTool(tool.name)}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/50 bg-blue-500/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-400">Tool Permissions Note</p>
              <p className="text-sm text-blue-700 dark:text-blue-500">
                Tools are executed based on the agent's AI decisions during conversations. 
                Only enable tools that are appropriate for this agent's purpose. 
                Credentials for authenticated actions are managed separately in the Credentials Manager.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentToolsTab;
