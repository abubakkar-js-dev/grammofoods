if (!customElements.get('customer-reviews-carousel')) {
  class CustomerReviewsCarousel {
    constructor(container) {
      this.container = container;
      this.slides = container.querySelectorAll('[data-slide]');
      this.dots = container.querySelectorAll('[data-dot]');
      this.prevBtn = container.querySelector('[data-prev]');
      this.nextBtn = container.querySelector('[data-next]');
      this.proofImages = container.closest('.customer-reviews')?.querySelectorAll('[data-proof-slide]') || [];

      this.currentIndex = 0;
      this.total = this.slides.length;
      this.autoplay = container.dataset.autoplay === 'true';
      this.autoplaySpeed = parseInt(container.dataset.autoplaySpeed) || 6000;
      this.autoplayTimer = null;
      this.isPaused = false;

      // Touch support
      this.touchStartX = 0;
      this.touchEndX = 0;

      this.init();
    }

    init() {
      if (this.total <= 1) return;

      // Button events
      this.prevBtn?.addEventListener('click', () => {
        this.goTo(this.currentIndex - 1);
        this.resetAutoplay();
      });

      this.nextBtn?.addEventListener('click', () => {
        this.goTo(this.currentIndex + 1);
        this.resetAutoplay();
      });

      // Dot events
      this.dots.forEach((dot) => {
        dot.addEventListener('click', () => {
          const idx = parseInt(dot.dataset.index);
          if (!isNaN(idx)) {
            this.goTo(idx);
            this.resetAutoplay();
          }
        });
      });

      // Touch/swipe events
      this.container.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      this.container.addEventListener('touchend', (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      }, { passive: true });

      // Keyboard navigation
      this.container.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.goTo(this.currentIndex - 1);
          this.resetAutoplay();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.goTo(this.currentIndex + 1);
          this.resetAutoplay();
        }
      });

      // Pause autoplay on hover
      this.container.addEventListener('mouseenter', () => {
        this.isPaused = true;
      });

      this.container.addEventListener('mouseleave', () => {
        this.isPaused = false;
      });

      // Pause when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.isPaused = true;
        } else {
          this.isPaused = false;
        }
      });

      // Start autoplay
      if (this.autoplay) {
        this.startAutoplay();
      }

      // Intersection Observer - only autoplay when visible
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.isPaused = false;
            } else {
              this.isPaused = true;
            }
          });
        }, { threshold: 0.3 });

        observer.observe(this.container);
      }
    }

    handleSwipe() {
      const diff = this.touchStartX - this.touchEndX;
      const threshold = 50;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          this.goTo(this.currentIndex + 1);
        } else {
          this.goTo(this.currentIndex - 1);
        }
        this.resetAutoplay();
      }
    }

    goTo(index) {
      // Wrap around
      const newIndex = ((index % this.total) + this.total) % this.total;

      if (newIndex === this.currentIndex) return;

      // Update slides
      this.slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === newIndex);
      });

      // Update dots
      this.dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === newIndex);
      });

      // Update proof images
      this.proofImages.forEach((img, i) => {
        img.classList.toggle('is-active', i === newIndex);
      });

      this.currentIndex = newIndex;
    }

    startAutoplay() {
      if (this.autoplayTimer) clearInterval(this.autoplayTimer);

      this.autoplayTimer = setInterval(() => {
        if (!this.isPaused) {
          this.goTo(this.currentIndex + 1);
        }
      }, this.autoplaySpeed);
    }

    resetAutoplay() {
      if (this.autoplay) {
        this.startAutoplay();
      }
    }

    destroy() {
      if (this.autoplayTimer) clearInterval(this.autoplayTimer);
    }
  }

  // Auto-initialize all carousels
  const initCarousels = () => {
    document.querySelectorAll('[data-carousel]').forEach((carousel) => {
      if (!carousel.dataset.initialized) {
        new CustomerReviewsCarousel(carousel);
        carousel.dataset.initialized = 'true';
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousels);
  } else {
    initCarousels();
  }

  // Re-init on section load (Shopify theme editor)
  document.addEventListener('shopify:section:load', initCarousels);

  // Mark as loaded
  customElements.define('customer-reviews-carousel', class extends HTMLElement {});
}