const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

let nomeUsuario = '';
let emailUsuario = '';
let capturouNome = false; // Flag para verificar se o nome do usuário já foi capturado
let capturouEmail = false; // Flag para verificar se o e-mail do usuário já foi capturado
let timeoutID = null; // ID do temporizador para rastrear o tempo desde a última interação do usuário
const TIMEOUT_INTERVAL = 5 * 60 * 1000; // Intervalo de tempo em milissegundos (5 minutos)
let meuNumero = ''; // Variável para armazenar o número do remetente
let setorSelecionado = ''; // Variável para armazenar o número do setor selecionado
let emAtendimento = false; // Flag para indicar se a conversa está em atendimento com um setor
let nomeSetor = ''; // Nome do setor selecionado
let numeroProtocolo = ''; // Número do protocolo de atendimento

const protocoloFilePath = path.join(__dirname, 'protocolo.json');

// Função para carregar o número do protocolo atual de um arquivo
function loadProtocoloNumber() {
    try {
        const data = fs.readFileSync(protocoloFilePath, 'utf8');
        return JSON.parse(data).currentProtocolo || 1;
    } catch (err) {
        return 1; // Se o arquivo não existir ou estiver corrompido, começa do 1
    }
}

// Função para salvar o número do protocolo atual em um arquivo
function saveProtocoloNumber(protocoloNumber) {
    const data = { currentProtocolo: protocoloNumber };
    fs.writeFileSync(protocoloFilePath, JSON.stringify(data), 'utf8');
}

let currentProtocoloNumber = loadProtocoloNumber();

const client = new Client({
    webVersionCache: {
        type: "remote",
        remotePath:
            "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente está pronto!');
});

client.on('message', async (msg) => {
    clearTimeout(timeoutID); // Reinicia o temporizador em cada interação do usuário
    timeoutID = setTimeout(resetState, TIMEOUT_INTERVAL); // Define o temporizador para redefinir o estado após o intervalo de tempo definido
    
    console.log('Mensagem recebida:', msg.body);
    
    const remetente = msg.from.split('@')[0];

    if (msg.fromMe) {
        // Se a mensagem é do bot, ignore
        return;
    }

    if (emAtendimento && remetente === setorSelecionado) {
        // Se a mensagem é do setor, repassa para o usuário
        if (msg.body.toLowerCase() === 'encerrar') {
            await encerrarAtendimento(nomeSetor);
            return;
        } else {
            await client.sendMessage(`${meuNumero}@c.us`, `${nomeSetor}: ${msg.body}`);
        }
        return;
    }

    if (emAtendimento && remetente === meuNumero) {
        // Se a mensagem é do usuário, repassa para o setor
        await client.sendMessage(`${setorSelecionado}@c.us`, `Usuário ${nomeUsuario}: ${msg.body}`);
        return;
    }

    // Processamento de mensagens do usuário
    if (!capturouNome && (msg.body.toLowerCase() === 'oi' || msg.body.toLowerCase() === 'olá')) {
        await msg.reply('Seja bem-vindo ao atendimento automático.');
        await delay(500); // Adiciona um pequeno atraso para garantir a ordem das mensagens
        await msg.reply('Qual é o seu nome?');
    } else if (!capturouNome) {
        nomeUsuario = msg.body;
        capturouNome = true;
        await msg.reply(`Muito prazer, ${nomeUsuario}!`);
        await delay(500); // Adiciona um pequeno atraso para garantir a ordem das mensagens
        await msg.reply('Qual é o seu e-mail? Caso não tenha, digite a letra "x".');
    } else if (!capturouEmail) {
        emailUsuario = msg.body.toLowerCase() === 'x' ? 'Não fornecido' : msg.body;
        capturouEmail = true;
        await msg.reply(`Obrigado, ${nomeUsuario}. Como posso te ajudar? 😊`);
        await delay(500); // Adiciona um pequeno atraso para garantir a ordem das mensagens
        await msg.reply('Escolha uma das opções a seguir: \n1. Financeiro \n2. Comercial \n3. Atendimento');
    } else {
        // Tratamento das respostas dos comandos de texto
        switch (msg.body.toLowerCase()) {
            case '1':
            case 'financeiro':
                nomeSetor = 'Setor Financeiro';
                setorSelecionado = '5525656825464'; // Número atualizado do setor Financeiro
                await iniciarAtendimento(nomeUsuario, nomeSetor);
                break;
            case '2':
            case 'comercial':
                nomeSetor = 'Setor Comercial';
                setorSelecionado = '5511987654321'; // Substitua pelo número real do setor Comercial no formato CÓDIGOPAÍS + DDD + NÚMERO
                await iniciarAtendimento(nomeUsuario, nomeSetor);
                break;
            case '3':
            case 'atendimento':
                nomeSetor = 'Setor de Atendimento';
                setorSelecionado = '5511976543210'; // Substitua pelo número real do setor de Atendimento no formato CÓDIGOPAÍS + DDD + NÚMERO
                await iniciarAtendimento(nomeUsuario, nomeSetor);
                break;
            default:
                await msg.reply('Opção inválida. Por favor, escolha uma das opções a seguir: \n1. Financeiro \n2. Comercial \n3. Atendimento');
        }
    }
    
    meuNumero = remetente;
});

async function iniciarAtendimento(userName, sectorName) {
    emAtendimento = true;
    const notificationMessage = `O usuário ${userName} escolheu o ${sectorName}. Por favor, inicie o atendimento através deste chat.`;

    await client.sendMessage(`${setorSelecionado}@c.us`, notificationMessage)
        .then(() => console.log(`Notificação enviada para o setor:`, notificationMessage))
        .catch((error) => console.error('Erro ao enviar notificação:', error));

    await delay(500); // Adiciona um pequeno atraso para garantir a ordem das mensagens
    await client.sendMessage(`${meuNumero}@c.us`, `Você escolheu ${sectorName}. Por favor, aguarde enquanto o setor entra em contato.`);
}

async function encerrarAtendimento(sectorName) {
    emAtendimento = false;
    numeroProtocolo = generateProtocolNumber();
    await client.sendMessage(`${meuNumero}@c.us`, `Seu atendimento com ${sectorName} foi encerrado. Protocolo: ${numeroProtocolo}`);
    resetState();
}

function resetState() {
    nomeUsuario = '';
    emailUsuario = '';
    capturouNome = false;
    capturouEmail = false;
    emAtendimento = false;
    setorSelecionado = '';
}

function generateProtocolNumber() {
    currentProtocoloNumber += 1;
    saveProtocoloNumber(currentProtocoloNumber);
    return currentProtocoloNumber.toString().padStart(6, '0');
}

// Função para adicionar um pequeno atraso entre as mensagens
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

client.initialize();