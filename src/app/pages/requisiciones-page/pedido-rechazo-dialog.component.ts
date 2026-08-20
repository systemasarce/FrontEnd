import { Component, Inject, Optional } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

export interface PedidoRechazoDialogResult {
  motivo: string;
}

export interface PedidoRechazoDialogData {
  titulo?: string;
  etiquetaMotivo?: string;
  textoError?: string;
  textoConfirmar?: string;
  valorInicial?: string;
  requerido?: boolean;
}

@Component({
  selector: 'app-pedido-rechazo-dialog',
  templateUrl: './pedido-rechazo-dialog.component.html',
  styleUrls: ['./pedido-rechazo-dialog.component.scss']
})
export class PedidoRechazoDialogComponent {
  readonly form: FormGroup;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly dialogRef: MatDialogRef<PedidoRechazoDialogComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public readonly data: PedidoRechazoDialogData | null
  ) {
    const validators = this.data?.requerido === false
      ? []
      : [Validators.required, noWhitespaceValidator()];

    this.form = this.formBuilder.group({
      motivo: [this.data?.valorInicial ?? '', validators]
    });
  }

  get titulo(): string {
    return this.data?.titulo || 'Rechazar pedido';
  }

  get etiquetaMotivo(): string {
    return this.data?.etiquetaMotivo || 'Motivo del rechazo';
  }

  get textoError(): string {
    return this.data?.textoError || 'Ingresa un motivo de rechazo.';
  }

  get textoConfirmar(): string {
    return this.data?.textoConfirmar || 'Confirmar rechazo';
  }

  confirmar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      motivo: String(this.form.controls['motivo'].value ?? '').trim()
    } as PedidoRechazoDialogResult);
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
