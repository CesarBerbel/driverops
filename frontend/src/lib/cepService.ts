// Isolated integration point for the public CEP (Brazilian postal code)
// lookup provider. Everything about "which API we use" lives in this one
// file -- swapping ViaCEP for another provider later only touches this
// module, not the forms that consume it (Customers, Suppliers, ...).

export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type CepLookupResult =
  | { status: "found"; address: CepAddress }
  | { status: "not_found" }
  | { status: "error" };

interface ViaCepResponse {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

export async function lookupCep(cep: string): Promise<CepLookupResult> {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) {
      return { status: "error" };
    }

    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) {
      return { status: "not_found" };
    }

    return {
      status: "found",
      address: {
        street: data.logradouro ?? "",
        neighborhood: data.bairro ?? "",
        city: data.localidade ?? "",
        state: data.uf ?? "",
      },
    };
  } catch {
    return { status: "error" };
  }
}
