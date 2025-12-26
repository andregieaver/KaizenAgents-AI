import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  MessageSquare,
  Zap,
  Sparkles,
  Settings2,
  AtSign,
  Hash,
  Target
} from 'lucide-react';

const AgentChannelsTab = ({
  agent,
  setAgent
}) => {
  // Get channel config with defaults
  const channelConfig = agent.channel_config || {
    trigger_mode: 'mention',
    response_probability: 0.3,
    response_style: 'helpful',
    response_length: 'medium',
    formality: 0.5,
    creativity: 0.5,
    keywords: []
  };

  const updateChannelConfig = (key, value) => {
    setAgent(prev => ({
      ...prev,
      channel_config: {
        ...prev.channel_config,
        [key]: value
      }
    }));
  };

  const triggerModes = [
    { value: 'mention', label: 'When @mentioned', icon: AtSign, description: 'Responds only when explicitly mentioned' },
    { value: 'keyword', label: 'Keyword trigger', icon: Target, description: 'Responds when specific keywords are used' },
    { value: 'all', label: 'All messages', icon: Hash, description: 'May respond to any message (based on probability)' }
  ];

  const responseStyles = [
    { value: 'helpful', label: 'Helpful & Professional' },
    { value: 'friendly', label: 'Friendly & Casual' },
    { value: 'concise', label: 'Concise & Direct' },
    { value: 'detailed', label: 'Detailed & Thorough' },
    { value: 'creative', label: 'Creative & Engaging' }
  ];

  const responseLengths = [
    { value: 'short', label: 'Short (1-2 sentences)' },
    { value: 'medium', label: 'Medium (1 paragraph)' },
    { value: 'long', label: 'Long (detailed response)' }
  ];

  return (
    <div className="space-y-6">
      {/* Enable for Channels */}
      <Card className="border border-border">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Enable for Channels</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Allow this agent to participate in messaging channels
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={agent.channels_enabled || false}
              onCheckedChange={(checked) => setAgent(prev => ({ ...prev, channels_enabled: checked }))}
            />
          </div>
        </CardHeader>
      </Card>

      {agent.channels_enabled && (
        <>
          {/* Trigger Settings */}
          <Card className="border border-border">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Trigger Settings</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Configure when the agent should respond
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              {/* Trigger Mode */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Response Trigger</Label>
                <div className="grid gap-3">
                  {triggerModes.map((mode) => (
                    <div
                      key={mode.value}
                      onClick={() => updateChannelConfig('trigger_mode', mode.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        channelConfig.trigger_mode === mode.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center ${
                        channelConfig.trigger_mode === mode.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <mode.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{mode.label}</p>
                        <p className="text-xs text-muted-foreground">{mode.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Keyword input for keyword mode */}
              {channelConfig.trigger_mode === 'keyword' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Keywords</Label>
                  <Input
                    placeholder="Enter keywords separated by commas (e.g., help, support, question)"
                    value={(channelConfig.keywords || []).join(', ')}
                    onChange={(e) => {
                      const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                      updateChannelConfig('keywords', keywords);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Agent will respond when any of these keywords are mentioned
                  </p>
                </div>
              )}

              {/* Response probability for "all" mode */}
              {channelConfig.trigger_mode === 'all' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Response Probability</Label>
                    <Badge variant="outline">{Math.round((channelConfig.response_probability || 0.3) * 100)}%</Badge>
                  </div>
                  <Slider
                    value={[(channelConfig.response_probability || 0.3) * 100]}
                    min={5}
                    max={100}
                    step={5}
                    onValueChange={(value) => updateChannelConfig('response_probability', value[0] / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Probability that the agent will respond to any message
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Behavior Settings */}
          <Card className="border border-border">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Settings2 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg">Behavior Settings</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Fine-tune how the agent responds
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              {/* Response Style */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Response Style</Label>
                <Select
                  value={channelConfig.response_style || 'helpful'}
                  onValueChange={(value) => updateChannelConfig('response_style', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {responseStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Response Length */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Response Length</Label>
                <Select
                  value={channelConfig.response_length || 'medium'}
                  onValueChange={(value) => updateChannelConfig('response_length', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {responseLengths.map((length) => (
                      <SelectItem key={length.value} value={length.value}>
                        {length.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Formality Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Formality</Label>
                  <Badge variant="outline">
                    {channelConfig.formality < 0.4 ? 'Casual' : channelConfig.formality > 0.6 ? 'Formal' : 'Balanced'}
                  </Badge>
                </div>
                <Slider
                  value={[(channelConfig.formality || 0.5) * 100]}
                  min={0}
                  max={100}
                  step={10}
                  onValueChange={(value) => updateChannelConfig('formality', value[0] / 100)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Casual</span>
                  <span>Formal</span>
                </div>
              </div>

              {/* Creativity Slider */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                    <Label className="text-sm font-medium">Creativity</Label>
                  </div>
                  <Badge variant="outline">
                    {channelConfig.creativity < 0.4 ? 'Factual' : channelConfig.creativity > 0.6 ? 'Creative' : 'Balanced'}
                  </Badge>
                </div>
                <Slider
                  value={[(channelConfig.creativity || 0.5) * 100]}
                  min={0}
                  max={100}
                  step={10}
                  onValueChange={(value) => updateChannelConfig('creativity', value[0] / 100)}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Factual & Precise</span>
                  <span>Creative & Expressive</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Tips */}
          <Card className="border border-dashed border-muted-foreground/30 bg-muted/30">
            <CardContent className="p-4 sm:p-6">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                How to use in channels
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Go to <strong>Messaging</strong> and open a channel</li>
                <li>• Click the <strong>Settings</strong> icon in the channel header</li>
                <li>• Add this agent to the channel from the agents list</li>
                <li>• {channelConfig.trigger_mode === 'mention' 
                    ? `Mention the agent with @${agent.name?.toLowerCase().replace(/\s+/g, '')} to trigger a response`
                    : channelConfig.trigger_mode === 'keyword'
                    ? 'Use any of the configured keywords to trigger a response'
                    : 'The agent will automatically respond based on the set probability'}
                </li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AgentChannelsTab;
