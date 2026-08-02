/* ============================================================
   Recently Viewed Products — section JS
   File: assets/recently-viewed.js

   - Stores viewed product handles in localStorage
   - Renders each card by requesting the card-product snippet
     server-side via the Section Rendering API:
       /products/{handle}?section_id=recently-viewed-card
     The cards are therefore byte-for-byte identical to the
     "You may also like" (related-products) section.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'grammo-recently-viewed';
  var MAX_STORED = 12;
  var CARD_SECTION = 'recently-viewed-card';

  function getList() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveList(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function fetchCard(handle) {
    return fetch('/products/' + encodeURIComponent(handle) + '?section_id=' + CARD_SECTION)
      .then(function (response) {
        if (!response.ok) throw new Error('product not found');
        return response.text();
      })
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'text/html');
        var item = doc.querySelector('li.grid__item');
        return item ? item.outerHTML : '';
      })
      .catch(function () { return ''; });
  }

  function initRecentlyViewed(root) {
    if (root.dataset.rvInit === 'true') return;
    root.dataset.rvInit = 'true';

    var currentHandle = root.dataset.currentHandle || '';

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

    var limit = parseInt(root.dataset.limit || '4', 10);
    var handles = list.filter(function (h) { return h !== currentHandle; }).slice(0, limit);

    if (!handles.length) {
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }

    Promise.all(handles.map(fetchCard)).then(function (cards) {
      var html = cards.filter(Boolean).join('');
      if (!html) {
        if (emptyMsg) emptyMsg.hidden = false;
        return;
      }
      grid.innerHTML = html;
      if (emptyMsg) emptyMsg.hidden = true;
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
