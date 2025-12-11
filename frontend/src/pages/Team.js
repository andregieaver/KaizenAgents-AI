import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
  Crown
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Team = () => {
  const { user, token } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'agent' });
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);

  const canManageUsers = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMembers(response.data);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

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
      toast.error(error.response?.data?.detail || 'Failed to invite user');
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

  const handleRemove = async (userId) => {
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

  return (
    <div className="p-6 lg:p-8 page-transition" data-testid="team-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-2">Team</h1>
          <p className="text-muted-foreground">Manage your team members and their access</p>
        </div>
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
                        data-testid="invite-name-input"
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
                        data-testid="invite-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                      >
                        <SelectTrigger data-testid="invite-role-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="agent">Agent</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Admins can manage team. Agents can handle conversations. Viewers can only read.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={closeInviteDialog}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={inviteLoading} data-testid="send-invite-btn">
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
                      Share these credentials with the new team member. They should change their password after first login.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-sm space-y-2">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Email:</span>{' '}
                        <span className="font-mono">{inviteForm.email || members[members.length - 1]?.email}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Temporary Password:</span>{' '}
                        <span className="font-mono font-medium">{tempPassword}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={copyTempPassword}
                      data-testid="copy-password-btn"
                    >
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
                <div key={member.id} className="p-4 flex items-center justify-between" data-testid="team-member-row">
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
                        <SelectTrigger className="w-28" data-testid="role-select">
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
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" data-testid="remove-user-btn">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove {member.name} from your team. They will no longer have access to conversations or settings.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemove(member.id)}
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

      {!canManageUsers && (
        <p className="text-sm text-muted-foreground mt-4">
          <Shield className="h-4 w-4 inline mr-1" />
          Only owners and admins can invite or manage team members.
        </p>
      )}
    </div>
  );
};

export default Team;
