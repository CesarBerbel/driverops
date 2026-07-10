import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CustomerCombobox } from "@/components/shared/CustomerCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/features/customers/types";
import { extractErrorMessage } from "@/lib/api-client";

import { createTask, updateTask } from "./api";
import { PRIORITY_OPTIONS, TASK_STATUS } from "./constants";
import type { CrmTask, Priority, TaskStatus } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CrmTask | null; // null => criação
  onSaved: () => void;
}

const STATUS_ITEMS: TaskStatus[] = ["open", "done", "canceled"];

export function TaskFormDialog({ open, onOpenChange, task, onSaved }: Props) {
  const isEdit = task !== null;
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>("open");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  // Sincroniza o formulário sempre que abre (edição ou nova).
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setPriority(task?.priority ?? "medium");
    setStatus(task?.status ?? "open");
    setDueDate(task?.due_date ?? "");
    setNotes(task?.notes ?? "");
    setCustomer(null);
  }, [open, task]);

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Informe um título para a tarefa.");
      return;
    }
    if (!isEdit && !customer) {
      toast.error("Selecione um cliente para a tarefa.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && task) {
        await updateTask(task.id, {
          title: title.trim(),
          priority,
          status,
          due_date: dueDate || null,
          notes,
        });
        toast.success("Tarefa atualizada.");
      } else if (customer) {
        await createTask({
          title: title.trim(),
          customer: customer.id,
          priority,
          due_date: dueDate || null,
          notes,
        });
        toast.success("Tarefa criada.");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Não foi possível salvar a tarefa."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isEdit ? (
            <div className="space-y-1">
              <Label>Cliente</Label>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {task?.customer_name ?? "—"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Cliente</Label>
              <CustomerCombobox
                selectedName={customer?.name ?? ""}
                onSelect={setCustomer}
                onClear={() => setCustomer(null)}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ligar para confirmar o retorno"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-due">Prazo</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {isEdit && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="task-notes">Observações</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalhes ou contexto (opcional)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {isEdit ? "Salvar" : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
