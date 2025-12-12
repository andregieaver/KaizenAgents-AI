(function() {
  'use strict';

  // Get configuration from script tag
  const scriptTag = document.currentScript || document.querySelector('script[data-tenant-id]');
  const tenantId = scriptTag?.getAttribute('data-tenant-id');
  const apiUrl = scriptTag?.getAttribute('data-api-url') || scriptTag?.src.replace('/widget.js', '/api');

  if (!tenantId) {
    console.error('Chat Widget: Missing data-tenant-id attribute');
    return;
  }

  console.log('Widget Config:', { tenantId, apiUrl });

  // Storage key prefix for this tenant
  const STORAGE_KEY = `emergent_chat_${tenantId}`;

  // Widget state
  let isOpen = false;
  let sessionToken = null;
  let conversationId = null;
  let settings = null;
  let agentInfo = null;
  let lastMessageId = null;
  let messageHistory = [];
  let pollInterval = null;

  // Session storage helpers
  function saveState() {
    try {
      const state = {
        isOpen,
        sessionToken,
        conversationId,
        messageHistory,
        lastMessageId
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save widget state:', e);
    }
  }

  function loadState() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        isOpen = state.isOpen || false;
        sessionToken = state.sessionToken || null;
        conversationId = state.conversationId || null;
        messageHistory = state.messageHistory || [];
        lastMessageId = state.lastMessageId || null;
        return true;
      }
    } catch (e) {
      console.warn('Could not load widget state:', e);
    }
    return false;
  }

  function clearState() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear widget state:', e);
    }
  }

  // Fetch widget settings and agent info
  async function fetchSettings() {
    try {
      const response = await fetch(`${apiUrl}/widget/${tenantId}/settings`);
      if (response.ok) {
        settings = await response.json();
        
        // Fetch agent configuration
        try {
          const agentResponse = await fetch(`${apiUrl}/widget/${tenantId}/agent-info`);
          if (agentResponse.ok) {
            agentInfo = await agentResponse.json();
          }
        } catch (err) {
          console.log('No agent configured');
        }
        
        return settings;
      }
    } catch (error) {
      console.error('Chat Widget: Failed to fetch settings', error);
    }
    return null;
  }

  // Create widget HTML
  function createWidget() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'emergent-chat-widget';
    widgetContainer.innerHTML = `
      <style>
        #emergent-chat-widget * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        #emergent-chat-bubble {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 60px;
          height: 60px;
          border-radius: 30px;
          background: ${settings?.primary_color || '#0047AB'};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 999999;
        }
        
        #emergent-chat-bubble:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
        
        #emergent-chat-bubble svg {
          width: 28px;
          height: 28px;
          fill: white;
        }
        
        #emergent-chat-window {
          position: fixed;
          bottom: 100px;
          right: 24px;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 140px);
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          display: none;
          flex-direction: column;
          z-index: 999998;
          overflow: hidden;
        }
        
        #emergent-chat-window.open {
          display: flex;
        }
        
        #emergent-chat-header {
          background: ${settings?.primary_color || '#0047AB'};
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        #emergent-chat-header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        
        #emergent-chat-logo {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        
        #emergent-chat-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        #emergent-chat-logo svg {
          width: 24px;
          height: 24px;
        }
        
        #emergent-chat-brand {
          font-weight: 600;
          font-size: 16px;
        }
        
        #emergent-chat-close {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        #emergent-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f8f9fa;
        }
        
        .chat-message {
          display: flex;
          flex-direction: column;
          max-width: 75%;
        }
        
        .chat-message.customer {
          align-self: flex-end;
        }
        
        .chat-message.ai {
          align-self: flex-start;
        }
        
        .chat-message-content {
          background: white;
          padding: 18px 24px !important;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          word-wrap: break-word;
        }
        
        .chat-message-content a {
          color: inherit;
          text-decoration: underline;
        }
        
        .chat-message.customer .chat-message-content {
          background: ${settings?.primary_color || '#0047AB'};
          color: white;
          border-bottom-right-radius: 4px;
        }
        
        .chat-message.ai .chat-message-content {
          border-bottom-left-radius: 4px;
        }
        
        .chat-message-time {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
          padding: 0 4px;
        }
        
        .chat-message.customer .chat-message-time {
          text-align: right;
        }
        
        #emergent-chat-form {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 8px;
        }
        
        #emergent-chat-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
        }
        
        #emergent-chat-input:focus {
          border-color: ${settings?.primary_color || '#0047AB'};
        }
        
        #emergent-chat-send {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${settings?.primary_color || '#0047AB'};
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
        }
        
        #emergent-chat-send:hover:not(:disabled) {
          opacity: 0.9;
        }
        
        #emergent-chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        #emergent-chat-welcome {
          background: white;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        #emergent-chat-welcome h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #1f2937;
        }
        
        #emergent-chat-welcome p {
          font-size: 14px;
          color: #6b7280;
        }
        
        @media (max-width: 480px) {
          #emergent-chat-window {
            right: 0;
            left: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            max-height: 100vh;
            border-radius: 0;
          }
          
          #emergent-chat-bubble {
            bottom: 20px;
            right: 20px;
          }
          
          /* Hide bubble when chat is open on mobile */
          #emergent-chat-window.open ~ #emergent-chat-bubble,
          #emergent-chat-bubble.hidden {
            display: none !important;
          }
        }
      </style>
      
      <!-- Chat Bubble -->
      <div id="emergent-chat-bubble">
        <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </div>
      
      <!-- Chat Window -->
      <div id="emergent-chat-window">
        <div id="emergent-chat-header">
          <div id="emergent-chat-header-title">
            <div id="emergent-chat-logo">
              ${agentInfo?.avatar_url 
                ? `<img src="${apiUrl.replace('/api', '')}${agentInfo.avatar_url}" alt="Agent" />`
                : `<svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                     <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                   </svg>`
              }
            </div>
            <span id="emergent-chat-brand">${agentInfo?.name ? `${agentInfo.name} - ${settings?.brand_name || 'Support'}` : (settings?.brand_name || 'Support Chat')}</span>
          </div>
          <button id="emergent-chat-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        
        <div id="emergent-chat-messages">
          <div id="emergent-chat-welcome">
            <h3>${settings?.welcome_message || 'Hi! How can we help you today?'}</h3>
            <p>Send us a message and we'll get back to you shortly.</p>
          </div>
        </div>
        
        <form id="emergent-chat-form">
          <input 
            type="text" 
            id="emergent-chat-input" 
            placeholder="Type your message..." 
            autocomplete="off"
          />
          <button type="submit" id="emergent-chat-send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(widgetContainer);

    // Attach event listeners
    const bubble = document.getElementById('emergent-chat-bubble');
    const chatWindow = document.getElementById('emergent-chat-window');
    const closeBtn = document.getElementById('emergent-chat-close');
    const form = document.getElementById('emergent-chat-form');

    bubble.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
    form.addEventListener('submit', sendMessage);

    // Restore previous state if exists
    if (messageHistory.length > 0) {
      // Remove welcome message
      const welcome = document.getElementById('emergent-chat-welcome');
      if (welcome) welcome.remove();
      
      // Restore all previous messages
      messageHistory.forEach(msg => {
        addMessageToUI(msg.content, msg.type, msg.timestamp, false);
      });
    }

    // Start polling for new messages if we have a conversation
    if (conversationId && sessionToken) {
      startPolling();
    }
  }

  function toggleChat() {
    const chatWindow = document.getElementById('emergent-chat-window');
    const bubble = document.getElementById('emergent-chat-bubble');
    if (!chatWindow) return; // Guard against missing element
    
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add('open');
      if (bubble) bubble.classList.add('hidden'); // Hide bubble on mobile when open
      const input = document.getElementById('emergent-chat-input');
      if (input) input.focus();
      // Start polling when chat opens and we have a conversation
      if (conversationId && sessionToken) {
        startPolling();
      }
    } else {
      chatWindow.classList.remove('open');
      if (bubble) bubble.classList.remove('hidden'); // Show bubble when closed
      // Stop polling when chat closes
      stopPolling();
    }
    saveState();
  }

  // Polling for new messages (to receive human agent messages)
  function startPolling() {
    if (pollInterval) return; // Already polling
    
    pollInterval = setInterval(async () => {
      if (!conversationId || !sessionToken) return;
      
      try {
        const response = await fetch(`${apiUrl}/widget/messages/${conversationId}?token=${sessionToken}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages)) {
            // Find messages we don't have yet
            data.messages.forEach(msg => {
              const exists = messageHistory.some(m => m.id === msg.id);
              if (!exists) {
                // New message! Add it
                const type = msg.author_type === 'customer' ? 'customer' : 'ai';
                addMessageToUI(msg.content, type, msg.created_at, true);
                messageHistory.push({
                  id: msg.id,
                  content: msg.content,
                  type: type,
                  timestamp: msg.created_at
                });
                saveState();
              }
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('emergent-chat-input');
    const message = input.value.trim();
    
    if (!message) return;

    // Disable input while sending
    input.disabled = true;
    document.getElementById('emergent-chat-send').disabled = true;

    // Generate a temporary ID for the customer message
    const tempMsgId = `temp_${Date.now()}`;
    
    // Display user message immediately and save to history
    const customerMsg = {
      id: tempMsgId,
      content: message,
      type: 'customer',
      timestamp: new Date().toISOString()
    };
    addMessageToUI(message, 'customer', customerMsg.timestamp, false);
    messageHistory.push(customerMsg);
    saveState();
    
    input.value = '';

    try {
      // Create session if needed
      if (!sessionToken) {
        console.log('Creating session...', `${apiUrl}/widget/session`);
        const sessionResponse = await fetch(`${apiUrl}/widget/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            customer_name: 'Website Visitor',
            customer_email: ''
          })
        });
        
        if (!sessionResponse.ok) {
          throw new Error(`Session creation failed: ${sessionResponse.status}`);
        }
        
        const sessionData = await sessionResponse.json();
        console.log('Session created:', sessionData.conversation_id);
        sessionToken = sessionData.session_token;
        conversationId = sessionData.conversation_id;
        saveState();
        
        // Start polling for agent messages
        startPolling();
      }

      // Send message and get AI response
      const messageUrl = `${apiUrl}/widget/messages/${conversationId}?token=${sessionToken}`;
      console.log('Sending message to:', messageUrl);
      
      const response = await fetch(messageUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      });

      if (!response.ok) {
        throw new Error(`Message failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response received:', data);
      
      // Display AI response if available
      if (data.ai_message) {
        const aiMsg = {
          id: data.ai_message.id || `ai_${Date.now()}`,
          content: data.ai_message.content,
          type: 'ai',
          timestamp: data.ai_message.created_at
        };
        addMessageToUI(aiMsg.content, 'ai', aiMsg.timestamp, false);
        messageHistory.push(aiMsg);
        saveState();
      } else {
        console.error('No AI message in response:', data);
        addMessageToUI('Sorry, no response was generated. Please try again.', 'ai', null, false);
      }
    } catch (error) {
      console.error('Chat Widget Error:', error);
      addMessageToUI(`Error: ${error.message}. Please check console for details.`, 'ai', null, false);
    } finally {
      input.disabled = false;
      document.getElementById('emergent-chat-send').disabled = false;
      input.focus();
    }
  }

  // Simple HTML sanitizer to allow only safe tags (links)
  function sanitizeHTML(html) {
    // Create a temporary element to parse the HTML
    const temp = document.createElement('div');
    temp.textContent = html; // First escape everything
    let escaped = temp.innerHTML;
    
    // Now selectively allow safe anchor tags
    // Match <a href="...">...</a> patterns and restore them
    escaped = escaped.replace(
      /&lt;a\s+href=["']([^"']+)["'](?:\s+target=["']([^"']+)["'])?&gt;([^&]+)&lt;\/a&gt;/gi,
      (match, href, target, text) => {
        // Validate URL - only allow http, https, mailto
        if (href.match(/^(https?:|mailto:)/i)) {
          const targetAttr = target ? ` target="${target}"` : ' target="_blank"';
          return `<a href="${href}"${targetAttr} rel="noopener noreferrer">${text}</a>`;
        }
        return text; // If URL is not safe, just return the text
      }
    );
    
    return escaped;
  }

  function addMessageToUI(content, type, timestamp, shouldScroll = true) {
    const messagesContainer = document.getElementById('emergent-chat-messages');
    const welcome = document.getElementById('emergent-chat-welcome');
    if (welcome) {
      welcome.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-message-content';
    // Use innerHTML with sanitization to allow clickable links
    bubble.innerHTML = sanitizeHTML(content);

    const time = document.createElement('div');
    time.className = 'chat-message-time';
    time.textContent = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom only if requested
    if (shouldScroll) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // Initialize widget
  const hadSavedState = loadState(); // Load any saved state first
  
  // Reset isOpen to false initially - we'll restore it after widget creation
  const savedIsOpen = isOpen;
  isOpen = false;
  
  fetchSettings().then(settingsResult => {
    if (settingsResult) {
      createWidget();
      
      // After widget is created, restore the open state if it was previously open
      if (savedIsOpen) {
        isOpen = true;
        const chatWindow = document.getElementById('emergent-chat-window');
        if (chatWindow) chatWindow.classList.add('open');
      }
    }
  });
})();
