/**
 * InviteUserModal - Modal for inviting new team members
 * Handles the invite flow with temporary password display
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { UserPlus, Loader2, Check, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const InviteUserModal = ({ 
  open, 
  onOpenChange, 
  token, 
  remainingSeats,
  onSuccess 
}) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', role: 'agent' });
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async (e) => {
    e?.preventDefault();
    if (!form.name || !form.email) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/users/invite`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Show temp password if returned
      if (response.data.temp_password) {
        setTempPassword(response.data.temp_password);
      }
      
      toast.success('User invited successfully!');
      
      if (onSuccess) {
        onSuccess(response.data);
      }
      
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
        handleClose();
      } else {
        toast.error(errorDetail || 'Failed to invite user');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    toast.success('Password copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setForm({ name: '', email: '', role: 'agent' });
    setTempPassword(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a new member to your team
          </DialogDescription>
        </DialogHeader>
        
        {tempPassword ? (
          <div className="py-6 space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              User has been invited! Share the temporary password:
            </p>
            <div className="flex items-center gap-2">
              <Input 
                value={tempPassword} 
                readOnly 
                className="font-mono"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyTempPassword}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              The user will be asked to change this password on first login.
            </p>
            <DialogFooter className="mt-4">
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleInvite}>
            {remainingSeats <= 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm mb-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>No seats available. Purchase more seats to invite team members.</span>
              </div>
            )}
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full Name</Label>
                <Input
                  id="invite-name"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="john@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent - Can handle conversations</SelectItem>
                    <SelectItem value="admin">Admin - Full access except billing</SelectItem>
                    <SelectItem value="owner">Owner - Full access including billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={loading || remainingSeats <= 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Inviting...
                  </>
                ) : (
                  'Send Invitation'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserModal;
