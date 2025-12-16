import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Loader2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  ArrowUpRight,
  Users,
  Bot,
  FileText,
  MessageSquare,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const QuotaUsageDashboard = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);

  useEffect(() => {
    loadQuotaUsage();
  }, [token]);

  const loadQuotaUsage = async () => {
    setLoading(true);
    try {
      const [usageRes, subRes] = await Promise.all([
        axios.get(`${API}/quotas/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/feature-gates/user-plan`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setUsage(usageRes.data);
      setSubscription(subRes.data);
    } catch (error) {
      console.error('Error loading quota usage:', error);
      toast.error('Failed to load quota usage');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (featureKey) => {
    const icons = {
      max_agents: Bot,
      max_seats: Users,
      max_pages: FileText,
      monthly_messages: MessageSquare,
      monthly_token_limit: Zap
    };
    return icons[featureKey] || TrendingUp;
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 100) return 'text-red-500';
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 80) return 'text-amber-500';
    return 'text-green-500';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (percentage) => {
    if (percentage >= 100) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (percentage >= 80) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toLocaleString() || '0';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return null;
  }

  const criticalQuotas = usage.quotas?.filter(q => q.percentage >= 80 && q.limit !== null) || [];

  const handleUpgradeClick = (featureName = null) => {
    setSelectedFeature(featureName);
    setUpgradeModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Alert for Critical Quotas */}
      {criticalQuotas.length > 0 && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {criticalQuotas.length} quota{criticalQuotas.length > 1 ? 's' : ''} near or at limit
              </span>
              <Button size="sm" variant="outline" onClick={() => handleUpgradeClick()}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Upgrade Modal */}
      <UpgradePlanModal 
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        feature={selectedFeature}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading">Resource Usage</CardTitle>
              <CardDescription>
                Current plan: <span className="font-semibold">{subscription?.plan_display_name}</span>
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadQuotaUsage}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {usage.quotas?.map((quota) => {
            const Icon = getIcon(quota.feature_key);
            const percentage = quota.percentage || 0;
            const isUnlimited = quota.limit === null;
            
            return (
              <div key={quota.feature_key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{quota.feature_name}</span>
                    {quota.warning_level && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          quota.warning_level === 'critical' && "border-red-500 text-red-500",
                          quota.warning_level === 'warning' && "border-amber-500 text-amber-500"
                        )}
                      >
                        {quota.warning_level === 'critical' ? 'At Limit' : 'Near Limit'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(percentage)}
                    <span className={cn("text-sm font-medium", getUsageColor(percentage))}>
                      {isUnlimited ? (
                        `${formatNumber(quota.current)} / Unlimited`
                      ) : (
                        `${formatNumber(quota.current)} / ${formatNumber(quota.limit)} (${Math.round(percentage)}%)`
                      )}
                    </span>
                  </div>
                </div>
                
                {!isUnlimited && (
                  <div className="relative">
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className="h-2"
                    />
                    <div 
                      className={cn(
                        "absolute top-0 left-0 h-2 rounded-full transition-all",
                        getProgressColor(percentage)
                      )}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                )}
                
                {quota.extra_info && (
                  <p className="text-xs text-muted-foreground">
                    {quota.extra_info}
                  </p>
                )}
              </div>
            );
          })}

          {/* Extra Seats Info */}
          {subscription?.plan_name !== 'free' && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Need more resources?</p>
                  <p className="text-xs text-muted-foreground">
                    Purchase additional seats or upgrade your plan
                  </p>
                </div>
                <Button size="sm" onClick={() => handleUpgradeClick('seats')}>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Add Seats
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuotaUsageDashboard;
