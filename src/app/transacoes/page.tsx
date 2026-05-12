"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
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
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  category_type: string;
}

type FilterType = "todas" | "expense" | "income";
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

function generateInstallments(description: string, amount: number, dateStr: string, type: "income" | "expense", accountId: string | null, totalInstallments: number, userId: string) {
  const installments = [];
  const [year, month, day] = dateStr.split("-").map(Number);
  
  for (let i = 0; i < totalInstallments; i++) {
    const installMonth = month + i;
    let installYear = year;
    let adjustMonth = installMonth;
    
    if (installMonth > 12) {
      adjustMonth = ((installMonth - 1) % 12) + 1;
      installYear = year + Math.floor((installMonth - 1) / 12);
    }
    
    const daysInMonth = new Date(installYear, adjustMonth, 0).getDate();
    const finalDay = Math.min(day, daysInMonth);
    const finalDate = `${installYear}-${String(adjustMonth).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;
    
    console.log("DEBUG generateInstallments - dateStr:", dateStr, "finalDate:", finalDate);
    
    installments.push({
      description: `${description} (${i + 1}/${totalInstallments})`,
      date: finalDate,
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
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [filterType, setFilterType] = useState<FilterType>("todas");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("full-month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: "expense" as "income" | "expense",
    description: "",
    amount: "",
    date: todayStr,
    fromAccountId: "",
    toAccountId: "",
    subcategoryId: "",
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
      fetchSubcategories();
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

  async function fetchSubcategories() {
    const { data: subcategoriesData } = await supabase
      .from("pessoal_subcategories")
      .select("id, name, category_type")
      .eq("user_id", user?.id)
      .order("name");
    
    if (subcategoriesData) {
      setSubcategories(subcategoriesData);
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
    if (!user || !newTransaction.description || !newTransaction.amount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    console.log("DEBUG - newTransaction:", newTransaction);
    
    const cleanAmount = Number(newTransaction.amount.toString().replace(',', '.'));
    console.log("DEBUG - cleanAmount:", cleanAmount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    const repeatMonths = parseInt(newTransaction.repeatMonths);
    const selectedAccount = newTransaction.fromAccountId || null;
    const selectedSubcategory = newTransaction.subcategoryId || null;
    const selectedType = newTransaction.type === "income" ? "income" : "expense";
    console.log("DEBUG - selectedType:", selectedType);

    try {
      if (newTransaction.isTransfer && newTransaction.fromAccountId && newTransaction.toAccountId) {
        const fromAccountId = newTransaction.fromAccountId;
        const toAccountId = newTransaction.toAccountId;
        
        const expenseInstallments = generateInstallments(
          `Transferência para ${accounts.find(a => a.id === toAccountId)?.name || "conta"}`,
          cleanAmount,
          newTransaction.date,
          "expense",
          fromAccountId,
          repeatMonths,
          user.id
        );
        
        const incomeInstallments = generateInstallments(
          `Transferência de ${accounts.find(a => a.id === fromAccountId)?.name || "conta"}`,
          cleanAmount,
          newTransaction.date,
          "income",
          toAccountId,
          repeatMonths,
          user.id
        );

        const { error: insertError } = await supabase.from("pessoal_transactions").insert([...expenseInstallments, ...incomeInstallments]);
        
        if (insertError) {
          console.error(insertError);
          toast.error(insertError.message, { description: "Erro ao salvar transação" });
          return;
        }
      } else {
        const installments = generateInstallments(
          newTransaction.description,
          cleanAmount,
          newTransaction.date,
          selectedType as "income" | "expense",
          newTransaction.fromAccountId || null,
          repeatMonths,
          user.id
        );

        const payload = installments.map(inst => ({
          ...inst,
          account_id: newTransaction.fromAccountId || null,
          subcategory_id: newTransaction.subcategoryId || null
        }));

        console.log("DEBUG payload:", payload);

        const { error: insertError } = await supabase.from("pessoal_transactions").insert(payload);
        
        if (insertError) {
          console.error(insertError);
          toast.error(insertError.message, { description: "Erro ao salvar transação" });
          return;
        }
      }

      toast.success("Transação salva com sucesso!");
      mutate();
      setIsNewOpen(false);
      setNewTransaction({
        type: "expense",
        description: "",
        amount: "",
        date: todayStr,
        fromAccountId: "",
        toAccountId: "",
        subcategoryId: "",
        isTransfer: false,
        repeatMonths: "1"
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message, { description: "Erro ao salvar transação" });
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  const transactions = data?.data || [];
  
  const currentFilter = Array.isArray(filterType) ? filterType[0] : filterType;
  const transacoesFiltradas = transactions.filter(t => {
    if (currentFilter === 'todas' || !currentFilter) return true;
    return t.type === currentFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 p-3 sm:p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center gap-2 lg:gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-zinc-900 dark:text-zinc-50 truncate">Transações</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs lg:text-sm hidden lg:block">Lista completa de transações</p>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2 lg:gap-3">
          <div className="flex items-center justify-between lg:justify-start gap-1 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-1">
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
            <SelectTrigger className="w-full lg:w-44 bg-white dark:bg-zinc-900">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-month">Mês Completo</SelectItem>
              <SelectItem value="month-to-date">Início até hoje</SelectItem>
              <SelectItem value="today-to-end">Hoje até fim</SelectItem>
            </SelectContent>
          </Select>

          <ToggleGroup type="single" value={filterType} onValueChange={(val) => { if (val) setFilterType(val as FilterType); }} className="bg-white dark:bg-zinc-900 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800 w-full lg:w-auto overflow-x-auto">
            <ToggleGroupItem value="todas" className="px-3 py-1 text-sm">Todas</ToggleGroupItem>
            <ToggleGroupItem value="expense" className="px-3 py-1 text-sm">Despesas</ToggleGroupItem>
            <ToggleGroupItem value="income" className="px-3 py-1 text-sm">Receitas</ToggleGroupItem>
          </ToggleGroup>

          <Button onClick={() => setIsNewOpen(true)} className="w-full lg:w-auto bg-emerald-500 hover:bg-emerald-600">
            <Plus className="w-4 h-4 mr-0 lg:mr-2" />
            <span className="lg:hidden">Nova</span>
          </Button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Descrição</TableHead>
                <TableHead className="hidden md:table-cell whitespace-nowrap">Conta</TableHead>
                <TableHead className="hidden lg:table-cell whitespace-nowrap">Subcategoria</TableHead>
                <TableHead className="hidden xl:table-cell whitespace-nowrap">Categoria</TableHead>
                <TableHead className="whitespace-nowrap">Tipo</TableHead>
                <TableHead className="whitespace-nowrap">Data</TableHead>
                <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                <TableHead className="w-16 whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : transacoesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
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
                    <TableCell className="font-medium max-w-[150px] lg:max-w-none truncate">{descriptionWithInstallment}</TableCell>
                    <TableCell className="hidden md:table-cell">{t.account?.name || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{t.subcategory?.name || "-"}</TableCell>
                    <TableCell className="hidden xl:table-cell">{t.subcategory?.category?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge className={t.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                        {t.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{t.date.split("-").reverse().join("/")}</TableCell>
                    <TableCell className={`text-right font-medium whitespace-nowrap ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "-"} R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(t.id)}>
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
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Nova Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1 sm:gap-2">
              <Button size="sm" variant={newTransaction.type === "expense" && !newTransaction.isTransfer ? "default" : "outline"} className="flex-1 text-xs sm:text-sm" onClick={() => setNewTransaction({ ...newTransaction, type: "expense", isTransfer: false })}>Despesa</Button>
              <Button size="sm" variant={newTransaction.type === "income" && !newTransaction.isTransfer ? "default" : "outline"} className="flex-1 text-xs sm:text-sm" onClick={() => setNewTransaction({ ...newTransaction, type: "income", isTransfer: false })}>Receita</Button>
              <Button size="sm" variant={newTransaction.isTransfer ? "default" : "outline"} className="flex-1 text-xs sm:text-sm" onClick={() => setNewTransaction({ ...newTransaction, isTransfer: true })}>Transferência</Button>
            </div>

            {newTransaction.isTransfer ? (
              <>
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-sm">Conta de Origem</Label>
                  <Select value={newTransaction.fromAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, fromAccountId: v })}>
                    <SelectTrigger className="h-10 sm:h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-sm">Conta de Destino</Label>
                  <Select value={newTransaction.toAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, toAccountId: v })}>
                    <SelectTrigger className="h-10 sm:h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-sm">Conta</Label>
                  <Select value={newTransaction.fromAccountId} onValueChange={(v) => setNewTransaction({ ...newTransaction, fromAccountId: v })}>
                    <SelectTrigger className="h-10 sm:h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-sm">Subcategoria</Label>
                  <Select value={newTransaction.subcategoryId} onValueChange={(v) => setNewTransaction({ ...newTransaction, subcategoryId: v })}>
                    <SelectTrigger className="h-10 sm:h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {subcategories.filter(sc => newTransaction.type === "income" ? sc.category_type === "income" : sc.category_type === "expense").map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1 sm:space-y-2">
              <Label className="text-sm">Descrição</Label>
              <Input className="h-10 sm:h-11" placeholder="Ex: Aluguel" value={newTransaction.description} onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-sm">Valor</Label>
                <Input className="h-10 sm:h-11" type="number" step="0.01" placeholder="0,00" value={newTransaction.amount} onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })} />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-sm">Data</Label>
                <Input className="h-10 sm:h-11" type="date" value={newTransaction.date} onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1 sm:space-y-2">
              <Label className="text-sm">Repetir por (meses)</Label>
              <Select value={newTransaction.repeatMonths} onValueChange={(v) => setNewTransaction({ ...newTransaction, repeatMonths: v })}>
                <SelectTrigger className="h-10 sm:h-11"><SelectValue /></SelectTrigger>
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
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsNewOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveNewTransaction} className="w-full sm:w-auto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}