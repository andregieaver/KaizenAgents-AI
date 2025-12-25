import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import {
  TestTube,
  Loader2,
  Send,
  User,
  Bot,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AgentTestTab = ({ agent, agentId, token }) => {
  const [testMessage, setTestMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [testing, setTesting] = useState(false);

  const handleTestAgent = async () => {
    if (!testMessage.trim()) return;

    setTesting(true);
    try {
      const response = await axios.post(
        `${API}/agents/${agentId}/test`,
        {
          message: testMessage,
          history: conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: testMessage },
        { role: 'assistant', content: response.data.agent_response }
      ];
      
      setConversationHistory(newHistory);
      setTestMessage('');
      
      if (conversationHistory.length === 0) {
        toast.success(`Using ${response.data.model_used} via ${response.data.provider_used}`);
      }
    } catch {
      const errorMsg = error.response?.data?.detail || 'Test failed';
      toast.error(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border border-border">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test Conversation
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Test your agent with sample conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
        {/* Conversation History */}
        <ScrollArea className="h-[300px] sm:h-[400px] border rounded-lg p-4">
          {conversationHistory.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Start a conversation to test your agent
            </div>
          ) : (
            <div className="space-y-4">
              {conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                      {agent.icon || <Bot className="h-4 w-4 text-primary" />}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type a test message..."
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !testing && handleTestAgent()}
            disabled={testing}
          />
          <Button onClick={handleTestAgent} disabled={testing || !testMessage.trim()}>
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          {conversationHistory.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setConversationHistory([])}
              title="Clear conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentTestTab;
