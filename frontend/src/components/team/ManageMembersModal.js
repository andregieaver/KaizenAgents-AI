/**
 * ManageMembersModal - Modal for adding/removing members from a team
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { UserPlus, UserMinus, Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ManageMembersModal = ({ 
  open, 
  onOpenChange, 
  team, 
  allMembers,
  token,
  onUpdate 
}) => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (open && team) {
      fetchTeamMembers();
    }
  }, [open, team]);

  const fetchTeamMembers = async () => {
    if (!team) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data);
    } catch (error) {
      setTeamMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/teams/${team.id}/members`,
        { user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh team members
      await fetchTeamMembers();
      
      if (onUpdate) {
        onUpdate(team.id, 'add');
      }
      
      toast.success('Member added to team');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await axios.delete(`${API}/teams/${team.id}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTeamMembers(teamMembers.filter(m => m.user_id !== userId));
      
      if (onUpdate) {
        onUpdate(team.id, 'remove');
      }
      
      toast.success('Member removed from team');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove member');
    }
  };

  // Members not in the team
  const availableMembers = allMembers.filter(
    m => !teamMembers.find(tm => tm.user_id === m.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Team Members</DialogTitle>
          <DialogDescription>
            {team?.name} - Add or remove members
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
                  {availableMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer"
                      onClick={() => !actionLoading && handleAddMember(member.id)}
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
                      <Button variant="ghost" size="sm" disabled={actionLoading}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {availableMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      All members have been added to this team
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageMembersModal;
