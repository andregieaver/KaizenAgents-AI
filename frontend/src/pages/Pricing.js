import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Check, Loader2, Sparkles, Zap, Crown, ArrowRight, MessageSquare, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

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

  useEffect(() => {
    fetchData();
    fetchPlatformInfo();
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
        } catch (err) {
          setCurrentSubscription(null);
        }
      }
    } catch (error) {
      console.error('Error fetching pricing data:', error);
      toast.error('Failed to load pricing information');
    } finally {
      setLoading(false);
    }
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
      const response = await axios.post(
        `${API}/subscriptions/checkout`,
        { 
          plan_id: plan.id, 
          billing_cycle: isYearly ? 'yearly' : 'monthly' 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.checkout_url) {
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl mx-auto">
        {plans.map((plan, index) => {
          const isCurrent = isCurrentPlan(plan.id);
          const isPopular = index === 1 && plans.length > 1;
          
          return (
            <Card 
              key={plan.id} 
              className={cn(
                "relative flex flex-col border",
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
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>
                      {plan.features.max_conversations 
                        ? `${plan.features.max_conversations} conversations/month`
                        : 'Unlimited conversations'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>
                      {plan.features.max_agents 
                        ? `${plan.features.max_agents} AI agents`
                        : 'Unlimited AI agents'}
                    </span>
                  </div>
                  {plan.features.analytics_enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>Analytics dashboard</span>
                    </div>
                  )}
                  {plan.features.api_access && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>API access</span>
                    </div>
                  )}
                  {plan.features.remove_branding && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>Remove branding</span>
                    </div>
                  )}
                  {plan.features.custom_integrations && (
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>Custom integrations</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="capitalize">{plan.features.support_level} support</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>
                      {plan.features.conversation_history_days 
                        ? `${plan.features.conversation_history_days} days history`
                        : 'Unlimited history'}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
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

      {/* FAQ / Info Section */}
      <div className="max-w-2xl mx-auto text-center text-sm text-muted-foreground space-y-2 pt-8 border-t border-border">
        <p>
          All plans include a free trial period. Cancel anytime.
        </p>
        <p>
          Need a custom plan? <Button variant="link" className="p-0 h-auto">Contact us</Button>
        </p>
      </div>
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
