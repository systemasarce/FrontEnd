import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { ApiService, RegistrarDetraccionRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { GlobalVariable } from 'src/app/VarGlobals';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

@Component({
  selector: 'app-detraccion-register-dialog',
  templateUrl: './detraccion-register-dialog.component.html',
  styleUrls: ['./detraccion-dialog.component.scss']
})
export class DetraccionRegisterDialogComponent {
  readonly form: FormGroup;
  isSaving = false;
  errorMessage = '';

  constructor(
    private readonly dialogRef: MatDialogRef<DetraccionRegisterDialogComponent>,
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      detDes: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      detPor: ['', [Validators.required, Validators.min(0), Validators.max(100)]]
    });
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const payload: RegistrarDetraccionRequest = {
      Det_Des: String(this.form.controls['detDes'].value || '').trim(),
      Det_Por: Number(this.form.controls['detPor'].value),
      Usr_Reg: this.getCurrentOperator()
    };

    this.apiService.registrarDetraccion(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando detraccion:', error);
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

  sanitizePorcentajeInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = input.value
      .replace(',', '.')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
      this.form.controls['detPor'].setValue(sanitizedValue, { emitEvent: false });
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
      return 'No se pudo registrar la detraccion. Intenta nuevamente.';
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

      if (typeof error.error.Message === 'string' && error.error.Message.trim()) {
        return error.error.Message;
      }

      if (typeof error.error.title === 'string' && error.error.title.trim()) {
        return error.error.title;
      }
    }

    return `No se pudo registrar la detraccion. Codigo HTTP: ${error.status}.`;
  }

  private isErrorBody(value: unknown): value is { message?: unknown; Message?: unknown; title?: unknown; errors?: unknown } {
    return typeof value === 'object' && value !== null;
  }

  private isValidationErrors(value: unknown): value is Record<string, string[]> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return Object.values(value).every((messages) => Array.isArray(messages));
  }
}
