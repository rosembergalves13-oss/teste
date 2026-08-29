# Fluxo de Execução - Automação de Confirmação de Consultas

## Visão Geral

Este documento descreve o fluxo completo de execução do script de automação para confirmação de consultas da clínica.

**Sistema:** https://avanceic.simplificagestao.com.br/ords/r/gestao/app/login
**Responsável:** Dra Lene Alves
**WhatsApp:** 85991648598

---

## Fluxo de Execução

### 1. Login no Sistema

1. Acessar URL: `https://avanceic.simplificagestao.com.br/ords/r/gestao/app/login`
2. Inserir credenciais de acesso (usuário e senha)
3. Clicar no botão de login
4. Aguardar carregamento da página inicial

### 2. Navegação para Agenda

1. No menu lateral, localizar opção "Agenda" ou "Agenda de Consultas"
2. Clicar para acessar a tela de agenda
3. Identificar a data correta para consulta

### 3. Seleção do Dia de Consulta

1. **Regra Principal:** O script deve buscar a agenda do próximo dia útil que contenha clientes agendados
2. **Exceção:** Pular domingos automaticamente
3. **Lógica:** Se segunda-feira → buscar terça-feira, Se terça-feira → buscar quarta-feira, e assim por diante
4. Navegar até o dia identificado usando o seletor de data

### 4. Extração de Dados dos Clientes

Para cada cliente agendado no dia selecionado:

| Campo | Descrição |
|-------|-----------|
| **Nome do Paciente** | Nome completo do cliente |
| **Data da Consulta** | Data formatada (DD/MM/AAAA) |
| **Horário** | Hora da consulta (HH:MM) |
| **Telefone/WhatsApp** | Número para contato |
| **Status Atual** | Se já confirmado ou pendente |

### 5. Envio de Mensagem via WhatsApp

Para cada cliente com status pendente:

1. Abrir WhatsApp Web ou aplicativo
2. Buscar contato do cliente pelo número
3. Enviar mensagem personalizada:

```
Olá, [NOME_DO_PACIENTE]! Você tem uma consulta com DRA LENE ALVES

Data: [DATA_FORMATADA]
Horário: [HORÁRIO]
Confirme sua presença no link abaixo: https://curt.link/YoPri
```

**Exemplo:**
```
Olá, Joyce Tavares! Você tem uma consulta com DRA LENE ALVES

Data: 28/08/2026
Horário: 18:15
Confirme sua presença no link abaixo: https://curt.link/YoPri
```

### 6. Monitoramento de Respostas

1. Aguardar resposta do paciente
2. Identificar se o paciente confirmou ou não a presença
3. **Keywords de confirmação:** "sim", "confirmo", "confirmado", "estarei lá", "ok", "pode confirmar"

### 7. Confirmação no Sistema (se paciente confirmou)

1. Retornar à tela de agenda no sistema
2. Localizar o cliente que confirmou
3. Clicar no registro do cliente
4. Marcar como "Confirmado" ou "Presença Confirmada"
5. Salvar alteração

### 8. Envio de Mensagem de Confirmação

Após marcar a confirmação no sistema:

1. Voltar ao WhatsApp
2. Enviar mensagem simples: **"Confirmado"**

---

## Diagrama de Fluxo

```
┌─────────────────┐
│   LOGIN NO SITE │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ACESSAR AGENDA  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ SELECIONAR PRÓXIMO DIA     │
│ (pular domingos)           │
└────────┬───────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ PARA CADA CLIENTE DO DIA:   │
│ • Extrair dados            │
│ • Obter WhatsApp           │
└────────┬───────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ ENVIAR MENSAGEM WHATSAPP    │
│ (personalizada)             │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ AGUARDAR RESPOSTA          │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    │ Respondeu│
    │confirmando?│
    └────┬────┘
    SIM  │  NÃO
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌──────────────┐
│CONFIR- │  │ENCERRAR/PULA │
│MAR NO  │  │CLIENTE       │
│SISTEMA │  └──────────────┘
└───┬────┘
    │
    ▼
┌─────────────────────────────┐
│ ENVIAR "CONFIRMADO"         │
└─────────────────────────────┘
```

---

## Checklist de Execução

- [ ] Realizar login no sistema
- [ ] Navegar para tela de agenda
- [ ] Identificar próximo dia útil com clientes
- [ ] Listar todos os clientes do dia
- [ ] Para cada cliente pendente:
  - [ ] Obter dados completos
  - [ ] Enviar mensagem de confirmação
  - [ ] Aguardar resposta
  - [ ] Se confirmou → marcar no sistema
  - [ ] Se confirmou → enviar "Confirmado"
  - [ ] Se não confirmou → pular

---

## Observações

1. **Horários de Execução:** Recomenda-se executar o script uma vez ao dia, preferencialmente pela manhã (entre 8h e 10h)

2. **Pular Domingos:** O sistema deve verificar se o próximo dia útil cai em domingo e, nesse caso, avançar para segunda-feira

3. **Link de Confirmação:** O link `https://curt.link/YoPri` é o mesmo para todos os pacientes

4. **Contato WhatsApp:** Usar o número `85991648598` para acessar o WhatsApp Web

5. **Tratamento de Erros:** Em caso de falha no login ou acesso à agenda, o script deve tentar novamente após 30 segundos (máximo 3 tentativas)

---

## Tecnologias Recomendadas

- **Python** com bibliotecas:
  - `selenium` ou `playwright` para automação web
  - `pywhatkit` ou `selenium` para envio de WhatsApp
  - `schedule` ou ` APScheduler` para agendamento

- **Power Automate** (alternativa Windows)
- **AutoHotkey** (automação básica)
