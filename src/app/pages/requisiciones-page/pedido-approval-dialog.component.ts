import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

interface PedidoApprovalDialogData {
  codigo: string;
  estadoActual: string;
}

export interface PedidoApprovalDialogResult {
  flgEst: string;
}

@Component({
  selector: 'app-pedido-approval-dialog',
  templateUrl: './pedido-approval-dialog.component.html',
  styleUrls: ['./pedido-approval-dialog.component.scss']
})
export class PedidoApprovalDialogComponent {
  readonly form: FormGroup;

  constructor(
    private readonly formBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: PedidoApprovalDialogData,
    private readonly dialogRef: MatDialogRef<PedidoApprovalDialogComponent>
  ) {
    this.form = this.formBuilder.group({
      flgEst: [this.getDefaultStatus(data.estadoActual)]
    });
  }

  confirmar(): void {
    this.dialogRef.close({
      flgEst: String(this.form.controls['flgEst'].value ?? '').trim() || 'A'
    } as PedidoApprovalDialogResult);
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  private getDefaultStatus(estadoActual: string): string {
    switch (estadoActual.trim().toLowerCase()) {
      case 'pendiente':
        return 'P';
      case 'aprobado':
        return 'A';
      case 'cancelado':
      case 'cerrado':
        return 'C';
      default:
        return 'A';
    }
  }
}
