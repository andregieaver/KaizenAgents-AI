/**
 * TeamCard - Displays a team group card
 */
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Users, Edit, Bot, UserPlus, Trash2 } from 'lucide-react';

const TeamCard = ({ 
  team, 
  members, 
  agents, 
  canManage,
  onEdit,
  onAddMember,
  onAssignAgent,
  onDelete,
  onRemoveMember,
  onRemoveAgent
}) => {
  const teamMembers = members.filter(m => team.member_ids?.includes(m.id));
  const teamAgents = agents.filter(a => team.agent_ids?.includes(a.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: team.color || '#6366f1' }}
            >
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
              {team.description && (
                <p className="text-sm text-muted-foreground">{team.description}</p>
              )}
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => onEdit(team)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive"
                onClick={() => onDelete(team.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Members */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Members ({teamMembers.length})</span>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => onAddMember(team)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
          {teamMembers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {teamMembers.map(member => (
                <Badge 
                  key={member.id} 
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10"
                  onClick={() => canManage && onRemoveMember(team.id, member.id)}
                >
                  {member.name}
                  {canManage && <span className="ml-1 text-destructive">×</span>}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No members assigned</p>
          )}
        </div>
        
        {/* Team Agents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">AI Agents ({teamAgents.length})</span>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => onAssignAgent(team)}>
                <Bot className="h-4 w-4 mr-1" />
                Assign
              </Button>
            )}
          </div>
          {teamAgents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {teamAgents.map(agent => (
                <Badge 
                  key={agent.id} 
                  variant="outline"
                  className="cursor-pointer hover:bg-destructive/10"
                  onClick={() => canManage && onRemoveAgent(team.id, agent.id)}
                >
                  <Bot className="h-3 w-3 mr-1" />
                  {agent.name}
                  {canManage && <span className="ml-1 text-destructive">×</span>}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No agents assigned</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamCard;
