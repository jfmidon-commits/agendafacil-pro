# 🤝 Como Contribuir com o AgendaFácil Pro

Obrigado pelo interesse em contribuir! Este guia vai te ajudar a começar.

## 📋 Índice
- [Código de Conduta](#código-de-conduta)
- [Como Reportar Bugs](#como-reportar-bugs)
- [Como Sugerir Funcionalidades](#como-sugerir-funcionalidades)
- [Configurando o Ambiente](#configurando-o-ambiente)
- [Fluxo de Trabalho](#fluxo-de-trabalho)
- [Padrões de Código](#padrões-de-código)
- [Commit Messages](#commit-messages)

## 📜 Código de Conduta
Este projeto segue o [Código de Conduta](./CODE_OF_CONDUCT.md). Ao participar, você concorda em segui-lo.

## 🐛 Como Reportar Bugs
1. Verifique se o bug já não foi reportado nas [Issues](https://github.com/jfmidon-commits/agendafacil-pro/issues)
2. Se não encontrar, crie uma nova issue usando o template de Bug Report
3. Inclua o máximo de detalhes possível: passos para reproduzir, ambiente, logs

## ✨ Como Sugerir Funcionalidades
1. Verifique se a funcionalidade já não foi sugerida
2. Crie uma issue usando o template de Feature Request
3. Descreva claramente a motivação e os critérios de aceitação

## 🛠️ Configurando o Ambiente

### Pré-requisitos
- Node.js 18+
- Python 3.11+
- npm ou yarn
- Conta no Supabase
- Conta no Stripe (para testes)

### Instalação
```bash
# Clone o repositório
git clone https://github.com/jfmidon-commits/agendafacil-pro.git
cd agendafacil-pro

# Instale dependências do frontend
cd web && npm install

# Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais

# Rode o servidor de desenvolvimento
npm run dev
```

## 🔄 Fluxo de Trabalho
1. **Fork** o repositório (se for contribuidor externo)
2. Crie uma **branch** a partir da `main`: `git checkout -b feature/nome-da-feature`
3. Faça suas **mudanças** seguindo os padrões do projeto
4. **Teste** suas mudanças localmente
5. Faça **commit** seguindo as convenções de commits
6. Abra um **Pull Request** usando o template fornecido

## 📝 Padrões de Código
- Use **TypeScript** para todo código novo
- Siga o ESLint/Prettier configurado no projeto
- Nomeie componentes em PascalCase
- Nomeie hooks em camelCase prefixados com `use`
- Documente funções complexas com JSDoc

## 💬 Commit Messages
Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Tipos
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Formatação (sem mudança de código)
- `refactor`: Refatoração de código
- `perf`: Melhoria de performance
- `test`: Adição/correção de testes
- `chore`: Tarefas de manutenção

### Exemplos
```
feat(booking): add WhatsApp notification integration

- Integrates with Make.com webhook
- Sends confirmation message after booking
- Includes cancellation link

Closes #42
```

## 🙏 Agradecimentos
Toda contribuição é valorizada! Obrigado por ajudar a melhorar o AgendaFácil Pro.
