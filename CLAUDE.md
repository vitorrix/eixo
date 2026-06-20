# EIXO — Plataforma Baruk

Sistema de gestão interno da Baruk Technology & Consulting (Grupo Baruk).
Idealizador: Vitor (`vitor.rix@icloud.com`), usuário com role `master`.
Firebase project ID: `eixo-ac8e0`.

## Stack

- **Vite** — bundler, sem framework (vanilla JS modular)
- **Firebase Auth** — autenticação por e-mail/senha
- **Firestore** — banco de dados; segurança real em `firestore.rules`
- **GitHub Pages** — deploy automático via GitHub Actions (push para `main`); **não usar `npm run deploy`**

## Deploy

Push para `main` → GitHub Actions builda e publica. Verificar timestamp `v DD/MM/YY HH:MM` na sidebar para confirmar que o novo código está no ar.

Para publicar regras do Firestore:
```
cd /Users/baruk/Developer/eixo && npx firebase-tools deploy --only firestore:rules,firestore:indexes --project eixo-ac8e0
```

## Arquitetura

### Boot
`src/main.js` → `onSessionReady()` → `initRouter()`

### Router (`src/router/index.js`)
Hash-based (`#/pedidos`, `#/clientes`, etc.). Cada rota define um módulo e faz lazy-load. O router verifica `can(module, 'view')` antes de renderizar. Módulos podem retornar uma função `cleanup()` para cancelar listeners do Firestore.

### Módulos (`src/modules/<nome>/index.js`)
Contrato obrigatório: exportar `render(container)`. O container é `#module-content` dentro do `MainLayout`. Não misturar lógica entre módulos.

### Módulos existentes
| Módulo | Rota | Status |
|---|---|---|
| dashboard | `#/` | Funcional — stat cards de Clientes e Pedidos |
| pedidos | `#/pedidos` | Em desenvolvimento — list + form parcial; form precisa revisão (remover custo, selecionar produto do catálogo) |
| clientes | `#/clientes` | Completo — form, list, service |
| fornecedores | `#/fornecedores` | Completo |
| produtos | `#/produtos` | Completo — cadastro, list com busca, estoque; sem imagem |
| configuracoes | `#/configuracoes` | Funcional |
| usuarios | `#/usuarios` | Funcional |
| recibo | `#/recibo` | Placeholder |
| relatorios | `#/relatorios` | Placeholder |
| financeiro | `#/financeiro` | Placeholder |

### Auth & Permissões (`src/auth/session.js`)
- `onSessionReady(cb)` — observador de boot; carrega perfil do Firestore
- `getCurrentProfile()` — perfil em memória durante a sessão
- `can(module, action)` — verifica permissão; `master` sempre retorna `true`
- Role `master`: acesso total
- Role `employee`: acesso por `permissions.{modulo}.{view|create|edit|delete}`
- Usuários **nunca são deletados** — campo `active: false` desativa

### Layouts
- `AuthLayout.js` — tela de login (sem sidebar)
- `MainLayout.js` — sidebar + header + `#module-content` + build timestamp abaixo do logo

## Regras de segurança críticas

### DOM — nunca usar innerHTML com dados externos
Usar exclusivamente o helper `el()` de `src/shared/utils/dom.js`:
```js
import { el, mount } from '../../shared/utils/dom.js'
mount(container, el('h2', {}, 'Título'), el('p', {}, dadoDoUsuario))
```
Para SVG: `svgEl()`. Para limpar/repopular: `mount(container, ...nodes)` ou `container.replaceChildren()`.
O hook de segurança do projeto flagga ativamente qualquer `innerHTML` com template literals.

### Firestore Security Rules (`firestore.rules`)
Segurança declarada no servidor — não confiar só no JS. Toda coleção tem regras explícitas. A regra final bloqueia tudo que não foi explicitamente permitido.

**Atenção:** Regras com `get()` no `hasPermission()` são **incompatíveis** com `getCountFromServer` (aggregation queries) — usar apenas `onSnapshot` com `query`.

## Paleta de cores
| Token | Hex | Uso |
|---|---|---|
| Verde Petróleo | `#123C43` | Sidebar, fundo escuro |
| Verde Esmeralda | `#10B981` | Accent, botões primários |
| Cinza Claro | `#E5EEF0` | Fundo de página |

## Utilitários compartilhados (`src/shared/`)
- `utils/dom.js` — `el()`, `svgEl()`, `text()`, `mount()`
- `utils/formatters.js` — `brl()` (moeda), `shortDate()` (DD/MM), etc.
- `utils/validators.js` — validações de formulário
- `utils/cep.js` — consulta de CEP via API
- `components/Modal.js` — modal genérico (`openModal`, `openConfirm`)
- `components/Toast.js` — `toastSuccess()`, `toastError()`
- `components/CotacaoDolar.js` — cotação do dólar em tempo real (sidebar footer)

## Estrutura Firestore
```
/users/{uid}
/clientes/{id}
/fornecedores/{id}
/produtos/{id}         ← catálogo de produtos com preços e estoque
/pedidos/{id}
/orcamentos/{id}
/recibos/{id}
/relatorios/{id}
/financeiro/{tipo}/{id}
/configuracoes/{docId} ← operacoes: formasPagamento[], etc.
```

## Decisões arquiteturais

- **Firebase Storage desabilitado** — plano Spark (gratuito) não inclui; upload de imagem removido do módulo Produtos. Reativar quando migrar para plano pago.
- **Pedidos sem campo de custo** — custo vem do cadastro do Produto (e futuramente da Compra). O form de Pedidos precisa selecionar produto do catálogo, não digitar custo manualmente.
- **Próximos módulos na fila:** Compras (Compra vincula produto → atualiza estoque), revisão do form de Pedidos, Tarefas, Financeiro.
- **`subscribePedidos`** usa apenas `orderBy('data', 'desc')` — dois orderBy exigiriam índice composto.

## Histórico de decisões
- **2026-06-20** — Projeto renomeado de `baruk-sistema` para `eixo`. Nome oficial: EIXO. `vite.config.js` base atualizado para `/eixo/`.
- **2026-06-20** — Módulos Produtos e Pedidos (list+form inicial) implementados. Storage removido.
