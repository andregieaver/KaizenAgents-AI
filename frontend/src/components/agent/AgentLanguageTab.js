import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Languages, CheckCircle } from 'lucide-react';
import { LanguageSelector } from '../LanguageSelector';
import { getLanguageName } from '../../data/languages';
import { cn } from '../../lib/utils';

const AgentLanguageTab = ({ agent, setAgent }) => {
  return (
    <Card className="border border-border">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Response Language
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Configure how this agent responds in different languages
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-6">
        {/* Language Selector */}
        <div className="space-y-2">
          <Label htmlFor="response-language">Preferred Language</Label>
          <LanguageSelector
            value={agent.config?.response_language || ''}
            onValueChange={(lang) => setAgent(prev => ({
              ...prev,
              config: { ...prev.config, response_language: lang || null }
            }))}
            placeholder="Select language..."
          />
          {agent.config?.response_language && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-600" />
              Selected: {getLanguageName(agent.config.response_language)}
            </div>
          )}
        </div>

        {/* Language Mode */}
        <div className="space-y-3">
          <Label>Language Detection Mode</Label>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setAgent(prev => ({
                ...prev,
                config: { ...prev.config, language_mode: 'force' }
              }))}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                agent.config?.language_mode === 'force'
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="font-medium text-sm">Force Language</div>
              <div className="text-xs text-muted-foreground mt-1">
                Always respond in the selected language, regardless of customer&apos;s language
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setAgent(prev => ({
                ...prev,
                config: { ...prev.config, language_mode: 'browser' }
              }))}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                (agent.config?.language_mode === 'browser' || !agent.config?.language_mode)
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="font-medium text-sm">Browser Language</div>
              <div className="text-xs text-muted-foreground mt-1">
                Auto-detect from user&apos;s browser settings (Accept-Language header)
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setAgent(prev => ({
                ...prev,
                config: { ...prev.config, language_mode: 'geo' }
              }))}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                agent.config?.language_mode === 'geo'
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="font-medium text-sm">Geo Location</div>
              <div className="text-xs text-muted-foreground mt-1">
                Auto-detect language based on user&apos;s IP address / geographic location
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAgent(prev => ({
                ...prev,
                config: { ...prev.config, language_mode: 'auto' }
              }))}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                agent.config?.language_mode === 'auto'
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="font-medium text-sm">Auto-detect from Message</div>
              <div className="text-xs text-muted-foreground mt-1">
                Respond in the same language the customer uses in their message
              </div>
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <p className="font-medium mb-2">How it works:</p>
          <ul className="text-muted-foreground space-y-1 text-xs">
            <li>• <strong>Force:</strong> Always uses the selected language (best for single-language support)</li>
            <li>• <strong>Browser:</strong> Uses the visitor&apos;s browser language preference</li>
            <li>• <strong>Geo:</strong> Detects language based on visitor&apos;s location</li>
            <li>• <strong>Auto-detect:</strong> Matches the language used in the customer&apos;s message</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentLanguageTab;
