import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, DollarSign, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PlanManagement = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    is_public: true,
    sort_order: 0,
    features: {
      max_conversations: null,
      max_agents: null,
      analytics_enabled: true,
      api_access: false,
      support_level: 'email',
      conversation_history_days: 30,
      remove_branding: false,
      custom_integrations: false
    }
  });

  useEffect(() => {
    fetchPlans();
  }, [token]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/subscriptions/plans?include_hidden=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlans(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPlan(null);
    setFormData({
      name: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      is_public: true,
      sort_order: plans.length,
      features: {
        max_conversations: null,
        max_agents: null,
        analytics_enabled: true,
        api_access: false,
        support_level: 'email',
        conversation_history_days: 30,
        remove_branding: false,
        custom_integrations: false
      }
    });
    setEditModalOpen(true);
  };

  const handleEdit = (plan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly || 0,
      is_public: plan.is_public,
      sort_order: plan.sort_order,
      features: plan.features
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedPlan) {
        // Update
        await axios.patch(
          `${API}/subscriptions/plans/${selectedPlan.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plan updated successfully! Changes synced to Stripe.');
      } else {
        // Create
        await axios.post(
          `${API}/subscriptions/plans`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plan created successfully! Synced to Stripe.');
      }
      setEditModalOpen(false);
      fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;

    try {
      await axios.delete(`${API}/subscriptions/plans/${planId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plan deleted successfully');
      fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete plan');
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8" />
            Subscription Plans
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage subscription tiers and pricing (syncs with Stripe)
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Plans Table */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>All Plans</CardTitle>
          <CardDescription>Manage your subscription plans and pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Plan Name</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No plans found
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.sort_order}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {plan.description}
                        </p>
                        {plan.stripe_product_id && (
                          <p className="text-xs text-blue-500 mt-1">
                            Stripe: {plan.stripe_product_id}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          ${plan.price_monthly}/mo
                        </p>
                        {plan.price_yearly && plan.price_yearly > 0 && (
                          <p className="text-xs text-muted-foreground">
                            ${plan.price_yearly}/yr
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <p>
                          Conv: {plan.features.max_conversations || '∞'}
                        </p>
                        <p>
                          Agents: {plan.features.max_agents || '∞'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.is_public ? (
                        <Badge variant="outline" className="border-green-500 text-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-500 text-gray-500">
                          <XCircle className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(plan)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(plan.id)}
                          disabled={plan.price_monthly === 0}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Create Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan ? 'Edit Plan' : 'Create New Plan'}
            </DialogTitle>
            <DialogDescription>
              Changes will automatically sync with Stripe
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Professional"
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the plan..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price_monthly">Monthly Price ($)</Label>
                  <Input
                    id="price_monthly"
                    type="number"
                    step="0.01"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="price_yearly">Yearly Price ($)</Label>
                  <Input
                    id="price_yearly"
                    type="number"
                    step="0.01"
                    value={formData.price_yearly}
                    onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                    placeholder="Auto-calculated if empty"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <Switch
                    checked={formData.is_public}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                  />
                  <Label>Visible to users</Label>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h3 className="font-semibold">Limits</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max_conversations">Max Conversations</Label>
                  <Input
                    id="max_conversations"
                    type="number"
                    value={formData.features.max_conversations || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      features: {
                        ...formData.features,
                        max_conversations: e.target.value ? parseInt(e.target.value) : null
                      }
                    })}
                    placeholder="Unlimited if empty"
                  />
                </div>
                <div>
                  <Label htmlFor="max_agents">Max Agents</Label>
                  <Input
                    id="max_agents"
                    type="number"
                    value={formData.features.max_agents || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      features: {
                        ...formData.features,
                        max_agents: e.target.value ? parseInt(e.target.value) : null
                      }
                    })}
                    placeholder="Unlimited if empty"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="history_days">Conversation History (days)</Label>
                <Input
                  id="history_days"
                  type="number"
                  value={formData.features.conversation_history_days || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    features: {
                      ...formData.features,
                      conversation_history_days: e.target.value ? parseInt(e.target.value) : null
                    }
                  })}
                  placeholder="Unlimited if empty"
                />
              </div>

              <h3 className="font-semibold pt-4">Features</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.features.analytics_enabled}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      features: { ...formData.features, analytics_enabled: checked }
                    })}
                  />
                  <Label>Analytics Enabled</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.features.api_access}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      features: { ...formData.features, api_access: checked }
                    })}
                  />
                  <Label>API Access</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.features.remove_branding}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      features: { ...formData.features, remove_branding: checked }
                    })}
                  />
                  <Label>Remove Branding</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.features.custom_integrations}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      features: { ...formData.features, custom_integrations: checked }
                    })}
                  />
                  <Label>Custom Integrations</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Plan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanManagement;