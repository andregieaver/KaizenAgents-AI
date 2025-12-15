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

// Pricing Cards Block Editor (Displays plans from Admin Plan Management)
export const PricingCardsBlockEditor = ({ block, updateBlock }) => {
  const content = {
    heading: block.content?.heading || 'Choose Your Plan',
    description: block.content?.description || 'Select the perfect plan for your needs',
    showYearlyPricing: block.content?.showYearlyPricing || false,
    buttonText: block.content?.buttonText || 'Get Started'
  };

  return (
    <div className="space-y-6">
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="text-blue-500 mt-1">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Dynamic Pricing Plans</h4>
              <p className="text-sm text-blue-700">
                This block automatically displays all public subscription plans from your Admin Plan Management page. 
                To modify plans, go to <strong>Dashboard → Admin → Plan Management</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Header */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="pricing-heading">Section Heading</Label>
          <Input
            id="pricing-heading"
            value={content.heading}


// Agent Grid Block Editor
export const AgentGridBlockEditor = ({ block, updateBlock }) => {
  const content = block.content || {
    title: 'Explore Our AI Agents',
    subtitle: 'Choose from our collection of specialized AI agents',
    showSearch: true,
    showCategories: true,
    columns: 3
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="ag-title">Section Title</Label>
        <Input
          id="ag-title"
          value={content.title}
          onChange={(e) => updateBlock(block.id, { ...content, title: e.target.value })}
          placeholder="Explore Our AI Agents"
        />
      </div>

      <div>
        <Label htmlFor="ag-subtitle">Subtitle</Label>
        <Input
          id="ag-subtitle"
          value={content.subtitle}
          onChange={(e) => updateBlock(block.id, { ...content, subtitle: e.target.value })}
          placeholder="Choose from our collection of specialized AI agents"
        />
      </div>

      <div>
        <Label htmlFor="ag-columns">Grid Columns</Label>
        <select
          id="ag-columns"
          value={content.columns || 3}
          onChange={(e) => updateBlock(block.id, { ...content, columns: parseInt(e.target.value) })}
          className="w-full p-2 border rounded"
        >
          <option value={2}>2 Columns</option>
          <option value={3}>3 Columns</option>
          <option value={4}>4 Columns</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ag-show-search"
          checked={content.showSearch !== false}
          onChange={(e) => updateBlock(block.id, { ...content, showSearch: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="ag-show-search" className="cursor-pointer">
          Show search bar
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ag-show-categories"
          checked={content.showCategories !== false}
          onChange={(e) => updateBlock(block.id, { ...content, showCategories: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="ag-show-categories" className="cursor-pointer">
          Show category filters
        </Label>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <p className="text-blue-900 dark:text-blue-100">
          <strong>Note:</strong> This block displays agents from your marketplace. Agents are fetched dynamically and will show the public marketplace agents.
        </p>
      </div>
    </div>
  );
};

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

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-yearly"
            checked={content.showYearlyPricing}
            onChange={(e) => updateBlock(block.id, { ...content, showYearlyPricing: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="show-yearly" className="cursor-pointer">
            Show yearly pricing (if available)
          </Label>
        </div>

        <div>
          <Label htmlFor="button-text">Button Text</Label>
          <Input
            id="button-text"
            value={content.buttonText}
            onChange={(e) => updateBlock(block.id, { ...content, buttonText: e.target.value })}
            placeholder="Get Started"
          />
        </div>
      </div>
    </div>
  );
};
};