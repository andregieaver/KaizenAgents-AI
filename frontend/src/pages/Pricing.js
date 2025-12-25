import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Check, Loader2, Sparkles, Zap, Crown, ArrowRight, MessageSquare, Moon, Sun, Tag, X, Users, CreditCard, Bot, Info, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { Slider } from '../components/ui/slider';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { ResourceAllocationCard } from '../components/pricing';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Pricing = () => {
  const { token, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isYearly, setIsYearly] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [platformName, setPlatformName] = useState('AI Support Hub');
  const [platformLogo, setPlatformLogo] = useState(null);
  
  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [discountPlanId, setDiscountPlanId] = useState(null);
  
  // Extra seats state (legacy)
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [purchasingSeats, setPurchasingSeats] = useState(false);
  const [seatPricingConfig, setSeatPricingConfig] = useState(null);
  const [loadingSeatConfig, setLoadingSeatConfig] = useState(false);
  const pricePerSeat = seatPricingConfig?.price_per_seat_monthly || 5.0;

  // Allocation Management State
  const [seatAllocation, setSeatAllocation] = useState(null);
  const [seatSliderValue, setSeatSliderValue] = useState(0);
  const [seatUnsavedChanges, setSeatUnsavedChanges] = useState(false);
  const [savingSeats, setSavingSeats] = useState(false);

  const [agentAllocation, setAgentAllocation] = useState(null);
  const [agentSliderValue, setAgentSliderValue] = useState(0);
  const [agentUnsavedChanges, setAgentUnsavedChanges] = useState(false);
  const [savingAgents, setSavingAgents] = useState(false);

  const [conversationAllocation, setConversationAllocation] = useState(null);
  const [conversationSliderValue, setConversationSliderValue] = useState(0);
  const [conversationUnsavedChanges, setConversationUnsavedChanges] = useState(false);
  const [savingConversations, setSavingConversations] = useState(false);

  useEffect(() => {
    fetchData();
    fetchPlatformInfo();
    fetchAllocations();
    
    // Check for pending discount code from public pricing page
    const pendingCode = localStorage.getItem('pendingDiscountCode');
    const pendingPlanId = localStorage.getItem('pendingPlanId');
    
    if (pendingCode) {
      setDiscountCode(pendingCode);
      // Clear localStorage after reading
      localStorage.removeItem('pendingDiscountCode');
      localStorage.removeItem('pendingPlanId');
      
      // Auto-apply discount if authenticated and plan ID is available
      if (token && pendingPlanId) {
        setDiscountPlanId(pendingPlanId);
        // Delay to ensure plans are loaded
        setTimeout(() => {
          handleApplyDiscountFromStorage(pendingCode, pendingPlanId);
        }, 1000);
      }
    }
  }, [token]);

  const fetchPlatformInfo = async () => {
    try {
      const response = await axios.get(`${API}/public/platform-info`);
      if (response.data?.platform_name) {
        setPlatformName(response.data.platform_name);
      }
      if (response.data?.platform_logo) {
        setPlatformLogo(response.data.platform_logo);
      }
    } catch (error) {
      console.debug('Could not fetch platform info, using defaults');
    }
  };

  const getPlatformLogoSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('/api/')) {
      return `${process.env.REACT_APP_BACKEND_URL}${url}`;
    }
    return url;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch plans - works without auth too
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const plansRes = await axios.get(`${API}/subscriptions/plans`, { headers });
      setPlans(plansRes.data);
      
      // Only fetch subscription if authenticated
      if (token) {
        try {
          const subRes = await axios.get(`${API}/subscriptions/current`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCurrentSubscription(subRes.data);
          
          // Fetch seat pricing config for current plan
          if (subRes.data?.plan_id) {
            fetchSeatPricingConfig(subRes.data.plan_id);
          }
        } catch (err) {
          setCurrentSubscription(null);
        }
      }
    } catch (error) {
      toast.error('Failed to load pricing information');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeatPricingConfig = async (planId) => {
    if (!token || !planId) return;
    
    setLoadingSeatConfig(true);
    try {
      const response = await axios.get(`${API}/quotas/seat-pricing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Find pricing config for the current plan
      const allPricing = response.data || [];
      const currentPlanPricing = allPricing.find(p => p.plan_id === planId);
      setSeatPricingConfig(currentPlanPricing || null);
    } catch (error) {
      setSeatPricingConfig(null);
    } finally {
      setLoadingSeatConfig(false);
    }
  };

  // Fetch allocation data for management sections
  const fetchAllocations = async () => {
    if (!token) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch all allocations in parallel
      const [seatRes, agentRes, convRes] = await Promise.all([
        axios.get(`${API}/quotas/seats/allocation`, { headers }).catch(() => null),
        axios.get(`${API}/quotas/agents/allocation`, { headers }).catch(() => null),
        axios.get(`${API}/quotas/conversations/allocation`, { headers }).catch(() => null)
      ]);

      if (seatRes?.data) {
        setSeatAllocation(seatRes.data);
        setSeatSliderValue(seatRes.data.current_seats);
      }
      if (agentRes?.data) {
        setAgentAllocation(agentRes.data);
        setAgentSliderValue(agentRes.data.current_agents);
      }
      if (convRes?.data) {
        setConversationAllocation(convRes.data);
        setConversationSliderValue(convRes.data.current_conversations);
      }
    } catch (error) {
    }
  };

  // Slider change handlers
  const handleSeatSliderChange = (value) => {
    setSeatSliderValue(value[0]);
    setSeatUnsavedChanges(value[0] !== seatAllocation?.current_seats);
  };

  const handleAgentSliderChange = (value) => {
    setAgentSliderValue(value[0]);
    setAgentUnsavedChanges(value[0] !== agentAllocation?.current_agents);
  };

  const handleConversationSliderChange = (value) => {
    setConversationSliderValue(value[0]);
    setConversationUnsavedChanges(value[0] !== conversationAllocation?.current_conversations);
  };

  // Save allocation functions
  const saveSeatAllocation = async () => {
    if (!seatAllocation || !seatUnsavedChanges) return;
    setSavingSeats(true);
    try {
      await axios.put(`${API}/quotas/seats/allocation`, 
        { total_seats: seatSliderValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Seat allocation updated successfully');
      await fetchAllocations();
      setSeatUnsavedChanges(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update seat allocation');
    } finally {
      setSavingSeats(false);
    }
  };

  const saveAgentAllocation = async () => {
    if (!agentAllocation || !agentUnsavedChanges) return;
    setSavingAgents(true);
    try {
      await axios.put(`${API}/quotas/agents/allocation`, 
        { total_agents: agentSliderValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Agent allocation updated successfully');
      await fetchAllocations();
      setAgentUnsavedChanges(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update agent allocation');
    } finally {
      setSavingAgents(false);
    }
  };

  const saveConversationAllocation = async () => {
    if (!conversationAllocation || !conversationUnsavedChanges) return;
    setSavingConversations(true);
    try {
      await axios.put(`${API}/quotas/conversations/allocation`, 
        { total_conversations: conversationSliderValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Conversation allocation updated successfully');
      await fetchAllocations();
      setConversationUnsavedChanges(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update conversation allocation');
    } finally {
      setSavingConversations(false);
    }
  };

  // Format time remaining for grace period
  const formatTimeRemaining = (isoString) => {
    if (!isoString) return '';
    const endTime = new Date(isoString);
    const now = new Date();
    const diff = endTime - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  // Helper to apply discount from localStorage (called on page load)
  const handleApplyDiscountFromStorage = async (code, planId) => {
    if (!code || !planId || !token) return;
    
    setApplyingDiscount(true);
    try {
      const response = await axios.post(
        `${API}/discounts/apply`,
        {
          code: code.toUpperCase(),
          plan_id: planId,
          billing_cycle: isYearly ? 'yearly' : 'monthly'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.valid) {
        setAppliedDiscount(response.data);
        setDiscountPlanId(planId);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleApplyDiscount = async (planId) => {
    if (!discountCode.trim()) {
      toast.error('Please enter a discount code');
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please sign in to apply a discount code');
      return;
    }

    setApplyingDiscount(true);
    try {
      const response = await axios.post(
        `${API}/discounts/apply`,
        {
          code: discountCode.toUpperCase(),
          plan_id: planId,
          billing_cycle: isYearly ? 'yearly' : 'monthly'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.valid) {
        setAppliedDiscount(response.data);
        setDiscountPlanId(planId);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
        setAppliedDiscount(null);
        setDiscountPlanId(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply discount code');
      setAppliedDiscount(null);
      setDiscountPlanId(null);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const clearDiscount = () => {
    setDiscountCode('');
    setAppliedDiscount(null);
    setDiscountPlanId(null);
  };

  const handleSelectPlan = async (plan) => {
    // If not authenticated, redirect to register
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }

    // If it's the free plan, subscribe directly
    if (plan.price_monthly === 0) {
      try {
        setCheckoutLoading(plan.id);
        await axios.post(
          `${API}/subscriptions/subscribe`,
          { plan_id: plan.id, billing_cycle: 'monthly' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Successfully subscribed to Free plan!');
        navigate('/dashboard/billing');
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to subscribe');
      } finally {
        setCheckoutLoading(null);
      }
      return;
    }

    // For paid plans, create checkout session
    try {
      setCheckoutLoading(plan.id);
      
      // Include discount code if applied for this plan
      const payload = { 
        plan_id: plan.id, 
        billing_cycle: isYearly ? 'yearly' : 'monthly'
      };
      
      if (appliedDiscount && discountPlanId === plan.id) {
        payload.discount_code = discountCode.toUpperCase();
      }
      
      const response = await axios.post(
        `${API}/subscriptions/checkout`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.checkout_url && response.data.session_id) {
        // Store session_id in localStorage before redirecting
        localStorage.setItem('stripe_session_id', response.data.session_id);
        
        // Redirect to Stripe checkout
        window.location.href = response.data.checkout_url;
      } else {
        toast.error('Could not create checkout session');
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.includes('not configured')) {
        toast.error('Payment system is not configured. Please contact support.');
      } else {
        toast.error(detail || 'Failed to create checkout session');
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getPlanIcon = (planName) => {
    const name = planName?.toLowerCase() || '';
    if (name.includes('enterprise') || name.includes('premium')) {
      return <Crown className="h-6 w-6" />;
    }
    if (name.includes('pro') || name.includes('business')) {
      return <Zap className="h-6 w-6" />;
    }
    if (name.includes('starter')) {
      return <Sparkles className="h-6 w-6" />;
    }
    return null;
  };

  const getPrice = (plan) => {
    if (plan.price_monthly === 0) return 'Free';
    const price = isYearly 
      ? (plan.price_yearly / 12).toFixed(0) 
      : plan.price_monthly;
    return `$${price}`;
  };

  const isCurrentPlan = (planId) => {
    return currentSubscription?.plan_id === planId;
  };

  const isUpgrade = (plan) => {
    if (!currentSubscription) return true;
    const currentPlan = plans.find(p => p.id === currentSubscription.plan_id);
    if (!currentPlan) return true;
    return plan.price_monthly > currentPlan.price_monthly;
  };

  const handlePurchaseSeats = async () => {
    if (seatQuantity < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setPurchasingSeats(true);
    try {
      const response = await axios.post(
        `${API}/quotas/extra-seats/purchase`,
        { 
          quantity: seatQuantity,
          payment_method: 'stripe'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message || `Successfully purchased ${seatQuantity} seat${seatQuantity > 1 ? 's' : ''}!`);
      setSeatQuantity(1); // Reset quantity
      
      // Reload subscription data
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to purchase seats');
    } finally {
      setPurchasingSeats(false);
    }
  };

  const isFreePlan = () => {
    if (!currentSubscription) return true;
    const currentPlan = plans.find(p => p.id === currentSubscription.plan_id);
    return currentPlan?.price_monthly === 0;
  };

  // Check if seat purchasing is enabled for the current plan
  const isSeatPurchaseEnabled = () => {
    // If on free plan, seats are not available
    if (isFreePlan()) return false;
    
    // If no seat pricing config found, default to showing the section
    if (!seatPricingConfig) return true;
    
    // Check if seat purchasing is enabled for this plan
    return seatPricingConfig.is_enabled === true;
  };

  const getButtonText = (plan, isCurrent) => {
    if (checkoutLoading === plan.id) {
      return (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </>
      );
    }
    
    if (!isAuthenticated) {
      return (
        <>
          Get Started
          <ArrowRight className="h-4 w-4 ml-2" />
        </>
      );
    }
    
    if (isCurrent) {
      return 'Current Plan';
    }
    
    if (isUpgrade(plan)) {
      return (
        <>
          Upgrade
          <ArrowRight className="h-4 w-4 ml-2" />
        </>
      );
    }
    
    return 'Select Plan';
  };

  // Show standalone page when not in dashboard
  const isStandalone = !window.location.pathname.includes('/dashboard');

  if (loading) {
    return (
      <div className={cn(
        "flex items-center justify-center",
        isStandalone ? "min-h-screen bg-background" : "h-[400px]"
      )}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = (
    <div className={cn("space-y-8", isStandalone ? "py-12 px-4" : "p-6")}>
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className={cn("font-bold mb-2", isStandalone ? "text-4xl" : "text-3xl")}>
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground">
          Scale your customer support with the right plan for your business
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3">
        <Label className={cn(!isYearly && 'font-semibold')}>Monthly</Label>
        <Switch
          checked={isYearly}
          onCheckedChange={setIsYearly}
        />
        <Label className={cn(isYearly && 'font-semibold')}>
          Yearly
          <Badge variant="secondary" className="ml-2 text-xs">
            Save 20%
          </Badge>
        </Label>
      </div>

      {/* Plans Grid */}
      <div className="flex flex-wrap gap-6 justify-center max-w-7xl mx-auto">
        {plans.map((plan, index) => {
          const isCurrent = isCurrentPlan(plan.id);
          const isPopular = index === 1 && plans.length > 1;
          
          return (
            <Card 
              key={plan.id} 
              className={cn(
                "relative flex flex-col border w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[280px]",
                isPopular && "border-primary shadow-lg",
                isCurrent && "bg-primary/5"
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2 text-primary">
                  {getPlanIcon(plan.name)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                {/* Price */}
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">
                      {getPrice(plan)}
                    </span>
                    {plan.price_monthly > 0 && (
                      <span className="text-muted-foreground">/mo</span>
                    )}
                  </div>
                  {isYearly && plan.price_yearly > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ${plan.price_yearly} billed yearly
                    </p>
                  )}
                </div>

                {/* Features - Only show custom items */}
                <div className="space-y-3">
                  {plan.features.custom_items && plan.features.custom_items.length > 0 ? (
                    plan.features.custom_items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      Contact us for details
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                {/* Discount Code Input - Only for paid plans */}
                {plan.price_monthly > 0 && !isCurrent && (
                  <div className="w-full">
                    {appliedDiscount && discountPlanId === plan.id ? (
                      <div className="flex items-center justify-between p-2 bg-green-500/10 border border-green-500/30 rounded-md">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 font-medium">
                            {appliedDiscount.message}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={clearDiscount}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Discount code"
                          value={discountPlanId === plan.id ? discountCode : ''}
                          onChange={(e) => {
                            setDiscountCode(e.target.value);
                            setDiscountPlanId(plan.id);
                          }}
                          className="h-8 text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => handleApplyDiscount(plan.id)}
                          disabled={applyingDiscount}
                        >
                          {applyingDiscount && discountPlanId === plan.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </Button>
                      </div>
                    )}
                    {/* Show discounted price */}
                    {appliedDiscount && discountPlanId === plan.id && appliedDiscount.discounted_price !== appliedDiscount.original_price && (
                      <div className="mt-2 text-center">
                        <span className="text-sm text-muted-foreground line-through">
                          ${appliedDiscount.original_price}
                        </span>
                        <span className="text-sm font-bold text-green-600 ml-2">
                          ${appliedDiscount.discounted_price}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : isPopular ? "default" : "outline"}
                  disabled={isCurrent || checkoutLoading === plan.id}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {getButtonText(plan, isCurrent)}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Resource Management Section - 3 Column Layout for Paid Plans */}
      {isAuthenticated && !isFreePlan() && (seatAllocation || agentAllocation || conversationAllocation) && (
        <div className="pt-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Manage Your Resources</h2>
            <p className="text-muted-foreground">Adjust seats, agents, and conversations for your team</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Seat Management */}
            {seatAllocation && (
              <Card className="border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Seats</CardTitle>
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
                            • Increases locked in after 24 hours<br />
                            • Billed for highest committed amount<br />
                            • 24hr grace period for undo
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                    <div><span className="text-muted-foreground">Base:</span> <span className="font-bold">{seatAllocation.base_plan_seats}</span></div>
                    <div><span className="text-muted-foreground">Current:</span> <span className="font-bold text-green-500">{seatAllocation.current_seats}</span></div>
                    <div><span className="text-muted-foreground">Committed:</span> <span className="font-bold text-blue-500">{seatAllocation.committed_seats}</span></div>
                  </div>

                  {/* Grace Period */}
                  {seatAllocation.is_in_grace_period && (
                    <Alert className="bg-blue-500/10 border-blue-500/30 py-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                        Grace: {formatTimeRemaining(seatAllocation.grace_period_ends_at)}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Seats</span>
                      <span className="text-lg font-bold">{seatSliderValue}</span>
                    </div>
                    <Slider
                      value={[seatSliderValue]}
                      onValueChange={handleSeatSliderChange}
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

                  {/* Cost */}
                  {seatSliderValue > seatAllocation.base_plan_seats && (
                    <div className="p-3 border border-border rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span>Extra: {seatSliderValue - seatAllocation.base_plan_seats} × ${seatAllocation.price_per_seat?.toFixed(2)}</span>
                        <span className="font-semibold">${((seatSliderValue - seatAllocation.base_plan_seats) * seatAllocation.price_per_seat).toFixed(2)}/mo</span>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex gap-2">
                    <Button onClick={saveSeatAllocation} disabled={!seatUnsavedChanges || savingSeats} className="flex-1" size="sm">
                      {savingSeats ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      {seatUnsavedChanges ? 'Save' : 'No Changes'}
                    </Button>
                    {seatUnsavedChanges && (
                      <Button variant="outline" size="sm" onClick={() => { setSeatSliderValue(seatAllocation.current_seats); setSeatUnsavedChanges(false); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agent Management */}
            {agentAllocation && (
              <Card className="border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Agents</CardTitle>
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
                            • Increases locked in after 24 hours<br />
                            • Billed for highest committed amount<br />
                            • 24hr grace period for undo
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                    <div><span className="text-muted-foreground">Base:</span> <span className="font-bold">{agentAllocation.base_plan_agents}</span></div>
                    <div><span className="text-muted-foreground">Current:</span> <span className="font-bold text-green-500">{agentAllocation.current_agents}</span></div>
                    <div><span className="text-muted-foreground">Committed:</span> <span className="font-bold text-blue-500">{agentAllocation.committed_agents}</span></div>
                  </div>

                  {/* Grace Period */}
                  {agentAllocation.is_in_grace_period && (
                    <Alert className="bg-blue-500/10 border-blue-500/30 py-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                        Grace: {formatTimeRemaining(agentAllocation.grace_period_ends_at)}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Agents</span>
                      <span className="text-lg font-bold">{agentSliderValue}</span>
                    </div>
                    <Slider
                      value={[agentSliderValue]}
                      onValueChange={handleAgentSliderChange}
                      min={agentAllocation.base_plan_agents}
                      max={agentAllocation.max_agents}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{agentAllocation.base_plan_agents} (Base)</span>
                      <span>{agentAllocation.max_agents} (Max)</span>
                    </div>
                  </div>

                  {/* Cost */}
                  {agentSliderValue > agentAllocation.base_plan_agents && (
                    <div className="p-3 border border-border rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span>Extra: {agentSliderValue - agentAllocation.base_plan_agents} × ${agentAllocation.price_per_agent?.toFixed(2)}</span>
                        <span className="font-semibold">${((agentSliderValue - agentAllocation.base_plan_agents) * agentAllocation.price_per_agent).toFixed(2)}/mo</span>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex gap-2">
                    <Button onClick={saveAgentAllocation} disabled={!agentUnsavedChanges || savingAgents} className="flex-1" size="sm">
                      {savingAgents ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      {agentUnsavedChanges ? 'Save' : 'No Changes'}
                    </Button>
                    {agentUnsavedChanges && (
                      <Button variant="outline" size="sm" onClick={() => { setAgentSliderValue(agentAllocation.current_agents); setAgentUnsavedChanges(false); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversation Management */}
            {conversationAllocation && (
              <Card className="border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Conversations</CardTitle>
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
                            • Billed in blocks of {conversationAllocation.block_size || 100}<br />
                            • Increases locked in after 24 hours<br />
                            • 24hr grace period for undo
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                    <div><span className="text-muted-foreground">Base:</span> <span className="font-bold">{conversationAllocation.base_plan_conversations}</span></div>
                    <div><span className="text-muted-foreground">Current:</span> <span className="font-bold text-green-500">{conversationAllocation.current_conversations}</span></div>
                    <div><span className="text-muted-foreground">Committed:</span> <span className="font-bold text-blue-500">{conversationAllocation.committed_conversations}</span></div>
                  </div>

                  {/* Grace Period */}
                  {conversationAllocation.is_in_grace_period && (
                    <Alert className="bg-blue-500/10 border-blue-500/30 py-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                        Grace: {formatTimeRemaining(conversationAllocation.grace_period_ends_at)}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Conversations</span>
                      <span className="text-lg font-bold">{conversationSliderValue}</span>
                    </div>
                    <Slider
                      value={[conversationSliderValue]}
                      onValueChange={handleConversationSliderChange}
                      min={conversationAllocation.base_plan_conversations}
                      max={conversationAllocation.max_conversations}
                      step={conversationAllocation.block_size || 100}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{conversationAllocation.base_plan_conversations} (Base)</span>
                      <span>{conversationAllocation.max_conversations} (Max)</span>
                    </div>
                  </div>

                  {/* Cost */}
                  {conversationSliderValue > conversationAllocation.base_plan_conversations && (
                    <div className="p-3 border border-border rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span>Extra: {Math.ceil((conversationSliderValue - conversationAllocation.base_plan_conversations) / (conversationAllocation.block_size || 100))} blocks × ${(conversationAllocation.price_per_block || 5).toFixed(2)}</span>
                        <span className="font-semibold">${(Math.ceil((conversationSliderValue - conversationAllocation.base_plan_conversations) / (conversationAllocation.block_size || 100)) * (conversationAllocation.price_per_block || 5)).toFixed(2)}/mo</span>
                      </div>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex gap-2">
                    <Button onClick={saveConversationAllocation} disabled={!conversationUnsavedChanges || savingConversations} className="flex-1" size="sm">
                      {savingConversations ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      {conversationUnsavedChanges ? 'Save' : 'No Changes'}
                    </Button>
                    {conversationUnsavedChanges && (
                      <Button variant="outline" size="sm" onClick={() => { setConversationSliderValue(conversationAllocation.current_conversations); setConversationUnsavedChanges(false); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Free Plan Upgrade Prompt */}
      {isAuthenticated && isFreePlan() && (
        <div className="max-w-2xl mx-auto pt-8">
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Unlock More Resources</CardTitle>
                  <CardDescription>Upgrade to a paid plan to manage seats, agents, and conversations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Users className="h-6 w-6 text-primary mx-auto mb-2" />
                  <span className="font-semibold block">More Seats</span>
                  <p className="text-xs text-muted-foreground">Add team members</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Bot className="h-6 w-6 text-primary mx-auto mb-2" />
                  <span className="font-semibold block">More Agents</span>
                  <p className="text-xs text-muted-foreground">Deploy AI agents</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <MessageSquare className="h-6 w-6 text-primary mx-auto mb-2" />
                  <span className="font-semibold block">More Conversations</span>
                  <p className="text-xs text-muted-foreground">Handle more chats</p>
                </div>
              </div>
              <Button className="w-full mt-4" size="lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <TrendingUp className="h-5 w-5 mr-2" />
                View Plans Above
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );

  // If standalone (not in dashboard), wrap with header and footer
  if (isStandalone) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Navigation */}
        <nav className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                  {getPlatformLogoSrc(platformLogo) ? (
                    <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-primary-foreground" />
                  )}
                </div>
                <span className="font-heading font-bold text-lg">{platformName}</span>
              </Link>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                {isAuthenticated ? (
                  <Link to="/dashboard">
                    <Button className="btn-hover">Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost">Sign in</Button>
                    </Link>
                    <Link to="/register">
                      <Button className="btn-hover">Register</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto">
            {content}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-8 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-sm bg-primary flex items-center justify-center overflow-hidden">
                  {getPlatformLogoSrc(platformLogo) ? (
                    <img src={getPlatformLogoSrc(platformLogo)} alt={platformName} className="h-full w-full object-contain" />
                  ) : (
                    <MessageSquare className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{platformName}</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} {platformName}. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return content;
};

export default Pricing;
