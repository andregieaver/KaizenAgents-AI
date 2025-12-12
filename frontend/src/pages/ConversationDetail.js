import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Users,
  ArrowLeft,
  CheckCircle,
  Hand,
  Sparkles,
  Menu,
  X,
  Wand2,
  Loader2,
  Activity,
  Heart
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Move ConversationsList outside to avoid nested component definition
const ConversationsList = ({ conversations, id, navigate, setSidebarOpen }) => (
  <ScrollArea className="h-[calc(100vh-12rem)]">
    <div className="space-y-2 pr-4">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => {
            navigate(`/dashboard/conversations/${conv.id}`);
            setSidebarOpen(false);
          }}
          className={cn(
            "w-full text-left p-3 rounded-sm transition-colors",
            "hover:bg-muted/50",
            conv.id === id ? "bg-muted" : ""
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {conv.customer_name || 'Anonymous'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {conv.customer_email || 'No email'}
              </p>
            </div>
            <StatusBadge status={conv.status} />
          </div>
          {conv.last_message_at && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
            </p>
          )}
        </button>
      ))}
    </div>
  </ScrollArea>
);

const ConversationDetail = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [sentiment, setSentiment] = useState({ engagement: 5, tone: 0 });
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convRes, msgsRes, convsRes] = await Promise.all([
          axios.get(`${API}/conversations/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API}/conversations/${id}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API}/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        setConversation(convRes.data);
        setMessages(msgsRes.data);
        setConversations(convsRes.data);
      } catch (error) {
        console.error('Error fetching conversation:', error);
        toast.error('Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [id, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch suggestions when in assisted mode and messages change
  useEffect(() => {
    if (conversation?.mode === 'assisted' && messages.length > 0) {
      // Check if the last message is from customer
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.author_type === 'customer') {
        fetchSuggestions();
      }
    }
  }, [messages, conversation?.mode]);

  // Analyze sentiment when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Debounce sentiment analysis
      const timer = setTimeout(() => {
        analyzeSentiment();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const analyzeSentiment = async () => {
    if (analyzingSentiment) return;
    
    setAnalyzingSentiment(true);
    try {
      const response = await axios.post(
        `${API}/conversations/${id}/analyze-sentiment`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSentiment({
        engagement: response.data.engagement || 5,
        tone: response.data.tone || 0
      });
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
    } finally {
      setAnalyzingSentiment(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    // Clear suggestions when sending
    setSuggestions([]);
    try {
      const response = await axios.post(
        `${API}/conversations/${id}/messages`,
        { content: newMessage, author_type: 'agent' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages([...messages, response.data]);
      setNewMessage('');
      toast.success('Message sent');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleModeChange = async (mode) => {
    try {
      const response = await axios.patch(
        `${API}/conversations/${id}/mode?mode=${mode}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConversation(response.data);
      toast.success(`Mode changed to ${mode}`);
      
      // If switching to assisted mode, fetch suggestions
      if (mode === 'assisted') {
        fetchSuggestions();
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      toast.error('Failed to change mode');
    }
  };

  const fetchSuggestions = async () => {
    if (!conversation || conversation.mode !== 'assisted') return;
    
    setLoadingSuggestions(true);
    try {
      const response = await axios.post(
        `${API}/conversations/${id}/suggestions`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setNewMessage(suggestion);
  };

  const handleStatusChange = async (status) => {
    try {
      const response = await axios.patch(
        `${API}/conversations/${id}/status?new_status=${status}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConversation(response.data);
      toast.success(`Status changed to ${status}`);
    } catch (error) {
      console.error('Status change error:', error);
      toast.error(error.response?.data?.detail || 'Failed to change status');
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[500px] bg-muted rounded-sm" />
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-heading text-xl font-semibold mb-2">Conversation not found</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard/conversations')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to conversations
        </Button>
      </div>
    );
  }

  // ConversationsList moved outside component to avoid nested component warning

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-80 border-r border-border p-6 bg-background">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold">Conversations</h2>
          <Badge variant="secondary">{conversations.length}</Badge>
        </div>
        <ConversationsList 
          conversations={conversations} 
          id={id} 
          navigate={navigate} 
          setSidebarOpen={setSidebarOpen} 
        />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-80 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold">Conversations</h2>
            <Badge variant="secondary">{conversations.length}</Badge>
          </div>
          <ConversationsList 
            conversations={conversations} 
            id={id} 
            navigate={navigate} 
            setSidebarOpen={setSidebarOpen} 
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              </Sheet>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard/conversations')}
                className="hidden lg:flex"
                data-testid="back-btn"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-heading text-xl font-bold tracking-tight">
                  {conversation.customer_name || 'Anonymous'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {conversation.customer_email || 'No email provided'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={conversation.status} />
              <ModeBadge mode={conversation.mode} />
            </div>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        {/* Sidebar - Actions first on mobile */}
        <div className="space-y-4 lg:order-2">
          {/* Actions - Show first on mobile */}
          <Card className="border border-border">
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={conversation.mode === 'ai' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleModeChange('ai')}
                    data-testid="mode-ai-btn"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI
                  </Button>
                  <Button
                    variant={conversation.mode === 'assisted' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleModeChange('assisted')}
                    data-testid="mode-assisted-btn"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Assisted
                  </Button>
                  <Button
                    variant={conversation.mode === 'agent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleModeChange('agent')}
                    data-testid="mode-agent-btn"
                  >
                    <Hand className="h-3 w-3 mr-1" />
                    Agent
                  </Button>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <div className="flex gap-2">
                  <Button
                    variant={conversation.status === 'resolved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange('resolved')}
                    className="flex-1"
                    data-testid="resolve-btn"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                  <Button
                    variant={conversation.status === 'open' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange('open')}
                    className="flex-1"
                    data-testid="reopen-btn"
                  >
                    Reopen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card className="border border-border">
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{conversation.customer_name || 'Anonymous'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{conversation.customer_email || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium capitalize">{conversation.source}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="text-sm font-medium">
                    {format(new Date(conversation.created_at), 'PPp')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Messages */}
        <div className="lg:col-span-2 lg:order-1">
          <Card className="border border-border h-[450px] sm:h-[600px] flex flex-col">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-4 overflow-hidden">
                  {messages.length > 0 ? (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">No messages yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {/* AI Suggestions for Assisted Mode */}
              {conversation.mode === 'assisted' && (
                <div className="px-4 py-2 border-t border-border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">AI Suggestions</span>
                    {loadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs px-3 py-1.5 rounded-full bg-background border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors text-left max-w-full truncate"
                          title={suggestion}
                        >
                          {suggestion.length > 50 ? `${suggestion.substring(0, 50)}...` : suggestion}
                        </button>
                      ))}
                    </div>
                  ) : !loadingSuggestions && (
                    <p className="text-xs text-muted-foreground">Waiting for customer message...</p>
                  )}
                </div>
              )}
              
              {/* Message Input */}
              <div className="p-4 border-t border-border">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder={conversation.mode === 'assisted' ? "Click a suggestion or type your message..." : "Type a message as an agent..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                    className="h-10"
                    data-testid="message-input"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="h-10"
                    data-testid="send-message-btn"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message }) => {
  const isCustomer = message.author_type === 'customer';
  const isAI = message.author_type === 'ai';
  const isAgent = message.author_type === 'agent';
  const isSystem = message.author_type === 'system';
  
  // System messages are centered notifications
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1.5 rounded-full text-center">
          {message.content}
        </div>
      </div>
    );
  }

  const getIcon = () => {
    if (isCustomer) return <Users className="h-4 w-4" />;
    if (isAI) return <Bot className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  // Agent messages appear on the right (same side as customer view would show them)
  // Customer messages appear on the left
  const isRightSide = isAgent || isAI;

  return (
    <div className={cn(
      'flex gap-2 w-full',
      isRightSide ? 'flex-row-reverse' : 'flex-row'
    )}>
      <div className={cn(
        'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
        isCustomer ? 'bg-signal-100 text-signal-600' : isAI ? 'bg-primary/10 text-primary' : 'bg-blue-100 text-blue-600'
      )}>
        {getIcon()}
      </div>
      <div 
        className={cn(
          'rounded-lg px-3 py-2 min-w-0',
          isCustomer
            ? 'bg-signal-100 text-signal-900 dark:bg-signal-900/20 dark:text-signal-100 rounded-tl-none'
            : isAgent
            ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 rounded-tr-none'
            : 'bg-muted rounded-tr-none'
        )}
        style={{ maxWidth: 'calc(100% - 48px)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p className="text-xs opacity-60 mt-1">
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </p>
      </div>
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

const ModeBadge = ({ mode }) => {
  const config = {
    ai: { icon: <Bot className="h-3 w-3" />, label: 'AI Mode' },
    agent: { icon: <User className="h-3 w-3" />, label: 'Agent Mode' },
    assisted: { icon: <Wand2 className="h-3 w-3" />, label: 'Assisted' },
    hybrid: { icon: <Users className="h-3 w-3" />, label: 'Hybrid' }
  };
  const { icon, label } = config[mode] || config.ai;
  return (
    <Badge variant="secondary" className="gap-1">
      {icon}
      {label}
    </Badge>
  );
};

export default ConversationDetail;
