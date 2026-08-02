/* ============================================================
   Recently Viewed Products — section JS
   File: assets/recently-viewed.js
   Loaded by: sections/recently-viewed.liquid (defer)
   Configuration comes from data-* attributes on [data-rv-root]
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'grammo-recently-viewed';
  var MAX_STORED = 12;

  function getList() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveList(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function img(url, w) {
    if (!url) return '';
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }

  function initRecentlyViewed(root) {
    if (root.dataset.rvInit === 'true') return;
    root.dataset.rvInit = 'true';

    var moneyFormat = root.dataset.moneyFormat || '{{amount}}';
    var addUrl = (root.dataset.addUrl || '/cart/add') + '.js';
    var cartJsUrl = (root.dataset.cartUrl || '/cart') + '.js';
    var cartPageUrl = root.dataset.cartUrl || '/cart';
    var currentHandle = root.dataset.currentHandle || null;

    function formatMoney(cents) {
      if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
        return window.Shopify.formatMoney(cents, moneyFormat);
      }
      return moneyFormat.replace(/\{\{\s*amount\s*\}\}/g, (cents / 100).toFixed(2));
    }

    /* ---- 1. Remember the product being viewed right now ---- */
    var list = getList();
    if (currentHandle) {
      list = [currentHandle].concat(list.filter(function (h) { return h !== currentHandle; })).slice(0, MAX_STORED);
      saveList(list);
    }

    /* ---- 2. Render the grid ---- */
    var grid = root.querySelector('[data-rv-grid]');
    var emptyMsg = root.querySelector('[data-rv-empty]');
    if (!grid) return;

    var limit = parseInt(root.dataset.limit || grid.dataset.limit || '8', 10);
    var heading = root.querySelector('.rv-heading');
    var handles = list.filter(function (h) { return h !== currentHandle; }).slice(0, limit);

    if (!handles.length) {
      if (heading) heading.style.display = 'none';
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }

    Promise.all(handles.map(function (h) {
      return fetch('/products/' + h + '.js')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    })).then(function (products) {
      var cards = products.filter(Boolean).map(function (p) {
        var image1 = p.images && p.images.length ? p.images[0] : null;
        var image2 = p.images && p.images.length > 1 ? p.images[1] : null;
        var onSale = p.compare_at_price && p.compare_at_price > p.price;
        var pct = onSale ? '-' + Math.round((1 - p.price / p.compare_at_price) * 100) + '%' : null;
        var singleVariant = p.variants && p.variants.length === 1;

        var badge = '';
        if (!p.available) badge = '<span class="rv-badge rv-badge--soldout">Sold out</span>';
        else if (onSale) badge = '<span class="rv-badge rv-badge--sale">' + pct + '</span>';

        var priceHtml;
        if (onSale) priceHtml = '<s>' + formatMoney(p.compare_at_price) + '</s> <span class="rv-sale-price">' + formatMoney(p.price) + '</span>';
        else priceHtml = formatMoney(p.price);
        if (p.price_varies) priceHtml = 'From ' + priceHtml;

        var cta;
        if (!p.available) {
          cta = '<a class="rv-card__cta" href="' + p.url + '">Read more</a>';
        } else if (singleVariant) {
          cta = '<button class="rv-card__cta" type="button" data-rv-atc data-variant="' + p.variants[0].id + '">Add to cart</button>';
        } else {
          cta = '<a class="rv-card__cta" href="' + p.url + '">Quick Shop</a>';
        }

        return '' +
          '<div class="rv-card">' +
            '<a class="rv-card__media" href="' + p.url + '">' + badge +
              (image1 ? '<img src="' + img(image1, 500) + '" alt="' + esc(p.title) + '" loading="lazy">' : '') +
              (image2 ? '<img class="rv-hover" src="' + img(image2, 500) + '" alt="' + esc(p.title) + '" loading="lazy">' : '') +
            '</a>' +
            '<h3 class="rv-card__title"><a href="' + p.url + '">' + esc(p.title) + '</a></h3>' +
            '<div class="rv-card__price">' + priceHtml + '</div>' +
            cta +
          '</div>';
      });

      grid.innerHTML = cards.join('');

      /* ---- 3. Quick add for single-variant products ---- */
      Array.prototype.forEach.call(grid.querySelectorAll('[data-rv-atc]'), function (btn) {
        btn.addEventListener('click', function () {
          btn.disabled = true;
          fetch(addUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id: parseInt(btn.dataset.variant, 10), quantity: 1 })
          }).then(function (res) {
            if (!res.ok) throw new Error('add failed');
            return fetch(cartJsUrl);
          }).then(function (r) { return r.json(); }).then(function (cart) {
            var bubble = document.getElementById('cart-icon-bubble');
            if (bubble) {
              var wrap = bubble.querySelector('.cart-count-bubble');
              if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'cart-count-bubble';
                wrap.innerHTML = '<span aria-hidden="true"></span><span class="visually-hidden"></span>';
                bubble.appendChild(wrap);
              }
              wrap.querySelector('span').textContent = cart.item_count;
              var vis = wrap.querySelector('.visually-hidden');
              if (vis) vis.textContent = cart.item_count + ' items';
            }
            window.location.href = cartPageUrl;
          }).catch(function () {
            window.location.href = cartPageUrl;
          });
        });
      });
    });
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-rv-root]'), initRecentlyViewed);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
