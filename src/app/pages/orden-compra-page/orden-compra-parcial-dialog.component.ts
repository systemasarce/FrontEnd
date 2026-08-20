import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-orden-compra-parcial-dialog',
  template: `
    <h2 mat-dialog-title>Registro parcial</h2>

    <div mat-dialog-content class="orden-compra-parcial-dialog__content">
      <p>Estas a punto de registrar una orden de compra de manera parcial.</p>
      <small>
        Solo se generara la orden de compra por los items seleccionados. Los items no seleccionados quedaran pendientes.
      </small>
    </div>

    <div mat-dialog-actions align="end" class="orden-compra-parcial-dialog__actions">
      <button mat-stroked-button type="button" (click)="close()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="confirmar()">Confirmar</button>
    </div>
  `,
  styleUrls: ['./orden-compra-parcial-dialog.component.scss']
})
export class OrdenCompraParcialDialogComponent {
  constructor(private readonly dialogRef: MatDialogRef<OrdenCompraParcialDialogComponent>) {}

  confirmar(): void {
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
