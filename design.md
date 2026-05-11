# 🎨 Design System e Arquitetura de UI/UX (design.md)

## 1. Visão Geral e Filosofia
Este documento define as diretrizes de interface (UI) e experiência do usuário (UX) do aplicativo de Gestão Financeira. 
O objetivo é ter uma interface **premium, minimalista e de altíssima performance**, fugindo do design padronizado de "templates gerados por IA" [1, 2]. A experiência deve ser "Mobile-First", pensada para uso rápido em ambientes de distração (ex: fila do supermercado) [4].

## 2. Identidade Visual (Fugindo do "Padrão Lovable")
Para garantir uma identidade única e profissional, o design não deve depender exclusivamente dos estilos padrão do Tailwind/Shadcn [3].
*   **Tipografia:** Uso de fontes modernas e precisas para dados financeiros. Sugestão: *Plus Jakarta Sans* para textos e *Geist Mono* para os valores numéricos, garantindo alinhamento perfeito de casas decimais [6].
*   **Paleta de Cores:** Design acromático (focado no conteúdo) com uso inteligente de "Cores Semânticas" baseadas nos 3 Macro Pilares:
    *   🔴 *Sobrevivência:* Vermelho/Laranja suave (alerta/essencial).
    *   🔵 *Estilo de Vida:* Azul/Roxo (conforto/flexibilidade).
    *   🟢 *Liberdade:* Verde (crescimento/investimentos).
*   **Bibliotecas de UI Avançadas:** 
    *   Uso do `Shadcn/ui` apenas como base funcional (tabelas, formulários) [7].
    *   Integração com `Tremor.so` para gráficos financeiros polidos e de alta densidade analítica (AreaCharts, BarLists) [8, 9].
    *   Uso de bibliotecas alternativas como `Monet` ou `Magic UI` para seções de impacto e animações fluidas [10, 11].

## 3. Core UX: O Mundo Real
### 3.1. Privacidade por Padrão (O "Olhinho")
*   Ao abrir o aplicativo, **absolutamente todos os valores financeiros** (Saldo, Totais, Transações do feed) devem vir **borrados (blur) por padrão**.
*   Um ícone de "Olho" (Eye/EyeOff do Lucide Icons) deve ficar fixo no cabeçalho (Header). Um único toque neste ícone alterna a visibilidade de toda a interface.

### 3.2. Agilidade no Caixa (Thumb Zone & Offline-First)
*   A ação principal (Botão "+ Nova Transação") deve ser um FAB (Floating Action Button) gigante na parte inferior da tela, de fácil alcance para o polegar usando apenas uma mão [4].
*   **Teclado Inteligente:** Ao clicar para adicionar valor, o app deve invocar automaticamente o teclado numérico do sistema.
*   **Offline-First & Optimistic UI:** Se o usuário estiver no subsolo do supermercado sem 4G, o app deve abrir e salvar a transação instantaneamente usando um banco local (ex: SQLite/WatermelonDB). A sincronização com o Supabase ocorre silenciosamente em background quando a rede voltar [5, 12, 13]. O usuário não deve ver "spinners" de carregamento [14, 15].

### 3.3. Seletor de Workspace (Multi-Tenant)
*   No topo da tela, ao lado do "Olhinho", haverá um *Dropdown* de Workspace.
*   O usuário poderá alternar instantaneamente entre **"👤 Pessoal"** e **"🏢 Empresa"**.
*   A troca de workspace altera imediatamente o contexto global da aplicação: gráficos, categorias, saldo e transações mudam de acordo com o `workspace_id` correspondente.

## 4. Estrutura de Telas (Mobile-First)
1.  **Dashboard (Home):**
    *   Header: Seletor de Workspace e Toggle de Privacidade (Blur).
    *   Cards de KPI do *Tremor*: Saldo atual, Receitas, Despesas [16].
    *   Gráfico de Área (*AreaChart*) mostrando o fluxo de caixa [17].
2.  **Nova Transação (Modal de Ação Rápida):**
    *   Abre deslizando de baixo para cima (Bottom Sheet).
    *   Input gigante para o valor. Seletor rápido de Categorias (com ícones Lucide) [18, 19].
3.  **Ledger (Extrato/Histórico):**
    *   Tabela de dados/lista infinita com suporte a Scroll. Filtros no topo (Data, Pilar, Categoria).
4.  **IA Coach (Integração Gemini):**
    *   Interface de chat fluida onde o usuário pode interagir em linguagem natural com seus dados e receber análises.

## 5. Regras de Negócio na Interface (Recorrência)
A interface deve tratar transações únicas e recorrentes de forma distinta durante a edição:

*   **Transações Únicas:**
    *   Edição normal (Valor, Data, Categoria).
    *   *Toggle:* "Tornar Recorrente".
    *   Se ativado, abre opções de frequência (Diariamente, Semanalmente, Mensalmente, Outro) e um campo "Repetir até o dia X".
*   **Transações Recorrentes (Parcelas/Assinaturas):**
    *   Ao clicar para editar (ou deletar), um modal de alerta deve aparecer com 3 opções claras de escopo para preservar a integridade do banco:
        1.  *Editar apenas esta transação*
        2.  *Editar desta em diante*
        3.  *Editar todas as ocorrências*
