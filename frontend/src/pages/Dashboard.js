import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Input } from '../components/ui/input';
import {
  Users,
  User,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Facebook,
  Instagram,
  Mail,
  Phone,
  RefreshCw,
  Inbox,
  Archive,
  Star,
  StarOff,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';

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
    phone: <Phone className={className} />,
  };
  return icons[source?.toLowerCase()] || <MessageSquare className={className} />;
};

// Status badge component
const StatusBadge = ({ status }) => {
  const configs = {
    open: { variant: 'default', label: 'Open', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    waiting: { variant: 'secondary', label: 'Waiting', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    needs_response: { variant: 'destructive', label: 'Needs Response', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    resolved: { variant: 'outline', label: 'Resolved', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    archived: { variant: 'outline', label: 'Archived', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' }
  };
  const config = configs[status] || configs.open;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
};

// Priority indicator
const PriorityIndicator = ({ priority }) => {
  if (!priority || priority === 'normal') return null;
  const colors = {
    high: 'bg-red-500',
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
    // TODO: API call to update starred status
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
      {/* Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={resolveImageUrl(conversation.customer_avatar)} />
        <AvatarFallback className="bg-primary/10 text-primary">
          {conversation.customer_name?.charAt(0)?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
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
            <StatusBadge status={conversation.status} />
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

// Empty state component
const EmptyState = ({ tab }) => {
  const messages = {
    all: {
      icon: Inbox,
      title: 'Your inbox is empty',
      description: 'Conversations from all channels will appear here when customers reach out.'
    },
    team: {
      icon: Users,
      title: 'No team conversations',
      description: 'Conversations assigned to your team will appear here.'
    },
    me: {
      icon: User,
      title: 'No conversations assigned to you',
      description: 'Conversations specifically assigned to you will appear here.'
    }
  };
  
  const config = messages[tab] || messages.all;
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

const Dashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [statsRes, conversationsRes] = await Promise.all([
        axios.get(`${API}/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setStats(statsRes.data);
      setConversations(conversationsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter conversations based on tab, status filter, and search
  const filteredConversations = conversations.filter(conv => {
    // Tab filter
    if (activeTab === 'me' && conv.assigned_to !== user?.id) return false;
    if (activeTab === 'team' && conv.assigned_to === user?.id) return false;
    
    // Status filter from Quick Stats Bar
    if (activeStatusFilter) {
      if (activeStatusFilter === 'needs_response' && conv.status !== 'needs_response' && conv.status !== 'waiting') return false;
      if (activeStatusFilter === 'open' && conv.status !== 'open') return false;
      if (activeStatusFilter === 'resolved_today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const convDate = new Date(conv.resolved_at || conv.updated_at);
        if (conv.status !== 'resolved' || convDate < today) return false;
      }
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        conv.customer_name?.toLowerCase().includes(query) ||
        conv.customer_email?.toLowerCase().includes(query) ||
        conv.last_message?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Calculate tab counts
  const tabCounts = {
    all: conversations.length,
    team: conversations.filter(c => c.assigned_to !== user?.id).length,
    me: conversations.filter(c => c.assigned_to === user?.id).length
  };

  // Toggle status filter
  const toggleStatusFilter = (filter) => {
    setActiveStatusFilter(activeStatusFilter === filter ? null : filter);
  };

  const handleConversationClick = (conversation) => {
    setSelectedConversation(conversation.id);
    navigate(`/dashboard/conversations/${conversation.id}`);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border animate-pulse">
          <div className="h-6 w-32 bg-muted rounded mb-4" />
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
    <div className="h-full flex flex-col bg-background" data-testid="dashboard-inbox">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">Inbox</h1>
            <p className="text-sm text-muted-foreground">
              {stats?.waiting_conversations || 0} conversations need attention
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                  Needs Response
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Clock className="h-4 w-4 mr-2 text-amber-500" />
                  Waiting
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Resolved
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Archive className="h-4 w-4 mr-2" />
                  Show Archived
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-1">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm"
            >
              <Inbox className="h-4 w-4 mr-2" />
              All
              {tabCounts.all > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {tabCounts.all}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm"
            >
              <Users className="h-4 w-4 mr-2" />
              Team
              {tabCounts.team > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {tabCounts.team}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="me"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-1.5 text-sm"
            >
              <User className="h-4 w-4 mr-2" />
              Me
              {tabCounts.me > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {tabCounts.me}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Scrollable content area with sticky Quick Stats */}
      <div className="flex-1 overflow-y-auto scrollbar-hide relative">
        {/* Quick Stats Bar - Clickable Filters - Sticky on scroll */}
        <div className="relative border-b border-border sticky top-0 z-10 backdrop-blur-md bg-background/95">
          <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => toggleStatusFilter('needs_response')}
              className={`
                flex items-center gap-2 text-sm whitespace-nowrap px-3 py-1.5 rounded-full transition-all flex-shrink-0
                ${activeStatusFilter === 'needs_response' 
                  ? 'bg-red-500 text-white shadow-sm' 
                  : 'hover:bg-red-500/10 text-muted-foreground hover:text-red-600'
                }
              `}
            >
              <div className={`h-2 w-2 rounded-full ${activeStatusFilter === 'needs_response' ? 'bg-white' : 'bg-red-500'}`} />
              <span>Needs Response</span>
              <span className={`font-semibold ${activeStatusFilter === 'needs_response' ? 'text-white' : 'text-foreground'}`}>
                {stats?.waiting_conversations || 0}
              </span>
            </button>
            
            <button
              onClick={() => toggleStatusFilter('open')}
              className={`
                flex items-center gap-2 text-sm whitespace-nowrap px-3 py-1.5 rounded-full transition-all flex-shrink-0
                ${activeStatusFilter === 'open' 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600'
                }
              `}
            >
              <div className={`h-2 w-2 rounded-full ${activeStatusFilter === 'open' ? 'bg-white' : 'bg-blue-500'}`} />
              <span>Open</span>
              <span className={`font-semibold ${activeStatusFilter === 'open' ? 'text-white' : 'text-foreground'}`}>
                {stats?.open_conversations || 0}
              </span>
            </button>
            
            <button
              onClick={() => toggleStatusFilter('resolved_today')}
              className={`
                flex items-center gap-2 text-sm whitespace-nowrap px-3 py-1.5 rounded-full transition-all flex-shrink-0
                ${activeStatusFilter === 'resolved_today' 
                  ? 'bg-green-500 text-white shadow-sm' 
                  : 'hover:bg-green-500/10 text-muted-foreground hover:text-green-600'
                }
              `}
            >
              <div className={`h-2 w-2 rounded-full ${activeStatusFilter === 'resolved_today' ? 'bg-white' : 'bg-green-500'}`} />
              <span>Resolved Today</span>
              <span className={`font-semibold ${activeStatusFilter === 'resolved_today' ? 'text-white' : 'text-foreground'}`}>
                {stats?.resolved_today || 0}
              </span>
            </button>
            
            <div className="flex items-center gap-2 text-sm whitespace-nowrap px-3 py-1.5 text-muted-foreground flex-shrink-0">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span>Avg Response:</span>
              <span className="font-semibold text-foreground">{stats?.avg_response_time || '< 1m'}</span>
            </div>
            
            {activeStatusFilter && (
              <button
                onClick={() => setActiveStatusFilter(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors ml-auto flex-shrink-0"
              >
                <X className="h-3 w-3" />
                Clear filter
              </button>
            )}
          </div>
          {/* Stronger gradient fade on left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background via-background/90 to-transparent pointer-events-none" />
          {/* Stronger gradient fade on right edge */}
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background via-background/90 to-transparent pointer-events-none" />
        </div>

        {/* Conversation List */}
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
          <EmptyState tab={activeTab} />
        )}
      </div>

      {/* Source Legend - Footer */}
      <div className="relative border-t border-border bg-muted/30">
        <div className="flex items-center justify-center gap-4 p-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Chat Widget</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground opacity-50 whitespace-nowrap">
            <Facebook className="h-3.5 w-3.5" />
            <span>Facebook</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">Soon</Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground opacity-50 whitespace-nowrap">
            <Instagram className="h-3.5 w-3.5" />
            <span>Instagram</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">Soon</Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground opacity-50 whitespace-nowrap">
            <Mail className="h-3.5 w-3.5" />
            <span>Email</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">Soon</Badge>
          </div>
        </div>
        {/* Stronger gradient fade on left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none sm:hidden" />
        {/* Stronger gradient fade on right edge */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none sm:hidden" />
      </div>
    </div>
  );
};

export default Dashboard;
