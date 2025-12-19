import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Label } from '../components/ui/label';
import { Loader2, Save, RefreshCw, Shield, AlertCircle, ArrowLeft, Users, DollarSign, Edit2, X, Check, AlertTriangle, Bot, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FeatureGatesAdmin = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [plans, setPlans] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Seat pricing state
  const [seatPricing, setSeatPricing] = useState([]);
  const [loadingSeatPricing, setLoadingSeatPricing] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editForm, setEditForm] = useState({ price_per_seat_monthly: '', price_per_seat_yearly: '', is_enabled: true });
  const [savingSeatPrice, setSavingSeatPrice] = useState(false);
  const [syncingSeatPricing, setSyncingSeatPricing] = useState(null);
  
  // Agent pricing state
  const [agentPricing, setAgentPricing] = useState([]);
  const [loadingAgentPricing, setLoadingAgentPricing] = useState(false);
  const [editingAgentPlan, setEditingAgentPlan] = useState(null);
  const [agentEditForm, setAgentEditForm] = useState({ price_per_agent_monthly: '', is_enabled: true });
  const [savingAgentPrice, setSavingAgentPrice] = useState(false);
  const [syncingAgentPricing, setSyncingAgentPricing] = useState(null);
  
  // Conversation pricing state
  const [conversationPricing, setConversationPricing] = useState([]);
  const [loadingConversationPricing, setLoadingConversationPricing] = useState(false);
  const [editingConversationPlan, setEditingConversationPlan] = useState(null);
  const [conversationEditForm, setConversationEditForm] = useState({ price_per_block: '', block_size: 100, is_enabled: true });
  const [savingConversationPrice, setSavingConversationPrice] = useState(false);
  const [syncingConversationPricing, setSyncingConversationPricing] = useState(null);

  useEffect(() => {
    // Check if user is super admin
    if (!user?.is_super_admin) {
      toast.error('Access denied. Super admin only.');
      navigate('/dashboard');
      return;
    }
    
    loadData();
    loadSeatPricing();
    loadAgentPricing();
    loadConversationPricing();
  }, [token, user, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, plansRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/feature-gates/config`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/feature-gates/plans`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/feature-gates/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setConfig(configRes.data);
      setPlans(plansRes.data.plans || []);
      setCategories(['all', ...(categoriesRes.data.categories || [])]);
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading feature gates:', error);
      toast.error(error.response?.data?.detail || 'Failed to load feature gates');
    } finally {
      setLoading(false);
    }
  };

  const loadSeatPricing = async () => {
    setLoadingSeatPricing(true);
    try {
      const response = await axios.get(`${API}/quotas/seat-pricing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSeatPricing(response.data || []);
    } catch (error) {
      console.error('Error loading seat pricing:', error);
      // Don't show error toast - pricing might not be configured yet
    } finally {
      setLoadingSeatPricing(false);
    }
  };

  const startEditSeatPrice = (pricing) => {
    setEditingPlan(pricing.plan_id);
    setEditForm({
      price_per_seat_monthly: (pricing.price_per_seat_monthly || 0).toString(),
      price_per_seat_yearly: (pricing.price_per_seat_yearly || 0).toString(),
      is_enabled: pricing.is_enabled
    });
  };

  const cancelEditSeatPrice = () => {
    setEditingPlan(null);
    setEditForm({ price_per_seat_monthly: '', price_per_seat_yearly: '', is_enabled: true });
  };

  const saveSeatPrice = async (planId) => {
    setSavingSeatPrice(true);
    try {
      const payload = {
        price_per_seat_monthly: parseFloat(editForm.price_per_seat_monthly) || 0,
        price_per_seat_yearly: parseFloat(editForm.price_per_seat_yearly) || 0,
        is_enabled: editForm.is_enabled
      };
      
      await axios.patch(`${API}/quotas/seat-pricing/${planId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Seat pricing updated successfully');
      setEditingPlan(null);
      loadSeatPricing();
    } catch (error) {
      console.error('Error saving seat pricing:', error);
      toast.error(error.response?.data?.detail || 'Failed to save seat pricing');
    } finally {
      setSavingSeatPrice(false);
    }
  };

  const syncSeatPricingToStripe = async (planId) => {
    setSyncingSeatPricing(planId);
    try {
      await axios.post(`${API}/quotas/seat-pricing/${planId}/sync-stripe`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Seat pricing synced to Stripe successfully!');
      loadSeatPricing();
    } catch (error) {
      console.error('Error syncing seat pricing to Stripe:', error);
      toast.error(error.response?.data?.detail || 'Failed to sync to Stripe. Make sure Stripe is configured.');
    } finally {
      setSyncingSeatPricing(null);
    }
  };

  const handleLimitChange = (featureIndex, planName, field, value) => {
    const newConfig = JSON.parse(JSON.stringify(config)); // Deep copy
    const feature = newConfig.features[featureIndex];
    
    if (!feature.plans[planName]) {
      feature.plans[planName] = { 
        enabled: false, 
        limit_value: null,
        limit_type: feature.limit_type,
        unit: feature.unit
      };
    }
    
    // Handle different field types
    if (field === 'limit_value') {
      // Convert to number or null
      feature.plans[planName][field] = value === '' || value === null ? null : parseInt(value);
    } else {
      feature.plans[planName][field] = value;
    }
    
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/feature-gates/config`,
        { features: config.features },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Feature gate configuration saved!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryBadgeColor = (category) => {
    const colors = {
      agents: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      team: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      usage: 'bg-green-500/10 text-green-500 border-green-500/20',
      content: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      branding: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const formatLimit = (limit) => {
    if (limit === null || limit === undefined) return 'Unlimited';
    if (limit === 0) return 'Disabled';
    return limit.toLocaleString();
  };

  const filteredFeatures = config?.features?.filter(feature => 
    selectedCategory === 'all' || feature.category === selectedCategory
  ) || [];

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border border-border">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold font-heading">Feature Gate Management</h1>
        </div>
        <p className="text-muted-foreground">
          Configure subscription plan limits, quotas, and seat pricing
        </p>
      </div>

      <Tabs defaultValue="quotas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="quotas" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Plan Limits & Quotas
          </TabsTrigger>
          <TabsTrigger value="seat-pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Seat Pricing
          </TabsTrigger>
        </TabsList>

        {/* Quotas Tab */}
        <TabsContent value="quotas">
          <Card className="border border-border">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-heading">Plan Limits & Quotas</CardTitle>
                  <CardDescription>
                    Set limits for agents, seats, usage, and features per plan
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadData}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {hasChanges && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-500">Unsaved Changes</p>
                    <p className="text-muted-foreground">
                      You have unsaved changes. Click &quot;Save Changes&quot; to apply them.
                    </p>
                  </div>
                </div>
              )}

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-muted-foreground">Filter by category:</span>
                {categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>

              {/* Feature Gate Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold bg-muted/50 min-w-[300px]">
                        Feature / Resource
                      </th>
                      {plans.map((plan) => (
                        <th
                          key={plan.name}
                          className="text-center p-4 font-semibold bg-muted/50 min-w-[180px]"
                        >
                          <div className="font-bold text-lg">{plan.display_name}</div>
                          <div className="text-xs font-normal text-muted-foreground mt-1">
                            {plan.description}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
              <tbody>
                {filteredFeatures.map((feature, featureIndex) => {
                  const actualIndex = config.features.findIndex(f => f.feature_key === feature.feature_key);
                  
                  return (
                    <tr key={feature.feature_key} className="border-b hover:bg-muted/30">
                      <td className="p-4">
                        <div className="space-y-2">
                          <div className="font-semibold">{feature.feature_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {feature.feature_description}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getCategoryBadgeColor(feature.category)}>
                              {feature.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {feature.limit_type === 'quota' ? '📊 Quota' : '📈 Usage'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Unit: {feature.unit}
                            </span>
                          </div>
                        </div>
                      </td>

                      {plans.map((plan) => {
                        const limits = feature.plans[plan.name] || { 
                          enabled: false, 
                          limit_value: null 
                        };
                        
                        return (
                          <td key={plan.name} className="p-4 text-center border-l">
                            <div className="space-y-3">
                              {/* Enabled Toggle */}
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={limits.enabled || false}
                                  onCheckedChange={(checked) =>
                                    handleLimitChange(actualIndex, plan.name, 'enabled', checked)
                                  }
                                />
                                <span className="text-sm font-medium">
                                  {limits.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                              </div>

                              {/* Limit Value (only show if enabled) */}
                              {limits.enabled && (
                                <div className="space-y-2">
                                  <label className="text-xs text-muted-foreground block">
                                    Limit
                                  </label>
                                  <Input
                                    type="number"
                                    value={limits.limit_value === null ? '' : limits.limit_value}
                                    onChange={(e) =>
                                      handleLimitChange(
                                        actualIndex,
                                        plan.name,
                                        'limit_value',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Unlimited"
                                    className="h-9 text-sm text-center"
                                    min="0"
                                  />
                                  <div className="text-xs text-muted-foreground">
                                    {formatLimit(limits.limit_value)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

              {filteredFeatures.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No features found for the selected category
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seat Pricing Tab */}
        <TabsContent value="seat-pricing">
          <Card className="border border-border">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Seat Pricing by Plan
                  </CardTitle>
                  <CardDescription>
                    Configure price per additional seat for each subscription tier. 
                    Users on paid plans can purchase extra seats at these prices.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSeatPricing}
                  disabled={loadingSeatPricing}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingSeatPricing && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {loadingSeatPricing ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {seatPricing.map((pricing) => (
                      <Card 
                        key={pricing.id} 
                        className={cn(
                          "border",
                          !pricing.is_enabled && "opacity-60"
                        )}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                              {pricing.plan_name} Plan
                            </CardTitle>
                            <Badge variant={pricing.is_enabled ? "default" : "secondary"}>
                              {pricing.is_enabled ? "Active" : "Disabled"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {editingPlan === pricing.plan_id ? (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor={`price-monthly-${pricing.plan_id}`}>
                                  Monthly Price ({pricing.currency?.toUpperCase() || 'USD'})
                                </Label>
                                <Input
                                  id={`price-monthly-${pricing.plan_id}`}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editForm.price_per_seat_monthly}
                                  onChange={(e) => setEditForm({ 
                                    ...editForm, 
                                    price_per_seat_monthly: e.target.value 
                                  })}
                                  placeholder="5.00"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`price-yearly-${pricing.plan_id}`}>
                                  Yearly Price ({pricing.currency?.toUpperCase() || 'USD'})
                                </Label>
                                <Input
                                  id={`price-yearly-${pricing.plan_id}`}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editForm.price_per_seat_yearly}
                                  onChange={(e) => setEditForm({ 
                                    ...editForm, 
                                    price_per_seat_yearly: e.target.value 
                                  })}
                                  placeholder="50.00"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`enabled-${pricing.plan_id}`}
                                  checked={editForm.is_enabled}
                                  onCheckedChange={(checked) => setEditForm({ 
                                    ...editForm, 
                                    is_enabled: checked 
                                  })}
                                />
                                <Label htmlFor={`enabled-${pricing.plan_id}`}>
                                  Enable seat subscriptions
                                </Label>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveSeatPrice(pricing.plan_id)}
                                  disabled={savingSeatPrice}
                                >
                                  {savingSeatPrice ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditSeatPrice}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold">
                                    ${(pricing.price_per_seat_monthly || 0).toFixed(2)}
                                  </span>
                                  <span className="text-muted-foreground text-sm">
                                    / seat / month
                                  </span>
                                </div>
                                {pricing.price_per_seat_yearly > 0 && (
                                  <div className="text-sm text-muted-foreground">
                                    ${(pricing.price_per_seat_yearly || 0).toFixed(2)} / seat / year
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Subscription billing
                              </div>
                              {(pricing.stripe_price_monthly_id || pricing.stripe_price_yearly_id) ? (
                                <div className="text-xs text-green-600 flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  Stripe: Connected
                                </div>
                              ) : pricing.price_per_seat_monthly > 0 && (
                                <div className="text-xs text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Not synced to Stripe
                                </div>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => startEditSeatPrice(pricing)}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                {!pricing.stripe_price_monthly_id && pricing.price_per_seat_monthly > 0 && (
                                  <Button
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => syncSeatPricingToStripe(pricing.plan_id)}
                                    disabled={syncingSeatPricing === pricing.plan_id}
                                  >
                                    {syncingSeatPricing === pricing.plan_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Sync to Stripe
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {seatPricing.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No seat pricing configured yet.</p>
                      <p className="text-sm mt-2">
                        Pricing will be automatically created when you first load this page.
                      </p>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold mb-2">How Seat Subscriptions Work</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• <strong>Synced with Plans:</strong> Seat pricing is automatically synced with your subscription plans</li>
                      <li>• <strong>Subscription-based:</strong> Additional seats are billed as recurring subscriptions (monthly or yearly)</li>
                      <li>• <strong>Free Plans:</strong> Users on Free plans cannot subscribe to additional seats</li>
                      <li>• <strong>Upgrade/Downgrade:</strong> Users can adjust their seat count anytime through the subscription portal</li>
                      <li>• <strong>Stripe Required:</strong> Stripe integration is required for seat subscription billing</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeatureGatesAdmin;
