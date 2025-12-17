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
import { Plus, Edit, Trash2, Loader2, DollarSign, CheckCircle, XCircle, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
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
  
  // Custom feature items state
  const [featureItems, setFeatureItems] = useState([]);
  const [editingFeatureIndex, setEditingFeatureIndex] = useState(null);
  const [newFeatureText, setNewFeatureText] = useState('');

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
    setFeatureItems([]);
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
    // Load custom feature items if they exist
    setFeatureItems(plan.features.custom_items || []);
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Include custom feature items in the features object
      const dataToSave = {
        ...formData,
        features: {
          ...formData.features,
          custom_items: featureItems
        }
      };

      if (selectedPlan) {
        // Update
        await axios.patch(
          `${API}/subscriptions/plans/${selectedPlan.id}`,
          dataToSave,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Plan updated successfully! Changes synced to Stripe.');
      } else {
        // Create
        await axios.post(
          `${API}/subscriptions/plans`,
          dataToSave,
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

  // Feature Item Management Functions
  const handleAddFeatureItem = () => {
    if (!newFeatureText.trim()) return;
    setFeatureItems([...featureItems, newFeatureText.trim()]);
    setNewFeatureText('');
  };

  const handleEditFeatureItem = (index) => {
    setEditingFeatureIndex(index);
    setNewFeatureText(featureItems[index]);
  };

  const handleSaveFeatureItem = () => {
    if (!newFeatureText.trim()) return;
    const updated = [...featureItems];
    updated[editingFeatureIndex] = newFeatureText.trim();
    setFeatureItems(updated);
    setEditingFeatureIndex(null);
    setNewFeatureText('');
  };

  const handleCancelEditFeatureItem = () => {
    setEditingFeatureIndex(null);
    setNewFeatureText('');
  };

  const handleDeleteFeatureItem = (index) => {
    setFeatureItems(featureItems.filter((_, i) => i !== index));
  };

  const handleMoveFeatureItem = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= featureItems.length) return;
    
    const updated = [...featureItems];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFeatureItems(updated);
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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

            {/* Note about Feature Gates */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Resource limits and feature toggles are now managed in the 
                <a href="/dashboard/feature-gates" className="underline ml-1 font-semibold">Feature Gates</a> page 
                for centralized quota management across all plans.
              </p>
            </div>

            {/* Custom Feature Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Custom Feature Items</h3>
                <p className="text-xs text-muted-foreground">
                  Add custom features to display on the pricing card
                </p>
              </div>
              
              {/* Feature Items List */}
              <div className="space-y-2">
                {featureItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
                    No custom features added yet. Add one below.
                  </p>
                ) : (
                  <div className="border border-border rounded-md divide-y divide-border">
                    {featureItems.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-2 p-3 bg-card hover:bg-muted/50 transition-colors"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        
                        {editingFeatureIndex === index ? (
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={newFeatureText}
                              onChange={(e) => setNewFeatureText(e.target.value)}
                              className="flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveFeatureItem();
                                if (e.key === 'Escape') handleCancelEditFeatureItem();
                              }}
                            />
                            <Button size="sm" onClick={handleSaveFeatureItem}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEditFeatureItem}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="flex-1 text-sm">{item}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveFeatureItem(index, 'up')}
                                disabled={index === 0}
                                className="h-8 w-8 p-0"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveFeatureItem(index, 'down')}
                                disabled={index === featureItems.length - 1}
                                className="h-8 w-8 p-0"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditFeatureItem(index)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFeatureItem(index)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Feature Item */}
              {editingFeatureIndex === null && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    placeholder="Enter a new feature (e.g., '24/7 Live chat support')"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddFeatureItem();
                    }}
                  />
                  <Button onClick={handleAddFeatureItem} disabled={!newFeatureText.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              )}
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
