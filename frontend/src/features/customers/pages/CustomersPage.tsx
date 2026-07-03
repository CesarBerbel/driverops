import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, Users, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhone } from "@/lib/masks";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { listCustomers } from "../api";
import { CUSTOMER_TYPE_LABELS } from "../constants";

export function CustomersPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  // Bypass the debounce when the box is empty, so "Limpar pesquisa" (and
  // deleting the text manually) restores the full list instantly.
  const effectiveSearch = searchInput === "" ? "" : debouncedSearch;

  const {
    data: customers,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customers", effectiveSearch],
    queryFn: () => listCustomers(effectiveSearch || undefined),
  });

  const isEmpty = (customers?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie os clientes cadastrados no sistema.</p>
        </div>
        <Button asChild>
          <Link to="/customers/new">Novo cliente</Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente pelo nome..."
            className="pl-9"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        {searchInput && (
          <Button variant="ghost" size="sm" onClick={() => setSearchInput("")}>
            <X />
            Limpar pesquisa
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os clientes. Tente novamente.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            {effectiveSearch ? (
              <p className="text-sm text-muted-foreground">
                Nenhum cliente encontrado para "{effectiveSearch}".
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
                <Button size="sm" asChild>
                  <Link to="/customers/new">Novo cliente</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead className="w-0 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {CUSTOMER_TYPE_LABELS[customer.customer_type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.phone ? formatPhone(customer.phone) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.city ? `${customer.city}${customer.state ? `/${customer.state}` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/customers/${customer.id}/edit`}>Editar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
