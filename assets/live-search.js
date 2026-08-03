/* ==========================================
   Live Search - Global
   ========================================== */

const DEBUG = false;
const debug = (...args) => {
  if (DEBUG) console.log('[LiveSearch]', ...args);
};

class LiveSearch {
  constructor() {
    this.DEBOUNCE_DELAY = 150;
    this.RESULTS_LIMIT = 6;
    this.searchInputs = Array.from(
      document.querySelectorAll(
        'input[type="search"], input[name="q"], .search__input'
      )
    ).filter((input) => {
      // Skip inputs already handled by Dawn's predictive search
      // (modal search, search page) to avoid double handling.
      return !input.closest('predictive-search, main-search');
    });
    this.cache = new Map();
    this.defaultProducts = null;
    this.currentDropdown = null;
    this.currentInput = null;
    this.debounceTimer = null;
    this.hideTimer = null;
    this.selectedIndex = -1;
    this.abortController = null;
    this.init();
  }

  init() {
    this.searchInputs.forEach((input) => this.attachToInput(input));
    document.addEventListener('click', (e) => this.handleOutsideClick(e));

    // Preload defaults on idle time so first hover is instant.
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.fetchDefaults());
    } else {
      setTimeout(() => this.fetchDefaults(), 1000);
    }
  }

  attachToInput(input) {
    const wrapper = this.createDropdown(input);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', 'live-search-dropdown');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');

    const dropdown = wrapper.querySelector('.live-search__dropdown');
    this.dropdown = dropdown;
    this.currentDropdown = dropdown;
    this.results = dropdown.querySelector('[data-live-search-results]');
    this.skeleton = dropdown.querySelector('[data-live-search-skeleton]');
    this.empty = dropdown.querySelector('[data-live-search-empty]');
    this.viewAll = dropdown.querySelector('[data-live-search-view-all]');

    input.addEventListener('focus', () => this.handleInputFocus(input));
    input.addEventListener('mouseenter', () => this.handleInputHover(input));
    input.addEventListener('mouseleave', () => this.scheduleHide());
    dropdown.addEventListener('mouseenter', () => this.cancelHide());
    dropdown.addEventListener('mouseleave', () => this.scheduleHide());
    wrapper.addEventListener('mouseenter', () => this.cancelHide());
    input.addEventListener('input', (e) => {
      debug('input event:', e.target.value);
      this.handleInput(e.target);
    });
    input.addEventListener('keyup', (e) => {
      if (e.key !== 'Enter' && e.key !== 'Escape' && !e.key.startsWith('Arrow')) {
        this.handleInput(e.target);
      }
    });
    input.addEventListener('keydown', (e) => this.handleInputKeydown(input, e));
    input.addEventListener('blur', () => {
      // Let click events on the dropdown fire first.
      setTimeout(() => {
        if (!dropdown.contains(document.activeElement)) {
          this.hideDropdown();
        }
      }, 150);
    });

    dropdown.addEventListener('mousedown', (e) => e.preventDefault());
    dropdown.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-product-url]');
      if (link) {
        window.location.href = link.getAttribute('data-product-url');
      }
    });
  }

  createDropdown(input) {
    const existing = input.closest('.live-search');
    if (existing) return existing;

    const template = document.createElement('div');
    template.className = 'live-search';
    template.innerHTML = `
      <div class="live-search__dropdown" data-live-search-dropdown>
        <div class="live-search__skeleton" data-live-search-skeleton hidden>
          ${Array.from({ length: 3 })
            .map(
              () => `
            <div class="live-search__skeleton-row">
              <div class="live-search__skeleton-img"></div>
              <div class="live-search__skeleton-content">
                <div class="live-search__skeleton-line"></div>
                <div class="live-search__skeleton-line live-search__skeleton-line--short"></div>
              </div>
            </div>`
            )
            .join('')}
        </div>
        <div class="live-search__results" data-live-search-results hidden></div>
        <div class="live-search__empty" data-live-search-empty hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <p>No products found</p>
          <span>Try a different search term</span>
        </div>
        <div class="live-search__footer">
          <a href="/search" class="live-search__view-all" data-live-search-view-all>
            View All
            <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M 18.71875 6.78125 L 17.28125 8.21875 L 24.0625 15 L 4 15 L 4 17 L 24.0625 17 L 17.28125 23.78125 L 18.71875 25.21875 L 27.21875 16.71875 L 27.90625 16 L 27.21875 15.28125 Z"/>
            </svg>
          </a>
        </div>
      </div>
    `;

    const host = input.parentElement;
    host.style.position = 'relative';
    host.appendChild(template);

    return template;
  }

  handleInputFocus(input) {
    this.currentInput = input;
    this.showDropdown();
    this.setSelected(-1);
    if (this.getQuery(input).length === 0) {
      this.renderDefaults();
    }
  }

  handleInputHover(input) {
    this.currentInput = input;
    this.showDropdown();
    if (this.getQuery(input).length === 0) {
      this.renderDefaults();
    }
  }

  async handleInput(input) {
    this.currentInput = input;
    clearTimeout(this.debounceTimer);
    const query = this.getQuery(input);

    if (query.length === 0) {
      this.renderDefaults();
      return;
    }

    this.debounceTimer = setTimeout(async () => {
      const latestQuery = this.getQuery(input);

      // Empty query — show defaults
      if (latestQuery.length === 0) {
        if (this.defaultProducts && this.defaultProducts.length) {
          this.renderResults(this.defaultProducts);
        } else {
          const defaults = await this.fetchDefaults();
          this.renderResults(defaults || []);
        }
        return;
      }

      // Instant cache render
      if (this.cache.has(latestQuery)) {
        const cached = this.cache.get(latestQuery);
        if (cached.length === 0) {
          this.renderEmpty();
        } else {
          this.renderResults(cached);
        }
        return;
      }

      // Show skeleton for new query
      this.renderSkeleton();
      this.showDropdown();
      this.setSelected(-1);
      this.updateViewAllLink(latestQuery);

      const products = await this.searchProducts(latestQuery);

      // Aborted — do nothing
      if (products === null) return;

      if (this.currentInput !== input || this.getQuery(input) !== latestQuery) return;

      if (products.length === 0) {
        this.renderEmpty();
      } else {
        this.cache.set(latestQuery, products);
        this.renderResults(products);
      }
    }, this.DEBOUNCE_DELAY);
  }

  getQuery(input) {
    return (input.value || '').trim();
  }

  async fetchDefaults() {
    if (this.defaultProducts || this.defaultLoading) return;

    this.defaultLoading = true;
    try {
      const data = await fetch(`/products.json?limit=${this.RESULTS_LIMIT}`, {
        signal: this.getAbortSignal(),
      });
      if (!data.ok) throw new Error('Failed to load');
      const json = await data.json();
      this.defaultProducts = this.normalizeProducts(json.products || []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.defaultProducts = [];
      }
    } finally {
      this.defaultLoading = false;
    }
  }

  renderDefaults() {
    this.updateViewAllLink('');
    if (this.defaultProducts) {
      this.renderResults(this.defaultProducts);
    } else {
      this.renderSkeleton();
      this.fetchDefaults().then(() => {
        if (this.currentInput && this.getQuery(this.currentInput).length === 0) {
          this.renderResults(this.defaultProducts || []);
        }
      });
    }
  }

  async searchProducts(query) {
    // Check cache first
    if (this.cache.has(query)) {
      debug('cache hit:', query);
      return this.cache.get(query);
    }

    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const url = `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=${this.RESULTS_LIMIT}&resources[options][unavailable_products]=last`;

      debug('fetching:', url);

      const response = await fetch(url, {
        signal: this.abortController.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        debug('response not OK:', response.status);
        return [];
      }

      const data = await response.json();
      debug('response data:', data);

      // Try multiple possible response structures
      const products =
        (data.resources && data.resources.results && data.resources.results.products) ||
        (data.results && data.results.products) ||
        data.products ||
        [];

      debug('products found:', products.length);

      const normalized = this.normalizeProducts(products);

      // Cache result
      this.cache.set(query, normalized);

      return normalized;
    } catch (error) {
      if (error.name === 'AbortError') {
        debug('request aborted');
        return null;
      }
      debug('search error:', error);
      return [];
    }
  }

  getAbortSignal() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    return this.abortController.signal;
  }

  normalizeProducts(products) {
    return products.map((p) => {
      let imgSrc = '';
      if (p.featured_image) {
        imgSrc =
          typeof p.featured_image === 'string'
            ? p.featured_image
            : p.featured_image.url || p.featured_image.src || '';
      } else if (p.image) {
        imgSrc = typeof p.image === 'string' ? p.image : p.image.src || p.image.url || '';
      } else if (p.images && p.images.length) {
        const first = p.images[0];
        imgSrc = typeof first === 'string' ? first : first.src || first.url || '';
      }

      if (imgSrc && !imgSrc.includes('?') && !imgSrc.includes('width=')) {
        imgSrc += '?width=150';
      }

      const variants = p.variants || [];
      let prices = variants.map((v) => parseFloat(v.price)).filter((n) => !isNaN(n));

      // suggest.json returns price at the product level (no variants array)
      if (!prices.length) {
        const top =
          parseFloat(p.price) ||
          parseFloat(p.price_min) ||
          parseFloat(p.price_max) ||
          (p.presentment_prices && p.presentment_prices[0]
            ? parseFloat(p.presentment_prices[0].price.amount)
            : 0);
        if (top) prices = [top];
      }

      const priceMin = prices.length ? Math.min(...prices) : 0;
      const priceMax = prices.length ? Math.max(...prices) : 0;
      const hasRange = priceMax > priceMin;

      return {
        id: p.id,
        title: p.title || '',
        handle: p.handle || '',
        url: p.url || `/products/${p.handle || ''}`,
        image: imgSrc,
        price: priceMin,
        priceMax: priceMax,
        hasRange: hasRange,
      };
    });
  }

  renderSkeleton() {
    this.results.innerHTML = '';
    this.results.hidden = true;
    this.empty.hidden = true;
    this.skeleton.hidden = false;
  }

  hideSkeleton() {
    if (this.skeleton) this.skeleton.hidden = true;
  }

  hideEmpty() {
    if (this.empty) this.empty.hidden = true;
  }

  renderResults(products) {
    const resultsContainer = this.currentDropdown
      ? this.currentDropdown.querySelector('[data-live-search-results]')
      : this.results;
    if (!resultsContainer) {
      debug('results container not found');
      return;
    }

    // Hide skeleton and empty state
    this.hideSkeleton();
    this.hideEmpty();

    if (!products || products.length === 0) {
      resultsContainer.innerHTML = '';
      this.renderEmpty();
      return;
    }

    resultsContainer.hidden = false;
    resultsContainer.innerHTML = products
      .map(
        (p, i) => `
      <a
        href="${p.url}"
        class="live-search__item"
        role="option"
        aria-selected="false"
        data-product-url="${p.url}"
        data-index="${i}"
        tabindex="-1"
      >
        ${this.renderImageHtml(p)}
        <div class="live-search__item-info">
          <p class="live-search__item-title">${this.escapeHtml(p.title)}</p>
          <div class="live-search__item-price">
            ${p.hasRange ? '<span class="from">From </span>' : ''}${this.formatPrice(p.price)}
          </div>
        </div>
      </a>`
      )
      .join('');

    this.announce(`${products.length} results`);
  }

  renderImageHtml(p) {
    const placeholder = `
      <div class="live-search__image-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>`;

    if (!p.image) {
      return placeholder;
    }

    return `
      <img
        class="live-search__image"
        src="${this.escapeAttr(p.image)}"
        alt="${this.escapeAttr(p.title)}"
        loading="lazy"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      >
      <div class="live-search__image-placeholder" style="display:none;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>`;
  }

  renderEmpty() {
    this.hideSkeleton();
    this.results.hidden = true;
    this.empty.hidden = false;
    this.announce('No products found');
  }

  renderError() {
    this.results.hidden = true;
    this.hideSkeleton();
    this.empty.hidden = false;
    this.empty.querySelector('p').textContent = 'Something went wrong';
    this.empty.querySelector('span').textContent = 'Please try again';
    this.announce('Search failed');
  }

  showDropdown() {
    if (!this.dropdown) return;
    this.dropdown.classList.add('is-open');
    if (this.currentInput) {
      this.currentInput.setAttribute('aria-expanded', 'true');
    }
  }

  scheduleHide() {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hideDropdown(), 150);
  }

  cancelHide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  hideDropdown() {
    this.cancelHide();
    if (!this.dropdown) return;
    this.dropdown.classList.remove('is-open');
    if (this.currentInput) {
      this.currentInput.setAttribute('aria-expanded', 'false');
    }
    this.setSelected(-1);
  }

  updateViewAllLink(query) {
    if (!this.viewAll) return;
    const url = query ? `/search?q=${encodeURIComponent(query)}` : '/collections/all';
    this.viewAll.setAttribute('href', url);
  }

  formatPrice(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return `Tk ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  escapeAttr(str) {
    return this.escapeHtml(str);
  }

  announce(message) {
    let region = document.querySelector('[data-live-search-live-region]');
    if (!region) {
      region = document.createElement('div');
      region.setAttribute('data-live-search-live-region', '');
      region.setAttribute('aria-live', 'polite');
      region.classList.add('visually-hidden');
      document.body.appendChild(region);
    }
    region.textContent = message;
  }

  handleOutsideClick(e) {
    if (
      this.currentInput &&
      !this.currentInput.closest('.live-search')?.contains(e.target)
    ) {
      this.hideDropdown();
    }
  }

  handleInputKeydown(input, e) {
    if (!this.dropdown || !this.dropdown.classList.contains('is-open')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.navigate(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.navigate(-1);
    } else if (e.key === 'Enter') {
      const query = this.getQuery(input);
      const active = this.results.querySelector('.live-search__item.is-selected');
      if (active) {
        e.preventDefault();
        window.location.href = active.getAttribute('data-product-url');
      } else if (query.length) {
        // Fall through to native form submit.
        this.hideDropdown();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.hideDropdown();
      input.blur();
    }
  }

  navigate(direction) {
    const items = this.results.querySelectorAll('.live-search__item');
    if (!items.length) return;

    items.forEach((el) => el.classList.remove('is-selected'));

    this.selectedIndex += direction;
    if (this.selectedIndex < 0) this.selectedIndex = items.length - 1;
    if (this.selectedIndex >= items.length) this.selectedIndex = 0;

    const active = items[this.selectedIndex];
    active.classList.add('is-selected');
    active.setAttribute('aria-selected', 'true');
    active.scrollIntoView({ block: 'nearest' });

    if (this.currentInput) {
      this.currentInput.setAttribute('aria-activedescendant', active.id || '');
    }
  }

  setSelected(index) {
    this.selectedIndex = index;
    const items = this.results.querySelectorAll('.live-search__item');
    items.forEach((el, i) => {
      if (i === index) {
        el.classList.add('is-selected');
        el.setAttribute('aria-selected', 'true');
      } else {
        el.classList.remove('is-selected');
        el.setAttribute('aria-selected', 'false');
      }
    });
  }

  destroy() {
    clearTimeout(this.debounceTimer);
    this.cancelHide();
    if (this.abortController) {
      this.abortController.abort();
    }
    this.currentInput = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.LiveSearchInstance) {
    window.LiveSearchInstance = new LiveSearch();
  }
});

document.addEventListener('shopify:section:load', () => {
  if (window.LiveSearchInstance && window.LiveSearchInstance.destroy) {
    window.LiveSearchInstance.destroy();
  }
  window.LiveSearchInstance = new LiveSearch();
});
