import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  History,
  Clock,
  GitBranch,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AgentVersionHistory = ({ agentId, agentName, open, onOpenChange, onRollback }) => {
  const { token } = useAuth();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState(new Set());
  const [rollingBack, setRollingBack] = useState(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/agents/${agentId}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersions(response.data);
    } catch (error) {
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [agentId, token]);

  useEffect(() => {
    if (open && agentId) {
      fetchVersions();
    }
  }, [open, agentId, fetchVersions]);

  const toggleExpanded = (versionNum) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionNum)) {
      newExpanded.delete(versionNum);
    } else {
      newExpanded.add(versionNum);
    }
    setExpandedVersions(newExpanded);
  };

  const handleRollback = async (version) => {
    if (!window.confirm(`Are you sure you want to rollback to version ${version}? This will create a new version with the old configuration.`)) {
      return;
    }

    setRollingBack(version);
    try {
      await axios.post(
        `${API}/admin/agents/${agentId}/rollback/${version}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Successfully rolled back to version ${version}`);
      onOpenChange(false);
      if (onRollback) onRollback();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to rollback');
    } finally {
      setRollingBack(null);
    }
  };

  const getDiffSummary = (current, previous) => {
    if (!previous) return null;

    const changes = [];
    const currentConfig = current.config;
    const prevConfig = previous.config;

    if (currentConfig.model !== prevConfig.model) {
      changes.push(`Model: ${prevConfig.model} → ${currentConfig.model}`);
    }
    if (currentConfig.temperature !== prevConfig.temperature) {
      changes.push(`Temperature: ${prevConfig.temperature} → ${currentConfig.temperature}`);
    }
    if (currentConfig.max_tokens !== prevConfig.max_tokens) {
      changes.push(`Max Tokens: ${prevConfig.max_tokens} → ${currentConfig.max_tokens}`);
    }
    if (currentConfig.system_prompt !== prevConfig.system_prompt) {
      changes.push('System Prompt: Modified');
    }

    return changes;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History - {agentName}
          </DialogTitle>
          <DialogDescription>
            View and manage all versions of this agent. You can rollback to any previous version.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No version history available</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {versions.map((version, index) => {
                const prevVersion = versions[index + 1];
                const changes = getDiffSummary(version, prevVersion);
                const isExpanded = expandedVersions.has(version.version);
                const isLatest = index === 0;

                return (
                  <div
                    key={version.id}
                    className={`border rounded-lg p-4 ${isLatest ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    {/* Version Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isLatest ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <GitBranch className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">Version {version.version}</h3>
                            {isLatest && (
                              <Badge variant="default" className="text-xs">Current</Badge>
                            )}
                            {version.is_rollback && (
                              <Badge variant="secondary" className="text-xs">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Rollback from v{version.rolled_back_from}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}</span>
                            {version.created_by && (
                              <>
                                <span>•</span>
                                <User className="h-3 w-3" />
                                <span>by admin</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isLatest && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRollback(version.version)}
                          disabled={rollingBack === version.version}
                        >
                          {rollingBack === version.version ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Rolling back...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Rollback
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Changes Summary */}
                    {changes && changes.length > 0 && (
                      <div className="mb-3 p-3 bg-muted/50 rounded-md">
                        <p className="text-sm font-medium mb-2">Changes from v{prevVersion.version}:</p>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          {changes.map((change, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Configuration Details */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(version.version)}
                      className="w-full justify-between"
                    >
                      <span className="text-sm">Configuration Details</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>

                    {isExpanded && (
                      <div className="mt-3 space-y-3 p-3 bg-muted/30 rounded-md">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Model</p>
                          <p className="text-sm font-mono">{version.config.model}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Temperature</p>
                            <p className="text-sm font-mono">{version.config.temperature}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Max Tokens</p>
                            <p className="text-sm font-mono">{version.config.max_tokens}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">System Prompt</p>
                          <ScrollArea className="h-32 w-full rounded-md border p-2 bg-background">
                            <pre className="text-xs whitespace-pre-wrap font-mono">
                              {version.config.system_prompt}
                            </pre>
                          </ScrollArea>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgentVersionHistory;
