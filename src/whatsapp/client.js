import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import pino from 'pino';

const logger = pino({ level: 'warn' });

let currentQrDataUrl = null;
let isConnected = false;

export function getQrDataUrl() {
  return currentQrDataUrl;
}
export function isWhatsAppConnected() {
  return isConnected;
}

export async function startWhatsApp({ onReady, printQrTerminal = false } = {}) {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_state/wa');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['NajuGroupsBot', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQrDataUrl = await QRCode.toDataURL(qr);
      if (printQrTerminal) {
        console.log('\n📱 QR no terminal (também disponível em /qr):\n');
        qrcodeTerminal.generate(qr, { small: true });
      } else {
        console.log('📱 QR gerado — abra /qr no navegador pra escanear.');
      }
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ WA fechado. reconnect=', shouldReconnect);
      if (shouldReconnect) startWhatsApp({ onReady, printQrTerminal });
    } else if (connection === 'open') {
      isConnected = true;
      currentQrDataUrl = null;
      console.log('✅ WhatsApp conectado!');
      if (onReady) onReady(sock);
    }
  });

  return sock;
}
