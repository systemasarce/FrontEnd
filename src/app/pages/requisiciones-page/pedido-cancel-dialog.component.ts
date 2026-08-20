import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-pedido-cancel-dialog',
  templateUrl: './pedido-cancel-dialog.component.html',
  styleUrls: ['./pedido-cancel-dialog.component.scss']
})
export class PedidoCancelDialogComponent {
  constructor(private readonly dialogRef: MatDialogRef<PedidoCancelDialogComponent>) {}

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }
}
