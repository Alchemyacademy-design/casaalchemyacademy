import LegalPageLayout from "./LegalPageLayout";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Política de Privacidade"
      description="Como a Casa Alchemy Academy coleta, usa e protege os seus dados pessoais, incluindo o uso opcional da Google Agenda."
      updatedAt="21 de julho de 2026"
    >
      <p>
        Esta Política descreve como a Casa Alchemy Academy trata os dados pessoais dos usuários da plataforma
        <em> casaalchemyacademy.lovable.app</em>. Ela é escrita em linguagem clara e reflete o funcionamento real do aplicativo.
      </p>

      <h2>1. Quem somos</h2>
      <p>
        A Casa Alchemy Academy é uma plataforma educacional operada por Casa Alchemy Studio, oferecendo cursos, materiais,
        workshops e eventos ao vivo para membros autenticados. Para questões de privacidade, escreva para{" "}
        <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro e autenticação:</strong> nome, e-mail, senha (criptografada) e provedor de login (e-mail ou Google).</li>
        <li><strong>Perfil:</strong> avatar, biografia e preferências informadas voluntariamente pelo usuário.</li>
        <li><strong>Uso da plataforma:</strong> cursos acessados, aulas concluídas, notas, comentários da comunidade, inscrições em eventos e workshops, certificados emitidos.</li>
        <li><strong>Suporte:</strong> mensagens enviadas por canais oficiais.</li>
        <li><strong>Dados técnicos:</strong> registros mínimos necessários para segurança, prevenção de fraude e diagnóstico de erros.</li>
      </ul>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Criar e manter sua conta e autenticar seus acessos.</li>
        <li>Disponibilizar cursos, eventos, workshops, certificados e a área de comunidade.</li>
        <li>Registrar inscrições em eventos e workshops.</li>
        <li>Enviar comunicações operacionais relacionadas ao seu uso da plataforma.</li>
        <li>Cumprir obrigações legais e responder a solicitações do titular.</li>
      </ul>

      <h2>4. Uso de dados da Google Agenda</h2>
      <p>
        A conexão da sua conta Google à Casa Alchemy Academy é <strong>opcional</strong> e depende do seu consentimento explícito.
        Ela é utilizada exclusivamente para adicionar, atualizar e remover, na sua Google Agenda, os eventos e workshops da Casa
        Alchemy Academy que você escolher.
      </p>
      <ul>
        <li>Escopo solicitado: <code>https://www.googleapis.com/auth/calendar.events</code>.</li>
        <li>Não lemos nem armazenamos os demais compromissos da sua agenda pessoal.</li>
        <li><strong>Não usamos</strong> os dados da Google Agenda para publicidade.</li>
        <li><strong>Não vendemos</strong> dados da Google Agenda a terceiros.</li>
        <li><strong>Não criamos</strong> perfis publicitários com esses dados.</li>
        <li>Tokens OAuth são armazenados <strong>criptografados</strong> no backend (AES-GCM) e nunca são enviados ao frontend.</li>
        <li>Você pode desconectar sua conta Google a qualquer momento em <em>/profile</em>. A desconexão revoga o token no lado do Google e apaga os dados de conexão do nosso banco.</li>
      </ul>
      <div className="legal-callout">
        O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google aderem à{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
        incluindo os requisitos de Uso Limitado (<em>Limited Use</em>).
      </div>

      <h2>5. Compartilhamento com fornecedores</h2>
      <p>Utilizamos os seguintes fornecedores, comprovadamente integrados ao aplicativo:</p>
      <ul>
        <li><strong>Supabase</strong> — banco de dados, autenticação e funções de backend.</li>
        <li><strong>Google</strong> — login opcional e integração com Google Agenda quando autorizada pelo usuário.</li>
        <li><strong>Stripe</strong> — processamento de pagamentos de assinaturas.</li>
        <li><strong>Resend</strong> — envio de e-mails transacionais.</li>
        <li><strong>HubSpot</strong> — gestão de leads que optaram por receber materiais gratuitos.</li>
      </ul>

      <h2>6. Segurança</h2>
      <p>
        Aplicamos controles como criptografia em repouso para tokens OAuth, políticas de acesso por linha (RLS) no banco de
        dados, autenticação por JWT e princípio do menor privilégio nas funções de backend. Nenhum sistema é 100% seguro, mas
        trabalhamos continuamente para mitigar riscos.
      </p>

      <h2>7. Seus direitos</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>Acessar e atualizar os dados do seu perfil em <em>/profile</em>.</li>
        <li>Desconectar a Google Agenda em <em>/profile</em>.</li>
        <li>Solicitar exclusão da sua conta e dos dados associados — veja{" "}
          <a href="/exclusao-de-dados">Exclusão de conta e dados</a>.
        </li>
        <li>Solicitar esclarecimentos escrevendo para <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.</li>
      </ul>

      <h2>8. Retenção</h2>
      <p>
        Mantemos dados enquanto sua conta estiver ativa e pelo tempo necessário para cumprir obrigações legais, contábeis e de
        segurança. Após a exclusão da conta, dados de identificação são removidos; registros mínimos podem ser retidos quando
        exigidos por lei (por exemplo, comprovantes de pagamento).
      </p>

      <h2>9. Contato</h2>
      <p>
        Para dúvidas sobre privacidade ou exercício de direitos, escreva para{" "}
        <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--aa-text-light)" }}>
        Este texto foi redigido com base no funcionamento real do aplicativo e deve ser validado pelo responsável legal antes
        de ser considerado aviso jurídico definitivo.
      </p>
    </LegalPageLayout>
  );
}