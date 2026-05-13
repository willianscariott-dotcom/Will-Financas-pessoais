"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, Title, Text, Grid } from "@tremor/react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { LogOut, LayoutDashboard, Wallet, PieChart as PieChartIcon, TrendingUp, Download } from "lucide-react";
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

const CustomTooltip = (props: any) => {
  const { payload, active, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-slate-900 p-3 shadow-lg">
      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{label}</p>
      {payload.map((category: any, idx: number) => (
        <div key={idx} className="flex flex-1 space-x-2.5 mb-2 last:mb-0">
          <div className="flex w-1 flex-col rounded" style={{ backgroundColor: category.color || category.payload.fill }} />
          <div className="space-y-1">
            <p className="text-slate-600 dark:text-slate-400 text-sm">{category.name || category.dataKey}</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              R$ {Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(category.value)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
      const date = new Date(t.date + 'T12:00:00');
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

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
        const catName = t.subcategory?.category?.name || "Sem Categoria";
        categoryMap.set(catName, (categoryMap.get(catName) || 0) + t.amount);
      });

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Process data for Subcategories Drill-down
  const subcategoriesData = useMemo(() => {
    if (!transactions || !selectedCategory) return [];

    const subMap = new Map<string, number>();

    transactions
      .filter(t => t.type === "expense" && (t.subcategory?.category?.name || "Sem Categoria") === selectedCategory)
      .forEach(t => {
        const subName = t.subcategory?.name || "Sem Subcategoria";
        subMap.set(subName, (subMap.get(subName) || 0) + t.amount);
      });

    return Array.from(subMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, selectedCategory]);

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
            <SidebarItem icon={PieChartIcon} label="Relatórios" href="/relatorios" active />
          </nav>
          <div className="absolute bottom-4 left-4 right-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={signOut}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="flex-1 w-full max-w-full overflow-hidden p-4 md:p-8">
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
              <div className="space-y-6">
                <Grid numItems={1} numItemsLg={2} className="gap-6">
                  <Card className="dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm w-full min-w-0 overflow-hidden">
                    <Title className="text-zinc-900 dark:text-zinc-50">Evolução do Fluxo de Caixa</Title>
                    <Text className="mb-6">Receitas vs Despesas ao longo do tempo</Text>
                    <div className="h-80 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlowData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                          <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis 
                            stroke="#71717a" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `R$ ${Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value)}`} 
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Area type="monotone" dataKey="Receitas" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                          <Area type="monotone" dataKey="Despesas" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card className="dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm w-full min-w-0 overflow-hidden">
                    <Title className="text-zinc-900 dark:text-zinc-50">Consumo por Categoria</Title>
                    <Text className="mb-6">Onde seu dinheiro foi gasto no período</Text>
                    <div className="h-80 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expensesByCategory} layout="vertical" margin={{ left: 50 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#3f3f46" opacity={0.2} />
                          <XAxis 
                            type="number" 
                            stroke="#71717a" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `R$ ${Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value)}`}
                          />
                          <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar 
                            dataKey="value" 
                            fill="#ef4444" 
                            radius={[0, 4, 4, 0]}
                            onClick={(data) => setSelectedCategory(data.name)}
                            cursor="pointer"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Grid>

                {selectedCategory && (
                  <Card className="dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm w-full min-w-0 overflow-hidden animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <Title className="text-zinc-900 dark:text-zinc-50">Drill-down: {selectedCategory}</Title>
                        <Text>Distribuição de gastos por subcategoria</Text>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedCategory(null)}>
                        Voltar
                      </Button>
                    </div>
                    <div className="h-80 w-full mt-4 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={subcategoriesData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={2}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {subcategoriesData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#7f1d1d', '#991b1b', '#b91c1c', '#dc2626'][index % 8]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}