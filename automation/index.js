/**
 * Script de Automação - Confirmação de Consultas da Clínica
 *
 * Fluxo:
 * 1. Login no sistema
 * 2. Navegar para agenda
 * 3. Selecionar próximo dia útil
 * 4. Extrair dados dos pacientes
 * 5. Enviar mensagens via WhatsApp
 * 6. Monitorar confirmações
 * 7. Marcar confirmados no sistema
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configurações
const CONFIG = {
    URL_LOGIN: 'https://avanceic.simplificagestao.com.br/ords/r/gestao/app/login',
    URL_AGENDA: 'https://avanceic.simplificagestao.com.br/ords/r/gestao/app/agenda-de-consultas',
    LINK_CONFIRMACAO: 'https://curt.link/YoPri',
    USUARIO: process.env.CLINICA_USUARIO || 'rosembergalves1323@gmail.com',
    SENHA: process.env.CLINICA_SENHA || '1234567',
    WHATSAPP_NUMERO: '85991648598',
    MEDICA: 'DRA LENE ALVES',
    MAX_TENTATIVAS: 3,
    TEMPO_ESPERA: 30,
    OUTPUT_DIR: path.join(__dirname, 'output')
};

// Utilitários
function log(mensagem) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${mensagem}`);
}

function formatarData(data) {
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function obterProximoDiaUtil(dataInicio) {
    const dia = new Date(dataInicio);
    dia.setDate(dia.getDate() + 1);
    while (dia.getDay() === 0) { // Domingo
        dia.setDate(dia.getDate() + 1);
    }
    return dia;
}

function gerarMensagem(paciente) {
    return `Olá, ${paciente.nome}! Você tem uma consulta com ${CONFIG.MEDICA}

Data: ${paciente.data}
Horário: ${paciente.horario}
Confirme sua presença no link abaixo: ${CONFIG.LINK_CONFIRMACAO}`;
}

function verificarConfirmacao(mensagem) {
    const lower = mensagem.toLowerCase();
    const keywords = ['sim', 'confirmo', 'confirmado', 'estarei lá', 'ok', 'pode confirmar', 'pode'];
    return keywords.some(k => lower.includes(k));
}

// Classe principal
class AutomacaoClinica {
    constructor() {
        this.navegador = null;
        this.pagina = null;
    }

    async iniciarNavegador(headless = false) {
        log('🚀 Iniciando navegador...');
        this.navegador = await puppeteer.launch({
            headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        this.pagina = await this.navegador.newPage();
        await this.pagina.setViewport({ width: 1920, height: 1080 });
        await this.pagina.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        log('✅ Navegador iniciado');
    }

    async fazerLogin() {
        log('🔐 Realizando login...');
        await this.pagina.goto(CONFIG.URL_LOGIN, { waitUntil: 'networkidle2', timeout: 60000 });
        await this.dormir(2);

        // Preenche usuário
        await this.pagina.type('input[name="P9999_USERNAME"]', CONFIG.USUARIO, { delay: 50 });
        await this.dormir(0.5);

        // Preenche senha
        await this.pagina.type('input[name="P9999_PASSWORD"]', CONFIG.SENHA, { delay: 50 });
        await this.dormir(0.5);

        // Clica no botão Entrar via JS (mais robusto)
        const clicou = await this.pagina.evaluate(() => {
            const botoes = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
            for (const btn of botoes) {
                const txt = (btn.textContent || btn.value || '').trim();
                if (txt.toLowerCase().includes('entrar') || txt.toLowerCase().includes('login')) {
                    btn.click();
                    return true;
                }
            }
            // Tenta submeter o form se não achar o botão
            const form = document.querySelector('form');
            if (form) { form.submit(); return true; }
            return false;
        });
        log(`   Clique em Entrar: ${clicou ? 'OK' : 'falhou'}`);

        await this.dormir(3);

        // Verifica se logou
        const url = this.pagina.url();
        if (!url.toLowerCase().includes('login')) {
            log('✅ Login realizado com sucesso!');
            return true;
        }

        log('⚠️ Login ainda na página de login, tentando novamente...');
        return false;
    }

    async login() {
        for (let tentativa = 1; tentativa <= CONFIG.MAX_TENTATIVAS; tentativa++) {
            log(`Tentativa ${tentativa} de ${CONFIG.MAX_TENTATIVAS}`);
            try {
                if (await this.fazerLogin()) return true;
            } catch (erro) {
                log(`❌ Erro no login: ${erro.message}`);
            }
            await this.dormir(CONFIG.TEMPO_ESPERA);
        }
        return false;
    }

    async navegarParaAgenda() {
        log('📅 Navegando para agenda...');
        await this.pagina.goto(CONFIG.URL_AGENDA, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.dormir(3);
    }

    async selecionarProximoDiaUtil() {
        log('📆 Selecionando próximo dia útil...');
        const dataAlvo = obterProximoDiaUtil(new Date());
        log(`   Data alvo: ${formatarData(dataAlvo)}`);

        // Tenta setar data via JavaScript em vários seletores
        const seletores = [
            'input[type="date"]',
            'input[placeholder*="Data"]',
            'input.date-picker',
            'input[id*="DATA"]',
            'input[id*="data"]',
            'input[name*="DATA"]',
            'input[name*="data"]'
        ];

        for (const seletor of seletores) {
            try {
                const existe = await this.pagina.$(seletor);
                if (existe) {
                    const dataFormatada = dataAlvo.toISOString().split('T')[0];
                    await this.pagina.evaluate((sel, data) => {
                        const input = document.querySelector(sel);
                        if (input) {
                            input.value = data;
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }, seletor, dataFormatada);
                    log(`   ✅ Data definida via ${seletor}`);
                    await this.dormir(2);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        log('   ⚠️ Não foi possível selecionar a data automaticamente, listando próxima data disponível');
        return false;
    }

    async extrairPacientes() {
        log('👥 Extraindo lista de pacientes...');

        // Aguarda tabela carregar
        await this.dormir(3);

        const pacientes = await this.pagina.evaluate(() => {
            const lista = [];

            // Tenta várias estruturas comuns
            const seletoresLinha = [
                'table tbody tr',
                '.agenda-row',
                '.appointment-item',
                '.paciente-row',
                'div[data-paciente]',
                'li.agenda-item',
                '.consulta-item',
                'tr'
            ];

            let linhas = [];
            for (const sel of seletoresLinha) {
                const encontrados = document.querySelectorAll(sel);
                if (encontrados.length > 0) {
                    linhas = encontrados;
                    console.log(`Encontrado: ${sel} com ${encontrados.length} itens`);
                    break;
                }
            }

            if (linhas.length === 0) {
                // Captura HTML para debug
                const html = document.body.innerHTML;
                return { pacientes: [], html: html.substring(0, 5000) };
            }

            linhas.forEach((linha, idx) => {
                const texto = linha.textContent || '';
                if (texto.trim().length < 5) return; // Pula linhas vazias

                const celulas = linha.querySelectorAll('td, .cell, .col, span, div');

                let paciente = {
                    nome: '',
                    telefone: '',
                    data: '',
                    horario: '',
                    status: 'pendente',
                    html: linha.outerHTML.substring(0, 500)
                };

                // Tenta extrair via células
                celulas.forEach((celula, j) => {
                    const txt = celula.textContent.trim();
                    const dataMatch = txt.match(/(\d{2}\/\d{2}\/\d{4})/);
                    const horaMatch = txt.match(/(\d{1,2}:\d{2})/);
                    const telefoneMatch = txt.match(/(\(?\d{2}\)?\s?9?\d{4}-?\d{4})/);

                    if (dataMatch) paciente.data = dataMatch[1];
                    if (horaMatch && !paciente.horario) paciente.horario = horaMatch[1];
                    if (telefoneMatch) paciente.telefone = telefoneMatch[1].replace(/\D/g, '');

                    // Nome é geralmente o texto mais longo que não é número/hora
                    if (txt.length > 5 && txt.length < 80 && !/^\d/.test(txt) && !paciente.nome) {
                        if (!txt.includes('Confirmar') && !txt.includes('Cancelar')) {
                            paciente.nome = txt;
                        }
                    }
                });

                // Se não extraiu nada, usa texto completo
                if (!paciente.nome && !paciente.horario) {
                    paciente.nome = texto.trim().substring(0, 80);
                }

                if (paciente.nome || paciente.horario) {
                    lista.push(paciente);
                }
            });

            return { pacientes: lista, html: '' };
        });

        // Salva HTML para debug
        if (pacientes.html) {
            fs.writeFileSync(
                path.join(CONFIG.OUTPUT_DIR, 'debug_pagina.html'),
                pacientes.html,
                'utf-8'
            );
            log(`   HTML salvo em debug_pagina.html para inspeção`);
        }

        log(`   📋 ${pacientes.pacientes.length} paciente(s) encontrado(s)`);
        return pacientes.pacientes;
    }

    async enviarWhatsApp(telefone, mensagem) {
        log(`📱 Enviando WhatsApp para ${telefone}...`);

        const url = `https://web.whatsapp.com/send?phone=${telefone}&text=${encodeURIComponent(mensagem)}`;

        const abaWhats = await this.navegador.newPage();
        try {
            await abaWhats.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await this.dormir(8); // Aguarda carregar

            // Tenta enviar via Enter
            await abaWhats.keyboard.press('Enter');
            await this.dormir(3);

            log(`   ✅ Mensagem enviada`);
            return true;
        } catch (e) {
            log(`   ❌ Erro ao enviar: ${e.message}`);
            return false;
        } finally {
            await abaWhats.close();
        }
    }

    async confirmarNoSistema(paciente) {
        log(`✔️ Marcando ${paciente.nome} como confirmado...`);

        try {
            // Volta para a página principal
            await this.pagina.bringToFront();
            await this.dormir(1);

            // Tenta encontrar e marcar o paciente
            const sucesso = await this.pagina.evaluate((nomePaciente) => {
                const linhas = document.querySelectorAll('table tbody tr, .agenda-row, .appointment-item, .paciente-row');

                for (const linha of linhas) {
                    if (linha.textContent.includes(nomePaciente)) {
                        // Procura botão/checkbox de confirmação
                        const botoes = linha.querySelectorAll('button, input[type="checkbox"], .confirmar-btn, [class*="confirm"]');
                        for (const btn of botoes) {
                            btn.click();
                            return true;
                        }
                    }
                }
                return false;
            }, paciente.nome);

            if (sucesso) {
                log(`   ✅ Marcado como confirmado`);
                await this.dormir(2);
                return true;
            } else {
                log(`   ⚠️ Não foi possível marcar automaticamente`);
                return false;
            }
        } catch (e) {
            log(`   ❌ Erro: ${e.message}`);
            return false;
        }
    }

    async executarFluxoCompleto() {
        log('═══════════════════════════════════════════');
        log('  INICIANDO AUTOMAÇÃO - CLÍNICA');
        log('═══════════════════════════════════════════');

        try {
            await this.iniciarNavegador(false);

            if (!await this.login()) {
                log('❌ Falha no login. Encerrando.');
                return;
            }

            await this.navegarParaAgenda();
            await this.selecionarProximoDiaUtil();

            const pacientes = await this.extrairPacientes();

            if (pacientes.length === 0) {
                log('ℹ️ Nenhum paciente encontrado para hoje');
                log('   Verifique debug_pagina.html para entender a estrutura');
                return;
            }

            for (const paciente of pacientes) {
                log('');
                log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                log(`📋 Processando: ${paciente.nome || 'N/A'}`);
                log(`   Horário: ${paciente.horario || 'N/A'}`);
                log(`   Telefone: ${paciente.telefone || 'N/A'}`);
                log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                if (!paciente.telefone) {
                    log('   ⚠️ Sem telefone, pulando...');
                    continue;
                }

                const mensagem = gerarMensagem({
                    ...paciente,
                    data: paciente.data || formatarData(obterProximoDiaUtil(new Date()))
                });
                log(`   Mensagem: ${mensagem.substring(0, 100)}...`);

                const enviado = await this.enviarWhatsApp(paciente.telefone, mensagem);

                if (enviado) {
                    log('   ⏳ Aguardando resposta do paciente (simulação)...');
                    // Em produção, aqui você monitoraria respostas reais
                    log('   💡 Para detectar respostas automaticamente, configure a API do WhatsApp Business');
                }
            }

            log('');
            log('═══════════════════════════════════════════');
            log('✅ FLUXO CONCLUÍDO');
            log('═══════════════════════════════════════════');

        } catch (e) {
            log(`❌ Erro fatal: ${e.message}`);
            console.error(e);
        } finally {
            if (this.navegador) {
                log('🔒 Fechando navegador...');
                await this.navegador.close();
            }
        }
    }

    dormir(segundos) {
        return new Promise(r => setTimeout(r, segundos * 1000));
    }
}

// Execução
if (require.main === module) {
    const automacao = new AutomacaoClinica();
    automacao.executarFluxoCompleto();
}

module.exports = AutomacaoClinica;
