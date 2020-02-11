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

var styles$1 = ":host{display:block;position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none}.Dialog__overlay{top:0;left:0;height:100%;transition:opacity .3s;transition-delay:.15s;background-color:rgba(0,0,0,.5)}.Dialog__content,.Dialog__overlay{position:absolute;width:100%;opacity:0;pointer-events:none}.Dialog__content{bottom:0;transition:opacity .3s,transform .3s;transform:translateY(var(--Dialog-offset-y,0))}.Dialog--open .Dialog__content,.Dialog--open .Dialog__overlay{opacity:1;pointer-events:auto}.Dialog--open .Dialog__content{transition-delay:.15s}.Dialog__drag-handle{color:hsla(0,0%,100%,.75);cursor:grab;position:absolute;top:-1.5rem;left:0;height:1.5rem;width:100%;text-align:center;user-select:none;display:flex;align-items:center;justify-content:center}.Dialog__drag-icon{display:inline-block;width:16px;height:8px}.Dialog__drag-icon,.Dialog__drag-icon:before{background-image:radial-gradient(currentColor 40%,transparent 0);background-size:4px 4px;background-position:0 100%;background-repeat:repeat-x}.Dialog__drag-icon:before{content:\"\";display:block;width:100%;height:33%}.Dialog--dragging .Dialog__drag-handle{cursor:grabbing}.Dialog--dragging .Dialog__content{transition:none}.Dialog--inactive .Dialog__overlay{opacity:0;pointer-events:none}.Dialog--inactive .Dialog__content{box-shadow:0 -.5em 1em rgba(0,0,0,.2)}.Dialog--inactive .Dialog__drag-handle{color:rgba(0,0,0,.8)}.Dialog--no-resize .Dialog__drag-handle{display:none}";

const clamp = ({ min, value, max }) => Math.min(Math.max(value, min), max);
const getPageY = (evt) => (evt.type.startsWith('touch') ? evt.touches[0].pageY : evt.pageY);

const template$1 = () => `
<style>${styles$1}</style>
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
    shadow.innerHTML = template$1();

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
