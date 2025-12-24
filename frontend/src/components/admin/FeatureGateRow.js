/**
 * FeatureGateRow - Row component for feature gate configuration
 */
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';

const FeatureGateRow = ({
  feature,
  planKey,
  planName,
  config,
  onToggle,
  onLimitChange
}) => {
  const featureConfig = config?.features?.[feature.key];
  const planConfig = featureConfig?.plans?.[planKey];
  const isEnabled = planConfig?.enabled ?? feature.default_enabled;
  const limit = planConfig?.limit ?? feature.default_limit;

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{feature.name}</span>
          {feature.is_premium && (
            <Badge variant="secondary" className="text-xs">Premium</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{feature.description}</p>
      </div>
      
      <div className="flex items-center gap-4">
        {feature.has_limit && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Limit:</Label>
            <Input
              type="number"
              min="0"
              value={limit}
              onChange={(e) => onLimitChange(feature.key, planKey, parseInt(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
              disabled={!isEnabled}
            />
          </div>
        )}
        
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => onToggle(feature.key, planKey, checked)}
        />
      </div>
    </div>
  );
};

export default FeatureGateRow;
