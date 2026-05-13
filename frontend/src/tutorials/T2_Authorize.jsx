import { Step, StepsList, Callout, ExternalLink } from './components.jsx';
import { Icon } from '../components/Icon.jsx';

export default function T2_Authorize() {
  return (
    <StepsList>
      <Callout tone="info" title="O que vamos fazer">
        Linkar a aplicação que você criou no DevCenter à sua conta de afiliada do ML.
        Esse é um passo único — depois disso, o token renova automaticamente (sem
        precisar logar de novo) graças ao <code>offline_access</code>.
      </Callout>

      <Step n={1} title="Verifique se as envs estão configuradas">
        <p>
          Antes de tudo, confirme que no EasyPanel as variáveis <code>ML_CLIENT_ID</code>,
          <code>ML_CLIENT_SECRET</code> e <code>ML_REDIRECT_URI</code> estão preenchidas
          e o serviço foi reimplantado. Se não fez ainda, volta ao tutorial 1.
        </p>
      </Step>

      <Step n={2} title="Voltar ao dashboard">
        <p>
          Volte pra página inicial (<code>/</code>). Se as envs do ML não estão configuradas
          ainda, você verá o banner amarelo:
        </p>
        <div className="rounded-xl p-3 my-2"
             style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <span style={{ color: 'rgb(245,158,11)' }}>
            <Icon.Bell width={14} height={14} className="inline mr-1" />
            Mercado Livre não autorizado — Conecte sua conta de afiliada
          </span>
        </div>
      </Step>

      <Step n={3} title='Clicar em "Autorizar agora"'>
        <p>
          No banner amarelo (ou no onboarding wizard se for seu 1º acesso), clique em
          <strong> Autorizar agora</strong>. O sistema vai te redirecionar pra
          <ExternalLink href="https://auth.mercadolivre.com.br/authorization"> auth.mercadolivre.com.br</ExternalLink>.
        </p>
      </Step>

      <Step n={4} title="Fazer login com a conta da afiliada">
        <p>
          Use a <strong>mesma conta</strong> que criou o App e que tem a tag de afiliada.
          Se você já tava logado no ML em outra aba, ele pode aproveitar a sessão automaticamente.
        </p>
        <Callout tone="warning" title="Conta errada = token errado">
          Se você logar com uma conta diferente da afiliada, o token funciona pra buscar
          ofertas mas a atribuição de comissão não acontece (links levam pra "conta X"
          mas a tag <code>najubeautyclub</code> aponta pra "conta Y").
        </Callout>
      </Step>

      <Step n={5} title="Conceder as permissões">
        <p>
          O ML mostra uma tela perguntando se você autoriza o app <strong>najugroups</strong>
          a acessar:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ler dados públicos (produtos, buscas, categorias)</li>
          <li>Acessar offline (renovar token automaticamente)</li>
        </ul>
        <p>Clique em <strong>Permitir</strong>.</p>
      </Step>

      <Step n={6} title="Aguardar redirect de volta">
        <p>
          O ML te redireciona pra <code>{'<seu-domínio>/ml/callback?code=XXX'}</code>.
          O sistema processa automaticamente esse code e troca por um access_token + refresh_token.
        </p>
        <p>Se deu certo, você vê uma tela verde:</p>
        <div className="rounded-xl p-4 my-2 text-center"
             style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <Icon.Check width={32} height={32} className="mx-auto mb-2" style={{ color: 'rgb(16,185,129)' }} />
          <strong style={{ color: 'rgb(16,185,129)' }}>Mercado Livre autorizado</strong>
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>Pode fechar esta aba.</p>
        </div>
      </Step>

      <Step n={7} title="Voltar ao dashboard e confirmar">
        <p>
          O banner do dashboard agora deve mostrar verde:
        </p>
        <div className="rounded-xl p-3 my-2"
             style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <span style={{ color: 'rgb(16,185,129)' }}>
            <Icon.Check width={14} height={14} className="inline mr-1" />
            Mercado Livre conectado · user 1234567890 · token renova automaticamente
          </span>
        </div>
        <p>
          O token vence em 6 horas, mas o sistema renova automaticamente usando o
          <code> refresh_token</code> (válido por ~6 meses). Você nunca mais precisa
          se preocupar com isso, exceto se mudar a senha do ML ou revogar o app.
        </p>
      </Step>

      <Callout tone="danger" title="Se der erro 'invalid_redirect_uri'">
        Significa que o Redirect URI no app ML <strong>não bate</strong> com o
        <code> ML_REDIRECT_URI</code> do .env. Volte ao DevCenter, edite o app e
        confira caractere por caractere (especialmente <code>http</code> vs <code>https</code>,
        barra final, e o domínio exato).
      </Callout>

      <Callout tone="success" title="Pronto!">
        Mercado Livre conectado. Agora você pode criar workspaces e começar a buscar
        ofertas. Próximo tutorial: <em>Criar e configurar workspaces</em>.
      </Callout>
    </StepsList>
  );
}
