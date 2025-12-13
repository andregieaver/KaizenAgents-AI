import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { Check, Loader2, Sparkles, Zap, Crown, ArrowRight, Tag, X } from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PricingWidget = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isYearly, setIsYearly] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  
  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [discountPlanId, setDiscountPlanId] = useState(null);

  const fetchData = useCallback(async () => {
    console.log('[PricingWidget] Starting fetchData...');
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      console.log('[PricingWidget] Fetching plans...');
      const plansRes = await axios.get(`${API}/subscriptions/plans`, { headers });
      console.log('[PricingWidget] Plans fetched:', plansRes.data.length);
      setPlans(plansRes.data);
      
      if (token) {
        try {
          console.log('[PricingWidget] Fetching current subscription...');
          const subRes = await axios.get(`${API}/subscriptions/current`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCurrentSubscription(subRes.data);
        } catch (err) {
          console.log('[PricingWidget] No current subscription');
          setCurrentSubscription(null);
        }
      }
    } catch (error) {
      console.error('[PricingWidget] Error fetching pricing data:', error);
      toast.error('Failed to load pricing information');
    } finally {
      console.log('[PricingWidget] fetchData complete, setting loading to false');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        `${API}/discounts/validate`,
        { code: discountCode, plan_id: planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAppliedDiscount(response.data);
      setDiscountPlanId(planId);
      toast.success(response.data.message || 'Discount applied successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid discount code');
      setAppliedDiscount(null);
      setDiscountPlanId(null);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const clearDiscount = () => {
    setAppliedDiscount(null);
    setDiscountPlanId(null);
    setDiscountCode('');
  };

  const handleSubscribe = async (plan) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isCurrentPlan(plan.id)) {
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const payload = {
        plan_id: plan.id,
        billing_cycle: isYearly ? 'yearly' : 'monthly'
      };

      if (appliedDiscount && discountPlanId === plan.id) {
        payload.discount_code = discountCode;
      }

      const response = await axios.post(
        `${API}/subscriptions/create-checkout`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        toast.success('Subscription created successfully!');
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create subscription');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 py-12">
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

                {/* Features */}
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
                {/* Discount Code Input */}
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
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyDiscount(plan.id)}
                          disabled={applyingDiscount || !discountCode.trim()}
                        >
                          {applyingDiscount ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Subscribe Button */}
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrent || checkoutLoading === plan.id}
                  variant={isCurrent ? "outline" : "default"}
                >
                  {getButtonText(plan, isCurrent)}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PricingWidget;
