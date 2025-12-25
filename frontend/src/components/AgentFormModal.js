import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Category-based icon sets
const CATEGORY_ICONS = {
  customer_support: ['💬', '🎧', '💁', '🤝', '📞', '✉️', '👋', '🙋'],
  sales: ['💼', '📈', '💰', '🤑', '📊', '🎯', '💳', '🛍️'],
  technical: ['⚙️', '🔧', '💻', '🖥️', '⚡', '🔌', '🛠️', '🤖'],
  ecommerce: ['🛒', '🛍️', '💳', '📦', '🏪', '🏬', '💸', '🎁'],
  healthcare: ['🏥', '⚕️', '💊', '🩺', '💉', '🏨', '🚑', '👨‍⚕️'],
  hospitality: ['🏨', '🍽️', '🛎️', '🏩', '🍴', '🥂', '🎉', '🌟'],
  real_estate: ['🏠', '🏢', '🏘️', '🏗️', '🗝️', '🏡', '🏦', '📍'],
  general: ['🤖', '💡', '⭐', '🎯', '🚀', '✨', '💫', '🌈']
};

const CATEGORIES = [
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'general', label: 'General' }
];

const AgentFormModal = ({ open, onClose, agent = null, onSuccess, token }) => {
  const isEdit = !!agent;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    icon: '🤖',
    system_prompt: '',
    temperature: 0.7,
    max_tokens: 2000,
    profile_image_url: null
  });
  
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  useEffect(() => {
    if (agent) {
      const config = agent.config || {};
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        category: agent.category || 'general',
        icon: agent.icon || '🤖',
        system_prompt: config.system_prompt || '',
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 2000,
        profile_image_url: agent.profile_image_url || null
      });
      setImagePreview(agent.profile_image_url);
    } else {
      // Reset form for new agent
      setFormData({
        name: '',
        description: '',
        category: 'general',
        icon: '🤖',
        system_prompt: '',
        temperature: 0.7,
        max_tokens: 2000,
        profile_image_url: null
      });
      setImagePreview(null);
      setImageFile(null);
    }
  }, [agent, open]);
  
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large. Maximum size is 2MB');
      return;
    }
    
    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };
  
  const uploadImage = async (agentId) => {
    if (!imageFile) return null;
    
    setUploadingImage(true);
    try {
      const formDataImg = new FormData();
      formDataImg.append('file', imageFile);
      
      const response = await axios.post(
        `${API}/agents/${agentId}/upload-image`,
        formDataImg,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      return response.data.profile_image_url;
    } catch {
      toast.error('Failed to upload image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error('Agent description is required');
      return;
    }
    
    if (!formData.system_prompt.trim()) {
      toast.error('System prompt is required');
      return;
    }
    
    setLoading(true);
    
    try {
      if (isEdit) {
        // Update existing agent
        await axios.patch(
          `${API}/agents/${agent.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Upload image if changed
        if (imageFile) {
          await uploadImage(agent.id);
        }
        
        toast.success('Agent updated successfully!');
      } else {
        // Create new agent
        const response = await axios.post(
          `${API}/agents/`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const newAgentId = response.data.id;
        
        // Upload image if provided
        if (imageFile) {
          await uploadImage(newAgentId);
        }
        
        toast.success('Agent created successfully!');
      }
      
      onSuccess();
      onClose();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to save agent');
    } finally {
      setLoading(false);
    }
  };
  
  const availableIcons = CATEGORY_ICONS[formData.category] || CATEGORY_ICONS.general;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update your agent configuration' : 'Configure your custom AI agent'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Image */}
          <div className="space-y-2">
            <Label>Profile Image (Optional)</Label>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg border-2 border-dashed border-border overflow-hidden">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                        setFormData({ ...formData, profile_image_url: null });
                      }}
                      className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    {formData.icon}
                  </div>
                )}
              </div>
              <div>
                <input
                  id="agent-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('agent-image').click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG/PNG</p>
              </div>
            </div>
          </div>
          
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Customer Support Assistant"
              required
            />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this agent does..."
              rows={3}
              required
            />
          </div>
          
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => {
                setFormData({ 
                  ...formData, 
                  category: value,
                  icon: CATEGORY_ICONS[value][0] // Set default icon for category
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Icon Picker */}
          <div className="space-y-2">
            <Label>Agent Icon *</Label>
            <div className="flex flex-wrap gap-2">
              {availableIcons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`w-10 h-10 text-2xl rounded border-2 transition-all hover:scale-110 ${
                    formData.icon === icon
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          
          {/* System Prompt */}
          <div className="space-y-2">
            <Label htmlFor="system_prompt">System Prompt *</Label>
            <Textarea
              id="system_prompt"
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="You are a helpful assistant that..."
              rows={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              Define the agent&apos;s personality, role, and behavior
            </p>
          </div>
          
          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">{formData.temperature}</span>
            </div>
            <Slider
              value={[formData.temperature]}
              onValueChange={([value]) => setFormData({ ...formData, temperature: value })}
              min={0}
              max={2}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Lower = more focused, Higher = more creative
            </p>
          </div>
          
          {/* Max Tokens */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Max Tokens</Label>
              <span className="text-sm text-muted-foreground">{formData.max_tokens}</span>
            </div>
            <Slider
              value={[formData.max_tokens]}
              onValueChange={([value]) => setFormData({ ...formData, max_tokens: value })}
              min={100}
              max={4000}
              step={100}
            />
            <p className="text-xs text-muted-foreground">
              Maximum length of agent responses
            </p>
          </div>
          
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploadingImage}>
              {loading || uploadingImage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadingImage ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                isEdit ? 'Update Agent' : 'Create Agent'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AgentFormModal;
