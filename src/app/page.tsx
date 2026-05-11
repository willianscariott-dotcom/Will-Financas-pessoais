"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMonthFilter, MONTHS } from "@/hooks/useMonthFilter";
import { supabase } from "@/lib/supabase";
import { Card, Metric, Text, AreaChart, BarList, Title, Flex, Grid } from "@tremor/react";
import { TrendingUp, Clock, Percent, ArrowUpRight, ArrowDownRight, LogOut, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  category: string;
  date: string;
  user_id: string;
}

interface KPIData {
  title: string;
  metric: string;
  metricPrev: string;
  delta: string;
  deltaType: string;
}

interface CashFlowMonth {
  month: string;
  Receitas: number;
  Despesas: number;
}

interface ROIItem {
  name: string;
  value: number;
}

export default function PainelVitoria() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const { selectedMonth, setSelectedMonth } = useMonthFilter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && selectedMonth) {
      fetchTransactions();
    }
  }, [user, selectedMonth]);

  async function fetchTransactions() {
    setLoading(true);
    const [year, month] = selectedMonth.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user?.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (!error) {
      setTransactions(data || []);
    }
    setLoading(false);
  }

  const calculateKPIs = (): KPIData[] => {
    if (transactions.length === 0) {
      return [
        { title: "Lucro Direto", metric: "R$ 0", metricPrev: "R$ 0", delta: "0%", deltaType: "increase" },
        { title: "Tempo de Liberdade", metric: "0 meses", metricPrev: "0 meses", delta: "0 meses", deltaType: "moderateIncrease" },
        { title: "Eficiência de Amortização", metric: "0%", metricPrev: "0%", delta: "0%", deltaType: "increase" },
      ];
    }

    const incomes = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    const profit = incomes - expenses;

    const efficiency = incomes > 0 ? ((profit / incomes) * 100).toFixed(1) : "0";
    const monthsSaved = Math.floor(profit / 1500);

    return [
      {
        title: "Lucro Direto",
        metric: `R$ ${profit.toLocaleString("pt-BR")}`,
        metricPrev: `R$ ${incomes.toLocaleString("pt-BR")}`,
        delta: `${((profit / (incomes || 1)) * 100).toFixed(1)}%`,
        deltaType: profit >= 0 ? "increase" : "moderateDecrease",
      },
      {
        title: "Tempo de Liberdade",
        metric: `${monthsSaved} meses`,
        metricPrev: "0 meses",
        delta: `+${monthsSaved} meses`,
        deltaType: "moderateIncrease",
      },
      {
        title: "Eficiência de Amortização",
        metric: `${efficiency}%`,
        metricPrev: "0%",
        delta: `+${efficiency}pp`,
        deltaType: "increase",
      },
    ];
  };

  const calculateCashFlow = (): CashFlowMonth[] => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const currentMonth = new Date().getMonth();
    const last6Months: CashFlowMonth[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const monthTransactions = transactions.filter((t) => {
        const transMonth = new Date(t.date).getMonth();
        return transMonth === monthIndex;
      });

      const incomes = monthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);

      last6Months.push({
        month: months[monthIndex],
        Receitas: incomes,
        Despesas: expenses,
      });
    }

    return last6Months;
  };

  const calculateROI = (): ROIItem[] => {
    const categoryMap = new Map<string, number>();

    transactions
      .filter((t) => t.type === "income")
      .forEach((t) => {
        const current = categoryMap.get(t.category) || 0;
        categoryMap.set(t.category, current + t.amount);
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
  const cashFlowData = calculateCashFlow();
  const roiData = calculateROI();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              Painel de Vitória
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">
              Acompanhe sua jornada para vencer o banco
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/transacoes")}>
              <List className="w-4 h-4 mr-2" />
              Transações
            </Button>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </header>

        <div className="flex items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-500">Carregando dados...</div>
        ) : (
          <>
            <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
              {kpiData.map((kpi, index) => (
                <Card key={kpi.title} decoration="top" decorationColor="emerald" className="dark:bg-zinc-900">
                  <Flex justifyContent="start" className="space-x-4">
                    <div className={`p-3 rounded-xl ${index === 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : index === 1 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                      {index === 0 ? (
                        <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      ) : index === 1 ? (
                        <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Percent className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <Text>{kpi.title}</Text>
                      <Metric className="text-2xl">{kpi.metric}</Metric>
                    </div>
                  </Flex>
                  <Flex className="mt-4 space-x-2">
                    {kpi.deltaType === "increase" || kpi.deltaType === "moderateIncrease" ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    )}
                    <Text className={kpi.deltaType === "increase" || kpi.deltaType === "moderateIncrease" ? "text-emerald-600" : "text-rose-600"}>
                      {kpi.delta} vs período anterior
                    </Text>
                  </Flex>
                </Card>
              ))}
            </Grid>

            <Grid numItems={1} numItemsLg={2} className="gap-6">
              <Card className="dark:bg-zinc-900">
                <Title>Fluxo de Caixa</Title>
                <Text>Receitas vs Despesas - Últimos 6 meses</Text>
                <AreaChart
                  className="h-72 mt-4"
                  data={cashFlowData}
                  index="month"
                  categories={["Receitas", "Despesas"]}
                  colors={["emerald", "rose"]}
                  valueFormatter={(value: number) =>
                    `R$ ${Intl.NumberFormat("pt-BR").format(value)}`
                  }
                  yAxisWidth={80}
                />
              </Card>

              <Card className="dark:bg-zinc-900">
                <Title>ROI por Categoria</Title>
                <Text>Faturamento por projeto - Acumulado</Text>
                <div className="mt-6">
                  <BarList
                    data={roiData}
                    valueFormatter={(value: number) =>
                      `R$ ${Intl.NumberFormat("pt-BR").format(value)}`
                    }
                    color="emerald"
                  />
                </div>
              </Card>
            </Grid>
          </>
        )}

        <div className="text-center text-sm text-zinc-400 dark:text-zinc-500 py-4">
          Dados atualizados em tempo real • © 2026 Painel de Vitória
        </div>
      </div>
    </div>
  );
}