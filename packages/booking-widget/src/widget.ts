interface BookingWidgetConfig {
  baseUrl: string;
  calendarSlug: string;
  typeSlug?: string;
  mode?: 'inline' | 'popup';
  target?: string | HTMLElement;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  buttonText?: string;
}

const DEFAULT_CONFIG: Partial<BookingWidgetConfig> = {
  mode: 'popup',
  primaryColor: '#0891b2',
  position: 'bottom-right',
  buttonText: 'Book a meeting',
};

class BookingWidget {
  private config: BookingWidgetConfig;
  private allowedOrigin: string;
  private container: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private modalOverlay: HTMLElement | null = null;
  private isOpen = false;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private styleEl: HTMLStyleElement | null = null;

  constructor(config: BookingWidgetConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!this.config.baseUrl || !this.config.calendarSlug) {
      throw new Error('BookingWidget: baseUrl and calendarSlug are required');
    }
    this.allowedOrigin = new URL(this.config.baseUrl).origin;
    this.init();
  }

  private init(): void {
    this.attachMessageListener();
    if (this.config.mode === 'inline') {
      this.renderInline();
    } else {
      this.renderPopup();
    }
  }

  private buildIframeUrl(): string {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const path = this.config.typeSlug
      ? `/book/${this.config.calendarSlug}/${this.config.typeSlug}`
      : `/book/${this.config.calendarSlug}`;
    return `${this.config.baseUrl}${path}?embed=1&tz=${encodeURIComponent(tz)}`;
  }

  private createIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.src = this.buildIframeUrl();
    iframe.title = 'Book a meeting';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.minHeight = '600px';
    iframe.style.background = '#020617';
    return iframe;
  }

  private renderInline(): void {
    const target = this.resolveTarget();
    if (!target) {
      console.error('BookingWidget: target element not found');
      return;
    }
    this.iframe = this.createIframe();
    target.appendChild(this.iframe);
    this.container = target;
  }

  private resolveTarget(): HTMLElement | null {
    const t = this.config.target;
    if (!t) return null;
    if (typeof t === 'string') {
      return document.querySelector(t) as HTMLElement | null;
    }
    return t;
  }

  private renderPopup(): void {
    this.injectStyles();
    const wrap = document.createElement('div');
    wrap.className = 'a8l-booking-widget';
    wrap.innerHTML = `
      <button class="a8l-booking-bubble" type="button" aria-label="${this.escape(this.config.buttonText!)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>${this.escape(this.config.buttonText!)}</span>
      </button>
    `;
    document.body.appendChild(wrap);
    this.container = wrap;

    const overlay = document.createElement('div');
    overlay.className = 'a8l-booking-overlay';
    overlay.innerHTML = `
      <div class="a8l-booking-modal">
        <button class="a8l-booking-close" type="button" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="a8l-booking-frame-wrap"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalOverlay = overlay;

    const bubble = wrap.querySelector('.a8l-booking-bubble');
    const closeBtn = overlay.querySelector('.a8l-booking-close');
    bubble?.addEventListener('click', () => this.open());
    closeBtn?.addEventListener('click', () => this.close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  private injectStyles(): void {
    if (this.styleEl) return;
    const color = this.config.primaryColor!;
    const positionCss =
      this.config.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;';
    const style = document.createElement('style');
    style.textContent = `
      .a8l-booking-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .a8l-booking-bubble {
        position: fixed; bottom: 20px; ${positionCss}
        display: inline-flex; align-items: center; gap: 8px;
        background: ${color}; color: white; border: none;
        padding: 12px 18px; border-radius: 999px; cursor: pointer;
        box-shadow: 0 6px 20px rgba(0,0,0,0.18);
        font-size: 14px; font-weight: 600; z-index: 99999;
        transition: transform .15s, box-shadow .15s;
      }
      .a8l-booking-bubble:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,0.22); }
      .a8l-booking-bubble svg { width: 18px; height: 18px; }
      .a8l-booking-overlay {
        position: fixed; inset: 0; background: rgba(2,6,23,0.65);
        display: none; align-items: center; justify-content: center;
        z-index: 99998; padding: 16px;
      }
      .a8l-booking-overlay.open { display: flex; }
      .a8l-booking-modal {
        position: relative; width: 100%; max-width: 960px; height: 80vh;
        max-height: 720px; background: #020617; border-radius: 16px;
        overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.4);
      }
      .a8l-booking-close {
        position: absolute; top: 12px; right: 12px; z-index: 2;
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(15,23,42,0.85); color: white; border: none;
        cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
      }
      .a8l-booking-close:hover { background: rgba(30,41,59,0.95); }
      .a8l-booking-frame-wrap { width: 100%; height: 100%; }
      .a8l-booking-frame-wrap iframe { width: 100%; height: 100%; border: 0; display: block; }
      @media (max-width: 640px) {
        .a8l-booking-modal { height: 100vh; max-height: 100vh; border-radius: 0; }
      }
    `;
    document.head.appendChild(style);
    this.styleEl = style;
  }

  private attachMessageListener(): void {
    this.messageHandler = (event: MessageEvent) => {
      if (event.origin !== this.allowedOrigin) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'booking-widget:height' && this.iframe) {
        const h = Number(data.height);
        if (!isNaN(h) && h > 0) {
          this.iframe.style.height = `${h}px`;
        }
      } else if (data.type === 'booking-widget:booked') {
        const target = this.container || document.body;
        target.dispatchEvent(
          new CustomEvent('booking-widget:booked', {
            detail: data.appointment,
            bubbles: true,
          })
        );
      }
    };
    window.addEventListener('message', this.messageHandler);
  }

  private escape(s: string): string {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  public open(): void {
    if (this.config.mode !== 'popup' || !this.modalOverlay) return;
    if (!this.iframe) {
      this.iframe = this.createIframe();
      this.iframe.style.minHeight = '0';
      const wrap = this.modalOverlay.querySelector('.a8l-booking-frame-wrap');
      wrap?.appendChild(this.iframe);
    }
    this.modalOverlay.classList.add('open');
    this.isOpen = true;
  }

  public close(): void {
    if (!this.modalOverlay) return;
    this.modalOverlay.classList.remove('open');
    this.isOpen = false;
  }

  public destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    if (this.config.mode === 'inline') {
      this.iframe?.remove();
    } else {
      this.container?.remove();
      this.modalOverlay?.remove();
      this.styleEl?.remove();
    }
    this.iframe = null;
    this.container = null;
    this.modalOverlay = null;
    this.styleEl = null;
  }
}

function autoInitFromScriptTag(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return;
  const ds = script.dataset;
  if (!ds.calendarSlug) return;

  const start = () => {
    try {
      new BookingWidget({
        baseUrl: ds.baseUrl || new URL(script.src).origin,
        calendarSlug: ds.calendarSlug!,
        typeSlug: ds.typeSlug,
        mode: (ds.mode as 'inline' | 'popup') || 'popup',
        target: ds.target,
        primaryColor: ds.primaryColor,
        position: (ds.position as 'bottom-right' | 'bottom-left') || undefined,
        buttonText: ds.buttonText,
      });
    } catch (err) {
      console.error('BookingWidget auto-init failed:', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

declare global {
  interface Window {
    BookingWidget: typeof BookingWidget;
    initBookingWidget: (config: BookingWidgetConfig) => BookingWidget;
  }
}

window.BookingWidget = BookingWidget;
window.initBookingWidget = (config: BookingWidgetConfig) => new BookingWidget(config);

autoInitFromScriptTag();

export { BookingWidget };
export type { BookingWidgetConfig };
