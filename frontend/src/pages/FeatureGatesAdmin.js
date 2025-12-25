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
import { ResourcePricingSection } from '../components/admin';

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
      toast.error(error.response?.data?.detail || 'Failed to sync to Stripe. Make sure Stripe is configured.');
    } finally {
      setSyncingSeatPricing(null);
    }
  };

  // ============== AGENT PRICING FUNCTIONS ==============
  
  const loadAgentPricing = async () => {
    setLoadingAgentPricing(true);
    try {
      const response = await axios.get(`${API}/quotas/agent-pricing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgentPricing(response.data || []);
    } catch (error) {
      // Agent pricing may not be configured yet - silently ignore
    } finally {
      setLoadingAgentPricing(false);
    }
  };

  const startEditAgentPrice = (pricing) => {
    setEditingAgentPlan(pricing.plan_id);
    setAgentEditForm({
      price_per_agent_monthly: (pricing.price_per_agent_monthly || 0).toString(),
      is_enabled: pricing.is_enabled
    });
  };

  const cancelEditAgentPrice = () => {
    setEditingAgentPlan(null);
    setAgentEditForm({ price_per_agent_monthly: '', is_enabled: true });
  };

  const saveAgentPrice = async (planId) => {
    setSavingAgentPrice(true);
    try {
      await axios.patch(`${API}/quotas/agent-pricing/${planId}`, {
        price_per_agent_monthly: parseFloat(agentEditForm.price_per_agent_monthly) || 0,
        is_enabled: agentEditForm.is_enabled
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      toast.success('Agent pricing updated successfully');
      setEditingAgentPlan(null);
      loadAgentPricing();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save agent pricing');
    } finally {
      setSavingAgentPrice(false);
    }
  };

  const syncAgentPricingToStripe = async (planId) => {
    setSyncingAgentPricing(planId);
    try {
      await axios.post(`${API}/quotas/agent-pricing/${planId}/sync-stripe`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent pricing synced to Stripe successfully!');
      loadAgentPricing();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync to Stripe.');
    } finally {
      setSyncingAgentPricing(null);
    }
  };

  // ============== CONVERSATION PRICING FUNCTIONS ==============
  
  const loadConversationPricing = async () => {
    setLoadingConversationPricing(true);
    try {
      const response = await axios.get(`${API}/quotas/conversation-pricing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversationPricing(response.data || []);
    } catch (error) {
      // Conversation pricing may not be configured yet - silently ignore
    } finally {
      setLoadingConversationPricing(false);
    }
  };

  const startEditConversationPrice = (pricing) => {
    setEditingConversationPlan(pricing.plan_id);
    setConversationEditForm({
      price_per_block: (pricing.price_per_block || 0).toString(),
      block_size: pricing.block_size || 100,
      is_enabled: pricing.is_enabled
    });
  };

  const cancelEditConversationPrice = () => {
    setEditingConversationPlan(null);
    setConversationEditForm({ price_per_block: '', block_size: 100, is_enabled: true });
  };

  const saveConversationPrice = async (planId) => {
    setSavingConversationPrice(true);
    try {
      await axios.patch(`${API}/quotas/conversation-pricing/${planId}`, {
        price_per_block: parseFloat(conversationEditForm.price_per_block) || 0,
        block_size: parseInt(conversationEditForm.block_size) || 100,
        is_enabled: conversationEditForm.is_enabled
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      toast.success('Conversation pricing updated successfully');
      setEditingConversationPlan(null);
      loadConversationPricing();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save conversation pricing');
    } finally {
      setSavingConversationPrice(false);
    }
  };

  const syncConversationPricingToStripe = async (planId) => {
    setSyncingConversationPricing(planId);
    try {
      await axios.post(`${API}/quotas/conversation-pricing/${planId}/sync-stripe`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Conversation pricing synced to Stripe successfully!');
      loadConversationPricing();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync to Stripe.');
    } finally {
      setSyncingConversationPricing(null);
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="quotas" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Plan Limits
          </TabsTrigger>
          <TabsTrigger value="seat-pricing" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Seat Pricing
          </TabsTrigger>
          <TabsTrigger value="agent-pricing" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agent Pricing
          </TabsTrigger>
          <TabsTrigger value="conversation-pricing" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversation Pricing
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
          <ResourcePricingSection
            resourceType="seat"
            pricingData={seatPricing}
            loading={loadingSeatPricing}
            editingPlanId={editingPlan}
            editForm={editForm}
            setEditForm={setEditForm}
            isSaving={savingSeatPrice}
            syncingPlanId={syncingSeatPricing}
            onRefresh={loadSeatPricing}
            onStartEdit={startEditSeatPrice}
            onCancelEdit={cancelEditSeatPrice}
            onSave={saveSeatPrice}
            onSyncToStripe={syncSeatPricingToStripe}
          />
        </TabsContent>

        {/* Agent Pricing Tab */}
        <TabsContent value="agent-pricing">
          <ResourcePricingSection
            resourceType="agent"
            pricingData={agentPricing}
            loading={loadingAgentPricing}
            editingPlanId={editingAgentPlan}
            editForm={agentEditForm}
            setEditForm={setAgentEditForm}
            isSaving={savingAgentPrice}
            syncingPlanId={syncingAgentPricing}
            onRefresh={loadAgentPricing}
            onStartEdit={startEditAgentPrice}
            onCancelEdit={cancelEditAgentPrice}
            onSave={saveAgentPrice}
            onSyncToStripe={syncAgentPricingToStripe}
          />
        </TabsContent>

        {/* Conversation Pricing Tab */}
        <TabsContent value="conversation-pricing">
          <ResourcePricingSection
            resourceType="conversation"
            pricingData={conversationPricing}
            loading={loadingConversationPricing}
            editingPlanId={editingConversationPlan}
            editForm={conversationEditForm}
            setEditForm={setConversationEditForm}
            isSaving={savingConversationPrice}
            syncingPlanId={syncingConversationPricing}
            onRefresh={loadConversationPricing}
            onStartEdit={startEditConversationPrice}
            onCancelEdit={cancelEditConversationPrice}
            onSave={saveConversationPrice}
            onSyncToStripe={syncConversationPricingToStripe}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeatureGatesAdmin;
