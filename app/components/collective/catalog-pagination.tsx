import { useSearchParams } from "react-router";
import type { CatalogPage } from "../../services/catalog-page";
export function CatalogPagination({ page }: { page: CatalogPage | null }) {
  const [params, setParams] = useSearchParams();
  if (!page) return null;
  const move = (number: number) => { const next = new URLSearchParams(params); next.set("page", String(number)); setParams(next, { preventScrollReset: true }); };
  const first = page.filteredTotal ? (page.page - 1) * page.pageSize + 1 : 0;
  const last = Math.min(page.page * page.pageSize, page.filteredTotal);
  return <nav className="collective-settings-actions" aria-label="Catalog pagination">
    <button className="collective-button collective-button-secondary" type="button" disabled={page.page <= 1} onClick={() => move(page.page - 1)}>Previous</button>
    <span aria-live="polite">{first}–{last} of {page.filteredTotal.toLocaleString()} products · Page {page.page} / {page.pageCount}</span>
    <button className="collective-button collective-button-secondary" type="button" disabled={page.page >= page.pageCount} onClick={() => move(page.page + 1)}>Next</button>
  </nav>;
}

