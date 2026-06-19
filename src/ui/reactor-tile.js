class ReactorTile extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.classList.add('tile');
    this.setAttribute('tabindex', '0');
    this.setAttribute('role', 'button');

    const wrapperWrapper = document.createElement('div');
    wrapperWrapper.className = 'percent_wrapper_wrapper';
    const wrapper = document.createElement('div');
    wrapper.className = 'percent_wrapper';
    this.$percent = document.createElement('p');
    this.$percent.className = 'percent';
    wrapper.appendChild(this.$percent);
    wrapperWrapper.appendChild(wrapper);
    this.appendChild(wrapperWrapper);

    this.addEventListener('animationend', () => this.classList.remove('exploding'));
  }

  setBarWidth(pct) {
    if (this.$percent) {
      this.$percent.style.width = `${pct}%`;
    }
  }
}

if (!customElements.get('reactor-tile')) {
  customElements.define('reactor-tile', ReactorTile);
}
