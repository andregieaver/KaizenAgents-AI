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

  // Widget state
  let isOpen = false;
  let sessionToken = null;
  let conversationId = null;
  let settings = null;
  let agentInfo = null;
  let lastMessageId = null;

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
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          word-wrap: break-word;
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
        addMessage(data.ai_message.content, 'ai', data.ai_message.created_at);
      } else {
        console.error('No AI message in response:', data);
        addMessage('Sorry, no response was generated. Please try again.', 'ai');
      }
    } catch (error) {
      console.error('Chat Widget Error:', error);
      addMessage(`Error: ${error.message}. Please check console for details.`, 'ai');
    } finally {
      input.disabled = false;
      document.getElementById('emergent-chat-send').disabled = false;
      input.focus();
    }
  }

  function addMessage(content, type, timestamp) {
    const messagesContainer = document.getElementById('emergent-chat-messages');
    const welcome = document.getElementById('emergent-chat-welcome');
    if (welcome) {
      welcome.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-message-content';
    bubble.textContent = content;

    const time = document.createElement('div');
    time.className = 'chat-message-time';
    time.textContent = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Initialize widget
  fetchSettings().then(settings => {
    if (settings) {
      createWidget();
    }
  });
})();
