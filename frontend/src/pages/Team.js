/**
 * Team Page - Manage team members, groups, and AI agents
 * Refactored to use extracted components from /components/team/
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  Crown,
  FolderPlus,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

// Import extracted components
import {
  SeatUsageCard,
  SeatPurchaseModal,
  InviteUserModal,
  TeamCard,
  TeamFormModal,
  ManageMembersModal,
  AssignAgentModal
} from '../components/team';

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
  
  // Modal states
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedTeamForMember, setSelectedTeamForMember] = useState(null);
  const [assignAgentModalOpen, setAssignAgentModalOpen] = useState(false);
  const [selectedTeamForAgent, setSelectedTeamForAgent] = useState(null);
  
  // Action states
  const [savingTeam, setSavingTeam] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);

  const canManageUsers = user?.role === 'owner' || user?.role === 'admin';

  // Handle seat purchase success/cancel from URL params
  useEffect(() => {
    const handleSeatPurchaseCallback = async () => {
      const seatsSuccess = searchParams.get('seats_success');
      const seatsCanceled = searchParams.get('seats_canceled');
      const sessionId = searchParams.get('session_id');
      
      if (seatsSuccess === 'true' && sessionId) {
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
        } catch {
          toast.error('Failed to verify seat purchase');
        }
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
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  // User handlers
  const handleInviteSuccess = (newUser) => {
    setMembers([...members, newUser]);
    fetchData(); // Refresh to get updated seat info
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
    } catch {
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
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to remove user');
    }
  };

  // Team handlers
  const openCreateTeam = () => {
    setSelectedTeam(null);
    setTeamModalOpen(true);
  };

  const openEditTeam = (team) => {
    setSelectedTeam(team);
    setTeamModalOpen(true);
  };

  const handleSaveTeam = async (formData) => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setSavingTeam(true);
    try {
      if (selectedTeam) {
        const response = await axios.patch(
          `${API}/teams/${selectedTeam.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTeams(teams.map(t => t.id === selectedTeam.id ? response.data : t));
        toast.success('Team updated');
      } else {
        const response = await axios.post(
          `${API}/teams`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTeams([...teams, response.data]);
        toast.success('Team created');
      }
      setTeamModalOpen(false);
    } catch {
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
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to delete team');
    }
  };

  // Team member update handler
  const handleTeamMemberUpdate = (teamId, action) => {
    setTeams(teams.map(t => 
      t.id === teamId 
        ? { ...t, member_count: action === 'add' ? t.member_count + 1 : Math.max(0, t.member_count - 1) }
        : t
    ));
  };

  // Agent assignment handler
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
    } catch {
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

  const totalSeats = seatInfo.limit;
  const usedSeats = seatInfo.current;
  const remainingSeats = Math.max(0, totalSeats - usedSeats);

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="team-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">Users</h1>
          <p className="text-muted-foreground">Manage your team members, groups, and AI agents</p>
        </div>
        
        {/* Seat Usage Card */}
        <SeatUsageCard 
          seatInfo={seatInfo} 
          onPurchaseClick={() => setPurchaseModalOpen(true)} 
        />
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="teams">
            <FolderPlus className="h-4 w-4 mr-2" />
            Teams ({teams.length})
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-heading">Team Members</CardTitle>
                <CardDescription>
                  {remainingSeats > 0 
                    ? `${remainingSeats} seat${remainingSeats !== 1 ? 's' : ''} available`
                    : 'No seats available'}
                </CardDescription>
              </div>
              {canManageUsers && (
                <Button onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {member.role === 'owner' ? (
                            <Crown className="h-5 w-5 text-amber-500" />
                          ) : (
                            <span className="text-sm font-medium">
                              {member.name?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.name}</span>
                            {member.id === user?.id && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {canManageUsers && member.id !== user?.id && member.role !== 'owner' ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleRoleChange(member.id, value)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3 w-3" />
                                  Admin
                                </div>
                              </SelectItem>
                              <SelectItem value="agent">
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3" />
                                  Agent
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">
                            {member.role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
                            {member.role}
                          </Badge>
                        )}
                        
                        {canManageUsers && member.id !== user?.id && member.role !== 'owner' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
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
                <TeamCard
                  key={team.id}
                  team={team}
                  canManage={canManageUsers}
                  onEdit={openEditTeam}
                  onManageMembers={(t) => {
                    setSelectedTeamForMember(t);
                    setAddMemberModalOpen(true);
                  }}
                  onAssignAgent={(t) => {
                    setSelectedTeamForAgent(t);
                    setAssignAgentModalOpen(true);
                  }}
                  onDelete={handleDeleteTeam}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SeatPurchaseModal
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
        seatInfo={seatInfo}
        token={token}
        onSuccess={fetchData}
      />

      <InviteUserModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        token={token}
        remainingSeats={remainingSeats}
        onSuccess={handleInviteSuccess}
      />

      <TeamFormModal
        open={teamModalOpen}
        onOpenChange={setTeamModalOpen}
        team={selectedTeam}
        onSave={handleSaveTeam}
        saving={savingTeam}
      />

      <ManageMembersModal
        open={addMemberModalOpen}
        onOpenChange={setAddMemberModalOpen}
        team={selectedTeamForMember}
        allMembers={members}
        token={token}
        onUpdate={handleTeamMemberUpdate}
      />

      <AssignAgentModal
        open={assignAgentModalOpen}
        onOpenChange={setAssignAgentModalOpen}
        team={selectedTeamForAgent}
        agents={agents}
        onAssign={handleAssignAgent}
        loading={assigningAgent}
      />

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
