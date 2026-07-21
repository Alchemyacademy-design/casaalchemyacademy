import LegalPageLayout from "./LegalPageLayout";

export default function Support() {
  return (
    <LegalPageLayout
      title="Suporte e Contato"
      description="Como falar com a Casa Alchemy Academy e resolver problemas comuns de login, cursos e integração com a Google Agenda."
    >
      <p>
        Estamos aqui para ajudar. Antes de escrever, veja se sua dúvida está resolvida nos guias abaixo.
      </p>

      <h2>Canal oficial</h2>
      <p>
        E-mail: <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>
        <br />
        Site institucional:{" "}
        <a href="https://www.casaalchemystudio.com/" target="_blank" rel="noopener noreferrer">
          casaalchemystudio.com
        </a>
      </p>

      <h2>Problemas de login</h2>
      <ul>
        <li>Verifique se está usando o mesmo e-mail com o qual se cadastrou.</li>
        <li>Se esqueceu a senha, use a opção <em>Reset password</em> na tela de login.</li>
        <li>Se entrou com Google, use o botão <em>Continue with Google</em> em vez de e-mail e senha.</li>
        <li>Se o link de confirmação não chegar, verifique a caixa de spam.</li>
      </ul>

      <h2>Problemas com cursos e certificados</h2>
      <ul>
        <li>Confirme se sua assinatura está ativa em <em>/profile</em>.</li>
        <li>Recarregue a página do curso; o progresso é salvo automaticamente.</li>
        <li>Certificados aparecem em <em>/profile</em> assim que os critérios do curso são cumpridos.</li>
      </ul>

      <h2>Problemas com a Google Agenda</h2>
      <ul>
        <li>A conexão é opcional e feita em <em>/profile</em>, no cartão "Integração com Google Agenda".</li>
        <li>Se autorizou e não vê os eventos, tente desconectar e conectar novamente.</li>
        <li>Para revogar o acesso diretamente na sua Conta Google, acesse{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>.
        </li>
        <li>Só sincronizamos os eventos e workshops da Casa Alchemy Academy que você escolher — não lemos sua agenda pessoal.</li>
      </ul>

      <h2>Solicitar exclusão da conta</h2>
      <p>
        Veja a página <a href="/exclusao-de-dados">Exclusão de conta e dados</a> para o procedimento completo.
      </p>

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--aa-text-light)" }}>
        Tempo de resposta é feito por melhor esforço. [CONFIRMAÇÃO NECESSÁRIA: SLA oficial de suporte, caso seja definido.]
      </p>
    </LegalPageLayout>
  );
}