// Carregador mínimo de .env — evita adicionar a dependência `dotenv` para
// duas variáveis. Nunca sobrescreve uma variável já definida no ambiente
// real (ex.: `Environment=` no unit systemd de setup.sh tem prioridade).
const fs = require('fs');
const path = require('path');

function carregarEnv(caminho = path.join(__dirname, '.env')) {
    if (!fs.existsSync(caminho)) return;
    const conteudo = fs.readFileSync(caminho, 'utf8');
    for (const linha of conteudo.split(/\r?\n/)) {
        const l = linha.trim();
        if (!l || l.startsWith('#')) continue;
        const igual = l.indexOf('=');
        if (igual === -1) continue;
        const chave = l.slice(0, igual).trim();
        let valor = l.slice(igual + 1).trim();
        if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
            valor = valor.slice(1, -1);
        }
        if (!(chave in process.env)) process.env[chave] = valor;
    }
}

module.exports = { carregarEnv };
