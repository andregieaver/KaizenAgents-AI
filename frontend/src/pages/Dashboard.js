import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  MessageSquare,
  Users,
  User,
  Search,
  MessageCircle,
  Facebook,
  Instagram,
  Mail,
  Inbox,
  Star,
  StarOff,
  X,
  Ticket,
  CheckSquare,
  Plus,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Filter,
  Calendar
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to resolve image URLs
const resolveImageUrl = (url) => {
  if (!url || url === 'None' || url === 'null' || url === 'undefined') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BACKEND_URL}${url}`;
  return url;
};

// Source icon mapping
const SourceIcon = ({ source, className = "h-4 w-4" }) => {
  const icons = {
    chat: <MessageCircle className={className} />,
    widget: <MessageSquare className={className} />,
    facebook: <Facebook className={className} />,
    instagram: <Instagram className={className} />,
    email: <Mail className={className} />,
  };
  return icons[source?.toLowerCase()] || <MessageSquare className={className} />;
};

// Status badge component for conversations
const ConversationStatusBadge = ({ status }) => {
  const configs = {
    open: { label: 'Open', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    waiting: { label: 'Waiting', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    needs_response: { label: 'Needs Response', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    resolved: { label: 'Resolved', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    archived: { label: 'Archived', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' }
  };
  const config = configs[status] || configs.open;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
};

// Status badge component for tickets
const TicketStatusBadge = ({ status }) => {
  const configs = {
    open: { label: 'Open', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    in_progress: { label: 'In Progress', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    waiting_on_customer: { label: 'Waiting on Customer', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    resolved: { label: 'Resolved', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    closed: { label: 'Closed', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' }
  };
  const config = configs[status] || configs.open;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
};

// Priority badge component
const PriorityBadge = ({ priority }) => {
  const configs = {
    low: { label: 'Low', className: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
    medium: { label: 'Medium', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    high: { label: 'High', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    urgent: { label: 'Urgent', className: 'bg-red-500/10 text-red-600 border-red-500/20 animate-pulse' }
  };
  const config = configs[priority] || configs.medium;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
};

// Category badge
const CategoryBadge = ({ category }) => {
  const labels = {
    bug: 'Bug',
    feature_request: 'Feature Request',
    support: 'Support',
    billing: 'Billing',
    technical: 'Technical',
    other: 'Other'
  };
  return (
    <Badge variant="secondary" className="text-xs">
      {labels[category] || category}
    </Badge>
  );
};

// Priority indicator dot
const PriorityIndicator = ({ priority }) => {
  if (!priority || priority === 'medium') return null;
  const colors = {
    high: 'bg-orange-500',
    urgent: 'bg-red-600 animate-pulse',
    low: 'bg-gray-400'
  };
  return <div className={`h-2 w-2 rounded-full ${colors[priority] || ''}`} />;
};

// Conversation item component
const ConversationItem = ({ conversation, onClick, isSelected }) => {
  const [starred, setStarred] = useState(conversation.starred || false);

  const toggleStar = (e) => {
    e.stopPropagation();
    setStarred(!starred);
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 p-4 border-b border-border cursor-pointer transition-colors
        hover:bg-muted/50
        ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
        ${conversation.unread ? 'bg-primary/5' : ''}
      `}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={resolveImageUrl(conversation.customer_avatar)} />
        <AvatarFallback className="bg-primary/10 text-primary">
          {conversation.customer_name?.charAt(0)?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-medium text-sm truncate ${conversation.unread ? 'font-semibold' : ''}`}>
              {conversation.customer_name || 'Anonymous'}
            </span>
            <PriorityIndicator priority={conversation.priority} />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {conversation.updated_at && formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: false })}
          </span>
        </div>
        
        <p className={`text-sm truncate mb-2 ${conversation.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
          {conversation.last_message || 'No messages yet'}
        </p>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <SourceIcon source={conversation.source} className="h-3.5 w-3.5" />
              <span className="text-xs capitalize">{conversation.source || 'Chat'}</span>
            </div>
            <ConversationStatusBadge status={conversation.status} />
          </div>
          
          <div className="flex items-center gap-1">
            {conversation.assigned_agent && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={resolveImageUrl(conversation.assigned_agent.avatar_url)} />
                <AvatarFallback className="text-xs bg-muted">
                  {conversation.assigned_agent.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            )}
            <button
              onClick={toggleStar}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              {starred ? (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              ) : (
                <StarOff className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Ticket item component
const TicketItem = ({ ticket, onClick, isSelected }) => {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 p-4 border-b border-border cursor-pointer transition-colors
        hover:bg-muted/50
        ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
      `}
    >
      <div className={`
        h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0
        ${ticket.priority === 'urgent' ? 'bg-red-500/10 text-red-600' : 
          ticket.priority === 'high' ? 'bg-orange-500/10 text-orange-600' :
          'bg-primary/10 text-primary'}
      `}>
        <Ticket className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm truncate">
              {ticket.title}
            </span>
            <PriorityIndicator priority={ticket.priority} />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {ticket.created_at && formatDistanceToNow(new Date(ticket.created_at), { addSuffix: false })}
          </span>
        </div>
        
        <p className="text-sm text-muted-foreground truncate mb-2">
          {ticket.customer_name || 'No customer'} • {ticket.description || 'No description'}
        </p>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <CategoryBadge category={ticket.category} />
          </div>
          
          <div className="flex items-center gap-1">
            {ticket.assigned_user && (
              <Avatar className="h-5 w-5">
                <AvatarImage src={resolveImageUrl(ticket.assigned_user.avatar_url)} />
                <AvatarFallback className="text-xs bg-muted">
                  {ticket.assigned_user.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            )}
            {ticket.conversation_id && (
              <div className="text-muted-foreground" title="Linked to conversation">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Empty state component
const EmptyState = ({ type, tab }) => {
  const messages = {
    inbox: {
      all: { icon: Inbox, title: 'Your inbox is empty', description: 'Conversations from all channels will appear here when customers reach out.' },
      team: { icon: Users, title: 'No team conversations', description: 'Conversations assigned to your team will appear here.' },
      me: { icon: User, title: 'No conversations assigned to you', description: 'Conversations specifically assigned to you will appear here.' }
    },
    tickets: {
      all: { icon: Ticket, title: 'No tickets yet', description: 'Tickets escalated from conversations will appear here. Create your first ticket to get started.' },
      open: { icon: AlertCircle, title: 'No open tickets', description: 'All tickets have been resolved or closed.' },
      assigned: { icon: User, title: 'No tickets assigned to you', description: 'Tickets assigned to you will appear here.' }
    },
    tasks: {
      all: { icon: CheckSquare, title: 'Tasks coming soon', description: 'This feature is under development. Stay tuned!' }
    }
  };
  
  const config = messages[type]?.[tab] || messages[type]?.all || messages.inbox.all;
  const Icon = config.icon;
  
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-2">{config.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{config.description}</p>
    </div>
  );
};

// Create Ticket Dialog
const CreateTicketDialog = ({ open, onOpenChange, onCreated, token }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    customer_name: '',
    customer_email: '',
    priority: 'medium',
    category: 'support',
    assigned_to_user_id: '',
    assigned_to_team_id: '',
    due_date: ''
  });

  useEffect(() => {
    if (open) {
      fetchAssignees();
    }
  }, [open]);

  const fetchAssignees = async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        axios.get(`${API}/tickets/assignees/users`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/tickets/assignees/teams`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setUsers(usersRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch assignees:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        assigned_to_user_id: formData.assigned_to_user_id || null,
        assigned_to_team_id: formData.assigned_to_team_id || null,
        due_date: formData.due_date || null
      };

      const response = await axios.post(`${API}/tickets`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Ticket created successfully');
      onCreated(response.data);
      onOpenChange(false);
      setFormData({
        title: '',
        description: '',
        customer_name: '',
        customer_email: '',
        priority: 'medium',
        category: 'support',
        assigned_to_user_id: '',
        assigned_to_team_id: '',
        due_date: ''
      });
    } catch (error) {
      toast.error('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>
            Create a support ticket to track and resolve customer issues.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Brief description of the issue"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed description of the issue..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_email">Customer Email</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assign to User</Label>
              <Select value={formData.assigned_to_user_id} onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_to_user_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to Team</Label>
              <Select value={formData.assigned_to_team_id} onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_to_team_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No team</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  // Main tab state (Inbox, Tickets, Tasks)
  const [mainTab, setMainTab] = useState('inbox');
  
  // Inbox state
  const [inboxTab, setInboxTab] = useState('all');
  const [conversations, setConversations] = useState([]);
  const [conversationStats, setConversationStats] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationStatusFilter, setConversationStatusFilter] = useState(null);
  const [conversationSearch, setConversationSearch] = useState('');
  
  // Tickets state
  const [ticketTab, setTicketTab] = useState('all');
  const [tickets, setTickets] = useState([]);
  const [ticketStats, setTicketStats] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  
  // Loading states
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Fetch inbox data
  const fetchInboxData = useCallback(async () => {
    try {
      const [statsRes, conversationsRes] = await Promise.all([
        axios.get(`${API}/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/conversations`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setConversationStats(statsRes.data);
      setConversations(conversationsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch inbox data:', error);
    } finally {
      setLoadingInbox(false);
    }
  }, [token]);

  // Fetch tickets data
  const fetchTicketsData = useCallback(async () => {
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        axios.get(`${API}/tickets`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/tickets/stats`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTickets(ticketsRes.data.tickets || []);
      setTicketStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch tickets data:', error);
    } finally {
      setLoadingTickets(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInboxData();
    fetchTicketsData();
    
    // Auto-refresh
    const interval = setInterval(() => {
      fetchInboxData();
      fetchTicketsData();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [fetchInboxData, fetchTicketsData]);

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (inboxTab === 'me' && conv.assigned_to !== user?.id) return false;
    if (inboxTab === 'team' && conv.assigned_to === user?.id) return false;
    
    if (conversationStatusFilter) {
      if (conversationStatusFilter === 'needs_response' && conv.status !== 'needs_response' && conv.status !== 'waiting') return false;
      if (conversationStatusFilter !== 'needs_response' && conv.status !== conversationStatusFilter) return false;
    }
    
    if (conversationSearch) {
      const query = conversationSearch.toLowerCase();
      return (
        conv.customer_name?.toLowerCase().includes(query) ||
        conv.customer_email?.toLowerCase().includes(query) ||
        conv.last_message?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    if (ticketTab === 'assigned' && ticket.assigned_to_user_id !== user?.id) return false;
    if (ticketTab === 'open' && !['open', 'in_progress'].includes(ticket.status)) return false;
    
    if (ticketStatusFilter && ticket.status !== ticketStatusFilter) return false;
    
    if (ticketSearch) {
      const query = ticketSearch.toLowerCase();
      return (
        ticket.title?.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query) ||
        ticket.customer_name?.toLowerCase().includes(query) ||
        ticket.customer_email?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Tab counts
  const inboxTabCounts = {
    all: conversations.length,
    team: conversations.filter(c => c.assigned_to !== user?.id).length,
    me: conversations.filter(c => c.assigned_to === user?.id).length
  };

  const ticketTabCounts = {
    all: tickets.length,
    open: tickets.filter(t => ['open', 'in_progress'].includes(t.status)).length,
    assigned: tickets.filter(t => t.assigned_to_user_id === user?.id).length
  };

  const handleConversationClick = (conversation) => {
    setSelectedConversation(conversation.id);
    navigate(`/dashboard/conversations/${conversation.id}`);
  };

  const handleTicketClick = (ticket) => {
    setSelectedTicket(ticket.id);
    // TODO: Navigate to ticket detail or open modal
    toast.info(`Ticket: ${ticket.title}`);
  };

  const handleTicketCreated = (newTicket) => {
    setTickets(prev => [newTicket, ...prev]);
    fetchTicketsData(); // Refresh stats
  };

  // Loading skeleton
  if (loadingInbox && loadingTickets) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border animate-pulse">
          <div className="h-10 w-64 bg-muted rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Main Tabs Header */}
      <div className="border-b border-border bg-card">
        <div className="px-4 py-3">
          <Tabs value={mainTab} onValueChange={setMainTab}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="inbox" className="gap-2">
                <Inbox className="h-4 w-4" />
                Inbox
                {inboxTabCounts.all > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {inboxTabCounts.all}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tickets" className="gap-2">
                <Ticket className="h-4 w-4" />
                Tickets
                {ticketTabCounts.open > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {ticketTabCounts.open}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* INBOX TAB */}
        {mainTab === 'inbox' && (
          <div className="h-full flex flex-col">
            {/* Inbox Header */}
            <div className="p-4 border-b border-border bg-card/50">
              <div className="flex items-center gap-4">
                <h2 className="font-heading text-lg font-semibold">Conversations</h2>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={conversationSearch}
                    onChange={(e) => setConversationSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              
              {/* Sub-tabs */}
              <div className="mt-3">
                <Tabs value={inboxTab} onValueChange={setInboxTab}>
                  <TabsList className="bg-transparent p-0 h-auto gap-1">
                    <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm">
                      All {inboxTabCounts.all > 0 && `(${inboxTabCounts.all})`}
                    </TabsTrigger>
                    <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm">
                      Team {inboxTabCounts.team > 0 && `(${inboxTabCounts.team})`}
                    </TabsTrigger>
                    <TabsTrigger value="me" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm">
                      Me {inboxTabCounts.me > 0 && `(${inboxTabCounts.me})`}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Quick Stats Filter */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto">
              {[
                { key: 'needs_response', label: 'Needs Response', count: conversationStats?.waiting_conversations || 0, color: 'red' },
                { key: 'open', label: 'Open', count: conversationStats?.open_conversations || 0, color: 'blue' },
                { key: 'resolved', label: 'Resolved', count: conversationStats?.resolved_conversations || 0, color: 'green' },
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setConversationStatusFilter(conversationStatusFilter === filter.key ? null : filter.key)}
                  className={`
                    flex items-center gap-2 text-sm whitespace-nowrap px-3 py-1.5 rounded-full transition-all flex-shrink-0
                    ${conversationStatusFilter === filter.key 
                      ? `bg-${filter.color}-500 text-white` 
                      : `hover:bg-${filter.color}-500/10 text-muted-foreground`
                    }
                  `}
                >
                  <div className={`h-2 w-2 rounded-full bg-${filter.color}-500`} />
                  <span>{filter.label}</span>
                  <span className="font-semibold">{filter.count}</span>
                </button>
              ))}
              {conversationStatusFilter && (
                <button
                  onClick={() => setConversationStatusFilter(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted ml-auto"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredConversations.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      onClick={() => handleConversationClick(conversation)}
                      isSelected={selectedConversation === conversation.id}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState type="inbox" tab={inboxTab} />
              )}
            </div>
          </div>
        )}

        {/* TICKETS TAB */}
        {mainTab === 'tickets' && (
          <div className="h-full flex flex-col">
            {/* Tickets Header */}
            <div className="p-4 border-b border-border bg-card/50">
              <div className="flex items-center gap-4">
                <h2 className="font-heading text-lg font-semibold">Support Tickets</h2>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tickets..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Button onClick={() => setShowCreateTicket(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Ticket
                </Button>
              </div>
              
              {/* Sub-tabs */}
              <div className="mt-3">
                <Tabs value={ticketTab} onValueChange={setTicketTab}>
                  <TabsList className="bg-transparent p-0 h-auto gap-1">
                    <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm">
                      All {ticketTabCounts.all > 0 && `(${ticketTabCounts.all})`}
                    </TabsTrigger>
                    <TabsTrigger value="open" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm">
                      Open {ticketTabCounts.open > 0 && `(${ticketTabCounts.open})`}
                    </TabsTrigger>
                    <TabsTrigger value="assigned" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm">
                      Assigned to Me {ticketTabCounts.assigned > 0 && `(${ticketTabCounts.assigned})`}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Quick Stats Filter */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto">
              {[
                { key: 'open', label: 'Open', count: ticketStats?.open || 0, color: 'blue' },
                { key: 'in_progress', label: 'In Progress', count: ticketStats?.in_progress || 0, color: 'purple' },
                { key: 'waiting_on_customer', label: 'Waiting', count: ticketStats?.waiting_on_customer || 0, color: 'amber' },
                { key: 'resolved', label: 'Resolved', count: ticketStats?.resolved || 0, color: 'green' },
                { key: 'closed', label: 'Closed', count: ticketStats?.closed || 0, color: 'gray' },
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setTicketStatusFilter(ticketStatusFilter === filter.key ? null : filter.key)}
                  className={`
                    flex items-center gap-2 text-sm whitespace-nowrap px-3 py-1.5 rounded-full transition-all flex-shrink-0
                    ${ticketStatusFilter === filter.key 
                      ? `bg-${filter.color}-500 text-white` 
                      : `hover:bg-${filter.color}-500/10 text-muted-foreground`
                    }
                  `}
                >
                  <div className={`h-2 w-2 rounded-full bg-${filter.color}-500`} />
                  <span>{filter.label}</span>
                  <span className="font-semibold">{filter.count}</span>
                </button>
              ))}
              {ticketStatusFilter && (
                <button
                  onClick={() => setTicketStatusFilter(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted ml-auto"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {/* Ticket List */}
            <div className="flex-1 overflow-y-auto">
              {filteredTickets.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredTickets.map((ticket) => (
                    <TicketItem
                      key={ticket.id}
                      ticket={ticket}
                      onClick={() => handleTicketClick(ticket)}
                      isSelected={selectedTicket === ticket.id}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState type="tickets" tab={ticketTab} />
              )}
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {mainTab === 'tasks' && (
          <div className="h-full flex flex-col">
            <EmptyState type="tasks" tab="all" />
          </div>
        )}
      </div>

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={showCreateTicket}
        onOpenChange={setShowCreateTicket}
        onCreated={handleTicketCreated}
        token={token}
      />
    </div>
  );
};

export default Dashboard;
