import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  Plus,
  Trash2,
  Upload,
  Loader2
} from 'lucide-react';
import * as Icons from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useState } from 'react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Hero Block Editor
export const HeroBlockEditor = ({ block, updateBlock }) => {
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/admin/pages/upload-og-image/temp`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const fullUrl = `${process.env.REACT_APP_BACKEND_URL}${response.data.url}`;
      updateBlock(block.id, {
        ...block.content,
        imageUrl: fullUrl
      });

      toast.success('Image uploaded');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Badge Text (Optional)</Label>
        <Input
          value={block.content.badge || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, badge: e.target.value })}
          placeholder="New Feature"
        />
      </div>

      <div>
        <Label>Main Heading</Label>
        <Input
          value={block.content.heading || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, heading: e.target.value })}
          placeholder="Your amazing heading"
        />
      </div>

      <div>
        <Label>Highlighted Text (in heading)</Label>
        <Input
          value={block.content.highlight || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, highlight: e.target.value })}
          placeholder="goes here"
        />
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={block.content.description || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, description: e.target.value })}
          placeholder="Compelling description..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Primary Button Text</Label>
          <Input
            value={block.content.primaryButton?.text || ''}
            onChange={(e) => updateBlock(block.id, {
              ...block.content,
              primaryButton: { ...block.content.primaryButton, text: e.target.value }
            })}
            placeholder="Get Started"
          />
        </div>
        <div>
          <Label>Primary Button URL</Label>
          <Input
            value={block.content.primaryButton?.url || ''}
            onChange={(e) => updateBlock(block.id, {
              ...block.content,
              primaryButton: { ...block.content.primaryButton, url: e.target.value }
            })}
            placeholder="/pricing"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Secondary Button Text</Label>
          <Input
            value={block.content.secondaryButton?.text || ''}
            onChange={(e) => updateBlock(block.id, {
              ...block.content,
              secondaryButton: { ...block.content.secondaryButton, text: e.target.value }
            })}
            placeholder="Learn More"
          />
        </div>
        <div>
          <Label>Secondary Button URL</Label>
          <Input
            value={block.content.secondaryButton?.url || ''}
            onChange={(e) => updateBlock(block.id, {
              ...block.content,
              secondaryButton: { ...block.content.secondaryButton, url: e.target.value }
            })}
            placeholder="#"
          />
        </div>
      </div>

      <div>
        <Label>Hero Image</Label>
        <div className="flex gap-2">
          <Input
            value={block.content.imageUrl || ''}
            onChange={(e) => updateBlock(block.id, { ...block.content, imageUrl: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
          <label htmlFor={`hero-img-${block.id}`}>
            <Button
              type="button"
              variant="outline"
              disabled={uploadingImage}
              asChild
            >
              <span>
                {uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </span>
            </Button>
          </label>
          <input
            id={`hero-img-${block.id}`}
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files[0])}
            className="hidden"
          />
        </div>
        {block.content.imageUrl && (
          <img
            src={block.content.imageUrl}
            alt="Hero preview"
            className="w-full h-48 object-cover rounded mt-2"
          />
        )}
      </div>
    </div>
  );
};

// Feature Grid Editor
export const FeatureGridEditor = ({ block, updateBlock }) => {
  const iconList = ['Zap', 'Shield', 'BarChart3', 'Bot', 'Users', 'Code', 'MessageSquare', 'Heart', 'Star', 'Rocket'];

  const addFeature = () => {
    const newFeature = {
      id: `feat_${Date.now()}`,
      icon: 'Zap',
      title: 'New Feature',
      description: 'Feature description'
    };
    updateBlock(block.id, {
      ...block.content,
      features: [...(block.content.features || []), newFeature]
    });
  };

  const updateFeature = (featureId, field, value) => {
    const updated = block.content.features.map(f =>
      f.id === featureId ? { ...f, [field]: value } : f
    );
    updateBlock(block.id, { ...block.content, features: updated });
  };

  const deleteFeature = (featureId) => {
    const updated = block.content.features.filter(f => f.id !== featureId);
    updateBlock(block.id, { ...block.content, features: updated });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Section Heading</Label>
        <Input
          value={block.content.heading || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, heading: e.target.value })}
          placeholder="Our Features"
        />
      </div>

      <div>
        <Label>Section Description</Label>
        <Input
          value={block.content.description || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, description: e.target.value })}
          placeholder="Everything you need to succeed"
        />
      </div>

      <div className="space-y-3">
        <Label>Features</Label>
        {(block.content.features || []).map((feature) => (
          <Card key={feature.id} className="border-l-4 border-l-primary">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Feature Item</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => deleteFeature(feature.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div>
                <Label>Icon</Label>
                <select
                  value={feature.icon}
                  onChange={(e) => updateFeature(feature.id, 'icon', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {iconList.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Title</Label>
                <Input
                  value={feature.title}
                  onChange={(e) => updateFeature(feature.id, 'title', e.target.value)}
                  placeholder="Feature title"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={feature.description}
                  onChange={(e) => updateFeature(feature.id, 'description', e.target.value)}
                  placeholder="Feature description"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={addFeature}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Feature
        </Button>
      </div>
    </div>
  );
};

// CTA Block Editor
export const CTABlockEditor = ({ block, updateBlock }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Heading</Label>
        <Input
          value={block.content.heading || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, heading: e.target.value })}
          placeholder="Ready to Get Started?"
        />
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={block.content.description || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, description: e.target.value })}
          placeholder="Join thousands of satisfied customers..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Button Text</Label>
          <Input
            value={block.content.buttonText || ''}
            onChange={(e) => updateBlock(block.id, { ...block.content, buttonText: e.target.value })}
            placeholder="Start Now"
          />
        </div>
        <div>
          <Label>Button URL</Label>
          <Input
            value={block.content.buttonUrl || ''}
            onChange={(e) => updateBlock(block.id, { ...block.content, buttonUrl: e.target.value })}
            placeholder="/pricing"
          />
        </div>
      </div>
    </div>
  );
};

// Button Block Editor
export const ButtonBlockEditor = ({ block, updateBlock }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label>Button Text</Label>
        <Input
          value={block.content.text || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, text: e.target.value })}
          placeholder="Click Me"
        />
      </div>

      <div>
        <Label>Button URL</Label>
        <Input
          value={block.content.url || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })}
          placeholder="#"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Variant</Label>
          <select
            value={block.content.variant || 'default'}
            onChange={(e) => updateBlock(block.id, { ...block.content, variant: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="default">Default</option>
            <option value="outline">Outline</option>
            <option value="ghost">Ghost</option>
            <option value="destructive">Destructive</option>
          </select>
        </div>

        <div>
          <Label>Size</Label>
          <select
            value={block.content.size || 'default'}
            onChange={(e) => updateBlock(block.id, { ...block.content, size: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="sm">Small</option>
            <option value="default">Default</option>
            <option value="lg">Large</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Icon (Optional)</Label>
        <select
          value={block.content.icon || ''}
          onChange={(e) => updateBlock(block.id, { ...block.content, icon: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">No Icon</option>
          <option value="ArrowRight">Arrow Right</option>
          <option value="ExternalLink">External Link</option>
          <option value="Download">Download</option>
          <option value="Play">Play</option>
          <option value="Send">Send</option>
        </select>
      </div>

      <div>
        <Label>Alignment</Label>
        <div className="flex gap-2 mt-2">
          <Button
            type="button"
            variant={block.content.alignment === 'left' || !block.content.alignment ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, alignment: 'left' })}
          >
            Left
          </Button>
          <Button
            type="button"
            variant={block.content.alignment === 'center' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, alignment: 'center' })}
          >
            Center
          </Button>
          <Button
            type="button"
            variant={block.content.alignment === 'right' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateBlock(block.id, { ...block.content, alignment: 'right' })}
          >
            Right
          </Button>
        </div>
      </div>
    </div>
  );
};

// Pricing Cards Block Editor
export const PricingCardsBlockEditor = ({ block, updateBlock }) => {
  const content = {
    heading: block.content?.heading || 'Choose Your Plan',
    description: block.content?.description || 'Select the perfect plan for your needs',
    plans: block.content?.plans || []
  };

  const addPlan = () => {
    const newPlan = {
      id: `plan_${Date.now()}`,
      name: 'New Plan',
      description: 'Plan description',
      price: '0',
      interval: 'month',
      popular: false,
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
      buttonText: 'Get Started',
      buttonUrl: '/pricing'
    };
    
    updateBlock(block.id, {
      ...content,
      plans: [...content.plans, newPlan]
    });
  };

  const updatePlan = (planId, updates) => {
    const updatedPlans = content.plans.map(plan =>
      plan.id === planId ? { ...plan, ...updates } : plan
    );
    updateBlock(block.id, {
      ...content,
      plans: updatedPlans
    });
  };

  const removePlan = (planId) => {
    const updatedPlans = content.plans.filter(plan => plan.id !== planId);
    updateBlock(block.id, {
      ...content,
      plans: updatedPlans
    });
  };

  const addFeature = (planId) => {
    const updatedPlans = content.plans.map(plan => {
      if (plan.id === planId) {
        return {
          ...plan,
          features: [...plan.features, 'New Feature']
        };
      }
      return plan;
    });
    updateBlock(block.id, {
      ...content,
      plans: updatedPlans
    });
  };

  const updateFeature = (planId, featureIndex, value) => {
    const updatedPlans = content.plans.map(plan => {
      if (plan.id === planId) {
        const newFeatures = [...plan.features];
        newFeatures[featureIndex] = value;
        return { ...plan, features: newFeatures };
      }
      return plan;
    });
    updateBlock(block.id, {
      ...content,
      plans: updatedPlans
    });
  };

  const removeFeature = (planId, featureIndex) => {
    const updatedPlans = content.plans.map(plan => {
      if (plan.id === planId) {
        const newFeatures = plan.features.filter((_, idx) => idx !== featureIndex);
        return { ...plan, features: newFeatures };
      }
      return plan;
    });
    updateBlock(block.id, {
      ...content,
      plans: updatedPlans
    });
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="pricing-heading">Section Heading</Label>
          <Input
            id="pricing-heading"
            value={content.heading}
            onChange={(e) => updateBlock(block.id, { ...content, heading: e.target.value })}
            placeholder="Choose Your Plan"
          />
        </div>

        <div>
          <Label htmlFor="pricing-description">Section Description</Label>
          <Textarea
            id="pricing-description"
            value={content.description}
            onChange={(e) => updateBlock(block.id, { ...content, description: e.target.value })}
            placeholder="Select the perfect plan for your needs"
            rows={2}
          />
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Pricing Plans</Label>
          <Button onClick={addPlan} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>

        {(!content.plans || content.plans.length === 0) ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pricing plans yet. Click &quot;Add Plan&quot; to create your first plan.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {content.plans.map((plan, planIndex) => (
              <Card key={plan.id} className="border-2">
                <CardContent className="pt-6 space-y-4">
                  {/* Plan Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold">Plan {planIndex + 1}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Popular</Label>
                      <input
                        type="checkbox"
                        checked={plan.popular || false}
                        onChange={(e) => updatePlan(plan.id, { popular: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Button
                        onClick={() => removePlan(plan.id)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Plan Name */}
                  <div>
                    <Label>Plan Name</Label>
                    <Input
                      value={plan.name}
                      onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                      placeholder="Pro Plan"
                    />
                  </div>

                  {/* Plan Description */}
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={plan.description}
                      onChange={(e) => updatePlan(plan.id, { description: e.target.value })}
                      placeholder="Perfect for growing teams"
                      rows={2}
                    />
                  </div>

                  {/* Price and Interval */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Price</Label>
                      <Input
                        value={plan.price}
                        onChange={(e) => updatePlan(plan.id, { price: e.target.value })}
                        placeholder="99"
                      />
                    </div>
                    <div>
                      <Label>Interval</Label>
                      <select
                        value={plan.interval}
                        onChange={(e) => updatePlan(plan.id, { interval: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="month">per month</option>
                        <option value="year">per year</option>
                        <option value="one-time">one-time</option>
                      </select>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Features</Label>
                      <Button onClick={() => addFeature(plan.id)} size="sm" variant="outline">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Feature
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex gap-2">
                          <Input
                            value={feature}
                            onChange={(e) => updateFeature(plan.id, featureIndex, e.target.value)}
                            placeholder="Feature name"
                          />
                          <Button
                            onClick={() => removeFeature(plan.id, featureIndex)}
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Button Text</Label>
                      <Input
                        value={plan.buttonText}
                        onChange={(e) => updatePlan(plan.id, { buttonText: e.target.value })}
                        placeholder="Get Started"
                      />
                    </div>
                    <div>
                      <Label>Button URL</Label>
                      <Input
                        value={plan.buttonUrl}
                        onChange={(e) => updatePlan(plan.id, { buttonUrl: e.target.value })}
                        placeholder="/pricing"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};