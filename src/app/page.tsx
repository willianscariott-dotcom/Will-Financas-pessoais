"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, Metric, Text, Flex, Grid } from "@tremor/react";
import { ArrowUpRight, ArrowDownRight, LogOut, List, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  account_type: string;
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

type PeriodFilter = "month-to-date" | "full-month";
type AccountType = "pessoal" | "negocios";

export default function DashboardFinanceiro() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prevMonthTransactions, setPrevMonthTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>("pessoal");
  const [period, setPeriod] = useState<PeriodFilter>("month-to-date");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, accountType]);

  async function fetchData() {
    setLoading(true);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const currentStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const currentEnd = period === "month-to-date"
      ? now.toISOString().split("T")[0]
      : `${currentYear}-${String(currentMonth).padStart(2, "0")}-31`;

    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-31`;

    const [currentRes, prevRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, categories(name)")
        .eq("user_id", user?.id)
        .eq("account_type", accountType)
        .gte("date", currentStart)
        .lte("date", currentEnd)
        .order("date", { ascending: false }),
      supabase
        .from("transactions")
        .select("*, categories(name)")
        .eq("user_id", user?.id)
        .eq("account_type", accountType)
        .gte("date", prevStart)
        .lte("date", prevEnd)
        .order("date", { ascending: false }),
    ]);

    if (!currentRes.error) setTransactions(currentRes.data || []);
    if (!prevRes.error) setPrevMonthTransactions(prevRes.data || []);
    setLoading(false);
  }

  const calculateKPIs = (): KPIData[] => {
    const currentIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentBalance = currentIncome - currentExpense;

    const prevIncome = prevMonthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const prevExpense = prevMonthTransactions
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
    const categoryMap = new Map<string, number>();
    transactions
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

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  const kpiData = calculateKPIs();
  const incomeByCategory = calculateCategoryData("income");
  const expenseByCategory = calculateCategoryData("expense");
  const maxCategoryValue = Math.max(...expenseByCategory.map((c) => c.value), 1);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Dashboard Financeiro
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Resumo das suas finanças
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/transacoes")}>
              <List className="w-4 h-4 mr-2" />
              Transações
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pessoal">Finanças Pessoais</SelectItem>
              <SelectItem value="negocios">Negócios</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => { setPeriod(v as PeriodFilter); fetchData(); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month-to-date">Início do mês até hoje</SelectItem>
              <SelectItem value="full-month">Mês todo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-500">Carregando dados...</div>
        ) : (
          <>
            <Grid numItems={1} numItemsSm={3} className="gap-4">
              {kpiData.map((kpi, index) => (
                <Card key={kpi.title} className="dark:bg-zinc-900">
                  <Flex justifyContent="between" alignItems="start">
                    <div>
                      <Text className="text-zinc-500 dark:text-zinc-400">{kpi.title}</Text>
                      <Metric className="text-2xl mt-1">{kpi.metric}</Metric>
                    </div>
                    <div className={`flex items-center gap-1 text-sm ${kpi.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {kpi.isPositive ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span>{kpi.variation}</span>
                    </div>
                  </Flex>
                </Card>
              ))}
            </Grid>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="dark:bg-zinc-900">
                <Text className="font-semibold mb-4">Despesas por Categoria</Text>
                <div className="space-y-3">
                  {expenseByCategory.length === 0 ? (
                    <p className="text-zinc-500 text-sm">Nenhuma despesa encontrada</p>
                  ) : (
                    expenseByCategory.map((cat) => (
                      <div key={cat.name} className="space-y-1">
                        <Flex justifyContent="between">
                          <Text className="text-sm">{cat.name}</Text>
                          <Text className="text-sm font-medium">R$ {cat.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                        </Flex>
                        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${(cat.value / maxCategoryValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="dark:bg-zinc-900">
                <Text className="font-semibold mb-4">Receitas por Categoria</Text>
                <div className="space-y-3">
                  {incomeByCategory.length === 0 ? (
                    <p className="text-zinc-500 text-sm">Nenhuma receita encontrada</p>
                  ) : (
                    incomeByCategory.map((cat) => {
                      const maxIncomeValue = Math.max(...incomeByCategory.map((c) => c.value), 1);
                      return (
                        <div key={cat.name} className="space-y-1">
                          <Flex justifyContent="between">
                            <Text className="text-sm">{cat.name}</Text>
                            <Text className="text-sm font-medium">R$ {cat.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                          </Flex>
                          <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(cat.value / maxIncomeValue) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            <Card className="dark:bg-zinc-900">
              <Text className="font-semibold mb-4">Últimas Transações</Text>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-zinc-500">
                          Nenhuma transação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.slice(0, 10).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.description}</TableCell>
                          <TableCell>{t.categories?.name || "Sem categoria"}</TableCell>
                          <TableCell>
                            <Badge variant={t.type === "income" ? "default" : "destructive"} className={t.type === "income" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-rose-100 text-rose-700 hover:bg-rose-100"}>
                              {t.type === "income" ? "Receita" : "Despesa"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(t.date).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className={`text-right font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                            {t.type === "income" ? "+" : "-"} R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}

        <div className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Dados atualizados em tempo real • © 2026
        </div>
      </div>
    </div>
  );
}