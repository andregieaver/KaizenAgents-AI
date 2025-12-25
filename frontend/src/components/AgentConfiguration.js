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
  CheckCircle2,
  Languages
} from 'lucide-react';
import { toast } from 'sonner';
import { LanguageSelector } from './LanguageSelector';
import { cn } from '../lib/utils';
import { getLanguageName } from '../data/languages';

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
    scraping_domains: '',
    scraping_max_depth: 2,
    scraping_max_pages: 50,
    response_language: null,
    language_mode: 'browser'
  });
  const [scraping, setScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState(null);

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
        scraping_domains: configRes.data.scraping_domains?.join(', ') || '',
        scraping_max_depth: configRes.data.scraping_max_depth || 2,
        scraping_max_pages: configRes.data.scraping_max_pages || 50,
        response_language: configRes.data.response_language || null,
        language_mode: configRes.data.language_mode || 'browser'
      });
      
      // Fetch scraping status
      fetchScrapingStatus();
    } catch {
      toast.error('Failed to load agent configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchScrapingStatus = async () => {
    try {
      const response = await axios.get(`${API}/settings/agent-config/scrape-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScrapingStatus(response.data);
    } catch {
      // Scraping status fetch failed silently - status will remain as previous state
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
            : [],
          scraping_max_depth: parseInt(formData.scraping_max_depth),
          scraping_max_pages: parseInt(formData.scraping_max_pages),
          response_language: formData.response_language || null,
          language_mode: formData.language_mode
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Agent configuration saved');
      fetchData();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerScraping = async (forceRefresh = false) => {
    setScraping(true);
    try {
      const response = await axios.post(
        `${API}/settings/agent-config/scrape`,
        { force_refresh: forceRefresh },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Successfully scraped ${response.data.pages_scraped} pages and created ${response.data.chunks_created} chunks`);
      fetchScrapingStatus();
      fetchData();
    } catch {
      toast.error(error.response?.data?.detail || 'Failed to trigger scraping');
    } finally {
      setScraping(false);
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
    } catch {
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
    } catch {
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

          {/* Language Configuration */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              <div>
                <Label className="text-base">Response Language</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure the language for AI responses
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Language Selector */}
              <div className="space-y-2">
                <Label htmlFor="response-language">Preferred Language</Label>
                <LanguageSelector
                  value={formData.response_language}
                  onValueChange={(lang) => setFormData({ ...formData, response_language: lang })}
                  placeholder="Select language..."
                />
                {formData.response_language && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Selected: {getLanguageName(formData.response_language)}
                  </div>
                )}
              </div>

              {/* Language Mode - 3 Options */}
              <div className="space-y-2">
                <Label>Language Detection</Label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, language_mode: 'force' })}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left transition-all",
                      formData.language_mode === 'force'
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium text-sm">Force Language</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Always use the selected language, ignore user preferences
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, language_mode: 'browser' })}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left transition-all",
                      formData.language_mode === 'browser'
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium text-sm">Browser Language</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Auto-detect from user's browser settings (Accept-Language header)
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, language_mode: 'geo' })}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left transition-all",
                      formData.language_mode === 'geo'
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium text-sm">Geo Location</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Auto-detect from user's IP address/location
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label htmlFor="custom-instructions">
              Custom Instructions
              <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
            </Label>
            <Textarea
              id="custom-instructions"
              placeholder="Add company-specific instructions, e.g., &quot;Always mention our 24/7 support hotline at 1-800-HELP&quot;"
              rows={4}
              value={formData.custom_instructions}
              onChange={(e) => setFormData({ ...formData, custom_instructions: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be added to the agent&apos;s base prompt
            </p>
          </div>

          {/* Web Scraping Domains */}
          <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="scraping-domains">
                <Globe className="h-4 w-4 inline mr-2" />
                Web Scraping Domains
              </Label>
              <Input
                id="scraping-domains"
                placeholder="https://example.com, https://docs.example.com"
                value={formData.scraping_domains}
                onChange={(e) => setFormData({ ...formData, scraping_domains: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of domain URLs to scrape for agent context
              </p>
            </div>

            {/* Scraping Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-depth" className="text-xs">
                  Max Depth
                </Label>
                <Input
                  id="max-depth"
                  type="number"
                  min="1"
                  max="5"
                  value={formData.scraping_max_depth}
                  onChange={(e) => setFormData({ ...formData, scraping_max_depth: e.target.value })}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">Levels to crawl (1-5)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-pages" className="text-xs">
                  Max Pages/Domain
                </Label>
                <Input
                  id="max-pages"
                  type="number"
                  min="1"
                  max="200"
                  value={formData.scraping_max_pages}
                  onChange={(e) => setFormData({ ...formData, scraping_max_pages: e.target.value })}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">Pages limit (1-200)</p>
              </div>
            </div>

            {/* Scraping Status */}
            {scrapingStatus && scrapingStatus.domains.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-background border border-border rounded-md">
                <div className="flex items-center gap-2">
                  {scrapingStatus.status === 'in_progress' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm">Scraping in progress...</span>
                    </>
                  )}
                  {scrapingStatus.status === 'completed' && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{scrapingStatus.pages_scraped} pages scraped</span>
                    </>
                  )}
                  {scrapingStatus.status === 'failed' && (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Scraping failed</span>
                    </>
                  )}
                  {scrapingStatus.status === 'idle' && (
                    <>
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Ready to scrape</span>
                    </>
                  )}
                </div>
                {scrapingStatus.last_scraped_at && (
                  <span className="text-xs text-muted-foreground">
                    Last: {new Date(scrapingStatus.last_scraped_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Trigger Scraping Button */}
            {formData.scraping_domains && (
              <Button
                variant="outline"
                onClick={() => handleTriggerScraping(false)}
                disabled={scraping || scrapingStatus?.status === 'in_progress'}
                className="w-full"
              >
                {scraping ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Trigger Web Scraping
                  </>
                )}
              </Button>
            )}
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
