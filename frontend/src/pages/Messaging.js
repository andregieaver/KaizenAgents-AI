import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { 
  Hash, 
  Lock, 
  Plus, 
  Send, 
  Search, 
  Smile, 
  Paperclip, 
  MoreHorizontal,
  Users,
  MessageSquare,
  AtSign,
  X,
  ChevronDown,
  ChevronRight,
  Circle,
  Edit2,
  Trash2,
  Reply,
  Settings,
  UserPlus,
  Link2,
  ArrowLeft,
  Menu,
  Bot,
  Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const API = process.env.REACT_APP_BACKEND_URL;

// Emoji picker component
const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀', '✅', '❌'];

const EmojiPicker = ({ onSelect, onClose }) => (
  <div className="absolute bottom-full mb-2 bg-popover border rounded-lg shadow-lg p-2 flex gap-1 z-50">
    {EMOJI_LIST.map(emoji => (
      <button
        key={emoji}
        onClick={() => { onSelect(emoji); onClose(); }}
        className="hover:bg-muted p-1 rounded text-lg transition-transform hover:scale-125"
      >
        {emoji}
      </button>
    ))}
  </div>
);

// Date separator component
const DateSeparator = ({ date }) => {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return d.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };
  
  return (
    <div className="flex items-center gap-4 py-4">
      <Separator className="flex-1" />
      <span className="text-xs font-medium text-muted-foreground px-2 bg-background">
        {formatDate(date)}
      </span>
      <Separator className="flex-1" />
    </div>
  );
};

// Message component
const MessageItem = ({ 
  message, 
  currentUserId, 
  onReaction, 
  onReply, 
  onEdit, 
  onDelete,
  isThreadView = false 
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const isOwn = message.author_id === currentUserId;
  const isAgent = message.is_agent || message.author_id?.startsWith('agent_');
  
  const handleEdit = () => {
    onEdit(message.id, editContent);
    setIsEditing(false);
  };

  return (
    <div className={`group flex gap-2 sm:gap-3 px-1 py-2 sm:p-3 hover:bg-muted/50 rounded-lg transition-colors ${isAgent ? 'bg-primary/5' : ''}`}>
      <Avatar className={`h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 ${isAgent ? 'ring-2 ring-primary/30' : ''}`}>
        <AvatarImage src={message.author_avatar} />
        <AvatarFallback className={`text-sm ${isAgent ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
          {isAgent ? <Bot className="h-4 w-4" /> : message.author_name?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{message.author_name}</span>
          {isAgent && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
          {message.is_edited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>
        
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{message.content}</p>
        )}
        
        {/* Attachments */}
        {message.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map((att, i) => (
              <a
                key={i}
                href={`${API}${att.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80"
              >
                <Paperclip className="h-4 w-4" />
                {att.original_name}
              </a>
            ))}
          </div>
        )}
        
        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReaction(message.id, emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  users.includes(currentUserId) 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted border-transparent hover:border-border'
                }`}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            ))}
          </div>
        )}
        
        {/* Thread replies count */}
        {!isThreadView && message.reply_count > 0 && (
          <button
            onClick={() => onReply(message)}
            className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
          >
            <MessageSquare className="h-3 w-3" />
            {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
      
      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
        <div className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add reaction</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {showEmojiPicker && (
            <EmojiPicker 
              onSelect={(emoji) => onReaction(message.id, emoji)} 
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>
        
        {!isThreadView && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => onReply(message)}
                >
                  <Reply className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply in thread</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {isOwn && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(message.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

// Thread panel component
const ThreadPanel = ({ parentMessage, currentUserId, token, onClose, onReaction }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  
  const fetchThreadMessages = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/messaging/messages`, {
        params: { parent_id: parentMessage.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
    } catch {
      toast.error('Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [parentMessage.id, token]);
  
  useEffect(() => {
    fetchThreadMessages();
  }, [fetchThreadMessages]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const sendReply = async () => {
    if (!newMessage.trim()) return;
    
    try {
      await axios.post(`${API}/api/messaging/messages`, null, {
        params: {
          content: newMessage,
          channel_id: parentMessage.channel_id,
          dm_conversation_id: parentMessage.dm_conversation_id,
          parent_id: parentMessage.id
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
      fetchThreadMessages();
    } catch {
      toast.error('Failed to send reply');
    }
  };
  
  return (
    <div className="fixed inset-0 sm:relative sm:inset-auto w-full sm:w-96 border-l flex flex-col bg-background z-50">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Thread</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Parent message */}
      <div className="border-b">
        <MessageItem 
          message={parentMessage} 
          currentUserId={currentUserId}
          onReaction={onReaction}
          onReply={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          isThreadView
        />
      </div>
      
      {/* Thread replies */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No replies yet
            </div>
          ) : (
            messages.map(msg => (
              <MessageItem
                key={msg.id}
                message={msg}
                currentUserId={currentUserId}
                onReaction={onReaction}
                onReply={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                isThreadView
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      {/* Reply input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Reply..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
          />
          <Button onClick={sendReply} disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Messaging component
const Messaging = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = localStorage.getItem('token');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Data states
  const [channels, setChannels] = useState([]);
  const [dmConversations, setDmConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [channelAgents, setChannelAgents] = useState([]);
  
  // UI states
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDM, setSelectedDM] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [threadMessage, setThreadMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true); // Show sidebar by default on mobile
  
  // New channel form
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [newChannelCustomer, setNewChannelCustomer] = useState('');
  
  // Refs
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedChannelRef = useRef(null);
  const selectedDMRef = useRef(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);
  
  useEffect(() => {
    selectedDMRef.current = selectedDM;
  }, [selectedDM]);
  
  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get(`${API}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUser(res.data);
      } catch {
        // User fetch failed silently
      }
    };
    fetchCurrentUser();
  }, [token]);
  
  // Fetch channels and DMs
  const fetchChannels = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/messaging/channels`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChannels(res.data);
    } catch {
      // Channels fetch failed silently
    }
  }, [token]);
  
  const fetchDMs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/messaging/dm`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDmConversations(res.data);
    } catch {
      // DMs fetch failed silently
    }
  }, [token]);
  
  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/messaging/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch {
      // Users fetch failed silently
    }
  }, [token]);
  
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/crm/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data);
    } catch {
      // Customers fetch failed silently
    }
  }, [token]);
  
  const fetchAvailableAgents = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/messaging/agents/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableAgents(res.data);
    } catch {
      // Agents fetch failed silently
    }
  }, [token]);
  
  const fetchChannelAgents = useCallback(async (channelId) => {
    try {
      const res = await axios.get(`${API}/api/messaging/channels/${channelId}/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChannelAgents(res.data);
    } catch {
      setChannelAgents([]);
    }
  }, [token]);
  
  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchChannels(),
        fetchDMs(),
        fetchUsers(),
        fetchCustomers(),
        fetchAvailableAgents()
      ]);
    };
    loadData();
  }, [fetchChannels, fetchDMs, fetchUsers, fetchCustomers, fetchAvailableAgents]);
  
  // Handle URL params for deep linking
  useEffect(() => {
    const channelId = searchParams.get('channel');
    const dmId = searchParams.get('dm');
    
    const selectFromParams = () => {
      if (channelId && channels.length > 0) {
        const channel = channels.find(c => c.id === channelId);
        if (channel) {
          setSelectedChannel(channel);
          setSelectedDM(null);
        }
      } else if (dmId && dmConversations.length > 0) {
        const dm = dmConversations.find(d => d.id === dmId);
        if (dm) {
          setSelectedDM(dm);
          setSelectedChannel(null);
        }
      } else if (!channelId && !dmId && channels.length > 0) {
        // Select first channel by default
        setSelectedChannel(channels[0]);
      }
    };
    selectFromParams();
  }, [searchParams, channels, dmConversations]);
  
  // Fetch messages when channel/DM changes
  const fetchMessages = useCallback(async () => {
    if (!selectedChannel && !selectedDM) return;
    
    try {
      const params = selectedChannel 
        ? { channel_id: selectedChannel.id }
        : { dm_conversation_id: selectedDM.id };
      
      const res = await axios.get(`${API}/api/messaging/messages`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
    } catch {
      // Messages fetch failed silently
    }
  }, [selectedChannel, selectedDM, token]);
  
  useEffect(() => {
    const loadMessages = async () => {
      await fetchMessages();
    };
    loadMessages();
  }, [fetchMessages]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // WebSocket connection with reconnection
  useEffect(() => {
    if (!token) return;
    
    let ws = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connect = () => {
      const wsUrl = API.replace('http', 'ws').replace('https', 'wss') + `/api/messaging/ws?token=${token}`;
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            // Add new message if it belongs to current channel/DM (use refs for current values)
            const currentChannel = selectedChannelRef.current;
            const currentDM = selectedDMRef.current;
            if (
              (currentChannel && data.payload.channel_id === currentChannel.id) ||
              (currentDM && data.payload.dm_conversation_id === currentDM.id)
            ) {
              setMessages(prev => [...prev, data.payload]);
            }
            // Update unread counts
            fetchChannels();
            fetchDMs();
            break;
            
          case 'message_update':
            setMessages(prev => prev.map(m => 
              m.id === data.payload.id ? data.payload : m
            ));
            break;
            
          case 'message_delete':
            setMessages(prev => prev.filter(m => m.id !== data.payload.message_id));
            break;
            
          case 'reaction_add':
          case 'reaction_remove':
            setMessages(prev => prev.map(m => 
              m.id === data.payload.message_id 
                ? { ...m, reactions: data.payload.reactions }
                : m
            ));
            break;
            
          case 'typing':
            const key = data.payload.channel_id || data.payload.dm_conversation_id;
            if (data.payload.is_typing) {
              setTypingUsers(prev => ({
                ...prev,
                [key]: { ...prev[key], [data.payload.user_id]: data.payload.user_name }
              }));
            } else {
              setTypingUsers(prev => {
                const newState = { ...prev };
                if (newState[key]) {
                  delete newState[key][data.payload.user_id];
                }
                return newState;
              });
            }
            break;
            
          case 'presence':
            setUsers(prev => prev.map(u => 
              u.id === data.payload.user_id 
                ? { ...u, is_online: data.payload.status === 'online' }
                : u
            ));
            break;
            
          case 'channel_update':
            fetchChannels();
            break;
            
          case 'notification':
            toast.info(data.payload.title, {
              description: data.payload.message
            });
            break;
            
          default:
            break;
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectAttempts++;
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };
      
      wsRef.current = ws;
    };
    
    connect();
    
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [token, fetchChannels, fetchDMs]);
  
  // Polling fallback for real-time updates (when WebSocket is unreliable)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      const currentChannel = selectedChannelRef.current;
      const currentDM = selectedDMRef.current;
      
      // Only poll if we have a selected channel/DM
      if (currentChannel || currentDM) {
        // Fetch latest messages
        const fetchLatest = async () => {
          try {
            const params = {};
            if (currentChannel) params.channel_id = currentChannel.id;
            if (currentDM) params.dm_conversation_id = currentDM.id;
            params.limit = 50;
            
            const response = await axios.get(`${API}/api/messaging/messages`, {
              params,
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data) {
              setMessages(prev => {
                // Merge new messages, avoiding duplicates
                const existingIds = new Set(prev.map(m => m.id));
                const newMessages = response.data.filter(m => !existingIds.has(m.id));
                if (newMessages.length > 0) {
                  return [...prev, ...newMessages].sort((a, b) => 
                    new Date(a.created_at) - new Date(b.created_at)
                  );
                }
                return prev;
              });
            }
          } catch (err) {
            // Silent fail for polling
          }
        };
        
        fetchLatest();
      }
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(pollInterval);
  }, [token]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Extract mentions from message
    const mentionRegex = /@(\w+)/g;
    const mentionedNames = [...newMessage.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
    const mentionedUserIds = users
      .filter(u => mentionedNames.includes(u.name?.toLowerCase()))
      .map(u => u.id);
    
    try {
      await axios.post(`${API}/api/messaging/messages`, null, {
        params: {
          content: newMessage,
          channel_id: selectedChannel?.id,
          dm_conversation_id: selectedDM?.id,
          mentions: mentionedUserIds.length > 0 ? mentionedUserIds : undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
    } catch {
      toast.error('Failed to send message');
    }
  };
  
  // Handle typing indicator
  const handleTyping = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        payload: {
          channel_id: selectedChannel?.id,
          dm_conversation_id: selectedDM?.id,
          is_typing: true
        }
      }));
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'typing',
            payload: {
              channel_id: selectedChannel?.id,
              dm_conversation_id: selectedDM?.id,
              is_typing: false
            }
          }));
        }
      }, 2000);
    }
  };
  
  // Create channel
  const createChannel = async () => {
    if (!newChannelName.trim()) return;
    
    try {
      await axios.post(`${API}/api/messaging/channels`, null, {
        params: {
          name: newChannelName,
          description: newChannelDescription,
          is_private: newChannelPrivate,
          linked_customer_id: newChannelCustomer && newChannelCustomer !== 'none' ? newChannelCustomer : undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreateChannel(false);
      setNewChannelName('');
      setNewChannelDescription('');
      setNewChannelPrivate(false);
      setNewChannelCustomer('');
      fetchChannels();
      toast.success('Channel created');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create channel');
    }
  };
  
  // Start DM
  const startDM = async (userId) => {
    try {
      const res = await axios.post(`${API}/api/messaging/dm`, null, {
        params: { participant_id: userId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedDM(res.data);
      setSelectedChannel(null);
      setShowNewDM(false);
      fetchDMs();
      setSearchParams({ dm: res.data.id });
    } catch {
      toast.error('Failed to start conversation');
    }
  };
  
  // Add reaction
  const addReaction = async (messageId, emoji) => {
    try {
      await axios.post(`${API}/api/messaging/messages/${messageId}/reactions`, null, {
        params: { emoji },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      toast.error('Failed to add reaction');
    }
  };
  
  // Edit message
  const editMessage = async (messageId, content) => {
    try {
      await axios.put(`${API}/api/messaging/messages/${messageId}`, null, {
        params: { content },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      toast.error('Failed to edit message');
    }
  };
  
  // Delete message
  const deleteMessage = async (messageId) => {
    try {
      await axios.delete(`${API}/api/messaging/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch {
      toast.error('Failed to delete message');
    }
  };
  
  // Search messages
  const searchMessages = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const res = await axios.get(`${API}/api/messaging/search`, {
        params: { q: searchQuery },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(res.data);
    } catch {
      toast.error('Search failed');
    }
  };
  
  // Add agent to channel
  const addAgentToChannel = async (agentId) => {
    if (!selectedChannel) return;
    
    try {
      await axios.post(`${API}/api/messaging/channels/${selectedChannel.id}/agents`, null, {
        params: { agent_id: agentId },
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent added to channel');
      fetchChannelAgents(selectedChannel.id);
      fetchChannels();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add agent');
    }
  };
  
  // Add multiple agents to channel
  const addMultipleAgentsToChannel = async (agentIds) => {
    if (!selectedChannel || agentIds.length === 0) return;
    
    try {
      // Add agents one by one (could be optimized with a bulk endpoint)
      for (const agentId of agentIds) {
        await axios.post(`${API}/api/messaging/channels/${selectedChannel.id}/agents`, null, {
          params: { agent_id: agentId },
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      toast.success(`${agentIds.length} agent(s) added to channel`);
      fetchChannelAgents(selectedChannel.id);
      fetchChannels();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add agents');
    }
  };
  
  // Remove agent from channel
  const removeAgentFromChannel = async (agentId) => {
    if (!selectedChannel) return;
    
    try {
      await axios.delete(`${API}/api/messaging/channels/${selectedChannel.id}/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent removed from channel');
      fetchChannelAgents(selectedChannel.id);
      fetchChannels();
    } catch {
      toast.error('Failed to remove agent');
    }
  };
  
  // Update channel
  const updateChannel = async (channelId, updates) => {
    try {
      const response = await axios.patch(`${API}/api/messaging/channels/${channelId}`, null, {
        params: updates,
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Channel updated');
      fetchChannels();
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(response.data);
      }
      return response.data;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update channel');
      return null;
    }
  };
  
  // Delete channel
  const deleteChannel = async (channelId) => {
    try {
      await axios.delete(`${API}/api/messaging/channels/${channelId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Channel deleted');
      fetchChannels();
      if (selectedChannel?.id === channelId) {
        setSelectedChannel(null);
        setSearchParams({});
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete channel');
    }
  };
  
  // Start DM with agent
  const startAgentDM = async (agentId) => {
    try {
      const response = await axios.post(`${API}/api/messaging/dm`, null, {
        params: { participant_id: agentId, is_agent: true },
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDMs();
      handleSelectDM(response.data);
      toast.success('Started conversation with agent');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start DM');
    }
  };
  
  // Get typing indicator text
  const getTypingText = () => {
    const key = selectedChannel?.id || selectedDM?.id;
    const typing = typingUsers[key];
    if (!typing) return null;
    
    const names = Object.values(typing);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names.length} people are typing...`;
  };
  
  // Select channel
  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setSelectedDM(null);
    setThreadMessage(null);
    setSearchParams({ channel: channel.id });
    setShowMobileSidebar(false); // Hide sidebar on mobile when selecting
  };
  
  // Select DM
  const handleSelectDM = (dm) => {
    setSelectedDM(dm);
    setSelectedChannel(null);
    setThreadMessage(null);
    setSearchParams({ dm: dm.id });
    setShowMobileSidebar(false); // Hide sidebar on mobile when selecting
  };
  
  const currentKey = selectedChannel?.id || selectedDM?.id;
  const typingText = getTypingText();
  
  // Determine if we should show chat on mobile (when a channel/DM is selected)
  const showChatOnMobile = (selectedChannel || selectedDM) && !showMobileSidebar;
  
  return (
    <div className="h-[calc(100vh-120px)] flex bg-background rounded-lg border overflow-hidden">
      {/* Sidebar - Hidden on mobile when chat is shown */}
      <div className={`
        ${showChatOnMobile ? 'hidden' : 'flex'} 
        sm:flex
        w-full sm:w-64 border-r flex-col bg-muted/30
      `}>
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchMessages()}
              onFocus={() => setShowSearch(true)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Channels section */}
            <div className="mb-4">
              <button
                onClick={() => setChannelsExpanded(!channelsExpanded)}
                className="flex items-center gap-1 w-full px-2 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {channelsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Channels
              </button>
              
              {channelsExpanded && (
                <div className="mt-1 space-y-0.5">
                  {channels.map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => handleSelectChannel(channel)}
                      className={`flex items-center gap-2 w-full px-2 py-2 sm:py-1.5 rounded text-sm transition-colors ${
                        selectedChannel?.id === channel.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      {channel.is_private ? (
                        <Lock className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <Hash className="h-4 w-4 flex-shrink-0" />
                      )}
                      <span className="truncate flex-1 text-left">{channel.name}</span>
                      {channel.unread_count > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                          {channel.unread_count}
                        </Badge>
                      )}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="flex items-center gap-2 w-full px-2 py-2 sm:py-1.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                    Add channel
                  </button>
                </div>
              )}
            </div>
            
            {/* Direct Messages section */}
            <div>
              <button
                onClick={() => setDmsExpanded(!dmsExpanded)}
                className="flex items-center gap-1 w-full px-2 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {dmsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Direct Messages
              </button>
              
              {dmsExpanded && (
                <div className="mt-1 space-y-0.5">
                  {dmConversations.map(dm => (
                    <button
                      key={dm.id}
                      onClick={() => handleSelectDM(dm)}
                      className={`flex items-center gap-2 w-full px-2 py-2 sm:py-1.5 rounded text-sm transition-colors ${
                        selectedDM?.id === dm.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="h-6 w-6 sm:h-5 sm:w-5">
                          <AvatarFallback className="text-xs">
                            {dm.other_user?.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {dm.is_online && (
                          <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-green-500 text-green-500" />
                        )}
                      </div>
                      <span className="truncate flex-1 text-left">{dm.other_user?.name}</span>
                      {dm.unread_count > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                          {dm.unread_count}
                        </Badge>
                      )}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setShowNewDM(true)}
                    className="flex items-center gap-2 w-full px-2 py-2 sm:py-1.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                    New message
                  </button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        
        {/* User status */}
        {currentUser && (
          <div className="p-3 border-t flex items-center gap-2">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser.avatar_url} />
                <AvatarFallback>{currentUser.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Main chat area - Full width on mobile when visible */}
      <div className={`
        ${showChatOnMobile ? 'flex' : 'hidden'} 
        sm:flex
        flex-1 flex-col
      `}>
        {selectedChannel || selectedDM ? (
          <>
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-3 sm:px-4">
              <div className="flex items-center gap-2">
                {/* Back button for mobile */}
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="sm:hidden h-8 w-8"
                  onClick={() => setShowMobileSidebar(true)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                
                {selectedChannel ? (
                  <>
                    {selectedChannel.is_private ? (
                      <Lock className="h-5 w-5 text-muted-foreground hidden sm:block" />
                    ) : (
                      <Hash className="h-5 w-5 text-muted-foreground hidden sm:block" />
                    )}
                    <div className="min-w-0">
                      <h2 className="font-semibold text-sm sm:text-base truncate">
                        {selectedChannel.is_private && <Lock className="h-3.5 w-3.5 inline mr-1 sm:hidden" />}
                        {!selectedChannel.is_private && <span className="sm:hidden">#</span>}
                        {selectedChannel.display_name || selectedChannel.name}
                      </h2>
                      {selectedChannel.description && (
                        <p className="text-xs text-muted-foreground truncate hidden sm:block">{selectedChannel.description}</p>
                      )}
                    </div>
                    {selectedChannel.linked_customer_name && (
                      <Badge variant="outline" className="ml-2 hidden sm:flex">
                        <Link2 className="h-3 w-3 mr-1" />
                        {selectedChannel.linked_customer_name}
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {selectedDM.other_user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-sm sm:text-base truncate">{selectedDM.other_user?.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedDM.is_online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2">
                {selectedChannel && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Users className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {selectedChannel.members?.length || 0} members
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setShowChannelSettings(true);
                        fetchChannelAgents(selectedChannel.id);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="px-1 py-2 sm:p-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    // Check if we need a date separator
                    const showDateSeparator = index === 0 || 
                      new Date(msg.created_at).toDateString() !== 
                      new Date(messages[index - 1].created_at).toDateString();
                    
                    return (
                      <div key={msg.id}>
                        {showDateSeparator && (
                          <DateSeparator date={msg.created_at} />
                        )}
                        <MessageItem
                          message={msg}
                          currentUserId={currentUser?.id}
                          onReaction={addReaction}
                          onReply={(msg) => setThreadMessage(msg)}
                          onEdit={editMessage}
                          onDelete={deleteMessage}
                        />
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* Typing indicator */}
            {typingText && (
              <div className="px-4 py-1 text-xs text-muted-foreground animate-pulse">
                {typingText}
              </div>
            )}
            
            {/* Message input */}
            <div className="p-2 sm:p-4 border-t">
              <div className="flex items-end gap-1 sm:gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach file</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <div className="flex-1 relative">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder={`Message ${selectedChannel ? `#${selectedChannel.name}` : selectedDM?.other_user?.name}`}
                    className="min-h-[40px] max-h-[120px] pr-10 sm:pr-20 resize-none text-sm sm:text-base"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <div className="absolute right-2 bottom-2 items-center gap-1 hidden sm:flex">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <AtSign className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mention someone</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Smile className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add emoji</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                <Button 
                  onClick={sendMessage} 
                  disabled={!newMessage.trim()}
                  className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-auto sm:px-4"
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-1">Welcome to Messaging</h3>
              <p className="text-sm">Select a channel or start a conversation</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Thread panel */}
      {threadMessage && (
        <ThreadPanel
          parentMessage={threadMessage}
          currentUserId={currentUser?.id}
          token={token}
          onClose={() => setThreadMessage(null)}
          onReaction={addReaction}
        />
      )}
      
      {/* Search results modal */}
      <Dialog open={showSearch && searchResults.length > 0} onOpenChange={() => setShowSearch(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Search Results</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {searchResults.map(msg => (
              <div 
                key={msg.id}
                className="p-3 border-b hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  if (msg.channel_id) {
                    const channel = channels.find(c => c.id === msg.channel_id);
                    if (channel) handleSelectChannel(channel);
                  } else if (msg.dm_conversation_id) {
                    const dm = dmConversations.find(d => d.id === msg.dm_conversation_id);
                    if (dm) handleSelectDM(dm);
                  }
                  setShowSearch(false);
                  setSearchResults([]);
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{msg.author_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Create channel dialog */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="channelName">Channel name</Label>
              <Input
                id="channelName"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="e.g. marketing"
              />
            </div>
            <div>
              <Label htmlFor="channelDesc">Description (optional)</Label>
              <Textarea
                id="channelDesc"
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                placeholder="What's this channel about?"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="privateChannel">Private channel</Label>
                <p className="text-xs text-muted-foreground">Only invited members can see this channel</p>
              </div>
              <Switch
                id="privateChannel"
                checked={newChannelPrivate}
                onCheckedChange={setNewChannelPrivate}
              />
            </div>
            <div>
              <Label htmlFor="linkedCustomer">Link to CRM Customer (optional)</Label>
              <Select value={newChannelCustomer} onValueChange={setNewChannelCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateChannel(false)}>Cancel</Button>
            <Button onClick={createChannel} disabled={!newChannelName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* New DM dialog */}
      <Dialog open={showNewDM} onOpenChange={setShowNewDM}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {users.filter(u => u.id !== currentUser?.id).map(user => (
              <button
                key={user.id}
                onClick={() => startDM(user.id)}
                className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {user.is_online && (
                    <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Channel settings dialog */}
      <Dialog open={showChannelSettings} onOpenChange={setShowChannelSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Channel Settings</DialogTitle>
          </DialogHeader>
          {selectedChannel && (
            <div className="space-y-6">
              {/* Editable channel name */}
              <div>
                <Label>Channel name</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    defaultValue={selectedChannel.name}
                    onBlur={(e) => {
                      if (e.target.value !== selectedChannel.name) {
                        updateChannel(selectedChannel.id, { name: e.target.value });
                      }
                    }}
                    className="flex-1"
                  />
                </div>
              </div>
              
              {/* Editable description */}
              <div>
                <Label>Description</Label>
                <Textarea
                  defaultValue={selectedChannel.description || ''}
                  placeholder="Add a description..."
                  onBlur={(e) => {
                    if (e.target.value !== (selectedChannel.description || '')) {
                      updateChannel(selectedChannel.id, { description: e.target.value });
                    }
                  }}
                  className="mt-1"
                />
              </div>
              
              {/* Members */}
              <div>
                <Label>Members ({selectedChannel.members?.length || 0})</Label>
                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                  {users.filter(u => selectedChannel.members?.includes(u.id)).map(user => (
                    <div key={user.id} className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* AI Agents */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-4 w-4 text-primary" />
                  <Label>AI Agents</Label>
                </div>
                
                {/* Current agents in channel */}
                {channelAgents.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {channelAgents.map(agent => (
                      <div key={agent.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {agent.profile_image_url ? (
                              <img src={agent.profile_image_url} alt={agent.name} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <Sparkles className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {agent.channel_config?.trigger_mode === 'mention' && `@${agent.name.toLowerCase().replace(/\s+/g, '')}`}
                              {agent.channel_config?.trigger_mode === 'all' && 'Auto-responds'}
                              {agent.channel_config?.trigger_mode === 'keyword' && 'Keyword trigger'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeAgentFromChannel(agent.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new agents - Multi-select with checkboxes */}
                {availableAgents.filter(a => !channelAgents.find(ca => ca.id === a.id)).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Add AI Agents</Label>
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {availableAgents
                        .filter(a => !channelAgents.find(ca => ca.id === a.id))
                        .map(agent => (
                          <div
                            key={agent.id}
                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => addAgentToChannel(agent.id)}
                          >
                            <Bot className="h-4 w-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{agent.name}</p>
                              {agent.description && (
                                <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
                              )}
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))
                      }
                    </div>
                    {availableAgents.filter(a => !channelAgents.find(ca => ca.id === a.id)).length > 1 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => addMultipleAgentsToChannel(
                          availableAgents
                            .filter(a => !channelAgents.find(ca => ca.id === a.id))
                            .map(a => a.id)
                        )}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add All Available ({availableAgents.filter(a => !channelAgents.find(ca => ca.id === a.id)).length})
                      </Button>
                    )}
                  </div>
                )}
                
                {availableAgents.length === 0 && channelAgents.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No agents available. Enable agents for channels in the Agent Edit screen.
                  </p>
                )}
              </div>
              
              {selectedChannel.linked_customer_name && (
                <div>
                  <Label>Linked Customer</Label>
                  <Badge variant="outline" className="mt-1">
                    <Link2 className="h-3 w-3 mr-1" />
                    {selectedChannel.linked_customer_name}
                  </Badge>
                </div>
              )}
              
              {/* Danger zone */}
              <div className="pt-4 border-t">
                <Label className="text-destructive">Danger Zone</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Deleting a channel will remove all messages permanently.
                </p>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete #${selectedChannel.name}? This cannot be undone.`)) {
                      deleteChannel(selectedChannel.id);
                      setShowChannelSettings(false);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Channel
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChannelSettings(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messaging;
