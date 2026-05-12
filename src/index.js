/**
 * Entrypoint — sobe servidor HTTP + WhatsApp em paralelo.
 * Em produção (EasyPanel) o WhatsApp aguarda QR via /qr e o OAuth do ML
 * é autorizado uma vez via /ml/authorize.
 */
import 'dotenv/config';
import { createServer } from './server.js';
import { startWhatsApp } from './whatsapp/client.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createServer();
app.listen(PORT, () => {
  console.log(`🌐 HTTP em http://localhost:${PORT}`);
  console.log(`   /qr             escanear WhatsApp`);
  console.log(`   /ml/authorize   autorizar Mercado Livre (uma vez)`);
  console.log(`   /healthz        health check`);
});

await startWhatsApp({ printQrTerminal: true });
