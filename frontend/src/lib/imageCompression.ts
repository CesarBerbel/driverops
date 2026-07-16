// Comprime uma imagem no cliente antes do upload: redimensiona para caber em
// `maxDimension` (maior lado) e reencoda em JPEG na `quality` dada. Fotos de
// celular costumam ter vários MB; isto reduz para algumas centenas de KB,
// acelerando o upload no pátio (rede móvel) e economizando armazenamento.
//
// É defensivo: qualquer coisa que não seja imagem rasterizável (PDF, SVG, GIF)
// ou que não dê para decodificar passa INALTERADA. Se o resultado ficar maior
// que o original, mantém o original.

interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

// Formatos que não vale a pena (ou não dá) recomprimir por aqui.
const SKIP_TYPES = new Set(["image/svg+xml", "image/gif"]);

export async function compressImage(
  file: File,
  { maxDimension = 1600, quality = 0.8 }: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // não deu para decodificar -> envia o original
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close?.();
  }
}
