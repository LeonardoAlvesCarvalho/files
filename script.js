/**
 * Doceria & Bolos — script.js
 * Versão refatorada: bugs corrigidos, sem memory leaks, código limpo
 */

'use strict';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CONFIG = Object.freeze({
  STORAGE_KEY: 'doceria_cart_v3',
  WHATSAPP_NUMBER: '5521985201649',
  CURRENCY: 'BRL',
  LOCALE: 'pt-BR',
  TOAST_DURATION: 3000,
});

// ============================================================
// DADOS DOS PRODUTOS
// ============================================================

const PRODUCTS = Object.freeze([
  {
    id: 1,
    name: 'Bolo Personalizado',
    category: 'Bolo',
    description: 'Bolo decorado com recheio cremoso e acabamento elegante.',
    price: 79.90,
    emoji: '🎂',
  },
  {
    id: 2,
    name: 'Cupcake de Baunilha',
    category: 'Cupcake',
    description: 'Cupcake macio com cobertura de butter cream e confeitos.',
    price: 5.00,
    emoji: '🧁',
  },
  {
    id: 3,
    name: 'Cupcake Triplo Chocolate',
    category: 'Cupcake',
    description: 'Intenso cupcake de chocolate com recheio gourmet.',
    price: 6.00,
    emoji: '🍫',
  },
  {
    id: 4,
    name: 'Biscoito de Chocolate',
    category: 'Doce',
    description: 'Biscoito crocante com pedaços de chocolate belga.',
    price: 25.00,
    emoji: '🍪',
  },
  {
    id: 5,
    name: 'Brigadeiro Gourmet',
    category: 'Doce',
    description: 'Brigadeiro artesanal com chocolate premium e decoração especial.',
    price: 30.00,
    emoji: '🍬',
  },
  {
    id: 6,
    name: 'Pavê de Chocolate',
    category: 'Doce',
    description: 'Pavê cremoso com camadas de biscoito e ganache.',
    price: 35.00,
    emoji: '🍮',
  },
  {
    id: 7,
    name: 'Mousse de Frutas Vermelhas',
    category: 'Doce',
    description: 'Mousse leve com frutas vermelhas frescas e cobertura suave.',
    price: 28.00,
    emoji: '🍓',
  },
  {
    id: 8,
    name: 'Torta de Limão',
    category: 'Torta',
    description: 'Torta refrescante com creme de limão siciliano.',
    price: 45.00,
    emoji: '🥧',
  },
]);

// ============================================================
// UTILITÁRIOS
// ============================================================

/** Formata valor como moeda BRL */
const formatCurrency = (value) =>
  new Intl.NumberFormat(CONFIG.LOCALE, { style: 'currency', currency: CONFIG.CURRENCY }).format(value);

/** Formata Date como DD/MM/YYYY */
const formatDate = (dateString) => {
  if (!dateString) return '';
  // Evita bug de timezone: new Date('YYYY-MM-DD') interpreta como UTC
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

/** Retorna data e hora atual formatada */
const formatDateTime = () =>
  new Date().toLocaleString(CONFIG.LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/** Valida se string não está vazia */
const isNotEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

/** Valida data: deve ser no formato YYYY-MM-DD e não pode ser anterior a hoje */
const isValidFutureDate = (dateStr) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const selected = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected >= today;
};

/** Escapa HTML para prevenir XSS em templates de string */
const escapeHtml = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// ============================================================
// MÓDULO: CARRINHO
// ============================================================

const Cart = (() => {
  let items = [];

  /** Carrega do localStorage com fallback seguro */
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }
  }

  /** Persiste no localStorage */
  function save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('[Cart] Erro ao salvar:', err);
    }
  }

  function getItems() { return items; }

  function getTotal() {
    return items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }

  function getItemCount() {
    return items.reduce((acc, item) => acc + item.quantity, 0);
  }

  function add(productId) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;

    const existing = items.find((i) => i.id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, quantity: 1 });
    }

    save();
    UI.renderCart();
    UI.updateCartBadge();
    Toast.show(`${product.name} adicionado ao carrinho 🛒`);
  }

  function updateQuantity(id, delta) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
      remove(id);
      return;
    }

    save();
    UI.renderCart();
    UI.updateCartBadge();
  }

  function remove(id) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;

    const name = items[idx].name;
    items.splice(idx, 1);
    save();
    UI.renderCart();
    UI.updateCartBadge();
    Toast.show(`${name} removido do carrinho`);
  }

  function clear() {
    items = [];
    save();
    UI.renderCart();
    UI.updateCartBadge();
  }

  return { load, getItems, getTotal, getItemCount, add, updateQuantity, remove, clear };
})();

// ============================================================
// MÓDULO: TOAST
// ============================================================

const Toast = (() => {
  let timer = null;
  let el = null;

  function init() {
    el = document.getElementById('toastMessage');
  }

  function show(message, type = 'success') {
    if (!el) return;
    clearTimeout(timer);

    el.textContent = message;
    el.className = `toast ${type === 'error' ? 'error' : ''}`;

    // Força reflow para reiniciar animação
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');

    timer = setTimeout(() => el.classList.remove('show'), CONFIG.TOAST_DURATION);
  }

  return { init, show };
})();

// ============================================================
// MÓDULO: UI
// ============================================================

const UI = (() => {
  // Cache de elementos DOM (obtidos uma única vez)
  const els = {};

  function cacheElements() {
    const ids = [
      'cartDrawer', 'cartBackdrop', 'cartItems', 'cartTotal', 'cartCount',
      'checkoutButton', 'openCartButton', 'openCartButtonHero', 'closeCartButton',
      'continueShoppingButton', 'filterButtons', 'productGrid',
      'checkoutModal', 'checkoutModalBackdrop', 'closeCheckoutModal',
      'cancelCheckout', 'confirmCheckout', 'checkoutForm',
      'orderSummary', 'modalTotal', 'currentYear',
    ];
    ids.forEach((id) => { els[id] = document.getElementById(id); });
  }

  // ---- Filtros & Produtos --------------------------------

  function renderFilters() {
    const categories = ['Todos', ...new Set(PRODUCTS.map((p) => p.category))];
    els.filterButtons.innerHTML = categories
      .map(
        (cat) => `<button class="filter-btn${cat === 'Todos' ? ' active' : ''}"
          data-category="${escapeHtml(cat)}"
          aria-pressed="${cat === 'Todos'}">${escapeHtml(cat)}</button>`
      )
      .join('');
  }

  function renderProductGrid(list = PRODUCTS) {
    if (list.length === 0) {
      els.productGrid.innerHTML = '<p style="color:var(--clr-text-muted);padding:2rem">Nenhum produto nesta categoria.</p>';
      return;
    }

    els.productGrid.innerHTML = list
      .map(
        (p) => `
      <article class="product-card" role="listitem">
        <div class="product-image" aria-hidden="true">${p.emoji}</div>
        <div class="product-info">
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-description">${escapeHtml(p.description)}</p>
          <div class="product-footer">
            <span class="product-price">${formatCurrency(p.price)}</span>
            <button class="btn btn-primary btn-small add-to-cart-btn"
              data-product-id="${p.id}"
              aria-label="Adicionar ${escapeHtml(p.name)} ao carrinho">
              + Adicionar
            </button>
          </div>
        </div>
      </article>`
      )
      .join('');
  }

  function filterProducts(category) {
    const filtered = category === 'Todos' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category);
    renderProductGrid(filtered);

    // Atualiza estado dos botões de filtro
    els.filterButtons.querySelectorAll('.filter-btn').forEach((btn) => {
      const isActive = btn.dataset.category === category;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  // ---- Carrinho ------------------------------------------

  function renderCart() {
    const items = Cart.getItems();
    const isEmpty = items.length === 0;

    if (isEmpty) {
      els.cartItems.innerHTML = `
        <div class="empty-cart" role="listitem">
          <span class="empty-icon" aria-hidden="true">🛒</span>
          <p>Seu carrinho está vazio.</p>
          <p>Adicione alguns doces deliciosos!</p>
        </div>`;
    } else {
      els.cartItems.innerHTML = items
        .map(
          (item) => `
        <div class="cart-item" role="listitem">
          <div class="cart-item-top">
            <div class="cart-item-emoji" aria-hidden="true">${item.emoji}</div>
            <div class="cart-item-info">
              <h4 class="cart-item-name">${escapeHtml(item.name)}</h4>
              <span class="cart-item-price">${formatCurrency(item.price)} / un.</span>
            </div>
            <button class="remove-button"
              data-action="remove" data-id="${item.id}"
              aria-label="Remover ${escapeHtml(item.name)} do carrinho">×</button>
          </div>
          <div class="cart-item-controls">
            <div class="quantity-controls" role="group" aria-label="Quantidade de ${escapeHtml(item.name)}">
              <button class="quantity-btn" data-action="decrease" data-id="${item.id}" aria-label="Diminuir quantidade">−</button>
              <span class="quantity-value" aria-live="polite">${item.quantity}</span>
              <button class="quantity-btn" data-action="increase" data-id="${item.id}" aria-label="Aumentar quantidade">+</button>
            </div>
            <span class="item-total">${formatCurrency(item.quantity * item.price)}</span>
          </div>
        </div>`
        )
        .join('');
    }

    els.cartTotal.textContent = formatCurrency(Cart.getTotal());
    els.checkoutButton.disabled = isEmpty;
    els.checkoutButton.setAttribute('aria-disabled', String(isEmpty));
  }

  function updateCartBadge() {
    const count = Cart.getItemCount();
    els.cartCount.textContent = count;
    els.cartCount.classList.toggle('visible', count > 0);
  }

  // ---- Drawer Carrinho -----------------------------------

  function openCart() {
    els.cartDrawer.classList.add('open');
    els.cartBackdrop.classList.remove('aria-hidden');
    els.cartDrawer.setAttribute('aria-hidden', 'false');
    els.cartBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    els.closeCartButton.focus();
  }

  function closeCart() {
    els.cartDrawer.classList.remove('open');
    els.cartDrawer.setAttribute('aria-hidden', 'true');
    els.cartBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    els.openCartButton.focus();
  }

  // ---- Modal Checkout ------------------------------------

  function openCheckoutModal() {
    if (Cart.getItems().length === 0) {
      Toast.show('Adicione produtos ao carrinho primeiro', 'error');
      return;
    }

    renderOrderSummary();

    els.checkoutModalBackdrop.classList.add('open');
    els.checkoutModal.classList.add('open');
    els.checkoutModalBackdrop.setAttribute('aria-hidden', 'false');
    els.checkoutModal.setAttribute('aria-hidden', 'false');

    document.body.style.overflow = 'hidden';
    els.closeCheckoutModal.focus();

    // Inicializa estado do botão de confirmar
    updateConfirmButtonState();
  }

  function closeCheckoutModal() {
    els.checkoutModalBackdrop.classList.remove('open');
    els.checkoutModal.classList.remove('open');
    els.checkoutModalBackdrop.setAttribute('aria-hidden', 'true');
    els.checkoutModal.setAttribute('aria-hidden', 'true');

    document.body.style.overflow = '';

    els.checkoutForm.reset();
    clearFormErrors();

    // Remove estados de loading se houver
    els.confirmCheckout.classList.remove('is-loading');
    els.confirmCheckout.disabled = true;
    els.confirmCheckout.setAttribute('aria-disabled', 'true');
  }

  function renderOrderSummary() {
    els.orderSummary.innerHTML = Cart.getItems()
      .map(
        (item) => `
      <div class="order-item">
        <div class="item-info">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-quantity">Qtd: ${item.quantity}</span>
        </div>
        <span class="item-price">${formatCurrency(item.quantity * item.price)}</span>
      </div>`
      )
      .join('');

    els.modalTotal.textContent = formatCurrency(Cart.getTotal());
  }

  // ---- Validação -----------------------------------------

  function showFieldError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const fieldEl = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = message;
    if (fieldEl) fieldEl.classList.add('invalid');
  }

  function clearFormErrors() {
    document.querySelectorAll('.error-message').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach((el) =>
      el.classList.remove('invalid')
    );
  }

  function validateForm() {
    clearFormErrors();
    let valid = true;

    const fields = [
      { id: 'customerName', label: 'Nome é obrigatório' },
      { id: 'street', label: 'Rua é obrigatória' },
      { id: 'number', label: 'Número é obrigatório' },
      { id: 'neighborhood', label: 'Bairro é obrigatório' },
    ];

    fields.forEach(({ id, label }) => {
      const el = document.getElementById(id);
      if (!el || !isNotEmpty(el.value)) {
        showFieldError(id, label);
        valid = false;
      }
    });

    const deliveryEl = document.getElementById('deliveryTime');
    if (!deliveryEl.value) {
      showFieldError('deliveryTime', 'Data é obrigatória');
      valid = false;
    } else if (!isValidFutureDate(deliveryEl.value)) {
      showFieldError('deliveryTime', 'Data inválida ou anterior a hoje');
      valid = false;
    }

    const paymentEl = document.getElementById('paymentMethod');
    if (!paymentEl.value) {
      showFieldError('paymentMethod', 'Forma de pagamento é obrigatória');
      valid = false;
    }

    return valid;
  }

  function updateConfirmButtonState() {
    // Habilita o botão somente se os campos obrigatórios principais estiverem preenchidos
    const requiredIds = ['customerName', 'street', 'number', 'neighborhood', 'deliveryTime', 'paymentMethod'];
    const allFilled = requiredIds.every((id) => {
      const el = document.getElementById(id);
      return el && el.value.trim().length > 0;
    });

    els.confirmCheckout.disabled = !allFilled;
    els.confirmCheckout.setAttribute('aria-disabled', String(!allFilled));
  }

  // ---- WhatsApp ------------------------------------------

  function processCheckout() {
    if (!validateForm()) {
      Toast.show('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    // Loading state
    els.confirmCheckout.classList.add('is-loading');
    els.confirmCheckout.disabled = true;

    // BUG CORRIGIDO: a variável `address` era declarada com `const` mas depois
    // tentava ser reatribuída com +=, causando TypeError silencioso.
    // Agora construída corretamente.
    const getValue = (id) => document.getElementById(id)?.value.trim() ?? '';

    setTimeout(() => {
      const streetLine = `${getValue('street')}, ${getValue('number')}`;
      const complement = getValue('complement');
      const reference = getValue('reference');
      const neighborhood = getValue('neighborhood');

      const addressLines = [streetLine];
      if (complement) addressLines.push(complement);
      addressLines.push(`Bairro: ${neighborhood}`);
      if (reference) addressLines.push(`Referência: ${reference}`);

      const paymentLabels = {
        pix: '💳 Pix',
        dinheiro: '💵 Dinheiro',
        cartao: '💳 Cartão',
      };

      const itemsList = Cart.getItems()
        .map((i) => `  • ${i.quantity}x ${i.name} — ${formatCurrency(i.quantity * i.price)}`)
        .join('\n');

      const notes = getValue('notes');

      const message = [
        'Olá! Gostaria de fazer um pedido 🍭',
        '',
        '🛒 *Itens do Pedido:*',
        itemsList,
        '',
        `💰 *Total:* ${formatCurrency(Cart.getTotal())}`,
        '',
        `👤 *Cliente:* ${getValue('customerName')}`,
        '',
        '📍 *Endereço de Entrega:*',
        addressLines.join('\n'),
        '',
        `📅 *Data desejada:* ${formatDate(getValue('deliveryTime'))}`,
        `💳 *Pagamento:* ${paymentLabels[getValue('paymentMethod')] ?? getValue('paymentMethod')}`,
        notes ? `\n📝 *Observações:* ${notes}` : '',
        '',
        `🕐 Pedido feito em: ${formatDateTime()}`,
      ]
        .filter((line) => line !== null)
        .join('\n');

      const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

      closeCheckoutModal();
      closeCart();
      Cart.clear();

      window.open(url, '_blank', 'noopener,noreferrer');
      Toast.show('Pedido enviado! Confirme no WhatsApp 🎉');
    }, 1200);
  }

  // ---- Footer -----------------------------------------------

  function setCurrentYear() {
    if (els.currentYear) els.currentYear.textContent = new Date().getFullYear();
  }

  // ---- Eventos ------------------------------------------

  function setupEvents() {
    // Carrinho
    els.openCartButton.addEventListener('click', openCart);
    els.openCartButtonHero?.addEventListener('click', openCart);
    els.closeCartButton.addEventListener('click', closeCart);
    els.cartBackdrop.addEventListener('click', closeCart);
    els.continueShoppingButton.addEventListener('click', () => {
      closeCart();
      document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
    });
    els.checkoutButton.addEventListener('click', openCheckoutModal);

    // DELEGAÇÃO de eventos do carrinho (sem re-registrar ao re-renderizar — MEMORY LEAK corrigido)
    els.cartItems.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn) return;

      const id = parseInt(btn.dataset.id, 10);
      const action = btn.dataset.action;

      if (action === 'remove') Cart.remove(id);
      else if (action === 'increase') Cart.updateQuantity(id, +1);
      else if (action === 'decrease') Cart.updateQuantity(id, -1);
    });

    // DELEGAÇÃO de eventos dos produtos (sem re-registrar ao re-renderizar — MEMORY LEAK corrigido)
    els.productGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-to-cart-btn');
      if (!btn) return;
      Cart.add(parseInt(btn.dataset.productId, 10));
    });

    // Filtros (delegação)
    els.filterButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filterProducts(btn.dataset.category);
    });

    // Modal Checkout
    els.closeCheckoutModal.addEventListener('click', closeCheckoutModal);
    els.cancelCheckout.addEventListener('click', closeCheckoutModal);
    els.checkoutModalBackdrop.addEventListener('click', closeCheckoutModal);
    els.confirmCheckout.addEventListener('click', processCheckout);

    // Validação em tempo real no formulário
    els.checkoutForm.addEventListener('input', () => {
      // Limpa erro do campo específico que mudou
      const focused = document.activeElement;
      if (focused) {
        const errEl = document.getElementById(`${focused.id}Error`);
        if (errEl) errEl.textContent = '';
        focused.classList.remove('invalid');
      }
      updateConfirmButtonState();
    });

    // ESC para fechar overlays
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (els.checkoutModal.classList.contains('open')) closeCheckoutModal();
      else if (els.cartDrawer.classList.contains('open')) closeCart();
    });
  }

  function init() {
    cacheElements();
    renderFilters();
    renderProductGrid();
    renderCart();
    updateCartBadge();
    setupEvents();
    setCurrentYear();
  }

  return { init, renderCart, updateCartBadge };
})();

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  Cart.load();
  UI.init();
});
