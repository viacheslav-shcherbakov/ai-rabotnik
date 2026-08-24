# AI-Rabotnik — статический сайт на nginx
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="AI-Rabotnik"
LABEL org.opencontainers.image.description="PWA сайт агентства цифровых ИИ-работников"

# Копируем статику
COPY . /usr/share/nginx/html

# Копируем конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Read-only ФС для статики, writable для nginx temp
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R a-w /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx /var/run

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
