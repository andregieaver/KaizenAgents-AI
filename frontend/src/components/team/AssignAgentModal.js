/**
 * AssignAgentModal - Modal for assigning AI agents to a team
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
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Bot, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const AssignAgentModal = ({ 
  open, 
  onOpenChange, 
  team, 
  agents,
  onAssign,
  loading 
}) => {
  const handleAssignAgent = (agentId) => {
    if (onAssign && !loading) {
      onAssign(agentId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign AI Agent</DialogTitle>
          <DialogDescription>
            Select an AI agent to handle conversations for {team?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {/* Option to remove agent */}
          <div 
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              !team?.agent_id ? "border-primary bg-primary/5" : "hover:bg-muted"
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
                  team?.agent_id === agent.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                )}
                onClick={() => handleAssignAgent(agent.id)}
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
                {team?.agent_id === agent.id && (
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignAgentModal;
