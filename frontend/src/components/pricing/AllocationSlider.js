/**
 * AllocationSlider - Slider for adjusting resource allocations
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

const AllocationSlider = ({
  title,
  description,
  icon: Icon,
  allocation,
  sliderValue,
  onSliderChange,
  hasUnsavedChanges,
  saving,
  onSave,
  unitLabel = 'units',
  pricePerUnit = 0
}) => {
  if (!allocation) return null;

  const baseAllocation = allocation.base || 0;
  const extraPurchased = allocation.extra_purchased || 0;
  const totalLimit = allocation.limit || baseAllocation;
  const currentUsage = allocation.current || 0;
  const maxPurchasable = allocation.max_purchasable || 100;
  
  const extraToAdd = Math.max(0, sliderValue - extraPurchased);
  const newTotal = baseAllocation + sliderValue;
  const monthlyCost = extraToAdd * pricePerUnit;

  const usagePercentage = totalLimit > 0 ? (currentUsage / totalLimit) * 100 : 0;
  const isNearLimit = usagePercentage > 80;
  const isAtLimit = usagePercentage >= 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Stats */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current usage</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium",
              isAtLimit && "text-destructive",
              isNearLimit && !isAtLimit && "text-amber-500"
            )}>
              {currentUsage} / {totalLimit}
            </span>
            {isAtLimit && <AlertTriangle className="h-4 w-4 text-destructive" />}
            {isNearLimit && !isAtLimit && <TrendingUp className="h-4 w-4 text-amber-500" />}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all",
              isAtLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${Math.min(100, usagePercentage)}%` }}
          />
        </div>

        {/* Allocation Breakdown */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Base (included in plan)</span>
            <span>{baseAllocation} {unitLabel}</span>
          </div>
          {extraPurchased > 0 && (
            <div className="flex justify-between">
              <span>Extra purchased</span>
              <span>+{extraPurchased} {unitLabel}</span>
            </div>
          )}
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Extra {unitLabel}</span>
            <Badge variant={hasUnsavedChanges ? "default" : "secondary"}>
              {sliderValue} {unitLabel}
            </Badge>
          </div>
          <Slider
            value={[sliderValue]}
            onValueChange={(value) => onSliderChange(value[0])}
            min={0}
            max={maxPurchasable}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>{maxPurchasable}</span>
          </div>
        </div>

        {/* Cost Preview */}
        {extraToAdd > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span>Additional {unitLabel}</span>
              <span>+{extraToAdd}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Monthly cost</span>
              <span className="font-medium">${monthlyCost.toFixed(2)}/mo</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>New total</span>
              <span>{newTotal} {unitLabel}</span>
            </div>
          </div>
        )}

        {/* Save Button */}
        {hasUnsavedChanges && (
          <Button 
            onClick={onSave} 
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default AllocationSlider;
