# Публикация на biruza33.ru

Проверка 02.11.2026: HTML/CSS/JS на домене совпадают с репозиторием после нормализации переносов строк. Ответы CSS и JS содержат `Cache-Control: max-age=86400`, поэтому старые версии могут оставаться в браузере сутки. Перед загрузкой GitHub Actions запускает `scripts/version-assets.cjs`: адрес каждого CSS/JS содержит хеш содержимого. Старый кэш больше не совпадает с новым адресом. Дизайн и логика магазина этим изменением не затронуты.

Сертификат Let's Encrypt YR1 прошёл проверку цепочки и имён biruza33.ru / www.biruza33.ru. Действует 02.11.2026–31.01.2027. HTTPS работает, но HTTP при проверке возвращал 200 без редиректа. SSL сам по себе не включает перенаправление.

В REG.RU / ispmanager: «Сайты» → biruza33.ru → включить «Перенаправлять HTTP-запросы в HTTPS» → сохранить. Проверить оба доменных имени.

Если панель cPanel/Plesk, добавить к существующему .htaccess, сохранив его текущие правила:

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^(www\.)?biruza33\.ru$ [NC]
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https [NC]
RewriteRule ^ https://biruza33.ru%{REQUEST_URI} [R=301,L]
```

Не заменять существующий .htaccess целиком. На nginx без Apache включить редирект в панели или настройках nginx: .htaccess там не применяется.

Источник: https://help.reg.ru/support/hosting/redirekty/redirekt-s-http-na-https-dlya-linux

После изменения ожидаются HTTP 301/308 с Location на HTTPS и HTTPS 200 без циклов переадресации. Введённый явно https://biruza33.ru уже использует действительный сертификат. Если предупреждение остаётся именно на HTTPS, проверить текст ошибки на устройстве, дату/время устройства и его доверенные корневые сертификаты.
