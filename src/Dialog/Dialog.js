import styles from './Dialog.css';

const clamp = ({ min, value, max }) => Math.min(Math.max(value, min), max);
const getPageY = (evt) => (evt.type.startsWith('touch') ? evt.touches[0].pageY : evt.pageY);

const template = () => `
<style>${styles}</style>
<div class="Dialog">
  <div class="Dialog__overlay" role="button"></div>
  <div class="Dialog__content">
    <div class="Dialog__drag-handle"><span class="Dialog__drag-icon"></span></div>
    <slot></slot>
  </div>
</div>
`;

class Dialog extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'min-content-height', 'no-resize'];
  }

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = template();

    this.isOpen = false;
    this.connected = false;
    this.noResize = false;
    this.minimized = false;
    this.contentHeight = 0;
    this.minContentHeight = 34; // height of header
    this.isTouchDevice = navigator.maxTouchPoints > 0;

    this.close = this.close.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);

    this.dialogEl = this.shadowRoot.querySelector('.Dialog');
    this.overlayEl = this.shadowRoot.querySelector('.Dialog__overlay');
    this.contentEl = this.shadowRoot.querySelector('.Dialog__content');
    this.dragEl = this.shadowRoot.querySelector('.Dialog__drag-handle');
  }

  attributeChangedCallback(name, oldVal, newValue) {
    switch (name) {
      case 'open': {
        this.isOpen = newValue != null ? true : false;
        if (this.isOpen) return this.open();
        return this.close();
      }
      case 'min-content-height': {
        this.minContentHeight = Number(newValue);
        return;
      }
      case 'no-resize': {
        this.noResize = newValue != null ? true : false;
        this.dialogEl.classList[this.noResize ? 'add' : 'remove']('Dialog--no-resize');
        return;
      }
      default: {
        console.log('unhandled attr change:', name);
      }
    }
  }

  connectedCallback() {
    this.connected = true;
    this.contentHeight = this.contentEl.offsetHeight;
    this.registerEventListeners();
    this.setStyles({ offsetY: this.contentHeight });
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  handleOverlayClick(evt) {
    if (evt.target !== this.overlayEl) return;
    this.isOpen = false;
    this.removeAttribute('open');
    this.dialogEl.classList.remove('Dialog--open');
  }

  open(retries = 5) {
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
    this.setStyles({ offsetY: this.contentHeight - this.minContentHeight });
  }

  close() {
    this.minimized = false;
    document.body.style.setProperty('overflow', 'auto');
    this.dialogEl.classList.remove('Dialog--open');
    this.dialogEl.classList.remove('Dialog--inactive');
    this.setStyles({ offsetY: this.contentHeight });
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
    if (this.lastTouchStartTS && evt.timeStamp - this.lastTouchStartTS < 500) {
      // treat as double click
      this.lastTouchStartTS = evt.timeStamp;
      if (this.minimized) return this.open();
      return this.minimize();
    }

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
    const delta = this.dragStartDialogOffset + (getPageY(evt) - this.dragStartPageY);
    this.dialogEl.style.setProperty(
      '--Dialog-offset-y',
      CSS.px(clamp({ min: 0, value: delta, max: this.contentHeight - this.minContentHeight }))
    );
  }

  handleTouchEnd() {
    this.dialogEl.classList.remove('Dialog--dragging');

    window.removeEventListener('mousemove', this.handleTouchMove);
    window.removeEventListener('mouseup', this.handleTouchEnd);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
  }
}

customElements.define('x-dialog', Dialog);
