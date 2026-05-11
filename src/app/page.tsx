"use client";

import { Card, Metric, Text, AreaChart, BarList, Title, Flex, Grid } from "@tremor/react";
import { TrendingUp, Clock, Percent, ArrowUpRight, ArrowDownRight } from "lucide-react";

const kpiData = [
  {
    title: "Lucro Direto",
    metric: "R$ 47.850",
    metricPrev: "R$ 42.120",
    delta: "13,6%",
    deltaType: "increase",
  },
  {
    title: "Tempo de Liberdade",
    metric: "18 meses",
    metricPrev: "24 meses",
    delta: "-6 meses",
    deltaType: "moderateIncrease",
  },
  {
    title: "Eficiência de Amortização",
    metric: "34,2%",
    metricPrev: "28,7%",
    delta: "+5,5pp",
    deltaType: "increase",
  },
];

const cashFlowData = [
  { month: "Jan", Receitas: 18500, Despesas: 14200 },
  { month: "Fev", Receitas: 19200, Despesas: 13800 },
  { month: "Mar", Receitas: 22100, Despesas: 15100 },
  { month: "Abr", Receitas: 20800, Despesas: 14500 },
  { month: "Mai", Receitas: 24600, Despesas: 16200 },
  { month: "Jun", Receitas: 26800, Despesas: 15800 },
];

const roiData = [
  { name: "Montagem", value: 12400 },
  { name: "Planejados", value: 9800 },
  { name: "Método SIM", value: 8600 },
  { name: "Consultoria", value: 6200 },
  { name: "Outros", value: 4100 },
];

export default function PainelVitoria() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Painel de Vitória
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">
            Acompanhe sua jornada para vencer o banco
          </p>
        </header>

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

        <div className="text-center text-sm text-zinc-400 dark:text-zinc-500 py-4">
          Dados atualizados em tempo real • © 2026 Painel de Vitória
        </div>
      </div>
    </div>
  );
}