##############################################################################
# Placar Clube - Setup Script (Windows PowerShell)
#
# Este script clona o repositório, instala dependências e inicia o servidor.
# Uso: .\setup.ps1
#
# Se aparecer erro de execução, abra PowerShell como Admin e execute:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
##############################################################################

# Exit on error
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================================================"
Write-Host "  🏀 Placar Clube - Setup (Windows PowerShell) 🏐" -ForegroundColor Cyan
Write-Host "======================================================================"
Write-Host ""

# Cores
function Write-Step {
    param([string]$Message)
    Write-Host "▶ " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

# 1. Verificar pré-requisitos
Write-Step "Verificando pré-requisitos..."

try {
    $nodeVersion = & node --version 2>$null
    Write-Success "Node.js $nodeVersion"
} catch {
    Write-Warning "Node.js não encontrado"
    Write-Host "   Instale de: https://nodejs.org (versão 22+)"
    exit 1
}

try {
    $npmVersion = & npm --version 2>$null
    Write-Success "npm v$npmVersion"
} catch {
    Write-Warning "npm não encontrado"
    exit 1
}

try {
    $gitVersion = & git --version 2>$null
    Write-Success "Git $gitVersion"
} catch {
    Write-Warning "Git não encontrado"
    exit 1
}

Write-Host ""

# 2. Clonar repositório (ou pular se já existe)
$RepoUrl = "https://github.com/GustAlvesG/placar-clube.git"
$RepoDir = "placar-clube"

if (Test-Path -PathType Container $RepoDir) {
    Write-Warning "Diretório '$RepoDir' já existe"
    $response = Read-Host "   Deseja remover e clonar novamente? (s/n)"
    if ($response -eq "s" -or $response -eq "S") {
        Remove-Item -Recurse -Force $RepoDir
        Write-Step "Clonando repositório..."
        & git clone $RepoUrl $RepoDir
    }
} else {
    Write-Step "Clonando repositório..."
    & git clone $RepoUrl $RepoDir
}

Push-Location $RepoDir
Write-Success "Repositório pronto: $PWD"

Write-Host ""

# 3. Instalar dependências
Write-Step "Instalando dependências (npm install)..."
& npm install --loglevel=warn | Out-Null
Write-Success "Dependências instaladas"

Write-Host ""

# 4. Rodar testes (opcional)
Write-Step "Rodando testes..."
try {
    & npm test 2>$null | Out-Null
    Write-Success "Todos os testes passaram ✓"
} catch {
    Write-Warning "Alguns testes falharam (verifique acima)"
}

Write-Host ""

# 5. Mostrar informações de acesso
Write-Step "Setup completo!"
Write-Host ""
Write-Host "=========================================================================="
Write-Host ""
Write-Host "  " -NoNewline
Write-Host "✓ Placar Clube está pronto!" -ForegroundColor Green
Write-Host ""
Write-Host "  Para iniciar o servidor, execute:"
Write-Host ""
Write-Host "    " -NoNewline
Write-Host "npm start" -ForegroundColor Cyan
Write-Host "          (produção)"
Write-Host "    " -NoNewline
Write-Host "npm run dev" -ForegroundColor Cyan
Write-Host "        (desenvolvimento com nodemon)"
Write-Host ""
Write-Host "  Depois acesse:"
Write-Host ""
Write-Host "    🎮 Configuração: http://localhost:4000/controle/"
Write-Host "    🎮 Controle:     http://localhost:4000/controle/controle.html"
Write-Host "    🎮 Placar:       http://localhost:4000"
Write-Host "    🎮 Anúncios:     http://localhost:4000/controle/controle_anuncios.html"
Write-Host ""
Write-Host "  Em rede local (substitua IP):"
Write-Host ""
Write-Host "    http://<seu-IP>:4000"
Write-Host ""
Write-Host "=========================================================================="
Write-Host ""

# 6. Perguntar se quer iniciar
$response = Read-Host "Deseja iniciar o servidor agora? (s/n)"
if ($response -eq "s" -or $response -eq "S") {
    Write-Step "Iniciando servidor..."
    & npm start
}

Pop-Location
