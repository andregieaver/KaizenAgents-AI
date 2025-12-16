import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, Trash2, Loader2, Bot, ExternalLink, Plus, Edit, Globe, GlobeOff, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import AgentFormModal from './AgentFormModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SavedAgents = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [activating, setActivating] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [unpublishing, setUnpublishing] = useState(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [publishDialog, setPublishDialog] = useState(null);

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

  const handleDeactivate = async (agentId) => {
    setDeactivating(agentId);
    try {
      await axios.post(
        `${API}/agents/${agentId}/deactivate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Agent deactivated successfully');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deactivate agent');
    } finally {
      setDeactivating(null);
    }
  };

  const handleDelete = async (agentId) => {
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
  
  const handlePublish = async (agent) => {
    setPublishing(agent.id);
    try {
      const response = await axios.post(
        `${API}/agents/${agent.id}/publish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.approved) {
        toast.success('Agent published to marketplace!');
        fetchAgents();
      } else {
        // Show rejection reasons
        const issues = response.data.issues || [];
        const suggestions = response.data.suggestions || [];
        
        toast.error(
          <div className="space-y-2">
            <p className="font-semibold">Agent Review Failed</p>
            {issues.length > 0 && (
              <div>
                <p className="text-sm font-medium">Issues Found:</p>
                <ul className="text-xs list-disc list-inside">
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {suggestions.length > 0 && (
              <div>
                <p className="text-sm font-medium">Suggestions:</p>
                <ul className="text-xs list-disc list-inside">
                  {suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>,
          { duration: 10000 }
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to publish agent');
    } finally {
      setPublishing(null);
      setPublishDialog(null);
    }
  };
  
  const handleUnpublish = async (agentId) => {
    setUnpublishing(agentId);
    try {
      await axios.post(
        `${API}/agents/${agentId}/unpublish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Agent removed from marketplace');
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to unpublish agent');
    } finally {
      setUnpublishing(null);
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
    <>
      <Card className="border border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-heading">My Saved Agents</CardTitle>
              <CardDescription>
                Create custom agents or browse the marketplace. Activate one to use in your chat widget.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
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
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      {agent.profile_image_url ? (
                        <img 
                          src={agent.profile_image_url} 
                          alt={agent.name} 
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border-2 border-border"
                        />
                      ) : (
                        <div className="text-2xl sm:text-3xl">{agent.icon}</div>
                      )}
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
                            <Badge className="bg-green-500 text-white text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          {agent.is_public && (
                            <Badge className="bg-blue-500 text-white text-xs">
                              <Globe className="h-3 w-3 mr-1" />
                              Public
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {agent.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Created: {new Date(agent.created_at).toLocaleDateString()}</span>
                          {agent.updated_at && agent.updated_at !== agent.created_at && (
                            <span>Updated: {new Date(agent.updated_at).toLocaleDateString()}</span>
                          )}
                          {agent.activated_at && (
                            <span>Last Activated: {new Date(agent.activated_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!agent.is_active ? (
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
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeactivate(agent.id)}
                        disabled={deactivating === agent.id}
                      >
                        {deactivating === agent.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deactivating...
                          </>
                        ) : (
                          <>
                            <PowerOff className="h-4 w-4 mr-2" />
                            Deactivate
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingAgent(agent)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    
                    {!agent.is_public ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPublishDialog(agent)}
                        disabled={publishing === agent.id}
                      >
                        {publishing === agent.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            Publish
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnpublish(agent.id)}
                        disabled={unpublishing === agent.id}
                      >
                        {unpublishing === agent.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Unpublishing...
                          </>
                        ) : (
                          <>
                            <GlobeOff className="h-4 w-4 mr-2" />
                            Unpublish
                          </>
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
                          <Trash2 className="h-4 w-4 text-red-500" />
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
