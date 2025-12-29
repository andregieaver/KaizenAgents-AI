import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Checkbox } from '../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { MessageSquare, Search, Filter, Users, Bot, User, Wand2, Clock, AlertCircle, Circle, CheckCircle, Trash2, Archive, Keyboard, Download, FileText } from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0
      ${active 
        ? variant === 'destructive'
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-primary text-primary-foreground'
        : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
      }
    `}
  >
    {icon}
    <span className="whitespace-nowrap">{label}</span>
    {count > 0 && (
      <span className={`
        px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap
        ${active ? 'bg-white/20' : 'bg-background'}
      `}>
        {count}
      </span>
    )}
  </button>
);

const Conversations = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const statusFilter = searchParams.get('status') || 'all';
  
  // Keyboard navigation & bulk selection state
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const listRef = useRef(null);
  
  // Scroll fade indicators for filter chips
  const filtersRef = useRef(null);
  const [filtersScroll, setFiltersScroll] = useState({ canScrollLeft: false, canScrollRight: false });
  
  const updateFiltersScrollState = useCallback(() => {
    const el = filtersRef.current;
    if (!el) return;
    const canScrollLeft = el.scrollLeft > 5;
    const canScrollRight = el.scrollLeft < (el.scrollWidth - el.clientWidth - 5);
    setFiltersScroll({ canScrollLeft, canScrollRight });
  }, []);
  
  useEffect(() => {
    const el = filtersRef.current;
    if (!el) return;
    updateFiltersScrollState();
    el.addEventListener('scroll', updateFiltersScrollState);
    window.addEventListener('resize', updateFiltersScrollState);
    return () => {
      el.removeEventListener('scroll', updateFiltersScrollState);
      window.removeEventListener('resize', updateFiltersScrollState);
    };
  }, [updateFiltersScrollState]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        let url = `${API}/conversations`;
        // needs_response is a client-side filter
        if (statusFilter && statusFilter !== 'all' && statusFilter !== 'needs_response') {
          url += `?conversation_status=${statusFilter}`;
        }
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConversations(response.data);
      } catch {
        // Conversations fetch failed silently
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
    // Apply needs_response filter
    if (statusFilter === 'needs_response' && !needsResponse(conv)) {
      return false;
    }
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      conv.customer_name?.toLowerCase().includes(searchLower) ||
      conv.customer_email?.toLowerCase().includes(searchLower) ||
      conv.last_message?.toLowerCase().includes(searchLower)
    );
  });
  
  // Keyboard shortcuts
  const handleNavigateNext = useCallback(() => {
    setSelectedIndex(prev => Math.min(prev + 1, filteredConversations.length - 1));
  }, [filteredConversations.length]);
  
  const handleNavigatePrev = useCallback(() => {
    setSelectedIndex(prev => Math.max(prev - 1, 0));
  }, []);
  
  const handleOpenSelected = useCallback(() => {
    if (selectedIndex >= 0 && filteredConversations[selectedIndex]) {
      navigate(`/dashboard/conversations/${filteredConversations[selectedIndex].id}`);
    }
  }, [selectedIndex, filteredConversations, navigate]);
  
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)));
    }
  }, [filteredConversations, selectedIds.size]);
  
  useKeyboardShortcuts({
    'j': handleNavigateNext,
    'k': handleNavigatePrev,
    'Enter': handleOpenSelected,
    '?': () => setShowShortcutsHelp(true),
    'Escape': () => {
      setSelectedIds(new Set());
      setSelectedIndex(-1);
    },
    'ctrl+a': handleSelectAll,
  }, !showShortcutsHelp);
  
  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-conversation-row]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);
  
  // Toggle selection
  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  
  // Bulk actions
  const handleBulkResolve = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          axios.patch(`${API}/conversations/${id}/status?new_status=resolved`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      toast.success(`${selectedIds.size} conversations resolved`);
      setSelectedIds(new Set());
      // Refresh
      const response = await axios.get(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch {
      toast.error('Failed to resolve some conversations');
    }
  };
  
  const handleBulkReopen = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          axios.patch(`${API}/conversations/${id}/status?new_status=open`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      );
      toast.success(`${selectedIds.size} conversations reopened`);
      setSelectedIds(new Set());
      // Refresh
      const response = await axios.get(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch {
      toast.error('Failed to reopen some conversations');
    }
  };

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="conversations-page">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">Conversations</h1>
          <p className="text-muted-foreground">Manage and respond to customer conversations</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowShortcutsHelp(true)}
          className="hidden sm:flex items-center gap-1 text-muted-foreground"
        >
          <Keyboard className="h-4 w-4" />
          <span className="text-xs">Press ? for shortcuts</span>
        </Button>
      </div>
      
      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in slide-in-from-top-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={handleBulkResolve}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Resolve
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkReopen}>
              <Archive className="h-4 w-4 mr-1" />
              Reopen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Filters - Search and Filter inline */}
      <div className="flex gap-2 mb-6">
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
        
        {/* Filter - Icon on mobile, full on desktop */}
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-10 sm:w-48 h-10 justify-center sm:justify-between" data-testid="status-filter">
            <div className="flex items-center">
              <Filter className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline sm:ml-2">
                <SelectValue placeholder="Filter status" />
              </span>
            </div>
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

      {/* Quick Filter Chips - Sticky with blur effect */}
      <div className="relative sticky top-0 z-10 -mx-4 sm:-mx-6 py-3 mb-4 border-b border-border backdrop-blur-md bg-background/95">
        <div 
          ref={filtersRef}
          className="flex items-center gap-2 px-4 sm:px-6 overflow-x-auto scrollbar-hide"
          onScroll={updateFiltersScrollState}
        >
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
        {/* Dynamic fade indicators based on scroll position */}
        {filtersScroll.canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none sm:hidden" />
        )}
        {filtersScroll.canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
        )}
      </div>

      {/* Conversations List */}
      <Card className="border border-border rounded-none sm:rounded-lg -mx-6 sm:mx-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : filteredConversations.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-400px)] sm:h-[calc(100vh-440px)]">
              <div ref={listRef}>
                {filteredConversations.map((conversation, index) => (
                  <ConversationRow 
                    key={conversation.id} 
                    conversation={conversation}
                    isSelected={selectedIds.has(conversation.id)}
                    isHighlighted={index === selectedIndex}
                    onToggleSelect={() => toggleSelection(conversation.id)}
                  />
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
      
      {/* Export Button - Below the list */}
      <div className="mt-4 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Conversations
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              window.open(`${BACKEND_URL}/api/conversations/export?format=csv`, '_blank');
              toast.success('Downloading CSV...');
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              window.open(`${BACKEND_URL}/api/conversations/export?format=json`, '_blank');
              toast.success('Downloading JSON...');
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              window.open(`${BACKEND_URL}/api/conversations/export?format=json&include_messages=true`, '_blank');
              toast.success('Downloading JSON with messages...');
            }}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Export with Messages (JSON)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp 
        context="conversations" 
        isOpen={showShortcutsHelp} 
        onClose={() => setShowShortcutsHelp(false)} 
      />
    </div>
  );
};

const ConversationRow = ({ conversation, isSelected, isHighlighted, onToggleSelect }) => {
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
  
  // Check if conversation has unread messages (last message from customer and not resolved)
  const hasUnread = conversation.has_unread || 
    (conversation.last_message_author === 'customer' && conversation.status !== 'resolved');

  return (
    <div
      data-conversation-row
      className={`
        flex items-center transition-colors border-b border-border last:border-b-0
        ${isHighlighted ? 'bg-primary/10 ring-1 ring-primary/30' : ''}
        ${isSelected ? 'bg-primary/5' : ''}
      `}
    >
      {/* Checkbox for bulk selection - hidden on mobile for cleaner look */}
      <div className="hidden sm:block pl-3 py-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4"
        />
      </div>
      
      <Link
        to={`/dashboard/conversations/${conversation.id}`}
        className="flex-1 block hover:bg-muted/50 transition-colors active:bg-muted"
        data-testid="conversation-row"
      >
        <div className="p-3 sm:p-4 sm:pl-2 flex items-start gap-3">
          {/* Avatar with unread indicator */}
          <div className="relative h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-muted-foreground" />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-primary rounded-full border-2 border-background" />
            )}
          </div>

          {/* Content - Mobile optimized */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className={`font-medium text-sm truncate ${hasUnread ? 'text-foreground' : ''}`}>
                {conversation.customer_name || 'Anonymous'}
                {hasUnread && (
                  <Circle className="inline-block h-2 w-2 ml-1.5 fill-primary text-primary" />
                )}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                {conversation.updated_at && formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground truncate mb-1.5 sm:hidden">
              {conversation.customer_email}
            </p>
            
            <p className={`text-sm truncate ${hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {conversation.last_message || 'No messages yet'}
            </p>
            
            {/* Meta row - always visible, compact on mobile */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getModeIcon(conversation.mode)}
                <span className="capitalize hidden sm:inline">{conversation.mode}</span>
              </div>
              <StatusBadge status={conversation.status} />
              <span className="text-xs text-muted-foreground truncate hidden sm:block">
                {conversation.customer_email}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
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
