"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, Metric, Text, Flex, Grid } from "@tremor/react";
import { ArrowUpRight, ArrowDownRight, LogOut, ChevronLeft, ChevronRight, LayoutDashboard, Wallet, PieChart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Transaction {
  id: number;
  description: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  account_type: string | null;
  categories: {
    name: string;
  } | null;
}

interface CategoryData {
  name: string;
  value: number;
}

interface KPIData {
  title: string;
  metric: string;
  variation: string;
  isPositive: boolean;
}

interface DataResponse {
  current: Transaction[];
  previous: Transaction[];
}

type ViewFilter = "unclassified" | "pessoal" | "negocios" | "todas";

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const fetcher = async (key: string): Promise<DataResponse> => {
  const [view, year, month] = key.split("|");
  
  const currentYear = parseInt(year);
  const currentMonth = parseInt(month);
  
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const currentRange = getMonthRange(currentYear, currentMonth);
  const prevRange = getMonthRange(prevYear, prevMonth);

  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("transactions")
    .select("*, categories(name)")
    .eq("user_id", user?.id)
    .gte("date", currentRange.start)
    .lte("date", currentRange.end)
    .order("date", { ascending: false });

  if (view !== "todas" && view !== "unclassified") {
    query = query.eq("account_type", view);
  }

  const currentRes = await query;

  let prevQuery = supabase
    .from("transactions")
    .select("*, categories(name)")
    .eq("user_id", user?.id)
    .gte("date", prevRange.start)
    .lte("date", prevRange.end)
    .order("date", { ascending: false });

  if (view !== "todas" && view !== "unclassified") {
    prevQuery = prevQuery.eq("account_type", view);
  }

  const prevRes = await prevQuery;

  return {
    current: currentRes.data || [],
    previous: prevRes.data || [],
  };
};

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
      <Flex justifyContent="between" alignItems="start">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-6 w-16" />
      </Flex>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <Flex justifyContent="between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </Flex>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200",
      active 
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    )}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
  </button>
);

export default function DashboardFinanceiro() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const now = new Date();
  const [viewFilter, setViewFilter] = useState<ViewFilter>("unclassified");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const cacheKey = useMemo(() => `${viewFilter}|${selectedYear}|${selectedMonth}`, [viewFilter, selectedYear, selectedMonth]);

  const { data, isLoading, error, mutate } = useSWR<DataResponse>(
    user ? cacheKey : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const goToPrevMonth = () => {
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    if (month === 1) {
      setSelectedMonth("12");
      setSelectedYear((year - 1).toString());
    } else {
      setSelectedMonth((month - 1).toString());
    }
  };

  const goToNextMonth = () => {
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    if (month === 12) {
      setSelectedMonth("1");
      setSelectedYear((year + 1).toString());
    } else {
      setSelectedMonth((month + 1).toString());
    }
  };

  const updateTransactionClassification = async (transactionId: number, newType: string | null) => {
    setUpdatingId(transactionId);
    
    const { error } = await supabase
      .from("transactions")
      .update({ account_type: newType })
      .eq("id", transactionId);

    if (!error) {
      mutate();
    }
    
    setUpdatingId(null);
  };

  const calculateKPIs = (): KPIData[] => {
    if (!data) {
      return [
        { title: "Receitas", metric: "R$ 0", variation: "0%", isPositive: true },
        { title: "Despesas", metric: "R$ 0", variation: "0%", isPositive: true },
        { title: "Saldo", metric: "R$ 0", variation: "0%", isPositive: true },
      ];
    }

    const { current, previous } = data;

    const currentIncome = current
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentExpense = current
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = currentIncome - currentExpense;

    const prevIncome = previous
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const prevExpense = previous
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const calcVariation = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const variation = ((current - previous) / previous) * 100;
      return `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`;
    };

    return [
      {
        title: "Receitas",
        metric: `R$ ${currentIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        variation: calcVariation(currentIncome, prevIncome),
        isPositive: currentIncome >= prevIncome,
      },
      {
        title: "Despesas",
        metric: `R$ ${currentExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        variation: calcVariation(currentExpense, prevExpense),
        isPositive: currentExpense <= prevExpense,
      },
      {
        title: "Saldo",
        metric: `R$ ${currentBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        variation: currentBalance >= 0 ? "Positivo" : "Negativo",
        isPositive: currentBalance >= 0,
      },
    ];
  };

  const calculateCategoryData = (type: "income" | "expense"): CategoryData[] => {
    if (!data) return [];
    
    const categoryMap = new Map<string, number>();
    data.current
      .filter((t) => t.type === type)
      .forEach((t) => {
        const catName = t.categories?.name || "Sem categoria";
        const current = categoryMap.get(catName) || 0;
        categoryMap.set(catName, current + t.amount);
      });
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const getClassificationBadge = (accountType: string | null) => {
    if (!accountType) {
      return <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">Não Classificado</span>;
    }
    if (accountType === "pessoal") {
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Pessoal</span>;
    }
    if (accountType === "negocios") {
      return <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">Negócios</span>;
    }
    return null;
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  const getFilteredTransactions = (transactions: Transaction[]) => {
    if (viewFilter === "unclassified") {
      return transactions.filter(t => !t.account_type || t.account_type === "");
    } else if (viewFilter !== "todas") {
      return transactions.filter(t => t.account_type === viewFilter);
    }
    return transactions;
  };

  const currentFiltered = getFilteredTransactions(data?.current || []);
  const previousFiltered = getFilteredTransactions(data?.previous || []);

  const calculateKPIsFiltered = (): KPIData[] => {
    if (currentFiltered.length === 0) {
      return [
        { title: "Receitas", metric: "R$ 0", variation: "0%", isPositive: true },
        { title: "Despesas", metric: "R$ 0", variation: "0%", isPositive: true },
        { title: "Saldo", metric: "R$ 0", variation: "0%", isPositive: true },
      ];
    }

    const currentIncome = currentFiltered
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentExpense = currentFiltered
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = currentIncome - currentExpense;

    const prevIncome = previousFiltered
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const prevExpense = previousFiltered
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const calcVariation = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const variation = ((current - previous) / previous) * 100;
      return `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`;
    };

    return [
      {
        title: "Receitas",
        metric: `R$ ${currentIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        variation: calcVariation(currentIncome, prevIncome),
        isPositive: currentIncome >= prevIncome,
      },
      {
        title: "Despesas",
        metric: `R$ ${currentExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        variation: calcVariation(currentExpense, prevExpense),
        isPositive: currentExpense <= prevExpense,
      },
      {
        title: "Saldo",
        metric: `R$ ${currentBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        variation: currentBalance >= 0 ? "Positivo" : "Negativo",
        isPositive: currentBalance >= 0,
      },
    ];
  };

  const calculateCategoryDataFiltered = (type: "income" | "expense"): CategoryData[] => {
    const categoryMap = new Map<string, number>();
    currentFiltered
      .filter((t) => t.type === type)
      .forEach((t) => {
        const catName = t.categories?.name || "Sem categoria";
        const current = categoryMap.get(catName) || 0;
        categoryMap.set(catName, current + t.amount);
      });
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const kpiData = calculateKPIsFiltered();
  const incomeByCategory = calculateCategoryDataFiltered("income");
  const expenseByCategory = calculateCategoryDataFiltered("expense");
  const transactions = currentFiltered;
  const maxExpenseValue = Math.max(...expenseByCategory.map((c) => c.value), 1);
  const maxIncomeValue = Math.max(...incomeByCategory.map((c) => c.value), 1);

  const getViewLabel = () => {
    switch (viewFilter) {
      case "pessoal": return "Visão Pessoal";
      case "negocios": return "Visão Negócios";
      case "unclassified": return "Não Classificados";
      case "todas": return "Todas";
      default: return "Selecione";
    }
  };

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
            <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
            <SidebarItem icon={Wallet} label="Transações" />
            <SidebarItem icon={PieChart} label="Relatórios" />
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
                  Dashboard Financeiro
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  Resumo das suas finanças
                </p>
              </div>
            </header>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3 min-w-[140px] text-center font-medium text-sm">
                  {formatMonthYear(parseInt(selectedYear), parseInt(selectedMonth))}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
                <SelectTrigger className="w-52 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <SelectValue placeholder="Visão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unclassified">Não Classificados</SelectItem>
                  <SelectItem value="pessoal">Visão Pessoal</SelectItem>
                  <SelectItem value="negocios">Visão Negócios</SelectItem>
                  <SelectItem value="todas">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <>
                <Grid numItems={1} numItemsSm={3} className="gap-4">
                  {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
                </Grid>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SkeletonChart />
                  <SkeletonChart />
                </div>
                <SkeletonTable />
              </>
            ) : error ? (
              <div className="text-center py-12 text-red-500">Erro ao carregar dados</div>
            ) : (
              <>
                <Grid numItems={1} numItemsSm={3} className="gap-4">
                  {kpiData.map((kpi) => (
                    <div key={kpi.title} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-md transition-shadow">
                      <Flex justifyContent="between" alignItems="start">
                        <div>
                          <Text className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{kpi.title}</Text>
                          <Metric className="text-2xl mt-1 font-semibold">{kpi.metric}</Metric>
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full",
                          kpi.isPositive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                        )}>
                          {kpi.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          <span>{kpi.variation}</span>
                        </div>
                      </Flex>
                    </div>
                  ))}
                </Grid>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                    <Text className="font-semibold text-lg mb-4">Despesas por Categoria</Text>
                    <div className="space-y-3">
                      {expenseByCategory.length === 0 ? (
                        <p className="text-zinc-500 text-sm">Nenhuma despesa encontrada</p>
                      ) : (
                        expenseByCategory.map((cat) => (
                          <div key={cat.name} className="space-y-1">
                            <Flex justifyContent="between">
                              <Text className="text-sm font-medium">{cat.name}</Text>
                              <Text className="text-sm font-semibold">R$ {cat.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                            </Flex>
                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full"
                                style={{ width: `${(cat.value / maxExpenseValue) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                    <Text className="font-semibold text-lg mb-4">Receitas por Categoria</Text>
                    <div className="space-y-3">
                      {incomeByCategory.length === 0 ? (
                        <p className="text-zinc-500 text-sm">Nenhuma receita encontrada</p>
                      ) : (
                        incomeByCategory.map((cat) => (
                          <div key={cat.name} className="space-y-1">
                            <Flex justifyContent="between">
                              <Text className="text-sm font-medium">{cat.name}</Text>
                              <Text className="text-sm font-semibold">R$ {cat.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                            </Flex>
                            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                                style={{ width: `${(cat.value / maxIncomeValue) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                  <Text className="font-semibold text-lg mb-4">Transações do Período</Text>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-sm">
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Classificação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                              Nenhuma transação encontrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((t) => (
                            <TableRow key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                              <TableCell className="font-medium">{t.description}</TableCell>
                              <TableCell>{t.categories?.name || "Sem categoria"}</TableCell>
                              <TableCell>
                                <Badge className={t.type === "income" 
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" 
                                  : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                                }>
                                  {t.type === "income" ? "Receita" : "Despesa"}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(t.date).toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell className={`text-right font-semibold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                                {t.type === "income" ? "+" : "-"} R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={t.account_type || "unclassified"} 
                                  onValueChange={(value) => updateTransactionClassification(t.id, value === "unclassified" ? null : value)}
                                  disabled={updatingId === t.id}
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unclassified">Não Classificado</SelectItem>
                                    <SelectItem value="pessoal">Pessoal</SelectItem>
                                    <SelectItem value="negocios">Negócios</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            <div className="text-center text-xs text-zinc-400 dark:text-zinc-500">
              Dados atualizados em tempo real • © 2026
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}