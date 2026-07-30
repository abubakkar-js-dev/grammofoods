if (!customElements.get('quick-view-modal')) {
  customElements.define(
    'quick-view-modal',
    class QuickViewModal extends ModalDialog {
      constructor() {
        super();
        this.productData = null;
        this.currentImageIndex = 0;
        this._images = [];
        this._touchStartX = 0;
        this._touchStartY = 0;
        this._boundDocumentClick = this._onDocumentClick.bind(this);
        this._boundKeydown = this._onKeydown.bind(this);
        this._boundTouchStart = this._onTouchStart.bind(this);
        this._boundTouchEnd = this._onTouchEnd.bind(this);
      }

      _debug(...args) {
        if (localStorage.getItem('qv_debug') || window.qvDebug) {
          console.log('[QuickView]', ...args);
        }
      }

      connectedCallback() {
        super.connectedCallback?.();
        document.addEventListener('click', this._boundDocumentClick);
        this.modalBody = this.querySelector('.quick-view-modal__body');
      }

      disconnectedCallback() {
        document.removeEventListener('click', this._boundDocumentClick);
        document.removeEventListener('keydown', this._boundKeydown);
        this._removeTouchListeners();
      }

      _removeTouchListeners() {
        const wrapper = this.querySelector('.quick-view-modal__image-wrapper');
        if (wrapper) {
          wrapper.removeEventListener('touchstart', this._boundTouchStart);
          wrapper.removeEventListener('touchend', this._boundTouchEnd);
        }
      }

      _onDocumentClick(event) {
        const btn = event.target.closest('[data-action-quickview], [data-quickview-btn]');
        if (!btn) return;
        event.preventDefault();
        const productUrl = btn.getAttribute('data-product-url') || btn.getAttribute('href');
        if (!productUrl) return;
        this.show(btn, productUrl);
      }

      _onKeydown(event) {
        if (!this.hasAttribute('open')) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this._navToImage(this.currentImageIndex - 1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          this._navToImage(this.currentImageIndex + 1);
        }
      }

      _onTouchStart(event) {
        this._touchStartX = event.touches[0].clientX;
        this._touchStartY = event.touches[0].clientY;
      }

      _onTouchEnd(event) {
        const diffX = event.changedTouches[0].clientX - this._touchStartX;
        const diffY = event.changedTouches[0].clientY - this._touchStartY;
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
          if (diffX > 0) {
            this._navToImage(this.currentImageIndex - 1);
          } else {
            this._navToImage(this.currentImageIndex + 1);
          }
        }
      }

      show(opener, productUrl) {
        this.openedBy = opener;
        this._openModal(productUrl);
      }

      hide(preventFocus = false) {
        if (preventFocus) this.openedBy = null;
        this.productData = null;
        this._images = [];
        this.currentImageIndex = 0;
        document.removeEventListener('keydown', this._boundKeydown);
        this._removeTouchListeners();
        super.hide();
      }

      async _openModal(productUrl) {
        const loading = this.querySelector('.quick-view-modal__loading');
        const errorEl = this.querySelector('.quick-view-modal__error');
        errorEl?.classList.remove('is-visible');
        errorEl.textContent = '';
        loading?.classList.add('is-active');

        try {
          const handle = this._getProductHandle(productUrl);
          const response = await fetch(`/products/${handle}.js`);
          if (!response.ok) throw new Error('Product not found');
          this.productData = await response.json();
          this._images = (this.productData.images || []).map(img => ({
            ...img,
            src: this._normalizeUrl(img.src)
          }));
          this.currentImageIndex = 0;
          this._debug('Rendering modal, image count:', this._images.length);
          this._render();
          this._debug('Calling super.show()');
          super.show(this.openedBy);
          document.addEventListener('keydown', this._boundKeydown);
        } catch (e) {
          console.error('Quick view error:', e);
          if (errorEl) {
            errorEl.textContent = 'Failed to load product. Please try again.';
            errorEl.classList.add('is-visible');
          }
          this.currentImageIndex = 0;
        } finally {
          loading?.classList.remove('is-active');
        }
      }

      _normalizeUrl(url) {
        if (!url) return '';
        if (url.startsWith('//')) return 'https:' + url;
        return url;
      }

      _getProductHandle(url) {
        try {
          const u = new URL(url, window.location.origin);
          const parts = u.pathname.replace(/\/+$/, '').split('/');
          return parts[parts.length - 1];
        } catch {
          return url.replace(/^\/products\//, '').split('?')[0].split('#')[0];
        }
      }

      _render() {
        if (!this.productData) return;
        const p = this.productData;
        const selectedVariant = p.variants[0] || {};
        const hasSingleOption = p.options && p.options.length === 1 && p.options[0].values.length === 1 && p.options[0].values[0] === 'Default Title';

        const mediaHtml = this._buildMediaHtml(selectedVariant);
        const infoHtml = this._buildInfoHtml(p, selectedVariant, hasSingleOption);

        if (this.modalBody) {
          this.modalBody.innerHTML = mediaHtml + infoHtml;
        }

        if (this._images.length > 0) {
          this.currentImageIndex = this._getInitialImageIndex(selectedVariant);
          this._updateImage();
          this._preloadAdjacentImages();
        }
        this._attachMediaEvents();
        this._attachVariantEvents(p);
        this._attachTouchEvents();
        this.querySelector('.quick-view-modal__add-to-cart')?.addEventListener('click', this._onAddToCart.bind(this));
      }

      _attachTouchEvents() {
        this._removeTouchListeners();
        const wrapper = this.querySelector('.quick-view-modal__image-wrapper');
        if (wrapper) {
          wrapper.addEventListener('touchstart', this._boundTouchStart, { passive: true });
          wrapper.addEventListener('touchend', this._boundTouchEnd, { passive: true });
        }
      }

      _getInitialImageIndex(selectedVariant) {
        if (selectedVariant.featured_image?.src) {
          const normalized = this._normalizeUrl(selectedVariant.featured_image.src);
          const idx = this._images.findIndex(img => img.src === normalized);
          if (idx >= 0) return idx;
        }
        return 0;
      }

      _buildMediaHtml(selectedVariant) {
        const hasMultiple = this._images.length > 1;
        const counterHtml = hasMultiple
          ? `<span class="quick-view-modal__counter">1 / ${this._images.length}</span>`
          : '';

        let dotsHtml = '';
        if (hasMultiple && this._images.length <= 8) {
          dotsHtml = '<div class="quick-view-modal__dots">' +
            this._images.map((_, i) =>
              `<button class="quick-view-modal__dot${i === 0 ? ' is-active' : ''}" data-index="${i}" type="button" aria-label="Go to image ${i + 1}"></button>`
            ).join('') +
          '</div>';
        }

        const initialIndex = this._getInitialImageIndex(selectedVariant);
        const initialImage = this._images[initialIndex] || this._images[0];

        return `<div class="quick-view-modal__media">
          <div class="quick-view-modal__image-wrapper">
            ${this._images.length
              ? `<img alt="" width="800" height="800" loading="eager" fetchpriority="high" decoding="async" data-current-img>`
              : '<div class="quick-view-modal__placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>'
            }
            ${hasMultiple ? `
              <button class="quick-view-modal__nav quick-view-modal__nav--prev" type="button" aria-label="Previous image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button class="quick-view-modal__nav quick-view-modal__nav--next" type="button" aria-label="Next image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ` : ''}
            ${counterHtml}
          </div>
          ${dotsHtml}
        </div>`;
      }

      _buildInfoHtml(p, selectedVariant, hasSingleOption) {
        const currentPrice = this._parsePrice(selectedVariant.price || p.variants[0]?.price || 0);
        const comparePrice = this._parsePrice(selectedVariant.compare_at_price);
        const formattedPrice = this._formatMoney(currentPrice);
        const formattedCompare = comparePrice && comparePrice > currentPrice ? this._formatMoney(comparePrice) : null;
        const isSale = !!formattedCompare;

        const options = p.options || [];
        const showVariants = !hasSingleOption && options.length > 0 && p.variants.length > 1;

        const variantOptionsHtml = showVariants
          ? options.map((opt, optIdx) => {
              const values = [...new Set(p.variants.map(v => v[`option${optIdx + 1}`]).filter(Boolean))];
              return `<div class="quick-view-modal__variants">
                <label for="qv-option-${optIdx}">${opt.name}</label>
                <select id="qv-option-${optIdx}" data-option-index="${optIdx}">
                  ${values.map(val => {
                    const isSelected = selectedVariant[`option${optIdx + 1}`] === val;
                    return `<option value="${val.replace(/"/g, '&quot;')}"${isSelected ? ' selected' : ''}>${val}</option>`;
                  }).join('')}
                </select>
              </div>`;
            }).join('')
          : '';

        const avail = selectedVariant.available ?? true;
        const stockStatus = selectedVariant.inventory_quantity != null && selectedVariant.inventory_management
          ? `<span class="quick-view-modal__stock ${selectedVariant.inventory_quantity > 0 ? 'in-stock' : 'out-of-stock'}">
              ${selectedVariant.inventory_quantity > 0 ? (selectedVariant.inventory_quantity <= 5 ? `Only ${selectedVariant.inventory_quantity} left` : 'In Stock') : 'Out of Stock'}
            </span>`
          : (avail ? '<span class="quick-view-modal__stock in-stock">In Stock</span>' : '<span class="quick-view-modal__stock out-of-stock">Out of Stock</span>');

        return `<div class="quick-view-modal__info">
          <h2 class="quick-view-modal__title">
            <a href="${p.url}">${p.title}</a>
          </h2>
          <div class="quick-view-modal__price-row">
            <div class="quick-view-modal__price">
              <span class="${isSale ? 'price--sale' : ''}">${formattedPrice}</span>
              ${formattedCompare ? `<span class="price--compare">${formattedCompare}</span>` : ''}
            </div>
            ${stockStatus}
          </div>
          ${isSale ? `<span class="quick-view-modal__badge quick-view-modal__badge--sale">Sale</span>` : ''}
          ${p.description ? `<div class="quick-view-modal__description">${this._stripHtml(p.description)}</div>` : ''}
          <div class="quick-view-modal__variants-wrapper">
            ${variantOptionsHtml}
          </div>
          <div class="quick-view-modal__actions">
            <div class="quick-view-modal__qty">
              <button type="button" data-qty-minus aria-label="Decrease quantity">&minus;</button>
              <input type="number" id="qv-quantity" value="1" min="1" step="1" pattern="[0-9]*" inputmode="numeric" autocomplete="off">
              <button type="button" data-qty-plus aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="quick-view-modal__add-to-cart ${!avail ? 'sold-out' : ''}"${!avail ? ' disabled' : ''}>
              <span class="loading-spinner"></span>
              <span class="btn-text">${avail ? 'Add to Cart' : 'Sold Out'}</span>
            </button>
          </div>
          <div class="quick-view-modal__error"></div>
          <div class="quick-view-modal__footer">
            <a href="${p.url}" class="quick-view-modal__view-details">
              View Full Details
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>`;
      }

      _attachMediaEvents() {
        const prevBtn = this.querySelector('.quick-view-modal__nav--prev');
        const nextBtn = this.querySelector('.quick-view-modal__nav--next');

        prevBtn?.addEventListener('click', () => this._navToImage(this.currentImageIndex - 1));
        nextBtn?.addEventListener('click', () => this._navToImage(this.currentImageIndex + 1));

        this.querySelectorAll('.quick-view-modal__dot').forEach(dot => {
          dot.addEventListener('click', () => {
            const idx = parseInt(dot.dataset.index);
            if (!isNaN(idx)) this._navToImage(idx);
          });
        });
      }

      _navToImage(newIndex) {
        if (this._images.length === 0) return;
        this.currentImageIndex = (newIndex + this._images.length) % this._images.length;
        this._updateImage();
        this._preloadAdjacentImages();
      }

      _preloadAdjacentImages() {
        const preloadIndices = [
          (this.currentImageIndex + 1) % this._images.length,
          (this.currentImageIndex - 1 + this._images.length) % this._images.length
        ];
        preloadIndices.forEach(idx => {
          if (this._images[idx]) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = this._images[idx].src;
            document.head.appendChild(link);
            setTimeout(() => link.remove(), 1000);
          }
        });
      }

      _attachVariantEvents(p) {
        const selects = this.querySelectorAll('[data-option-index]');
        if (selects.length === 0) return;

        selects.forEach(sel => {
          sel.addEventListener('change', () => {
            const selectedOptions = [];
            this.querySelectorAll('[data-option-index]').forEach(s => {
              selectedOptions[s.dataset.optionIndex] = s.value;
            });

            const match = p.variants.find(v =>
              v.option1 === selectedOptions[0] &&
              (p.options.length < 2 || v.option2 === selectedOptions[1]) &&
              (p.options.length < 3 || v.option3 === selectedOptions[2])
            );

            if (match) {
              this._updateVariant(p, match);
            }
          });
        });

        const minusBtn = this.querySelector('[data-qty-minus]');
        const plusBtn = this.querySelector('[data-qty-plus]');
        const qtyInput = this.querySelector('#qv-quantity');

        minusBtn?.addEventListener('click', () => {
          if (qtyInput) {
            const val = parseInt(qtyInput.value) || 1;
            if (val > 1) qtyInput.value = val - 1;
          }
        });

        plusBtn?.addEventListener('click', () => {
          if (qtyInput) {
            const val = parseInt(qtyInput.value) || 1;
            qtyInput.value = val + 1;
          }
        });

        qtyInput?.addEventListener('change', () => {
          let val = parseInt(qtyInput.value) || 1;
          if (val < 1) val = 1;
          qtyInput.value = val;
        });

        qtyInput?.addEventListener('input', () => {
          let val = parseInt(qtyInput.value);
          if (isNaN(val) || val < 1) qtyInput.value = 1;
        });
      }

      _updateVariant(p, variant) {
        const priceEl = this.querySelector('.quick-view-modal__price');
        if (priceEl) {
          const currentPrice = this._parsePrice(variant.price) || 0;
          const comparePrice = this._parsePrice(variant.compare_at_price);
          const formattedPrice = this._formatMoney(currentPrice);
          const formattedCompare = comparePrice && comparePrice > currentPrice
            ? this._formatMoney(comparePrice) : null;
          const isSale = !!formattedCompare;
          priceEl.innerHTML = `
            <span class="${isSale ? 'price--sale' : ''}">${formattedPrice}</span>
            ${formattedCompare ? `<span class="price--compare">${formattedCompare}</span>` : ''}
          `;
        }

        const saleBadge = this.querySelector('.quick-view-modal__badge--sale');
        if (saleBadge) {
          const cp = this._parsePrice(variant.compare_at_price);
          const vp = this._parsePrice(variant.price) || 0;
          saleBadge.style.display = cp && cp > vp ? '' : 'none';
        }

        const stockEl = this.querySelector('.quick-view-modal__stock');
        if (stockEl) {
          const avail = variant.available ?? true;
          if (variant.inventory_quantity != null && variant.inventory_management) {
            if (variant.inventory_quantity > 0) {
              stockEl.className = 'quick-view-modal__stock in-stock';
              stockEl.textContent = variant.inventory_quantity <= 5 ? `Only ${variant.inventory_quantity} left` : 'In Stock';
            } else {
              stockEl.className = 'quick-view-modal__stock out-of-stock';
              stockEl.textContent = 'Out of Stock';
            }
          } else {
            stockEl.className = `quick-view-modal__stock ${avail ? 'in-stock' : 'out-of-stock'}`;
            stockEl.textContent = avail ? 'In Stock' : 'Out of Stock';
          }
        }

        const addBtn = this.querySelector('.quick-view-modal__add-to-cart');
        if (addBtn) {
          const avail = variant.available ?? true;
          addBtn.disabled = !avail;
          addBtn.classList.toggle('sold-out', !avail);
          addBtn.querySelector('.btn-text').textContent = avail ? 'Add to Cart' : 'Sold Out';
        }

        if (variant.featured_image?.src && this._images.length) {
          const normalized = this._normalizeUrl(variant.featured_image.src);
          const imgIdx = this._images.findIndex(img => img.src === normalized);
          if (imgIdx >= 0) {
            this.currentImageIndex = imgIdx;
            this._updateImage();
          }
        }
      }

      _setImageListeners(imgEl, src) {
        imgEl.classList.remove('qv-img-loaded', 'qv-img-error');
        imgEl.classList.add('qv-img-loading');
        this._debug('_setImageListeners', { src, completeWas: imgEl.complete, naturalWidthWas: imgEl.naturalWidth });

        const onLoad = () => {
          this._debug('Image load event fired, marking loaded');
          imgEl.classList.remove('qv-img-loading');
          imgEl.classList.add('qv-img-loaded');
        };

        const onError = () => {
          this._debug('Image error event fired');
          this._handleImageError(imgEl);
        };

        imgEl.removeEventListener('load', onLoad);
        imgEl.removeEventListener('error', onError);
        imgEl.addEventListener('load', onLoad, { once: true });
        imgEl.addEventListener('error', onError, { once: true });

        if (src) {
          imgEl.src = src;
          if (imgEl.complete) {
            if (imgEl.naturalWidth > 0) {
              this._debug('Cached image detected, marking loaded immediately');
              onLoad();
            } else {
              this._debug('Cached error detected, marking error');
              onError();
            }
          }
        }
      }

      _handleImageError(imgEl) {
        this._debug('_handleImageError', { src: imgEl.src, complete: imgEl.complete, naturalWidth: imgEl.naturalWidth });
        imgEl.classList.remove('qv-img-loading');
        imgEl.classList.add('qv-img-error');
        imgEl.removeAttribute('src');
        imgEl.alt = '';
        const wrapper = imgEl.closest('.quick-view-modal__image-wrapper');
        if (wrapper && !wrapper.querySelector('.quick-view-modal__img-error-msg')) {
          const msg = document.createElement('div');
          msg.className = 'quick-view-modal__img-error-msg';
          msg.textContent = 'Image unavailable';
          wrapper.appendChild(msg);
        }
        const errorSvg = wrapper?.querySelector('.quick-view-modal__img-error-svg');
        if (!errorSvg && wrapper) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'quick-view-modal__img-error-svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', '#ccc');
          svg.setAttribute('stroke-width', '1.5');
          svg.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>';
          wrapper.insertBefore(svg, wrapper.firstChild);
        }
      }

      _updateImage() {
        const imgEl = this.querySelector('[data-current-img]');
        if (!imgEl || !this._images[this.currentImageIndex]) {
          this._debug('_updateImage: no img element or no images');
          return;
        }

        const image = this._images[this.currentImageIndex];
        this._debug('_updateImage', { index: this.currentImageIndex, total: this._images.length, src: image.src });

        const wrapper = imgEl.closest('.quick-view-modal__image-wrapper');
        wrapper?.querySelector('.quick-view-modal__img-error-msg')?.remove();
        wrapper?.querySelector('.quick-view-modal__img-error-svg')?.remove();

        imgEl.classList.remove('qv-img-error');
        imgEl.style.opacity = '';
        imgEl.alt = image.alt || '';

        this._setImageListeners(imgEl, image.src);

        if (wrapper && image.src) {
          const preloadLink = document.createElement('link');
          preloadLink.rel = 'preload';
          preloadLink.as = 'image';
          preloadLink.href = image.src;
          document.head.appendChild(preloadLink);
          setTimeout(() => preloadLink.remove(), 2000);
        }

        setTimeout(() => {
          if (imgEl.classList.contains('qv-img-loading')) {
            imgEl.classList.remove('qv-img-loading');
            imgEl.classList.add('qv-img-loaded');
          }
        }, 8000);

        this.querySelectorAll('.quick-view-modal__dot').forEach(dot => {
          const idx = parseInt(dot.dataset.index);
          dot.classList.toggle('is-active', idx === this.currentImageIndex);
        });

        const counter = this.querySelector('.quick-view-modal__counter');
        if (counter) {
          counter.textContent = `${this.currentImageIndex + 1} / ${this._images.length}`;
        }
      }

      async _onAddToCart(event) {
        const btn = event.currentTarget;
        if (btn.disabled || btn.classList.contains('loading')) return;

        const errorEl = this.querySelector('.quick-view-modal__error');
        errorEl?.classList.remove('is-visible');
        errorEl.textContent = '';

        const qtyInput = this.querySelector('#qv-quantity');
        const quantity = Math.max(1, parseInt(qtyInput?.value) || 1);

        const options = this.productData?.options || [];
        const selectedOptions = [];
        this.querySelectorAll('[data-option-index]').forEach(sel => {
          selectedOptions[sel.dataset.optionIndex] = sel.value;
        });

        let variant = this.productData?.variants.find(v =>
          v.option1 === selectedOptions[0] &&
          (options.length < 2 || v.option2 === selectedOptions[1]) &&
          (options.length < 3 || v.option3 === selectedOptions[2])
        );

        if (!variant) {
          variant = this.productData?.variants?.[0];
        }

        if (!variant) {
          if (errorEl) {
            errorEl.textContent = 'Please select a valid variant.';
            errorEl.classList.add('is-visible');
          }
          return;
        }

        btn.classList.add('loading');

        try {
          const formData = new FormData();
          formData.append('id', variant.id);
          formData.append('quantity', quantity);

          const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to add to cart');
          }

          btn.classList.remove('loading');
          btn.classList.add('added');
          btn.querySelector('.btn-text').textContent = 'Added!';

          setTimeout(() => {
            btn.classList.remove('added');
            btn.querySelector('.btn-text').textContent = 'Add to Cart';
          }, 2000);

          document.body.dispatchEvent(new CustomEvent('modalClosed'));
          window.dispatchEvent(new CustomEvent('cart-updated'));

          const cartDrawer = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
          if (cartDrawer && typeof cartDrawer.renderContents === 'function') {
            const data = await response.clone().json();
            cartDrawer.renderContents(data);
          }

        } catch (e) {
          console.error('Add to cart error:', e);
          if (errorEl) {
            errorEl.textContent = e.message || 'Failed to add to cart. Please try again.';
            errorEl.classList.add('is-visible');
          }
          btn.classList.remove('loading');
        }
      }

      _parsePrice(value) {
        if (value == null) return null;
        if (typeof value === 'string') return parseFloat(value);
        return value;
      }

      _formatMoney(price) {
        const val = this._parsePrice(price);
        if (val == null || isNaN(val)) return 'Tk 0.00';
        const parts = val.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return 'Tk ' + parts.join('.');
      }

      _stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
      }
    }
  );
}
