import { Step, StepsList, Callout, FieldTable } from './components.jsx';

export default function T3_Workspace() {
  return (
    <StepsList>
      <Callout tone="info" title="O que é um workspace">
        Cada workspace é um <strong>nicho independente</strong>: tem seu próprio número
        de WhatsApp, seus próprios grupos cadastrados, seus próprios filtros de busca, e
        seu próprio inbox de ofertas pendentes. Você pode ter quantos quiser.
      </Callout>

      <Step n={1} title="Pensar na divisão por nicho">
        <p>
          Antes de criar, decida sua estratégia. Bons exemplos de divisão:
        </p>
        <FieldTable rows={[
          ['Workspace "Beauty"', 'Maquiagem, skincare, perfumes · grupos do nicho beleza'],
          ['Workspace "Tech"',   'Eletrônicos, fones, smart home · grupos de gadgets'],
          ['Workspace "Casa"',   'Decoração, cozinha, organização · grupos de casa'],
          ['Workspace "Moda"',   'Roupas, bolsas, calçados · grupos de moda'],
        ]} />
        <Callout tone="warning" title="Por que separar?">
          Se você jogar tudo num só workspace, vai mandar oferta de drone num grupo de
          skincare. Quanto mais focado o nicho, mais clique → mais comissão.
        </Callout>
      </Step>

      <Step n={2} title="Criar o primeiro workspace">
        <p>
          Na dashboard, clique em <strong>+ Novo workspace</strong>. Preencha:
        </p>
        <FieldTable rows={[
          ['Nome', 'Beauty Deals (obrigatório, qualquer string)'],
          ['Nicho', 'Beleza (opcional, ajuda a organizar)'],
          ['Termo de busca', 'skincare (palavra-chave principal pra busca ML)'],
          ['Desconto mínimo', '20 (% off — descarta ofertas com menos)'],
          ['Máx por rodada', '3 (limite de ofertas que cada busca traz)'],
          ['Intervalo (min)', '60 (quando auto-busca tá ligada)'],
          ['Frete grátis', 'Ligado (só ofertas com frete grátis)'],
          ['Só promoções', 'Ligado (só itens marcados como DEAL no ML)'],
        ]} />
      </Step>

      <Step n={3} title="Entender cada filtro">
        <p><strong>Termo de busca</strong>: vai como <code>?q=</code> na API de busca do ML.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Específico ("creme hidratante facial") = poucos resultados, alta relevância</li>
          <li>Genérico ("beleza") = muitos resultados, baixa relevância</li>
          <li>Recomendação: 2-3 palavras, sem caracteres especiais</li>
        </ul>

        <p className="mt-3"><strong>Desconto mínimo</strong>: o sistema calcula
        <code> (preço_original - preço) / preço_original * 100</code> e descarta abaixo do limite.</p>

        <p className="mt-3"><strong>Máx por rodada</strong>: limita quantas ofertas vão pro
        inbox a cada busca. Não significa "máximo total", e sim "máximo por execução".</p>

        <p className="mt-3"><strong>Intervalo</strong>: só importa se você ligar a auto-busca
        depois. Sugestão: 60 min (uma rodada por hora). Menor que 30 min pode rate-limitar.</p>
      </Step>

      <Step n={4} title="Salvar e explorar o workspace">
        <p>
          Depois de criar, clique no card do workspace na dashboard. Você vai pra tela
          de detalhe com 5 abas:
        </p>
        <FieldTable rows={[
          ['📊 Visão geral', 'Stats do workspace em uma página'],
          ['📱 WhatsApp', 'Conectar/desconectar número, ver QR code'],
          ['👥 Grupos', 'Cadastrar grupos cadastrados como staging'],
          ['🎯 Filtros', 'Editar filtros e ligar/desligar busca automática'],
          ['🛒 Ofertas', 'Inbox pendente, aprovar, rejeitar'],
        ]} />
      </Step>

      <Step n={5} title="Renomear ou editar depois">
        <p>
          Na página de detalhe, clique no nome do workspace pra editar o nome e o nicho
          (edit inline). Filtros mudam via aba "Filtros".
        </p>
      </Step>

      <Callout tone="success" title="Próximo passo">
        Workspace criado. Agora você precisa conectar um número de WhatsApp pra ele.
        Próximo tutorial: <em>Conectar WhatsApp e cadastrar grupos</em>.
      </Callout>
    </StepsList>
  );
}
