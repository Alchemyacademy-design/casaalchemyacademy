import LegalPageLayout from "./LegalPageLayout";

export default function DataDeletion() {
  return (
    <LegalPageLayout
      title="Exclusão de conta e dados"
      description="Como solicitar a exclusão da sua conta na Casa Alchemy Academy, desconectar a Google Agenda e revogar acessos."
    >
      <p>
        Você tem o direito de solicitar a exclusão da sua conta e dos dados associados a qualquer momento. Esta página
        descreve os passos e o que acontece após a solicitação.
      </p>

      <h2>1. Desconectar a Google Agenda</h2>
      <p>
        Se você conectou sua conta Google à Casa Alchemy Academy, o primeiro passo é revogar essa conexão:
      </p>
      <ul>
        <li>Entre na plataforma e vá até <em>/profile</em>.</li>
        <li>No cartão "Integração com Google Agenda", clique em <strong>Desconectar</strong>.</li>
        <li>Essa ação revoga o token junto ao Google e apaga a conexão do nosso banco de dados.</li>
        <li>
          Alternativamente, você pode revogar diretamente na sua Conta Google:{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>.
        </li>
      </ul>

      <h2>2. Solicitar exclusão da conta</h2>
      <p>
        Envie um e-mail para{" "}
        <a href="mailto:contact@casaalchemystudio.com?subject=Exclus%C3%A3o%20de%20conta">
          contact@casaalchemystudio.com
        </a>{" "}
        a partir do endereço cadastrado na plataforma, com o assunto <em>"Exclusão de conta"</em>. Confirmaremos a
        identidade e processaremos a solicitação.
      </p>
      <div className="legal-callout">
        [CONFIRMAÇÃO NECESSÁRIA] O fluxo de exclusão automática dentro do aplicativo ainda não está disponível como
        autoatendimento. A exclusão é atualmente realizada mediante solicitação por e-mail.
      </div>

      <h2>3. O que é apagado</h2>
      <ul>
        <li>Dados de perfil (nome, avatar, biografia, preferências).</li>
        <li>Progresso em cursos, notas, comentários e reações da comunidade.</li>
        <li>Inscrições em eventos e workshops.</li>
        <li>Conexão com a Google Agenda e tokens OAuth associados.</li>
        <li>Certificados emitidos deixam de estar vinculados à sua conta.</li>
      </ul>

      <h2>4. O que pode ser retido</h2>
      <p>
        Podemos manter registros mínimos exigidos por lei ou necessários para segurança, prevenção de fraude e obrigações
        contábeis (por exemplo, comprovantes de pagamento processados via Stripe). Esses registros permanecem em ambiente
        restrito e não são utilizados para outras finalidades.
      </p>

      <h2>5. Prazo</h2>
      <p>
        A exclusão é processada em prazo razoável após a confirmação da solicitação. [CONFIRMAÇÃO NECESSÁRIA: prazo oficial
        a ser confirmado pelo responsável.]
      </p>

      <h2>6. Contato</h2>
      <p>
        Dúvidas: <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>
    </LegalPageLayout>
  );
}