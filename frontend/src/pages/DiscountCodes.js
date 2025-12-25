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
import { Plus, Edit, Trash2, Loader2, Tag, Copy, CheckCircle, XCircle, Percent, DollarSign, Calendar, Gift } from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DiscountCodes = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState([]);
  const [plans, setPlans] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage',
    value: 10,
    max_uses: null,
    expires_at: '',
    applicable_plans: null,
    min_plan_price: null,
    is_active: true,
    is_first_time_only: false
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [codesRes, plansRes] = await Promise.all([
        axios.get(`${API}/discounts?include_inactive=true`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/subscriptions/plans?include_hidden=true`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setCodes(codesRes.data);
      setPlans(plansRes.data);
    } catch {
      toast.error('Failed to load discount codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedCode(null);
    setFormData({
      code: generateCode(),
      name: '',
      description: '',
      discount_type: 'percentage',
      value: 10,
      max_uses: null,
      expires_at: '',
      applicable_plans: null,
      min_plan_price: null,
      is_active: true,
      is_first_time_only: false
    });
    setEditModalOpen(true);
  };

  const handleEdit = (code) => {
    setSelectedCode(code);
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description || '',
      discount_type: code.discount_type,
      value: code.value,
      max_uses: code.max_uses,
      expires_at: code.expires_at ? code.expires_at.split('T')[0] : '',
      applicable_plans: code.applicable_plans,
      min_plan_price: code.min_plan_price,
      is_active: code.is_active,
      is_first_time_only: code.is_first_time_only
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Code and name are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        max_uses: formData.max_uses || null,
        min_plan_price: formData.min_plan_price || null
      };

      if (selectedCode) {
        await axios.patch(
          `${API}/discounts/${selectedCode.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Discount code updated successfully');
      } else {
        await axios.post(
          `${API}/discounts`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Discount code created successfully');
      }
      setEditModalOpen(false);
      fetchData();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to save discount code');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (codeId) => {
    if (!window.confirm('Are you sure you want to delete this discount code?')) return;

    try {
      await axios.delete(`${API}/discounts/${codeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Discount code deleted');
      fetchData();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to delete discount code');
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const getDiscountTypeIcon = (type) => {
    switch (type) {
      case 'percentage':
        return <Percent className="h-4 w-4" />;
      case 'fixed_amount':
        return <DollarSign className="h-4 w-4" />;
      case 'free_trial_days':
        return <Calendar className="h-4 w-4" />;
      case 'free_months':
        return <Gift className="h-4 w-4" />;
      default:
        return <Tag className="h-4 w-4" />;
    }
  };

  const getDiscountTypeLabel = (type) => {
    switch (type) {
      case 'percentage':
        return 'Percentage';
      case 'fixed_amount':
        return 'Fixed Amount';
      case 'free_trial_days':
        return 'Free Trial Days';
      case 'free_months':
        return 'Free Months';
      default:
        return type;
    }
  };

  const formatDiscountValue = (code) => {
    switch (code.discount_type) {
      case 'percentage':
        return `${code.value}% off`;
      case 'fixed_amount':
        return `$${code.value} off`;
      case 'free_trial_days':
        return `${code.value} days free`;
      case 'free_months':
        return `${code.value} month(s) free`;
      default:
        return code.value;
    }
  };

  const isExpired = (code) => {
    if (!code.expires_at) return false;
    return new Date(code.expires_at) < new Date();
  };

  const isUsedUp = (code) => {
    if (!code.max_uses) return false;
    return code.current_uses >= code.max_uses;
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
            <Tag className="h-8 w-8" />
            Discount Codes
          </h1>
          <p className="text-muted-foreground mt-2">
            Create and manage promotional discount codes
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Code
        </Button>
      </div>

      {/* Codes Table */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>All Discount Codes</CardTitle>
          <CardDescription>Manage promotional codes for your subscription plans</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No discount codes found
                  </TableCell>
                </TableRow>
              ) : (
                codes.map((code) => (
                  <TableRow key={code.id} className={cn(!code.is_active && "opacity-50")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono bg-muted px-2 py-1 rounded text-sm">
                          {code.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopyCode(code.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{code.name}</p>
                        {code.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {code.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getDiscountTypeIcon(code.discount_type)}
                        <span className="text-sm">{getDiscountTypeLabel(code.discount_type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatDiscountValue(code)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {code.current_uses} / {code.max_uses || '∞'}
                      </div>
                      {code.expires_at && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(code.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {code.is_active && !isExpired(code) && !isUsedUp(code) ? (
                          <Badge variant="outline" className="border-green-500 text-green-500 w-fit">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-500 text-gray-500 w-fit">
                            <XCircle className="h-3 w-3 mr-1" />
                            {isExpired(code) ? 'Expired' : isUsedUp(code) ? 'Used Up' : 'Inactive'}
                          </Badge>
                        )}
                        {code.is_first_time_only && (
                          <Badge variant="outline" className="text-xs w-fit">
                            First-time only
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(code)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(code.id)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCode ? 'Edit Discount Code' : 'Create Discount Code'}
            </DialogTitle>
            <DialogDescription>
              Configure promotional discount settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SUMMER20"
                    className="font-mono"
                    disabled={!!selectedCode}
                  />
                  {!selectedCode && (
                    <Button
                      variant="outline"
                      onClick={() => setFormData({ ...formData, code: generateCode() })}
                    >
                      Generate
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Summer Sale 2025"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discount_type">Discount Type</Label>
                <select
                  id="discount_type"
                  value={formData.discount_type}
                  onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="percentage">Percentage Off</option>
                  <option value="fixed_amount">Fixed Amount Off</option>
                  <option value="free_trial_days">Free Trial Days</option>
                  <option value="free_months">Free Months</option>
                </select>
              </div>
              <div>
                <Label htmlFor="value">
                  {formData.discount_type === 'percentage' ? 'Percentage (%)' :
                   formData.discount_type === 'fixed_amount' ? 'Amount ($)' :
                   formData.discount_type === 'free_trial_days' ? 'Days' : 'Months'}
                </Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                  min={0}
                  max={formData.discount_type === 'percentage' ? 100 : undefined}
                />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_uses">Max Uses (leave empty for unlimited)</Label>
                <Input
                  id="max_uses"
                  type="number"
                  value={formData.max_uses || ''}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Unlimited"
                  min={1}
                />
              </div>
              <div>
                <Label htmlFor="expires_at">Expiry Date (optional)</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="min_plan_price">Minimum Plan Price ($)</Label>
              <Input
                id="min_plan_price"
                type="number"
                value={formData.min_plan_price || ''}
                onChange={(e) => setFormData({ ...formData, min_plan_price: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="No minimum"
                min={0}
              />
            </div>

            {/* Applicable Plans */}
            <div>
              <Label>Applicable Plans</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select plans this code can be used with (leave all unchecked for all plans)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {plans.map((plan) => (
                  <label key={plan.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.applicable_plans?.includes(plan.id) || false}
                      onChange={(e) => {
                        const current = formData.applicable_plans || [];
                        if (e.target.checked) {
                          setFormData({ ...formData, applicable_plans: [...current, plan.id] });
                        } else {
                          const updated = current.filter(id => id !== plan.id);
                          setFormData({ ...formData, applicable_plans: updated.length > 0 ? updated : null });
                        }
                      }}
                      className="rounded border-input"
                    />
                    {plan.name} (${plan.price_monthly}/mo)
                  </label>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_first_time_only}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_first_time_only: checked })}
                />
                <Label>First-time subscribers only</Label>
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
                'Save Code'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscountCodes;
