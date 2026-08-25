# План выпуска ИИ-продавца (Саша) — MVP на базе n8n (v2: self-host, приватно)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** За 3–4 недели выпустить первого рабочего ИИ-работника «Саша-продавец» на базе n8n, который квалифицирует лиды и ведёт продажи через 3 канала (Telegram, сайт-виджет, email) — **полностью self-host, данные не покидают контур**.

**Architecture (self-host, приватно):**
- **LLM:** локальный **Ollama** (qwen2.5:14b или llama3.1:8b) на том же сервере → `http://localhost:11434/api/chat`. Данные не уходят к third-party.
- **CRM:** **наша БД** (Postgres или SQLite) + собственный REST API (FastAPI/Flask) на том же сервере. n8n ходит в API, а не в SaaS.
- **n8n:** оркестратор. Webhook (сайт) + Telegram Trigger + Email Trigger → Ollama (квалификация/скоринг/персонализация, JSON-mode) → Router → БД через API + ответы клиенту.
- **Апрув:** hot-лиды (score>=70) → уведомление менеджеру + статус `pending_approval`; реальное действие (звонок/письмо) только после апрува менеджером (кнопка в Telegram/нотификации).

**Tech Stack:** n8n (self-host via docker-compose), Ollama (локальный LLM), Postgres/SQLite + FastAPI (наш API), Telegram Bot API, SMTP, веб-хук на сайте. Сервер: 1 VPS/Docker-host с GPU или CPU (для Ollama — CPU ок, медленнее).

**Источники требований:**
- Линейка ролей с сайта (`index.html` #roles): Саша-продавец — «генерация лидов, персонализированные предложения, автоматизация продаж»; метрики: +40% конверсия, 24/7, ∞ лидов.
- `PRODUCT_BACKLOG.md` R0/R1: лид-форма → n8n webhook (A1 заглушка в app.js), нужна аналитика воронки.
- White space (Competitor Intelligence): прозрачность, кластерная упаковка, живые аватары.
- **Решения Product Lead:** LLM=Ollama (приватно), CRM=наша БД+API, hot-лиды=апрув менеджером.

---

## Календарный план (горизонт: 3–4 недели, 1 разработчик + Product Lead)

### Неделя 1 — Self-host фундамент (блокирует всё)

**Task 1.0: Развернуть self-host стек (n8n + Ollama + БД + API)**
- Objective: Все сервисы крутятся локально, данные не покидают контур.
- Files: Modify `docker-compose.yml` (добавить ollama, postgres, api-service), Create `api/main.py`, `api/requirements.txt`, `.env.example`.
- Step 1: В `docker-compose.yml` добавить сервисы: `ollama` (image ollama/ollama, port 11434), `postgres` (или volume для sqlite), `api` (наш FastAPI).
- Step 2: `docker compose up -d`, проверить, что n8n отвечает на :5678, Ollama на :11434.
- Step 3: `olama pull qwen2.5:14b` (или llama3.1:8b при слабом сервере).
- Step 4: Commit `docker-compose.yml` + `api/`.

**Task 1.1: Наш API + БД (легкая CRM)**
- Objective: Единое хранилище лидов со статусом, доступное n8n.
- Files: Create `api/main.py` (FastAPI), `api/db.py` (Postgres/SQLite через SQLAlchemy), `api/models.py` (Lead: id, ts, channel, name, company, email, phone, task, score, segment, status, approved_by).
- Step 1: Модель Lead + эндпоинты: POST /leads (создать), PATCH /leads/{id} (статус/апрув), GET /leads (список/метрики).
- Step 2: Миграция (SQLAlchemy create_all или alembic).
- Step 3: Проверить curl: POST /leads → 200, GET /leads возвращает запись.
- Step 4: Commit.

**Task 1.2: n8n webhook + запись в нашу БД через API**
- Objective: Лид с сайта доходит до БД.
- Files: Modify `app.js` (`N8N_WEBHOOK_URL`), Create `n8n/workflows/ai-sales-lead-ingest.json`.
- Step 1: В n8n Webhook (POST /airabotnik-lead) → HTTP Request POST `http://api:8000/leads`.
- Step 2: Вписать webhook URL в `app.js`.
- Step 3: Тест: заявка с сайта → запись в БД.
- Step 4: Commit (закрыть A1 в `PRODUCT_BACKLOG.md`).

**Task 1.3: Ollama-узел квалификации (скоринг)**
- Objective: Автооценка лида 0–100, JSON strict.
- Files: Create `n8n/workflows/ai-sales-score.json`, `docs/SCORING_PROMPT.md`.
- Step 1: HTTP Request → `http://ollama:11434/api/chat` с `format: json`, промпт: {company, task, email} → {score, segment, reason}.
- Step 2: Проверить на 5 лидах: скоринг осмыслен (B2B высокий, спам низкий).
- Step 3: Commit.

### Неделя 2 — Каналы (Telegram + Email) + Апрув

**Task 2.1: Telegram-бот «Саша»**
- Objective: Квалификация в чате → БД + скоринг.
- Files: Create `n8n/workflows/ai-sales-telegram.json`, `docs/TELEGRAM_SETUP.md`.
- Step 1: @BotFather token → n8n Credentials (только в n8n, не в репо).
- Step 2: Telegram Trigger → цепочка 3 вопросов (сфера, бюджет, срок) → Ollama скоринг → POST /leads.
- Step 3: Commit.

**Task 2.2: Email-канал (персонализированные предложения)**
- Objective: Авто-письмо после квалификации (для warm/cold — авто; hot — после апрува).
- Files: Create `n8n/workflows/ai-sales-email.json`, `docs/EMAIL_TEMPLATES.md`.
- Step 1: SMTP в n8n Credentials.
- Step 2: Ollama генерирует письмо по шаблону (сегмент, боль) → Send Email (только если status != pending_approval для hot).
- Step 3: Commit.

**Task 2.3: Router + Апрув hot-лидов**
- Objective: hot (>=70) → менеджеру на апрув; warm/cold → авто.
- Files: Modify `ai-sales-lead-ingest.json` (Switch + апрув-цепь).
- Step 1: Switch по score. hot → Telegram-уведомление менеджеру с кнопками «✅ Апрув» / «❌ Отклонить» + статус `pending_approval` в БД.
- Step 2: Кнопка апрува → PATCH /leads/{id} (status=approved) → триггерит отправку письма/звонок.
- Step 3: Проверить: hot лид НЕ уходит в авто-письмо до апрува.
- Step 4: Commit.

### Неделя 3 — Связка с сайтом, аналитика, безопасность

**Task 3.1: Сайт-виджет → ответ клиенту**
- Objective: Замкнуть петлю сайт→n8n→БД→ответ.
- Files: Modify `app.js` (после успеха — «Саша свяжется...»), `index.html` (микро-копирайт).
- Step 1: После `showSuccess()` текст: «ИИ-продавец Саша свяжется в Telegram/на почте в течение минуты».
- Step 2: Сквозной тест.
- Step 3: Commit.

**Task 3.2: Аналитика воронки (из нашей БД)**
- Objective: Видеть конверсию по каналам (R0 бэклога).
- Files: Create `n8n/workflows/ai-sales-metrics.json` или endpoint `GET /metrics` в API, `docs/METRICS.md`.
- Step 1: Ежедневный подсчёт: лиды по каналам, hot/warm/cold, апрувнутые, дошедшие до ответа.
- Step 2: Вывод в Notion/дашборд (опц.) или просто API.
- Step 3: Commit.

**Task 3.3: Безопасность (приватность — ключевое преимущество)**
- Objective: Данные не покидают контур; PII защищены.
- Files: `docs/SECURITY.md`, `docker-compose.yml` (сети, нет внешнего LLM).
- Step 1: Ollama и БД — только внутренняя сеть Docker (не публиковать порты наружу).
- Step 2: Токены бота/SMTP — только в n8n Credentials (не в репо, `.env.example` без секретов).
- Step 3: Чекбокс согласия в форме (добавить в `index.html` + валидация в app.js).
- Step 4: Rate-limit webhook + honeypot-поле.
- Step 5: Commit (docs + конфиг).

### Неделя 4 — Pilot + релиз

**Task 4.1: Пилот (1–2 клиента, сжато 3–4 дня)**
- Objective: Замерить реальную конверсию, собрать фидбек.
- Files: `docs/PILOT_REPORT.md`.
- Step 1: Запуск на трафике, 20–50 лидов.
- Step 2: Проверить +40% конверсии (цель с сайта), работу апрува.
- Step 3: Фикс критических косяков.

**Task 4.2: Релиз MVP**
- Objective: Саша объявлена рабочим ИИ-работником (self-host).
- Files: Update `README.md`, `MAINTENANCE.md`, Create `AGENTS_CATALOG.md`, `DEPLOY.md` (как поднять стек).
- Step 1: Сайт #roles Саша: «работает на self-host n8n + Ollama», метрика пилота.
- Step 2: Финальный коммит + тег `v1-sales-mvp`.
- Step 3: Push `main`.

---

## Метрики успеха MVP
- Доставка лидов из 3 каналов в БД = 100% (self-host).
- Скоринг Ollama согласуется с ручной оценкой ≥75% (локальная модель слабее — порог ниже, чем для OpenAI).
- Время ответа: hot <1 мин (после апрува), warm <1 час.
- Конверсия лид→встреча +40% (цель с сайта).
- **Приватность:** 0 обращений к внешним LLM/CRM (данные в контуре).

## Риски и tradeoffs
- **R1:** Ollama слабее OpenAI → mitigation: qwen2.5:14b (достаточно для скоринга/коротких писем), strict JSON-mode, промпты с примерами.
- **R2:** Сервер/VPS стоит денег + Ollama ест CPU → mitigation: VPS 4-8 vCPU, модель 8b при слабом железе; n8n/Ollama/БД в одном docker-compose.
- **R3:** Спам через webhook → rate-limit + honeypot + капча (опц.).
- **R4:** Апрув-цепь ломается → fallback: если менеджер не ответил 24ч, лид уходит в warm-авто (настраиваемо).

## Решения (зафиксированы)
- ✅ LLM: **Ollama** (локально, приватно)
- ✅ CRM: **наша БД + API** (Postgres/SQLite + FastAPI)
- ✅ Апрув: **hot-лиды → менеджеру на апрув** перед действием

## Файлы, которые изменятся
- `docker-compose.yml` (добавить ollama, postgres, api)
- `api/main.py`, `api/db.py`, `api/models.py`, `api/requirements.txt` (новые)
- `app.js` (webhook URL + копирайт + чекбокс согласия), `index.html` (чекбокс + микро-копирайт)
- `PRODUCT_BACKLOG.md` (A1 → done)
- `README.md`, `MAINTENANCE.md`, `AGENTS_CATALOG.md` (новый), `DEPLOY.md` (новый)
- `n8n/workflows/*.json` (новые: lead-ingest, score, telegram, email, metrics)
- `docs/*.md` (SCORING_PROMPT, TELEGRAM_SETUP, EMAIL_TEMPLATES, METRICS, SECURITY, PILOT_REPORT)
