import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmacionDialogData {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  textoCancelar?: string;
  tipo?: 'normal' | 'peligro';
}

@Component({
  selector: 'app-confirmacion-accion-dialog',
  templateUrl: './confirmacion-accion-dialog.component.html',
  styleUrls: ['./confirmacion-accion-dialog.component.scss']
})
export class ConfirmacionAccionDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfirmacionDialogData,
    private readonly dialogRef: MatDialogRef<ConfirmacionAccionDialogComponent>
  ) {}

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
