/**
 * ResourceAllocationCard - Card for managing resource allocations (seats, agents, conversations)
 * Used in Pricing.js for resource management section
 */
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Alert, AlertDescription } from '../ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Users, Bot, MessageSquare, Info, Clock, CheckCircle, Loader2 } from 'lucide-react';

const RESOURCE_CONFIG = {
  seat: {
    icon: Users,
    title: 'Seats',
    unitLabel: 'seat',
    pluralLabel: 'seats',
    baseField: 'base_plan_seats',
    currentField: 'current_seats',
    committedField: 'committed_seats',
    maxField: 'max_seats',
    priceField: 'price_per_seat',
    billingInfo: [
      'Increases locked in after 24 hours',
      'Billed for highest committed amount',
      '24hr grace period for undo'
    ]
  },
  agent: {
    icon: Bot,
    title: 'Agents',
    unitLabel: 'agent',
    pluralLabel: 'agents',
    baseField: 'base_plan_agents',
    currentField: 'current_agents',
    committedField: 'committed_agents',
    maxField: 'max_agents',
    priceField: 'price_per_agent',
    billingInfo: [
      'Increases locked in after 24 hours',
      'Billed for highest committed amount',
      '24hr grace period for undo'
    ]
  },
  conversation: {
    icon: MessageSquare,
    title: 'Conversations',
    unitLabel: 'conversation',
    pluralLabel: 'conversations',
    baseField: 'base_plan_conversations',
    currentField: 'current_conversations',
    committedField: 'committed_conversations',
    maxField: 'max_conversations',
    priceField: 'price_per_block',
    isBlockBased: true,
    billingInfo: null // Dynamically generated based on block_size
  }
};

const formatTimeRemaining = (dateStr) => {
  if (!dateStr) return '';
  const remaining = new Date(dateStr) - new Date();
  if (remaining <= 0) return 'expired';
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
};

const ResourceAllocationCard = ({
  resourceType = 'seat',
  allocation,
  sliderValue,
  onSliderChange,
  hasUnsavedChanges,
  isSaving,
  onSave,
  onCancel
}) => {
  if (!allocation) return null;
  
  const config = RESOURCE_CONFIG[resourceType];
  const Icon = config.icon;
  
  const baseValue = allocation[config.baseField] || 0;
  const currentValue = allocation[config.currentField] || 0;
  const committedValue = allocation[config.committedField] || 0;
  const maxValue = allocation[config.maxField] || 100;
  const pricePerUnit = allocation[config.priceField] || 0;
  const blockSize = allocation.block_size || 100;
  
  // Calculate extra cost
  const extraUnits = sliderValue - baseValue;
  let extraCost = 0;
  let extraLabel = '';
  
  if (extraUnits > 0) {
    if (config.isBlockBased) {
      const blocks = Math.ceil(extraUnits / blockSize);
      extraCost = blocks * pricePerUnit;
      extraLabel = `${blocks} blocks × $${pricePerUnit.toFixed(2)}`;
    } else {
      extraCost = extraUnits * pricePerUnit;
      extraLabel = `${extraUnits} × $${pricePerUnit.toFixed(2)}`;
    }
  }
  
  // Generate billing info for conversations
  const billingInfo = config.billingInfo || [
    `Billed in blocks of ${blockSize}`,
    'Increases locked in after 24 hours',
    '24hr grace period for undo'
  ];

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{config.title}</CardTitle>
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
                  {billingInfo.map((info, i) => (
                    <span key={i}>• {info}<br /></span>
                  ))}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
          <div>
            <span className="text-muted-foreground">Base:</span>{' '}
            <span className="font-bold">{baseValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Current:</span>{' '}
            <span className="font-bold text-green-500">{currentValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Committed:</span>{' '}
            <span className="font-bold text-blue-500">{committedValue}</span>
          </div>
        </div>

        {/* Grace Period */}
        {allocation.is_in_grace_period && (
          <Alert className="bg-blue-500/10 border-blue-500/30 py-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
              Grace: {formatTimeRemaining(allocation.grace_period_ends_at)}
            </AlertDescription>
          </Alert>
        )}

        {/* Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total {config.title}</span>
            <span className="text-lg font-bold">{sliderValue}</span>
          </div>
          <Slider
            value={[sliderValue]}
            onValueChange={onSliderChange}
            min={baseValue}
            max={maxValue}
            step={config.isBlockBased ? blockSize : 1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{baseValue} (Base)</span>
            <span>{maxValue} (Max)</span>
          </div>
        </div>

        {/* Cost */}
        {extraUnits > 0 && (
          <div className="p-3 border border-border rounded-lg text-sm">
            <div className="flex justify-between">
              <span>Extra: {extraLabel}</span>
              <span className="font-semibold">${extraCost.toFixed(2)}/mo</span>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-2">
          <Button 
            onClick={onSave} 
            disabled={!hasUnsavedChanges || isSaving} 
            className="flex-1" 
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            {hasUnsavedChanges ? 'Save' : 'No Changes'}
          </Button>
          {hasUnsavedChanges && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ResourceAllocationCard;
