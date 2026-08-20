import { Component, EventEmitter, Input, Output } from '@angular/core';

type PageMarker = number | 'ellipsis-start' | 'ellipsis-end';

@Component({
  selector: 'app-grid-pagination',
  templateUrl: './grid-pagination.component.html',
  styleUrls: ['./grid-pagination.component.scss']
})
export class GridPaginationComponent {
  @Input() totalItems = 0;
  @Input() currentPage = 1;
  @Input() pageSize = 25;

  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get startItem(): number {
    if (!this.totalItems) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    if (!this.totalItems) {
      return 0;
    }

    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  get pageMarkers(): PageMarker[] {
    const totalPages = this.totalPages;

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const markers: PageMarker[] = [1];
    const windowStart = Math.max(2, this.currentPage - 1);
    const windowEnd = Math.min(totalPages - 1, this.currentPage + 1);

    if (windowStart > 2) {
      markers.push('ellipsis-start');
    }

    for (let page = windowStart; page <= windowEnd; page += 1) {
      markers.push(page);
    }

    if (windowEnd < totalPages - 1) {
      markers.push('ellipsis-end');
    }

    markers.push(totalPages);
    return markers;
  }

  isPageNumber(marker: PageMarker): marker is number {
    return typeof marker === 'number';
  }

  goToPreviousPage(): void {
    if (this.currentPage <= 1) {
      return;
    }

    this.pageChange.emit(this.currentPage - 1);
  }

  goToNextPage(): void {
    if (this.currentPage >= this.totalPages) {
      return;
    }

    this.pageChange.emit(this.currentPage + 1);
  }

  goToPage(page: number): void {
    if (page === this.currentPage || page < 1 || page > this.totalPages) {
      return;
    }

    this.pageChange.emit(page);
  }

  trackByMarker(_index: number, marker: PageMarker): string {
    return String(marker);
  }
}
