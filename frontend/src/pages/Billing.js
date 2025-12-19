import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import { CreditCard, AlertTriangle, CheckCircle, Loader2, TrendingUp, Receipt, ExternalLink, Download, Clock, XCircle, Users, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { Slider } from '../components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Billing = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [seatUsage, setSeatUsage] = useState({ current: 0, limit: 0, extraSeats: 0 });
  
  // Seat allocation state
  const [seatAllocation, setSeatAllocation] = useState(null);
  const [seatSliderValue, setSeatSliderValue] = useState(0);
  const [savingSeats, setSavingSeats] = useState(false);
  const [seatUnsavedChanges, setSeatUnsavedChanges] = useState(false);
  
  // Agent allocation state
  const [agentAllocation, setAgentAllocation] = useState(null);
  const [agentSliderValue, setAgentSliderValue] = useState(0);
  const [savingAgents, setSavingAgents] = useState(false);
  const [agentUnsavedChanges, setAgentUnsavedChanges] = useState(false);
  
  // Conversation allocation state
  const [conversationAllocation, setConversationAllocation] = useState(null);
  const [conversationSliderValue, setConversationSliderValue] = useState(0);
  const [savingConversations, setSavingConversations] = useState(false);
  const [conversationUnsavedChanges, setConversationUnsavedChanges] = useState(false);
  
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const handleStripeReturn = async () => {
      // Handle redirect from Stripe
      if (searchParams.get('success') === 'true') {
        // Get session_id from localStorage
        const sessionId = localStorage.getItem('stripe_session_id');
        console.log('Stripe return detected. Session ID:', sessionId);
        
        if (sessionId) {
          try {
            console.log('Calling verify-checkout endpoint...');
            // Verify and activate subscription
            const response = await axios.post(
              `${API}/subscriptions/verify-checkout`,
              null,
              {
                headers: { Authorization: `Bearer ${token}` },
                params: { session_id: sessionId }
              }
            );
            console.log('Verify response:', response.data);
            
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
      const [subRes, usageRes, quotaRes] = await Promise.all([
        axios.get(`${API}/subscriptions/current`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/subscriptions/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/quotas/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: null }))
      ]);
      
      setSubscription(subRes.data);
      setUsage(usageRes.data);
      
      // Extract seat usage from quota response
      if (quotaRes.data) {
        const seatQuota = quotaRes.data.quotas?.find(q => q.feature_key === 'max_seats');
        if (seatQuota) {
          setSeatUsage({
            current: seatQuota.current || 0,
            limit: seatQuota.limit || 0,
            extraSeats: quotaRes.data.extra_seats || 0,
            percentage: seatQuota.percentage || 0
          });
        }
      }
      
      // Fetch invoices, allocations, and plans separately (non-blocking)
      fetchInvoices();
      fetchSeatAllocation();
      fetchAgentAllocation();
      fetchConversationAllocation();
      fetchPlans();
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const response = await axios.get(`${API}/subscriptions/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 10 }
      });
      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      // Don't show error toast for invoices - just silently fail
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchSeatAllocation = async () => {
    try {
      const response = await axios.get(`${API}/quotas/seats/allocation`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSeatAllocation(response.data);
      setSliderValue(response.data.current_seats);
    } catch (error) {
      console.error('Error fetching seat allocation:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/plans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlans(response.data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleSliderChange = (value) => {
    setSliderValue(value[0]);
    setHasUnsavedChanges(value[0] !== seatAllocation?.current_seats);
  };

  const saveSeatAllocation = async () => {
    if (!hasUnsavedChanges) return;
    
    setSavingSeats(true);
    try {
      const response = await axios.put(
        `${API}/quotas/seats/allocation`,
        { total_seats: sliderValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message);
      setHasUnsavedChanges(false);
      
      // Refresh seat allocation
      fetchSeatAllocation();
    } catch (error) {
      console.error('Error saving seat allocation:', error);
      toast.error(error.response?.data?.detail || 'Failed to update seats');
    } finally {
      setSavingSeats(false);
    }
  };

  const formatTimeRemaining = (isoString) => {
    if (!isoString) return '';
    const end = new Date(isoString);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  // Check if upgrading to a higher plan would be cheaper
  const getUpgradeRecommendation = () => {
    if (!seatAllocation || !subscription || !plans.length) return null;
    
    const currentPlanName = subscription.plan_name?.toLowerCase();
    const currentPlan = plans.find(p => p.name?.toLowerCase() === currentPlanName);
    
    if (!currentPlan) return null;
    
    // Get current total cost from backend
    const currentTotalCost = seatAllocation.total_monthly_cost || 
      ((seatAllocation.plan_monthly_price || 0) + seatAllocation.additional_seats_cost);
    
    // Only show recommendation if there are extra seat costs
    if (seatAllocation.additional_seats_cost <= 0) return null;
    
    // Find higher plans that would be cheaper
    const higherPlans = plans.filter(p => {
      const planPrice = p.price_monthly || 0;
      // Must be a paid plan with higher base price
      return planPrice > (currentPlan.price_monthly || 0);
    }).sort((a, b) => (a.price_monthly || 0) - (b.price_monthly || 0)); // Sort by price ascending
    
    for (const plan of higherPlans) {
      // Estimate base seats for higher plans
      const estimatedBaseSeats = plan.name?.toLowerCase() === 'professional' ? 25 : 
                                  plan.name?.toLowerCase() === 'enterprise' ? 100 :
                                  plan.name?.toLowerCase() === 'starter' ? 5 : 1;
      
      // If the higher plan includes enough seats for committed count
      if (estimatedBaseSeats >= seatAllocation.committed_seats) {
        const upgradeCost = plan.price_monthly || 0;
        const savings = currentTotalCost - upgradeCost;
        
        if (savings > 0) {
          return {
            planName: plan.name,
            planPrice: upgradeCost,
            currentTotal: currentTotalCost,
            savings: savings,
            baseSeats: estimatedBaseSeats
          };
        }
      }
    }
    
    return null;
  };

  const upgradeRecommendation = getUpgradeRecommendation();

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

  const getInvoiceStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case 'open':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
      case 'draft':
        return (
          <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">
            Draft
          </Badge>
        );
      case 'uncollectible':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Uncollectible
          </Badge>
        );
      case 'void':
        return (
          <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">
            Void
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">{status}</Badge>
        );
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
  const seatUsagePercent = seatUsage.percentage || 0;
  const maxUsagePercent = Math.max(conversationUsagePercent, agentUsagePercent, seatUsagePercent);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
          <CreditCard className="h-6 w-6 sm:h-8 sm:w-8" />
          Billing & Subscription
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
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
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold">{subscription?.plan_name || 'Free'}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {subscription?.billing_cycle === 'yearly' ? 'Annual billing' : 'Monthly billing'}
              </p>
              {subscription?.trial_end && new Date(subscription.trial_end) > new Date() && (
                <Badge variant="outline" className="mt-2 border-blue-500 text-blue-500">
                  Trial until {new Date(subscription.trial_end).toLocaleDateString()}
                </Badge>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-xs sm:text-sm text-muted-foreground">Next billing date</p>
              <p className="font-semibold text-sm sm:text-base">
                {subscription?.current_period_end 
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Usage This Period</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
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

            {/* Seats */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Active Seats
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {seatUsage.current} / {seatUsage.limit || '∞'}
                    {seatUsage.extraSeats > 0 && (
                      <span className="ml-1 text-primary">
                        (+{seatUsage.extraSeats} purchased)
                      </span>
                    )}
                  </p>
                </div>
                <span className={cn("font-semibold", getUsageTextColor(seatUsagePercent))}>
                  {seatUsagePercent.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={seatUsagePercent}
                className="h-2"
              />
            </div>

            {/* Features */}
            <div className="pt-4 border-t border-border">
              <p className="font-medium mb-3 text-sm sm:text-base">Plan Features</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
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

      {/* Invoice History */}
      <Card className="border border-border">
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                Invoice History
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Your recent payment history and invoices
              </CardDescription>
            </div>
            {invoices.length > 0 && (
              <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loadingInvoices}>
                {loadingInvoices ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingInvoices && invoices.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No invoices yet</p>
              <p className="text-sm mt-1">Your payment history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop Table Header - Hidden on mobile */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                <div className="col-span-3">Invoice</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              
              {/* Invoice Items */}
              {invoices.map((invoice) => (
                <div key={invoice.id}>
                  {/* Desktop Row - Hidden on mobile */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 items-center rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="col-span-3">
                      <p className="font-medium text-sm">{invoice.number || 'Draft'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {invoice.description || 'Subscription'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm">{formatDate(invoice.created_at)}</p>
                      {invoice.paid_at && invoice.status === 'paid' && (
                        <p className="text-xs text-muted-foreground">
                          Paid: {formatDate(invoice.paid_at)}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="font-medium text-sm">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      {getInvoiceStatusBadge(invoice.status)}
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-2">
                      {invoice.invoice_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(invoice.invoice_url, '_blank')}
                          title="View Invoice"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {invoice.pdf_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(invoice.pdf_url, '_blank')}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Card - Visible only on mobile */}
                  <div className="md:hidden p-4 rounded-lg border border-border space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{invoice.number || 'Draft'}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.description || 'Subscription'}
                        </p>
                      </div>
                      {getInvoiceStatusBadge(invoice.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatDate(invoice.created_at)}</span>
                      <span className="font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-border">
                      {invoice.invoice_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(invoice.invoice_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      )}
                      {invoice.pdf_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(invoice.pdf_url, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seat Management - Only for paid plans */}
      {seatAllocation && subscription?.plan_name?.toLowerCase() !== 'free' && (
        <Card className="border border-border">
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                  Seat Management
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Adjust the number of seats for your team
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-sm">
                      <strong>Billing Rules:</strong><br />
                      • Increases are locked in after 24 hours<br />
                      • Decreases apply but you&apos;re billed for the highest committed amount<br />
                      • Within 24hr grace period, you can undo increases
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Status - Inline layout */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Base:</span>
                  <span className="text-base sm:text-lg font-bold">{seatAllocation.base_plan_seats}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Current:</span>
                  <span className="text-base sm:text-lg font-bold text-green-500">{seatAllocation.current_seats}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Committed:</span>
                  <span className="text-base sm:text-lg font-bold text-blue-500">{seatAllocation.committed_seats}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">Total/Month:</span>
                <span className="text-base sm:text-lg font-bold">
                  ${(seatAllocation.total_monthly_cost || (seatAllocation.plan_monthly_price || 0) + seatAllocation.additional_seats_cost).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Upgrade Recommendation */}
            {upgradeRecommendation && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  <strong>Save money!</strong> Upgrade to <strong>{upgradeRecommendation.planName}</strong> for ${upgradeRecommendation.planPrice}/month 
                  and get {upgradeRecommendation.baseSeats} seats included. You&apos;d save <strong>${upgradeRecommendation.savings.toFixed(2)}/month</strong> compared to your current total of ${upgradeRecommendation.currentTotal.toFixed(2)}/month.
                  <Button 
                    variant="link" 
                    className="p-0 h-auto ml-2 text-green-600 underline"
                    onClick={handleUpgrade}
                  >
                    View Plans
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Grace Period Alert */}
            {seatAllocation.is_in_grace_period && (
              <Alert className="bg-blue-500/10 border-blue-500/30">
                <Clock className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  <strong>Grace Period Active:</strong> You can undo your recent increase without penalty.{' '}
                  <span className="font-medium">{formatTimeRemaining(seatAllocation.grace_period_ends_at)}</span>
                </AlertDescription>
              </Alert>
            )}

            {/* Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Seats</span>
                <span className="text-lg font-bold">{sliderValue}</span>
              </div>
              
              <Slider
                value={[sliderValue]}
                onValueChange={handleSliderChange}
                min={seatAllocation.base_plan_seats}
                max={seatAllocation.max_seats}
                step={1}
                className="w-full"
              />
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{seatAllocation.base_plan_seats} (Base)</span>
                <span>{seatAllocation.max_seats} (Max)</span>
              </div>
            </div>

            {/* Cost Breakdown */}
            {sliderValue > seatAllocation.base_plan_seats && (
              <div className="p-4 border border-border rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Additional seats</span>
                  <span>{sliderValue - seatAllocation.base_plan_seats} × ${seatAllocation.price_per_seat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Extra monthly cost</span>
                  <span>${((sliderValue - seatAllocation.base_plan_seats) * seatAllocation.price_per_seat).toFixed(2)}</span>
                </div>
                {sliderValue !== seatAllocation.committed_seats && sliderValue < seatAllocation.committed_seats && !seatAllocation.is_in_grace_period && (
                  <p className="text-xs text-amber-600 mt-2">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Note: You&apos;ll still be billed for {seatAllocation.committed_seats} seats (your committed amount) at renewal.
                  </p>
                )}
              </div>
            )}

            {/* Save Button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={saveSeatAllocation}
                disabled={!hasUnsavedChanges || savingSeats}
                className="flex-1"
              >
                {savingSeats ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
              </Button>
              {hasUnsavedChanges && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSliderValue(seatAllocation.current_seats);
                    setHasUnsavedChanges(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Billing;
