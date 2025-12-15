import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Store, Search, Loader2, CheckCircle, Users, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Marketplace = () => {
  const { token, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'customer_support', label: 'Customer Support' },
    { value: 'sales', label: 'Sales' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'hospitality', label: 'Hospitality' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'general', label: 'General' }
  ];

  useEffect(() => {
    fetchAgents();
  }, [token]);

  useEffect(() => {
    filterAgents();
  }, [agents, searchQuery, selectedCategory]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/marketplace/`, { headers });
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  const filterAgents = () => {
    let filtered = agents;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(agent => agent.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query)
      );
    }

    setFilteredAgents(filtered);
  };

  const handleViewDetails = (agent) => {
    setSelectedAgent(agent);
    setDetailModalOpen(true);
  };

  const handleCloneAgent = async () => {
    if (!selectedAgent) return;

    setCloning(true);
    try {
      await axios.post(
        `${API}/marketplace/${selectedAgent.id}/clone`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedAgent.name} added to your workspace!`);
      setDetailModalOpen(false);
      setSelectedAgent(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clone agent');
    } finally {
      setCloning(false);
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
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Store className="h-8 w-8" />
          Agent Marketplace
        </h1>
        <p className="text-muted-foreground mt-2">
          Discover and use pre-configured AI agents for different use cases
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAgents.length} {filteredAgents.length === 1 ? 'agent' : 'agents'}
      </div>

      {/* Agent Grid */}
      {filteredAgents.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No agents found matching your criteria
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="border border-border hover:border-primary/50 transition-colors cursor-pointer group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="text-4xl mb-2">{agent.icon}</div>
                  <Badge variant="outline" className={cn("text-xs", getCategoryBadgeColor(agent.category))}>
                    {categories.find(c => c.value === agent.category)?.label || agent.category}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {agent.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>Used by {agent.usage_count} {agent.usage_count === 1 ? 'team' : 'teams'}</span>
                </div>
                <Button
                  onClick={() => handleViewDetails(agent)}
                  variant="outline"
                  className="w-full group-hover:border-primary group-hover:text-primary"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Agent Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedAgent && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <div className="text-5xl">{selectedAgent.icon}</div>
                  <div className="flex-1">
                    <DialogTitle className="text-2xl mb-2">{selectedAgent.name}</DialogTitle>
                    <Badge variant="outline" className={cn("text-xs", getCategoryBadgeColor(selectedAgent.category))}>
                      {categories.find(c => c.value === selectedAgent.category)?.label}
                    </Badge>
                  </div>
                </div>
                <DialogDescription className="text-base pt-4">
                  {selectedAgent.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Configuration Preview */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Configuration Preview
                  </h3>
                  <div className="space-y-3">
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Tone</p>
                      <p className="text-sm capitalize">{selectedAgent.config.ai_tone}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Welcome Message</p>
                      <p className="text-sm">{selectedAgent.config.welcome_message}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Persona</p>
                      <p className="text-sm line-clamp-3">{selectedAgent.config.ai_persona}</p>
                    </div>
                  </div>
                </div>

                {/* Usage Stats */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Used by {selectedAgent.usage_count} teams</span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
                  Close
                </Button>
                {isAuthenticated && (
                  <Button onClick={handleCloneAgent} disabled={cloning}>
                    {cloning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Use This Agent
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketplace;