# StackMatch MVP

## Objetivo
Construir um front-end completo, responsivo e navegável para descoberta de talentos em tecnologia, com dados locais e foco principal na experiência visual do Discover.

## Páginas e fluxos
- Landing page com apresentação, prévia de talento, funcionamento, benefícios e chamada final.
- Discover com cards arrastáveis, ações Passar/Salvar/Interessado, filtros, chips ativos, progresso e estados sem resultado.
- Perfil completo de cada desenvolvedor em rota individual, incluindo experiência, skills, projetos e links.
- Talentos salvos com grade, remoção e estado vazio.
- Criação de perfil em quatro etapas, importação simulada do GitHub e prévia do perfil.

## Interface
- Identidade SaaS B2B clara, grafite e azul, com verde para disponibilidade e vermelho somente para passar.
- Navegação persistente e menu adaptado para celular.
- Animações suaves, feedback visual, avisos de sucesso e skeletons.
- Oito perfis fictícios diversos, cada um com três projetos.

## Detalhes técnicos
- React, TypeScript, Tailwind CSS, Lucide e Motion.
- Estado compartilhado no navegador para favoritos, ações e formulário, sem backend ou integrações.
- Componentes reutilizáveis e dados mockados separados da apresentação.
- Metadados próprios em todas as páginas públicas.
- Verificação final nos tamanhos desktop e mobile, incluindo swipe, filtros, favoritos, perfil e importação simulada.
