import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../lib/utils';
import {
  History,
  Search,
  Filter,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Globe,
  Zap,
  BarChart3,
  Calendar,
  Wrench,
  Key
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ExecutionLogs() {
  const { token } = useAuth();
  const [executions, setExecutions] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('logs');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [execResponse, usageResponse] = await Promise.all([
          axios.get(`${API}/agent-tools/history`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 100 }
          }),
          axios.get(`${API}/agent-tools/usage`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        setExecutions(execResponse.data.executions || []);
        setUsage(usageResponse.data);
      } catch (error) {
        console.error('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [execResponse, usageResponse] = await Promise.all([
        axios.get(`${API}/agent-tools/history`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 }
        }),
        axios.get(`${API}/agent-tools/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setExecutions(execResponse.data.executions || []);
      setUsage(usageResponse.data);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = (execution) => {
    setSelectedExecution(execution);
    setDetailsOpen(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredExecutions = executions.filter(exec => {
    const matchesSearch = !searchQuery || 
      exec.tool_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exec.id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || exec.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Success</Badge>;
      case 'failed':
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      case 'denied':
        return <Badge variant="outline">Denied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate stats
  const stats = {
    total: executions.length,
    success: executions.filter(e => e.status === 'success' || e.status === 'completed').length,
    failed: executions.filter(e => e.status === 'failed' || e.status === 'error').length,
    avgDuration: executions.length > 0 
      ? Math.round(executions.reduce((acc, e) => acc + (e.duration_ms || 0), 0) / executions.length)
      : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Execution Logs</h1>
          <p className="text-muted-foreground">View tool execution history and usage analytics</p>
        </div>
        <Button variant="outline" onClick={fetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Executions</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Successful</div>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Avg Duration</div>
            <div className="text-2xl font-bold">{stats.avgDuration}ms</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Today</div>
            <div className="text-2xl font-bold">{usage?.today_usage || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs">
            <History className="h-4 w-4 mr-2" /> Logs
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tool name or execution ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Executions List */}
          {filteredExecutions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No executions found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your filters'
                    : 'Tool executions will appear here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {filteredExecutions.map(exec => (
                    <div 
                      key={exec.id} 
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => viewDetails(exec)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-full",
                          exec.status === 'success' || exec.status === 'completed' 
                            ? "bg-green-500/10" 
                            : exec.status === 'failed' || exec.status === 'error'
                            ? "bg-red-500/10"
                            : "bg-muted"
                        )}>
                          {getStatusIcon(exec.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{exec.tool_name}</span>
                            {getStatusBadge(exec.status)}
                          </div>
                          <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDate(exec.started_at)}
                            </span>
                            {exec.duration_ms && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {exec.duration_ms}ms
                              </span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Usage by Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Executions by Tool</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const toolCounts = {};
                  executions.forEach(exec => {
                    toolCounts[exec.tool_name] = (toolCounts[exec.tool_name] || 0) + 1;
                  });
                  const sorted = Object.entries(toolCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                  
                  if (sorted.length === 0) {
                    return <p className="text-muted-foreground text-center py-4">No data</p>;
                  }
                  
                  return (
                    <div className="space-y-3">
                      {sorted.map(([tool, count]) => {
                        const percentage = (count / stats.total) * 100;
                        return (
                          <div key={tool}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="truncate">{tool}</span>
                              <span className="text-muted-foreground">{count}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Success Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-muted"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(stats.success / (stats.total || 1)) * 351.86} 351.86`}
                        className="text-green-600"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">
                        {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                    <div className="text-xs text-muted-foreground">Successful</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quota Usage */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Rate Limits</CardTitle>
                <CardDescription>Current tier: {usage?.tier || 'starter'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {usage?.limits && Object.entries(usage.limits).map(([key, limit]) => (
                    <div key={key} className="p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-2xl font-bold mt-1">{limit}/hr</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Execution Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
            <DialogDescription>
              {selectedExecution?.tool_name} • {formatDate(selectedExecution?.started_at)}
            </DialogDescription>
          </DialogHeader>

          {selectedExecution && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedExecution.status)}
                {selectedExecution.duration_ms && (
                  <span className="text-sm text-muted-foreground">
                    Duration: {selectedExecution.duration_ms}ms
                  </span>
                )}
              </div>

              {/* Parameters */}
              <div>
                <h4 className="font-medium mb-2">Parameters</h4>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(selectedExecution.tool_params || {}, null, 2)}
                </pre>
              </div>

              {/* Result */}
              <div>
                <h4 className="font-medium mb-2">Result</h4>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto max-h-[300px]">
                  {JSON.stringify(selectedExecution.result || selectedExecution.error || {}, null, 2)}
                </pre>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Execution ID:</span>
                  <p className="font-mono text-xs break-all">{selectedExecution.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Agent ID:</span>
                  <p className="font-mono text-xs">{selectedExecution.agent_id}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
