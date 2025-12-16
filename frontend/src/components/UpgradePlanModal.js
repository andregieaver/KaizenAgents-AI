import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  ArrowRight,
  Check,
  Crown,
  Users,
  Loader2,
  AlertCircle,
  Plus,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UpgradePlanModal = ({ open, onOpenChange, feature = null, currentUsage = null }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  
  // Extra seats state
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [purchasingSeats, setPurchasingSeats] = useState(false);
  const [activeTab, setActiveTab] = useState('plans');
  const pricePerSeat = 5.0;

  useEffect(() => {
    if (open) {
      loadPlansAndUsage();
    }
  }, [open, token]);

  const loadPlansAndUsage = async () => {
    setLoading(true);
    try {
      const [plansRes, usageRes] = await Promise.all([
        axios.get(`${API}/subscriptions/plans`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/quotas/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setPlans(plansRes.data);
      setCurrentPlan({
        name: usageRes.data.plan_name,
        display_name: usageRes.data.plan_display_name
      });
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load upgrade options');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planName) => {
    setUpgrading(true);
    try {
      await axios.post(
        `${API}/subscriptions/upgrade`,
        { plan_name: planName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Upgraded to ${planName} plan!`);
      onOpenChange(false);
      
      // Reload the page to refresh quotas
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error upgrading:', error);
      toast.error(error.response?.data?.detail || 'Failed to upgrade plan');
    } finally {
      setUpgrading(false);
    }
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
          payment_method: 'stripe' // Placeholder
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message);
      onOpenChange(false);
      
      // Reload to refresh quotas
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error purchasing seats:', error);
      toast.error(error.response?.data?.detail || 'Failed to purchase seats');
    } finally {
      setPurchasingSeats(false);
    }
  };

  const getPlanFeatures = (planName) => {
    const features = {
      free: [
        '1 Active Agent',
        '1 Team Seat',
        '50 Messages/month',
        '100K Tokens/month',
        '5 CMS Pages'
      ],
      starter: [
        '3 Active Agents',
        '5 Team Seats',
        '500 Messages/month',
        '500K Tokens/month',
        '25 CMS Pages',
        'Email Support'
      ],
      professional: [
        '10 Active Agents',
        '25 Team Seats',
        '2,000 Messages/month',
        '2M Tokens/month',
        '100 CMS Pages',
        'Priority Support',
        'Marketplace Publishing'
      ]
    };
    return features[planName.toLowerCase()] || [];
  };

  const getPlanPrice = (planName) => {
    const prices = {
      free: 0,
      starter: 29,
      professional: 99
    };
    return prices[planName.toLowerCase()] || 0;
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isFreePlan = currentPlan?.name === 'free';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-4 sm:p-6 gap-0">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="text-xl sm:text-2xl font-heading">Upgrade Your Plan</DialogTitle>
          <DialogDescription className="text-sm">
            {feature ? (
              <span className="flex items-start gap-2 mt-2">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <span>You've reached the limit for <strong>{feature}</strong> on your current plan.</span>
              </span>
            ) : (
              'Choose a plan that fits your needs or purchase additional seats'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="plans" className="flex flex-col h-full">
            <TabsList className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground flex-shrink-0 mb-4">
              <TabsTrigger value="plans" className="flex-1 text-xs sm:text-sm inline-flex items-center justify-center">
                <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Upgrade Plan</span>
                <span className="sm:hidden">Upgrade</span>
              </TabsTrigger>
              <TabsTrigger value="seats" className="flex-1 text-xs sm:text-sm inline-flex items-center justify-center">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Add Seats</span>
                <span className="sm:hidden">Seats</span>
              </TabsTrigger>
            </TabsList>

            {/* Plans Tab */}
            <TabsContent value="plans" className="flex-1 overflow-y-auto mt-0" style={{maxHeight: 'calc(95vh - 200px)'}}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-4">
              {plans.map((plan) => {
                const isCurrent = plan.name.toLowerCase() === currentPlan?.name?.toLowerCase();
                const price = getPlanPrice(plan.name);
                const features = getPlanFeatures(plan.name);
                const isDowngrade = ['starter', 'professional'].indexOf(currentPlan?.name?.toLowerCase()) > 
                                   ['starter', 'professional'].indexOf(plan.name.toLowerCase());

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative border rounded-lg p-4 sm:p-6 transition-all",
                      isCurrent && "border-primary bg-primary/5",
                      plan.name.toLowerCase() === 'professional' && !isCurrent && "border-primary shadow-lg"
                    )}
                  >
                    {isCurrent && (
                      <Badge className="absolute top-3 right-3 sm:top-4 sm:right-4 text-xs" variant="default">
                        Current
                      </Badge>
                    )}
                    {plan.name.toLowerCase() === 'professional' && !isCurrent && (
                      <Badge className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-amber-500 text-xs">
                        Popular
                      </Badge>
                    )}

                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold font-heading">{plan.name}</h3>
                        <div className="mt-1 sm:mt-2 flex items-baseline">
                          <span className="text-2xl sm:text-3xl font-bold">${price}</span>
                          <span className="text-muted-foreground ml-1 sm:ml-2 text-sm">/month</span>
                        </div>
                      </div>

                      <Separator />

                      <ul className="space-y-1.5 sm:space-y-2">
                        {features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                            <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="w-full text-sm"
                        size="sm"
                        variant={isCurrent ? 'outline' : 'default'}
                        disabled={isCurrent || upgrading || isDowngrade}
                        onClick={() => handleUpgrade(plan.name.toLowerCase())}
                      >
                        {upgrading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Upgrading...
                          </>
                        ) : isCurrent ? (
                          'Current Plan'
                        ) : isDowngrade ? (
                          'Contact Support'
                        ) : (
                          <>
                            <span className="hidden sm:inline">Upgrade to {plan.name}</span>
                            <span className="sm:hidden">Upgrade</span>
                            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
              </div>
            </TabsContent>

            {/* Extra Seats Tab */}
            <TabsContent value="seats" className="flex-1 overflow-y-auto mt-0" style={{maxHeight: 'calc(95vh - 200px)'}}>
              <div className="max-w-2xl mx-auto pb-4">
              {isFreePlan ? (
                // Free plan message
                <div className="bg-muted/50 rounded-lg p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-amber-500/10 rounded-lg flex-shrink-0">
                      <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold">Upgrade Required</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Additional seats are only available for paid plans
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      To purchase additional seats for your team, you need to upgrade to a paid plan first.
                    </p>
                    
                    <div className="bg-background/50 rounded-lg p-3 sm:p-4 border">
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Starter Plan</p>
                          <p className="text-xs text-muted-foreground">Includes 5 seats + option to purchase more</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background/50 rounded-lg p-3 sm:p-4 border">
                      <div className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Professional Plan</p>
                          <p className="text-xs text-muted-foreground">Includes 25 seats + option to purchase more</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => {
                        // Switch to plans tab
                        const plansTab = document.querySelector('[value="plans"]');
                        if (plansTab) plansTab.click();
                      }}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      View Plans
                    </Button>
                  </div>
                </div>
              ) : (
                // Paid plan - show seat purchase
                <div className="bg-muted/50 rounded-lg p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold">Purchase Additional Seats</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Add more team members to your account
                      </p>
                    </div>
                  </div>

                  <Separator />

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="quantity" className="text-sm">Number of Seats</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="100"
                        value={seatQuantity}
                        onChange={(e) => setSeatQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Price per Seat</Label>
                      <div className="mt-1 h-10 flex items-center">
                        <span className="text-xl sm:text-2xl font-bold">${pricePerSeat}</span>
                        <span className="text-muted-foreground ml-1 sm:ml-2 text-sm">/month</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-background rounded-lg p-3 sm:p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Subtotal</span>
                      <span className="font-semibold text-sm sm:text-base">${(seatQuantity * pricePerSeat).toFixed(2)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm sm:text-base">Total per Month</span>
                      <span className="text-xl sm:text-2xl font-bold text-primary">
                        ${(seatQuantity * pricePerSeat).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="default"
                    onClick={handlePurchaseSeats}
                    disabled={purchasingSeats || seatQuantity < 1}
                  >
                    {purchasingSeats ? (
                      <>
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        Purchase {seatQuantity} Seat{seatQuantity > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground px-2">
                    Extra seats will be added to your current plan immediately. You can cancel anytime.
                  </p>
                </div>
                </div>
              )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePlanModal;
