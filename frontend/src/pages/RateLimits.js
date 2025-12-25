import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  Edit,
  RefreshCw,
  Shield,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RateLimits = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rateLimits, setRateLimits] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editLimits, setEditLimits] = useState({
    minute: 100,
    hour: 1000,
    day: 10000
  });

  useEffect(() => {
    fetchRateLimits();
  }, [token]);

  const fetchRateLimits = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/rate-limits/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRateLimits(response.data.rate_limits || []);
    } catch {
      toast.error('Failed to load rate limits');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tenant) => {
    setSelectedTenant(tenant);
    setEditLimits(tenant.limits);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedTenant) return;

    try {
      await axios.put(
        `${API}/rate-limits/${selectedTenant.tenant_id}`,
        {
          tenant_id: selectedTenant.tenant_id,
          limits: editLimits
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Rate limits updated successfully');
      setEditDialogOpen(false);
      fetchRateLimits();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to update rate limits');
    }
  };

  const handleReset = async (tenantId) => {
    if (!window.confirm('Reset to default rate limits?')) return;

    try {
      await axios.delete(`${API}/rate-limits/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Rate limits reset to defaults');
      fetchRateLimits();
    } catch {
      toast.error('Failed to reset rate limits');
    }
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 70) return 'text-amber-500';
    return 'text-green-500';
  };

  const getUsageBadge = (percentage) => {
    if (percentage >= 90) return <Badge variant="destructive">Critical</Badge>;
    if (percentage >= 70) return <Badge variant="outline" className="border-amber-500 text-amber-500">Warning</Badge>;
    return <Badge variant="outline" className="border-green-500 text-green-500">Healthy</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Rate Limit Management
          </h1>
          <p className="text-muted-foreground">Configure API rate limits per tenant</p>
        </div>
        <Button onClick={fetchRateLimits} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Default Limits Info */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-base">Default Rate Limits</CardTitle>
          <CardDescription>Applied to tenants without custom configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Minute</p>
                <p className="text-lg font-semibold">100 requests</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Hour</p>
                <p className="text-lg font-semibold">1,000 requests</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Day</p>
                <p className="text-lg font-semibold">10,000 requests</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>Tenant Rate Limits</CardTitle>
          <CardDescription>Current usage and configured limits per tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-center">Minute</TableHead>
                  <TableHead className="text-center">Hour</TableHead>
                  <TableHead className="text-center">Day</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateLimits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No tenants found
                    </TableCell>
                  </TableRow>
                ) : (
                  rateLimits.map((tenant) => {
                    const minuteUsage = tenant.usage?.minute || {};
                    const hourUsage = tenant.usage?.hour || {};
                    const dayUsage = tenant.usage?.day || {};
                    
                    const maxPercentage = Math.max(
                      minuteUsage.percentage || 0,
                      hourUsage.percentage || 0,
                      dayUsage.percentage || 0
                    );

                    return (
                      <TableRow key={tenant.tenant_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tenant.tenant_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {tenant.tenant_id}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <p className="font-medium">{minuteUsage.count || 0} / {minuteUsage.limit || 100}</p>
                            <p className={cn("text-xs", getUsageColor(minuteUsage.percentage || 0))}>
                              {minuteUsage.percentage || 0}%
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <p className="font-medium">{hourUsage.count || 0} / {hourUsage.limit || 1000}</p>
                            <p className={cn("text-xs", getUsageColor(hourUsage.percentage || 0))}>
                              {hourUsage.percentage || 0}%
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <p className="font-medium">{dayUsage.count || 0} / {dayUsage.limit || 10000}</p>
                            <p className={cn("text-xs", getUsageColor(dayUsage.percentage || 0))}>
                              {dayUsage.percentage || 0}%
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getUsageBadge(maxPercentage)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(tenant)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReset(tenant.tenant_id)}
                            >
                              Reset
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rate Limits</DialogTitle>
            <DialogDescription>
              Configure custom rate limits for {selectedTenant?.tenant_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="minute">Requests per Minute</Label>
              <Input
                id="minute"
                type="number"
                value={editLimits.minute}
                onChange={(e) => setEditLimits({ ...editLimits, minute: parseInt(e.target.value) || 0 })}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hour">Requests per Hour</Label>
              <Input
                id="hour"
                type="number"
                value={editLimits.hour}
                onChange={(e) => setEditLimits({ ...editLimits, hour: parseInt(e.target.value) || 0 })}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="day">Requests per Day</Label>
              <Input
                id="day"
                type="number"
                value={editLimits.day}
                onChange={(e) => setEditLimits({ ...editLimits, day: parseInt(e.target.value) || 0 })}
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RateLimits;
