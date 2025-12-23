import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '../hooks/useKeyboardShortcuts';

const KeyboardShortcutsHelp = ({ context = 'global', isOpen, onClose }) => {
  const [open, setOpen] = useState(isOpen);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  // Get shortcuts for current context
  const contextShortcuts = KEYBOARD_SHORTCUTS[context] || [];
  const globalShortcuts = KEYBOARD_SHORTCUTS.global || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Context-specific shortcuts */}
          {contextShortcuts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                {context.replace(/([A-Z])/g, ' $1').trim()} Shortcuts
              </h3>
              <div className="space-y-2">
                {contextShortcuts.map((shortcut, index) => (
                  <ShortcutRow key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          )}
          
          {/* Global shortcuts */}
          {globalShortcuts.length > 0 && (
            <div className="pt-2 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Navigation
              </h3>
              <div className="space-y-2">
                {globalShortcuts.map((shortcut, index) => (
                  <ShortcutRow key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">?</kbd> anywhere to show this help
        </p>
      </DialogContent>
    </Dialog>
  );
};

const ShortcutRow = ({ shortcut }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm">{shortcut.description}</span>
    <div className="flex items-center gap-1">
      {shortcut.keys.map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          {key === 'then' ? (
            <span className="text-xs text-muted-foreground mx-1">then</span>
          ) : (
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono min-w-[24px] text-center">
              {key}
            </kbd>
          )}
        </span>
      ))}
    </div>
  </div>
);

export default KeyboardShortcutsHelp;
