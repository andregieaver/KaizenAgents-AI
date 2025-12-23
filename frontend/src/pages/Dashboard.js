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

      {/* Stats Grid - 2 cols mobile, 4 cols desktop */}
      <div 
        className="stats-grid gap-3 sm:gap-4 mb-8"
      >
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
        <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
          <CardTitle className="font-heading text-base sm:text-lg">Recent Conversations</CardTitle>
          <Link to="/dashboard/conversations">
            <Button variant="ghost" size="sm" data-testid="view-all-conversations" className="text-xs sm:text-sm">
              View all
              <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {stats?.recent_conversations?.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {stats.recent_conversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  to={`/dashboard/conversations/${conversation.id}`}
                  className="block"
                >
                  <div className="flex items-start sm:items-center justify-between p-2 sm:p-3 rounded-sm border border-border hover:bg-muted/50 transition-colors gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {conversation.customer_name || 'Anonymous'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {conversation.last_message || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 flex-shrink-0">
                      <StatusBadge status={conversation.status} />
                      <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                        {conversation.updated_at && formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2 sm:mb-4 text-sm">No conversations yet</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Conversations will appear here when customers start chatting.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, trend, highlight }) => (
  <Card className={`border-0 btn-neumorphic !bg-card ${highlight ? 'ring-2 ring-primary/30' : ''}`} data-testid="stat-card">
    <CardContent className="p-3 sm:p-4 text-center">
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
