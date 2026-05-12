"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, Title, AreaChart, BarChart, Text, Grid } from "@tremor/react";
import { LogOut, LayoutDashboard, Wallet, PieChart, TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Transaction {
  id: number;
  description: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  account: { name: string } | null;
  subcategory: { name: string; category: { name: string; type: string } } | null;
}

type TimeFilter = "este-mes" | "mes-passado" | "trimestral" | "semestral" | "anual" | "personalizado";

function getDateRange(filter: TimeFilter, customStart?: string, customEnd?: string) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (filter === "este-mes") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (filter === "mes-passado") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (filter === "trimestral") {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (filter === "semestral") {
    start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (filter === "anual") {
    start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (filter === "personalizado") {
    start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
    end = customEnd ? new Date(customEnd) : new Date();
  }

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

const fetcher = async (key: string): Promise<Transaction[]> => {
  const [filter, customStart, customEnd] = key.split("|");
  const { start, end } = getDateRange(filter as TimeFilter, customStart, customEnd);
  
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("pessoal_transactions")
    .select("*, account:pessoal_accounts(name), subcategory:pessoal_subcategories(name, category:pessoal_categories(name, type))")
    .eq("user_id", user?.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });

  if (error) throw error;
  return data || [];
};

const SidebarItem = ({ icon: Icon, label, href, active = false }: { icon: any; label: string; href?: string; active?: boolean }) => {
  const Component = href ? Link : "button";
  return (
    <Component 
      href={href || "#"}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200",
        active 
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </Component>
  );
};

export default function RelatoriosPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("este-mes");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const cacheKey = useMemo(() => `${timeFilter}|${customStart}|${customEnd}`, [timeFilter, customStart, customEnd]);

  const { data: transactions, isLoading } = useSWR<Transaction[]>(
    user ? cacheKey : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Process data for AreaChart (Cash Flow)
  const cashFlowData = useMemo(() => {
    if (!transactions) return [];
    
    const monthlyData = new Map<string, { month: string; Receitas: number; Despesas: number; date: Date }>();

    transactions.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { month: label, Receitas: 0, Despesas: 0, date });
      }

      const current = monthlyData.get(monthKey)!;
      if (t.type === "income") {
        current.Receitas += t.amount;
      } else {
        current.Despesas += t.amount;
      }
    });

    return Array.from(monthlyData.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ month, Receitas, Despesas }) => ({ month, Receitas, Despesas }));
  }, [transactions]);

  // Process data for BarChart (Expenses by Category)
  const expensesByCategory = useMemo(() => {
    if (!transactions) return [];

    const categoryMap = new Map<string, number>();

    transactions
      .filter(t => t.type === "expense")
      .forEach(t => {
        const catName = t.subcategory?.category?.name || t.subcategory?.name || "Sem Categoria";
        categoryMap.set(catName, (categoryMap.get(catName) || 0) + t.amount);
      });

    return Array.from(categoryMap.entries())
      .map(([name, Valor]) => ({ name, Valor }))
      .sort((a, b) => b.Valor - a.Valor);
  }, [transactions]);

  const handleDownloadCSV = () => {
    if (!transactions || transactions.length === 0) {
      alert("Nenhum dado para exportar.");
      return;
    }

    const headers = ["ID", "Data", "Descrição", "Tipo", "Valor", "Conta", "Subcategoria", "Categoria"];
    const csvRows = transactions.map(t => [
      t.id,
      t.date,
      `"${t.description.replace(/"/g, '""')}"`, // escape double quotes
      t.type === "income" ? "Receita" : "Despesa",
      t.amount.toFixed(2).replace(".", ","),
      `"${t.account?.name || ""}"`,
      `"${t.subcategory?.name || ""}"`,
      `"${t.subcategory?.category?.name || ""}"`
    ]);

    const csvContent = [headers.join(";"), ...csvRows.map(row => row.join(";"))].join("\n");
    
    // Add BOM for correct UTF-8 rendering in Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `relatorio_financas_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 p-4 hidden md:block">
          <div className="mb-8">
            <div className="flex items-center gap-2 px-4 py-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Finanças</span>
            </div>
          </div>
          <nav className="space-y-2">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" />
            <SidebarItem icon={Wallet} label="Transações" href="/transacoes" />
            <SidebarItem icon={PieChart} label="Relatórios" href="/relatorios" active />
          </nav>
          <div className="absolute bottom-4 left-4 right-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={signOut}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                  Relatórios e Análises
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Visão detalhada do seu desempenho financeiro
                </p>
              </div>
              <Button onClick={handleDownloadCSV} variant="outline" className="gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                <Download className="w-4 h-4" />
                Baixar em CSV
              </Button>
            </header>

            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="w-full sm:w-64 space-y-1">
                <Label>Período</Label>
                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="este-mes">Este Mês</SelectItem>
                    <SelectItem value="mes-passado">Mês Passado</SelectItem>
                    <SelectItem value="trimestral">Últimos 3 Meses</SelectItem>
                    <SelectItem value="semestral">Últimos 6 Meses</SelectItem>
                    <SelectItem value="anual">Último Ano</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {timeFilter === "personalizado" && (
                <>
                  <div className="w-full sm:w-48 space-y-1">
                    <Label>Data Inicial</Label>
                    <Input 
                      type="date" 
                      value={customStart} 
                      onChange={(e) => setCustomStart(e.target.value)} 
                    />
                  </div>
                  <div className="w-full sm:w-48 space-y-1">
                    <Label>Data Final</Label>
                    <Input 
                      type="date" 
                      value={customEnd} 
                      onChange={(e) => setCustomEnd(e.target.value)} 
                    />
                  </div>
                </>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-zinc-500">Analisando dados...</div>
            ) : (
              <Grid numItems={1} numItemsLg={2} className="gap-6">
                <Card className="dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm w-full min-w-0 overflow-hidden">
                  <Title className="text-zinc-900 dark:text-zinc-50">Evolução do Fluxo de Caixa</Title>
                  <Text className="mb-6">Receitas vs Despesas ao longo do tempo</Text>
                  <AreaChart
                    className="h-80 mt-4 [&_.recharts-tooltip-cursor]:fill-zinc-100 dark:[&_.recharts-tooltip-cursor]:fill-zinc-800 [&_.tremor-custom-tooltip]:text-slate-800 dark:[&_.tremor-custom-tooltip]:text-slate-200"
                    data={cashFlowData}
                    index="month"
                    categories={["Receitas", "Despesas"]}
                    colors={["emerald", "red"]}
                    valueFormatter={(value: number) =>
                      `R$ ${Intl.NumberFormat("pt-BR").format(value)}`
                    }
                    showLegend={true}
                    yAxisWidth={80}
                  />
                </Card>

                <Card className="dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm w-full min-w-0 overflow-hidden">
                  <Title className="text-zinc-900 dark:text-zinc-50">Consumo por Categoria</Title>
                  <Text className="mb-6">Onde seu dinheiro foi gasto no período</Text>
                  <BarChart
                    className="h-80 mt-4 [&_.recharts-tooltip-cursor]:fill-zinc-100 dark:[&_.recharts-tooltip-cursor]:fill-zinc-800 [&_.tremor-custom-tooltip]:text-slate-800 dark:[&_.tremor-custom-tooltip]:text-slate-200"
                    data={expensesByCategory}
                    index="name"
                    categories={["Valor"]}
                    colors={["red"]}
                    valueFormatter={(value: number) =>
                      `R$ ${Intl.NumberFormat("pt-BR").format(value)}`
                    }
                    layout="vertical"
                    yAxisWidth={120}
                    showLegend={false}
                  />
                </Card>
              </Grid>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}