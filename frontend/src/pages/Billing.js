import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { CreditCard, AlertTriangle, CheckCircle, Loader2, TrendingUp, Tag, X } from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Billing = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    const handleStripeReturn = async () => {
      // Handle redirect from Stripe
      if (searchParams.get('success') === 'true') {
        // Get session_id from localStorage
        const sessionId = localStorage.getItem('stripe_session_id');
        
        if (sessionId) {
          try {
            // Verify and activate subscription
            const response = await axios.post(
              `${API}/subscriptions/verify-checkout`,
              null,
              {
                headers: { Authorization: `Bearer ${token}` },
                params: { session_id: sessionId }
              }
            );
            
            if (response.data.status === 'active') {
              toast.success('Payment successful! Your subscription is now active.');
              localStorage.removeItem('stripe_session_id'); // Clean up
            } else {
              toast.info('Payment received. Activating your subscription...');
            }
          } catch (error) {
            console.error('Error verifying checkout:', error);
            const errorDetail = error.response?.data?.detail || error.message;
            console.error('Error detail:', errorDetail);
            toast.error(`Subscription activation failed: ${errorDetail}`, {
              description: 'Please contact support if the issue persists.'
            });
          }
        } else {
          toast.success('Payment successful! Your subscription is now active.');
        }
      } else if (searchParams.get('canceled') === 'true') {
        toast.error('Payment canceled. You can try again anytime.');
        localStorage.removeItem('stripe_session_id'); // Clean up
      }
      
      // Fetch data after handling return
      fetchData();
    };
    
    handleStripeReturn();
  }, [token, searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, usageRes] = await Promise.all([
        axios.get(`${API}/subscriptions/current`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/subscriptions/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setSubscription(subRes.data);
      setUsage(usageRes.data);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate('/dashboard/pricing');
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free plan.')) {
      return;
    }

    try {
      await axios.post(`${API}/subscriptions/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Subscription canceled. You have been moved to the Free plan.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel subscription');
    }
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getUsageTextColor = (percentage) => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 75) return 'text-amber-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const conversationUsagePercent = usage?.usage_percentage?.conversations || 0;
  const agentUsagePercent = usage?.usage_percentage?.agents || 0;
  const maxUsagePercent = Math.max(conversationUsagePercent, agentUsagePercent);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CreditCard className="h-8 w-8" />
          Billing & Subscription
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription and monitor usage
        </p>
      </div>

      {/* Soft Limit Warning */}
      {maxUsagePercent >= 90 && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-500">
            <strong>Usage Warning:</strong> You're approaching your plan limits. Consider upgrading to avoid interruptions.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card className="border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active subscription</CardDescription>
            </div>
            {subscription?.status === 'active' && (
              <Badge className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{subscription?.plan_name || 'Free'}</h3>
              <p className="text-muted-foreground mt-1">
                {subscription?.billing_cycle === 'yearly' ? 'Annual billing' : 'Monthly billing'}
              </p>
              {subscription?.trial_end && new Date(subscription.trial_end) > new Date() && (
                <Badge variant="outline" className="mt-2 border-blue-500 text-blue-500">
                  Trial until {new Date(subscription.trial_end).toLocaleDateString()}
                </Badge>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Next billing date</p>
              <p className="font-semibold">
                {subscription?.current_period_end 
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleUpgrade} className="flex-1">
              <TrendingUp className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
            {subscription?.plan_name !== 'Free' && subscription?.stripe_subscription_id && (
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      {usage && (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>Usage This Period</CardTitle>
            <CardDescription>
              Period: {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Conversations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">Conversations</p>
                  <p className="text-sm text-muted-foreground">
                    {usage.conversations_used} / {usage.limits?.max_conversations || '∞'}
                  </p>
                </div>
                <span className={cn("font-semibold", getUsageTextColor(conversationUsagePercent))}>
                  {conversationUsagePercent.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={conversationUsagePercent}
                className="h-2"
              />
            </div>

            {/* Agents */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium">Active Agents</p>
                  <p className="text-sm text-muted-foreground">
                    {usage.agents_created} / {usage.limits?.max_agents || '∞'}
                  </p>
                </div>
                <span className={cn("font-semibold", getUsageTextColor(agentUsagePercent))}>
                  {agentUsagePercent.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={agentUsagePercent}
                className="h-2"
              />
            </div>

            {/* Features */}
            <div className="pt-4 border-t border-border">
              <p className="font-medium mb-3">Plan Features</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  {usage.limits?.analytics_enabled ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span>Analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  {usage.limits?.api_access ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span>API Access</span>
                </div>
                <div className="flex items-center gap-2">
                  {usage.limits?.remove_branding ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span>Remove Branding</span>
                </div>
                <div className="flex items-center gap-2">
                  {usage.limits?.custom_integrations ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span>Custom Integrations</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Billing;
