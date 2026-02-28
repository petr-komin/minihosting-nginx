# Hostingy

Webova aplikace pro spravu webhostingu nad Nginx. Generuje konfiguracni soubory, spravuje SSL certifikaty pres Let's Encrypt a umoznuje reload Nginx primo z prohlizece.

## Co to dela

- Spravuje Nginx konfigurace pro 3 typy webu: **Reverse Proxy**, **Staticky web**, **PHP (FPM)**
- Generuje soubory do `/etc/nginx/sites-available/`, spravuje symlinky v `/etc/nginx/sites-enabled/`
- Testuje konfiguraci (`nginx -t`) a reloaduje Nginx (`nginx -s reload`)
- Generuje SSL certifikaty pres Certbot (Let's Encrypt)
- Importuje existujici Nginx konfigurace ze serveru
- Monitoring serveru (CPU, RAM, disk, load, sit, procesy)
- Jedno admin konto, heslo se nastavi pri prvnim spusteni
- Ceske UI

## Pozadavky

- **Node.js 20+**
- **Nginx** nainstalovan na hostu
- **Certbot** (volitelne, pro SSL)

## Instalace

```bash
git clone <repo-url> /opt/hostingy
cd /opt/hostingy
```

### 1. Zavislosti a build

```bash
npm install
npm run build
```

### 2. Konfigurace

```bash
cp .env.example .env
nano .env
```

Dulezite: nastavte `JWT_SECRET` na nahodny retezec a `PORT` na pozadovany port.

| Promenna | Vychozi | Popis |
|---|---|---|
| `PORT` | `3000` | Port aplikace |
| `JWT_SECRET` | — | **Zmenit!** Nahodny retezec pro JWT tokeny |
| `DB_PATH` | `server/data/hostingy.db` | Cesta k SQLite databazi |
| `NGINX_SITES_AVAILABLE` | `/etc/nginx/sites-available` | Kam se zapisuji konfigurace |
| `NGINX_SITES_ENABLED` | `/etc/nginx/sites-enabled` | Kde se spravuji symlinky |
| `NGINX_BINARY` | `/usr/sbin/nginx` | Cesta k nginx binarce |
| `CERTBOT_BINARY` | `/usr/bin/certbot` | Cesta k certbotu |
| `CERTBOT_WEBROOT` | `/var/www/certbot` | Webroot pro ACME challenge |
| `NODE_ENV` | `production` | Prostredi |

### 3. Sudo pro Nginx a Certbot

Aplikace potrebuje spoustet `nginx` a `certbot` pres sudo bez hesla:

```bash
sudo visudo -f /etc/sudoers.d/hostingy
```

Vlozit (nahradit `uzivatel` za uzivatele ktery spousti aplikaci):

```
uzivatel ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /usr/bin/certbot
```

Overit:

```bash
sudo visudo -cf /etc/sudoers.d/hostingy
```

### 4. Prava na Nginx adresare

Uzivatel musi mit pravo zapisu do `sites-available` a `sites-enabled`:

```bash
# Varianta A: vlastnictvi
sudo chown $USER /etc/nginx/sites-available
sudo chown $USER /etc/nginx/sites-enabled

# Varianta B: pres skupinu www-data
sudo usermod -aG www-data $USER
sudo chgrp www-data /etc/nginx/sites-available /etc/nginx/sites-enabled
sudo chmod g+w /etc/nginx/sites-available /etc/nginx/sites-enabled
```

### 5. Spusteni

**Primo:**

```bash
NODE_ENV=production node server/dist/index.js
```

**PM2:**

```bash
NODE_ENV=production pm2 start server/dist/index.js --name hostingy
pm2 save
pm2 startup
```

**Systemd** — vytvorit `/etc/systemd/system/hostingy.service`:

```ini
[Unit]
Description=Hostingy - Sprava webhostingu
After=network.target nginx.service

[Service]
Type=simple
User=vas-uzivatel
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

1. Otevrit `http://server:PORT` v prohlizeci
2. Zobrazi se formular pro nastaveni hesla administratora
3. V **Nastaveni** vyplnit e-mail pro Certbot (nutne pro generovani SSL)

## Nginx proxy pro Hostingy

Pro pristup pres domenu s HTTPS:

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

```bash
sudo ln -s /etc/nginx/sites-available/hostingy.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
sudo certbot --nginx -d hostingy.example.com
```

## SSL certifikaty pro spravovane weby

Certbot overuje vlastnictvi domeny pres HTTP challenge, proto je nutne:

1. Vytvorit web **bez SSL** (HTTP na portu 80)
2. Ulozit a provest **reload Nginx**
3. Overit ze `http://domena.cz` odpovida (DNS musi smerovat na server)
4. **Vygenerovat certifikat** (tlacitko v editaci webu)
5. Aplikace automaticky zapne SSL a pregeneruje konfiguraci

U importovanych webu ktere uz SSL maji se zobrazi stav "SSL je aktivni".

## Kam se co uklada

| Co | Kde |
|---|---|
| Nginx konfigurace | `/etc/nginx/sites-available/hostingy_domena_cz.conf` |
| Symlinky aktivnich webu | `/etc/nginx/sites-enabled/hostingy_domena_cz.conf` |
| SQLite databaze | `server/data/hostingy.db` (nebo dle `DB_PATH`) |
| SSL certifikaty | `/etc/letsencrypt/live/domena.cz/` (spravuje Certbot) |
| Build frontend | `client/dist/` |
| Build backend | `server/dist/` |

## Vyvoj

```bash
npm install
npm run dev
```

Spusti soucasne backend (tsx watch) a frontend (Vite dev server) s hot reload. Vite proxy smeruje `/api/*` na backend.

## Struktura

```
hostingy/
├── server/src/
│   ├── index.ts          # Express server
│   ├── config.ts         # Konfigurace z env
│   ├── db/               # SQLite + migrace
│   ├── auth/             # JWT, setup wizard
│   ├── sites/            # CRUD, Zod validace
│   ├── nginx/            # Config generator, parser, import
│   ├── ssl/              # Certbot integrace
│   ├── monitor/          # Server monitoring
│   └── settings/         # Nastaveni aplikace
├── client/src/
│   ├── views/            # Login, Dashboard, SiteEdit, Import, Monitor, ...
│   ├── stores/           # Pinia stores
│   ├── components/       # NginxPreview
│   └── api/              # Axios klient
├── examples/             # Referencni Nginx konfigurace
├── .env.example
└── package.json          # Monorepo (npm workspaces)
```
