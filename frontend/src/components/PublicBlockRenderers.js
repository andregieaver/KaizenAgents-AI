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

  const getIcon = (iconName) => {
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : null;
  };

  return (
    <section key={block.id} className="py-20 border-t border-border">
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

  return (
    <section key={block.id} className="py-20 border-t border-border">
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
    <div key={block.id} className="my-4">
      <a href={content.url || '#'}>
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
  return (
    <div key={block.id}>
      <PricingWidget />
    </div>
  );
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
