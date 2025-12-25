/**
 * ResourcePricingCard - Configurable pricing card for seats, agents, and conversations
 * Used in FeatureGatesAdmin.js for managing per-plan pricing configuration
 */
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { 
  Loader2, 
  Edit2, 
  X, 
  Check, 
  RefreshCw, 
  AlertTriangle 
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ResourcePricingCard = ({
  pricing,
  isEditing,
  editForm,
  setEditForm,
  isSaving,
  isSyncing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onSyncToStripe,
  // Resource type configuration
  resourceType = 'seat', // 'seat', 'agent', or 'conversation'
  showYearlyPrice = false,
  showBlockSize = false
}) => {
  // Determine field names based on resource type
  const getFieldName = (baseField) => {
    const prefix = resourceType === 'conversation' ? 'price_per_block' : `price_per_${resourceType}`;
    if (baseField === 'monthly') return resourceType === 'conversation' ? 'price_per_block' : `${prefix}_monthly`;
    if (baseField === 'yearly') return `${prefix}_yearly`;
    return baseField;
  };

  const monthlyFieldName = getFieldName('monthly');
  const yearlyFieldName = getFieldName('yearly');
  
  const monthlyPrice = pricing[monthlyFieldName] || 0;
  const yearlyPrice = pricing[yearlyFieldName] || 0;
  
  const hasStripeConnection = resourceType === 'seat' 
    ? (pricing.stripe_price_monthly_id || pricing.stripe_price_yearly_id)
    : pricing.stripe_price_id;

  const unitLabel = resourceType === 'conversation' ? 'block' : resourceType;

  return (
    <Card className={cn("border", !pricing.is_enabled && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {pricing.plan_name} Plan
          </CardTitle>
          <Badge variant={pricing.is_enabled ? "default" : "secondary"}>
            {pricing.is_enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            {/* Monthly Price */}
            <div className="space-y-2">
              <Label htmlFor={`price-monthly-${pricing.plan_id}`}>
                {resourceType === 'conversation' ? 'Price per Block' : 'Monthly Price'} ({pricing.currency?.toUpperCase() || 'USD'})
              </Label>
              <Input
                id={`price-monthly-${pricing.plan_id}`}
                type="number"
                step="0.01"
                min="0"
                value={editForm[monthlyFieldName] || ''}
                onChange={(e) => setEditForm({ 
                  ...editForm, 
                  [monthlyFieldName]: e.target.value 
                })}
                placeholder="5.00"
              />
            </div>
            
            {/* Yearly Price (for seats) */}
            {showYearlyPrice && (
              <div className="space-y-2">
                <Label htmlFor={`price-yearly-${pricing.plan_id}`}>
                  Yearly Price ({pricing.currency?.toUpperCase() || 'USD'})
                </Label>
                <Input
                  id={`price-yearly-${pricing.plan_id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm[yearlyFieldName] || ''}
                  onChange={(e) => setEditForm({ 
                    ...editForm, 
                    [yearlyFieldName]: e.target.value 
                  })}
                  placeholder="50.00"
                />
              </div>
            )}
            
            {/* Block Size (for conversations) */}
            {showBlockSize && (
              <div className="space-y-2">
                <Label htmlFor={`block-size-${pricing.plan_id}`}>
                  Block Size (conversations per block)
                </Label>
                <Input
                  id={`block-size-${pricing.plan_id}`}
                  type="number"
                  min="1"
                  value={editForm.block_size || 100}
                  onChange={(e) => setEditForm({ 
                    ...editForm, 
                    block_size: parseInt(e.target.value) || 100 
                  })}
                  placeholder="100"
                />
              </div>
            )}
            
            {/* Enable Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id={`enabled-${pricing.plan_id}`}
                checked={editForm.is_enabled}
                onCheckedChange={(checked) => setEditForm({ 
                  ...editForm, 
                  is_enabled: checked 
                })}
              />
              <Label htmlFor={`enabled-${pricing.plan_id}`}>
                Enable {resourceType} subscriptions
              </Label>
            </div>
            
            {/* Save/Cancel Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => onSave(pricing.plan_id)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Price Display */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  ${monthlyPrice.toFixed(2)}
                </span>
                <span className="text-muted-foreground text-sm">
                  / {unitLabel} / {resourceType === 'conversation' ? 'block' : 'month'}
                </span>
              </div>
              {showYearlyPrice && yearlyPrice > 0 && (
                <div className="text-sm text-muted-foreground">
                  ${yearlyPrice.toFixed(2)} / {unitLabel} / year
                </div>
              )}
              {showBlockSize && (
                <div className="text-sm text-muted-foreground">
                  Block size: {pricing.block_size || 100} conversations
                </div>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Subscription billing
            </div>
            
            {/* Stripe Status */}
            {hasStripeConnection ? (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Stripe: Connected
              </div>
            ) : monthlyPrice > 0 && (
              <div className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Not synced to Stripe
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onStartEdit(pricing)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {!hasStripeConnection && monthlyPrice > 0 && onSyncToStripe && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onSyncToStripe(pricing.plan_id)}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync to Stripe
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResourcePricingCard;
