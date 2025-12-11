import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Bot,
  Upload,
  Loader2,
  FileText,
  Trash2,
  Globe,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AgentConfiguration = () => {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    agent_id: '',
    custom_instructions: '',
    scraping_domains: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [configRes, agentsRes] = await Promise.all([
        axios.get(`${API}/settings/agent-config`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/admin/agents`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })) // Non-admin users won't have access
      ]);

      setConfig(configRes.data);
      setAgents(agentsRes.data.filter(a => a.is_active));

      setFormData({
        agent_id: configRes.data.agent_id || '',
        custom_instructions: configRes.data.custom_instructions || '',
        scraping_domains: configRes.data.scraping_domains?.join(', ') || ''
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load agent configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(
        `${API}/settings/agent-config`,
        {
          agent_id: formData.agent_id || null,
          custom_instructions: formData.custom_instructions || null,
          scraping_domains: formData.scraping_domains
            ? formData.scraping_domains.split(',').map(d => d.trim()).filter(Boolean)
            : []
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Agent configuration saved');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.post(
        `${API}/settings/agent-config/upload-doc`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Document uploaded successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDocument = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;

    try {
      await axios.delete(
        `${API}/settings/agent-config/docs/${encodeURIComponent(filename)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Document deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Agent Configuration
          </CardTitle>
          <CardDescription>
            Select and customize an AI agent for your company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent Selection */}
          <div className="space-y-2">
            <Label htmlFor="agent-select">Select Agent</Label>
            <select
              id="agent-select"
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={formData.agent_id}
              onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
            >
              <option value="">No agent selected</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.provider_name} • {agent.model})
                </option>
              ))}
            </select>
            {config?.agent_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Currently using: {config.agent_name}
              </div>
            )}
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label htmlFor="custom-instructions">
              Custom Instructions
              <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
            </Label>
            <Textarea
              id="custom-instructions"
              placeholder="Add company-specific instructions, e.g., 'Always mention our 24/7 support hotline at 1-800-HELP'"
              rows={4}
              value={formData.custom_instructions}
              onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be added to the agent's base prompt
            </p>
          </div>

          {/* Web Scraping Domains */}
          <div className="space-y-2">
            <Label htmlFor="scraping-domains">
              <Globe className="h-4 w-4 inline mr-2" />
              Web Scraping Domains
              <span className="text-xs text-muted-foreground ml-2">(Optional, Phase 4)</span>
            </Label>
            <Input
              id="scraping-domains"
              placeholder="example.com, docs.example.com"
              value={formData.scraping_domains}
              onChange={(e) => setFormData({ ...formData, scraping_domains: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of domains to scrape for agent context
            </p>
          </div>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Documentation Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Knowledge Base Documents
          </CardTitle>
          <CardDescription>
            Upload company documentation for the agent to reference (PDF, TXT, MD, DOCX, CSV • Max 5MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.txt,.md,.docx,.csv"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </div>

          {/* Document List */}
          {config?.uploaded_docs && config.uploaded_docs.length > 0 ? (
            <div className="space-y-2">
              <Label>Uploaded Documents ({config.uploaded_docs.length})</Label>
              <ScrollArea className="h-[200px] border rounded-md">
                <div className="p-4 space-y-2">
                  {config.uploaded_docs.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-sm"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)} • {new Date(doc.upload_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.filename)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed rounded-md">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No documents uploaded yet
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-sm">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-600 mb-1">Phase 4: RAG Integration</p>
              <p className="text-blue-600/80">
                Documents are stored but not yet processed for AI retrieval. Vector embedding and semantic search will be implemented in Phase 4.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentConfiguration;
