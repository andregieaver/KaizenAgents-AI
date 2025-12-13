import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Check, Loader2, Zap, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Pricing = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isYearly, setIsYearly] = useState(false);
  const [checkingOut, setCheckingOut] = useState(null);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        axios.get(`${API}/subscriptions/plans`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/subscriptions/current`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setPlans(plansRes.data);
      setCurrentSubscription(subRes.data);
    } catch (error) {
      console.error('Error fetching pricing data:', error);
      toast.error('Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan, billingCycle) => {
    // If free plan, subscribe directly
    if (plan.price_monthly === 0) {
      setCheckingOut(plan.id);
      try {
        await axios.post(
          `${API}/subscriptions/subscribe`,
          { plan_id: plan.id, billing_cycle: billingCycle },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Switched to Free plan successfully!');
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to switch plan');
      } finally {
        setCheckingOut(null);
      }
      return;
    }

    // For paid plans, create Stripe checkout
    setCheckingOut(plan.id);
    try {
      const response = await axios.post(
        `${API}/subscriptions/checkout`,
        { plan_id: plan.id, billing_cycle: billingCycle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Redirect to Stripe checkout
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate checkout');
      setCheckingOut(null);
    }
  };

  const isCurrentPlan = (planId) => {
    return currentSubscription?.plan_id === planId;
  };

  const getPrice = (plan) => {
    return isYearly ? plan.price_yearly : plan.price_monthly;
  };

  const calculateSavings = (plan) => {
    if (!plan.price_yearly || !plan.price_monthly) return 0;
    const monthlyTotal = plan.price_monthly * 12;
    const savings = monthlyTotal - plan.price_yearly;
    return savings;
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
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Select the perfect plan for your needs. Upgrade or downgrade anytime.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3">
        <Label htmlFor="billing-toggle" className={cn(!isYearly && "font-semibold")}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={isYearly}
          onCheckedChange={setIsYearly}
        />
        <Label htmlFor="billing-toggle" className={cn(isYearly && "font-semibold")}>
          Annual
          <Badge variant="outline" className="ml-2 border-green-500 text-green-500">
            Save 20%
          </Badge>
        </Label>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => {
          const price = getPrice(plan);
          const savings = calculateSavings(plan);
          const isCurrent = isCurrentPlan(plan.id);
          const isPopular = plan.name === 'Professional';

          return (
            <Card
              key={plan.id}
              className={cn(
                "border relative",
                isPopular && "border-primary shadow-lg scale-105",
                isCurrent && "border-green-500"
              )}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary">
                    <Zap className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500">Current Plan</Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">
                  {plan.description}
                </CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-muted-foreground">
                      /{isYearly ? 'year' : 'month'}
                    </span>
                  </div>
                  {isYearly && savings > 0 && (
                    <p className="text-xs text-green-500 mt-1">
                      Save ${savings.toFixed(2)}/year
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>
                      {plan.features.max_conversations || 'Unlimited'} conversations/mo
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>
                      {plan.features.max_agents || 'Unlimited'} active agents
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>
                      {plan.features.conversation_history_days || 'Unlimited'} days history
                    </span>
                  </li>
                  {plan.features.analytics_enabled && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>Full analytics</span>
                    </li>
                  )}
                  {plan.features.api_access && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>API access</span>
                    </li>
                  )}
                  {plan.features.remove_branding && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>Remove branding</span>
                    </li>
                  )}
                  {plan.features.custom_integrations && (
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>Custom integrations</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="capitalize">{plan.features.support_level} support</span>
                  </li>
                </ul>

                {/* CTA Button */}
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan, isYearly ? 'yearly' : 'monthly')}
                  disabled={isCurrent || checkingOut === plan.id}
                >
                  {checkingOut === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Choose {plan.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ/Info */}
      <div className="max-w-3xl mx-auto text-center pt-8">
        <p className="text-sm text-muted-foreground">
          All plans include a 30-day trial period. Cancel anytime. Need a custom plan?{' '}
          <a href="mailto:support@yourdomain.com" className="text-primary hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
};

export default Pricing;
