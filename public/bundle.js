var styles = ":host{display:block}.RichText{box-sizing:border-box}*,:after,:before{box-sizing:inherit}h1,h2,h3,h4,h5,h6{font-size:1.5rem}a{color:currentColor}";

const debounce = (fn, wait = 250) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, wait);
  };
};

const template = () => `
<style>${styles}</style>
<div class="RichText"></div>
`;

class RichText extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = template();
    const debouncedClone = debounce(this.cloneLightDOM.bind(this));

    const callback = (mutationsList) => {
      mutationsList.forEach((mutation) => {
        if (mutation.type !== 'childList') return;
        // A child node has been added or removed
        debouncedClone();
      });
    };

    this.observer = new MutationObserver(callback);
  }

  cloneLightDOM() {
    this.shadowRoot.lastElementChild.innerHTML = this.innerHTML;
  }

  connectedCallback() {
    const targetNode = this;
    const config = { attributes: true, childList: true, subtree: true };
    this.observer.observe(targetNode, config);
  }

  disconnectedCallback() {
    this.observer.disconnect();
  }
}

customElements.define('rich-text', RichText);

class IntObserver extends HTMLElement {
  static get observedAttributes() {
    return ['once', 'threshold', 'intersecting-class', 'top', 'bottom', 'left', 'right'];
  }

  constructor() {
    super();

    this.once = false;
    this.threshold = 1.0;
    this.intersectingClass = 'is-intersecting';
    this.top = 0;
    this.bottom = 0;
    this.left = 0;
    this.right = 0;

    this.intersecting = false;

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<slot></slot>';
  }

  attributeChangedCallback(name, oldVal, newValue) {
    if (name === 'once') {
      this.once = newValue != null ? true : false;
    } else if (name === 'threshold') {
      this.threshold = parseFloat(newValue);
    } else if (name === 'intersecting-class') {
      this.intersectingClass = newValue;
    } else {
      this[name] = Number(newValue);
    }
  }

  connectedCallback() {
    this.observer = new IntersectionObserver(this.observerCallback.bind(this), {
      root: null,
      rootMargin: `${this.top}px ${this.right}px ${this.bottom}px ${this.left}px`,
      threshold: this.threshold
    });

    this.observer.observe(this);

    const isElementNode = (node) => node.nodeType === 1;
    this.intersectingElms = this.shadowRoot
      .querySelector('slot')
      .assignedNodes()
      .filter(isElementNode);
  }

  disconnectedCallback() {
    this.observer.unobserve(this);
  }

  observerCallback(entries) {
    const isIntersecting = entries[0].isIntersecting;
    const classAction = isIntersecting ? 'add' : 'remove';

    if (isIntersecting && this.once) {
      this.observer.unobserve(this);
    }

    this.intersectingElms.forEach((node) => node.classList[classAction](this.intersectingClass));
  }
}

customElements.define('intersection-observer', IntObserver);

var styles$1 = ".Dialog{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none}.Dialog__overlay{top:0;left:0;height:100%;transition:opacity .3s;transition-delay:.15s;background-color:rgba(0,0,0,.5)}.Dialog__content,.Dialog__overlay{position:absolute;width:100%;opacity:0;pointer-events:none}.Dialog__content{bottom:0;transition:opacity .3s,transform .3s ease-out;transform:translateY(var(--Dialog-offset-y,0))}.Dialog--open .Dialog__content,.Dialog--open .Dialog__overlay{opacity:1;pointer-events:auto}.Dialog--open .Dialog__content{transition-delay:.15s}.Dialog__drag-handle{color:hsla(0,0%,100%,.75);cursor:grab;position:absolute;top:-1.5rem;left:0;height:1.5rem;width:100%;text-align:center;user-select:none;display:flex;align-items:center;justify-content:center}.Dialog__drag-icon{display:inline-block;width:16px;height:8px}.Dialog__drag-icon,.Dialog__drag-icon:before{background-image:radial-gradient(currentColor 40%,transparent 0);background-size:4px 4px;background-position:0 100%;background-repeat:repeat-x}.Dialog__drag-icon:before{content:\"\";display:block;width:100%;height:33%}.Dialog--dragging .Dialog__drag-handle{cursor:grabbing}.Dialog--dragging .Dialog__content{transition:none}.Dialog--inactive .Dialog__overlay{opacity:0;pointer-events:none}.Dialog--inactive .Dialog__content{box-shadow:0 -.5em 1em rgba(0,0,0,.2)}.Dialog--inactive .Dialog__drag-handle{color:rgba(0,0,0,.8)}.Dialog--no-resize .Dialog__drag-handle{display:none}";

const clamp = ({ min, value, max }) => Math.min(Math.max(value, min), max);
const getPageY = (evt) => (evt.type.startsWith('touch') ? evt.touches[0].pageY : evt.pageY);
const isElement = ({ nodeType }) => nodeType === 1;
const toBool = (value) => (value != null ? true : false);

const template$1 = () => `
<style>${styles$1}</style>
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
    shadow.innerHTML = template$1();

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
