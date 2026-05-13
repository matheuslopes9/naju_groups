import { Step, StepsList, Callout, FieldTable } from './components.jsx';

export default function T4_Whatsapp() {
  return (
    <StepsList>
      <Callout tone="warning" title="ATENÇÃO: use um chip DEDICADO">
        Nunca conecte seu WhatsApp pessoal. O sistema usa Baileys (biblioteca não-oficial)
        que tem risco de ban pelo WhatsApp se detectado. Use um chip novo, comprado
        especificamente pra isso. R$ 15-30 num chip pré-pago resolve.
      </Callout>

      <Step n={1} title="Preparar o chip do bot">
        <p>Antes de conectar:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Insira o chip dedicado em um celular (qualquer um, pode ser o seu — só pra fazer cadastro)</li>
          <li>Instale o WhatsApp e cadastre o número normalmente</li>
          <li>Adicione esse número aos grupos onde você vai divulgar (ou crie um grupo de staging só seu primeiro pra testar)</li>
        </ol>
      </Step>

      <Step n={2} title="Iniciar conexão no dashboard">
        <p>
          Vá no workspace que você criou → aba <strong>📱 WhatsApp</strong> → clique em
          <strong> Conectar</strong>.
        </p>
        <p>
          Em alguns segundos, um QR code aparece no card central.
        </p>
      </Step>

      <Step n={3} title="Escanear o QR pelo celular do bot">
        <p>No celular onde o WhatsApp do bot está logado:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Abre WhatsApp</li>
          <li>Toca nos 3 pontos (Android) ou Configurações (iPhone)</li>
          <li>Vai em <strong>Aparelhos conectados</strong></li>
          <li>Toca em <strong>Conectar um aparelho</strong></li>
          <li>Aponta a câmera pro QR code no dashboard</li>
        </ol>
        <Callout tone="info" title="QR expira em ~60s">
          Se você demorar, o QR expira. O dashboard renova automaticamente — só
          espera o novo aparecer e tenta de novo.
        </Callout>
      </Step>

      <Step n={4} title="Confirmar conexão">
        <p>Quando conectar com sucesso:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>O badge muda pra <strong>WhatsApp conectado</strong> (verde)</li>
          <li>Aparece o número conectado</li>
          <li>Um toast verde diz "WhatsApp conectado"</li>
        </ul>
      </Step>

      <Step n={5} title="Cadastrar grupos disponíveis">
        <p>
          Vá pra aba <strong>👥 Grupos</strong>. O sistema lista TODOS os grupos onde o
          número do bot está. Cadastre os que você vai usar pra divulgar:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Clique em <strong>+ cadastrar</strong> ao lado do grupo desejado</li>
          <li>Ele vira tipo <strong>staging</strong> (você revisa antes de enviar)</li>
          <li>Repita para todos os grupos relevantes desse nicho</li>
        </ol>
        <Callout tone="info" title="Por que 'staging'?">
          Quando você aprova uma oferta no inbox, o sistema envia automaticamente
          pros grupos cadastrados como staging desse workspace. Como você aprovou
          manualmente, é "clique voluntário e consciente" (cláusula 1.10 dos termos ML).
        </Callout>
      </Step>

      <Step n={6} title="Se um grupo não aparecer na lista">
        <p>
          Adicione o número do bot ao grupo no WhatsApp e clique no botão de
          <strong> atualizar</strong> 🔄 na lista de grupos disponíveis.
        </p>
      </Step>

      <Step n={7} title="Reconexão automática">
        <p>
          Se o servidor reiniciar (redeploy, reboot), as sessões previamente conectadas
          são restauradas automaticamente. As credenciais ficam no volume
          <code> /app/auth_state/wa/&lt;workspaceId&gt;/</code>.
        </p>
        <Callout tone="danger" title="Cuidado com 'Desconectar' no dashboard">
          O botão <strong>Desconectar</strong> faz logout REAL do WhatsApp (não só corta
          a conexão local). Você vai ter que escanear o QR de novo. Use só se realmente
          quiser trocar o número.
        </Callout>
      </Step>

      <Callout tone="success" title="Pronto!">
        WhatsApp conectado e grupos cadastrados. Agora vem a parte mais legal:
        buscar ofertas e curar. Próximo tutorial: <em>Fluxo de curadoria e aprovação</em>.
      </Callout>
    </StepsList>
  );
}
