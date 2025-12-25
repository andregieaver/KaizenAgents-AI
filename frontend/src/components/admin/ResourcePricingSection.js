/**
 * ResourcePricingSection - Complete section for managing resource pricing
 * Includes header, pricing cards grid, empty state, and info box
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Loader2, RefreshCw, Users, Bot, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import ResourcePricingCard from './ResourcePricingCard';

const RESOURCE_CONFIG = {
  seat: {
    icon: Users,
    title: 'Seat Pricing',
    description: 'Configure per-seat pricing for each subscription plan',
    emptyTitle: 'No seat pricing configured yet.',
    emptyMessage: 'Pricing will be automatically created when you first load this page.',
    infoTitle: 'How Seat Subscriptions Work',
    infoItems: [
      { label: 'Subscription-based', text: 'Additional seats are billed as recurring subscriptions' },
      { label: '24hr Grace Period', text: 'Users can undo increases within 24 hours' },
      { label: 'High-water Mark', text: 'Users are billed for highest committed amount' }
    ],
    showYearlyPrice: true,
    showBlockSize: false
  },
  agent: {
    icon: Bot,
    title: 'Agent Pricing',
    description: 'Configure per-agent pricing for each subscription plan',
    emptyTitle: 'No agent pricing configured yet.',
    emptyMessage: 'Pricing will be automatically created when you first load this page.',
    infoTitle: 'How Agent Subscriptions Work',
    infoItems: [
      { label: 'Per-agent billing', text: 'Each additional AI agent incurs a monthly fee' },
      { label: '24hr Grace Period', text: 'Users can undo increases within 24 hours' },
      { label: 'High-water Mark', text: 'Users are billed for highest committed amount' }
    ],
    showYearlyPrice: false,
    showBlockSize: false
  },
  conversation: {
    icon: MessageSquare,
    title: 'Conversation Pricing',
    description: 'Configure per-conversation-block pricing for each subscription plan',
    emptyTitle: 'No conversation pricing configured yet.',
    emptyMessage: 'Pricing will be automatically created when you first load this page.',
    infoTitle: 'How Conversation Subscriptions Work',
    infoItems: [
      { label: 'Block-based billing', text: 'Conversations are purchased in configurable blocks' },
      { label: '24hr Grace Period', text: 'Users can undo increases within 24 hours' },
      { label: 'Usage tracking', text: 'Monthly conversation counts reset at billing cycle' }
    ],
    showYearlyPrice: false,
    showBlockSize: true
  }
};

const ResourcePricingSection = ({
  resourceType = 'seat',
  pricingData = [],
  loading = false,
  editingPlanId = null,
  editForm = {},
  setEditForm,
  isSaving = false,
  syncingPlanId = null,
  onRefresh,
  onStartEdit,
  onCancelEdit,
  onSave,
  onSyncToStripe
}) => {
  const config = RESOURCE_CONFIG[resourceType];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {config.title}
            </CardTitle>
            <CardDescription>
              {config.description}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pricing Cards Grid */}
            {pricingData.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pricingData.map((pricing) => (
                  <ResourcePricingCard
                    key={pricing.id || pricing.plan_id}
                    pricing={pricing}
                    resourceType={resourceType}
                    isEditing={editingPlanId === pricing.plan_id}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    isSaving={isSaving}
                    isSyncing={syncingPlanId === pricing.plan_id}
                    onStartEdit={onStartEdit}
                    onCancelEdit={onCancelEdit}
                    onSave={onSave}
                    onSyncToStripe={onSyncToStripe}
                    showYearlyPrice={config.showYearlyPrice}
                    showBlockSize={config.showBlockSize}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{config.emptyTitle}</p>
                <p className="text-sm mt-2">{config.emptyMessage}</p>
              </div>
            )}

            {/* Info Section */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">{config.infoTitle}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {config.infoItems.map((item, index) => (
                  <li key={index}>
                    • <strong>{item.label}:</strong> {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResourcePricingSection;
