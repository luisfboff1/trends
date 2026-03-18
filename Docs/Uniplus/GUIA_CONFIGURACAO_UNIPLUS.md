# Guia de Configuração — Integração UniPlus API

> **Objetivo**: Passo a passo para configurar o acesso à API do UniPlus na Trends.  
> Leve este guia quando for presencialmente configurar a integração.  
> **A primeira coisa a descobrir é se usam Desktop ou Web** — isso muda toda a arquitetura.

---

## Pré-requisitos

- [ ] Acesso ao computador onde o UniPlus Desktop está instalado
- [ ] Acesso como administrador no UniPlus
- [ ] Notebook/celular com Insomnia ou Postman instalado (para testar na hora)
- [ ] Acesso à rede local onde o UniPlus está rodando

---

## PARTE 0: Perguntas Críticas (ANTES de tudo)

Estas perguntas definem toda a arquitetura da integração. Faça-as **primeiro**.

### 0.1 — Desktop ou Web?

- [ ] **A Trends usa UniPlus Desktop, UniPlus Web, ou ambos?**

| Resposta | Impacto |
|----------|---------|
| **UniPlus Web** (cloud, GetTI/Amazon) | Integração direta — a API tem URL pública, funciona de qualquer lugar. Sem infra extra. |
| **UniPlus Desktop** (local, Yoda) | Precisa de um **sync agent** rodando no PC da Trends — a Vercel não acessa rede local. |
| **Ambos** | Usar o Web de preferência. |

> **Por que importa?** O Trends roda na Vercel (cloud). Se o UniPlus for só Desktop, o servidor da Vercel NÃO consegue acessar `192.168.x.x` — é rede privada. Cada sync precisa acessar a API ao vivo, não é configuração única.

### 0.2 — Se só Desktop

- [ ] **Tem um PC que fica ligado o dia todo?** (para rodar o sync agent)
- [ ] **Esse PC tem acesso à internet?** (precisa conectar ao banco Neon PostgreSQL)
- [ ] **O Yoda já está habilitado e rodando?**

### 0.3 — Se Web

- [ ] **Qual a URL da instância?** (ex: `https://trends.intelidata.inf.br`)
- [ ] **Qual o nome da conta/tenant?** (ex: `trends`)
- [ ] **Já geraram a chave de API?** (menu Ferramentas → Configuração da API)
- [ ] Anotar a **chave de acesso** gerada

### 0.4 — Dados gerais

- [ ] **Quantos clientes existem no UniPlus?** `_____`
- [ ] **Quantos produtos existem no UniPlus?** `_____`
- [ ] **Versão do UniPlus**: `_____`
- [ ] **Têm interesse em migrar para UniPlus Web?** (se for só Desktop)

---

## Parte 1: Verificar o Servidor Yoda

O **Yoda** é o servidor HTTP embutido no UniPlus Desktop que expõe a API REST. Ele roda na **porta 8443** com certificado auto-assinado (self-signed).

### 1.1 — Confirmar que o Yoda está rodando

1. No computador do UniPlus, abra o **UniPlus Desktop**
2. Verifique se o ícone do Yoda aparece na bandeja do sistema (system tray)
3. Se não estiver rodando, iniciar o serviço Yoda (normalmente inicia junto com o UniPlus)

> **IMPORTANTE**: O UniPlus Web **NÃO** pode estar rodando na mesma porta (8443).  
> Se ambos estiverem na mesma máquina, um deles não vai funcionar.

### 1.2 — Anotar o IP do servidor

1. No computador do UniPlus, abra o **Prompt de Comando** (CMD)
2. Digite: `ipconfig`
3. Anote o **IPv4 Address** da placa de rede principal (ex: `192.168.1.100`)
4. O endereço completo do servidor será: `https://{IP}:8443`

**Exemplo**: `https://192.168.1.100:8443`

> Se o Trends rodar na mesma máquina que o UniPlus, pode usar `https://localhost:8443`

### 1.3 — Testar acesso à porta

Do computador onde o Trends vai rodar (ou do seu notebook na mesma rede):

```bash
# Testar se a porta está acessível (PowerShell)
Test-NetConnection -ComputerName 192.168.1.100 -Port 8443
```

Se `TcpTestSucceeded` retornar **True**, a porta está aberta. Se **False**:
- Verificar firewall do Windows no computador do UniPlus
- Adicionar regra de entrada para porta 8443 (TCP)
- Verificar se não há firewall de rede bloqueando

---

## Parte 2: Dados de Autenticação

Para o UniPlus **Desktop (Yoda)**, os dados de autenticação são **fixos** (não há conceito de "conta"/tenant):

| Dado | Valor |
|------|-------|
| **Auth Code (Basic)** | `dW5pcGx1czpsNGd0cjFjazJyc3ByM25nY2wzZW50` |
| **Porta** | `8443` |
| **Protocolo** | `HTTPS` (certificado self-signed) |
| **Grant Type** | `client_credentials` |

> O auth code acima é Base64 de `uniplus:l4gtr1ck2rspr3ngcl3ent` — é padrão para todas as instalações Desktop/Yoda.

---

## Parte 3: Testar a Conexão (Na hora, presencialmente)

### 3.1 — Gerar Token via cURL

Abra o CMD/PowerShell **no computador do UniPlus** e execute:

```bash
curl -k -X POST ^
  -H "Authorization: Basic dW5pcGx1czpsNGd0cjFjazJyc3ByM25nY2wzZW50" ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -d "grant_type=client_credentials" ^
  "https://localhost:8443/oauth/token"
```

**Resposta esperada** (JSON):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3599,
  "scope": "public-api",
  "jti": "abc123..."
}
```

Se receber erro:
- `Connection refused` → Yoda não está rodando
- `SSL certificate problem` → usar `-k` para ignorar certificado self-signed
- `401 Unauthorized` → auth code incorreto (não deveria acontecer no Desktop)

### 3.2 — Testar um GET de Entidades

Com o token obtido no passo anterior:

```bash
curl -k ^
  -H "Authorization: Bearer SEU_TOKEN_AQUI" ^
  -H "Content-Type: application/json" ^
  "https://localhost:8443/public-api/v1/entidades?limit=5"
```

**Resposta esperada**: Lista JSON com até 5 entidades (clientes/fornecedores).

### 3.3 — Testar de outro computador na rede

Repita os testes acima substituindo `localhost` pelo **IP do servidor** (ex: `192.168.1.100`):

```bash
curl -k -X POST ^
  -H "Authorization: Basic dW5pcGx1czpsNGd0cjFjazJyc3ByM25nY2wzZW50" ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -d "grant_type=client_credentials" ^
  "https://192.168.1.100:8443/oauth/token"
```

Se funcionar local mas não funcionar remotamente → problema de **firewall**.

### 3.4 — Testar via Insomnia (alternativa visual)

1. Abra o **Insomnia** → criar novo Projeto → criar Request Collection
2. Criar nova **Request POST** para gerar token:
   - URL: `https://192.168.1.100:8443/oauth/token`
   - Auth: selecionar **OAuth 2.0**
     - Grant Type: `Client Credentials`
     - Access Token URL: `https://192.168.1.100:8443/oauth/token`
     - Client ID: `uniplus`
     - Client Secret: `l4gtr1ck2rspr3ngcl3ent`
   - Clicar "Fetch Tokens"
3. Criar nova **Request GET** para testar dados:
   - URL: `https://192.168.1.100:8443/public-api/v1/entidades?limit=5`
   - Auth: Bearer Token (colar o token gerado)
   - Desabilitar validação de certificado SSL nas configurações do Insomnia

---

## Parte 4: Checklist de Informações para Anotar

Ao sair da visita presencial, você deve ter anotado:

### Perguntas críticas (Parte 0)
- [ ] **Desktop, Web, ou ambos?**: `_____` ← MAIS IMPORTANTE
- [ ] Se Web: **URL da instância**: `_____`
- [ ] Se Web: **Conta/tenant**: `_____`
- [ ] Se Web: **Chave de API gerada**: `_____`
- [ ] Se Desktop: **PC fica ligado o dia todo?**: Sim / Não
- [ ] Se Desktop: **PC tem internet?**: Sim / Não
- [ ] **Interesse em migrar para Web?**: Sim / Não

### Dados técnicos
- [ ] **IP do servidor UniPlus**: `_____._____._____._____ `
- [ ] **Porta**: `8443` (padrão, confirmar)
- [ ] **Yoda rodando?**: Sim / Não
- [ ] **Porta acessível de outro PC na rede?**: Sim / Não (se não, firewall)
- [ ] **Token gerado com sucesso?**: Sim / Não
- [ ] **GET entidades retornou dados?**: Sim / Não

### Dados de negócio
- [ ] **Quantos clientes existem no UniPlus?**: `_____` (para referência na sync)
- [ ] **Quantos produtos existem no UniPlus?**: `_____`
- [ ] **Versão do UniPlus**: `_____`
- [ ] **O UniPlus fica ligado 24h ou só em horário comercial?**: `_____`

---

## Parte 5: Configuração de Rede / Firewall (se necessário)

Se o Trends rodar em um servidor diferente (ou na nuvem com VPN), será necessário garantir que a porta 8443 está acessível.

### Windows Firewall — Adicionar regra

No computador do UniPlus (onde o Yoda roda):

1. Abrir **Windows Defender Firewall com Segurança Avançada**
2. **Regras de Entrada** → **Nova Regra**
3. Tipo: **Porta**
4. TCP, porta específica: **8443**
5. Ação: **Permitir a conexão**
6. Perfil: marcar **Domínio** e **Privado** (NÃO marcar Público por segurança)
7. Nome: `UniPlus Yoda API`

### Se o Trends estiver na nuvem (Vercel) — Desktop Only

O UniPlus Desktop roda em rede local. A Vercel **não consegue** acessar IPs privados (`192.168.x.x`). A solução é um **sync agent local**:

1. Um script Node.js rodando no PC da Trends (na mesma rede do Yoda)
2. O agent acessa o Yoda em `https://localhost:8443`
3. O agent escreve direto no Neon PostgreSQL (mesma connection string do Doppler)
4. O Trends (Vercel) lê os dados já sincronizados do Neon

> **Se tiverem UniPlus Web**: nada disso é necessário — a URL é pública e a Vercel acessa diretamente.

---

## Parte 6: Configuração no App Trends

### Se UniPlus Web (cenário ideal)

1. **Server URL**: a URL da instância (ex: `https://trends.intelidata.inf.br`)
2. **Auth Code**: a chave gerada em Ferramentas → Configuração da API
3. **Conta**: o tenant/conta do cliente
4. Clicar **"Testar Conexão"** → deve retornar sucesso
5. Clicar **"Salvar"**
6. Clicar **"Sincronizar Tudo"** para fazer a primeira importação

### Se UniPlus Desktop Only

1. Instalar o **sync agent** no PC da Trends (ver instruções no plan.md)
2. Configurar a connection string do Neon no agent
3. Configurar o IP do Yoda no agent: `https://localhost:8443` (ou IP da rede)
4. Rodar o agent → ele importa os dados para o Neon
5. No Trends, os dados já aparecem nas páginas (clientes, produtos, etc.)

---

## Troubleshooting

| Problema | Causa provável | Solução |
|----------|---------------|---------|
| `Connection refused` | Yoda não está rodando | Iniciar o Yoda no UniPlus Desktop |
| `Connection timed out` | Firewall bloqueando | Adicionar regra para porta 8443 |
| `SSL certificate error` | Certificado self-signed | Normal — app usa `rejectUnauthorized: false` |
| `401 Unauthorized` | Token expirado ou inválido | Gerar novo token (expira em 60 min) |
| `422 Unprocessable Entity` | Dados inválidos no POST/PUT | Verificar JSON enviado, campos obrigatórios |
| Lista vazia de entidades | Não há dados no UniPlus | Verificar se há clientes cadastrados no UniPlus |
| Porta 8443 ocupada | UniPlus Web usando a mesma porta | Parar o UniPlus Web ou mudar a porta |

---

## Links de Referência

- [API Uniplus – Comece por aqui](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/api-uniplus-comece-por-aqui)
- [Testando Comunicação via API](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/testando-comunicacao-via-api)
- [Endpoints Individuais](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-individuais-api)
- [Endpoints Agrupados](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-agrupados-api)
- [API Commons](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-agrupados-api-commons)
- [API Vendas](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/api-vendas)
- [Download cURL para Windows](https://curl.haxx.se/download.html)
- [Download Insomnia](https://insomnia.rest/download)
