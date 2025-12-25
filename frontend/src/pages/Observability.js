import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw, Zap, Database, Server } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}`;

const Observability = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, metricsRes] = await Promise.all([
        axios.get(`${API}/api/health/detailed`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/api/metrics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setHealth(healthRes.data);
      setMetrics(metricsRes.data);
    } catch {
      toast.error('Failed to load observability data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'connected') return 'text-green-500';
    if (status === 'degraded') return 'text-amber-500';
    return 'text-red-500';
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8" />
            System Observability
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor system health, performance, and logs
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="metrics">Performance</TabsTrigger>
        </TabsList>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-6">
          {/* System Status */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    health?.status === 'healthy' ? "bg-green-500/10" : "bg-amber-500/10"
                  )}>
                    {health?.status === 'healthy' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className={cn("font-semibold capitalize", getStatusColor(health?.status))}>
                      {health?.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Database</p>
                    <p className={cn("font-semibold capitalize", getStatusColor(health?.database?.status))}>
                      {health?.database?.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                    <p className="font-semibold">
                      {health?.uptime_seconds ? formatUptime(health.uptime_seconds) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Database Stats */}
              {health?.database?.collections && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Database Collections</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(health.database.collections).map(([name, count]) => (
                      <div key={name} className="bg-muted rounded-lg p-3">
                        <p className="text-xs text-muted-foreground capitalize">{name}</p>
                        <p className="text-lg font-semibold">{count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Resources */}
              {health?.system && health.system.available !== false && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">System Resources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-2">CPU Usage</p>
                      <p className="text-2xl font-bold">{health.system.cpu_percent?.toFixed(1)}%</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-2">Memory Usage</p>
                      <p className="text-2xl font-bold">{health.system.memory_percent?.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {health.system.memory_used_mb?.toFixed(0)} / {health.system.memory_total_mb?.toFixed(0)} MB
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-2">Disk Usage</p>
                      <p className="text-2xl font-bold">{health.system.disk_percent?.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {health.system.disk_used_gb?.toFixed(1)} / {health.system.disk_total_gb?.toFixed(1)} GB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{metrics?.metrics.total_requests || 0}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-500">{metrics?.metrics.total_errors || 0}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Slow Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-500">{metrics?.metrics.slow_requests_count || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Endpoint Performance */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Endpoint Performance
              </CardTitle>
              <CardDescription>Top endpoints by request count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.metrics.endpoints && Object.entries(metrics.metrics.endpoints)
                  .sort((a, b) => b[1].request_count - a[1].request_count)
                  .slice(0, 10)
                  .map(([endpoint, stats]) => (
                    <div key={endpoint} className="border-b border-border pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-mono text-sm font-semibold">{endpoint}</p>
                        <Badge variant="outline">{stats.request_count} requests</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Avg:</span> {(stats.avg_response_time * 1000).toFixed(2)}ms
                        </div>
                        <div>
                          <span className="font-medium">Min:</span> {(stats.min_response_time * 1000).toFixed(2)}ms
                        </div>
                        <div>
                          <span className="font-medium">Max:</span> {(stats.max_response_time * 1000).toFixed(2)}ms
                        </div>
                        <div>
                          <span className="font-medium">Errors:</span>{' '}
                          <span className={stats.error_count > 0 ? 'text-red-500' : ''}>
                            {stats.error_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Observability;
