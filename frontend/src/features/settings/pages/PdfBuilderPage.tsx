import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Eye,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/useAuth";
import { extractErrorMessage } from "@/lib/api-client";

import { getPdfLayout, previewPdfLayout, updatePdfLayout } from "../api";
import type { PdfBlock, PdfCatalogEntry, PdfCatalogOption } from "../types";

// Blocos "extras" (não pertencem ao layout padrão da OS): podem ser adicionados
// livremente para montar o documento.
const EXTRA_TYPES = new Set(["text", "band", "spacer"]);

let blockCounter = 0;
function newId(): string {
  blockCounter += 1;
  return `b${blockCounter}-${blockCounter * 7}`;
}

function defaultOptions(entry: PdfCatalogEntry): Record<string, unknown> {
  return Object.fromEntries(entry.options.map((o) => [o.key, o.default]));
}

// Layout padrão: catálogo sem os blocos extras, cada um com suas opções default.
// Espelha default_pdf_blocks() no backend.
function defaultBlocks(catalog: PdfCatalogEntry[]): PdfBlock[] {
  return catalog
    .filter((entry) => !EXTRA_TYPES.has(entry.type))
    .map((entry) => ({ id: newId(), type: entry.type, options: defaultOptions(entry) }));
}

function withIds(blocks: PdfBlock[]): PdfBlock[] {
  return blocks.map((b) => ({ ...b, id: b.id || newId() }));
}

/** Controle de uma opção de bloco, escolhido pelo `kind` da especificação. */
function OptionControl({
  option,
  value,
  disabled,
  onChange,
}: {
  option: PdfCatalogOption;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  if (option.kind === "bool") {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <span className="text-sm">{option.label}</span>
        <Switch
          checked={Boolean(value)}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    );
  }

  if (option.kind === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{option.label}</Label>
        <Select
          value={String(value ?? "")}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(option.choices ?? []).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (option.kind === "multi") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{option.label}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {(option.choices ?? []).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.includes(key)}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, key]
                    : selected.filter((k) => k !== key);
                  // Mantém a ordem canônica das escolhas.
                  onChange(
                    (option.choices ?? [])
                      .map(([k]) => k)
                      .filter((k) => next.includes(k)),
                  );
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (option.kind === "textarea") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{option.label}</Label>
        <Textarea
          rows={3}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  // text | number
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{option.label}</Label>
      <Input
        type={option.kind === "number" ? "number" : "text"}
        className="h-8"
        min={option.min}
        max={option.max}
        value={value === undefined || value === null ? "" : String(value)}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            option.kind === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
    </div>
  );
}

export function PdfBuilderPage() {
  const { user } = useAuth();
  const canEdit = Boolean(user?.is_superuser);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pdf-layout"],
    queryFn: getPdfLayout,
  });

  const [blocks, setBlocks] = useState<PdfBlock[]>([]);
  const [accentColor, setAccentColor] = useState("#e5e7eb");
  const [baseFontSize, setBaseFontSize] = useState(8.5);
  const [addType, setAddType] = useState("text");

  useEffect(() => {
    if (data) {
      setBlocks(withIds(data.blocks));
      setAccentColor(data.accent_color);
      setBaseFontSize(data.base_font_size);
    }
  }, [data]);

  const catalog = data?.catalog ?? [];
  const catalogByType = new Map(catalog.map((c) => [c.type, c]));

  const payload = () => ({
    blocks: blocks.map(({ id: _id, ...rest }) => rest),
    accent_color: accentColor,
    base_font_size: baseFontSize,
  });

  const mutation = useMutation({
    mutationFn: () => updatePdfLayout(payload()),
    onSuccess: (updated) => {
      setBlocks(withIds(updated.blocks));
      setAccentColor(updated.accent_color);
      setBaseFontSize(updated.base_font_size);
      queryClient.setQueryData(["pdf-layout"], updated);
      toast.success("Layout do PDF salvo.", { id: "pdf-layout-saved" });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o layout do PDF."));
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => previewPdfLayout(payload()),
    onError: (error) => {
      toast.error(
        extractErrorMessage(
          error,
          "Não foi possível gerar a prévia. Cadastre ao menos uma OS para pré-visualizar.",
        ),
      );
    },
  });

  function addBlock() {
    const entry = catalogByType.get(addType);
    if (!entry) return;
    setBlocks((prev) => [
      ...prev,
      { id: newId(), type: entry.type, options: defaultOptions(entry) },
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateOption(id: string, key: string, value: unknown) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, options: { ...b.options, [key]: value } } : b,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Configurações
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Construtor de PDF da OS</h1>
        <p className="text-muted-foreground">
          Monte o PDF da Ordem de Serviço bloco a bloco: escolha o que aparece, em que
          ordem e com quais opções. Use "Pré-visualizar" para ver o resultado com a OS
          mais recente antes de salvar.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>Apenas superusuários podem alterar o layout do PDF.</span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar o layout do PDF. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Aparência geral */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aparência</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-6">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cor de destaque</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-8 w-12 cursor-pointer rounded border bg-background"
                    value={accentColor}
                    disabled={!canEdit}
                    onChange={(e) => setAccentColor(e.target.value)}
                    aria-label="Cor de destaque"
                  />
                  <span className="font-mono text-sm text-muted-foreground">
                    {accentColor}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tamanho do texto (pt)</Label>
                <Input
                  type="number"
                  className="h-8 w-24"
                  min={6}
                  max={14}
                  step={0.5}
                  value={baseFontSize}
                  disabled={!canEdit}
                  onChange={(e) => setBaseFontSize(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Blocos do documento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Blocos do documento ({blocks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {blocks.length === 0 && (
                <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Nenhum bloco. Adicione blocos abaixo para montar o documento.
                </p>
              )}

              {blocks.map((block, index) => {
                const entry = catalogByType.get(block.type);
                if (!entry) return null;
                return (
                  <div
                    key={block.id}
                    className="rounded-lg border bg-card p-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.label}</span>
                          {EXTRA_TYPES.has(block.type) && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                              extra
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={!canEdit || index === 0}
                          onClick={() => move(index, -1)}
                          aria-label={`Mover ${entry.label} para cima`}
                        >
                          <ArrowDown className="size-4 rotate-180" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={!canEdit || index === blocks.length - 1}
                          onClick={() => move(index, 1)}
                          aria-label={`Mover ${entry.label} para baixo`}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          disabled={!canEdit}
                          onClick={() => removeBlock(block.id!)}
                          aria-label={`Remover ${entry.label}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {entry.options.length > 0 && (
                      <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                        {entry.options.map((option) => (
                          <OptionControl
                            key={option.key}
                            option={option}
                            value={block.options[option.key]}
                            disabled={!canEdit}
                            onChange={(value) => updateOption(block.id!, option.key, value)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {canEdit && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Select value={addType} onValueChange={setAddType}>
                    <SelectTrigger className="h-9 w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.map((entry) => (
                        <SelectItem key={entry.type} value={entry.type}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={addBlock}>
                    <Plus className="size-4" />
                    Adicionar bloco
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}
              Pré-visualizar
            </Button>
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBlocks(defaultBlocks(catalog));
                    setAccentColor("#e5e7eb");
                    setBaseFontSize(8.5);
                  }}
                  disabled={mutation.isPending}
                >
                  <RotateCcw className="size-4" />
                  Restaurar padrão
                </Button>
                <Button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending && <Loader2 className="animate-spin" />}
                  Salvar alterações
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
