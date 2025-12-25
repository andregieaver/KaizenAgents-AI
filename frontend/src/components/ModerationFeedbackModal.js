/**
 * ModerationFeedbackModal - Displays AI moderation review results
 * Shows issues, suggestions, and risk level when an agent fails review
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { 
  AlertTriangle, 
  XCircle, 
  AlertCircle, 
  CheckCircle2, 
  Shield,
  Lightbulb,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';

const getRiskLevelConfig = (riskLevel) => {
  switch (riskLevel) {
    case 'critical':
      return { color: 'bg-red-500', textColor: 'text-red-700', icon: XCircle, label: 'Critical Risk' };
    case 'high':
      return { color: 'bg-orange-500', textColor: 'text-orange-700', icon: AlertTriangle, label: 'High Risk' };
    case 'medium':
      return { color: 'bg-yellow-500', textColor: 'text-yellow-700', icon: AlertCircle, label: 'Medium Risk' };
    case 'low':
      return { color: 'bg-blue-500', textColor: 'text-blue-700', icon: Shield, label: 'Low Risk' };
    default:
      return { color: 'bg-gray-500', textColor: 'text-gray-700', icon: Shield, label: 'Unknown' };
  }
};

const getSeverityConfig = (severity) => {
  switch (severity) {
    case 'critical':
      return { variant: 'destructive', icon: XCircle };
    case 'error':
      return { variant: 'destructive', icon: AlertTriangle };
    case 'warning':
      return { variant: 'outline', icon: AlertCircle };
    default:
      return { variant: 'secondary', icon: AlertCircle };
  }
};

const getCategoryLabel = (category) => {
  const labels = {
    ethical: 'Ethical Concern',
    legal: 'Legal Issue',
    privacy: 'Privacy Risk',
    content: 'Inappropriate Content',
    deceptive: 'Deceptive Practice',
    system: 'System Error'
  };
  return labels[category] || category;
};

const ModerationFeedbackModal = ({
  open,
  onOpenChange,
  reviewResult,
  agentName,
  onEditAgent
}) => {
  if (!reviewResult) return null;

  const riskConfig = getRiskLevelConfig(reviewResult.risk_level);
  const RiskIcon = riskConfig.icon;
  const confidencePercent = Math.round((reviewResult.confidence || 0) * 100);
  
  // Handle both old format (string array) and new format (object array) for issues
  const issues = reviewResult.issues || [];
  const isNewFormat = issues.length > 0 && typeof issues[0] === 'object';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Publishing Review Failed
          </DialogTitle>
          <DialogDescription>
            &quot;{agentName}&quot; did not pass the content moderation review
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Risk Level & Confidence */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={cn("h-3 w-3 rounded-full", riskConfig.color)} />
              <span className={cn("font-medium", riskConfig.textColor)}>
                {riskConfig.label}
              </span>
            </div>
            <Badge variant="outline">
              {confidencePercent}% confidence
            </Badge>
          </div>

          {/* Summary */}
          {reviewResult.summary && (
            <Alert>
              <RiskIcon className="h-4 w-4" />
              <AlertTitle>Summary</AlertTitle>
              <AlertDescription>{reviewResult.summary}</AlertDescription>
            </Alert>
          )}

          {/* Issues */}
          {issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Issues Found ({issues.length})
              </h4>
              <ScrollArea className="h-[150px] rounded-md border p-3">
                <div className="space-y-3">
                  {issues.map((issue, index) => {
                    if (isNewFormat) {
                      const severityConfig = getSeverityConfig(issue.severity);
                      const SeverityIcon = severityConfig.icon;
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <SeverityIcon className="h-4 w-4 text-destructive" />
                            <Badge variant={severityConfig.variant} className="text-xs">
                              {getCategoryLabel(issue.category)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6">
                            {issue.description}
                          </p>
                          {issue.location && issue.location !== 'system' && (
                            <p className="text-xs text-muted-foreground pl-6 italic">
                              Found in: {issue.location}
                            </p>
                          )}
                        </div>
                      );
                    } else {
                      // Old format - string array
                      return (
                        <div key={index} className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">{issue}</p>
                        </div>
                      );
                    }
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Suggestions */}
          {reviewResult.suggestions && reviewResult.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Suggestions to Fix
              </h4>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-md border border-yellow-200 dark:border-yellow-800 p-3">
                <ul className="space-y-2">
                  {reviewResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEditAgent && (
            <Button onClick={() => { onOpenChange(false); onEditAgent(); }}>
              Edit Agent
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModerationFeedbackModal;
