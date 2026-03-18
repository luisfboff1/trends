# Integração com Uniplus ERP (Intelidata)

Gerado em: 2026-03-17 21:05

---

## 📚 Documentação Oficial

- API Uniplus – Comece por aqui  
https://kb.beemore.com/dc/pt-br/domains/suporte/documents/api-uniplus-comece-por-aqui

- Endpoints Individuais  
https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-individuais-api

- Endpoints Agrupados  
https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-agrupados-api

- API Commons  
https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-agrupados-api-commons

- API Vendas  
https://kb.beemore.com/dc/pt-br/domains/suporte/documents/api-vendas

---

## 🔐 Autenticação

### Gerar Token

```bash
curl -X POST \
  -H "Authorization: Basic SEU_CODIGO" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&scope=public-api" \
  "https://SEU_SERVIDOR/oauth/token"
```

### Resposta

```json
{
  "access_token": "TOKEN",
  "token_type": "bearer",
  "expires_in": 3599
}
```

---

## 🌐 Descobrir servidor

```bash
GET https://server-portal.intelidata.inf.br/roteador/endereco-servidor/{conta}
```

---

## 📡 Padrão da API

- GET /public-api/v1/{objeto}
- GET /public-api/v1/{objeto}/{codigo}
- POST /public-api/v1/{objeto}
- PUT /public-api/v1/{objeto}
- DELETE /public-api/v1/{objeto}/{codigo}

### Paginação

```bash
?offset=0&limit=100
```

### Filtros

```bash
?campo.eq=valor
?campo.ge=valor
```

---

## 📦 Principais Endpoints

### Produtos
```bash
GET /public-api/v1/produtos
```

### Entidades (clientes/fornecedores)
```bash
GET /public-api/v1/entidades
```

### Vendas
```bash
GET /public-api/v2/venda
```

### Itens de venda
```bash
GET /public-api/v2/venda-item
```

### Movimentação de estoque
```bash
GET /public-api/v2/movimentacao-estoque
```

---

## 📊 Exemplo JSON - Venda

```json
[
  {
    "idVenda": 12,
    "codigoCliente": "265",
    "nomeCliente": "CARLOS",
    "emissao": "2023-08-30",
    "valorTotal": "102.00"
  }
]
```

---

## 📊 Exemplo JSON - Item

```json
[
  {
    "idVenda": 12,
    "codigoProduto": "10084",
    "descricaoProduto": "Produto teste"
  }
]
```

---

## 🔄 Fluxo de Sincronização

1. Gerar token
2. Buscar produtos
3. Buscar clientes
4. Buscar vendas
5. Buscar itens
6. Buscar estoque
7. Salvar no banco

---

## ⚙️ Exemplo de sincronização

```bash
GET /public-api/v2/venda?emissao.ge=2026-03-01
GET /public-api/v2/venda-item?emissao.ge=2026-03-01
GET /public-api/v2/movimentacao-estoque?data.ge=2026-03-01
```

---

## 💡 Observações

- Token expira em 60 minutos
- Usar campo `codigo` como chave
- Não há webhook oficial → usar polling

---

## 🚀 Sugestão de Arquitetura

- Serviço: uniplus-connector
- Banco com controle de sincronização
- Atualização incremental

---

