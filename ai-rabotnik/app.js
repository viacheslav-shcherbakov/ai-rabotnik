/* ============================================
   AI-Rabotnik — app.js
   Минимальный JS: модалка, форма, навигация, аналитика
   ============================================ */
(function () {
  "use strict";

  /* ---- Аналитика-хелпер ---- */
  function trackEvent(action, category, label) {
    // Google Analytics 4
    if (typeof gtag === "function") {
      try { gtag("event", action, { event_category: category, event_label: label }); } catch (e) {}
    }
    // Яндекс.Метрика
    if (typeof ym === "function" && window.YM_ID) {
      try { ym(window.YM_ID, "reachGoal", action, { category: category, label: label }); } catch (e) {}
    }
    // Отладка в консоли
    if (window.console && console.debug) console.debug("[track]", action, category, label || "");
  }

  /* ---- Модалка ---- */
  var overlay = document.getElementById("modalOverlay");
  var lastFocused = null;
  var modalEl = overlay ? overlay.querySelector(".modal") : null;

  // Focus-trap: удерживаем Tab-фокус внутри диалога (WCAG 2.1.2/2.4.3)
  function trapFocus(e) {
    if (e.key !== "Tab" || !modalEl) return;
    var focusables = modalEl.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function openModal() {
    lastFocused = document.activeElement;
    if (overlay.hasAttribute("hidden")) overlay.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", trapFocus);
    var firstInput = overlay.querySelector("input, textarea");
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 100);
    trackEvent("modal_open", "engagement");
  }

  function closeModal() {
    overlay.setAttribute("hidden", "");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", trapFocus);
    if (lastFocused) lastFocused.focus();
  }

  // Делегирование: все элементы с data-open-modal открывают форму
  document.addEventListener("click", function (e) {
    var opener = e.target.closest("[data-open-modal]");
    if (opener) { e.preventDefault(); openModal(); return; }
    if (e.target === overlay) { closeModal(); return; }
    var closer = e.target.closest("[data-close-modal]");
    if (closer) { closeModal(); return; }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    // Мобильное меню имеет приоритет перед модалкой (закрываем то, что поверх)
    if (burger && mobileMenu && !mobileMenu.hasAttribute("hidden")) { closeMobileMenu(); return; }
    if (!overlay.hasAttribute("hidden")) closeModal();
  });

  /* ---- Форма: валидация + отправка ---- */
  var form = document.getElementById("leadForm");
  var formSuccess = document.getElementById("formSuccess");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var valid = true;

      // Простой email-чек
      var emailEl = document.getElementById("f-email");
      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(emailEl.value.trim())) {
        valid = false;
        emailEl.style.borderColor = "#dc2626";
      } else { emailEl.style.borderColor = ""; }

      // Проверка обязательных полей
      form.querySelectorAll("[required]").forEach(function (el) {
        if (!el.value.trim() || (el.type === "checkbox" && !el.checked)) {
          valid = false;
          if (el.type !== "checkbox") el.style.borderColor = "#dc2626";
        } else if (el.type !== "checkbox") { el.style.borderColor = ""; }
      });

      if (!valid) { trackEvent("form_validation_error", "form"); return; }

      // Сбор данных
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });

      trackEvent("form_submit", "form", data.company || "");

      // Кнопку — в состояние отправки
      var submitBtn = form.querySelector('button[type="submit"]');
      var origLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Отправляем…"; }

      // --- Отправка ---
      // Бэкенды (впишите нужный; приоритет: n8n webhook > Formspree > свой API):
      // 1) N8N_WEBHOOK_URL — webhook n8n (основной бэкенд).
      //    Создайте workflow в n8n с Webhook-триггером (POST), который принимает
      //    JSON {name, company, email, phone, task} и шлёт заявку вам (email/CRM/таблицу).
      //    Вставьте URL вида https://your-n8n.domain/webhook/airabotnik-lead
      // 2) FORMSPREE_ID — бесплатный backend без сервера (https://formspree.io).
      // 3) OWN_API — свой backend (POST /api/lead).
      // 4) Если ничего не задано — демо-режим: заявка только в localStorage браузера.
      var N8N_WEBHOOK_URL = "";   // ← вставьте URL n8n webhook (пока заглушка)
      var FORMSPREE_ID = "";       // напр. "xaybnvqp"
      var OWN_API = "";            // напр. "/api/lead"
      var endpoint = N8N_WEBHOOK_URL
        || (FORMSPREE_ID ? "https://formspree.io/f/" + FORMSPREE_ID : OWN_API);

      // Сохраняем в localStorage как дублирующий страховочный буфер (всегда)
      try {
        var leads = JSON.parse(localStorage.getItem("ai_leads") || "[]");
        leads.push(Object.assign(data, { ts: new Date().toISOString() }));
        localStorage.setItem("ai_leads", JSON.stringify(leads));
      } catch (e) {}

      function showSuccess() {
        form.style.display = "none";
        if (formSuccess) formSuccess.removeAttribute("hidden");
        trackEvent("form_success", "form");
      }
      function showError() {
        var err = document.getElementById("formError");
        if (err) err.removeAttribute("hidden");
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origLabel; }
        trackEvent("form_error", "form");
      }

      if (endpoint) {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(data)
        }).then(function (r) { r.ok ? showSuccess() : showError(); })
          .catch(showError);
      } else {
        // Демо-режим: endpoint не задан, заявка сохранена только в localStorage браузера.
        // Чтобы заявки доходили до вас — задайте FORMSPREE_ID или OWN_API выше в app.js.
        if (formSuccess) formSuccess.textContent = "Демо-режим: заявка сохранена локально в браузере. Укажите FORMSPREE_ID или OWN_API в app.js для реальной отправки на сервер.";
        setTimeout(showSuccess, 600);
      }
    });
  }

  /* ---- Мобильное меню ---- */
  var burger = document.querySelector(".burger");
  var mobileMenu = document.getElementById("mobileMenu");

  function closeMobileMenu() {
    if (mobileMenu && !mobileMenu.hasAttribute("hidden")) {
      mobileMenu.setAttribute("hidden", "");
      burger.setAttribute("aria-expanded", "false");
      // Возвращаем фокус на бургер для AT-пользователей (Escape / клик вне),
      // если фокус всё ещё внутри меню.
      if (mobileMenu.contains(document.activeElement)) burger.focus();
    }
  }

  if (burger && mobileMenu) {
    burger.addEventListener("click", function () {
      var isOpen = mobileMenu.hasAttribute("hidden");
      if (isOpen) {
        mobileMenu.removeAttribute("hidden");
        burger.setAttribute("aria-expanded", "true");
        var firstLink = mobileMenu.querySelector("a");
        if (firstLink) firstLink.focus();
      } else {
        closeMobileMenu();
      }
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMobileMenu);
    });
    // Закрытие по клику вне меню (например, по фону)
    document.addEventListener("click", function (e) {
      if (!mobileMenu.hasAttribute("hidden") &&
          !mobileMenu.contains(e.target) && !burger.contains(e.target)) {
        closeMobileMenu();
      }
    });

    // При смене ширины окна (crossing брейкпоинта) сбрасываем состояние меню,
    // иначе при открытом меню на мобильной ширине и ресайзе к десктопу
    // атрибуты hidden/aria-expanded остаются «висеть» -> бургер перестаёт
    // реагировать на клики. Минимальный debounce на resize.
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        // Если бургер больше не виден (десктоп) — гарантированно закрываем меню.
        if (getComputedStyle(burger).display === "none" && !mobileMenu.hasAttribute("hidden")) {
          closeMobileMenu();
        }
      }, 120);
    });
  }

  /* ---- Кнопка "Наверх" ---- */
  var scrollTopBtn = document.querySelector(".scroll-top");
  if (scrollTopBtn) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 600) scrollTopBtn.removeAttribute("hidden");
      else scrollTopBtn.setAttribute("hidden", "");
    }, { passive: true });
    scrollTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---- Год в футере ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Регистрация Service Worker ---- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        console.debug("[SW] registered", reg.scope);
      }).catch(function (err) {
        console.warn("[SW] failed", err);
      });
    });
  }
})();