import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  MessageSquare,
  Users,
  Bot,
  TrendingUp,
  Activity,
  Heart,
  CheckCircle,
  Clock,
  Loader2,
  BarChart3,
  User
} from 'lucide-react';
import StatCard from '../components/analytics/StatCard';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const SENTIMENT_COLORS = {
  very_negative: '#ef4444',
  negative: '#f97316',
  neutral: '#eab308',
  positive: '#22c55e',
  very_positive: '#10b981'
};

const Analytics = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [agentPerformance, setAgentPerformance] = useState([]);
  const [sentimentSummary, setSentimentSummary] = useState(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, trendsRes, agentsRes, sentimentRes] = await Promise.all([
        axios.get(`${API}/analytics/overview?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/analytics/trends?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/analytics/agent-performance?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/analytics/sentiment-summary?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setOverview(overviewRes.data);
      setTrends(trendsRes.data.trends || []);
      setAgentPerformance(agentsRes.data.agents || []);
      setSentimentSummary(sentimentRes.data);
    } catch {
      // Analytics fetch failed silently
    } finally {
      setLoading(false);
    }
  }, [days, token]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const modeData = overview ? [
    { name: 'AI', value: overview.by_mode.ai, color: '#0088FE' },
    { name: 'Agent', value: overview.by_mode.agent, color: '#00C49F' },
    { name: 'Assisted', value: overview.by_mode.assisted, color: '#FFBB28' }
  ].filter(d => d.value > 0) : [];

  const statusData = overview ? [
    { name: 'Open', value: overview.by_status.open, color: '#22c55e' },
    { name: 'Waiting', value: overview.by_status.waiting, color: '#eab308' },
    { name: 'Resolved', value: overview.by_status.resolved, color: '#6b7280' }
  ].filter(d => d.value > 0) : [];

  const sentimentPieData = sentimentSummary ? [
    { name: 'Very Positive', value: sentimentSummary.sentiment_distribution.very_positive, color: SENTIMENT_COLORS.very_positive },
    { name: 'Positive', value: sentimentSummary.sentiment_distribution.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: sentimentSummary.sentiment_distribution.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: sentimentSummary.sentiment_distribution.negative, color: SENTIMENT_COLORS.negative },
    { name: 'Very Negative', value: sentimentSummary.sentiment_distribution.very_negative, color: SENTIMENT_COLORS.very_negative }
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Monitor your support performance</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Conversations"
          value={overview?.total_conversations || 0}
          subtitle={`${overview?.period_conversations || 0} in selected period`}
          icon={MessageSquare}
          color="primary"
        />
        <StatCard
          title="Messages Exchanged"
          value={overview?.messages?.total || 0}
          subtitle={`${overview?.messages?.avg_per_conversation || 0} avg per conversation`}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Resolution Rate"
          value={`${overview?.total_conversations ? Math.round(overview.by_status.resolved / overview.total_conversations * 100) : 0}%`}
          subtitle={`${overview?.by_status?.resolved || 0} resolved`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Transfer Rate"
          value={`${overview?.transfers?.acceptance_rate || 0}%`}
          subtitle={`${overview?.transfers?.total || 0} transfer requests`}
          icon={Users}
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Trends */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversation Trends
            </CardTitle>
            <CardDescription>Daily conversation volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0088FE" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversations" 
                    stroke="#0088FE" 
                    fillOpacity={1} 
                    fill="url(#colorConversations)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Mode Distribution */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Mode Distribution
            </CardTitle>
            <CardDescription>How conversations are being handled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              {modeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {modeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment & Agent Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Analysis */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Customer Sentiment
            </CardTitle>
            <CardDescription>
              Avg Engagement: {sentimentSummary?.avg_engagement || 5}/10 | 
              Avg Tone: {sentimentSummary?.avg_tone || 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {sentimentPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    >
                      {sentimentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No sentiment data available yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agent Performance */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agent Performance
            </CardTitle>
            <CardDescription>Top performing agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentPerformance.length > 0 ? (
                agentPerformance.slice(0, 5).map((agent, index) => (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt={agent.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        agent.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        {agent.is_available && (
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {agent.conversations_handled} conversations | {agent.messages_sent} messages
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No agent data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Breakdown */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Message Breakdown
          </CardTitle>
          <CardDescription>Distribution of messages by sender type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Customer', value: overview?.messages?.customer || 0, fill: '#0088FE' },
                  { name: 'AI', value: overview?.messages?.ai || 0, fill: '#00C49F' },
                  { name: 'Agent', value: overview?.messages?.agent || 0, fill: '#FFBB28' }
                ]}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-green-500">{overview?.by_status?.open || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold text-amber-500">{overview?.by_status?.waiting || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-gray-500">{overview?.by_status?.resolved || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-gray-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
