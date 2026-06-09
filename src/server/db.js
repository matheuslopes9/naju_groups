import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger.js';

const log = createLogger('prisma');

/**
 * Cria o cliente Prisma com log via EventEmitter (não direto pra stdout).
 * Isso permite filtrar erros "esperados" (P2002 = unique constraint) que
 * acontecem em fluxos idempotentes (catalog-worker reaproveitando offers
 * já criadas, fila com items duplicados em retry, etc).
 *
 * Sem esse filtro, log do EasyPanel fica cheio de:
 *   prisma:error Unique constraint failed on the fields: (workspace_id, offer_id)
 *
 * Quando o catch do código já trata isso, não precisa poluir stdout.
 */
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  // P2002 = unique constraint. Tratado nos call-sites com try/catch ou
  // skipDuplicates. Silencia pra não poluir log.
  if (e.message?.includes('Unique constraint failed')) return;
  log.error(e.message ?? String(e), { target: e.target });
});

prisma.$on('warn', (e) => {
  log.warn(e.message ?? String(e), { target: e.target });
});
