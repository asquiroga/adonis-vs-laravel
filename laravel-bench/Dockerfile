FROM composer:2.9.2 AS vendor
WORKDIR /app
COPY . .
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --classmap-authoritative --no-scripts

FROM dunglas/frankenphp:1.13.5-php8.4-bookworm
RUN install-php-extensions pdo_pgsql pcntl opcache
WORKDIR /app
COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY docker/php.ini /usr/local/etc/php/conf.d/99-benchmark.ini
RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
EXPOSE 8080
CMD ["sh", "-c", "php artisan package:discover --ansi && php artisan config:cache && php artisan route:cache && exec php artisan octane:frankenphp --host=0.0.0.0 --port=8080 --workers=${APP_WORKERS:-4} --max-requests=${MAX_REQUESTS:-10000}"]
