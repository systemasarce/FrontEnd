import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface CentroCostoOption {
  id: number;
  descripcion: string;
  cantidadRequerida?: number;
}

interface CentroCostoDialogData {
  centrosCosto: CentroCostoOption[];
}

@Component({
  selector: 'app-centro-costo-selector-dialog',
  templateUrl: './centro-costo-selector-dialog.component.html',
  styleUrls: ['./centro-costo-selector-dialog.component.scss']
})
export class CentroCostoSelectorDialogComponent {
  searchTerm = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CentroCostoDialogData,
    private readonly dialogRef: MatDialogRef<CentroCostoSelectorDialogComponent>
  ) {}

  get filteredCentrosCosto(): CentroCostoOption[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.data.centrosCosto;
    }

    return this.data.centrosCosto.filter((centroCosto) =>
      String(centroCosto.id).includes(term)
      || centroCosto.descripcion.toLowerCase().includes(term)
    );
  }

  trackByCentroCosto(_: number, centroCosto: CentroCostoOption): number {
    return centroCosto.id;
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  selectCentroCosto(centroCosto: CentroCostoOption): void {
    this.dialogRef.close(centroCosto);
  }

  close(): void {
    this.dialogRef.close();
  }
}
