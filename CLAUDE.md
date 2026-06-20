# EIXO — Plataforma Baruk

Sistema de gestão interno da Baruk Technology & Consulting (Grupo Baruk).
Idealizador: Vitor (`vitor.rix@icloud.com`), usuário com role `master`.
Firebase project ID: `eixo-ac8e0`. Deploy: GitHub Pages via `npm run deploy`.

## Stack

- **Vite** — bundler, sem framework (vanilla JS modular)
- **Firebase Auth** — autenticação por e-mail/senha
- **Firestore** — banco de dados; segurança real em `firestore.rules`
- **GitHub Pages** — deploy via `gh-pages` (`npm run deploy`)

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
| dashboard | `#/` | Fase 1 |
| pedidos | `#/pedidos` | Fase 1 |
| clientes | `#/clientes` | Fase 1 — mais desenvolvido (form, list, service) |
| orcamento | `#/orcamento` | Fase 1 |
| recibo | `#/recibo` | Fase 1 |
| relatorios | `#/relatorios` | Fase 1 |
| usuarios | `#/usuarios` | Fase 1 |
| financeiro | `#/financeiro` | Fase 2 (pagamentos, recebimentos, DRE) |

### Auth & Permissões (`src/auth/session.js`)
- `onSessionReady(cb)` — observador de boot; carrega perfil do Firestore
- `getCurrentProfile()` — perfil em memória durante a sessão
- `can(module, action)` — verifica permissão; `master` sempre retorna `true`
- Role `master`: acesso total
- Role `employee`: acesso por `permissions.{modulo}.{view|create|edit|delete}`
- Usuários **nunca são deletados** — campo `active: false` desativa

### Layouts
- `AuthLayout.js` — tela de login (sem sidebar)
- `MainLayout.js` — sidebar + header + `#module-content`

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

## Paleta de cores
| Token | Hex | Uso |
|---|---|---|
| Verde Petróleo | `#123C43` | Sidebar, fundo escuro |
| Verde Esmeralda | `#10B981` | Accent, botões primários |
| Cinza Claro | `#E5EEF0` | Fundo de página |

## Utilitários compartilhados (`src/shared/`)
- `utils/dom.js` — `el()`, `svgEl()`, `text()`, `mount()`
- `utils/formatters.js` — formatação de moeda, datas, etc.
- `utils/validators.js` — validações de formulário
- `utils/cep.js` — consulta de CEP via API
- `components/Modal.js` — modal genérico
- `components/Toast.js` — notificações toast
- `components/CotacaoDolar.js` — cotação do dólar em tempo real

## Estrutura Firestore
```
/users/{uid}
/clientes/{id}
/pedidos/{id}
/orcamentos/{id}
/recibos/{id}
/relatorios/{id}
/financeiro/{tipo}/{id}
```

## Histórico de decisões
- **2026-06-20** — Projeto renomeado de `baruk-sistema` para `eixo`. Nome oficial do sistema: EIXO. `vite.config.js` base atualizado para `/eixo/`.
