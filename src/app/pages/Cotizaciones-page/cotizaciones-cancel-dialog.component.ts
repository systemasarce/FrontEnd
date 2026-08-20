import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-cotizaciones-cancel-dialog',
  templateUrl: './cotizaciones-cancel-dialog.component.html',
  styleUrls: ['./cotizaciones-cancel-dialog.component.scss']
})
export class CotizacionesCancelDialogComponent {
  constructor(private readonly dialogRef: MatDialogRef<CotizacionesCancelDialogComponent>) {}

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }
}
