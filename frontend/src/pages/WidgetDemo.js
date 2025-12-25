import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { MessageSquare, Send, X, Minimize2, Bot, User } from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WidgetDemo = () => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant');
  const [isOpen, setIsOpen] = useState(true);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const initSession = async () => {
      try {
        const response = await axios.post(`${API}/widget/session`, {
          tenant_id: tenantId,
          customer_name: 'Demo User',
          customer_email: 'demo@example.com'
        });
        setSession(response.data);
        setSettings(response.data.settings);
        
        // Add welcome message
        if (response.data.settings?.welcome_message) {
          setMessages([{
            id: 'welcome',
            author_type: 'ai',
            content: response.data.settings.welcome_message,
            created_at: new Date().toISOString()
          }]);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [tenantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !session) return;

    const userMessage = {
      id: Date.now().toString(),
      author_type: 'customer',
      content: newMessage,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setSending(true);

    try {
      const response = await axios.post(
        `${API}/widget/messages/${session.conversation_id}?token=${session.session_token}`,
        { content: userMessage.content }
      );

      if (response.data.ai_message) {
        setMessages(prev => [...prev, response.data.ai_message]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        author_type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString()
      }]);
    } finally {
      setSending(false);
    }
  };

  const primaryColor = settings?.primary_color || '#0047AB';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-8" data-testid="widget-demo-page">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold mb-2">Widget Preview</h1>
          <p className="text-muted-foreground">
            This is how the chat widget will appear on your website.
          </p>
        </div>

        {/* Demo Website Content */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 min-h-[500px] relative overflow-hidden">
          <div className="space-y-4">
            <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full max-w-md bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full max-w-sm bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full max-w-lg bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-32 w-full bg-slate-200 dark:bg-slate-700 rounded mt-6" />
            <div className="h-4 w-full max-w-xs bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full max-w-md bg-slate-200 dark:bg-slate-700 rounded" />
          </div>

          {/* Widget */}
          <div className="fixed bottom-6 right-6 z-50">
            {!isOpen ? (
              <button
                onClick={() => setIsOpen(true)}
                className="h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: primaryColor }}
                data-testid="widget-launcher"
              >
                <MessageSquare className="h-6 w-6 text-white" />
              </button>
            ) : (
              <div className="w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up" data-testid="widget-chat">
                {/* Header */}
                <div
                  className="p-4 flex items-center justify-between text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{settings?.brand_name || 'Support'}</p>
                      <p className="text-xs opacity-80">We typically reply instantly</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 h-80 p-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : !tenantId ? (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground text-sm">No tenant ID provided</p>
                        <p className="text-xs text-muted-foreground mt-1">Add ?tenant=YOUR_ID to the URL</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            'flex gap-2',
                            message.author_type === 'customer' ? 'flex-row-reverse' : 'flex-row'
                          )}
                        >
                          <div
                            className={cn(
                              'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0',
                              message.author_type === 'customer'
                                ? 'bg-slate-200 dark:bg-slate-600'
                                : 'text-white'
                            )}
                            style={
                              message.author_type !== 'customer'
                                ? { backgroundColor: primaryColor }
                                : {}
                            }
                          >
                            {message.author_type === 'customer' ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                          </div>
                          <div
                            className={cn(
                              'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
                              message.author_type === 'customer'
                                ? 'rounded-tr-sm text-white'
                                : 'bg-slate-100 dark:bg-slate-700 rounded-tl-sm'
                            )}
                            style={
                              message.author_type === 'customer'
                                ? { backgroundColor: primaryColor }
                                : {}
                            }
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      ))}
                      {sending && (
                        <div className="flex gap-2">
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 bg-slate-400 rounded-full typing-dot" />
                              <span className="h-2 w-2 bg-slate-400 rounded-full typing-dot" />
                              <span className="h-2 w-2 bg-slate-400 rounded-full typing-dot" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                  <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending || !session}
                      className="h-10 rounded-full bg-slate-100 dark:bg-slate-700 border-0"
                      data-testid="widget-message-input"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending || !session}
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white disabled:opacity-50 transition-transform hover:scale-105 active:scale-95"
                      style={{ backgroundColor: primaryColor }}
                      data-testid="widget-send-btn"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetDemo;
