(function () {
  'use strict';

  class CustomFooterTop {
    constructor() {
      this.MOBILE_BREAKPOINT = 749;
      this.init();
    }

    init() {
      this.setupCollapsible();
      this.setupNewsletterForm();
      this.handleResize();

      // Re-init on Shopify theme editor section load
      document.addEventListener('shopify:section:load', (e) => {
        if (e.target.classList.contains('cf-top-section')) {
          this.setupCollapsible();
          this.setupNewsletterForm();
        }
      });

      window.addEventListener('resize', this.debounce(() => this.handleResize(), 200));
    }

    setupCollapsible() {
      const toggles = document.querySelectorAll('[data-collapse-toggle]');

      toggles.forEach((toggle) => {
        if (toggle.dataset.bound === 'true') return;
        toggle.dataset.bound = 'true';

        const content = toggle.nextElementSibling;
        if (!content || !content.hasAttribute('data-collapse-content')) return;

        // Set ARIA
        const contentId = `cf-content-${Math.random().toString(36).slice(2, 9)}`;
        content.id = contentId;
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('tabindex', '0');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', contentId);

        const handleToggle = () => {
          if (window.innerWidth > this.MOBILE_BREAKPOINT) return;
          const isOpen = toggle.classList.toggle('is-open');
          content.classList.toggle('is-open', isOpen);
          toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        };

        toggle.addEventListener('click', handleToggle);
        toggle.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        });
      });
    }

    handleResize() {
      const isDesktop = window.innerWidth > this.MOBILE_BREAKPOINT;
      const toggles = document.querySelectorAll('[data-collapse-toggle]');
      const contents = document.querySelectorAll('[data-collapse-content]');

      if (isDesktop) {
        // Ensure everything is visible on desktop
        toggles.forEach((t) => {
          t.classList.remove('is-open');
          t.setAttribute('aria-expanded', 'true');
        });
        contents.forEach((c) => c.classList.remove('is-open'));
      } else {
        // Reset to closed on mobile
        toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
      }
    }

    setupNewsletterForm() {
      const forms = document.querySelectorAll('.cf-top__newsletter-form');

      forms.forEach((form) => {
        if (form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        const submitBtn = form.querySelector('.cf-top__submit');
        const submitText = form.querySelector('.cf-top__submit-text');
        const input = form.querySelector('.cf-top__input');

        form.addEventListener('submit', (e) => {
          // Basic client-side validation
          if (!input.value.trim() || !this.isValidEmail(input.value)) {
            e.preventDefault();
            input.focus();
            this.showValidationError(form, 'Please enter a valid email address.');
            return;
          }

          if (submitBtn && submitText) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitText.textContent = 'Sending...';
          }
        });

        // Clear error on input
        input?.addEventListener('input', () => {
          const errorMsg = form.querySelector('.cf-top__form-message--error-client');
          if (errorMsg) errorMsg.remove();
        });
      });
    }

    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showValidationError(form, message) {
      let msg = form.querySelector('.cf-top__form-message--error-client');
      if (msg) msg.remove();

      msg = document.createElement('div');
      msg.className = 'cf-top__form-message cf-top__form-message--error cf-top__form-message--error-client';
      msg.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        ${message}
      `;
      form.appendChild(msg);

      setTimeout(() => msg.remove(), 4000);
    }

    debounce(fn, delay) {
      let timer;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CustomFooterTop());
  } else {
    new CustomFooterTop();
  }
})();