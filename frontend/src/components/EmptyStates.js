import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  Bot,
  MessageSquare,
  Users,
  FileText,
  Sparkles,
  Plus,
  Settings,
  Search,
  Database
} from 'lucide-react';

export const EmptyState = ({ 
  icon: Icon = FileText, 
  title, 
  description, 
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel 
}) => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="font-heading text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {description}
      </p>
      <div className="flex gap-3">
        {action && (
          <Button onClick={action}>
            <Plus className="h-4 w-4 mr-2" />
            {actionLabel}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="outline" onClick={secondaryAction}>
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

export const NoAgentsState = ({ onCreate }) => (
  <EmptyState
    icon={Bot}
    title="No AI Agents Yet"
    description="Create your first AI agent to start handling customer support conversations. Agents can be customized with different personalities, knowledge bases, and capabilities."
    action={onCreate}
    actionLabel="Create Your First Agent"
  />
);

export const NoProvidersState = ({ onCreate }) => (
  <EmptyState
    icon={Sparkles}
    title="No AI Providers Configured"
    description="Add an AI provider (OpenAI, Anthropic, or Google) to power your agents. You'll need API credentials to get started."
    action={onCreate}
    actionLabel="Add AI Provider"
  />
);

export const NoConversationsState = () => (
  <EmptyState
    icon={MessageSquare}
    title="No Conversations Yet"
    description="When customers start chatting through your widget, their conversations will appear here. Make sure your widget is properly embedded on your website."
    actionLabel="View Setup Guide"
  />
);

export const NoTeamMembersState = ({ onInvite }) => (
  <EmptyState
    icon={Users}
    title="No Team Members"
    description="Invite team members to collaborate on customer support. Assign different roles like Admin, Agent, or Viewer based on their responsibilities."
    action={onInvite}
    actionLabel="Invite Team Member"
  />
);

export const NoDocumentsState = ({ onUpload }) => (
  <EmptyState
    icon={FileText}
    title="No Documents Uploaded"
    description="Upload company documentation, FAQs, or knowledge base articles. Your AI agent will use these to provide accurate, context-aware responses."
    action={onUpload}
    actionLabel="Upload Document"
  />
);

export const NoSearchResults = ({ query, onClear }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="rounded-full bg-muted p-6 mb-4">
      <Search className="h-12 w-12 text-muted-foreground" />
    </div>
    <h3 className="font-heading text-lg font-semibold mb-2">No results found</h3>
    <p className="text-sm text-muted-foreground mb-4">
      We couldn't find anything matching "{query}"
    </p>
    {onClear && (
      <Button variant="outline" onClick={onClear}>
        Clear Search
      </Button>
    )}
  </div>
);

export const NoVersionHistory = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="rounded-full bg-muted p-6 mb-4">
      <Database className="h-12 w-12 text-muted-foreground" />
    </div>
    <h3 className="font-heading text-lg font-semibold mb-2">No Version History</h3>
    <p className="text-sm text-muted-foreground">
      Version history will appear here after you make changes to the agent configuration
    </p>
  </div>
);

export const ErrorState = ({ title, message, onRetry }) => (
  <Card className="border-destructive">
    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-destructive/10 p-6 mb-4">
        <Settings className="h-12 w-12 text-destructive" />
      </div>
      <h3 className="font-heading text-xl font-semibold mb-2 text-destructive">
        {title || "Something went wrong"}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {message || "We encountered an error while loading this content. Please try again."}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          Try Again
        </Button>
      )}
    </CardContent>
  </Card>
);
