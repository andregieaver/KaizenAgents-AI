/**
 * TeamFormModal - Modal for creating or editing teams
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const TEAM_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Purple', value: '#a855f7' },
];

const TeamFormModal = ({ 
  open, 
  onOpenChange, 
  team, 
  onSave,
  saving 
}) => {
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    color: '#6366f1' 
  });

  useEffect(() => {
    if (team) {
      setForm({
        name: team.name || '',
        description: team.description || '',
        color: team.color || '#6366f1'
      });
    } else {
      setForm({ name: '', description: '', color: '#6366f1' });
    }
  }, [team, open]);

  const handleSubmit = () => {
    if (onSave) {
      onSave(form);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? 'Edit Team' : 'Create Team'}</DialogTitle>
          <DialogDescription>
            {team ? 'Update team details' : 'Create a new team to organize your members'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="team-name">Team Name *</Label>
            <Input
              id="team-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Sales Team"
            />
          </div>
          <div>
            <Label htmlFor="team-description">Description</Label>
            <Textarea
              id="team-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2">
              {TEAM_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    form.color === color.value 
                      ? "border-foreground scale-110" 
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setForm({ ...form, color: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              team ? 'Update Team' : 'Create Team'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TeamFormModal;
