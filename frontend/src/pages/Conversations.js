import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { MessageSquare, Search, Filter, Users, Bot, User, Wand2, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper: Check if conversation needs response (waiting for agent response > 1 hour)
const needsResponse = (conversation) => {
  if (conversation.status === 'resolved') return false;
  if (conversation.mode === 'ai') return false; // AI handles it
  
  // Check if last message was from customer and waiting > 1 hour
  if (conversation.last_message_at) {
    const hoursSinceLastMessage = differenceInHours(new Date(), new Date(conversation.last_message_at));
    // Needs response if waiting status OR open for > 1 hour
    return conversation.status === 'waiting' || (conversation.status === 'open' && hoursSinceLastMessage >= 1);
  }
  return conversation.status === 'waiting';
};

// Quick Filter Chip Component
const QuickFilterChip = ({ active, onClick, icon, label, count, variant = 'default' }) => (
  <button
    onClick={onClick}
    className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
      ${active 
        ? variant === 'destructive'
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-primary text-primary-foreground'
        : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
      }
    `}
  >
    {icon}
    {label}
    {count > 0 && (
      <span className={`
        ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold
        ${active ? 'bg-white/20' : 'bg-background'}
      `}>
        {count}
      </span>
    )}
  </button>
);

const Conversations = () => {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const statusFilter = searchParams.get('status') || 'all';

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        let url = `${API}/conversations`;
        if (statusFilter && statusFilter !== 'all') {
          url += `?status=${statusFilter}`;
        }
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConversations(response.data);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [token, statusFilter]);

  const handleStatusFilter = (value) => {
    if (value === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', value);
    }
    setSearchParams(searchParams);
  };

  const filteredConversations = conversations.filter(conv => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      conv.customer_name?.toLowerCase().includes(searchLower) ||
      conv.customer_email?.toLowerCase().includes(searchLower) ||
      conv.last_message?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="conversations-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">Conversations</h1>
        <p className="text-muted-foreground">Manage and respond to customer conversations</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
            data-testid="search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 h-10" data-testid="status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conversations</SelectItem>
            <SelectItem value="needs_response">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-destructive" />
                Needs Response
              </span>
            </SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <QuickFilterChip
          active={statusFilter === 'needs_response'}
          onClick={() => handleStatusFilter(statusFilter === 'needs_response' ? 'all' : 'needs_response')}
          icon={<AlertCircle className="h-3 w-3" />}
          label="Needs Response"
          count={conversations.filter(c => needsResponse(c)).length}
          variant="destructive"
        />
        <QuickFilterChip
          active={statusFilter === 'open'}
          onClick={() => handleStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          icon={<Clock className="h-3 w-3" />}
          label="Open"
          count={conversations.filter(c => c.status === 'open').length}
        />
        <QuickFilterChip
          active={statusFilter === 'waiting'}
          onClick={() => handleStatusFilter(statusFilter === 'waiting' ? 'all' : 'waiting')}
          icon={<MessageSquare className="h-3 w-3" />}
          label="Waiting"
          count={conversations.filter(c => c.status === 'waiting').length}
        />
      </div>

      {/* Conversations List */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : filteredConversations.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="divide-y divide-border">
                {filteredConversations.map((conversation) => (
                  <ConversationRow key={conversation.id} conversation={conversation} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">No conversations found</h3>
              <p className="text-muted-foreground text-sm">
                {statusFilter !== 'all'
                  ? `No ${statusFilter} conversations. Try a different filter.`
                  : 'Conversations will appear here when customers start chatting.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ConversationRow = ({ conversation }) => {
  const getModeIcon = (mode) => {
    switch (mode) {
      case 'ai':
        return <Bot className="h-3 w-3" />;
      case 'agent':
        return <User className="h-3 w-3" />;
      case 'assisted':
        return <Wand2 className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  return (
    <Link
      to={`/dashboard/conversations/${conversation.id}`}
      className="block hover:bg-muted/50 transition-colors"
      data-testid="conversation-row"
    >
      <div className="p-4 flex items-start sm:items-center gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
            <span className="font-medium text-sm">
              {conversation.customer_name || 'Anonymous'}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {conversation.customer_email}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {conversation.last_message || 'No messages yet'}
          </p>
          {/* Mobile: Show meta info below message */}
          <div className="flex items-center gap-2 mt-2 sm:hidden">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getModeIcon(conversation.mode)}
              <span className="capitalize">{conversation.mode}</span>
            </div>
            <StatusBadge status={conversation.status} />
            <span className="text-xs text-muted-foreground">
              {conversation.updated_at && formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Meta - Desktop only */}
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {getModeIcon(conversation.mode)}
            <span className="capitalize">{conversation.mode}</span>
          </div>
          <StatusBadge status={conversation.status} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {conversation.updated_at && formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
};

const StatusBadge = ({ status }) => {
  const variants = {
    open: { variant: 'default', label: 'Open' },
    waiting: { variant: 'secondary', label: 'Waiting' },
    resolved: { variant: 'outline', label: 'Resolved' }
  };
  const config = variants[status] || variants.open;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default Conversations;
