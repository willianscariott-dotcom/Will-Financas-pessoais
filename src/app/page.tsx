"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, Metric, Text, Flex, Grid } from "@tremor/react";
import { ArrowUpRight, ArrowDownRight, LogOut, ChevronLeft, ChevronRight, LayoutDashboard, Wallet, PieChart, TrendingUp, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Account {
  id: number;
  name: string;
}

interface Transaction {
  id: number;
  description: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  installment_current: number | null;
  installment_total: number | null;
  account_id: number | null;
  subcategory_id: number | null;
  account: { name: string } | null;
  subcategory: { name: string; category: { name: string; type: string } } | null;
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

type PeriodFilter = "full-month" | "month-to-date" | "today-to-end";
type ViewFilter = "pessoal" | "negocios";

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

function getAdjustedDate(year: number, month: number, day: number): string {
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const adjustedDay = Math.min(day, lastDayOfMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(adjustedDay).padStart(2, "0")}`;
}

function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const fetcher = async (key: string): Promise<DataResponse> => {
  const [view, year, month, period] = key.split("|");
  
  const currentYear = parseInt(year);
  const currentMonth = parseInt(month);
  
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  let currentStart: string, currentEnd: string;
  const monthRange = getMonthRange(currentYear, currentMonth);
  const today = new Date();
  
  currentStart = monthRange.start;
  
  if (period === "month-to-date") {
    currentEnd = today.toISOString().split("T")[0];
  } else if (period === "today-to-end") {
    currentStart = today.toISOString().split("T")[0];
    currentEnd = monthRange.end;
  } else {
    currentEnd = monthRange.end;
  }

  const prevRange = getMonthRange(prevYear, prevMonth);

  const { data: { user } } = await supabase.auth.getUser();

  const tableName = view === "negocios" ? "negocio_transactions" : "pessoal_transactions";
  const accTable = view === "negocios" ? "negocio_accounts" : "pessoal_accounts";
  const subTable = view === "negocios" ? "negocio_subcategories" : "pessoal_subcategories";
  const catTable = view === "negocios" ? "negocio_categories" : "pessoal_categories";

  const selectQuery = `*, account:${accTable}(name), subcategory:${subTable}(name, category:${catTable}(name, type))`;

  const currentRes = await supabase
    .from(tableName)
    .select(selectQuery)
    .eq("user_id", user?.id)
    .gte("date", currentStart)
    .lte("date", currentEnd)
    .order("date", { ascending: true });

  const prevRes = await supabase
    .from(tableName)
    .select(selectQuery)
    .eq("user_id", user?.id)
    .gte("date", prevRange.start)
    .lte("date", prevRange.end)
    .order("date", { ascending: true });

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

function generateInstallments(description: string, amount: number, dateStr: string, type: "income" | "expense", accountId: number | null, subcategoryId: number | null, totalInstallments: number, userId: string): { description: string; date: string; type: string; amount: number; account_id: number | null; subcategory_id: number | null; installment_current: number; installment_total: number; user_id: string }[] {
  const baseDate = new Date(dateStr);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + 1;
  const day = baseDate.getDate();
  
  const installments = [];
  
  for (let i = 0; i < totalInstallments; i++) {
    const installMonth = month + i;
    let installYear = year;
    let adjustMonth = installMonth;
    
    if (installMonth > 12) {
      adjustMonth = installMonth - 12;
      installYear = year + Math.floor(installMonth / 12);
    }
    
    installments.push({
      description: `${description} (${i + 1}/${totalInstallments})`,
      date: getAdjustedDate(installYear, adjustMonth, day),
      type,
      amount,
      account_id: accountId,
      subcategory_id: subcategoryId,
      installment_current: i + 1,
      installment_total: totalInstallments,
      user_id: userId
    });
  }
  
  return installments;
}

export default function DashboardFinanceiro() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const now = new Date();
  const [viewFilter, setViewFilter] = useState<ViewFilter>("pessoal");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month-to-date");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [newTransaction, setNewTransaction] = useState({
    type: "expense" as "income" | "expense",
    description: "",
    amount: "",
    date: now.toISOString().split("T")[0],
    fromAccountId: "",
    toAccountId: "",
    isTransfer: false,
    repeatMonths: "1"
  });

  const cacheKey = useMemo(() => `${viewFilter}|${selectedYear}|${selectedMonth}|${periodFilter}`, [viewFilter, selectedYear, selectedMonth, periodFilter]);

  const { data, isLoading, error, mutate } = useSWR<DataResponse>(
    user ? cacheKey : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user, viewFilter]);

  const getTableName = () => viewFilter === "negocios" ? "negocio_transactions" : "pessoal_transactions";
  const getAccountTableName = () => viewFilter === "negocios" ? "negocio_accounts" : "pessoal_accounts";

  async function fetchAccounts() {
    const { data: accountsData } = await supabase
      .from(getAccountTableName())
      .select("id, name")
      .eq("user_id", user?.id);
    
    if (accountsData) {
      setAccounts(accountsData);
    }
  }

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

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
      const previousData = data;
      mutate({
        current: data?.current.filter(t => t.id !== id) || [],
        previous: data?.previous || []
      }, false);

      const { error } = await supabase
        .from(getTableName())
        .delete()
        .eq("id", id);

      if (error) {
        mutate(previousData, false);
      }
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditTransactionOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction || !user) return;

    const { error } = await supabase
      .from(getTableName())
      .update({
        description: editingTransaction.description,
        amount: parseFloat(editingTransaction.amount.toString()),
        date: editingTransaction.date,
        account_id: editingTransaction.account_id,
        subcategory_id: editingTransaction.subcategory_id,
        installment_current: editingTransaction.installment_current,
        installment_total: editingTransaction.installment_total,
      })
      .eq("id", editingTransaction.id);

    if (!error) {
      mutate();
      setIsEditTransactionOpen(false);
      setEditingTransaction(null);
    }
  };

  const handleSaveNewTransaction = async () => {
    if (!user || !newTransaction.description || !newTransaction.amount) return;

    const amount = parseFloat(newTransaction.amount);
    const repeatMonths = parseInt(newTransaction.repeatMonths);

    if (newTransaction.isTransfer && newTransaction.fromAccountId && newTransaction.toAccountId) {
      const fromAccountId = parseInt(newTransaction.fromAccountId);
      const toAccountId = parseInt(newTransaction.toAccountId);
      
      const expenseInstallments = generateInstallments(
        `Transferência para ${accounts.find(a => a.id === toAccountId)?.name || "conta"}`,
        amount,
        newTransaction.date,
        "expense",
        fromAccountId,
        null,
        repeatMonths,
        user.id
      );
      
      const incomeInstallments = generateInstallments(
        `Transferência de ${accounts.find(a => a.id === fromAccountId)?.name || "conta"}`,
        amount,
        newTransaction.date,
        "income",
        toAccountId,
        null,
        repeatMonths,
        user.id
      );

      await supabase.from(getTableName()).insert([...expenseInstallments, ...incomeInstallments]);
    } else if (newTransaction.type === "transfer") {
      alert("Para transferência, selecione as contas de origem e destino");
      return;
    } else {
      const accountId = newTransaction.fromAccountId ? parseInt(newTransaction.fromAccountId) : null;
      
      const installments = generateInstallments(
        newTransaction.description,
        amount,
        newTransaction.date,
        newTransaction.type,
        accountId,
        null,
        repeatMonths,
        user.id
      );

      await supabase.from(getTableName()).insert(installments);
    }

    mutate();
    setIsNewTransactionOpen(false);
    setNewTransaction({
      type: "expense",
      description: "",
      amount: "",
      date: now.toISOString().split("T")[0],
      fromAccountId: "",
      toAccountId: "",
      isTransfer: false,
      repeatMonths: "1"
    });
  };

  const calculateKPIs = (): KPIData[] => {
    if (!data?.current.length) {
      return [
        { title: "Receitas", metric: "R$ 0", variation: "0%", isPositive: true },
        { title: "Despesas", metric: "R$ 0", variation: "0%", isPositive: true },
        { title: "Saldo", metric: "R$ 0", variation: "0%", isPositive: true },
      ];
    }

    const transactions = data.current;
    const previousTransactions = data.previous;

    const currentIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = currentIncome - currentExpense;

    const prevIncome = previousTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const prevExpense = previousTransactions
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
    if (!data?.current.length) return [];
    
    const categoryMap = new Map<string, number>();
    data.current
      .filter((t) => t.type === type)
      .forEach((t) => {
        const catName = t.subcategory?.category?.name || t.subcategory?.name || "Sem categoria";
        const current = categoryMap.get(catName) || 0;
        categoryMap.set(catName, current + t.amount);
      });
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  const kpiData = calculateKPIs();
  const incomeByCategory = calculateCategoryData("income");
  const expenseByCategory = calculateCategoryData("expense");
  const transactions = data?.current || [];
  const maxExpenseValue = Math.max(...expenseByCategory.map((c) => c.value), 1);
  const maxIncomeValue = Math.max(...incomeByCategory.map((c) => c.value), 1);

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
            <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" active />
            <SidebarItem icon={Wallet} label="Transações" href="/transacoes" />
            <SidebarItem icon={PieChart} label="Relatórios" href="/relatorios" />
          </nav>
          <div className="absolute bottom-4 left-4 right-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={signOut}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 w-full min-w-0">
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
              <ToggleGroup type="single" value={viewFilter} onValueChange={(v) => v && setViewFilter(v as ViewFilter)} className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-1">
                <ToggleGroupItem value="pessoal" className="px-4 py-2 data-[state=on]:bg-emerald-500 data-[state=on]:text-white">Pessoal</ToggleGroupItem>
                <ToggleGroupItem value="negocios" className="px-4 py-2 data-[state=on]:bg-emerald-500 data-[state=on]:text-white">Negócios</ToggleGroupItem>
              </ToggleGroup>

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

              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="w-56 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-month">Mês Completo</SelectItem>
                  <SelectItem value="month-to-date">Do início do mês até hoje</SelectItem>
                  <SelectItem value="today-to-end">De hoje até o fim do mês</SelectItem>
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
              </>
            ) : error ? (
              <div className="text-center py-12 text-red-500">Erro ao carregar dados</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
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
                </div>

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
                              <div className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full" style={{ width: `${(cat.value / maxExpenseValue) * 100}%` }} />
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
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full" style={{ width: `${(cat.value / maxIncomeValue) * 100}%` }} />
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
                          <TableHead>Conta</TableHead>
                          <TableHead>Subcategoria</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="w-24">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                              Nenhuma transação encontrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((t) => {
                            const descriptionWithInstallment = t.installment_current && t.installment_total
                              ? `${t.description} (${t.installment_current}/${t.installment_total})`
                              : t.description;
                            return (
                            <TableRow key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                              <TableCell className="font-medium">{descriptionWithInstallment}</TableCell>
                              <TableCell>{t.account?.name || "Sem conta"}</TableCell>
                              <TableCell>{t.subcategory?.name || "-"}</TableCell>
                              <TableCell>
                                <Badge className={t.type === "income" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-rose-100 text-rose-700 hover:bg-rose-100"}>
                                  {t.type === "income" ? "Receita" : "Despesa"}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(t.date).toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell className={`text-right font-semibold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                                {t.type === "income" ? "+" : "-"} R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                                    <Trash2 className="w-4 h-4 text-rose-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )})
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

      <Button
        className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 rounded-full h-14 w-14 shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white"
        onClick={() => setIsNewTransactionOpen(true)}
      >
        <Plus className="w-6 h-6" />
      </Button>

      <Dialog open={isNewTransactionOpen} onOpenChange={setIsNewTransactionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={newTransaction.type === "expense" && !newTransaction.isTransfer ? "default" : "outline"}
                className="flex-1"
                onClick={() => setNewTransaction({ ...newTransaction, type: "expense", isTransfer: false })}
              >
                Despesa
              </Button>
              <Button
                variant={newTransaction.type === "income" && !newTransaction.isTransfer ? "default" : "outline"}
                className="flex-1"
                onClick={() => setNewTransaction({ ...newTransaction, type: "income", isTransfer: false })}
              >
                Receita
              </Button>
              <Button
                variant={newTransaction.isTransfer ? "default" : "outline"}
                className="flex-1"
                onClick={() => setNewTransaction({ ...newTransaction, isTransfer: true })}
              >
                Transferência
              </Button>
            </div>

            {newTransaction.isTransfer ? (
              <>
                <div className="space-y-2">
                  <Label>Conta de Origem</Label>
                  <Select value={newTransaction.fromAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, fromAccountId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de origem" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta de Destino</Label>
                  <Select value={newTransaction.toAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, toAccountId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de destino" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Conta</Label>
                <Select value={newTransaction.fromAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, fromAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Aluguel, Salário"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Repetir por (meses)</Label>
              <Select value={newTransaction.repeatMonths} onValueChange={(v) => setNewTransaction({ ...newTransaction, repeatMonths: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mês</SelectItem>
                  <SelectItem value="2">2 meses</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewTransactionOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNewTransaction}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditTransactionOpen} onOpenChange={setIsEditTransactionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={editingTransaction.date}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Parcela Atual / Total</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Atual"
                    value={editingTransaction.installment_current || ""}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, installment_current: parseInt(e.target.value) || null })}
                  />
                  <Input
                    type="number"
                    placeholder="Total"
                    value={editingTransaction.installment_total || ""}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, installment_total: parseInt(e.target.value) || null })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTransactionOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}