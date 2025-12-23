import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MessageSquare, Bot, Clock, CheckCircle, ArrowRight, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import OnboardingProgress from '../components/OnboardingProgress';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API}/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 page-transition">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="dashboard-overview">
      {/* Onboarding Progress Tracker */}
      <OnboardingProgress />
      
      <div className="mb-8">
        <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your support today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <StatCard
          label="Total Conversations"
          value={stats?.total_conversations || 0}
          trend="all time"
        />
        <StatCard
          label="Open"
          value={stats?.open_conversations || 0}
          trend="need attention"
          highlight
        />
        <StatCard
          label="Resolved"
          value={stats?.resolved_conversations || 0}
          trend="completed"
        />
        <StatCard
          label="AI Handled"
          value={`${stats?.ai_handled_rate || 0}%`}
          trend="automated"
        />
      </div>

      {/* Recent Conversations */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Recent Conversations</CardTitle>
          <Link to="/dashboard/conversations">
            <Button variant="ghost" size="sm" data-testid="view-all-conversations">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats?.recent_conversations?.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  to={`/dashboard/conversations/${conversation.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-3 rounded-sm border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {conversation.customer_name || 'Anonymous'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {conversation.last_message || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={conversation.status} />
                      <span className="text-xs text-muted-foreground">
                        {conversation.updated_at && formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No conversations yet</p>
              <p className="text-sm text-muted-foreground">
                Conversations will appear here when customers start chatting through your widget.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Setup */}
      <Card className="border-0 shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Quick Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <SetupStep
              step={1}
              title="Configure AI"
              description="Add your OpenAI API key to enable AI responses"
              link="/dashboard/settings"
              linkText="Go to Settings"
            />
            <SetupStep
              step={2}
              title="Customize Widget"
              description="Set your brand colors and welcome message"
              link="/dashboard/settings"
              linkText="Customize"
            />
            <SetupStep
              step={3}
              title="Embed Widget"
              description="Copy the embed code to your website"
              link="/dashboard/settings"
              linkText="Get Code"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, trend, highlight }) => (
  <Card className={`border-0 shadow-sm ${highlight ? 'bg-primary/5' : ''}`} data-testid="stat-card">
    <CardContent className="p-3 sm:p-4">
      <p className="font-heading text-xl sm:text-2xl font-bold tracking-tight mb-0.5">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }) => {
  const variants = {
    open: { variant: 'default', label: 'Open' },
    waiting: { variant: 'secondary', label: 'Waiting' },
    resolved: { variant: 'outline', label: 'Resolved' }
  };
  const config = variants[status] || variants.open;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const SetupStep = ({ step, title, description, link, linkText }) => (
  <div className="p-4 bg-muted/30 rounded-sm">
    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-heading font-bold text-sm mb-3">
      {step}
    </div>
    <h3 className="font-medium mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-3">{description}</p>
    <Link to={link}>
      <Button variant="outline" size="sm">{linkText}</Button>
    </Link>
  </div>
);

export default Dashboard;
