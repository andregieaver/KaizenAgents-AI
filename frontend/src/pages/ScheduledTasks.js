import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { cn } from '../lib/utils';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  Timer,
  Zap,
  AlertTriangle,
  Wrench,
  Key
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const scheduleTypeLabels = {
  cron: 'Cron Schedule',
  interval: 'Interval',
  one_time: 'One-Time'
};

const scheduleTypeIcons = {
  cron: Calendar,
  interval: Timer,
  one_time: Zap
};

export default function ScheduledTasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [runningTask, setRunningTask] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [tools, setTools] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agent_id: 'default-agent',
    tool_name: '',
    tool_params: '{}',
    schedule_type: 'interval',
    cron_expression: '0 * * * *',
    interval_minutes: 60,
    run_at: '',
    timezone: 'UTC',
    enabled: true
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchTasks(),
      fetchExecutions(),
      fetchSchedulerStatus(),
      fetchTools()
    ]);
    setLoading(false);
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API}/scheduled-tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks');
    }
  };

  const fetchExecutions = async () => {
    try {
      const response = await axios.get(`${API}/scheduled-tasks/executions/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExecutions(response.data.executions || []);
    } catch (error) {
      console.error('Failed to fetch executions');
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const response = await axios.get(`${API}/scheduled-tasks/status/scheduler`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedulerStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch scheduler status');
    }
  };

  const fetchTools = async () => {
    try {
      const response = await axios.get(`${API}/agent-tools/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allTools = Object.values(response.data.tools_by_category || {}).flat();
      setTools(allTools);
    } catch (error) {
      console.error('Failed to fetch tools');
    }
  };

  const handleCreate = () => {
    setSelectedTask(null);
    setFormData({
      name: '',
      description: '',
      agent_id: 'default-agent',
      tool_name: '',
      tool_params: '{}',
      schedule_type: 'interval',
      cron_expression: '0 * * * *',
      interval_minutes: 60,
      run_at: '',
      timezone: 'UTC',
      enabled: true
    });
    setDialogOpen(true);
  };

  const handleEdit = (task) => {
    setSelectedTask(task);
    setFormData({
      name: task.name,
      description: task.description || '',
      agent_id: task.agent_id,
      tool_name: task.tool_name,
      tool_params: JSON.stringify(task.tool_params || {}, null, 2),
      schedule_type: task.schedule?.type || 'interval',
      cron_expression: task.schedule?.cron_expression || '0 * * * *',
      interval_minutes: task.schedule?.interval_minutes || 60,
      run_at: task.schedule?.run_at || '',
      timezone: task.schedule?.timezone || 'UTC',
      enabled: task.enabled
    });
    setDialogOpen(true);
  };

  const handleDelete = (task) => {
    setSelectedTask(task);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTask) return;
    
    try {
      await axios.delete(`${API}/scheduled-tasks/${selectedTask.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task deleted');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to delete task');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedTask(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let toolParams;
      try {
        toolParams = JSON.parse(formData.tool_params);
      } catch {
        toast.error('Invalid JSON in tool parameters');
        setSaving(false);
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        agent_id: formData.agent_id,
        tool_name: formData.tool_name,
        tool_params: toolParams,
        schedule: {
          type: formData.schedule_type,
          timezone: formData.timezone
        },
        enabled: formData.enabled
      };

      // Add schedule-specific fields
      if (formData.schedule_type === 'cron') {
        payload.schedule.cron_expression = formData.cron_expression;
      } else if (formData.schedule_type === 'interval') {
        payload.schedule.interval_minutes = parseInt(formData.interval_minutes);
      } else if (formData.schedule_type === 'one_time') {
        payload.schedule.run_at = formData.run_at;
      }

      if (selectedTask) {
        await axios.put(`${API}/scheduled-tasks/${selectedTask.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Task updated');
      } else {
        await axios.post(`${API}/scheduled-tasks`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Task created');
      }

      setDialogOpen(false);
      fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (task) => {
    try {
      const endpoint = task.enabled ? 'disable' : 'enable';
      await axios.post(`${API}/scheduled-tasks/${task.id}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Task ${task.enabled ? 'disabled' : 'enabled'}`);
      fetchTasks();
    } catch (error) {
      toast.error('Failed to toggle task');
    }
  };

  const runTaskNow = async (task) => {
    setRunningTask(task.id);
    try {
      const response = await axios.post(`${API}/scheduled-tasks/${task.id}/run`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Task executed successfully');
      } else {
        toast.error(response.data.error || 'Task execution failed');
      }
      fetchTasks();
      fetchExecutions();
    } catch (error) {
      toast.error('Failed to run task');
    } finally {
      setRunningTask(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSchedule = (schedule) => {
    if (!schedule) return '-';
    if (schedule.type === 'cron') return schedule.cron_expression;
    if (schedule.type === 'interval') return `Every ${schedule.interval_minutes} min`;
    if (schedule.type === 'one_time') return formatDate(schedule.run_at);
    return '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canCreateTasks = schedulerStatus?.tenant_stats?.quota_limit > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Tasks</h1>
          <p className="text-muted-foreground">Automate recurring agent tool executions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={handleCreate} disabled={!canCreateTasks}>
            <Plus className="h-4 w-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                schedulerStatus?.scheduler?.running ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-sm text-muted-foreground">Scheduler</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {schedulerStatus?.scheduler?.running ? 'Running' : 'Stopped'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Tasks</div>
            <div className="text-2xl font-bold">{schedulerStatus?.tenant_stats?.total_tasks || 0}</div>
            <div className="text-xs text-muted-foreground">
              {schedulerStatus?.tenant_stats?.enabled_tasks || 0} enabled
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Quota</div>
            <div className="text-2xl font-bold">
              {schedulerStatus?.tenant_stats?.total_tasks || 0}/{schedulerStatus?.tenant_stats?.quota_limit || 0}
            </div>
            <div className="text-xs text-muted-foreground">tasks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Tier</div>
            <div className="text-2xl font-bold capitalize">{schedulerStatus?.tier || 'starter'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quota Warning */}
      {!canCreateTasks && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-400">Scheduled tasks not available</p>
              <p className="text-sm text-amber-700 dark:text-amber-500">
                Scheduled tasks are available on Professional and Enterprise plans. Upgrade to unlock this feature.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">
            <Clock className="h-4 w-4 mr-2" /> Tasks
            <Badge variant="secondary" className="ml-2">{tasks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" /> Execution History
            <Badge variant="secondary" className="ml-2">{executions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No scheduled tasks</h3>
                <p className="text-muted-foreground mb-4">Create tasks to automate agent tool executions.</p>
                {canCreateTasks && (
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" /> Create Your First Task
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tasks.map(task => {
                const ScheduleIcon = scheduleTypeIcons[task.schedule?.type] || Clock;
                
                return (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Task Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{task.name}</h3>
                            <Badge variant={task.enabled ? 'default' : 'secondary'}>
                              {task.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}
                          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" /> {task.tool_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <ScheduleIcon className="h-3 w-3" /> {formatSchedule(task.schedule)}
                            </span>
                            <span>Next: {formatDate(task.next_run)}</span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <div className="font-medium">{task.execution_count}</div>
                            <div className="text-xs text-muted-foreground">Runs</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">{task.success_count}</div>
                            <div className="text-xs text-muted-foreground">Success</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-red-600">{task.failure_count}</div>
                            <div className="text-xs text-muted-foreground">Failed</div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runTaskNow(task)}
                            disabled={runningTask === task.id}
                          >
                            {runningTask === task.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleTask(task)}
                          >
                            {task.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(task)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(task)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No execution history</h3>
                <p className="text-muted-foreground">Task executions will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {executions.map(exec => (
                    <div key={exec.id} className="p-4 flex items-center gap-4">
                      <div className={cn(
                        "p-2 rounded-full",
                        exec.status === 'success' ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                      )}>
                        {exec.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{exec.tool_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(exec.started_at)} • {exec.duration_ms}ms
                        </div>
                      </div>
                      <Badge variant={exec.status === 'success' ? 'default' : 'destructive'}>
                        {exec.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            <DialogDescription>
              Schedule automated tool executions for your AI agents.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Task Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Daily SEO Check"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tool_name">Tool *</Label>
                <Select
                  value={formData.tool_name}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tool_name: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tool" />
                  </SelectTrigger>
                  <SelectContent>
                    {tools.map(tool => (
                      <SelectItem key={tool.name} value={tool.name}>
                        {tool.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Check website SEO daily at 9 AM"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool_params">Tool Parameters (JSON)</Label>
              <Textarea
                id="tool_params"
                value={formData.tool_params}
                onChange={(e) => setFormData(prev => ({ ...prev, tool_params: e.target.value }))}
                placeholder='{"url": "https://example.com"}'
                rows={3}
                className="font-mono text-sm"
              />
            </div>

            {/* Schedule Type */}
            <div className="space-y-4">
              <Label>Schedule Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {['interval', 'cron', 'one_time'].map(type => (
                  <Button
                    key={type}
                    type="button"
                    variant={formData.schedule_type === type ? 'default' : 'outline'}
                    onClick={() => setFormData(prev => ({ ...prev, schedule_type: type }))}
                    className="justify-start"
                  >
                    {scheduleTypeLabels[type]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Schedule Config */}
            {formData.schedule_type === 'interval' && (
              <div className="space-y-2">
                <Label htmlFor="interval_minutes">Interval (minutes)</Label>
                <Input
                  id="interval_minutes"
                  type="number"
                  value={formData.interval_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, interval_minutes: e.target.value }))}
                  min={1}
                />
              </div>
            )}

            {formData.schedule_type === 'cron' && (
              <div className="space-y-2">
                <Label htmlFor="cron_expression">Cron Expression</Label>
                <Input
                  id="cron_expression"
                  value={formData.cron_expression}
                  onChange={(e) => setFormData(prev => ({ ...prev, cron_expression: e.target.value }))}
                  placeholder="0 9 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day month weekday (e.g., &quot;0 9 * * *&quot; = daily at 9 AM)
                </p>
              </div>
            )}

            {formData.schedule_type === 'one_time' && (
              <div className="space-y-2">
                <Label htmlFor="run_at">Run At</Label>
                <Input
                  id="run_at"
                  type="datetime-local"
                  value={formData.run_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, run_at: e.target.value }))}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
              />
              <Label htmlFor="enabled">Enable task immediately</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {selectedTask ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedTask?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
