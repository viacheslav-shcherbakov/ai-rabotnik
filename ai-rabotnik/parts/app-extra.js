/* ============================================
   AI-Rabotnik — parts/app-extra.js
   Дополнительные фичи PWA:
     1) Прогресс-бар скролла
     2) Чат-виджет (localStorage, безопасный textContent — без XSS)
     3) Счётчики (IntersectionObserver)
     4) Dropdown-навигация (решения)
   Чистый vanilla JS, без зависимостей и CDN.
   НЕ конфликтует с app.js (модалка, бургер, scroll-top,
   обработчик data-open-modal уже там).
   ============================================ */
(function () {
  "use strict";

  // Запуск после полной готовности DOM. defer гарантирует порядок,
  // но DOMContentLoaded делает код устойчивым при любом способе подключения.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    initProgressBar();
    initChatWidget();
    initCounters();
    initDropdownNav();
  }

  /* ============================================
     1) ПРОГРЕСС-БАР СКРОЛЛА
     Элемент #progressBar внутри .progress-bar.
     Ширина = scrollTop / (scrollHeight - clientHeight) * 100.
     Throttle через requestAnimationFrame.
     ============================================ */
  function initProgressBar() {
    var bar = document.getElementById("progressBar");
    if (!bar) return; // разметки нет — молча выходим

    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var scrollTop = window.scrollY || doc.scrollTop || 0;
      var scrollHeight = doc.scrollHeight || 0;
      var clientHeight = doc.clientHeight || 0;
      var denom = scrollHeight - clientHeight;
      var progress = denom > 0 ? (scrollTop / denom) * 100 : 0;
      if (progress < 0) progress = 0;
      if (progress > 100) progress = 100;
      bar.style.width = progress + "%";
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        // requestAnimationFrame — мягкий throttle: не чаще одного
        // пересчёта за кадр анимации.
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update(); // начальное состояние (на случай релоада не вверху)
  }

  /* ============================================
     2) ЧАТ-ВИДЖЕТ
     #chatToggle, #chatWindow, #chatClose, #chatForm,
     #chatInput, #chatMessages.

     Защита от XSS: пользовательский ввод попадает в DOM
     ТОЛЬКО через textContent (ни одного innerHTML с данными).
     История хранится в localStorage (ключ 'airabotnik_chat')
     как массив {role, text}; при загрузке восстанавливается.
     ============================================ */
  function initChatWidget() {
    var toggle = document.getElementById("chatToggle");
    var win = document.getElementById("chatWindow");
    var closeBtn = document.getElementById("chatClose");
    var form = document.getElementById("chatForm");
    var input = document.getElementById("chatInput");
    var messages = document.getElementById("chatMessages");
    if (!toggle || !win || !messages) return; // нет разметки — выходим

    var STORAGE_KEY = "airabotnik_chat";
    var BOT_REPLY = "Спасибо! Наш менеджер свяжется с вами. Или оставьте заявку через форму.";

    // --- Безопасное создание сообщения (без innerHTML) ---
    function appendMessage(role, text) {
      var msg = document.createElement("div");
      msg.className = "msg " + (role === "bot" ? "msg-bot" : "msg-user");
      // textContent экранирует всё автоматически — никакого XSS.
      msg.textContent = text;
      messages.appendChild(msg);
      scrollToBottom();
      return msg;
    }

    function scrollToBottom() {
      messages.scrollTop = messages.scrollHeight;
    }

    // --- Работа с localStorage ---
    function loadHistory() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    }

    function saveHistory(list) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch (e) {
        /* квота переполнена / приватный режим — игнорируем */
      }
    }

    // Восстановление истории при загрузке (только текст).
    var history = loadHistory();
    history.forEach(function (item) {
      if (item && typeof item.text === "string") {
        appendMessage(item.role === "bot" ? "bot" : "user", item.text);
      }
    });

    // --- Показать / скрыть окно ---
    function openChat() {
      win.removeAttribute("hidden");
      toggle.setAttribute("aria-expanded", "true");
      if (input) setTimeout(function () { input.focus(); }, 50);
    }

    function closeChat() {
      win.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", "false");
      // НЕ очищаем историю при закрытии (по ТЗ).
    }

    toggle.addEventListener("click", function () {
      if (win.hasAttribute("hidden")) openChat();
      else closeChat();
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", closeChat);
    }

    // --- Отправка сообщения ---
    if (form && input) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (text === "") return; // пустой ввод — ничего не делаем

        // Добавляем сообщение пользователя и сохраняем.
        appendMessage("user", text);
        history.push({ role: "user", text: text });
        saveHistory(history);

        input.value = ""; // очистка поля

        // Имитация ответа бота с небольшой задержкой.
        setTimeout(function () {
          appendMessage("bot", BOT_REPLY);
          history.push({ role: "bot", text: BOT_REPLY });
          saveHistory(history);
        }, 600);
      });
    }

    // ESC закрывает чат, если открыт (дружелюбно к клавиатуре).
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !win.hasAttribute("hidden")) {
        closeChat();
      }
    });

    // Адаптация под мобильные (innerWidth < 480): CSS уже делает окно
    // на всю ширину через media query — ничего не ломаем, просто
    // принудительно пересчитываем высоту при ресайзе, если открыто.
    window.addEventListener("resize", function () {
      if (!win.hasAttribute("hidden")) scrollToBottom();
    }, { passive: true });
  }

  /* ============================================
     3) СЧЁТЧИКИ (.counter[data-value])
     При попадании в viewport анимируем от 0 до целевого
     значения за ~1.5s. Используем IntersectionObserver
     с threshold 0.5; после срабатывания unobserve.
     Если data-value не задан — берём число из textContent.
     ============================================ */
  function initCounters() {
    var counters = document.querySelectorAll(".counter");
    if (!counters.length) return;

    function getTarget(el) {
      var dv = el.getAttribute("data-value");
      var n = parseInt(dv !== null ? dv : el.textContent, 10);
      return isNaN(n) ? 0 : n;
    }

    function animate(el, target) {
      if (el.dataset.counted === "1") return; // защита от повторного запуска
      el.dataset.counted = "1";

      var duration = 1500; // ~1.5s
      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var elapsed = ts - start;
        var t = Math.min(elapsed / duration, 1);
        // easeOutCubic для плавного затухания
        var eased = 1 - Math.pow(1 - t, 3);
        var current = Math.round(eased * target);
        el.textContent = current;
        if (t < 1) {
          window.requestAnimationFrame(step);
        } else {
          el.textContent = target; // гарантируем точный финал
        }
      }
      window.requestAnimationFrame(step);
    }

    // Устойчивость: IntersectionObserver поддерживается всеми целевыми
    // браузерами; если вдруг нет — анимируем сразу как fallback.
    if (!("IntersectionObserver" in window)) {
      counters.forEach(function (el) { animate(el, getTarget(el)); });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target, getTarget(entry.target));
          obs.unobserve(entry.target); // больше не следим
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });
  }

  /* ============================================
     4) DROPDOWN В НАВИГАЦИИ (.nav-dropdown-toggle + .nav-dropdown)
     По клику/фокусу показываем-скрываем связанный dropdown,
     переключая aria-expanded. Разметку делает оркестратор —
     код устойчив к отсутствию элементов (null-safe).
     ============================================ */
  function initDropdownNav() {
    var toggles = document.querySelectorAll(".nav-dropdown-toggle");
    if (!toggles.length) return;

    toggles.forEach(function (toggle) {
      // Связанный dropdown ищем по id из aria-controls, иначе по соседству.
      var dropdown = null;
      var controls = toggle.getAttribute("aria-controls");
      if (controls) dropdown = document.getElementById(controls);
      if (!dropdown) {
        dropdown = toggle.parentElement
          ? toggle.parentElement.querySelector(".nav-dropdown")
          : null;
      }
      if (!dropdown) return; // нет цели — ничего не вешаем

      // aria-expanded по умолчанию false, если не задан.
      if (!toggle.hasAttribute("aria-expanded")) {
        toggle.setAttribute("aria-expanded", "false");
      }

      function isOpen() {
        return toggle.getAttribute("aria-expanded") === "true";
      }

      function show() {
        dropdown.removeAttribute("hidden");
        toggle.setAttribute("aria-expanded", "true");
      }

      function hide() {
        dropdown.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
      }

      // Клик по переключателю.
      toggle.addEventListener("click", function (e) {
        e.preventDefault();
        isOpen() ? hide() : show();
      });

      // Показ по фокусу (клавиатура / таб) — дружелюбно к AT.
      toggle.addEventListener("focus", function () { show(); });

      // Закрытие при уходе фокуса из зоны dropdown (мышь/таб дальше).
      dropdown.addEventListener("mouseleave", function () { hide(); });
      toggle.addEventListener("blur", function (e) {
        // Закрываем, только если фокус ушёл вне зоны toggle+dropdown.
        var next = e.relatedTarget;
        if (next && (next === dropdown || dropdown.contains(next) ||
                     next === toggle || toggle.contains(next))) {
          return;
        }
        hide();
      });

      // Клик вне dropdown закрывает его (как у бургер-меню).
      document.addEventListener("click", function (e) {
        if (!dropdown.contains(e.target) && !toggle.contains(e.target)) {
          hide();
        }
      });
    });
  }

  /* ============================================
     5) КНОПКИ pricing с data-open-modal
     Обработчик data-open-modal УЖЕ реализован в app.js
     (делегирование клика). Здесь НЕ вешаем свой обработчик —
     не дублируем. Этот блок оставлен как явный маркер того,
     что за поведение pricing отвечает app.js.
     ============================================ */
  // (намеренно пусто — см. комментарий выше)
})();
