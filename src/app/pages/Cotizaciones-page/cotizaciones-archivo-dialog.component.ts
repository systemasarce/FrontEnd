import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface CotizacionArchivoDialogData {
  nombre: string;
  verArchivo: () => void;
}

@Component({
  selector: 'app-cotizaciones-archivo-dialog',
  templateUrl: './cotizaciones-archivo-dialog.component.html',
  styleUrls: ['./cotizaciones-archivo-dialog.component.scss']
})
export class CotizacionesArchivoDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<CotizacionesArchivoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CotizacionArchivoDialogData
  ) {}

  verArchivo(): void {
    this.data.verArchivo();
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
