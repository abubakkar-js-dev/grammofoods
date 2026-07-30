class CollectionToolbar extends HTMLElement {
  connectedCallback() {
    this.grid = this.querySelector('#product-grid');
    this.filterBtn = this.querySelector('[data-filter-drawer-btn]');
    this.drawer = this.querySelector('[data-filter-drawer]');
    this.drawerOverlay = this.querySelector('[data-filter-drawer-overlay]');
    this.drawerClose = this.querySelector('[data-filter-drawer-close]');
    this.drawerApply = this.querySelector('[data-filter-drawer-apply]');
    this.sortSelect = this.querySelector('#SortByToolbar');
    this.sortDropdownBtn = this.querySelector('[data-sortby-btn]');
    this.sortDropdown = this.querySelector('[data-sortby-dropdown]');
    this.sortDropdownClose = this.querySelector('[data-sortby-close]');
    this.layoutBtns = this.querySelectorAll('[data-layout-btn]');

    if (!this.grid) return;

    document.body.classList.add('collection-toolbar-enabled');

    this.sanitizeCardPrices();
    this.initLayout();
    this.initEvents();

    const observer = new MutationObserver(() => this.sanitizeCardPrices());
    observer.observe(this.grid, { childList: true, subtree: true });
  }

  sanitizeCardPrices() {
    const currencySuffixes = ['BDT', 'USD', 'EUR', 'GBP', '৳', '$', '€', '£'];
    const priceItems = document.querySelectorAll(
      'body.collection-toolbar-enabled .price .price-item'
    );
    priceItems.forEach((el) => {
      if (el.dataset.priceSanitized === '1') return;
      let text = el.textContent.trim();
      currencySuffixes.forEach((suffix) => {
        const regex = new RegExp(`\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
        text = text.replace(regex, '').trim();
      });
      currencySuffixes.forEach((suffix) => {
        const regex = new RegExp(`^\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`);
        text = text.replace(regex, '').trim();
      });
      el.textContent = text;
      el.dataset.priceSanitized = '1';
    });
  }

  initLayout() {
    const saved = localStorage.getItem('collectionLayout');
    if (saved) {
      try {
        const layout = JSON.parse(saved);
        this.applyLayout(layout);
      } catch {
        this.setDefaultLayout();
      }
    } else {
      this.setDefaultLayout();
    }
  }

  setDefaultLayout() {
    const isMobile = window.innerWidth < 750;
    const isTablet = window.innerWidth >= 750 && window.innerWidth < 990;
    if (isMobile) {
      this.applyLayout({ mobile: '2' });
    } else if (isTablet) {
      this.applyLayout({ tablet: '3' });
    } else {
      this.applyLayout({ desktop: '4' });
    }
  }

  applyLayout(layout) {
    this.grid.classList.remove(
      'grid--1-col-tablet-down', 'grid--2-col-tablet-down',
      'grid--2-col-desktop', 'grid--3-col-desktop', 'grid--4-col-desktop',
      'grid--5-col-desktop', 'grid--6-col-desktop',
      'grid--list'
    );

    if (layout.mobile) {
      if (layout.mobile === 'list') {
        this.grid.classList.add('grid--list');
      } else {
        this.grid.classList.add(`grid--${layout.mobile}-col-tablet-down`);
      }
    }
    if (layout.tablet && !layout.mobile) {
      if (layout.tablet === 'list') {
        this.grid.classList.add('grid--list');
      } else {
        this.grid.classList.add(`grid--${layout.tablet}-col-tablet-down`);
      }
    }
    if (layout.desktop) {
      if (layout.desktop === 'list') {
        this.grid.classList.add('grid--list');
      } else {
        this.grid.classList.add(`grid--${layout.desktop}-col-desktop`);
      }
    }

    this.updateActiveLayoutButtons(layout);
  }

  getDeviceGroup() {
    const w = window.innerWidth;
    if (w < 750) return 'mobile';
    if (w < 990) return 'tablet';
    return 'desktop';
  }

  updateActiveLayoutButtons(layout) {
    this.layoutBtns.forEach((btn) => {
      btn.classList.remove('is--active');
      const val = btn.dataset.layoutVal;
      const group = btn.dataset.layoutGroup;
      if (layout[group] === val) {
        btn.classList.add('is--active');
      }
    });
  }

  saveLayout(group, value) {
    const saved = localStorage.getItem('collectionLayout');
    let layout = {};
    if (saved) {
      try { layout = JSON.parse(saved); } catch { /* ignore */ }
    }
    layout[group] = value;
    localStorage.setItem('collectionLayout', JSON.stringify(layout));
    this.applyLayout(layout);
  }

  initEvents() {
    this.layoutBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.layoutGroup;
        const value = btn.dataset.layoutVal;
        this.saveLayout(group, value);
      });
    });

    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', () => {
        this.sortSelect.form.submit();
      });
    }

    if (this.sortDropdownBtn && this.sortDropdown) {
      this.sortDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sortDropdownBtn.classList.toggle('is--open');
        this.sortDropdown.classList.toggle('is--open');
      });

      document.addEventListener('click', (e) => {
        if (!this.sortDropdown.contains(e.target) && !this.sortDropdownBtn.contains(e.target)) {
          this.sortDropdownBtn.classList.remove('is--open');
          this.sortDropdown.classList.remove('is--open');
        }
      });

      if (this.sortDropdownClose) {
        this.sortDropdownClose.addEventListener('click', () => {
          this.sortDropdownBtn.classList.remove('is--open');
          this.sortDropdown.classList.remove('is--open');
        });
      }

      this.sortDropdown.querySelectorAll('[data-sortby-option]').forEach((opt) => {
        opt.addEventListener('click', () => {
          const val = opt.dataset.sortbyOption;
          const url = new URL(window.location);
          url.searchParams.set('sort_by', val);
          window.location.href = url.toString();
        });
      });
    }

    if (this.filterBtn && this.drawer) {
      this.filterBtn.addEventListener('click', () => {
        this.openDrawer();
      });

      if (this.drawerClose) {
        this.drawerClose.addEventListener('click', () => {
          this.closeDrawer();
        });
      }

      if (this.drawerOverlay) {
        this.drawerOverlay.addEventListener('click', () => {
          this.closeDrawer();
        });
      }

      if (this.drawerApply) {
        this.drawerApply.addEventListener('click', () => {
          this.submitDrawerFilters();
        });
      }

      document.addEventListener('keyup', (e) => {
        if (e.key === 'Escape' && this.drawer.classList.contains('is--open')) {
          this.closeDrawer();
        }
      });

      const drawerForm = this.drawer.querySelector('#FacetFiltersForm');
      if (drawerForm) {
        drawerForm.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.addEventListener('change', () => {
            drawerForm.requestSubmit();
          });
        });

        const priceInputs = drawerForm.querySelectorAll('.price-range input[type="number"]');
        priceInputs.forEach((input) => {
          input.addEventListener('change', () => {
            drawerForm.requestSubmit();
          });
        });
      }
    }
  }

  submitDrawerFilters() {
    const drawerForm = this.drawer.querySelector('#FacetFiltersForm');
    if (drawerForm) {
      drawerForm.requestSubmit();
    }
    this.closeDrawer();
  }

  openDrawer() {
    this.drawer.classList.add('is--open');
    this.drawerOverlay.classList.add('is--visible');
    document.body.style.overflow = 'hidden';
  }

  closeDrawer() {
    this.drawer.classList.remove('is--open');
    this.drawerOverlay.classList.remove('is--visible');
    document.body.style.overflow = '';
  }
}

customElements.define('collection-toolbar', CollectionToolbar);
