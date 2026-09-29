# Calendário de conversa

## Objetivo
Adicionar ao perfil de cada desenvolvedor um fluxo de agendamento totalmente simulado no navegador, sem integrações ou backend.

## Implementação
- Trocar a ação principal “Entrar em contato” por “Agendar conversa”.
- Abrir uma janela de agendamento com calendário mensal, bloqueando datas passadas e fins de semana.
- Após escolher a data, exibir horários disponíveis e permitir selecionar um deles.
- Coletar nome da empresa, e-mail corporativo e uma mensagem opcional.
- Exibir um resumo com desenvolvedor, data, horário, duração e fuso antes da confirmação.
- Confirmar o agendamento com feedback visual e salvar a reunião apenas no navegador.
- Manter o calendário adaptado para celular e alinhado à identidade visual atual do StackMatch.

## Detalhes técnicos
- Usar o calendário e os controles já presentes no projeto, com `date-fns` para datas.
- Isolar o fluxo em um componente reutilizável para qualquer perfil.
- Persistir os agendamentos em `localStorage`, ao lado dos favoritos, sem chamada externa.
- Validar o fluxo completo em desktop e celular e conferir os diagnósticos do projeto.
