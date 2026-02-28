# Hostingy

Webova aplikace pro spravu webhostingu nad Nginx. Generuje konfiguracni soubory, spravuje SSL certifikaty pres Let's Encrypt a umoznuje reload Nginx primo z prohlizece.

## Co to dela

- Spravuje Nginx konfigurace pro 3 typy webu: **Reverse Proxy**, **Staticky web**, **PHP (FPM)**
- Generuje soubory do `/etc/nginx/sites-available/`, spravuje symlinky v `/etc/nginx/sites-enabled/`
- Testuje konfiguraci (`nginx -t`) a reloaduje Nginx (`nginx -s reload`)
- Generuje SSL certifikaty pres Certbot (Let's Encrypt)
- Jedno admin konto, heslo se nastavi pri prvnim spusteni

## Pozadavky

- **Node.js 20+** (nebo 22+)
- **Nginx** nainstalovan na hostu
- **Certbot** (volitelne, pro SSL) — `sudo apt install certbot python3-certbot-nginx`

## Instalace

```bash
git clone <repo-url> /opt/hostingy
cd /opt/hostingy
./install.sh
```

Skript nainstaluje zavislosti, zbuilduje frontend i backend, a nabidne automaticke nastaveni sudo.

### Rucni instalace

```bash
npm install
npm run build
```

## Nastaveni sudo

Hostingy potrebuje spoustet prikazy `nginx` a `certbot` pres sudo bez hesla. Instalacni skript to nabidne automaticky, ale lze nastavit i rucne:

```bash
sudo visudo -f /etc/sudoers.d/hostingy
```

Vlozit (nahradit `uzivatel` za skutecne jmeno uzivatele ktery spousti aplikaci):

```
uzivatel ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /usr/bin/certbot
```

Overit platnost:

```bash
sudo visudo -cf /etc/sudoers.d/hostingy
```

### Co presne sudo pouziva

| Prikaz | Ucel |
|---|---|
| `sudo nginx -t` | Test konfigurace pred reloadem |
| `sudo nginx -s reload` | Reload Nginx |
| `sudo certbot certonly --nginx ...` | Generovani SSL certifikatu |
| `sudo certbot certonly --webroot ...` | Alternativni metoda generovani SSL |
| `sudo certbot renew ...` | Obnova certifikatu |
| `sudo certbot certificates ...` | Info o certifikatu |

## Konfigurace (.env)

Zkopirujte `.env.example` do `.env` a upravte:

```bash
cp .env.example .env
```

| Promenna | Vychozi | Popis |
|---|---|---|
| `PORT` | `3000` | Port aplikace |
| `JWT_SECRET` | — | **Zmenit v produkci!** Nahodny retezec pro JWT tokeny |
| `DB_PATH` | `server/data/hostingy.db` | Cesta k SQLite databazi |
| `NGINX_SITES_AVAILABLE` | `/etc/nginx/sites-available` | Kam se zapisuji konfigurace |
| `NGINX_SITES_ENABLED` | `/etc/nginx/sites-enabled` | Kde se spravuji symlinky |
| `NGINX_BINARY` | `/usr/sbin/nginx` | Cesta k nginx binarce |
| `CERTBOT_BINARY` | `/usr/bin/certbot` | Cesta k certbotu |
| `CERTBOT_WEBROOT` | `/var/www/certbot` | Webroot pro ACME challenge |
| `NODE_ENV` | `production` | Prostredi |

## Spusteni

### Primo

```bash
NODE_ENV=production node server/dist/index.js
```

### PM2

```bash
pm2 start server/dist/index.js --name hostingy
pm2 save
pm2 startup
```

### Systemd

Vytvorit `/etc/systemd/system/hostingy.service`:

```ini
[Unit]
Description=Hostingy - Sprava webhostingu
After=network.target nginx.service

[Service]
Type=simple
User=manx
WorkingDirectory=/opt/hostingy
ExecStart=/usr/bin/node server/dist/index.js
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=JWT_SECRET=vas-tajny-klic
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable hostingy
sudo systemctl start hostingy
```

## Prvni spusteni

1. Otevrit `http://server:3000` v prohlizeci (nebo `https://hostingy.example.com` pokud mate Nginx proxy)
2. Zobrazi se formular pro nastaveni hesla administratora
3. Po nastaveni hesla se zobrazi prihlasovaci obrazovka
4. V **Nastaveni** vyplnit e-mail pro Certbot (nutne pro generovani SSL)

## Nginx proxy pro Hostingy

Hostingy bezi na portu 3000 (Express servíruje API i frontend). Pro pristup pres doménu s HTTPS vytvorte Nginx konfiguraci:

```bash
sudo nano /etc/nginx/sites-available/hostingy.conf
```

```nginx
server {
    server_name hostingy.example.com;

    listen 80;
    listen [::]:80;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktivovat a reloadnout:

```bash
sudo ln -s /etc/nginx/sites-available/hostingy.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo nginx -s reload
```

Pak pridat SSL pres Certbot:

```bash
sudo certbot --nginx -d hostingy.example.com
```

Certbot automaticky upravi konfiguraci na HTTPS a prida redirect z HTTP.

> **Poznamka:** Tato konfigurace je pro pristup k samotne Hostingy aplikaci.
> Konfigurace pro spravovane weby (ty co vytvarite v Hostingy) se generuji automaticky do `/etc/nginx/sites-available/hostingy_*.conf`.

## Jak funguje generovani SSL certifikatu

Certbot potrebuje overit vlastnictvi domeny pres HTTP challenge. Proto je nutne dodrzet poradi:

1. Vytvorit web **bez SSL** (ciste HTTP na portu 80)
2. Ulozit a provest **reload Nginx**
3. Overit ze `http://domena.cz` odpovida (DNS musi smerovat na server)
4. Teprve pak **vygenerovat certifikat** (tlacitko v editaci webu)
5. Aplikace automaticky zapne SSL a pregeneruje konfiguraci na HTTPS

Tlacitko pro generovani certifikatu je v UI zablokovane dokud neni HTTP konfigurace aktivni.

## Kam se co uklada

| Co | Kde |
|---|---|
| Nginx konfigurace | `/etc/nginx/sites-available/hostingy_domena_cz.conf` |
| Symlinky aktivnich webu | `/etc/nginx/sites-enabled/hostingy_domena_cz.conf` |
| SQLite databaze | `server/data/hostingy.db` (nebo dle `DB_PATH`) |
| SSL certifikaty | `/etc/letsencrypt/live/domena.cz/` (spravuje Certbot) |
| Build frontend | `client/dist/` |
| Build backend | `server/dist/` |

## Opravneni na slozky

Uzivatel ktery spousti Hostingy musi mit pravo zapisu do:

```bash
# Nginx konfigurace
sudo chown $USER /etc/nginx/sites-available
sudo chown $USER /etc/nginx/sites-enabled

# Nebo specificke soubory
sudo chown $USER /etc/nginx/sites-available/hostingy_*
sudo chown $USER /etc/nginx/sites-enabled/hostingy_*
```

Alternativne lze konfiguraci zapisovat pres skupinu `www-data`:

```bash
sudo usermod -aG www-data $USER
sudo chgrp www-data /etc/nginx/sites-available /etc/nginx/sites-enabled
sudo chmod g+w /etc/nginx/sites-available /etc/nginx/sites-enabled
```

## Vyvoj

```bash
npm install
npm run dev
```

Spusti soucasne backend (tsx watch, port 3000) a frontend (Vite dev server, port 5173) s hot reload. Vite proxy smeruje `/api/*` na backend.

## Struktura projektu

```
hostingy/
├── server/                 # Express.js backend (TypeScript)
│   └── src/
│       ├── index.ts        # Hlavni vstup, Express server
│       ├── config.ts       # Konfigurace z env promennych
│       ├── db/             # SQLite databaze + migrace
│       ├── auth/           # JWT autentizace, setup wizard
│       ├── sites/          # CRUD pro weby, Zod validace
│       ├── nginx/          # Generovani konfiguraci, reload
│       ├── ssl/            # Certbot integrace
│       └── settings/       # Nastaveni aplikace
├── client/                 # Vue 3 SPA frontend
│   └── src/
│       ├── views/          # Stranky (Login, Dashboard, SiteEdit, ...)
│       ├── stores/         # Pinia stores
│       ├── components/     # NginxPreview aj.
│       └── api/            # Axios klient
├── examples/               # Referencni Nginx konfigurace
├── install.sh              # Instalacni skript
├── .env.example            # Vzor konfigurace
└── package.json            # Monorepo s workspaces
```
