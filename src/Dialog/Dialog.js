import styles from './Dialog.css';

const clamp = ({ min, value, max }) => Math.min(Math.max(value, min), max);
const getPageY = (evt) => (evt.type.startsWith('touch') ? evt.touches[0].pageY : evt.pageY);
const isElement = ({ nodeType }) => nodeType === 1;
const toBool = (value) => (value != null ? true : false);

const template = () => `
<style>${styles}</style>
<div class="Dialog">
  <div class="Dialog__overlay" role="button"></div>
  <div class="Dialog__content">
    <div class="Dialog__drag-handle"><span class="Dialog__drag-icon"></span></div>
    <slot name="header"></slot>
    <slot></slot>
  </div>
</div>
`;

class Dialog extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'no-resize', 'minimize', 'snap-to-top'];
  }

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = template();

    /**
     * elements
     */
    this.dialogEl = this.shadowRoot.querySelector('.Dialog');
    this.overlayEl = this.shadowRoot.querySelector('.Dialog__overlay');
    this.contentWrapperEl = this.shadowRoot.querySelector('.Dialog__content');
    this.contentEl = this.shadowRoot
      .querySelector('slot:not([name])')
      .assignedNodes()
      .find(isElement);
    this.headerEl = this.shadowRoot
      .querySelector('slot[name="header"]')
      .assignedNodes()
      .find(isElement);
    this.dragEl = this.shadowRoot.querySelector('.Dialog__drag-handle');

    /**
     * props
     */
    this.isOpen = false;
    this.connected = false;
    this.noResize = false;
    this.canMinimize = false;
    this.minimized = false;
    this.snapToTop = false;
    this.snapToBottomThreshold = 0;
    this.contentHeight = this.contentWrapperEl.offsetHeight;
    this.headerHeight = this.headerEl ? this.headerEl.offsetHeight : 0;
    this.isTouchDevice = navigator.maxTouchPoints > 0;

    /**
     * Bound methods
     */
    this.close = this.close.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
  }

  attributeChangedCallback(name, oldVal, newValue) {
    switch (name) {
      case 'open': {
        this.isOpen = toBool(newValue);
        if (this.isOpen) {
          this.open();
        } else if (this.canMinimize) {
          this.setAttribute('open', '');
          this.minimize();
        } else {
          this.close();
        }
        break;
      }
      case 'snap-to-top': {
        this.snapToTop = toBool(newValue);
        if (this.snapToTop) {
          const height = window.innerHeight - this.headerHeight - this.dragEl.offsetHeight;
          this.contentEl.style.setProperty('height', height + 'px');
          this.contentHeight = this.contentWrapperEl.offsetHeight;
        } else {
          this.contentEl.style.removeProperty('height');
        }
        break;
      }
      case 'no-resize': {
        this.noResize = toBool(newValue);
        this.dialogEl.classList[this.noResize ? 'add' : 'remove']('Dialog--no-resize');
        break;
      }
      case 'minimize': {
        this.canMinimize = toBool(newValue);
        this.snapToBottomThreshold = window.innerHeight * 0.3;
        break;
      }
      default: {
        console.log('unhandled attr change:', name);
      }
    }
  }

  connectedCallback() {
    this.connected = true;
    this.registerEventListeners();
    this.setStyles({ offsetY: this.contentHeight });
    if (this.canMinimize && !this.isOpen) {
      this.setAttribute('open', '');
      this.minimize();
    }
  }

  disconnectedCallback() {
    this.removeEventListeners();
    document.body.style.removeProperty('overflow');
  }

  handleOverlayClick(evt) {
    if (evt.target !== this.overlayEl) return;
    this.close();
  }

  open(retries = 5) {
    // because attribute change fire before connected-hook
    if (!this.connected && retries) return requestAnimationFrame(() => this.open(--retries));
    this.minimized = false;
    document.body.style.setProperty('overflow', 'hidden');
    this.dialogEl.classList.add('Dialog--open');
    this.dialogEl.classList.remove('Dialog--inactive');
    this.setStyles({ offsetY: 0 });
  }

  minimize() {
    this.minimized = true;
    document.body.style.setProperty('overflow', 'auto');
    this.dialogEl.classList.add('Dialog--inactive');
    this.setStyles({ offsetY: this.contentHeight - this.headerHeight });
  }

  close() {
    if (this.canMinimize) {
      this.minimize();
    } else {
      document.body.style.setProperty('overflow', 'auto');
      this.dialogEl.classList.remove('Dialog--open');
      this.dialogEl.classList.remove('Dialog--inactive');
      this.minimized = false;
      this.setStyles({ offsetY: this.contentHeight });
    }
  }

  setStyles({ offsetY }) {
    this.dialogEl.style.setProperty('--Dialog-offset-y', CSS.px(offsetY));
  }

  registerEventListeners() {
    this.overlayEl.addEventListener('click', this.handleOverlayClick);

    if (this.noResize) return;
    if (this.isTouchDevice) {
      this.dragEl.addEventListener('touchstart', this.handleTouchStart);
    } else {
      this.dragEl.addEventListener('mousedown', this.handleTouchStart);
    }
  }

  removeEventListeners() {
    this.overlayEl.removeEventListener('click', this.handleOverlayClick);
    this.dragEl.removeEventListener('touchstart', this.handleTouchStart);
    this.dragEl.removeEventListener('mousedown', this.handleTouchStart);
  }

  handleTouchStart(evt) {
    if (this.canMinimize && this.lastTouchStartTS && evt.timeStamp - this.lastTouchStartTS < 500) {
      // treat as double click
      this.lastTouchStartTS = evt.timeStamp;
      if (this.minimized) return this.open();
      return this.minimize();
    }

    this.lastTouch = null;
    this.lastTouchStartTS = evt.timeStamp;
    this.dialogEl.classList.add('Dialog--dragging');
    this.dragStartDialogOffset = parseInt(this.dialogEl.style.getPropertyValue('--Dialog-offset-y'), 10) || 0;
    this.dragStartPageY = getPageY(evt);
    if (this.isTouchDevice) {
      window.addEventListener('touchmove', this.handleTouchMove);
      window.addEventListener('touchend', this.handleTouchEnd);
    } else {
      window.addEventListener('mousemove', this.handleTouchMove);
      window.addEventListener('mouseup', this.handleTouchEnd);
    }
  }

  handleTouchMove(evt) {
    const pageY = getPageY(evt);
    const delta = this.dragStartDialogOffset + (pageY - this.dragStartPageY);
    const offsetY = this.getOffsetY(delta);
    this.lastTouch = { pageY, velocity: this.lastTouch ? pageY - this.lastTouch.pageY : 0, offsetY };
    this.dialogEl.style.setProperty('--Dialog-offset-y', CSS.px(offsetY));
  }

  getOffsetY(value) {
    return clamp({ min: 0, value, max: this.contentHeight - this.headerHeight });
  }

  handleTouchEnd() {
    this.dialogEl.classList.remove('Dialog--dragging');

    window.removeEventListener('mousemove', this.handleTouchMove);
    window.removeEventListener('mouseup', this.handleTouchEnd);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);

    if (!this.lastTouch) return;
    const shouldSnapToBottom = this.contentHeight - this.lastTouch.offsetY < this.snapToBottomThreshold;
    if (this.canMinimize && shouldSnapToBottom) {
      this.minimize();
      return;
    }
    if (this.canMinimize && this.minimized) {
      this.open();
      return;
    }
    const animateOutPos = this.getOffsetY(this.lastTouch.offsetY + this.lastTouch.velocity * 4);
    this.dialogEl.style.setProperty('--Dialog-offset-y', CSS.px(animateOutPos));
  }
}

customElements.define('x-dialog', Dialog);
