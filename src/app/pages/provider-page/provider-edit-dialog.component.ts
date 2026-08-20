import { Component, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ActualizarProveedorRequest, ApiService } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { GlobalVariable } from 'src/app/VarGlobals';
import { noWhitespaceValidator, optionalPatternValidator } from 'src/app/shared/validators/form-validators';

interface ProviderEditData {
  proveedor: {
    prvId: number;
    prvNom: string;
    prvRuc: string;
    prvTel: string;
    prvDir: string;
    prvNomCon: string;
    prvEmail: string;
    prvNroCueBan: string;
    prvNroCueBanCci: string;
    prvBan: number | null;
    flgEst: string;
    usrReg: string;
    fecReg: string;
    usrMod: string;
    fecMod: string;
  };
}

@Component({
  selector: 'app-provider-edit-dialog',
  templateUrl: './provider-edit-dialog.component.html',
  styleUrls: ['./provider-dialog.component.scss']
})
export class ProviderEditDialogComponent {
  readonly form: FormGroup;
  isSaving = false;
  errorMessage = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ProviderEditData,
    private readonly dialogRef: MatDialogRef<ProviderEditDialogComponent>,
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      prvNom: [data.proveedor.prvNom, [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      prvRuc: [data.proveedor.prvRuc, [Validators.required, noWhitespaceValidator(), Validators.maxLength(20), optionalPatternValidator(/^\d{11}$/)]],
      prvTel: [data.proveedor.prvTel, [Validators.maxLength(30), optionalPatternValidator(/^[0-9()+\-\s]{6,30}$/)]],
      prvDir: [data.proveedor.prvDir, [Validators.required, noWhitespaceValidator(), Validators.maxLength(180)]],
      prvNomCon: [data.proveedor.prvNomCon, [Validators.maxLength(120)]],
      prvEmail: [data.proveedor.prvEmail, [Validators.email, Validators.maxLength(180)]],
      flgEst: [data.proveedor.flgEst || 'A', Validators.required]
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
      flgEst: string;
    };
    const currentOperator = this.getCurrentOperator();
    const currentIsoDate = new Date().toISOString();
    const payload: ActualizarProveedorRequest = {
      Prv_Id: this.data.proveedor.prvId,
      Prv_Nom: values.prvNom.trim(),
      Prv_Ruc: values.prvRuc.trim(),
      Prv_Tel: this.normalizeOptionalText(values.prvTel),
      Prv_Dir: values.prvDir.trim(),
      Prv_Nom_Con: this.normalizeOptionalText(values.prvNomCon),
      Prv_Email: this.normalizeOptionalText(values.prvEmail),
      Prv_Nro_Cue_Ban: this.normalizeOptionalText(this.data.proveedor.prvNroCueBan),
      Prv_Nro_Cue_Ban_CCI: this.normalizeOptionalText(this.data.proveedor.prvNroCueBanCci),
      Prv_Ban: this.data.proveedor.prvBan ?? undefined,
      Flg_Est: values.flgEst,
      Usr_Reg: this.normalizeOperator(this.data.proveedor.usrReg) || currentOperator,
      Fec_Reg: this.data.proveedor.fecReg || currentIsoDate,
      Usr_Mod: currentOperator,
      Fec_Mod: currentIsoDate
    };

    console.log('Payload actualizar proveedor:', payload);

    this.apiService.actualizarProveedor(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando proveedor:', error);
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
      return 'No se pudo actualizar el proveedor. Intenta nuevamente.';
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

    return `No se pudo actualizar el proveedor. Codigo HTTP: ${error.status}.`;
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
