import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, Trash2, Loader2, Bot, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SavedAgents = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [activating, setActivating] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchAgents();
  }, [token]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/agents/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (agentId) => {
    setActivating(agentId);
    try {
      await axios.post(
        `${API}/agents/${agentId}/activate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Agent activated successfully!');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to activate agent');
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;

    setDeleting(agentId);
    try {
      await axios.delete(`${API}/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Agent deleted successfully');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete agent');
    } finally {
      setDeleting(null);
    }
  };

  const getCategoryBadgeColor = (category) => {
    const colors = {
      customer_support: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      sales: 'bg-green-500/10 text-green-500 border-green-500/20',
      technical: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      ecommerce: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      healthcare: 'bg-red-500/10 text-red-500 border-red-500/20',
      hospitality: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      real_estate: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      general: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    };
    return colors[category] || colors.general;
  };

  if (loading) {
    return (
      <Card className="border border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-heading">My Saved Agents</CardTitle>
            <CardDescription>
              Manage your AI agents. Activate one to use it in your chat widget.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/marketplace')}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Browse Marketplace
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You haven&apos;t added any agents yet</p>
            <Button onClick={() => navigate('/marketplace')}>
              Browse Agent Marketplace
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "border rounded-lg p-4 transition-all",
                  agent.is_active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="text-2xl sm:text-3xl">{agent.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{agent.name}</h3>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getCategoryBadgeColor(agent.category))}
                        >
                          {agent.category.replace('_', ' ')}
                        </Badge>
                        {agent.is_active && (
                          <Badge className="bg-green-500 text-white">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">
                        {agent.description}
                      </p>
                      <div className="mt-2 sm:mt-3 text-xs text-muted-foreground">
                        <span>Added {new Date(agent.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {!agent.is_active && (
                      <Button
                        size="sm"
                        onClick={() => handleActivate(agent.id)}
                        disabled={activating === agent.id}
                      >
                        {activating === agent.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          'Activate'
                        )}
                      </Button>
                    )}
                    {!agent.is_active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(agent.id)}
                        disabled={deleting === agent.id}
                      >
                        {deleting === agent.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {agents.length > 0 && !agents.some(a => a.is_active) && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-500 mb-1">No active agent</p>
              <p className="text-muted-foreground">
                Please activate an agent to use it in your chat widget.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedAgents;
