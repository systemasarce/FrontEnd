import { Component, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ActualizarCentroCostoRequest, ApiService } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { GlobalVariable } from 'src/app/VarGlobals';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

interface CentroCostoEditData {
  centroCosto: {
    cenCosId: number;
    cenCosDes: string;
    flgEst: string;
  };
}

@Component({
  selector: 'app-centro-costo-edit-dialog',
  templateUrl: './centro-costo-edit-dialog.component.html',
  styleUrls: ['./centro-costo-dialog.component.scss']
})
export class CentroCostoEditDialogComponent {
  readonly form: FormGroup;
  isSaving = false;
  errorMessage = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CentroCostoEditData,
    private readonly dialogRef: MatDialogRef<CentroCostoEditDialogComponent>,
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      cenCosDes: [data.centroCosto.cenCosDes, [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      flgEst: [data.centroCosto.flgEst || 'A', Validators.required]
    });
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const payload: ActualizarCentroCostoRequest = {
      Cen_Cos_Id: this.data.centroCosto.cenCosId,
      Cen_Cos_Des: String(this.form.controls['cenCosDes'].value || '').trim(),
      Flg_Est: String(this.form.controls['flgEst'].value || 'A'),
      Usr_Mod: this.getCurrentOperator()
    };

    this.apiService.actualizarCentroCosto(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando centro de costo:', error);
        this.errorMessage = this.getErrorMessage(error);
        this.isSaving = false;
      }
    });
  }

  cerrar(): void {
    if (!this.isSaving) {
      this.dialogRef.close(false);
    }
  }

  private getCurrentOperator(): string {
    const globalUser = this.normalizeOperator(GlobalVariable.vusu?.trim() ?? '');

    if (globalUser) {
      return globalUser;
    }

    const currentUser = this.normalizeOperator(this.authService.getCurrentUser().trim());

    if (currentUser) {
      return currentUser;
    }

    return 'sistemas';
  }

  private normalizeOperator(value: string): string {
    if (!value || value.includes('@')) {
      return '';
    }

    return value;
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo actualizar el centro de costo. Intenta nuevamente.';
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (this.isErrorBody(error.error)) {
      if (this.isValidationErrors(error.error.errors)) {
        const messages = Object.values(error.error.errors).flat();

        if (messages.length) {
          return messages.join(' ');
        }
      }

      if (typeof error.error.message === 'string' && error.error.message.trim()) {
        return error.error.message;
      }

      if (typeof error.error.title === 'string' && error.error.title.trim()) {
        return error.error.title;
      }
    }

    return `No se pudo actualizar el centro de costo. Codigo HTTP: ${error.status}.`;
  }

  private isErrorBody(value: unknown): value is { message?: unknown; title?: unknown; errors?: unknown } {
    return typeof value === 'object' && value !== null;
  }

  private isValidationErrors(value: unknown): value is Record<string, string[]> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return Object.values(value).every((messages) => Array.isArray(messages));
  }
}
