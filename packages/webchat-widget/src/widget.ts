interface WidgetConfig {
  orgId: string;
  apiUrl: string;
  primaryColor?: string;
  welcomeMessage?: string;
  preChatForm?: boolean;
  requiredFields?: string[];
  position?: 'bottom-right' | 'bottom-left';
}

interface Message {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  sent_at: string;
  is_agent: boolean;
}

interface Session {
  sessionId: string;
  conversationId: string;
  isNew: boolean;
}

const DEFAULT_CONFIG: Partial<WidgetConfig> = {
  primaryColor: '#0066cc',
  welcomeMessage: 'Hi! How can we help you today?',
  preChatForm: false,
  requiredFields: [],
  position: 'bottom-right',
};

class WebchatWidget {
  private config: WidgetConfig;
  private container: HTMLElement | null = null;
  private isOpen = false;
  private session: Session | null = null;
  private messages: Message[] = [];
  private visitorId: string;
  private pollInterval: number | null = null;
  private lastMessageTime: string | null = null;

  constructor(config: WidgetConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.visitorId = this.getOrCreateVisitorId();
    this.init();
  }

  private getOrCreateVisitorId(): string {
    const storageKey = `webchat_visitor_${this.config.orgId}`;
    let visitorId = localStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem(storageKey, visitorId);
    }
    return visitorId;
  }

  private async init(): Promise<void> {
    const remoteConfig = await this.fetchConfig();
    if (remoteConfig) {
      this.config = { ...this.config, ...remoteConfig };
    }

    if (remoteConfig && !remoteConfig.enabled) {
      console.log('Webchat widget is disabled for this organization');
      return;
    }

    this.injectStyles();
    this.createWidget();
  }

  private async fetchConfig(): Promise<Partial<WidgetConfig> & { enabled?: boolean } | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/webchat-api/config?org_id=${this.config.orgId}`
      );
      if (response.ok) {
        const data = await response.json();
        return {
          enabled: data.enabled,
          primaryColor: data.primary_color,
          welcomeMessage: data.welcome_message,
          preChatForm: data.pre_chat_form,
          requiredFields: data.required_fields,
        };
      }
    } catch (error) {
      console.error('Failed to fetch webchat config:', error);
    }
    return null;
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .webchat-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }
      .webchat-bubble {
        position: fixed;
        ${this.config.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
        bottom: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${this.config.primaryColor};
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .webchat-bubble:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
      }
      .webchat-bubble svg {
        width: 28px;
        height: 28px;
      }
      .webchat-window {
        position: fixed;
        ${this.config.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;'}
        bottom: 90px;
        width: 380px;
        height: 520px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 99998;
      }
      .webchat-window.open {
        display: flex;
      }
      .webchat-header {
        background: ${this.config.primaryColor};
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .webchat-header-title {
        font-weight: 600;
        font-size: 16px;
      }
      .webchat-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
      .webchat-close:hover {
        opacity: 1;
      }
      .webchat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .webchat-message {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 16px;
        word-wrap: break-word;
      }
      .webchat-message.visitor {
        background: ${this.config.primaryColor};
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }
      .webchat-message.agent {
        background: #f0f0f0;
        color: #333;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }
      .webchat-message-time {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 4px;
      }
      .webchat-welcome {
        text-align: center;
        color: #666;
        padding: 20px;
        font-size: 14px;
      }
      .webchat-input-area {
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      .webchat-input {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 14px;
        outline: none;
        resize: none;
        max-height: 100px;
        font-family: inherit;
      }
      .webchat-input:focus {
        border-color: ${this.config.primaryColor};
      }
      .webchat-send {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${this.config.primaryColor};
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: opacity 0.2s;
      }
      .webchat-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .webchat-send svg {
        width: 18px;
        height: 18px;
      }
      .webchat-prechat {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .webchat-prechat-title {
        font-weight: 600;
        font-size: 16px;
        text-align: center;
        color: #333;
      }
      .webchat-prechat-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .webchat-prechat-label {
        font-size: 13px;
        color: #666;
        font-weight: 500;
      }
      .webchat-prechat-input {
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 14px;
        outline: none;
      }
      .webchat-prechat-input:focus {
        border-color: ${this.config.primaryColor};
      }
      .webchat-prechat-submit {
        background: ${this.config.primaryColor};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
        transition: opacity 0.2s;
      }
      .webchat-prechat-submit:hover {
        opacity: 0.9;
      }
      @media (max-width: 480px) {
        .webchat-window {
          width: calc(100vw - 20px);
          height: calc(100vh - 100px);
          ${this.config.position === 'bottom-left' ? 'left: 10px;' : 'right: 10px;'}
          bottom: 80px;
          border-radius: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private createWidget(): void {
    this.container = document.createElement('div');
    this.container.className = 'webchat-widget';
    this.container.innerHTML = `
      <button class="webchat-bubble" aria-label="Open chat">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div class="webchat-window">
        <div class="webchat-header">
          <span class="webchat-header-title">Chat with us</span>
          <button class="webchat-close" aria-label="Close chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="webchat-body">
          ${this.config.preChatForm ? this.renderPreChatForm() : this.renderChatView()}
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.attachEventListeners();
  }

  private renderPreChatForm(): string {
    return `
      <div class="webchat-prechat">
        <div class="webchat-prechat-title">Start a conversation</div>
        <div class="webchat-prechat-field">
          <label class="webchat-prechat-label">Your name${this.config.requiredFields?.includes('name') ? ' *' : ''}</label>
          <input type="text" class="webchat-prechat-input" id="webchat-name" placeholder="Enter your name">
        </div>
        <div class="webchat-prechat-field">
          <label class="webchat-prechat-label">Email${this.config.requiredFields?.includes('email') ? ' *' : ''}</label>
          <input type="email" class="webchat-prechat-input" id="webchat-email" placeholder="Enter your email">
        </div>
        <button class="webchat-prechat-submit" id="webchat-start">Start Chat</button>
      </div>
    `;
  }

  private renderChatView(): string {
    return `
      <div class="webchat-messages" id="webchat-messages">
        <div class="webchat-welcome">${this.config.welcomeMessage}</div>
      </div>
      <div class="webchat-input-area">
        <textarea class="webchat-input" id="webchat-input" placeholder="Type a message..." rows="1"></textarea>
        <button class="webchat-send" id="webchat-send" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const bubble = this.container?.querySelector('.webchat-bubble');
    const closeBtn = this.container?.querySelector('.webchat-close');

    bubble?.addEventListener('click', () => this.toggle());
    closeBtn?.addEventListener('click', () => this.close());

    if (this.config.preChatForm) {
      const startBtn = this.container?.querySelector('#webchat-start');
      startBtn?.addEventListener('click', () => this.handlePreChatSubmit());
    } else {
      this.attachChatListeners();
    }
  }

  private attachChatListeners(): void {
    const input = this.container?.querySelector('#webchat-input') as HTMLTextAreaElement;
    const sendBtn = this.container?.querySelector('#webchat-send');

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    sendBtn?.addEventListener('click', () => this.sendMessage());
  }

  private async handlePreChatSubmit(): Promise<void> {
    const nameInput = this.container?.querySelector('#webchat-name') as HTMLInputElement;
    const emailInput = this.container?.querySelector('#webchat-email') as HTMLInputElement;

    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();

    if (this.config.requiredFields?.includes('name') && !name) {
      alert('Please enter your name');
      return;
    }

    if (this.config.requiredFields?.includes('email') && !email) {
      alert('Please enter your email');
      return;
    }

    await this.createSession(name, email);

    const body = this.container?.querySelector('.webchat-body');
    if (body) {
      body.innerHTML = this.renderChatView();
      this.attachChatListeners();
      this.startPolling();
    }
  }

  private async createSession(name?: string, email?: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiUrl}/webchat-api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: this.config.orgId,
          visitor_id: this.visitorId,
          visitor_name: name,
          visitor_email: email,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.session = {
          sessionId: data.session_id,
          conversationId: data.conversation_id,
          isNew: data.is_new,
        };

        if (!data.is_new) {
          await this.loadMessages();
        }
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  }

  private async loadMessages(): Promise<void> {
    if (!this.session) return;

    try {
      const url = new URL(`${this.config.apiUrl}/webchat-api/messages`);
      url.searchParams.set('session_id', this.session.sessionId);

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        this.messages = data.messages || [];
        this.renderMessages();

        if (this.messages.length > 0) {
          this.lastMessageTime = this.messages[this.messages.length - 1].sent_at;
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  private renderMessages(): void {
    const container = this.container?.querySelector('#webchat-messages');
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = `<div class="webchat-welcome">${this.config.welcomeMessage}</div>`;
      return;
    }

    container.innerHTML = this.messages
      .map((msg) => `
        <div class="webchat-message ${msg.is_agent ? 'agent' : 'visitor'}">
          <div>${this.escapeHtml(msg.body)}</div>
          <div class="webchat-message-time">${this.formatTime(msg.sent_at)}</div>
        </div>
      `)
      .join('');

    container.scrollTop = container.scrollHeight;
  }

  private async sendMessage(): Promise<void> {
    const input = this.container?.querySelector('#webchat-input') as HTMLTextAreaElement;
    const message = input?.value.trim();

    if (!message) return;

    if (!this.session) {
      await this.createSession();
    }

    if (!this.session) {
      console.error('No session available');
      return;
    }

    input.value = '';
    input.style.height = 'auto';

    const tempMessage: Message = {
      id: 'temp_' + Date.now(),
      body: message,
      direction: 'inbound',
      sent_at: new Date().toISOString(),
      is_agent: false,
    };
    this.messages.push(tempMessage);
    this.renderMessages();

    try {
      const response = await fetch(`${this.config.apiUrl}/webchat-api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.session.sessionId,
          message,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const idx = this.messages.findIndex((m) => m.id === tempMessage.id);
        if (idx !== -1) {
          this.messages[idx].id = data.message_id;
          this.messages[idx].sent_at = data.sent_at;
        }
        this.lastMessageTime = data.sent_at;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  private startPolling(): void {
    if (this.pollInterval) return;

    this.pollInterval = window.setInterval(async () => {
      if (!this.session || !this.isOpen) return;

      try {
        const url = new URL(`${this.config.apiUrl}/webchat-api/messages`);
        url.searchParams.set('session_id', this.session.sessionId);
        if (this.lastMessageTime) {
          url.searchParams.set('since', this.lastMessageTime);
        }

        const response = await fetch(url.toString());
        if (response.ok) {
          const data = await response.json();
          const newMessages = data.messages || [];

          if (newMessages.length > 0) {
            for (const msg of newMessages) {
              if (!this.messages.find((m) => m.id === msg.id)) {
                this.messages.push(msg);
              }
            }
            this.renderMessages();
            this.lastMessageTime = newMessages[newMessages.length - 1].sent_at;
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    this.isOpen = true;
    const window = this.container?.querySelector('.webchat-window');
    window?.classList.add('open');

    if (!this.config.preChatForm && !this.session) {
      this.createSession().then(() => {
        this.loadMessages();
        this.startPolling();
      });
    } else if (this.session) {
      this.startPolling();
    }
  }

  private close(): void {
    this.isOpen = false;
    const window = this.container?.querySelector('.webchat-window');
    window?.classList.remove('open');
    this.stopPolling();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  public destroy(): void {
    this.stopPolling();
    this.container?.remove();
  }
}

declare global {
  interface Window {
    WebchatWidget: typeof WebchatWidget;
    initWebchat: (config: WidgetConfig) => WebchatWidget;
  }
}

window.WebchatWidget = WebchatWidget;
window.initWebchat = (config: WidgetConfig) => new WebchatWidget(config);

export { WebchatWidget };
export type { WidgetConfig, Message, Session };
