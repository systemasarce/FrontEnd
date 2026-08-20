import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PedidoDetalleUnidadOption } from './pedido-detalle-dialog.models';

interface PedidoDetalleUnidadSelectorDialogData {
  units: PedidoDetalleUnidadOption[];
}

@Component({
  selector: 'app-pedido-detalle-unidad-selector-dialog',
  templateUrl: './pedido-detalle-unidad-selector-dialog.component.html',
  styleUrls: ['./pedido-detalle-unidad-selector-dialog.component.scss']
})
export class PedidoDetalleUnidadSelectorDialogComponent {
  searchTerm = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PedidoDetalleUnidadSelectorDialogData,
    private readonly dialogRef: MatDialogRef<PedidoDetalleUnidadSelectorDialogComponent>
  ) {}

  get filteredUnits(): PedidoDetalleUnidadOption[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.data.units;
    }

    return this.data.units.filter((unit) =>
      String(unit.id).includes(term)
      || unit.code.toLowerCase().includes(term)
      || unit.description.toLowerCase().includes(term)
      || unit.abbreviation.toLowerCase().includes(term)
    );
  }

  trackByUnit(_: number, unit: PedidoDetalleUnidadOption): number {
    return unit.id;
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  selectUnit(unit: PedidoDetalleUnidadOption): void {
    this.dialogRef.close(unit);
  }

  close(): void {
    this.dialogRef.close();
  }
}
