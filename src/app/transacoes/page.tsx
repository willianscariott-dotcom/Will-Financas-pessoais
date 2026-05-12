"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
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
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  installment_current: number | null;
  installment_total: number | null;
  account: { name: string } | null;
  subcategory: { name: string; category: { name: string; type: string } } | null;
}

interface Account {
  id: number;
  name: string;
}

type FilterType = "todas" | "expense" | "income" | "transfer";
type PeriodFilter = "full-month" | "month-to-date" | "today-to-end";

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

const fetcher = async (key: string): Promise<{ data: Transaction[] }> => {
  const [year, month, period] = key.split("|");
  
  const currentYear = parseInt(year);
  const currentMonth = parseInt(month);
  
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

  const { data: { user } } = await supabase.auth.getUser();

  const res = await supabase
    .from("pessoal_transactions")
    .select("*, account:pessoal_accounts(name), subcategory:pessoal_subcategories(name, category:pessoal_categories(name, type))")
    .eq("user_id", user?.id)
    .gte("date", currentStart)
    .lte("date", currentEnd)
    .order("date", { ascending: true });

  return { data: res.data || [] };
};

function generateInstallments(description: string, amount: number, dateStr: string, type: "income" | "expense", accountId: number | null, totalInstallments: number, userId: string) {
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
      subcategory_id: null,
      installment_current: i + 1,
      installment_total: totalInstallments,
      user_id: userId
    });
  }
  
  return installments;
}

export default function TransacoesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const now = new Date();
  const [filterType, setFilterType] = useState<FilterType>("todas");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("full-month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [isNewOpen, setIsNewOpen] = useState(false);
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

  const cacheKey = useMemo(() => `${selectedYear}|${selectedMonth}|${periodFilter}`, [selectedYear, selectedMonth, periodFilter]);

  const { data, isLoading, mutate } = useSWR<{ data: Transaction[] }>(
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
  }, [user]);

  async function fetchAccounts() {
    const { data: accountsData } = await supabase
      .from("pessoal_accounts")
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
    if (confirm("Tem certeza que deseja excluir?")) {
      await supabase.from("pessoal_transactions").delete().eq("id", id);
      mutate();
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
        repeatMonths,
        user.id
      );
      
      const incomeInstallments = generateInstallments(
        `Transferência de ${accounts.find(a => a.id === fromAccountId)?.name || "conta"}`,
        amount,
        newTransaction.date,
        "income",
        toAccountId,
        repeatMonths,
        user.id
      );

      await supabase.from("pessoal_transactions").insert([...expenseInstallments, ...incomeInstallments]);
    } else {
      const accountId = newTransaction.fromAccountId ? parseInt(newTransaction.fromAccountId) : null;
      
      const installments = generateInstallments(
        newTransaction.description,
        amount,
        newTransaction.date,
        newTransaction.type,
        accountId,
        repeatMonths,
        user.id
      );

      await supabase.from("pessoal_transactions").insert(installments);
    }

    mutate();
    setIsNewOpen(false);
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

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  const transactions = data?.data || [];
  
  const transacoesFiltradas = transactions.filter(t => (!filterType || filterType === "todas") ? true : t.type === filterType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Transações</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Lista completa de transações</p>
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

          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="w-44 bg-white dark:bg-zinc-900">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-month">Mês Completo</SelectItem>
              <SelectItem value="month-to-date">Início até hoje</SelectItem>
              <SelectItem value="today-to-end">Hoje até fim</SelectItem>
            </SelectContent>
          </Select>

          <ToggleGroup type="single" value={filterType} onValueChange={(v) => setFilterType(v as FilterType || "todas")} className="bg-white dark:bg-zinc-900 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800">
            <ToggleGroupItem value="todas" className="px-3 py-1">Todas</ToggleGroupItem>
            <ToggleGroupItem value="expense" className="px-3 py-1">Despesas</ToggleGroupItem>
            <ToggleGroupItem value="income" className="px-3 py-1">Receitas</ToggleGroupItem>
            <ToggleGroupItem value="transfer" className="px-3 py-1">Transferências</ToggleGroupItem>
          </ToggleGroup>

          <Button onClick={() => setIsNewOpen(true)} className="ml-auto bg-emerald-500 hover:bg-emerald-600">
            <Plus className="w-4 h-4 mr-2" />
            Nova
          </Button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : transacoesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                transacoesFiltradas.map((t) => {
                  const descriptionWithInstallment = t.installment_current && t.installment_total
                    ? `${t.description} (${t.installment_current}/${t.installment_total})`
                    : t.description;
                  return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{descriptionWithInstallment}</TableCell>
                    <TableCell>{t.account?.name || "-"}</TableCell>
                    <TableCell>{t.subcategory?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge className={t.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                        {t.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(t.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className={`text-right font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "-"} R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={newTransaction.type === "expense" && !newTransaction.isTransfer ? "default" : "outline"} className="flex-1" onClick={() => setNewTransaction({ ...newTransaction, type: "expense", isTransfer: false })}>Despesa</Button>
              <Button variant={newTransaction.type === "income" && !newTransaction.isTransfer ? "default" : "outline"} className="flex-1" onClick={() => setNewTransaction({ ...newTransaction, type: "income", isTransfer: false })}>Receita</Button>
              <Button variant={newTransaction.isTransfer ? "default" : "outline"} className="flex-1" onClick={() => setNewTransaction({ ...newTransaction, isTransfer: true })}>Transferência</Button>
            </div>

            {newTransaction.isTransfer ? (
              <>
                <div className="space-y-2">
                  <Label>Conta de Origem</Label>
                  <Select value={newTransaction.fromAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, fromAccountId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta de Destino</Label>
                  <Select value={newTransaction.toAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, toAccountId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Aluguel" value={newTransaction.description} onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={newTransaction.amount} onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={newTransaction.date} onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })} />
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
            <Button variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNewTransaction}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}