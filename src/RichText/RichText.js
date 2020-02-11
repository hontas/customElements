import styles from './RichText.css';
import debounce from '../utils/debounce';

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
