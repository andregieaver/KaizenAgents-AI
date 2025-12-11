(function() {
  'use strict';

  // Get configuration from script tag
  const scriptTag = document.currentScript || document.querySelector('script[data-tenant-id]');
  const tenantId = scriptTag?.getAttribute('data-tenant-id');
  const apiUrl = scriptTag?.src.replace('/widget.js', '/api');

  if (!tenantId) {
    console.error('Chat Widget: Missing data-tenant-id attribute');
    return;
  }

  // Widget state
  let isOpen = false;
  let conversationId = null;
  let settings = null;
  let agentInfo = null;

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
        }
        
        #emergent-chat-logo {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        #emergent-chat-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        #emergent-chat-brand {
          font-weight: 600;
          font-size: 16px;
        }
        
        #emergent-chat-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        
        #emergent-chat-close:hover {
          opacity: 1;
        }
        
        #emergent-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #f5f5f5;
        }
        
        .chat-message {
          display: flex;
          gap: 8px;
          max-width: 80%;
        }
        
        .chat-message.customer {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        
        .chat-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: ${settings?.primary_color || '#0047AB'};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }
        
        .chat-message-content {
          background: white;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .chat-message.customer .chat-message-content {
          background: ${settings?.primary_color || '#0047AB'};
          color: white;
        }
        
        .chat-message-time {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        }
        
        #emergent-chat-form {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid #e5e5e5;
          display: flex;
          gap: 12px;
        }
        
        #emergent-chat-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #ddd;
          border-radius: 20px;
          font-size: 14px;
          outline: none;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        #emergent-chat-input:focus {
          border-color: ${settings?.primary_color || '#0047AB'};
        }
        
        #emergent-chat-send {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 20px;
          background: ${settings?.primary_color || '#0047AB'};
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
        }
        
        #emergent-chat-send:hover {
          opacity: 0.9;
        }
        
        #emergent-chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        #emergent-chat-welcome {
          text-align: center;
          padding: 40px 20px;
        }
        
        #emergent-chat-welcome h3 {
          font-size: 18px;
          margin-bottom: 8px;
          color: #333;
        }
        
        #emergent-chat-welcome p {
          font-size: 14px;
          color: #666;
        }
        
        @media (max-width: 480px) {
          #emergent-chat-window {
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            max-height: 100vh;
            border-radius: 0;
          }
          
          #emergent-chat-bubble {
            bottom: 16px;
            right: 16px;
          }
        }
      </style>
      
      <!-- Chat Bubble -->
      <div id="emergent-chat-bubble">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </div>
      
      <!-- Chat Window -->
      <div id="emergent-chat-window">
        <div id="emergent-chat-header">
          <div id="emergent-chat-header-title">
            <div id="emergent-chat-logo">
              ${agentInfo?.avatar_url 
                ? `<img src="${apiUrl.replace('/api', '')}${agentInfo.avatar_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
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
    const input = document.getElementById('emergent-chat-input');

    bubble.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
    form.addEventListener('submit', sendMessage);

    // Update logo if available
    if (settings?.brand_logo) {
      const logoContainer = document.getElementById('emergent-chat-logo');
      logoContainer.innerHTML = `<img src="${settings.brand_logo.startsWith('/api/') ? apiUrl.replace('/api', '') + settings.brand_logo : settings.brand_logo}" alt="Logo" />`;
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.getElementById('emergent-chat-window');
    if (isOpen) {
      chatWindow.classList.add('open');
      document.getElementById('emergent-chat-input').focus();
    } else {
      chatWindow.classList.remove('open');
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

    // Display user message immediately
    addMessage(message, 'customer');
    input.value = '';

    try {
      // Create conversation if needed
      if (!conversationId) {
        const convResponse = await fetch(`${apiUrl}/widget/${tenantId}/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Website Visitor',
            customer_email: ''
          })
        });
        const convData = await convResponse.json();
        conversationId = convData.id;
      }

      // Send message
      await fetch(`${apiUrl}/widget/${tenantId}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      });

      // Poll for AI response
      setTimeout(() => fetchNewMessages(), 1000);
    } catch (error) {
      console.error('Chat Widget: Failed to send message', error);
      addMessage('Sorry, we couldn\'t send your message. Please try again.', 'system');
    } finally {
      input.disabled = false;
      document.getElementById('emergent-chat-send').disabled = false;
      input.focus();
    }
  }

  async function fetchNewMessages() {
    if (!conversationId) return;

    try {
      const response = await fetch(`${apiUrl}/widget/${tenantId}/conversations/${conversationId}/messages`);
      const messages = await response.json();
      
      // Display messages (simplified - in production, track which messages are already displayed)
      const messagesContainer = document.getElementById('emergent-chat-messages');
      const welcome = document.getElementById('emergent-chat-welcome');
      if (welcome && messages.length > 0) {
        welcome.remove();
      }
    } catch (error) {
      console.error('Chat Widget: Failed to fetch messages', error);
    }
  }

  function addMessage(content, type) {
    const messagesContainer = document.getElementById('emergent-chat-messages');
    const welcome = document.getElementById('emergent-chat-welcome');
    if (welcome) {
      welcome.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'chat-message-avatar';
    avatar.textContent = type === 'customer' ? 'Y' : 'A';
    
    const content_div = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.className = 'chat-message-content';
    bubble.textContent = content;
    
    const time = document.createElement('div');
    time.className = 'chat-message-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    content_div.appendChild(bubble);
    content_div.appendChild(time);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content_div);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Initialize widget
  async function init() {
    await fetchSettings();
    createWidget();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
