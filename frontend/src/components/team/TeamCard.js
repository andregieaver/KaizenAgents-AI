/**
 * TeamCard - Displays a team group card with members and AI agent assignment
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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
} from '../ui/alert-dialog';
import { Users, Edit, Bot, UserPlus, Trash2 } from 'lucide-react';

const TeamCard = ({ 
  team, 
  canManage,
  onEdit,
  onManageMembers,
  onAssignAgent,
  onDelete
}) => {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: (team.color || '#6366f1') + '20' }}
            >
              <Users className="h-5 w-5" style={{ color: team.color || '#6366f1' }} />
            </div>
            <div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {team.description || 'No description'}
              </CardDescription>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onEdit(team)}
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
                      onClick={() => onDelete(team.id)}
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
          {canManage && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onAssignAgent(team)}
            >
              {team.agent_id ? 'Change' : 'Assign'}
            </Button>
          )}
        </div>

        {/* Members count */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {team.member_count || 0} member{(team.member_count || 0) !== 1 ? 's' : ''}
          </span>
          {canManage && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onManageMembers(team)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Manage Members
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamCard;
