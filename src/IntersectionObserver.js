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
