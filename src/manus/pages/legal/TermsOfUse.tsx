import LegalPageLayout from "./LegalPageLayout";

export default function TermsOfUse() {
  return (
    <LegalPageLayout
      title="Termos de Uso"
      description="Condições de uso da plataforma educacional Casa Alchemy Academy: cadastro, cursos, eventos, workshops e integrações opcionais."
      updatedAt="21 de julho de 2026"
    >
      <p>
        Estes Termos regem o uso da plataforma Casa Alchemy Academy, disponível em{" "}
        <em>casaalchemyacademy.lovable.app</em>. Ao criar uma conta ou acessar o serviço, você concorda com estes termos.
      </p>

      <h2>1. Aceitação</h2>
      <p>
        Se você não concordar com estes termos, não utilize a plataforma. Podemos atualizar este documento; alterações
        relevantes serão comunicadas aos usuários autenticados.
      </p>

      <h2>2. Cadastro e segurança da conta</h2>
      <ul>
        <li>Você deve fornecer informações verdadeiras no cadastro.</li>
        <li>Você é responsável pela guarda das suas credenciais e por toda atividade realizada na sua conta.</li>
        <li>É permitido autenticar via e-mail e senha ou via Google Sign-In.</li>
      </ul>

      <h2>3. Cursos e materiais</h2>
      <p>
        Membros ativos têm acesso aos cursos, aulas, guias e materiais complementares publicados na plataforma. Certificados
        de conclusão são emitidos conforme os critérios de cada curso.
      </p>

      <h2>4. Workshops e eventos</h2>
      <p>
        Workshops ao vivo e eventos são organizados pela Casa Alchemy Academy. A inscrição fica registrada na sua conta e pode
        ser sincronizada com a sua Google Agenda quando você autorizar a integração.
      </p>

      <h2>5. Comunidade e conduta</h2>
      <ul>
        <li>Trate os demais membros com respeito.</li>
        <li>Não publique conteúdo ilegal, ofensivo, discriminatório ou que infrinja direitos de terceiros.</li>
        <li>Não envie spam nem utilize a comunidade para fins comerciais não autorizados.</li>
        <li>Reservamo-nos o direito de moderar, remover conteúdo e suspender contas que violem estas regras.</li>
      </ul>

      <h2>6. Propriedade intelectual</h2>
      <p>
        Todos os conteúdos (aulas, textos, imagens, vídeos, marca) são de propriedade da Casa Alchemy Studio ou de seus
        licenciadores. É proibido copiar, redistribuir, revender ou compartilhar credenciais e materiais fora da plataforma.
      </p>

      <h2>7. Integrações de terceiros</h2>
      <p>
        A plataforma integra-se com Supabase, Google (login e Google Agenda), Stripe, Resend e HubSpot. Cada integração é
        governada também pelos termos do respectivo fornecedor. A conexão com a Google Agenda é <strong>opcional</strong> e
        pode ser revogada a qualquer momento em <em>/profile</em>.
      </p>

      <h2>8. Disponibilidade do serviço</h2>
      <p>
        Buscamos manter a plataforma disponível de forma contínua, mas o serviço pode passar por manutenções, atualizações ou
        indisponibilidades. Não garantimos operação ininterrupta ou livre de erros.
      </p>

      <h2>9. Pagamentos e assinaturas</h2>
      <p>
        Planos pagos podem ser oferecidos e processados via Stripe. Condições específicas de preço, período e cancelamento são
        apresentadas no momento da contratação. [CONFIRMAÇÃO NECESSÁRIA: política definitiva de reembolso e cancelamento a ser
        validada pelo responsável comercial.]
      </p>

      <h2>10. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida pela legislação aplicável, a Casa Alchemy Academy não será responsável por danos
        indiretos, lucros cessantes ou perda de dados decorrentes do uso da plataforma.
      </p>

      <h2>11. Suspensão e encerramento</h2>
      <p>
        Podemos suspender ou encerrar contas que violem estes termos. Você pode solicitar o encerramento da sua conta a
        qualquer momento conforme <a href="/exclusao-de-dados">Exclusão de conta e dados</a>.
      </p>

      <h2>12. Alterações</h2>
      <p>
        Podemos atualizar estes termos. A versão vigente terá sempre a data de atualização indicada no topo desta página.
      </p>

      <h2>13. Contato</h2>
      <p>
        Dúvidas sobre estes termos:{" "}
        <a href="mailto:contact@casaalchemystudio.com">contact@casaalchemystudio.com</a>.
      </p>

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "var(--aa-text-light)" }}>
        Este documento deve ser validado pelo responsável legal antes de ser considerado texto jurídico definitivo. Cláusulas
        de foro, jurisdição e legislação aplicável dependem de confirmação da entidade contratante.
      </p>
    </LegalPageLayout>
  );
}