/**
 * PricingConfigCard - Card for configuring per-plan pricing
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Loader2, Edit2, X, Check, RefreshCw, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { cn } from '../../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PricingConfigCard = ({
  title,
  description,
  icon: Icon,
  pricingData,
  loading,
  token,
  onUpdate,
  priceFields = [{ key: 'price', label: 'Price', prefix: '$', suffix: '/mo' }],
  apiEndpoint
}) => {
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(null);

  const handleEdit = (plan) => {
    setEditing(plan.plan_id);
    const form = { is_enabled: plan.is_enabled };
    priceFields.forEach(field => {
      form[field.key] = plan[field.key] || '';
    });
    setEditForm(form);
  };

  const handleCancel = () => {
    setEditing(null);
    setEditForm({});
  };

  const handleSave = async (planId) => {
    setSaving(true);
    try {
      await axios.put(
        `${API}${apiEndpoint}/${planId}`,
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Pricing updated successfully');
      setEditing(null);
      if (onUpdate) onUpdate();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (planId) => {
    setSyncing(planId);
    try {
      await axios.post(
        `${API}${apiEndpoint}/${planId}/sync-stripe`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Synced with Stripe successfully');
      if (onUpdate) onUpdate();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to sync with Stripe');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pricingData.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No pricing data available</p>
        ) : (
          <div className="space-y-3">
            {pricingData.map((plan) => (
              <div
                key={plan.plan_id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  !plan.is_enabled && "opacity-50 bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.plan_name}</span>
                      {!plan.is_enabled && (
                        <Badge variant="outline" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                    {editing === plan.plan_id ? (
                      <div className="flex items-center gap-4 mt-2">
                        {priceFields.map((field) => (
                          <div key={field.key} className="flex items-center gap-1">
                            <Label className="text-xs">{field.label}:</Label>
                            <div className="flex items-center">
                              {field.prefix && (
                                <span className="text-sm text-muted-foreground">{field.prefix}</span>
                              )}
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm[field.key]}
                                onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                className="w-20 h-7 text-sm"
                              />
                              {field.suffix && (
                                <span className="text-sm text-muted-foreground">{field.suffix}</span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Enabled:</Label>
                          <Switch
                            checked={editForm.is_enabled}
                            onCheckedChange={(v) => setEditForm({ ...editForm, is_enabled: v })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {priceFields.map((field) => (
                          <span key={field.key}>
                            {field.label}: {field.prefix}{plan[field.key] || 0}{field.suffix}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {editing === plan.plan_id ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(plan.plan_id)}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(plan)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(plan.plan_id)}
                        disabled={syncing === plan.plan_id}
                      >
                        {syncing === plan.plan_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PricingConfigCard;
