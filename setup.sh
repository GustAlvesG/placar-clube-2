#!/bin/bash

##############################################################################
# Placar Clube - Setup Script (Linux)
#
# IMPORTANTE: rode sem sudo — o script pede sudo só quando necessário.
#   bash setup.sh
#
# O que este script faz:
#   1. Verifica pré-requisitos (node, npm, git)
#   2. Clona o repositório na primeira vez, ou faz git pull nas seguintes
#   3. Instala as dependências de produção
#   4. Registra e ativa um serviço systemd para rodar ao boot
##############################################################################

set -e

REPO_URL="https://github.com/GustAlvesG/placar-clube.git"
REPO_DIR="placar-clube"
SERVICE_NAME="placar-clube"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step()    { echo -e "${BLUE}▶${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1"; }

echo "======================================================================"
echo "  Placar Clube - Setup (Linux)"
echo "======================================================================"
echo ""

# --------------------------------------------------------------------------
# Garantir que o script NÃO está rodando como root diretamente
# (root não tem PATH do node via nvm, e git recusa repos de outro dono)
# --------------------------------------------------------------------------
if [ "$EUID" -eq 0 ]; then
    print_error "Não rode este script com sudo ou como root."
    echo "    Use apenas:  bash setup.sh"
    echo "    O script pedirá sudo somente onde precisar."
    exit 1
fi

# --------------------------------------------------------------------------
# 1. Verificar pré-requisitos
# --------------------------------------------------------------------------
print_step "Verificando pré-requisitos..."

if ! command -v node &> /dev/null; then
    print_error "Node.js não encontrado. Instale com:"
    echo "    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
    exit 1
fi
print_success "Node.js $(node --version)"

if ! command -v npm &> /dev/null; then
    print_error "npm não encontrado"
    exit 1
fi
print_success "npm $(npm --version)"

if ! command -v git &> /dev/null; then
    print_error "Git não encontrado. Instale com: sudo apt-get install -y git"
    exit 1
fi
print_success "Git $(git --version | cut -d' ' -f3)"

if ! command -v systemctl &> /dev/null; then
    print_error "systemd não encontrado — este script requer Linux com systemd."
    exit 1
fi
print_success "systemd detectado"

echo ""

# --------------------------------------------------------------------------
# 2. Clonar ou atualizar o repositório
# --------------------------------------------------------------------------
if [ -d "$REPO_DIR/.git" ]; then
    print_step "Repositório já existe — atualizando via git pull..."
    cd "$REPO_DIR"
    git pull
    print_success "Código atualizado: $(pwd)"
else
    print_step "Clonando repositório..."
    git clone "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
    print_success "Repositório clonado: $(pwd)"
fi

APP_DIR="$(pwd)"

echo ""

# --------------------------------------------------------------------------
# 3. Instalar dependências de produção
# --------------------------------------------------------------------------
print_step "Instalando dependências (npm install --omit=dev)..."
npm install --omit=dev --loglevel=warn
print_success "Dependências instaladas"

echo ""

# --------------------------------------------------------------------------
# 4. Criar e ativar serviço systemd  (único bloco que usa sudo)
# --------------------------------------------------------------------------
print_step "Configurando serviço systemd '${SERVICE_NAME}' (requer sudo)..."

NODE_BIN="$(which node)"
APP_USER="$USER"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Placar Clube - Servidor de Placar Esportivo
Documentation=https://github.com/GustAlvesG/placar-clube
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"

print_success "Serviço registrado em: ${SERVICE_FILE}"
print_success "Serviço habilitado para iniciar com o sistema"

echo ""

# --------------------------------------------------------------------------
# 5. Resultado final
# --------------------------------------------------------------------------
sleep 1
STATUS=$(systemctl is-active "${SERVICE_NAME}" 2>/dev/null || echo "unknown")
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<seu-IP>")

echo "=========================================================================="
echo ""

if [ "$STATUS" = "active" ]; then
    echo -e "  ${GREEN}✓ Placar Clube está rodando!${NC}"
else
    echo -e "  ${YELLOW}⚠ Status do serviço: ${STATUS}${NC}"
    echo "    Verifique os logs: sudo journalctl -u ${SERVICE_NAME} -n 30"
fi

echo ""
echo "  Acesse na rede local:"
echo ""
echo "    Telão (placar):  http://${LOCAL_IP}:4000"
echo "    Controle:        http://${LOCAL_IP}:4000/controle/"
echo "    Anúncios:        http://${LOCAL_IP}:4000/controle/controle_anuncios.html"
echo ""
echo "  Comandos úteis:"
echo ""
echo "    systemctl status  ${SERVICE_NAME}      # ver estado"
echo "    sudo systemctl restart ${SERVICE_NAME} # reiniciar"
echo "    journalctl -u ${SERVICE_NAME} -f       # acompanhar logs ao vivo"
echo ""
echo "  Para atualizar o código no futuro:"
echo "    bash setup.sh   (faz git pull + reinicia o serviço automaticamente)"
echo ""
echo "=========================================================================="
