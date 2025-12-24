import { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Globe,
  Loader2,
  Upload,
  Trash2,
  FileText,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const AgentKnowledgeTab = ({
  agent,
  setAgent,
  isNew,
  uploadedDocs,
  uploading,
  scraping,
  scrapingStatus,
  handleFileUpload,
  handleDeleteDocument,
  handleTriggerScraping,
  fileInputRef,
  formatFileSize
}) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Web Scraping Section */}
      <Card className="border border-border">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Web Scraping Domains
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Scrape websites to build knowledge context for this agent
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scraping-domains">Domain URLs</Label>
            <Input
              id="scraping-domains"
              placeholder="https://example.com, https://docs.example.com"
              value={agent.config?.scraping_domains || ''}
              onChange={(e) => setAgent(prev => ({
                ...prev,
                config: { ...prev.config, scraping_domains: e.target.value }
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of domain URLs to scrape for agent context
            </p>
          </div>

          {/* Scraping Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-depth" className="text-xs">Max Depth</Label>
              <Input
                id="max-depth"
                type="number"
                min="1"
                max="5"
                value={agent.config?.scraping_max_depth || 2}
                onChange={(e) => setAgent(prev => ({
                  ...prev,
                  config: { ...prev.config, scraping_max_depth: parseInt(e.target.value) || 2 }
                }))}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Levels to crawl (1-5)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-pages" className="text-xs">Max Pages/Domain</Label>
              <Input
                id="max-pages"
                type="number"
                min="1"
                max="200"
                value={agent.config?.scraping_max_pages || 50}
                onChange={(e) => setAgent(prev => ({
                  ...prev,
                  config: { ...prev.config, scraping_max_pages: parseInt(e.target.value) || 50 }
                }))}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Pages limit (1-200)</p>
            </div>
          </div>

          {/* Scraping Status */}
          {scrapingStatus && (
            <div className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-md">
              <div className="flex items-center gap-2">
                {scrapingStatus.status === 'in_progress' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm">Scraping in progress...</span>
                  </>
                )}
                {scrapingStatus.status === 'completed' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{scrapingStatus.pages_scraped || 0} pages scraped</span>
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
          {!isNew && agent.config?.scraping_domains && (
            <Button
              variant="outline"
              onClick={handleTriggerScraping}
              disabled={scraping || scrapingStatus?.status === 'in_progress'}
              className="w-full"
            >
              {scraping ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Trigger Web Scraping
                </>
              )}
            </Button>
          )}
          
          {isNew && agent.config?.scraping_domains && (
            <p className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded">
              Save the agent first, then you can trigger web scraping
            </p>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Base Documents */}
      <Card className="border border-border">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Knowledge Base Documents
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Upload documents for this agent to reference (PDF, TXT, MD, DOCX, CSV • Max 5MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          {isNew ? (
            <div className="text-center py-8 border border-dashed rounded-md">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Save the agent first, then you can upload documents
              </p>
            </div>
          ) : (
            <>
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
              {uploadedDocs.length > 0 ? (
                <div className="space-y-2">
                  <Label>Uploaded Documents ({uploadedDocs.length})</Label>
                  <ScrollArea className="h-[200px] border rounded-md">
                    <div className="p-4 space-y-2">
                      {uploadedDocs.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-sm"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.file_size || 0)} • {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : 'Unknown date'}
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
                  <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload PDF, TXT, MD, DOCX, or CSV files
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentKnowledgeTab;
