import { useEffect, useCallback } from 'react';

/**
 * Custom hook for handling keyboard shortcuts
 * @param {Object} shortcuts - Object mapping key combinations to callbacks
 * @param {boolean} enabled - Whether shortcuts are enabled
 * 
 * Example usage:
 * useKeyboardShortcuts({
 *   'k': () => navigateNext(),
 *   'j': () => navigatePrev(),
 *   'r': () => focusReply(),
 *   'Escape': () => goBack(),
 *   'ctrl+Enter': () => submit(),
 * }, true);
 */
const useKeyboardShortcuts = (shortcuts, enabled = true) => {
  const handleKeyDown = useCallback((event) => {
    // Don't trigger shortcuts when typing in inputs
    const tagName = event.target.tagName.toLowerCase();
    const isEditable = event.target.isContentEditable;
    const isInput = tagName === 'input' || tagName === 'textarea' || isEditable;
    
    // Allow Escape to work even in inputs
    if (isInput && event.key !== 'Escape') {
      return;
    }
    
    // Build the key combination string
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    
    const combo = parts.join('+');
    const simpleKey = event.key.toLowerCase();
    
    // Check for matching shortcut
    const callback = shortcuts[combo] || shortcuts[simpleKey] || shortcuts[event.key];
    
    if (callback) {
      event.preventDefault();
      callback(event);
    }
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
};

export default useKeyboardShortcuts;

// Keyboard shortcuts help data
export const KEYBOARD_SHORTCUTS = {
  conversations: [
    { keys: ['J'], description: 'Next conversation' },
    { keys: ['K'], description: 'Previous conversation' },
    { keys: ['Enter'], description: 'Open selected conversation' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
  ],
  conversationDetail: [
    { keys: ['R'], description: 'Focus reply input' },
    { keys: ['Ctrl', 'Enter'], description: 'Send message' },
    { keys: ['Esc'], description: 'Go back to list' },
    { keys: ['1'], description: 'Switch to AI mode' },
    { keys: ['2'], description: 'Switch to Assisted mode' },
    { keys: ['3'], description: 'Switch to Agent mode' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
  ],
  crm: [
    { keys: ['J'], description: 'Next customer' },
    { keys: ['K'], description: 'Previous customer' },
    { keys: ['Enter'], description: 'Open selected customer' },
    { keys: ['N'], description: 'Add new customer' },
    { keys: ['V'], description: 'Toggle view (List/Kanban)' },
    { keys: ['?'], description: 'Show keyboard shortcuts' },
  ],
  global: [
    { keys: ['G', 'then', 'D'], description: 'Go to Dashboard' },
    { keys: ['G', 'then', 'C'], description: 'Go to Conversations' },
    { keys: ['G', 'then', 'R'], description: 'Go to CRM' },
  ],
};
