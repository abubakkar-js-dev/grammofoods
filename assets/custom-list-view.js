/* Custom 1-column list view: wishlist visual toggle
   Mirrors the theme's wishlist behavior (grammo-product.js):
   toggles the is-active state on click. */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-action-wishlist]');
  if (!btn) return;
  e.preventDefault();
  btn.classList.toggle('is-active');
  btn.setAttribute(
    'aria-label',
    btn.classList.contains('is-active') ? 'Remove from Wishlist' : 'Add to Wishlist'
  );
});
