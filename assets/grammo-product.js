/* ============================================================
   Grammo Product Page — main section JS
   File: assets/grammo-product.js
   Loaded by: sections/custom-main-product.liquid (defer)
   Configuration comes from data-* attributes on [data-gp-root]
   ============================================================ */
(function () {
  'use strict';

  function safeJSON(str, fallback) {
    try { return JSON.parse(str); } catch (e) { return fallback; }
  }

  function initGrammoProduct(root) {
    if (root.dataset.gpInit === 'true') return;
    root.dataset.gpInit = 'true';

    /* ---------- Config (from Liquid-rendered data attributes) ---------- */
    var moneyFormat = root.dataset.moneyFormat || '{{amount}}';
    var productTitle = root.dataset.productTitle || 'Item';
    var addUrl = (root.dataset.addUrl || '/cart/add') + '.js';
    var cartJsUrl = (root.dataset.cartUrl || '/cart') + '.js';

    var variantsEl = root.querySelector('[data-gp-variants]');
    var variants = variantsEl ? safeJSON(variantsEl.textContent, []) : [];
    var mediaIds = safeJSON(root.dataset.mediaIds || '[]', []);
    var selectedOptions = safeJSON(root.dataset.selectedOptions || '[]', []);
    var initialId = parseInt(root.dataset.initialVariant || '0', 10);
    var currentVariant = null;
    for (var i = 0; i < variants.length; i++) {
      if (variants[i].id === initialId) { currentVariant = variants[i]; break; }
    }
    if (!currentVariant && variants.length) currentVariant = variants[0];

    /* ---------- Gallery ---------- */
    var items = root.querySelectorAll('[data-gp-media-item]');
    var thumbs = root.querySelectorAll('[data-gp-thumb]');
    var current = 0;

    function setImage(index) {
      if (!items.length) return;
      current = ((index % items.length) + items.length) % items.length;
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-active', i === current);
        if (thumbs[i]) thumbs[i].classList.toggle('is-active', i === current);
      }
    }
    Array.prototype.forEach.call(thumbs, function (t) {
      t.addEventListener('click', function () { setImage(parseInt(t.dataset.index, 10)); });
    });
    var prevBtn = root.querySelector('[data-gp-prev]');
    var nextBtn = root.querySelector('[data-gp-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { setImage(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { setImage(current + 1); });

    /* ---------- Lightbox ---------- */
    var lightbox = root.querySelector('[data-gp-lightbox]');
    var lbImg = root.querySelector('[data-gp-lb-img]');
    Array.prototype.forEach.call(root.querySelectorAll('[data-gp-zoom]'), function (img) {
      img.addEventListener('click', function () {
        lbImg.src = img.dataset.gpZoom;
        lightbox.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
    });
    function closeLb() {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLb(); });
    root.querySelector('[data-gp-lb-close]').addEventListener('click', closeLb);

    /* ---------- Money ---------- */
    function formatMoney(cents) {
      if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
        return window.Shopify.formatMoney(cents, moneyFormat);
      }
      return moneyFormat.replace(/\{\{\s*amount\s*\}\}/g, (cents / 100).toFixed(2));
    }

    /* ---------- Elements ---------- */
    var priceEl = root.querySelector('[data-gp-price]');
    var availEl = root.querySelector('[data-gp-availability]');
    var variantInput = root.querySelector('[data-gp-variant-id]');
    var atcBtn = root.querySelector('[data-gp-atc]');
    var atcText = root.querySelector('[data-gp-atc-text]');
    var stickyAtcBtn = root.querySelector('[data-gp-sticky-atc]');
    var stickyPrice = root.querySelector('[data-gp-sticky-price]');
    var qtyInput = root.querySelector('[data-gp-qty-input]');
    var codBtn = root.querySelector('[data-gp-cod]');

    /* ---------- Variant render ---------- */
    function renderVariant(variant) {
      if (priceEl && variant) {
        var html = '<span>' + formatMoney(variant.price) + '</span>';
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          html = '<del>' + formatMoney(variant.compare_at_price) + '</del><ins>' + formatMoney(variant.price) + '</ins>';
        }
        priceEl.innerHTML = html;
      }
      if (stickyPrice && variant) stickyPrice.textContent = formatMoney(variant.price);

      var available = !!(variant && variant.available);
      if (availEl) {
        availEl.textContent = variant ? (available ? 'In Stock' : 'Out of stock') : 'Unavailable';
        availEl.classList.toggle('is-out', !available);
      }
      if (variantInput && variant) variantInput.value = variant.id;
      [atcBtn, stickyAtcBtn].forEach(function (btn) {
        if (btn) btn.disabled = !variant || !available;
      });
      if (atcText) atcText.textContent = !variant ? 'Unavailable' : (available ? 'Add to cart' : 'Sold out');
      if (qtyInput) {
        if (variant && variant.inventory_management === 'shopify' && variant.inventory_policy === 'deny') {
          qtyInput.max = variant.inventory_quantity;
        } else {
          qtyInput.removeAttribute('max');
        }
      }
      if (codBtn) codBtn.disabled = !available;
      if (variant && variant.featured_media) {
        var idx = mediaIds.indexOf(variant.featured_media.id);
        if (idx > -1) setImage(idx);
      }
    }

    Array.prototype.forEach.call(root.querySelectorAll('[data-gp-option-value]'), function (btn) {
      btn.addEventListener('click', function () {
        var optionWrap = btn.closest('[data-gp-option]');
        var pos = parseInt(optionWrap.dataset.optionPosition, 10);
        selectedOptions[pos - 1] = btn.dataset.value;
        Array.prototype.forEach.call(optionWrap.querySelectorAll('[data-gp-option-value]'), function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        var label = optionWrap.querySelector('[data-gp-option-current]');
        if (label) label.textContent = btn.dataset.value;
        currentVariant = null;
        for (var i = 0; i < variants.length; i++) {
          var v = variants[i], match = true;
          for (var j = 0; j < v.options.length; j++) {
            if (v.options[j] !== selectedOptions[j]) { match = false; break; }
          }
          if (match) { currentVariant = v; break; }
        }
        renderVariant(currentVariant);
      });
    });

    /* ---------- Quantity ---------- */
    var minusBtn = root.querySelector('[data-gp-qty-minus]');
    var plusBtn = root.querySelector('[data-gp-qty-plus]');
    function stepQty(d) {
      var v = parseInt(qtyInput.value || '1', 10) + d;
      var max = parseInt(qtyInput.max || '999999', 10);
      qtyInput.value = Math.max(1, Math.min(max, v));
    }
    if (minusBtn) minusBtn.addEventListener('click', function () { stepQty(-1); });
    if (plusBtn) plusBtn.addEventListener('click', function () { stepQty(1); });

    /* ---------- Toast ---------- */
    var toast = root.querySelector('[data-gp-toast]');
    var toastTimer;
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2600);
    }

    /* ---------- Cart (AJAX) ---------- */
    function updateBubble(count) {
      var bubble = document.getElementById('cart-icon-bubble');
      if (!bubble) return;
      var wrap = bubble.querySelector('.cart-count-bubble');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'cart-count-bubble';
        wrap.innerHTML = '<span aria-hidden="true"></span><span class="visually-hidden"></span>';
        bubble.appendChild(wrap);
      }
      wrap.querySelector('span').textContent = count;
      var vis = wrap.querySelector('.visually-hidden');
      if (vis) vis.textContent = count + ' items';
    }

    function refreshCartUI() {
      fetch(cartJsUrl).then(function (r) { return r.json(); }).then(function (cart) {
        updateBubble(cart.item_count);
      }).catch(function () {});
      if (!document.querySelector('cart-drawer')) return;
      fetch(window.location.pathname + '?sections=cart-drawer,cart-icon-bubble').then(function (r) { return r.json(); }).then(function (sections) {
        if (sections['cart-drawer']) {
          var doc = new DOMParser().parseFromString(sections['cart-drawer'], 'text/html');
          var fresh = doc.querySelector('cart-drawer');
          var existing = document.querySelector('cart-drawer');
          if (fresh && existing) existing.innerHTML = fresh.innerHTML;
          var drawer = document.querySelector('cart-drawer');
          if (drawer && typeof drawer.open === 'function') drawer.open();
        }
        if (sections['cart-icon-bubble']) {
          var doc2 = new DOMParser().parseFromString(sections['cart-icon-bubble'], 'text/html');
          var freshBubble = doc2.getElementById('cart-icon-bubble');
          var target = document.getElementById('cart-icon-bubble');
          if (freshBubble && target) target.innerHTML = freshBubble.innerHTML;
        }
      }).catch(function () {});
    }

    function addToCart(redirectCheckout) {
      if (!currentVariant || !currentVariant.available) { showToast('This variant is unavailable'); return Promise.resolve(); }
      var qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1', 10));
      if (atcBtn) atcBtn.disabled = true;
      return fetch(addUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: currentVariant.id, quantity: qty })
      }).then(function (res) {
        if (!res.ok) throw new Error('add failed');
        if (redirectCheckout) {
          window.location.href = '/checkout';
          return;
        }
        showToast('✓ ' + qty + ' × ' + productTitle + ' added to cart');
        refreshCartUI();
      }).catch(function () {
        showToast('Could not add to cart. Please try again.');
      }).finally(function () {
        if (atcBtn) atcBtn.disabled = !(currentVariant && currentVariant.available);
      });
    }

    var form = root.querySelector('[data-gp-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        addToCart(false);
      });
    }
    if (stickyAtcBtn) stickyAtcBtn.addEventListener('click', function () { addToCart(false); });
    if (codBtn) {
      codBtn.addEventListener('click', function () {
        codBtn.disabled = true;
        addToCart(true).finally(function () { codBtn.disabled = false; });
      });
    }

    /* ---------- Wishlist (visual toggle) ---------- */
    var wishBtn = root.querySelector('[data-gp-wish]');
    if (wishBtn) {
      wishBtn.addEventListener('click', function () {
        wishBtn.classList.toggle('is-active');
        showToast(wishBtn.classList.contains('is-active') ? '♥ Added to wishlist' : 'Removed from wishlist');
      });
    }

    /* ---------- Accordions ---------- */
    Array.prototype.forEach.call(root.querySelectorAll('[data-gp-acc-head]'), function (head) {
      head.addEventListener('click', function () {
        var item = head.closest('.gp-acc__item');
        var body = item.querySelector('[data-gp-acc-body]');
        var open = item.classList.toggle('is-open');
        body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
      });
    });

    /* ---------- Sticky ATC visibility ---------- */
    var sticky = root.querySelector('[data-gp-sticky]');
    if (sticky) {
      window.addEventListener('scroll', function () {
        var rect = root.getBoundingClientRect();
        sticky.classList.toggle('is-visible', rect.bottom < 0 || rect.top > window.innerHeight && window.scrollY > 400);
        if (rect.bottom > 0 && rect.top < window.innerHeight) sticky.classList.remove('is-visible');
      }, { passive: true });
    }
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-gp-root]'), initGrammoProduct);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
