import { CategoryManager } from "../components/CategoryManager";

export function ClientCategoriesPage() {
  return (
    <CategoryManager
      categoryType="client"
      title="Categorias de Clientes"
      description="Gerencie as categorias de clientes do sistema."
    />
  );
}
