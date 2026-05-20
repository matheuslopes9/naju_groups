import { Step, StepsList, Callout, ExternalLink } from './components.jsx';

export default function T6_Compliance() {
  return (
    <StepsList>
      <Callout tone="danger" title="Leitura obrigatória">
        Os Termos do programa de Afiliados ML mudam de vez em quando. Releia anualmente
        em <ExternalLink href="https://www.mercadolivre.com.br/ajuda/30228">mercadolivre.com.br/ajuda/30228</ExternalLink>.
        Este tutorial reflete o estado em 2026-05.
      </Callout>

      <Step n={1} title="Por que o sistema é SEMI-automático e não 100% auto">
        <p>
          Várias cláusulas dos Termos proíbem automação total de distribuição de links.
          O sistema é desenhado pra ficar dentro das regras:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>1.9</strong>: proibido "software client-side para distribuição de links"</li>
          <li><strong>7.3</strong>: proibido disparo massivo</li>
          <li><strong>1.10</strong>: clique tem que ser voluntário e consciente</li>
        </ul>
        <p>
          Como você aprova cada oferta manualmente, o ato final é seu — não é o bot
          "distribuindo links sozinho", é você usando uma ferramenta de curadoria.
        </p>
      </Step>

      <Step n={2} title="Shorteners de terceiros são proibidos">
        <p>
          <strong>1.8</strong>: nunca encurte os links com bit.ly, tinyurl, etc. O sistema
          já está correto: só anexa <code>matt_word</code>/<code>matt_tool</code> ao
          permalink original do ML.
        </p>
        <Callout tone="warning" title="Não modifique o link enviado">
          Quando o sistema envia uma oferta, o link vai com sua tag <code>najubeautyclub</code>.
          Não cole esse link em outro encurtador antes de divulgar.
        </Callout>
      </Step>

      <Step n={3} title="Cadastrar suas mídias no Portal do Afiliado">
        <p>
          <strong>1.3</strong>: mídias precisam estar cadastradas e aprovadas no
          <ExternalLink href="https://www.mercadolivre.com.br/l/afiliados-portal-do-afiliado"> Portal do Afiliado</ExternalLink>.
          Sem isso, divulgações não geram comissão mesmo sendo válidas.
        </p>
        <p>
          Cadastre cada grupo de WhatsApp (link de convite) lá. Se aparecer como "Outra rede",
          use isso.
        </p>
      </Step>

      <Step n={4} title="CONAR: identificação como publicidade">
        <p>
          <strong>5.1</strong>: toda divulgação tem que ser identificada como publicidade.
          <strong> O sistema NÃO inclui tag automática</strong> — você assume essa
          responsabilidade no nome do grupo, descrição ou mensagens.
        </p>
        <Callout tone="warn" title="Risco se omitir">
          <code>#publi</code>, <code>#ad</code>, <code>#publicidade</code>,
          <code>#parceriapaga</code> são todas reconhecidas pelo CONAR. Use pelo menos uma
          em algum lugar (nome do grupo, descrição, ou edite o footer dos anúncios em
          <code>src/server/formatter.js</code>). Sem identificação, multa do CONAR pode chegar
          a R$ 50k+ por infração reincidente.
        </Callout>
      </Step>

      <Step n={5} title="Janela de atribuição de 24h">
        <p>
          <strong>1.6</strong>: cliques em links de afiliado têm janela de 24 horas para
          gerar comissão. Se o usuário clica hoje e compra daqui 3 dias, você não ganha.
        </p>
        <p>
          Isso significa: melhor divulgar ofertas com <strong>urgência real</strong>
          (queima de estoque, cupom expira amanhã, preço relâmpago). Membros do grupo
          tendem a clicar/comprar logo.
        </p>
      </Step>

      <Step n={6} title="Pagamento e mínimos">
        <p>
          <strong>3.2 / 3.3</strong>: condições de pagamento:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Mínimo pra saque: <strong>R$ 30 acumulados</strong></li>
          <li>Precisa de <strong>3 pessoas distintas</strong> tendo comprado</li>
          <li>Validação até último dia do mês seguinte</li>
          <li>Pagamento em até <strong>60 dias após aprovação</strong>, via Mercado Pago</li>
          <li>Conta Mercado Pago é obrigatória — sem isso, suspensão em 30 dias</li>
        </ul>
      </Step>

      <Step n={7} title="O que NUNCA fazer">
        <ul className="list-disc pl-5 space-y-1">
          <li>Conta dupla / múltiplas contas pra mesma pessoa (<strong>1.2.1</strong>)</li>
          <li>Comprar com sua própria tag (auto-fraude)</li>
          <li>Simular cliques, usar tráfego pago no Google com palavra "Mercado Livre" (<strong>4.4.ii</strong>)</li>
          <li>E-mail marketing sem consentimento (<strong>4.3.a</strong>)</li>
          <li>Web scraping do site do ML (<strong>4.3.c</strong>)</li>
          <li>Se passar por representante oficial (<strong>4.3.i</strong>)</li>
          <li>Divulgar em sites de torrent/streaming pirata (<strong>4.3.d</strong>)</li>
          <li>Produtos proibidos: medicamentos, armas, recall, etc (<strong>1.5</strong>)</li>
        </ul>
      </Step>

      <Step n={8} title="Comissões por categoria (estimativa)">
        <p>Varia entre 7% e 16% dependendo da categoria. Algumas das mais altas:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Moda &amp; Beleza: até 16%</li>
          <li>Casa &amp; Decoração: 10-12%</li>
          <li>Eletrônicos: 5-7% (concorrência forte)</li>
          <li>Eletrodomésticos: 8-10%</li>
        </ul>
        <p>Confirme a tabela atualizada no painel do afiliado.</p>
      </Step>

      <Callout tone="success" title="Você está pronto">
        Sabendo tudo isso, é só consistência: revisar ofertas com critério, cadastrar
        mídias no portal, identificar publicidade no nome/descrição do grupo e nunca
        exagerar no volume. Boa sorte 💜
      </Callout>
    </StepsList>
  );
}
