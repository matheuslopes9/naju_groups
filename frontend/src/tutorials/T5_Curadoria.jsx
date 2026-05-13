import { Step, StepsList, Callout, FieldTable } from './components.jsx';

export default function T5_Curadoria() {
  return (
    <StepsList>
      <Callout tone="info" title="Como funciona o fluxo">
        O sistema busca ofertas no ML usando seus filtros e salva como <strong>pendentes</strong>.
        Você revisa no inbox e <strong>aprova</strong> uma a uma. Cada aprovação envia
        automaticamente pros grupos staging do workspace.
      </Callout>

      <Step n={1} title="Buscar ofertas manualmente">
        <p>
          No workspace → aba <strong>🛒 Ofertas</strong> → clique em <strong>🔍 Buscar agora</strong>.
        </p>
        <p>O sistema:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Chama <code>GET /sites/MLB/search</code> com seus filtros (termo, frete grátis, DEAL)</li>
          <li>Recebe até 50 produtos do ML</li>
          <li>Descarta os que não batem o desconto mínimo</li>
          <li>Descarta duplicatas (productId já visto nesse workspace)</li>
          <li>Salva o resto como <strong>pending</strong> no banco</li>
        </ol>
        <p>Você verá um toast com o número de ofertas novas salvas.</p>
      </Step>

      <Step n={2} title="Buscar automaticamente em loop">
        <p>
          Pra não precisar clicar em "Buscar agora" o tempo todo, ligue
          <strong> busca automática</strong>:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Aba <strong>🎯 Filtros</strong></li>
          <li>Liga o toggle de <strong>Busca automática</strong></li>
          <li>O worker roda a cada minuto e executa workspaces que estão devidos (respeitando intervalMin)</li>
        </ol>
        <Callout tone="info" title="O badge do menu te avisa">
          Quando novas ofertas pendentes chegam, o badge no menu Dashboard incrementa
          em tempo real. Se você está com a aba aberta, recebe um toast também.
        </Callout>
      </Step>

      <Step n={3} title="Revisar ofertas no inbox">
        <p>
          Na aba <strong>🛒 Ofertas</strong> → sub-aba <strong>Pendentes</strong>, cada card mostra:
        </p>
        <FieldTable rows={[
          ['Foto', 'Imagem do produto'],
          ['Título', 'Nome no ML'],
          ['Preço', 'Atual e original (riscado)'],
          ['Desconto', 'Badge -X% no canto'],
          ['Frete grátis', 'Badge no canto direito'],
          ['Vendidos', 'Quantos já foram vendidos'],
          ['Ver no ML', 'Link pra abrir a página do produto (com sua tag de afiliada já anexada)'],
        ]} />
      </Step>

      <Step n={4} title="Aprovar uma oferta">
        <p>
          Quando achar uma boa: clique em <strong>Aprovar e enviar</strong>. O sistema:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Marca a oferta como <code>sent</code> no banco</li>
          <li>Pra cada grupo de staging cadastrado: envia uma mensagem com foto + caption</li>
          <li>A caption tem: emoji 🔥, título, preço, desconto, frete, link com tag de afiliada, <code>#publi</code></li>
          <li>Registra a ação no audit log</li>
        </ol>
      </Step>

      <Step n={5} title="Rejeitar uma oferta">
        <p>
          Se não gostou, clica no X. A oferta vai pra sub-aba <strong>Rejeitadas</strong> e
          nunca mais é mostrada como sugestão (anti-duplicata por <code>productId</code>).
        </p>
      </Step>

      <Step n={6} title="Acompanhar histórico">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Pendentes</strong>: aguardam sua decisão</li>
          <li><strong>Enviadas</strong>: já foram pro grupo (mostra data/hora)</li>
          <li><strong>Rejeitadas</strong>: você descartou (mostra data)</li>
        </ul>
        <p>Use a página <strong>Atividade</strong> (no menu) pra ver log completo de quando aprovou/rejeitou cada uma.</p>
      </Step>

      <Step n={7} title="Dica: revisar em lote rápido">
        <p>
          Tendência: você bate o olho na foto, preço, desconto → decide em 2 segundos.
          Em 5 minutos dá pra processar 50 ofertas. Quanto mais frequente você revisa,
          mais quente fica a fila e melhor a curadoria.
        </p>
      </Step>

      <Callout tone="warning" title="Não envie tudo">
        Aprovar 100% das ofertas é tiro no pé: vira spam, grupo se cansa, atribuição
        de comissão dilui. Aprove só as <em>realmente boas</em>. Critérios práticos:
        desconto &gt; 30%, marca conhecida, vendidos &gt; 100, fotos boas, frete grátis.
      </Callout>

      <Callout tone="success" title="Você dominou o fluxo">
        Agora é volume e consistência. Próximo (importante) tutorial: <em>Regras de
        conformidade legal</em> — pra não tomar ban do programa de afiliados.
      </Callout>
    </StepsList>
  );
}
