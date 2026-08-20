export const DEFAULT_GRID_PAGE_SIZE = 20;

export function paginateItems<T>(items: T[], currentPage: number, pageSize: number = DEFAULT_GRID_PAGE_SIZE): T[] {
  const normalizedPage = normalizePaginationPage(currentPage, items.length, pageSize);
  const start = (normalizedPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function normalizePaginationPage(currentPage: number, totalItems: number, pageSize: number = DEFAULT_GRID_PAGE_SIZE): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPage = Number.isInteger(currentPage) && currentPage > 0 ? currentPage : 1;
  return Math.min(normalizedPage, totalPages);
}
