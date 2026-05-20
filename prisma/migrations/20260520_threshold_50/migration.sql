-- autoApproveThreshold default 80 -> 50.
-- O threshold de 80 era muito alto: exigia comissao R$15 + 50% desconto +
-- cupom + frete pra atingir, e a maioria das ofertas do ML fica em score
-- 40-60. Resultado: <25% das ofertas filtradas chegavam na fila.
-- 50 = ~30% desconto + frete + cupom OR ~40% desconto + cupom OR ofertas
-- de comissao alta sem cupom — bem mais inclusivo.

ALTER TABLE "workspaces" ALTER COLUMN "auto_approve_threshold" SET DEFAULT 50;

-- Atualiza workspaces que estao no default antigo (80).
-- Quem ja customizou pra valor diferente nao e afetado.
UPDATE "workspaces" SET "auto_approve_threshold" = 50 WHERE "auto_approve_threshold" = 80;
