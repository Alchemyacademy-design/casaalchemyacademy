## Diagnóstico

Olhando os network logs do Supabase, o problema do login está claro:

1. **Signup retorna 200 mas SEM sessão** — a resposta inclui `confirmation_sent_at` e `role: ""` (vazio), indicando que o usuário foi criado mas **não confirmado**.
2. **Login retorna `invalid_credentials`** — o Supabase devolve esse código (em vez de `email_not_confirmed`) quando a opção *"Confirm email"* está ativa E o usuário ainda não confirmou. É o comportamento padrão atual do GoTrue por segurança.
3. Ou seja: **a confirmação de e-mail ainda está habilitada no projeto Supabase remoto**, apesar de ter sido desativada na intenção. O usuário `contact@casaalchemystudio.com` existe mas está com `email_confirmed_at = null`, por isso nunca consegue entrar.

O front-end está correto — o problema é 100% de configuração + estado do usuário no Supabase.

## Plano

### 1. Confirmar manualmente o usuário existente
Criar uma migration SQL que marca como confirmado qualquer usuário já cadastrado que esteja pendente, incluindo o `contact@casaalchemystudio.com`:

```sql
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmed_at      = coalesce(confirmed_at, now())
where email_confirmed_at is null;
```

Isso destrava o login imediato com a senha já cadastrada (`S3nh@S3gur@!`).

### 2. Garantir que a confirmação de e-mail está desativada
Pedir confirmação visual no painel: **Authentication → Sign In / Up → "Confirm email" = OFF**. Vou abrir o link direto no final do plano. Se essa flag continuar ligada, novos cadastros voltarão a falhar do mesmo jeito.

### 3. Ajustar mensagens de erro do front
No `Login.tsx`, quando o Supabase devolver `invalid_credentials`, mostrar uma mensagem mais útil que mencione tanto "senha incorreta" quanto "conta ainda não confirmada — fale com o admin", em vez de só sugerir reset.

### 4. Validar fim a fim
Após aplicar a migration, fazer login com `contact@casaalchemystudio.com` / `S3nh@S3gur@!` e confirmar redirect para `/dashboard` (ou `/plans`, conforme o `GlobalAccessController`).

## O que NÃO vou mexer
- Hook `useAuth`, `GlobalAccessController`, rotas, design — estão corretos.
- Signup flow — já está pronto para o cenário sem confirmação.
- Tabelas, roles, RLS — fora do escopo deste bug.
