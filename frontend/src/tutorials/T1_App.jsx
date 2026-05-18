import { useEffect, useState } from 'react';
import { Step, StepsList, Callout, CopyableField, FieldTable, ExternalLink } from './components.jsx';

export default function T1_App() {
  // Detecta a origem atual pra montar o Redirect URI real (não hardcoded)
  const [origin, setOrigin] = useState('https://najubeautyclub.azespo.com.br');
  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);
  const redirectUri = `${origin}/ml/callback`;

  return (
    <StepsList>
      <Callout tone="info" title="O que vamos fazer">
        Registrar uma aplicação OAuth no portal de desenvolvedores do Mercado Livre. Sem isso,
        nenhuma chamada à API ML funciona (todos os endpoints retornam <code>403 forbidden</code>
        desde o PolicyAgent 2024). O processo é gratuito e leva 5 a 10 minutos.
      </Callout>

      <Step n={1} title="Acessar o DevCenter do Mercado Livre">
        <p>
          Abra <ExternalLink href="https://developers.mercadolivre.com.br/devcenter">developers.mercadolivre.com.br/devcenter</ExternalLink> e
          faça login com a <strong>mesma conta da sua afiliada</strong> (a conta dona da tag <code>najubeautyclub</code>).
        </p>
        <Callout tone="warning" title="Use a conta certa">
          Se você logar com outra conta ML, o token gerado vai pertencer a essa outra conta e
          não a sua de afiliada — as estatísticas e atribuição de cliques não vão funcionar.
        </Callout>
      </Step>

      <Step n={2} title='Clicar em "Criar aplicação"'>
        <p>
          No DevCenter, há um botão <strong>"Crie sua primeira aplicação"</strong> (ou
          <strong> "Criar aplicação"</strong> se você já tem outras). Clica nele para
          abrir o formulário de cadastro.
        </p>
      </Step>

      <Step n={3} title="Preencher os dados da aplicação">
        <p>Use exatamente esses valores nos campos:</p>
        <FieldTable rows={[
          ['Nome', 'naju-groups-bot'],
          ['Nome curto', 'najugroups'],
          ['Descrição', 'Bot pessoal para curadoria de ofertas em grupos de WhatsApp'],
          ['URL do site', origin],
        ]} />
        <Callout tone="info" title="Nome curto e único">
          O "nome curto" precisa ser único no ML inteiro. Se <code>najugroups</code> der erro
          de duplicado, tente <code>najugroups-bot</code> ou <code>najubeauty-ml</code>.
        </Callout>
      </Step>

      <Step n={4} title="Configurar o Redirect URI (CRÍTICO)">
        <p>
          Esse campo é o que mais costuma dar problema. Ele deve ser <strong>EXATAMENTE</strong>
          igual ao valor que está no <code>.env</code> do seu deploy. Use este valor literal:
        </p>
        <CopyableField
          label="Redirect URI"
          value={redirectUri}
          helper="Caractere por caractere. Sem barra no final, sem espaços."
        />
        <Callout tone="danger" title="Não pode mudar depois">
          Se você errar essa URL, a autorização vai falhar com erro <code>invalid_redirect_uri</code>.
          Confira <em>duas vezes</em> antes de salvar. Se errar, você pode editar a app
          depois — mas precisa esperar alguns minutos pra propagar.
        </Callout>
      </Step>

      <Step n={5} title="Selecionar os escopos">
        <p>Marque <strong>todos</strong> os três escopos abaixo:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>read</code> — ler produtos, buscas, categorias</li>
          <li><code>offline_access</code> — receber <code>refresh_token</code> (renovação automática)</li>
          <li><code>write</code> — opcional, mas algumas APIs exigem mesmo só pra ler</li>
        </ul>
        <Callout tone="warning" title="offline_access é obrigatório">
          Sem o <code>offline_access</code>, o ML não devolve <code>refresh_token</code>.
          Resultado: o token vence em 6 horas e você teria que reautorizar manualmente o tempo todo.
        </Callout>
      </Step>

      <Step n={6} title="Tópicos de notificação (deixe em branco)">
        <p>
          Como o sistema atual só faz <em>leitura</em> via API (não recebe webhooks de
          mudança de produto/venda), <strong>não marque nenhum tópico</strong>. Pode pular essa
          seção.
        </p>
      </Step>

      <Step n={7} title="Salvar e copiar credenciais">
        <p>
          Depois de salvar, o ML mostra a aplicação criada com:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>App ID</strong> (também chamado de Client ID) — número longo, ~16 dígitos</li>
          <li><strong>Secret Key</strong> (Client Secret) — string aleatória ~32 caracteres</li>
        </ul>
        <Callout tone="danger" title="Guarde o Secret AGORA">
          O Secret só é mostrado uma vez de forma completa. Copie pra um bloco de notas ou
          gerenciador de senhas antes de fechar a aba. Se perder, você consegue regenerar
          (mas tem que reconfigurar tudo).
        </Callout>
      </Step>

      <Step n={8} title="Cadastrar dados no dashboard (Configurações)">
        <p>
          Volta no AdManager e abre <strong>Configurações</strong> no menu (ou
          <a href="/configuracoes" className="text-gradient hover:underline"> clica aqui</a>).
          Preencha:
        </p>
        <FieldTable rows={[
          ['Client ID', 'cole aqui o App ID'],
          ['Client Secret', 'cole aqui o Secret Key (será criptografado antes de salvar)'],
          ['Redirect URI', redirectUri],
          ['Tag de afiliado', 'najubeautyclub'],
        ]} />
        <p>
          Clique em <strong>Salvar</strong>. Os dados ficam armazenados no Postgres
          (Secret criptografado com AES-256-GCM). Não precisa reimplantar — atualiza
          em tempo real.
        </p>
        <Callout tone="info" title="Alternativa: variáveis de ambiente">
          Você também pode preencher via <code>ML_CLIENT_ID</code>, <code>ML_CLIENT_SECRET</code>,
          <code> ML_REDIRECT_URI</code> e <code>ML_AFFILIATE_TAG</code> no EasyPanel. O
          dashboard tem prioridade — se houver config no dashboard, ela vence as envs.
        </Callout>
      </Step>

      <Callout tone="success" title="Pronto pra próxima etapa">
        Com o App criado e as envs configuradas, agora você precisa <strong>autorizar</strong>
        sua conta. Vá pro próximo tutorial: <em>Autorizar e conectar ao Mercado Livre</em>.
      </Callout>
    </StepsList>
  );
}
