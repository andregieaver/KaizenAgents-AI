import React from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import * as Icons from 'lucide-react';
import PricingWidget from './PricingWidget';

const { ArrowRight, ExternalLink, Download, Play, Send } = Icons;

// Generate responsive visibility classes
const getVisibilityClasses = (visibility) => {
  if (!visibility) return '';
  
  const classes = [];
  
  // Mobile (default, no prefix)
  if (!visibility.mobile) classes.push('hidden');
  else classes.push('block');
  
  // Tablet (sm: breakpoint >= 640px)
  if (visibility.tablet !== visibility.mobile) {
    classes.push(visibility.tablet ? 'sm:block' : 'sm:hidden');
  }
  
  // Desktop (lg: breakpoint >= 1024px)
  if (visibility.desktop !== visibility.tablet) {
    classes.push(visibility.desktop ? 'lg:block' : 'lg:hidden');
  }
  
  return classes.join(' ');
};

export const renderHeroBlock = (block) => {
  const content = block.content || {};
  const BadgeIcon = Icons.Bot;
  const visibilityClass = getVisibilityClasses(block.visibility);
  
  return (
    <section key={block.id} className={`py-20 lg:py-32 ${visibilityClass}`}>
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          {content.badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              {BadgeIcon && <BadgeIcon className="h-4 w-4" />}
              {content.badge}
            </div>
          )}
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none mb-6">
            {content.heading}{' '}
            {content.highlight && (
              <span className="text-primary">{content.highlight}</span>
            )}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
            {content.description}
          </p>
          <div className="flex flex-wrap gap-4">
            {content.primaryButton?.text && (
              <a href={content.primaryButton.url || '#'}>
                <Button size="lg" className="h-12 px-6 btn-hover" data-testid="hero-cta-btn">
                  {content.primaryButton.text}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            )}
            {content.secondaryButton?.text && (
              <a href={content.secondaryButton.url || '#'}>
                <Button size="lg" variant="outline" className="h-12 px-6" data-testid="demo-btn">
                  {content.secondaryButton.text}
                </Button>
              </a>
            )}
          </div>
        </div>
        {content.imageUrl && (
          <div className="relative">
            <div className="aspect-square rounded-2xl bg-muted/50 border border-border overflow-hidden">
              <img
                src={content.imageUrl}
                alt={content.heading || 'Hero image'}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export const renderFeaturesBlock = (block) => {
  const content = block.content || {};
  const features = content.features || [];
  const visibilityClass = getVisibilityClasses(block.visibility);

  const getIcon = (iconName) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : null;
  };

  return (
    <section key={block.id} className={`py-20 border-t border-border ${visibilityClass}`}>
      <div className="text-center mb-16">
        <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          {content.heading}
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {content.description}
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div
            key={feature.id}
            className="p-6 bg-card border border-border rounded-sm card-hover"
            data-testid="feature-card"
          >
            <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary mb-4">
              {getIcon(feature.icon)}
            </div>
            <h3 className="font-heading font-semibold text-lg mb-2">
              {feature.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export const renderCTABlock = (block) => {
  const content = block.content || {};
  const visibilityClass = getVisibilityClasses(block.visibility);

  return (
    <section key={block.id} className={`py-20 border-t border-border ${visibilityClass}`}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          {content.heading}
        </h2>
        <p className="text-muted-foreground text-lg mb-8">
          {content.description}
        </p>
        {content.buttonText && (
          <a href={content.buttonUrl || '#'}>
            <Button size="lg" className="h-12 px-8 btn-hover" data-testid="cta-btn">
              {content.buttonText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        )}
      </div>
    </section>
  );
};

export const renderButtonBlock = (block) => {
  const content = block.content || {};
  const visibilityClass = getVisibilityClasses(block.visibility);
  const alignment = content.alignment || 'left';
  const textAlign = alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left';

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'ArrowRight':
        return <ArrowRight className="ml-2 h-4 w-4" />;
      case 'ExternalLink':
        return <ExternalLink className="ml-2 h-4 w-4" />;
      case 'Download':
        return <Download className="ml-2 h-4 w-4" />;
      case 'Play':
        return <Play className="ml-2 h-4 w-4" />;
      case 'Send':
        return <Send className="ml-2 h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div key={block.id} className={`my-4 ${textAlign} ${visibilityClass}`}>
      <a href={content.url || '#'} className="inline-block">
        <Button
          variant={content.variant || 'default'}
          size={content.size || 'default'}
        >
          {content.text}
          {content.icon && getIcon(content.icon)}
        </Button>
      </a>
    </div>
  );
};

export const renderPricingWidgetBlock = (block) => {
  const visibilityClass = getVisibilityClasses(block.visibility);
  return (
    <div key={block.id} className={visibilityClass}>
      <PricingWidget />
    </div>
  );
};

export const renderImageBlock = (block) => {
  const content = block.content || {};
  const visibilityClass = getVisibilityClasses(block.visibility);
  const alignment = content.alignment || 'left';
  const alignClass = alignment === 'center' ? 'mx-auto' : alignment === 'right' ? 'ml-auto' : '';
  
  const imageElement = (
    <img
      src={content.url || ''}
      alt={content.alt || ''}
      className={`w-full h-auto rounded-lg ${alignClass}`}
    />
  );
  
  if (content.link) {
    return (
      <div key={block.id} className={`my-8 ${visibilityClass}`}>
        <a 
          href={content.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:opacity-90 transition-opacity"
        >
          {imageElement}
        </a>
        {content.caption && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            {content.caption}
          </p>
        )}
      </div>
    );
  }
  
  return (
    <div key={block.id} className={`my-8 ${visibilityClass}`}>
      {imageElement}
      {content.caption && (
        <p className="text-sm text-muted-foreground text-center mt-2">
          {content.caption}
        </p>
      )}
    </div>
  );
};

// Pricing Cards - Dynamically fetches plans from API
export const PricingCardsBlock = ({ block }) => {
  const [plans, setPlans] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const content = block.content || {};
  const visibilityClass = getVisibilityClasses(block.visibility);
  const { Check } = Icons;
  const showYearlyPricing = content.showYearlyPricing || false;
  const buttonText = content.buttonText || 'Get Started';

  React.useEffect(() => {
    const fetchPlans = async () => {
      try {
        const API = process.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${API}/api/subscriptions/plans`);
        const data = await response.json();
        // Filter for public plans only and sort by sort_order
        const publicPlans = data.filter(p => p.is_public).sort((a, b) => a.sort_order - b.sort_order);
        setPlans(publicPlans);
      } catch (error) {
        console.error('Failed to fetch pricing plans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  if (loading) {
    return (
      <section key={block.id} className={`py-16 ${visibilityClass}`}>
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) {
    return null;
  }

  // Helper to get features list from plan
  const getPlanFeatures = (plan) => {
    const features = [];
    const planFeatures = plan.features || {};
    
    // Add custom items first if they exist
    if (planFeatures.custom_items && planFeatures.custom_items.length > 0) {
      features.push(...planFeatures.custom_items);
    } else {
      // Otherwise, generate from features object
      if (planFeatures.max_conversations !== null && planFeatures.max_conversations !== undefined) {
        features.push(planFeatures.max_conversations === null || planFeatures.max_conversations === -1 
          ? 'Unlimited conversations' 
          : `${planFeatures.max_conversations} conversations/month`);
      }
      if (planFeatures.max_agents !== null && planFeatures.max_agents !== undefined) {
        features.push(planFeatures.max_agents === null || planFeatures.max_agents === -1
          ? 'Unlimited agents' 
          : `Up to ${planFeatures.max_agents} agents`);
      }
      if (planFeatures.analytics_enabled) {
        features.push('Advanced analytics');
      }
      if (planFeatures.api_access) {
        features.push('API access');
      }
      if (planFeatures.support_level) {
        const supportLabels = { email: 'Email support', priority: 'Priority support', premium: 'Premium support' };
        features.push(supportLabels[planFeatures.support_level] || 'Email support');
      }
      if (planFeatures.remove_branding) {
        features.push('Remove branding');
      }
      if (planFeatures.custom_integrations) {
        features.push('Custom integrations');
      }
    }
    
    return features;
  };

  return (
    <section key={block.id} className={`py-16 ${visibilityClass}`}>
      {/* Section Header */}
      {(content.heading || content.description) && (
        <div className="text-center mb-12">
          {content.heading && (
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              {content.heading}
            </h2>
          )}
          {content.description && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {content.description}
            </p>
          )}
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className={`grid gap-8 ${
        plans.length === 1 ? 'max-w-md mx-auto' :
        plans.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' :
        plans.length === 3 ? 'md:grid-cols-3 max-w-6xl mx-auto' :
        'md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto'
      }`}>
        {plans.map((plan, index) => {
          const isPopular = index === 1 && plans.length >= 3; // Middle plan is popular for 3+ plans
          const price = showYearlyPricing && plan.price_yearly ? plan.price_yearly : plan.price_monthly;
          const interval = showYearlyPricing && plan.price_yearly ? 'year' : 'month';
          const features = getPlanFeatures(plan);

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 p-8 ${
                isPopular
                  ? 'border-primary shadow-lg scale-105 bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">${price}</span>
                  <span className="text-muted-foreground">
                    /{interval === 'month' ? 'mo' : 'yr'}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-grow">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <a href="/dashboard/pricing" className="w-full">
                <Button
                  className="w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  size="lg"
                >
                  {buttonText}
                </Button>
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const renderPricingCardsBlock = (block) => {
  return <PricingCardsBlock key={block.id} block={block} />;
};

export const renderTextBlock = (block) => {
  const content = block.content || {};
  const alignment = content.alignment || 'center';
  const size = content.size || 'base';
  
  const sizeClasses = {
    'sm': 'text-sm',
    'base': 'text-base',
    'lg': 'text-lg',
    'xl': 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl'
  };

  return (
    <div key={block.id} className={`py-8 text-${alignment}`}>
      {content.heading && (
        <h2 className={`font-bold mb-2 ${sizeClasses[content.headingSize || '4xl']}`}>
          {content.heading}
        </h2>
      )}
      {content.text && (
        <p className={`text-muted-foreground ${sizeClasses[size]} ${content.maxWidth ? 'max-w-2xl mx-auto' : ''}`}>
          {content.text}
        </p>
      )}
      {content.items && content.items.length > 0 && (
        <div className={`space-y-2 ${content.maxWidth ? 'max-w-2xl mx-auto' : ''}`}>
          {content.items.map((item, idx) => (
            <p key={idx} className={`text-muted-foreground ${sizeClasses[size]}`}>
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
