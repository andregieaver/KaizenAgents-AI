/**
 * MemberCard - Displays a team member card
 */
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Crown, Shield, Users, MoreHorizontal, Mail, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to resolve image URLs
const resolveImageUrl = (url) => {
  if (!url || url === 'None' || url === 'null' || url === 'undefined') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BACKEND_URL}${url}`;
  return url;
};

const getRoleBadge = (role) => {
  switch (role) {
    case 'owner':
      return (
        <Badge className="bg-amber-500">
          <Crown className="h-3 w-3 mr-1" />
          Owner
        </Badge>
      );
    case 'admin':
      return (
        <Badge className="bg-blue-500">
          <Shield className="h-3 w-3 mr-1" />
          Admin
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Users className="h-3 w-3 mr-1" />
          Agent
        </Badge>
      );
  }
};

const MemberCard = ({ 
  member, 
  currentUserId,
  canManage,
  onChangeRole,
  onDelete 
}) => {
  const isCurrentUser = member.id === currentUserId;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={resolveImageUrl(member.avatar_url)} />
              <AvatarFallback className="bg-primary/10">
                <span className="text-lg font-semibold text-primary">
                  {member.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{member.name}</span>
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs">You</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3 w-3" />
                {member.email}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getRoleBadge(member.role)}
            
            {canManage && !isCurrentUser && member.role !== 'owner' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onChangeRole(member, 'admin')}>
                    <Shield className="h-4 w-4 mr-2" />
                    Make Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeRole(member, 'agent')}>
                    <Users className="h-4 w-4 mr-2" />
                    Make Agent
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(member.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberCard;
