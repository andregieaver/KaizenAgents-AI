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
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] h-auto overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
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

        <Tabs defaultValue="plans" className="mt-4 flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="plans" className="text-xs sm:text-sm">
              <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Upgrade Plan</span>
              <span className="sm:hidden">Upgrade</span>
            </TabsTrigger>
            <TabsTrigger value="seats" disabled={isFreePlan} className="text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Seats</span>
              <span className="sm:hidden">Seats</span>
              {isFreePlan && <span className="hidden sm:inline ml-1">(Paid Plans Only)</span>}
            </TabsTrigger>
          </TabsList>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-4 mt-6">
            <div className="grid md:grid-cols-3 gap-4">
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
                      "relative border rounded-lg p-6 transition-all",
                      isCurrent && "border-primary bg-primary/5",
                      plan.name.toLowerCase() === 'professional' && !isCurrent && "border-primary shadow-lg"
                    )}
                  >
                    {isCurrent && (
                      <Badge className="absolute top-4 right-4" variant="default">
                        Current Plan
                      </Badge>
                    )}
                    {plan.name.toLowerCase() === 'professional' && !isCurrent && (
                      <Badge className="absolute top-4 right-4 bg-amber-500">
                        Popular
                      </Badge>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold font-heading">{plan.name}</h3>
                        <div className="mt-2 flex items-baseline">
                          <span className="text-3xl font-bold">${price}</span>
                          <span className="text-muted-foreground ml-2">/month</span>
                        </div>
                      </div>

                      <Separator />

                      <ul className="space-y-2">
                        {features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="w-full"
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
                            Upgrade to {plan.name}
                            <ArrowRight className="h-4 w-4 ml-2" />
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
          <TabsContent value="seats" className="space-y-6 mt-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Purchase Additional Seats</h3>
                    <p className="text-sm text-muted-foreground">
                      Add more team members to your account
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">Number of Seats</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="100"
                        value={seatQuantity}
                        onChange={(e) => setSeatQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Price per Seat</Label>
                      <div className="mt-1 h-10 flex items-center">
                        <span className="text-2xl font-bold">${pricePerSeat}</span>
                        <span className="text-muted-foreground ml-2">/month</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-background rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">${(seatQuantity * pricePerSeat).toFixed(2)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total per Month</span>
                      <span className="text-2xl font-bold text-primary">
                        ${(seatQuantity * pricePerSeat).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePurchaseSeats}
                    disabled={purchasingSeats || seatQuantity < 1}
                  >
                    {purchasingSeats ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        Purchase {seatQuantity} Seat{seatQuantity > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Extra seats will be added to your current plan immediately. You can cancel anytime.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePlanModal;
