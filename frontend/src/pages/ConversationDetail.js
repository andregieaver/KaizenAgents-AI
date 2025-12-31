import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  Heart,
  UserPlus,
  ExternalLink,
  Building,
  Phone,
  Mail,
  Tag,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Ticket,
  ArrowUpRight
} from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  const [crmCustomer, setCrmCustomer] = useState(null);
  const [crmLoading, setCrmLoading] = useState(false);
  const [linkSuggested, setLinkSuggested] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Canned/Template Responses
  const cannedResponses = [
    { id: 1, label: 'Greeting', text: "Hello! Thank you for reaching out. How can I assist you today?" },
    { id: 2, label: 'Working on it', text: "Thank you for your patience. I'm looking into this for you right now." },
    { id: 3, label: 'Need more info', text: "To help you better, could you please provide more details about your issue?" },
    { id: 4, label: 'Escalating', text: "I'm going to escalate this to our specialized team. They will be in touch with you shortly." },
    { id: 5, label: 'Follow-up', text: "I wanted to follow up on our previous conversation. Is there anything else I can help you with?" },
    { id: 6, label: 'Closing', text: "Thank you for contacting us! If you have any other questions, don&apos;t hesitate to reach out. Have a great day!" },
    { id: 7, label: 'Apology', text: "I apologize for any inconvenience this may have caused. Let me help resolve this for you." },
    { id: 8, label: 'Confirmation', text: "I've noted your request and will process it right away. You'll receive a confirmation shortly." },
  ];

  // Define all async functions with useCallback first
  const fetchCrmStatus = useCallback(async (conversationId) => {
    try {
      const response = await axios.get(
        `${API}/crm/lookup-by-conversation/${conversationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.linked) {
        setCrmCustomer(response.data.customer);
        setLinkSuggested(response.data.link_suggested || false);
      } else {
        setCrmCustomer(null);
        setLinkSuggested(false);
      }
    } catch (error) {
      console.debug('CRM lookup failed:', error);
    }
  }, [token]);

  const fetchAiInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const [summaryRes, followupRes] = await Promise.all([
        axios.get(`${API}/crm/conversations/${id}/summary?use_ai=false`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/crm/conversations/${id}/suggest-followup`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAiInsights({
        summary: summaryRes.data,
        followup: followupRes.data
      });
    } catch (error) {
      console.debug('Error fetching AI insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  }, [id, token]);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const response = await axios.post(
        `${API}/conversations/${id}/suggestions`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestions(response.data.suggestions || []);
    } catch {
      // Suggestions failed silently
    } finally {
      setLoadingSuggestions(false);
    }
  }, [id, token]);

  const analyzeSentiment = useCallback(async () => {
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
    } catch {
      // Sentiment analysis failed silently
    } finally {
      setAnalyzingSentiment(false);
    }
  }, [id, token, analyzingSentiment]);

  // Main data fetch effect
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
        
        // Fetch CRM link status
        fetchCrmStatus(convRes.data.id);
      } catch (error) {
        toast.error('Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [id, token, fetchCrmStatus]);
  
  // Auto-fetch AI insights when conversation loads (only once)
  useEffect(() => {
    if (conversation && !aiInsights && !loadingInsights) {
      fetchAiInsights();
    }
  }, [conversation, aiInsights, loadingInsights, fetchAiInsights]);

  // Fetch suggestions when in assisted mode and messages change
  useEffect(() => {
    if (conversation?.mode === 'assisted' && messages.length > 0) {
      // Check if the last message is from customer
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.author_type === 'customer') {
        fetchSuggestions();
      }
    }
  }, [messages, conversation?.mode, fetchSuggestions]);

  // Analyze sentiment when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Debounce sentiment analysis
      const timer = setTimeout(() => {
        analyzeSentiment();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages, analyzeSentiment]);

  const handleLinkToCrm = async () => {
    setCrmLoading(true);
    try {
      const response = await axios.post(
        `${API}/crm/customers/from-conversation/${id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCrmCustomer(response.data.customer);
      setLinkSuggested(false);
      toast.success(response.data.created ? 'Customer added to CRM' : 'Linked to existing CRM customer');
    } catch (error) {
      toast.error('Failed to link to CRM');
    } finally {
      setCrmLoading(false);
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
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        {/* Messages - Show first on both mobile and desktop */}
        <div className="lg:col-span-2 order-1">
          <Card className="border-0 shadow-sm h-[400px] sm:h-[500px] lg:h-[600px] flex flex-col">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Messages
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Mode Indicator */}
                  <Badge variant="secondary" className="text-xs capitalize">
                    {conversation.mode === 'ai' && <Sparkles className="h-3 w-3 mr-1" />}
                    {conversation.mode === 'assisted' && <Wand2 className="h-3 w-3 mr-1" />}
                    {conversation.mode === 'agent' && <Hand className="h-3 w-3 mr-1" />}
                    {conversation.mode}
                  </Badge>
                  {/* Status Indicator */}
                  <Badge 
                    variant={conversation.status === 'resolved' ? 'outline' : 'default'}
                    className="text-xs capitalize"
                  >
                    {conversation.status}
                  </Badge>
                </div>
              </div>
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
                <div className="px-4 py-2 bg-muted/30">
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
                          className="text-xs px-3 py-1.5 rounded-full bg-background hover:bg-primary hover:text-primary-foreground transition-colors text-left max-w-full truncate shadow-sm"
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
              <div className="p-4 bg-muted/20">
                {/* Canned Responses Toggle */}
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => setShowCannedResponses(!showCannedResponses)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Quick Responses
                    {showCannedResponses ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  
                  {/* Canned Responses Panel */}
                  {showCannedResponses && (
                    <div className="mt-2 p-2 bg-background rounded-md border border-border max-h-32 overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {cannedResponses.map((response) => (
                          <button
                            key={response.id}
                            type="button"
                            onClick={() => {
                              setNewMessage(response.text);
                              setShowCannedResponses(false);
                            }}
                            className="px-2 py-1 text-xs bg-muted hover:bg-primary hover:text-primary-foreground rounded transition-colors truncate max-w-[150px]"
                            title={response.text}
                          >
                            {response.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder={conversation.mode === 'assisted' ? "Click a suggestion or type your message..." : "Type a message as an agent..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                    className="h-10 border-0 bg-background shadow-sm"
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

        {/* Sidebar - Actions below conversation on mobile */}
        <div className="space-y-4 order-2">
          {/* Actions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Mode</p>
                <div className="flex gap-2">
                  <Button
                    variant={conversation.mode === 'ai' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleModeChange('ai')}
                    data-testid="mode-ai-btn"
                    className="flex-1"
                    title="AI Mode"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">AI</span>
                  </Button>
                  <Button
                    variant={conversation.mode === 'assisted' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleModeChange('assisted')}
                    data-testid="mode-assisted-btn"
                    className="flex-1"
                    title="Assisted Mode"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Assisted</span>
                  </Button>
                  <Button
                    variant={conversation.mode === 'agent' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleModeChange('agent')}
                    data-testid="mode-agent-btn"
                    className="flex-1"
                    title="Agent Mode"
                  >
                    <Hand className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Agent</span>
                  </Button>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <div className="flex gap-2">
                  <Button
                    variant={conversation.status === 'resolved' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleStatusChange('resolved')}
                    className="flex-1"
                    data-testid="resolve-btn"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                  <Button
                    variant={conversation.status === 'open' ? 'default' : 'ghost'}
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

          {/* Emotional Meters */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Customer Sentiment
                {analyzingSentiment && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Engagement Meter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Engagement
                  </span>
                  <span className="text-xs font-medium">{sentiment.engagement}/10</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      sentiment.engagement <= 3 ? "bg-red-500" :
                      sentiment.engagement <= 6 ? "bg-yellow-500" :
                      "bg-green-500"
                    )}
                    style={{ width: `${sentiment.engagement * 10}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Low</span>
                  <span className="text-[10px] text-muted-foreground">High</span>
                </div>
              </div>

              {/* Tone Pendulum */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Tone</span>
                  <span className={cn(
                    "text-xs font-medium",
                    sentiment.tone < -20 ? "text-red-500" :
                    sentiment.tone > 20 ? "text-green-500" :
                    "text-yellow-500"
                  )}>
                    {sentiment.tone < -50 ? "Very Negative" :
                     sentiment.tone < -20 ? "Negative" :
                     sentiment.tone <= 20 ? "Neutral" :
                     sentiment.tone <= 50 ? "Positive" :
                     "Very Positive"}
                  </span>
                </div>
                <div className="relative h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full">
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-md transition-all duration-500"
                    style={{ left: `calc(${(sentiment.tone + 100) / 2}% - 8px)` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">Negative</span>
                  <span className="text-[10px] text-muted-foreground">Neutral</span>
                  <span className="text-[10px] text-muted-foreground">Positive</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Row 1: Name and Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{conversation.customer_name || 'Anonymous'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{conversation.customer_email || 'Not provided'}</p>
                </div>
              </div>
              {/* Row 2: Source and Started */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
          
          {/* CRM Integration */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                CRM
              </CardTitle>
            </CardHeader>
            <CardContent>
              {crmCustomer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {crmCustomer.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{crmCustomer.name}</p>
                      {crmCustomer.company && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {crmCustomer.company}
                        </p>
                      )}
                    </div>
                    <Badge variant={crmCustomer.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {crmCustomer.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {crmCustomer.email && (
                      <div className="flex items-center gap-1 text-muted-foreground truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{crmCustomer.email}</span>
                      </div>
                    )}
                    {crmCustomer.phone && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {crmCustomer.phone}
                      </div>
                    )}
                  </div>
                  
                  {crmCustomer.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {crmCustomer.tags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{crmCustomer.total_conversations || 0} conversations</span>
                    {crmCustomer.last_contact && (
                      <span>Last: {formatDistanceToNow(new Date(crmCustomer.last_contact), { addSuffix: true })}</span>
                    )}
                  </div>
                  
                  <Link to={`/dashboard/crm/${crmCustomer.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-3 w-3 mr-2" />
                      View in CRM
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    {linkSuggested 
                      ? 'Found matching customer in CRM' 
                      : 'Not linked to CRM yet'}
                  </p>
                  <Button 
                    onClick={handleLinkToCrm} 
                    disabled={crmLoading}
                    size="sm"
                    className="w-full"
                  >
                    {crmLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    {linkSuggested ? 'Link to CRM' : 'Add to CRM'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* AI Insights */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Insights
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchAiInsights}
                  disabled={loadingInsights}
                  className="h-6 w-6 p-0"
                >
                  {loadingInsights ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Activity className="h-3 w-3" />
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiInsights ? (
                <div className="space-y-3">
                  {/* Summary */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm">{aiInsights.summary?.summary}</p>
                  </div>
                  
                  {/* Sentiment & Topics */}
                  <div className="flex flex-wrap gap-1">
                    {aiInsights.summary?.sentiment && (
                      <Badge variant={
                        aiInsights.summary.sentiment === 'positive' ? 'default' :
                        aiInsights.summary.sentiment === 'negative' ? 'destructive' : 'secondary'
                      } className="text-xs">
                        {aiInsights.summary.sentiment}
                      </Badge>
                    )}
                    {aiInsights.summary?.topics?.slice(0, 2).map((topic, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {topic.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Follow-up Suggestion */}
                  {aiInsights.followup && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Follow-up</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          aiInsights.followup.priority === 'high' ? 'destructive' :
                          aiInsights.followup.priority === 'medium' ? 'default' : 'secondary'
                        } className="text-xs">
                          {aiInsights.followup.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {aiInsights.followup.type?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {aiInsights.followup.reason}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    Analyze this conversation
                  </p>
                  <Button 
                    onClick={fetchAiInsights} 
                    disabled={loadingInsights}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    {loadingInsights ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Get AI Insights
                  </Button>
                </div>
              )}
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
