# 🗄️ Arquitetura de Banco de Dados e Segurança (supabase.md)

## 1. Visão Geral e Filosofia
Este documento rege a infraestrutura de dados no Supabase (PostgreSQL). O sistema foi arquitetado para suportar **Multi-Tenancy** (Isolamento de Perfis/Workspaces), **Recorrências Inteligentes** e **Segurança em Nível de Linha (RLS)** de alta performance.

O banco de dados utiliza o padrão **Ledger Imutável (Append-Only Architecture)** [2, 3]. Não existe uma coluna estática de "Saldo Atual" que é sobrescrita. O saldo é sempre o resultado aritmético da soma do histórico de transações e aportes futuros, garantindo trilha de auditoria e capacidade preditiva [4].

## 2. Modelagem de Dados (Schema Core)
Os tipos de dados foram escolhidos focando em precisão financeira:
*   Valores monetários usam sempre `NUMERIC(12,2)` para evitar falhas de arredondamento inerentes a tipos de ponto flutuante [5, 6].
*   Chaves primárias são sempre `UUID` (geradas via `gen_random_uuid()`) por segurança e escalabilidade.

### 2.1. Tabelas Principais
1.  **`workspaces`**: Define o perfil do usuário.
    *   `id` (UUID), `name` (Texto: "Pessoal" ou "Empresa / O Montador").
2.  **`categories`**: Dicionário de classificação dos gastos.
    *   `id`, `workspace_id` (FK), `name`, `macro_pilar` (Enum: Sobrevivência, Estilo de Vida, Liberdade), `icon` (String para o Lucide Icons) [7, 8].
3.  **`transactions`**: O Ledger Financeiro.
    *   `id` (UUID), `workspace_id` (FK), `user_id` (UUID auth).
    *   `amount` (NUMERIC 12,2) [5].
    *   `type` (Enum: 'income', 'expense') [9].
    *   `date` (DATE - Data de competência/previsão).
    *   **Controle de Recorrência (Chave da Lógica de Negócio):**
        *   `series_id` (UUID - Nullable): Agrupa transações que pertencem à mesma assinatura/parcelamento.
        *   `recurrence_rule` (String - Ex: 'monthly', 'weekly', 'yearly').
        *   `recurrence_end_date` (DATE - Até quando a repetição deve ocorrer).
        *   `installment_current` e `installment_total` (Integers para compras parceladas, ex: Parcela 3 de 10).

## 3. Lógica de Transações Recorrentes e Edição
A interface de usuário irá delegar a gestão de recorrência para o banco de dados. Uma assinatura (ex: Plano de Saúde mensal por 24 meses) NÃO é um único registro. São 24 registros projetados no futuro com o mesmo `series_id`.

**Regras para o Front-end/Edge Functions ao Editar:**
1.  **Editar Apenas Atual:** Atualiza apenas o registro que possui o `id` específico. Remove ou altera o `series_id` se o vínculo da série for quebrado.
2.  **Editar Desta em Diante:** Busca a transação atual e atualiza ela e todas as transações com o mesmo `series_id` cuja `date` seja `>=` à data da transação editada.
3.  **Editar Todas:** Atualiza (via SQL `UPDATE`) todos os registros da tabela `transactions` que compartilham o exato `series_id`.
4.  **Criar Recorrência de uma transação única:** Gera um novo `series_id`, anexa à transação atual e insere (via loop/Edge Function) as transações futuras baseadas na `recurrence_rule` até atingir o `recurrence_end_date`.

## 4. Segurança em Nível de Linha (RLS - Row Level Security)
Sem RLS, a API do Supabase expõe todos os dados. RLS está ATIVADO (ENABLED) em todas as tabelas.

### 4.1. Isolamento Multi-Tenant (Workspaces)
As políticas RLS não apenas isolam o usuário, mas também o Workspace que ele está visualizando naquele momento.
*   O aplicativo front-end passa o `workspace_id` ativo no cabeçalho ou nas claims do JWT do usuário [1].

### 4.2. Otimização de Performance de RLS
A função `auth.uid()` nunca deve ser chamada repetidamente por linha. Deve ser envelopada num sub-select para que o PostgreSQL faça cache (InitPlan) otimizando consultas de 170ms para menos de 2ms [10, 11].

```sql
-- Padrão Exigido para Políticas (Performance Otimizada)
CREATE POLICY "Isolamento de Usuario e Workspace" 
ON transactions 
FOR ALL 
USING (
  user_id = (select auth.uid()) 
  AND workspace_id = (select auth.jwt()->>'active_workspace_id')::uuid
);
(Nota: Sempre garantir índices (B-tree) nas colunas user_id e workspace_id para prevenir table scans catastróficos
).

---