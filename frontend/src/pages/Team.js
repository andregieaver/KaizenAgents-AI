import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Copy,
  Check,
  Crown,
  FolderPlus,
  Bot,
  Edit,
  UserMinus,
  Loader2,
  ExternalLink,
  Plus,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Team = () => {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Seat quota state
  const [seatInfo, setSeatInfo] = useState({
    current: 0,
    limit: 0,
    extraSeats: 0,
    percentage: 0,
    planName: 'free',
    pricePerSeatMonthly: 0,
    pricePerSeatYearly: 0
  });
  
  // Seat subscription state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  
  // Invite user state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'agent' });
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // Team management state
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', color: '#6366f1' });
  const [savingTeam, setSavingTeam] = useState(false);
  
  // Add member to team state
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedTeamForMember, setSelectedTeamForMember] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [addingMember, setAddingMember] = useState(false);
  
  // Assign agent state
  const [assignAgentModalOpen, setAssignAgentModalOpen] = useState(false);
  const [selectedTeamForAgent, setSelectedTeamForAgent] = useState(null);
  const [assigningAgent, setAssigningAgent] = useState(false);
  
  const navigate = useNavigate();
  const canManageUsers = user?.role === 'owner' || user?.role === 'admin';

  const teamColors = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Purple', value: '#a855f7' },
  ];

  // Handle seat purchase success/cancel from URL params
  useEffect(() => {
    const handleSeatPurchaseCallback = async () => {
      const seatsSuccess = searchParams.get('seats_success');
      const seatsCanceled = searchParams.get('seats_canceled');
      const sessionId = searchParams.get('session_id');
      
      if (seatsSuccess === 'true' && sessionId) {
        // Verify the seat purchase
        try {
          const response = await axios.post(
            `${API}/quotas/extra-seats/verify?session_id=${sessionId}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (response.data.status === 'completed') {
            toast.success(`Successfully added ${response.data.quantity} seat(s)!`);
          } else if (response.data.status === 'already_processed') {
            toast.info('This seat purchase was already processed');
          }
        } catch (error) {
          toast.error('Failed to verify seat purchase');
        }
        
        // Clear URL params
        setSearchParams({});
      } else if (seatsCanceled === 'true') {
        toast.info('Seat purchase was canceled');
        setSearchParams({});
      }
    };
    
    if (token) {
      handleSeatPurchaseCallback();
    }
  }, [searchParams, token, setSearchParams]);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, teamsRes, agentsRes, quotaRes, seatPricingRes] = await Promise.all([
        axios.get(`${API}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/teams`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/agents`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/quotas/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: null })),
        axios.get(`${API}/quotas/extra-seats`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { price_per_seat: 5 } }))
      ]);
      setMembers(membersRes.data);
      setTeams(teamsRes.data);
      setAgents(agentsRes.data);
      
      // Extract seat info from quota response
      if (quotaRes.data) {
        const seatQuota = quotaRes.data.quotas?.find(q => q.feature_key === 'max_seats');
        if (seatQuota) {
          setSeatInfo({
            current: seatQuota.current || 0,
            limit: seatQuota.limit || 0,
            extraSeats: quotaRes.data.extra_seats || 0,
            percentage: seatQuota.percentage || 0,
            planName: quotaRes.data.plan_name || 'free',
            pricePerSeatMonthly: seatPricingRes.data?.price_per_seat_monthly || 5,
            pricePerSeatYearly: seatPricingRes.data?.price_per_seat_yearly || 50
          });
        }
      }
    } catch (error) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeSeats = async () => {
    if (seatQuantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    setPurchaseLoading(true);
    try {
      const response = await axios.post(
        `${API}/quotas/extra-seats/checkout`,
        { quantity: seatQuantity, billing_cycle: billingCycle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Redirect to Stripe checkout
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail) {
        toast.error(detail);
      } else {
        toast.error('Failed to create checkout session');
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  // User invite handlers
  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const response = await axios.post(
        `${API}/users/invite`,
        inviteForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMembers([...members, response.data]);
      setTempPassword(response.data.temp_password);
      setInviteForm({ name: '', email: '', role: 'agent' });
      toast.success('User invited successfully!');
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      
      // Check if it's a quota error
      if (errorDetail && typeof errorDetail === 'object' && errorDetail.error === 'quota_exceeded') {
        toast.error(errorDetail.message, {
          action: {
            label: 'View Plans',
            onClick: () => navigate('/dashboard/pricing')
          }
        });
        setInviteOpen(false);
      } else {
        toast.error(errorDetail || 'Failed to invite user');
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.patch(
        `${API}/users/${userId}`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMembers(members.map(m => m.id === userId ? { ...m, role: newRole } : m));
      toast.success('Role updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMembers(members.filter(m => m.id !== userId));
      toast.success('User removed from team');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove user');
    }
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    toast.success('Password copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const closeInviteDialog = () => {
    setInviteOpen(false);
    setTempPassword(null);
    setCopied(false);
  };

  // Team handlers
  const openCreateTeam = () => {
    setSelectedTeam(null);
    setTeamForm({ name: '', description: '', color: '#6366f1' });
    setTeamModalOpen(true);
  };

  const openEditTeam = (team) => {
    setSelectedTeam(team);
    setTeamForm({
      name: team.name,
      description: team.description || '',
      color: team.color || '#6366f1'
    });
    setTeamModalOpen(true);
  };

  const handleSaveTeam = async () => {
    if (!teamForm.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setSavingTeam(true);
    try {
      if (selectedTeam) {
        const response = await axios.patch(
          `${API}/teams/${selectedTeam.id}`,
          teamForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTeams(teams.map(t => t.id === selectedTeam.id ? response.data : t));
        toast.success('Team updated');
      } else {
        const response = await axios.post(
          `${API}/teams`,
          teamForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTeams([...teams, response.data]);
        toast.success('Team created');
      }
      setTeamModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save team');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      await axios.delete(`${API}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeams(teams.filter(t => t.id !== teamId));
      toast.success('Team deleted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete team');
    }
  };

  // Team member handlers
  const openAddMemberModal = async (team) => {
    setSelectedTeamForMember(team);
    setAddMemberModalOpen(true);
    
    // Fetch current team members
    try {
      const response = await axios.get(`${API}/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data);
    } catch (error) {
      setTeamMembers([]);
    }
  };

  const handleAddMember = async (userId) => {
    setAddingMember(true);
    try {
      await axios.post(
        `${API}/teams/${selectedTeamForMember.id}/members`,
        { user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh team members
      const response = await axios.get(`${API}/teams/${selectedTeamForMember.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data);
      
      // Update team member count
      setTeams(teams.map(t => 
        t.id === selectedTeamForMember.id 
          ? { ...t, member_count: t.member_count + 1 }
          : t
      ));
      
      toast.success('Member added to team');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await axios.delete(`${API}/teams/${selectedTeamForMember.id}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTeamMembers(teamMembers.filter(m => m.user_id !== userId));
      
      // Update team member count
      setTeams(teams.map(t => 
        t.id === selectedTeamForMember.id 
          ? { ...t, member_count: Math.max(0, t.member_count - 1) }
          : t
      ));
      
      toast.success('Member removed from team');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove member');
    }
  };

  // Agent assignment handlers
  const openAssignAgentModal = (team) => {
    setSelectedTeamForAgent(team);
    setAssignAgentModalOpen(true);
  };

  const handleAssignAgent = async (agentId) => {
    setAssigningAgent(true);
    try {
      const response = await axios.patch(
        `${API}/teams/${selectedTeamForAgent.id}`,
        { agent_id: agentId || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTeams(teams.map(t => 
        t.id === selectedTeamForAgent.id ? response.data : t
      ));
      
      toast.success(agentId ? 'Agent assigned to team' : 'Agent removed from team');
      setAssignAgentModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign agent');
    } finally {
      setAssigningAgent(false);
    }
  };

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'agent': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[400px] bg-muted rounded-sm" />
        </div>
      </div>
    );
  }

  // Calculate remaining seats
  const totalSeats = seatInfo.limit;
  const usedSeats = seatInfo.current;
  const remainingSeats = Math.max(0, totalSeats - usedSeats);
  const baseSeats = seatInfo.limit - seatInfo.extraSeats;
  const canPurchaseSeats = seatInfo.planName !== 'free';

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="team-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">Users</h1>
          <p className="text-muted-foreground">Manage your team members, groups, and AI agents</p>
        </div>
        
        {/* Seat Usage Card */}
        <Card className="sm:min-w-[300px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Seats</span>
              <span className="text-sm text-muted-foreground">
                {usedSeats} / {totalSeats} used
              </span>
            </div>
            <Progress value={seatInfo.percentage} className="h-2 mb-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {seatInfo.extraSeats > 0 
                  ? `${baseSeats} base + ${seatInfo.extraSeats} purchased`
                  : `${remainingSeats} available`
                }
              </span>
              {canPurchaseSeats ? (
                <button 
                  onClick={() => setPurchaseModalOpen(true)}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Buy seats
                </button>
              ) : (
                <Link 
                  to="/dashboard/pricing" 
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Upgrade plan
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seat Subscription Modal */}
      <Dialog open={purchaseModalOpen} onOpenChange={setPurchaseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Subscribe to Additional Seats
            </DialogTitle>
            <DialogDescription>
              Add more seats to your team subscription. You currently have {usedSeats} users 
              and {totalSeats} total seats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Billing Cycle Selection */}
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={billingCycle === 'monthly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBillingCycle('monthly')}
                  className="w-full"
                >
                  Monthly
                </Button>
                <Button
                  variant={billingCycle === 'yearly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBillingCycle('yearly')}
                  className="w-full"
                >
                  Yearly
                  <Badge variant="secondary" className="ml-2 text-xs">Save 20%</Badge>
                </Button>
              </div>
            </div>
            
            {/* Quantity Selection */}
            <div className="space-y-2">
              <Label htmlFor="seat-quantity">Number of Seats</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSeatQuantity(Math.max(1, seatQuantity - 1))}
                  disabled={seatQuantity <= 1}
                >
                  -
                </Button>
                <Input
                  id="seat-quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={seatQuantity}
                  onChange={(e) => setSeatQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSeatQuantity(seatQuantity + 1)}
                >
                  +
                </Button>
              </div>
            </div>
            
            {/* Price Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Price per seat</span>
                <span>
                  ${billingCycle === 'monthly' 
                    ? (seatInfo.pricePerSeatMonthly || 5).toFixed(2) + '/mo'
                    : (seatInfo.pricePerSeatYearly || 50).toFixed(2) + '/yr'
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Quantity</span>
                <span>× {seatQuantity}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>
                  ${billingCycle === 'monthly'
                    ? ((seatInfo.pricePerSeatMonthly || 5) * seatQuantity).toFixed(2) + '/mo'
                    : ((seatInfo.pricePerSeatYearly || 50) * seatQuantity).toFixed(2) + '/yr'
                  }
                </span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              This is a recurring subscription. You can upgrade, downgrade, or cancel anytime through your billing portal.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubscribeSeats} disabled={purchaseLoading}>
              {purchaseLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Subscribe to Seats
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="members" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4" />
              Teams
            </TabsTrigger>
          </TabsList>
          
          {/* Invite User Button - inline with tabs */}
          {canManageUsers && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="btn-hover" data-testid="invite-user-btn">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                {!tempPassword ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="font-heading">Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Add a new member to your team. They&apos;ll receive a temporary password.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={inviteForm.name}
                          onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                          placeholder="john@company.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={inviteForm.role}
                          onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeInviteDialog}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={inviteLoading}>
                          {inviteLoading ? 'Inviting...' : 'Send Invite'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="font-heading">User Invited!</DialogTitle>
                      <DialogDescription>
                        Share these credentials with the new team member.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-sm space-y-2">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Email:</span>{' '}
                          <span className="font-mono">{members[members.length - 1]?.email}</span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Temporary Password:</span>{' '}
                          <span className="font-mono font-medium">{tempPassword}</span>
                        </p>
                      </div>
                      <Button variant="outline" className="w-full" onClick={copyTempPassword}>
                        {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        {copied ? 'Copied!' : 'Copy Password'}
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button onClick={closeInviteDialog}>Done</Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border">
                  {members.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.name} className="h-full w-full object-cover" />
                          ) : member.role === 'owner' ? (
                            <Crown className="h-5 w-5 text-amber-500" />
                          ) : (
                            <span className="text-sm font-medium">{member.name?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.name}</p>
                            {member.id === user?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {canManageUsers && member.role !== 'owner' && member.id !== user?.id ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleRoleChange(member.id, value)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="agent">Agent</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">
                            {member.role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
                            {member.role}
                          </Badge>
                        )}
                        
                        {canManageUsers && member.role !== 'owner' && member.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {member.name} from your team.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveUser(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams">
          <div className="flex justify-end mb-4">
            {canManageUsers && (
              <Button onClick={openCreateTeam}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            )}
          </div>

          {teams.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderPlus className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create teams to organize your members and assign AI agents
                </p>
                {canManageUsers && (
                  <Button onClick={openCreateTeam}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create First Team
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <Card key={team.id} className="border border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: team.color + '20' }}
                        >
                          <Users className="h-5 w-5" style={{ color: team.color }} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{team.name}</CardTitle>
                          <CardDescription className="line-clamp-1">
                            {team.description || 'No description'}
                          </CardDescription>
                        </div>
                      </div>
                      {canManageUsers && (
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => openEditTeam(team)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete team?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the team &quot;{team.name}&quot; and remove all member associations.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTeam(team.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* AI Agent */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {team.agent_name || 'No AI Agent assigned'}
                        </span>
                      </div>
                      {canManageUsers && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openAssignAgentModal(team)}
                        >
                          {team.agent_id ? 'Change' : 'Assign'}
                        </Button>
                      )}
                    </div>

                    {/* Members count */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                      </span>
                      {canManageUsers && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openAddMemberModal(team)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Manage Members
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Team Modal */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTeam ? 'Edit Team' : 'Create Team'}</DialogTitle>
            <DialogDescription>
              {selectedTeam ? 'Update team details' : 'Create a new team to organize your members'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-name">Team Name *</Label>
              <Input
                id="team-name"
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                placeholder="e.g., Sales Team"
              />
            </div>
            <div>
              <Label htmlFor="team-description">Description</Label>
              <Textarea
                id="team-description"
                value={teamForm.description}
                onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {teamColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      teamForm.color === color.value 
                        ? "border-foreground scale-110" 
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setTeamForm({ ...teamForm, color: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTeam} disabled={savingTeam}>
              {savingTeam ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                selectedTeam ? 'Update Team' : 'Create Team'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Team Members Modal */}
      <Dialog open={addMemberModalOpen} onOpenChange={setAddMemberModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Team Members</DialogTitle>
            <DialogDescription>
              {selectedTeamForMember?.name} - Add or remove members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current Members */}
            {teamMembers.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Current Members</Label>
                <div className="mt-2 space-y-2">
                  {teamMembers.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
                          <span className="text-xs font-medium">{member.user_name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.user_name}</p>
                          <p className="text-xs text-muted-foreground">{member.user_email}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Members */}
            <div>
              <Label className="text-sm font-medium">Add Members</Label>
              <ScrollArea className="h-[200px] mt-2 border rounded-lg">
                <div className="p-2 space-y-1">
                  {members
                    .filter(m => !teamMembers.find(tm => tm.user_id === m.id))
                    .map((member) => (
                      <div 
                        key={member.id} 
                        className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer"
                        onClick={() => !addingMember && handleAddMember(member.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            {member.role === 'owner' ? (
                              <Crown className="h-4 w-4 text-amber-500" />
                            ) : (
                              <span className="text-xs font-medium">{member.name?.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" disabled={addingMember}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  {members.filter(m => !teamMembers.find(tm => tm.user_id === m.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      All members have been added to this team
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setAddMemberModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign AI Agent Modal */}
      <Dialog open={assignAgentModalOpen} onOpenChange={setAssignAgentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign AI Agent</DialogTitle>
            <DialogDescription>
              Select an AI agent to handle conversations for {selectedTeamForAgent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {/* Option to remove agent */}
            <div 
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                !selectedTeamForAgent?.agent_id ? "border-primary bg-primary/5" : "hover:bg-muted"
              )}
              onClick={() => handleAssignAgent(null)}
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Bot className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No Agent</p>
                <p className="text-sm text-muted-foreground">Remove AI agent from this team</p>
              </div>
            </div>

            {/* List of agents */}
            <ScrollArea className="h-[300px]">
              {agents.map((agent) => (
                <div 
                  key={agent.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors mb-2",
                    selectedTeamForAgent?.agent_id === agent.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                  onClick={() => !assigningAgent && handleAssignAgent(agent.id)}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {agent.description || 'No description'}
                    </p>
                  </div>
                  {selectedTeamForAgent?.agent_id === agent.id && (
                    <Badge>Current</Badge>
                  )}
                </div>
              ))}
              {agents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No AI agents available</p>
                  <p className="text-sm">Create agents in the Marketplace first</p>
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignAgentModalOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!canManageUsers && (
        <p className="text-sm text-muted-foreground mt-4">
          <Shield className="h-4 w-4 inline mr-1" />
          Only owners and admins can manage team members and teams.
        </p>
      )}
    </div>
  );
};

export default Team;
