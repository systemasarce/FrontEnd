import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

interface PedidoDetalleDeleteDialogData {
  codigoItem: string;
  descripcion: string;
}

@Component({
  selector: 'app-pedido-detalle-delete-dialog',
  templateUrl: './pedido-detalle-delete-dialog.component.html',
  styleUrls: ['./pedido-detalle-delete-dialog.component.scss']
})
export class PedidoDetalleDeleteDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PedidoDetalleDeleteDialogData,
    private readonly dialogRef: MatDialogRef<PedidoDetalleDeleteDialogComponent>
  ) {}

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }
}
