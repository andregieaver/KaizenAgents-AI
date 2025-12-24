import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  CheckCircle2, 
  Circle, 
  Building2, 
  Image, 
  Bot, 
  Users, 
  Code,
  X,
  ChevronRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STEP_ICONS = {
  company_info: Building2,
  brand_logo: Image,
  first_agent: Bot,
  team_member: Users,
  widget_setup: Code
};

const OnboardingProgress = () => {
  const { token } = useAuth();
  const [onboarding, setOnboarding] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      try {
        // First check if dismissed
        const dismissedRes = await axios.get(`${API}/onboarding/dismissed`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (dismissedRes.data.dismissed) {
          setDismissed(true);
          setLoading(false);
          return;
        }

        // Then get onboarding status
        const statusRes = await axios.get(`${API}/onboarding/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOnboarding(statusRes.data);
        
        // Auto-minimize if 80% or more complete
        if (statusRes.data?.progress >= 80) {
          setMinimized(true);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchOnboardingStatus();
    }
  }, [token]);

  const handleDismiss = async () => {
    try {
      await axios.post(`${API}/onboarding/skip`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDismissed(true);
    } catch (error) {
    }
  };

  // Don't show if loading, dismissed, or complete
  if (loading || dismissed || !onboarding) {
    return null;
  }

  // Don't show if onboarding is complete
  if (onboarding.is_complete) {
    return null;
  }

  const completedSteps = onboarding.steps.filter(s => s.completed).length;
  const totalSteps = onboarding.steps.length;

  // Minimized view for 80%+ completion
  if (minimized) {
    return (
      <Card className="border border-primary/20 bg-gradient-to-r from-primary/5 to-background mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 flex-shrink-0">
                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" className="stroke-muted" strokeWidth="2" />
                  <circle
                    cx="18" cy="18" r="16" fill="none"
                    className="stroke-primary" strokeWidth="2"
                    strokeDasharray={`${onboarding.completion_percentage} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold">{onboarding.completion_percentage}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Setup {completedSteps}/{totalSteps} complete</p>
                <p className="text-xs text-muted-foreground">
                  {onboarding.steps.find(s => !s.completed)?.label || 'All done!'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setMinimized(false)}
                className="text-xs"
              >
                Expand
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={handleDismiss}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-primary/20 bg-gradient-to-r from-primary/5 to-background mb-6">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Progress Circle */}
            <div className="relative h-16 w-16 flex-shrink-0">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-muted"
                  strokeWidth="2"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="2"
                  strokeDasharray={`${onboarding.completion_percentage} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold">{onboarding.completion_percentage}%</span>
              </div>
            </div>
            
            <div>
              <h3 className="font-heading font-semibold text-lg">
                {onboarding.company_name ? `Welcome, ${onboarding.company_name}!` : 'Complete Your Setup'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {completedSteps} of {totalSteps} steps completed
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setMinimized(true)}
            >
              Minimize
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress value={onboarding.completion_percentage} className="h-2 mb-4" />

        {/* Steps Grid */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {onboarding.steps.map((step) => {
            const Icon = STEP_ICONS[step.id] || Circle;
            const linkTo = step.tab 
              ? `${step.link}?tab=${step.tab}`
              : step.link;
            
            return (
              <Link
                key={step.id}
                to={linkTo}
                className={`
                  group flex items-center gap-2 p-3 rounded-lg border transition-all
                  ${step.completed 
                    ? 'border-primary/20 bg-primary/5' 
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                  }
                `}
              >
                <div className={`
                  flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center
                  ${step.completed 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  }
                `}>
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${step.completed ? 'text-primary' : ''}`}>
                    {step.name}
                  </p>
                </div>
                <ChevronRight className={`
                  h-4 w-4 flex-shrink-0 transition-transform
                  ${step.completed ? 'text-primary' : 'text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5'}
                `} />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default OnboardingProgress;
