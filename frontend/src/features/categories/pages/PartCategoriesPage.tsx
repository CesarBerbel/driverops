import { CategoryManager } from "../components/CategoryManager";

export function PartCategoriesPage() {
  return (
    <CategoryManager
      categoryType="part"
      title="Categorias de Peças"
      description="Gerencie as categorias de peças do sistema."
    />
  );
}
