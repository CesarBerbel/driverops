import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

import {
  fetchPdfLayoutPreviewUrl,
  getOrderSettings,
  getPdfLayout,
  updateOrderSettings,
  updatePdfLayout,
} from "../api";
import type { PdfBlock, PdfCatalogEntry, PdfCatalogOption, PdfTexts } from "../types";

// Blocos "extras" (estruturais, fora do layout padrão): podem ser adicionados
// livremente para montar o documento.
const EXTRA_TYPES = new Set(["spacer"]);

// Textos curtos que pertencem a um bloco específico: aparecem dentro do cartão
// do bloco (o texto da via no bloco "Barra da OS", etc.). Os termos têm um
// editor próprio (checkbox + texto por termo).
const BLOCK_TEXTS: Record<string, { key: keyof PdfTexts; label: string; long: boolean }[]> = {
  os_bar: [{ key: "pdf_client_copy_label", label: "Texto central (via)", long: false }],
  signature: [{ key: "pdf_signature_label", label: "Texto da assinatura", long: false }],
  footer: [{ key: "pdf_footer_text", label: "Texto do rodapé", long: true }],
};

// Termos do bloco "Termos": chave (usada em options.include), campo de texto
// (armazenado na OS) e rótulo. A ordem é a ordem em que saem no PDF.
const TERM_ROWS: { key: string; field: keyof PdfTexts; label: string }[] = [
  { key: "authorization", field: "service_authorization_terms", label: "Autorização de serviço" },
  { key: "warranty", field: "warranty_terms", label: "Garantia" },
  { key: "general", field: "general_conditions", label: "Condições gerais" },
  { key: "acknowledgment", field: "customer_acknowledgment_terms", label: "Ciência do cliente" },
];
const TERM_ORDER = TERM_ROWS.map((r) => r.key);

const EMPTY_TEXTS: PdfTexts = {
  pdf_client_copy_label: "",
  pdf_signature_label: "",
  warranty_terms: "",
  service_authorization_terms: "",
  customer_acknowledgment_terms: "",
  general_conditions: "",
  pdf_footer_text: "",
};

let blockCounter = 0;
function newId(): string {
  blockCounter += 1;
  return `b${blockCounter}-${blockCounter * 7}`;
}

function defaultOptions(entry: PdfCatalogEntry): Record<string, unknown> {
  return Object.fromEntries(entry.options.map((o) => [o.key, o.default]));
}

function defaultBlocks(catalog: PdfCatalogEntry[]): PdfBlock[] {
  return catalog
    .filter((entry) => !EXTRA_TYPES.has(entry.type))
    .map((entry) => ({ id: newId(), type: entry.type, options: defaultOptions(entry) }));
}

function withIds(blocks: PdfBlock[]): PdfBlock[] {
  return blocks.map((b) => ({ ...b, id: b.id || newId() }));
}

/** Controle de uma opção estrutural do bloco, escolhido pelo `kind`. */
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
        <Switch checked={Boolean(value)} disabled={disabled} onCheckedChange={onChange} />
      </div>
    );
  }

  if (option.kind === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{option.label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange} disabled={disabled}>
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
                  onChange(
                    (option.choices ?? []).map(([k]) => k).filter((k) => next.includes(k)),
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
          onChange(option.kind === "number" ? Number(e.target.value) : e.target.value)
        }
      />
    </div>
  );
}

/** Editor dos termos dentro do bloco "Termos": liga/desliga + texto por termo. */
function TermsFields({
  include,
  texts,
  disabled,
  onToggle,
  onText,
}: {
  include: string[];
  texts: PdfTexts;
  disabled: boolean;
  onToggle: (key: string, on: boolean) => void;
  onText: (field: keyof PdfTexts, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {TERM_ROWS.map((row) => {
        const on = include.includes(row.key);
        return (
          <div key={row.key} className="rounded-md border p-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={on}
                disabled={disabled}
                onChange={(e) => onToggle(row.key, e.target.checked)}
              />
              {row.label}
              {!on && <span className="text-xs font-normal text-muted-foreground">(oculto)</span>}
            </label>
            {on && (
              <Textarea
                aria-label={`Texto de ${row.label}`}
                className="mt-2"
                rows={2}
                value={texts[row.field]}
                disabled={disabled}
                placeholder="Deixe em branco para não mostrar."
                onChange={(e) => onText(row.field, e.target.value)}
              />
            )}
          </div>
        );
      })}
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
  const settingsQuery = useQuery({
    queryKey: ["order-settings"],
    queryFn: getOrderSettings,
  });

  const [blocks, setBlocks] = useState<PdfBlock[]>([]);
  const [accentColor, setAccentColor] = useState("#e5e7eb");
  const [baseFontSize, setBaseFontSize] = useState(8.5);
  const [texts, setTexts] = useState<PdfTexts>(EMPTY_TEXTS);
  const [addType, setAddType] = useState("spacer");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (data) {
      setBlocks(withIds(data.blocks));
      setAccentColor(data.accent_color);
      setBaseFontSize(data.base_font_size);
    }
  }, [data]);

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setTexts({
        pdf_client_copy_label: s.pdf_client_copy_label,
        pdf_signature_label: s.pdf_signature_label,
        warranty_terms: s.warranty_terms,
        service_authorization_terms: s.service_authorization_terms,
        customer_acknowledgment_terms: s.customer_acknowledgment_terms,
        general_conditions: s.general_conditions,
        pdf_footer_text: s.pdf_footer_text,
      });
    }
  }, [settingsQuery.data]);

  // Revoga a última object URL da prévia ao desmontar (evita vazamento).
  useEffect(() => {
    return () => {
      if (previewUrlRef.current && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const catalog = data?.catalog ?? [];
  const catalogByType = new Map(catalog.map((c) => [c.type, c]));

  const layoutPayload = () => ({
    blocks: blocks.map(({ id: _id, ...rest }) => rest),
    accent_color: accentColor,
    base_font_size: baseFontSize,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const [layout] = await Promise.all([
        updatePdfLayout(layoutPayload()),
        updateOrderSettings(texts),
      ]);
      return layout;
    },
    onSuccess: (updated) => {
      setBlocks(withIds(updated.blocks));
      setAccentColor(updated.accent_color);
      setBaseFontSize(updated.base_font_size);
      queryClient.setQueryData(["pdf-layout"], updated);
      queryClient.invalidateQueries({ queryKey: ["order-settings"] });
      toast.success("PDF da OS salvo.", { id: "pdf-layout-saved" });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, "Não foi possível salvar o PDF da OS."));
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => fetchPdfLayoutPreviewUrl({ ...layoutPayload(), texts }),
    onSuccess: (url) => {
      if (previewUrlRef.current && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = url;
      setPreviewUrl(url);
    },
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
      prev.map((b) => (b.id === id ? { ...b, options: { ...b.options, [key]: value } } : b)),
    );
  }

  function updateText(name: keyof PdfTexts, value: string) {
    setTexts((prev) => ({ ...prev, [name]: value }));
  }

  function toggleTerm(id: string, current: string[], key: string, on: boolean) {
    const set = new Set(current);
    if (on) set.add(key);
    else set.delete(key);
    updateOption(id, "include", TERM_ORDER.filter((k) => set.has(k)));
  }

  const loading = isLoading || settingsQuery.isLoading;
  const failed = isError || settingsQuery.isError || !data || !settingsQuery.data;

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
          Monte o PDF da Ordem de Serviço num lugar só. Cada cartão é uma seção do
          documento, na ordem em que aparece — ajuste o texto e as opções ali mesmo,
          reordene com as setas e acompanhe pela prévia ao lado.
        </p>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>Apenas superusuários podem alterar o PDF da OS.</span>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : failed ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar o PDF da OS. Tente novamente.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refetch();
                settingsQuery.refetch();
              }}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          {/* Coluna de configuração */}
          <div className="min-w-0 space-y-6">
            {/* Seções do documento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Seções do documento ({blocks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {blocks.length === 0 && (
                  <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                    Nenhuma seção. Adicione seções abaixo para montar o documento.
                  </p>
                )}

                {blocks.map((block, index) => {
                  const entry = catalogByType.get(block.type);
                  if (!entry) return null;
                  const blockTexts = BLOCK_TEXTS[block.type] ?? [];
                  const isTerms = block.type === "terms";
                  const include = Array.isArray(block.options.include)
                    ? (block.options.include as string[])
                    : [];
                  return (
                    <div key={block.id} className="rounded-lg border bg-card p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {index + 1}
                        </span>
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

                      {(blockTexts.length > 0 || isTerms || entry.options.length > 0) && (
                        <div className="mt-3 space-y-3 border-t pt-3">
                          {blockTexts.map((t) =>
                            t.long ? (
                              <div key={t.key} className="space-y-1">
                                <Label htmlFor={t.key} className="text-xs text-muted-foreground">
                                  {t.label}
                                </Label>
                                <Textarea
                                  id={t.key}
                                  rows={2}
                                  value={texts[t.key]}
                                  disabled={!canEdit}
                                  onChange={(e) => updateText(t.key, e.target.value)}
                                />
                              </div>
                            ) : (
                              <div key={t.key} className="space-y-1">
                                <Label htmlFor={t.key} className="text-xs text-muted-foreground">
                                  {t.label}
                                </Label>
                                <Input
                                  id={t.key}
                                  className="h-8"
                                  value={texts[t.key]}
                                  disabled={!canEdit}
                                  onChange={(e) => updateText(t.key, e.target.value)}
                                />
                              </div>
                            ),
                          )}

                          {isTerms && (
                            <TermsFields
                              include={include}
                              texts={texts}
                              disabled={!canEdit}
                              onToggle={(key, on) => toggleTerm(block.id!, include, key, on)}
                              onText={updateText}
                            />
                          )}

                          {entry.options.length > 0 && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {entry.options
                                // "include" dos termos já é tratado pelos checkboxes acima.
                                .filter((o) => !(isTerms && o.key === "include"))
                                .map((option) => (
                                  <OptionControl
                                    key={option.key}
                                    option={option}
                                    value={block.options[option.key]}
                                    disabled={!canEdit}
                                    onChange={(value) =>
                                      updateOption(block.id!, option.key, value)
                                    }
                                  />
                                ))}
                            </div>
                          )}
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
                      Adicionar seção
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
                    <span className="font-mono text-sm text-muted-foreground">{accentColor}</span>
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
          </div>

          {/* Prévia + ações (painel fixo) */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">Prévia</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => previewMutation.mutate()}
                    disabled={previewMutation.isPending}
                  >
                    {previewMutation.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Atualizar
                  </Button>
                  {previewUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
                      aria-label="Abrir prévia em nova aba"
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {previewUrl ? (
                  <iframe
                    title="Prévia do PDF da OS"
                    src={previewUrl}
                    className="h-[70vh] w-full rounded border bg-white"
                  />
                ) : (
                  <div className="flex h-[70vh] flex-col items-center justify-center gap-2 rounded border border-dashed text-center text-sm text-muted-foreground">
                    <RefreshCw className="size-6" />
                    <p>
                      Clique em <strong>Atualizar</strong> para ver o PDF com a OS mais
                      recente.
                    </p>
                  </div>
                )}

                {canEdit && (
                  <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
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
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
