import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Loader2, Save, RefreshCw, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FeatureGateAdmin = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [plans, setPlans] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

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
    } catch (error) {
      console.error('Error loading feature gates:', error);
      toast.error(error.response?.data?.detail || 'Failed to load feature gates');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChange = (routeIndex, planName, field, value) => {
    const newConfig = { ...config };
    const route = newConfig.routes[routeIndex];
    
    if (!route.plans[planName]) {
      route.plans[planName] = { enabled: false };
    }
    
    route.plans[planName][field] = value;
    
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/feature-gates/config`,
        { routes: config.routes },
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
      cms: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      conversations: 'bg-green-500/10 text-green-500 border-green-500/20',
      orchestration: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const filteredRoutes = config?.routes?.filter(route => 
    selectedCategory === 'all' || route.category === selectedCategory
  ) || [];

  if (loading) {
    return (
      <Card className="border border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-heading flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Feature Gate Configuration
            </CardTitle>
            <CardDescription>
              Control API access and limits for each subscription plan
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
                <th className="text-left p-4 font-semibold bg-muted/50">
                  Route / Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.name}
                    className="text-center p-4 font-semibold bg-muted/50 min-w-[200px]"
                  >
                    <div>{plan.display_name}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {plan.description}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map((route, routeIndex) => {
                const actualIndex = config.routes.findIndex(r => r.route_path === route.route_path);
                
                return (
                  <tr key={route.route_path} className="border-b hover:bg-muted/30">
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="font-medium">{route.route_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {route.route_description}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={getCategoryBadgeColor(route.category)}>
                            {route.category}
                          </Badge>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {route.route_method} {route.route_path}
                          </code>
                        </div>
                      </div>
                    </td>

                    {plans.map((plan) => {
                      const limits = route.plans[plan.name] || { enabled: false };
                      
                      return (
                        <td key={plan.name} className="p-4 text-center border-l">
                          <div className="space-y-3">
                            {/* Enabled Toggle */}
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={limits.enabled || false}
                                onCheckedChange={(checked) =>
                                  handleToggleChange(actualIndex, plan.name, 'enabled', checked)
                                }
                              />
                              <span className="text-sm">
                                {limits.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>

                            {/* Limits (only show if enabled) */}
                            {limits.enabled && (
                              <div className="space-y-2 text-left">
                                {/* Rate Limit Per Hour */}
                                <div>
                                  <label className="text-xs text-muted-foreground">
                                    Rate/Hour
                                  </label>
                                  <Input
                                    type="number"
                                    value={limits.rate_limit_per_hour || ''}
                                    onChange={(e) =>
                                      handleToggleChange(
                                        actualIndex,
                                        plan.name,
                                        'rate_limit_per_hour',
                                        e.target.value ? parseInt(e.target.value) : null
                                      )
                                    }
                                    placeholder="Unlimited"
                                    className="h-8 text-sm"
                                    min="0"
                                  />
                                </div>

                                {/* Rate Limit Per Day */}
                                <div>
                                  <label className="text-xs text-muted-foreground">
                                    Rate/Day
                                  </label>
                                  <Input
                                    type="number"
                                    value={limits.rate_limit_per_day || ''}
                                    onChange={(e) =>
                                      handleToggleChange(
                                        actualIndex,
                                        plan.name,
                                        'rate_limit_per_day',
                                        e.target.value ? parseInt(e.target.value) : null
                                      )
                                    }
                                    placeholder="Unlimited"
                                    className="h-8 text-sm"
                                    min="0"
                                  />
                                </div>

                                {/* Quota Limit */}
                                <div>
                                  <label className="text-xs text-muted-foreground">
                                    Quota
                                  </label>
                                  <Input
                                    type="number"
                                    value={limits.quota_limit || ''}
                                    onChange={(e) =>
                                      handleToggleChange(
                                        actualIndex,
                                        plan.name,
                                        'quota_limit',
                                        e.target.value ? parseInt(e.target.value) : null
                                      )
                                    }
                                    placeholder="Unlimited"
                                    className="h-8 text-sm"
                                    min="0"
                                  />
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

        {filteredRoutes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No routes found for the selected category
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeatureGateAdmin;
