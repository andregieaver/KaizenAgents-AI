import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import {
  Bot,
  Upload,
  Loader2,
  Power,
  Globe,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AgentConfigurationTab = ({
  agent,
  setAgent,
  isNew,
  providers,
  loadingProviders,
  getSystemPrompt,
  getTemperature,
  getMaxTokens,
  getModel,
  getProviderId,
  getAvailableModels,
  getAvatarSrc,
  handleToggleActive,
  handleAvatarUpload,
  uploadingAvatar,
  avatarInputRef,
  token
}) => {
  const categories = [
    'Customer Support',
    'Sales',
    'Technical Support',
    'E-commerce',
    'General',
    'Other'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Main Configuration */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
        <Card className="border border-border">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Agent Details</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Basic information about this agent</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name" className="text-sm">Agent Name *</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g., Customer Support Specialist"
                  value={agent.name}
                  onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="agent-icon" className="text-sm">Icon</Label>
                <Input
                  id="agent-icon"
                  placeholder="🤖"
                  value={agent.icon}
                  onChange={(e) => setAgent({ ...agent, icon: e.target.value })}
                  className="text-xl"
                  maxLength={2}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">Description *</Label>
              <Textarea
                id="description"
                placeholder="A brief description of what this agent does..."
                rows={2}
                value={agent.description}
                onChange={(e) => setAgent({ ...agent, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm">Category</Label>
              <select
                id="category"
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={agent.category}
                onChange={(e) => setAgent({ ...agent, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Provider and Model Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider" className="text-sm">AI Provider</Label>
                <select
                  id="provider"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={getProviderId()}
                  onChange={(e) => {
                    const selectedProvider = providers.find(p => p.id === e.target.value);
                    setAgent({ 
                      ...agent, 
                      config: { 
                        ...agent.config, 
                        provider_id: e.target.value,
                        provider_name: selectedProvider?.name || '',
                        model: selectedProvider?.default_model || selectedProvider?.models?.[0] || ''
                      }
                    });
                  }}
                  disabled={loadingProviders}
                >
                  {loadingProviders ? (
                    <option value="">Loading providers...</option>
                  ) : providers.length === 0 ? (
                    <option value="">No providers configured</option>
                  ) : (
                    <>
                      <option value="">Select a provider</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name} ({provider.type})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {providers.length === 0 && !loadingProviders && (
                  <p className="text-xs text-amber-600">
                    No AI providers configured. Ask your admin to set one up.
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm">Model</Label>
                <select
                  id="model"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={getModel()}
                  onChange={(e) => setAgent({ 
                    ...agent, 
                    config: { ...agent.config, model: e.target.value, ai_model: e.target.value }
                  })}
                  disabled={!getProviderId() || loadingProviders}
                >
                  {!getProviderId() ? (
                    <option value="">Select a provider first</option>
                  ) : getAvailableModels().length === 0 ? (
                    <>
                      <option value="">Enter model name</option>
                      <option value={getModel()} disabled={!getModel()}>
                        {getModel() || 'No models available'}
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="">Select a model</option>
                      {getAvailableModels().map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </>
                  )}
                </select>
                {getProviderId() && getAvailableModels().length === 0 && (
                  <Input
                    placeholder="Enter model name (e.g., gpt-4o-mini)"
                    value={getModel()}
                    onChange={(e) => setAgent({ 
                      ...agent, 
                      config: { ...agent.config, model: e.target.value, ai_model: e.target.value }
                    })}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="system-prompt" className="text-sm">System Prompt *</Label>
              <Textarea
                id="system-prompt"
                placeholder="You are a helpful customer support assistant..."
                rows={6}
                className="min-h-[120px] sm:min-h-[180px]"
                value={getSystemPrompt()}
                onChange={(e) => setAgent({ 
                  ...agent, 
                  config: { ...agent.config, system_prompt: e.target.value, ai_persona: e.target.value }
                })}
              />
              <p className="text-xs text-muted-foreground">
                Define the agent&apos;s personality, knowledge, and behavior
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Model Parameters</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Fine-tune the agent&apos;s response generation</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="temperature" className="text-sm">Temperature</Label>
                <span className="text-sm font-mono text-muted-foreground">{getTemperature()}</span>
              </div>
              <input
                type="range"
                id="temperature"
                min="0"
                max="2"
                step="0.1"
                value={getTemperature()}
                onChange={(e) => setAgent({ 
                  ...agent, 
                  config: { ...agent.config, temperature: parseFloat(e.target.value) }
                })}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Lower = more focused, Higher = more creative
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max-tokens" className="text-sm">Max Tokens</Label>
              <Input
                type="number"
                id="max-tokens"
                value={getMaxTokens()}
                onChange={(e) => setAgent({ 
                  ...agent, 
                  config: { ...agent.config, max_tokens: parseInt(e.target.value) }
                })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum length of the agent&apos;s responses
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 sm:space-y-6">
        {/* Avatar */}
        <Card className="border border-border">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Agent Avatar</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Visual representation of the agent</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="flex justify-center">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden text-3xl sm:text-4xl">
                {getAvatarSrc(agent.profile_image_url) ? (
                  <img 
                    src={getAvatarSrc(agent.profile_image_url)} 
                    alt={agent.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  agent.icon || <Bot className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
                )}
              </div>
            </div>
            
            {!isNew && (
              <>
                <input
                  type="file"
                  ref={avatarInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleAvatarUpload(e.target.files[0])}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload Avatar
                </Button>
              </>
            )}
            {isNew && (
              <p className="text-xs text-muted-foreground text-center">
                Save the agent first to upload an avatar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status & Actions */}
        {!isNew && (
          <Card className="border border-border">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Agent Status</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Power className={`h-4 w-4 ${agent.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">
                    {agent.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <Switch
                  checked={agent.is_active}
                  onCheckedChange={handleToggleActive}
                />
              </div>
              
              {agent.is_public && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>Published to Marketplace</span>
                </div>
              )}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent ID</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{agent.id?.slice(0, 8)}...</code>
                </div>
                {agent.created_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(agent.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orchestration */}
        {!isNew && (
          <Card className="border border-border">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Orchestration</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Multi-agent coordination settings</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  <span className="text-sm">Enable Orchestration</span>
                </div>
                <Switch
                  checked={agent.orchestration_enabled}
                  onCheckedChange={(checked) => setAgent({ ...agent, orchestration_enabled: checked })}
                />
              </div>
              
              {agent.orchestration_enabled && (
                <div className="space-y-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    placeholder="support, billing, technical"
                    value={agent.tags?.join(', ') || ''}
                    onChange={(e) => setAgent({ 
                      ...agent, 
                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tags help the mother agent route requests
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AgentConfigurationTab;
