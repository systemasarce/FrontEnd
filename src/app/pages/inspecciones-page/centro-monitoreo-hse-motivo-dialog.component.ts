import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

export interface CentroMonitoreoHseMotivoDialogData {
  mensaje?: string;
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
}

export interface CentroMonitoreoHseMotivoDialogResult {
  motivo: string;
}

@Component({
  selector: 'app-centro-monitoreo-hse-motivo-dialog',
  templateUrl: './centro-monitoreo-hse-motivo-dialog.component.html',
  styleUrls: ['./centro-monitoreo-hse-motivo-dialog.component.scss']
})
export class CentroMonitoreoHseMotivoDialogComponent {
  readonly form: FormGroup;

  constructor(
    private readonly formBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public readonly data: CentroMonitoreoHseMotivoDialogData,
    private readonly dialogRef: MatDialogRef<CentroMonitoreoHseMotivoDialogComponent, CentroMonitoreoHseMotivoDialogResult>
  ) {
    this.form = this.formBuilder.group({
      motivo: ['', [Validators.required, noWhitespaceValidator()]]
    });
  }

  confirmar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      motivo: String(this.form.controls['motivo'].value ?? '').trim()
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
