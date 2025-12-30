import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';
import {
  Globe,
  MousePointer,
  FileText,
  Camera,
  Key,
  Clock,
  Search,
  BarChart3,
  Shield,
  Link as LinkIcon,
  Accessibility,
  Zap,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wrench,
  History
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const toolIcons = {
  browse_website: Globe,
  click_element: MousePointer,
  extract_text: FileText,
  take_screenshot: Camera,
  fill_form: FileText,
  submit_form: FileText,
  login_to_website: Key,
  logout_from_website: Key,
  check_login_status: Key,
  audit_seo: Search,
  audit_accessibility: Accessibility,
  audit_performance: Zap,
  audit_security: Shield,
  check_broken_links: LinkIcon,
  create_scheduled_task: Clock,
  list_scheduled_tasks: Clock,
  run_scheduled_task: Clock,
};

const categoryLabels = {
  browser: 'Browser Tools',
  form: 'Form Tools',
  auth: 'Authentication Tools',
  audit: 'Audit Tools',
  scheduler: 'Scheduler Tools'
};

export default function AgentTools() {
  const { token } = useAuth();
  const [tools, setTools] = useState({});
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testUrl, setTestUrl] = useState('https://example.com');
  const [testingTool, setTestingTool] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [activeTab, setActiveTab] = useState('browser');

  useEffect(() => {
    fetchTools();
    fetchUsage();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await axios.get(`${API}/agent-tools/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTools(response.data.tools_by_category || {});
    } catch (error) {
      toast.error('Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const response = await axios.get(`${API}/agent-tools/usage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsage(response.data);
    } catch (error) {
      console.error('Failed to fetch usage');
    }
  };

  const testTool = async (toolName) => {
    setTestingTool(toolName);
    try {
      const params = { url: testUrl };
      
      // Add specific params for certain tools
      if (toolName === 'check_broken_links') {
        params.max_links = 10;
      }

      const response = await axios.post(`${API}/agent-tools/execute`, {
        tool_name: toolName,
        params,
        agent_id: 'test-agent'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTestResults(prev => ({
        ...prev,
        [toolName]: response.data
      }));

      if (response.data.success) {
        toast.success(`${toolName} executed successfully`);
      } else {
        toast.error(response.data.error || 'Tool execution failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to execute tool');
      setTestResults(prev => ({
        ...prev,
        [toolName]: { success: false, error: error.message }
      }));
    } finally {
      setTestingTool(null);
    }
  };

  const getToolIcon = (toolName) => {
    const Icon = toolIcons[toolName] || Globe;
    return <Icon className="h-5 w-5" />;
  };

  const renderToolCard = (tool) => {
    const result = testResults[tool.name];
    const isAuditTool = tool.name.startsWith('audit_') || tool.name === 'check_broken_links';
    
    return (
      <Card key={tool.name} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {getToolIcon(tool.name)}
              </div>
              <div>
                <CardTitle className="text-base">{tool.name}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {tool.description}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Parameters */}
          {tool.parameters?.properties && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Parameters:</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(tool.parameters.properties).slice(0, 4).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}
                    {tool.parameters.required?.includes(key) && <span className="text-red-500">*</span>}
                  </Badge>
                ))}
                {Object.keys(tool.parameters.properties).length > 4 && (
                  <Badge variant="outline" className="text-xs">+{Object.keys(tool.parameters.properties).length - 4} more</Badge>
                )}
              </div>
            </div>
          )}

          {/* Test Result */}
          {result && (
            <div className={cn(
              "p-3 rounded-lg mb-3 text-sm",
              result.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
            )}>
              <div className="flex items-center gap-2 mb-1">
                {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span className="font-medium">
                  {result.success ? 'Success' : 'Failed'}
                </span>
                {result.score !== undefined && (
                  <Badge variant={result.grade === 'A' ? 'default' : result.grade === 'F' ? 'destructive' : 'secondary'}>
                    {result.score}/100 ({result.grade})
                  </Badge>
                )}
              </div>
              {result.duration_ms && (
                <p className="text-xs opacity-75">Duration: {result.duration_ms}ms</p>
              )}
              {result.error && (
                <p className="text-xs mt-1">{result.error}</p>
              )}
            </div>
          )}

          {/* Test Button */}
          {(isAuditTool || tool.name === 'browse_website' || tool.name === 'take_screenshot') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => testTool(tool.name)}
              disabled={testingTool === tool.name}
              className="w-full"
            >
              {testingTool === tool.name ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Test Tool</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const categories = Object.keys(tools);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Sub Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <Link to="/dashboard/agent-tools">
          <Button variant="default" size="sm">
            <Wrench className="h-4 w-4 mr-2" /> Tools
          </Button>
        </Link>
        <Link to="/dashboard/agent-tools/credentials">
          <Button variant="outline" size="sm">
            <Key className="h-4 w-4 mr-2" /> Credentials
          </Button>
        </Link>
        <Link to="/dashboard/agent-tools/scheduled-tasks">
          <Button variant="outline" size="sm">
            <Clock className="h-4 w-4 mr-2" /> Scheduled Tasks
          </Button>
        </Link>
        <Link to="/dashboard/agent-tools/logs">
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" /> Logs
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agent Tools</h1>
          <p className="text-muted-foreground">Configure and test AI agent capabilities</p>
        </div>
        <Button variant="outline" onClick={() => { fetchTools(); fetchUsage(); }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Usage Stats */}
      {usage && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Current Hour</div>
              <div className="text-2xl font-bold">{usage.current_hour_usage || 0}</div>
              <div className="text-xs text-muted-foreground">executions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Today</div>
              <div className="text-2xl font-bold">{usage.today_usage || 0}</div>
              <div className="text-xs text-muted-foreground">executions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Tier</div>
              <div className="text-2xl font-bold capitalize">{usage.tier || 'starter'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Browser Tools Limit</div>
              <div className="text-2xl font-bold">
                {usage.limits?.agent_browser_tools || 0}/hr
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test URL Input */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label>Test URL</Label>
              <Input
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <p className="text-sm text-muted-foreground">Enter a URL to test browser and audit tools against</p>
          </div>
        </CardContent>
      </Card>

      {/* Tools Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex h-auto gap-1 min-w-max">
            {categories.map(category => (
              <TabsTrigger key={category} value={category} className="capitalize whitespace-nowrap">
                {categoryLabels[category] || category}
                <Badge variant="secondary" className="ml-2">
                  {tools[category]?.length || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {categories.map(category => (
          <TabsContent key={category} value={category}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tools[category]?.map(tool => renderToolCard(tool))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
