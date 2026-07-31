(function () {
  'use strict';

  class CustomFooterBottom {
    constructor() {
      this.SCROLL_THRESHOLD = 400;
      this.backToTopBtn = null;
      this.scrollTicking = false;
      this.init();
    }

    init() {
      this.setupBackToTop();

      // Re-init on Shopify theme editor section load
      document.addEventListener('shopify:section:load', (e) => {
        if (e.target.classList.contains('cf-bottom-section')) {
          this.setupBackToTop();
        }
      });
    }

    setupBackToTop() {
      this.backToTopBtn = document.querySelector('[data-back-to-top]');
      if (!this.backToTopBtn) return;

      // Skip if already bound
      if (this.backToTopBtn.dataset.bound === 'true') return;
      this.backToTopBtn.dataset.bound = 'true';

      // Handle click
      this.backToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollToTop();
      });

      // Handle scroll with throttling
      window.addEventListener('scroll', () => this.handleScroll(), { passive: true });

      // Initial check
      this.handleScroll();
    }

    handleScroll() {
      if (this.scrollTicking) return;

      this.scrollTicking = true;
      window.requestAnimationFrame(() => {
        this.toggleVisibility();
        this.scrollTicking = false;
      });
    }

    toggleVisibility() {
      if (!this.backToTopBtn) return;

      const shouldShow = window.pageYOffset > this.SCROLL_THRESHOLD;
      this.backToTopBtn.classList.toggle('is-visible', shouldShow);
    }

    scrollToTop() {
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        window.scrollTo(0, 0);
        return;
      }

      // Smooth scroll to top
      if ('scrollBehavior' in document.documentElement.style) {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } else {
        this.smoothScrollPolyfill();
      }
    }

    smoothScrollPolyfill() {
      const startY = window.pageYOffset;
      const startTime = performance.now();
      const duration = 500;

      const easeInOutCubic = (t) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const step = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        window.scrollTo(0, startY - startY * easedProgress);

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CustomFooterBottom());
  } else {
    new CustomFooterBottom();
  }
})();