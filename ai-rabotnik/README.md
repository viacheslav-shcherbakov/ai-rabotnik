# AI-Rabotnik — PWA сайт агентства цифровых ИИ-работников

Одностраничный PWA-сайт агентства по разработке цифровых работников на базе ИИ.
Семантическая HTML-разметка, SEO/LLM-готовность, структурированные данные (JSON-LD),
аналитика (GA4 + Яндекс.Метрика), форма захвата заявок в модальном окне.

## Структура

```
ai-rabotnik/
├── index.html          # Главная (hero, услуги, процесс, кейсы, отзывы, FAQ, CTA, footer)
├── privacy.html        # Политика конфиденциальности (152-ФЗ)
├── offer.html          # Договор-оферта
├── styles.css          # Стили (Notion-like: монохром + фиолетовый акцент)
├── app.js              # Минимальный JS: модалка, форма, навигация, аналитика
├── manifest.json       # PWA-манифест
├── sw.js               # Service Worker (offline-first)
├── robots.txt          # Доступ для ботов (Google, Yandex, GPTBot, ClaudeBot, ...)
├── sitemap.xml         # Карта сайта
└── assets/
    └── icons/          # favicon.svg, icon-192/512.png, maskable-512.png
```

## Запуск локально

```bash
cd ai-rabotnik
python3 -m http.server 8000
# открыть http://localhost:8000
```

## Деплой

Статика раздаётся любым хостингом: Netlify, Vercel, GitHub Pages, Cloudflare Pages,
обычный nginx/Apache. Для PWA обязателен HTTPS.

### Netlify (быстро)
1. Залейте папку `ai-rabotnik/` в репозиторий.
2. Connect repo → build: нет → publish dir: `ai-rabotnik`.
3. Привяжите домен ai-rabotnik.ru.

### nginx
```nginx
server {
  listen 443 ssl http2;
  server_name ai-rabotnik.ru;
  root /var/www/ai-rabotnik;
  index index.html;
  gzip on; gzip_types text/css application/javascript application/json;
  location ~* \.(css|js|png|svg|json)$ { expires 30d; }
}
```

## Перед production — что заменить

### 1. Идентификаторы аналитики
В `index.html` замените заглушки на реальные ID:

| Заглушка          | Что вставить                          |
|-------------------|----------------------------------------|
| `G-XXXXXXXXXX`    | ID потока Google Analytics 4          |
| `XXXXXXXX`        | ID счётчика Яндекс.Метрики            |

### 2. Бэкенд формы заявок
В `app.js`, в обработчике `form.submit`, замените имитацию на реальную отправку:

```js
fetch("/api/lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
}).then(r => r.ok ? r.json() : Promise.reject(r))
  .then(() => { /* успех */ })
  .catch(() => { /* ошибка — показываем сообщение */ });
```

Альтернативы без backend: Google Forms, Formspree, Getform, Tilda-форма,
webhook в Telegram-бот или Telegram-канал, AmoCRM/Bitrix24 webhook.

### 3. Параметры инфо-полей
В `index.html` и-footer-adnoise укажите реальные:
- `hello@ai-rabotnik.ru` → ваш email
- `+7 (495) 000-00-00` → телефон
- ИНН/ОГРН → реальные реквизиты (если юр.лицо оформлено)
- ссылки в `sameAs` / footer на реальные соцсети

### 4. Домен в canonical / og:url / sitemap
Замените `https://ai-rabotnik.ru/` на ваш домен во всех файлах.

## SEO-готовность

- Семантические теги: `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<address>`
- JSON-LD: Organization, ProfessionalService (с оценкой), FAQPage
- Open Graph + Twitter Card
- robots.txt с доступом для ИИ-ботов (GPTBot, ChatGPT-User, ClaudeBot, Claude-Web, PerplexityBot, Bytespider)
- sitemap.xml
- canonical URL
- meta description/keywords
- `lang="ru"`, корректная иерархия заголовков H1 → H2 → H3

## PWA-готовность

- manifest.json с иконками (192, 512, maskable)
- Service Worker (cache-first для статики, network-first для навигации)
- theme-color
- `apple-touch-icon`
- installable на десктопе и мобильных

## Сборка фавиконов (если иконки нужно перегенерить)

```bash
# Требуется Pillow
python3 -c "
from PIL import Image
# ... см. скрипт генерации в истории проекта
"
```

## Лицензия

Код проекта — proprietary (AGENCY-internal). Перед использованием как коммерческого
шаблона согласуйте с правообладателем.
