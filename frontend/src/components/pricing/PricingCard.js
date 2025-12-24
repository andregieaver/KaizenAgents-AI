/**
 * PricingCard - Displays a pricing tier card
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Check, Loader2, Sparkles, Zap, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';

const getPlanIcon = (planName) => {
  const name = planName?.toLowerCase();
  if (name?.includes('enterprise') || name?.includes('scale')) {
    return <Crown className="h-6 w-6" />;
  }
  if (name?.includes('pro') || name?.includes('growth')) {
    return <Zap className="h-6 w-6" />;
  }
  return <Sparkles className="h-6 w-6" />;
};

const PricingCard = ({
  plan,
  isYearly,
  currentPlanId,
  checkoutLoading,
  appliedDiscount,
  discountPlanId,
  onSelectPlan,
  onApplyDiscount,
  isAuthenticated
}) => {
  const isCurrentPlan = currentPlanId === plan.id;
  const isPopular = plan.is_popular;
  const price = isYearly ? plan.price_yearly : plan.price_monthly;
  const monthlyEquivalent = isYearly ? (plan.price_yearly / 12).toFixed(0) : plan.price_monthly;

  // Calculate discounted price
  let displayPrice = price;
  let discountedPrice = null;
  
  if (appliedDiscount && discountPlanId === plan.id) {
    if (appliedDiscount.discount_type === 'percentage') {
      discountedPrice = price * (1 - appliedDiscount.discount_value / 100);
    } else {
      discountedPrice = Math.max(0, price - appliedDiscount.discount_value);
    }
  }

  return (
    <Card 
      className={cn(
        "relative flex flex-col",
        isPopular && "border-primary shadow-lg scale-105",
        isCurrentPlan && "ring-2 ring-primary"
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary">Most Popular</Badge>
        </div>
      )}
      
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge variant="secondary">Current Plan</Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {getPlanIcon(plan.name)}
        </div>
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="text-center mb-6">
          {discountedPrice !== null ? (
            <>
              <span className="text-2xl font-bold text-muted-foreground line-through">
                ${price}
              </span>
              <span className="text-4xl font-bold ml-2">${discountedPrice.toFixed(0)}</span>
            </>
          ) : (
            <span className="text-4xl font-bold">${price}</span>
          )}
          <span className="text-muted-foreground">/{isYearly ? 'year' : 'month'}</span>
          {isYearly && (
            <p className="text-sm text-muted-foreground mt-1">
              ${monthlyEquivalent}/month billed annually
            </p>
          )}
        </div>
        
        <ul className="space-y-3">
          {plan.features?.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      
      <CardFooter className="pt-4">
        <Button
          className="w-full"
          variant={isPopular ? 'default' : 'outline'}
          disabled={isCurrentPlan || checkoutLoading === plan.id}
          onClick={() => onSelectPlan(plan.id)}
        >
          {checkoutLoading === plan.id ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : !isAuthenticated ? (
            'Get Started'
          ) : (
            'Upgrade'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PricingCard;
