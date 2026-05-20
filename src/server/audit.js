import { prisma } from './db.js';
import { createLogger } from './logger.js';

const log = createLogger('audit');

/**
 * Log de auditoria — fire and forget, não trava o request.
 * Use em pontos importantes: login/logout, criação/edição/deleção de workspaces,
 * aprovação/rejeição de ofertas, conexão/desconexão WhatsApp, OAuth ML.
 */
export function audit(action, opts = {}) {
  const { entity, entityId, workspaceId, payload } = opts;
  prisma.auditLog.create({
    data: {
      action,
      entity: entity ?? null,
      entityId: entityId ?? null,
      workspaceId: workspaceId ?? null,
      payload: payload ? payload : undefined,
    },
  }).catch((e) => {
    log.warn('audit.log falhou', { error: e.message });
  });
}
