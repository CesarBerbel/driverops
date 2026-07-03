import { CategoryManager } from "../components/CategoryManager";

export function ServiceCategoriesPage() {
  return (
    <CategoryManager
      categoryType="service"
      title="Categorias de Serviços"
      description="Gerencie as categorias de serviços do sistema."
    />
  );
}
