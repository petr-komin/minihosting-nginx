#!/bin/bash
# Hostingy - aktualizace z Git repozitáře
# Spouští se přímo na serveru v adresáři s naklonovaným repem.
# Stáhne poslední verzi z main, buildne a restartuje přes PM2.
set -e

APP_NAME="hostingy"
BRANCH="main"

echo "=== Hostingy - Git Update ==="
echo ""

# --- Kontrola prerekvizit ---

if ! command -v git &> /dev/null; then
    echo "CHYBA: git není nainstalován."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "CHYBA: Node.js není nainstalován."
    echo "Nainstalujte Node.js 18+ z https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "CHYBA: Vyžadována Node.js 18+, nalezena verze $(node -v)"
    exit 1
fi

if [ ! -d ".git" ]; then
    echo "CHYBA: Tento adresář není git repozitář."
    echo "Nejprve naklonujte repo:"
    echo "  git clone https://github.com/petr-komin/minihosting-nginx.git"
    exit 1
fi

echo "  Node.js $(node -v) OK"
echo ""

# --- [1/5] Git pull ---
echo "[1/5] Stahování poslední verze z origin/${BRANCH}..."

# Kontrola lokálních změn
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo "  VAROVÁNÍ: Máte lokální změny. Provádím stash..."
    git stash
    GIT_STASHED=1
fi

git pull origin "$BRANCH" 2>&1 | tail -5
echo "  Git pull OK"

# --- [2/5] Instalace závislostí (včetně dev pro build) ---
echo "[2/5] Instalace závislostí..."
npm install 2>&1 | tail -3
echo "  npm install OK"

# --- [3/5] Build ---
echo "[3/5] Build (client + server)..."
npm run build 2>&1 | tail -5
echo "  Build OK"

# --- [4/5] .env kontrola ---
echo "[4/5] Kontrola konfigurace..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "  POZOR: Vytvořen .env z .env.example"
        echo "  Upravte minimálně JWT_SECRET a PORT!"
    else
        echo "  VAROVÁNÍ: .env.example nenalezen, .env nebyl vytvořen."
    fi
else
    echo "  .env existuje OK"
fi

# --- [5/5] PM2 restart ---
echo "[5/5] Restart aplikace..."
if command -v pm2 &> /dev/null; then
    if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
        echo "  Restart ${APP_NAME}..."
        pm2 restart "$APP_NAME" --update-env
    else
        echo "  Start ${APP_NAME}..."
        NODE_ENV=production pm2 start server/dist/index.js --name "$APP_NAME"
    fi
    pm2 save
    echo ""
    echo "  Stav:"
    pm2 status "$APP_NAME"
else
    echo "  PM2 není nainstalován. Spusťte aplikaci ručně:"
    echo "    NODE_ENV=production node server/dist/index.js"
    echo ""
    echo "  Nebo nainstalujte PM2:"
    echo "    npm install -g pm2"
    echo "    NODE_ENV=production pm2 start server/dist/index.js --name ${APP_NAME}"
fi

# --- Obnovení stashnutých změn ---
if [ "${GIT_STASHED:-0}" = "1" ]; then
    echo ""
    echo "  Obnovuji vaše lokální změny (git stash pop)..."
    git stash pop || echo "  VAROVÁNÍ: Nepodařilo se obnovit stash. Použijte 'git stash list'."
fi

# --- Systémové požadavky (jen info) ---
echo ""
echo "=== Kontrola systému ==="

MISSING=0

if command -v nginx &> /dev/null; then
    echo "  [OK] Nginx: $(nginx -v 2>&1)"
else
    echo "  [!!] Nginx není nainstalován:"
    echo "       sudo apt install nginx"
    MISSING=1
fi

if command -v certbot &> /dev/null; then
    echo "  [OK] Certbot: $(certbot --version 2>&1)"
else
    echo "  [!!] Certbot není nainstalován (volitelné, pro SSL):"
    echo "       sudo apt install certbot python3-certbot-nginx"
    MISSING=1
fi

SUDOERS_FILE="/etc/sudoers.d/hostingy"
if [ -f "$SUDOERS_FILE" ]; then
    echo "  [OK] Sudoers: $SUDOERS_FILE"
else
    CURRENT_USER=$(whoami)
    NGINX_BIN=$(which nginx 2>/dev/null || echo "/usr/sbin/nginx")
    CERTBOT_BIN=$(which certbot 2>/dev/null || echo "/usr/bin/certbot")
    echo "  [!!] Sudoers soubor chybí: $SUDOERS_FILE"
    echo "       Vytvořte ho:"
    echo "         sudo visudo -f $SUDOERS_FILE"
    echo "       S obsahem:"
    echo "         ${CURRENT_USER} ALL=(ALL) NOPASSWD: ${NGINX_BIN}, ${CERTBOT_BIN}"
    MISSING=1
fi

echo ""
if [ "$MISSING" -eq 1 ]; then
    echo "  Vyřešte výše uvedené položky pro plnou funkčnost."
    echo ""
fi

echo "=== Aktualizace dokončena ==="
