import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  Code,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AgentEmbedTab = ({ agent, user }) => {
  const [copied, setCopied] = useState(false);

  const getEmbedCode = () => {
    const baseUrl = BACKEND_URL?.replace('/api', '') || window.location.origin;
    return `<script src="${baseUrl}/widget.js" data-tenant-id="${user?.tenant_id}" data-agent-id="${agent.id}" async></script>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    toast.success('Embed code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-border">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Code className="h-5 w-5" />
          Embed Code
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Add this code to your website to embed the chat widget
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
        <div className="relative">
          <pre className="bg-muted p-4 rounded-lg text-xs sm:text-sm overflow-x-auto">
            <code className="break-all whitespace-pre-wrap">
              {getEmbedCode()}
            </code>
          </pre>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2"
            onClick={copyEmbedCode}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium text-sm">Instructions:</h4>
          <ol className="text-xs sm:text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Copy the embed code above</li>
            <li>Paste it before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag</li>
            <li>The chat widget will appear automatically on your site</li>
          </ol>
        </div>

        {!agent.is_active && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ This agent is not active. Activate it to enable the chat widget.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={copyEmbedCode}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`${BACKEND_URL}/widget-preview?tenant_id=${user?.tenant_id}&agent_id=${agent.id}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Preview Widget
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentEmbedTab;
