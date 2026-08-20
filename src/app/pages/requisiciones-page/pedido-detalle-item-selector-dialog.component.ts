import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PedidoDetalleItemOption } from './pedido-detalle-dialog.models';

interface PedidoDetalleItemSelectorDialogData {
  items: PedidoDetalleItemOption[];
}

@Component({
  selector: 'app-pedido-detalle-item-selector-dialog',
  templateUrl: './pedido-detalle-item-selector-dialog.component.html',
  styleUrls: ['./pedido-detalle-item-selector-dialog.component.scss']
})
export class PedidoDetalleItemSelectorDialogComponent {
  searchTerm = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PedidoDetalleItemSelectorDialogData,
    private readonly dialogRef: MatDialogRef<PedidoDetalleItemSelectorDialogComponent>
  ) {}

  get filteredItems(): PedidoDetalleItemOption[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.data.items;
    }

    return this.data.items.filter((item) =>
      String(item.id).includes(term)
      || item.code.toLowerCase().includes(term)
      || item.description.toLowerCase().includes(term)
      || item.groupDescription.toLowerCase().includes(term)
    );
  }

  trackByItem(_: number, item: PedidoDetalleItemOption): number {
    return item.id;
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  selectItem(item: PedidoDetalleItemOption): void {
    this.dialogRef.close(item);
  }

  close(): void {
    this.dialogRef.close();
  }
}
