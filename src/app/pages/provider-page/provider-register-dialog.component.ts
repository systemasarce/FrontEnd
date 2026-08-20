import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { ApiService, RegistrarProveedorRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { GlobalVariable } from 'src/app/VarGlobals';
import { noWhitespaceValidator, optionalPatternValidator } from 'src/app/shared/validators/form-validators';

@Component({
  selector: 'app-provider-register-dialog',
  templateUrl: './provider-register-dialog.component.html',
  styleUrls: ['./provider-dialog.component.scss']
})
export class ProviderRegisterDialogComponent {
  readonly form: FormGroup;
  isSaving = false;
  errorMessage = '';

  constructor(
    private readonly dialogRef: MatDialogRef<ProviderRegisterDialogComponent>,
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      prvNom: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      prvRuc: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(20), optionalPatternValidator(/^\d{11}$/)]],
      prvTel: ['', [Validators.maxLength(30), optionalPatternValidator(/^[0-9()+\-\s]{6,30}$/)]],
      prvDir: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(180)]],
      prvNomCon: ['', [Validators.maxLength(120)]],
      prvEmail: ['', [Validators.email, Validators.maxLength(180)]]
    });
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const values = this.form.value as {
      prvNom: string;
      prvRuc: string;
      prvTel: string;
      prvDir: string;
      prvNomCon: string;
      prvEmail: string;
    };
    const payload: RegistrarProveedorRequest = {
      Prv_Nom: values.prvNom.trim(),
      Prv_Ruc: values.prvRuc.trim(),
      Prv_Tel: this.normalizeOptionalText(values.prvTel),
      Prv_Dir: values.prvDir.trim(),
      Prv_Nom_Con: this.normalizeOptionalText(values.prvNomCon),
      Prv_Email: this.normalizeOptionalText(values.prvEmail),
      Usr_Reg: this.getCurrentOperator()
    };

    this.apiService.registrarProveedor(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando proveedor:', error);
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

  private normalizeOptionalText(value: string | null | undefined): string | undefined {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : undefined;
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'No se pudo registrar el proveedor. Intenta nuevamente.';
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

    return `No se pudo registrar el proveedor. Codigo HTTP: ${error.status}.`;
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
