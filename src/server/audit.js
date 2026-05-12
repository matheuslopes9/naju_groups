import { prisma } from './db.js';

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
    console.warn('audit.log failed:', e.message);
  });
}
