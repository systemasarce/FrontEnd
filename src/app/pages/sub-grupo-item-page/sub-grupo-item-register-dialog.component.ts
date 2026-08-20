import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { ApiService, RegistrarSubGrupoItemRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { GlobalVariable } from 'src/app/VarGlobals';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

type DataRecord = Record<string, unknown>;

interface GrupoOption {
  id: number;
  descripcion: string;
}

@Component({
  selector: 'app-sub-grupo-item-register-dialog',
  templateUrl: './sub-grupo-item-register-dialog.component.html',
  styleUrls: ['./sub-grupo-item-dialog.component.scss']
})
export class SubGrupoItemRegisterDialogComponent implements OnInit {
  readonly form: FormGroup;
  grupos: GrupoOption[] = [];
  isLoadingGrupos = false;
  isSaving = false;
  errorMessage = '';

  constructor(
    private readonly dialogRef: MatDialogRef<SubGrupoItemRegisterDialogComponent>,
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      subGrpDes: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      grpId: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarGrupos();
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const payload: RegistrarSubGrupoItemRequest = {
      Sub_Grp_Des: String(this.form.controls['subGrpDes'].value || '').trim(),
      Grp_Id: Number(this.form.controls['grpId'].value),
      Usr_Reg: this.getCurrentOperator()
    };

    this.apiService.registrarSubGrupoItem(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando sub grupo de item:', error);
        this.errorMessage = this.getErrorMessage(error, 'No se pudo registrar el sub grupo de item.');
        this.isSaving = false;
      }
    });
  }

  cerrar(): void {
    if (!this.isSaving) {
      this.dialogRef.close(false);
    }
  }

  private cargarGrupos(): void {
    this.isLoadingGrupos = true;
    this.apiService.getListarGrupoItem({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.grupos = this.extractRecords(response)
          .map((item) => this.mapGrupoOption(item))
          .filter((item): item is GrupoOption => item !== null)
          .sort((left, right) => left.descripcion.localeCompare(right.descripcion));
        this.isLoadingGrupos = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando grupos de item:', error);
        this.grupos = [];
        this.errorMessage = 'No se pudieron cargar los grupos de item activos.';
        this.isLoadingGrupos = false;
      }
    });
  }

  private mapGrupoOption(item: DataRecord): GrupoOption | null {
    const id = this.getNumberValue(item, ['Grp_Id', 'grp_Id', 'grpId', 'id', 'Id']);
    const descripcion = this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes', 'descripcion', 'Descripcion']);

    if (!id || !descripcion) {
      return null;
    }

    return { id, descripcion };
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = ['grupoItems', 'GrupoItems', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
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

  private getErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return `${fallback} Intenta nuevamente.`;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (this.isDataRecord(error.error)) {
      const message = this.getTextValue(error.error, ['message', 'Message', 'title', 'Title']);

      if (message) {
        return message;
      }
    }

    return `${fallback} Codigo HTTP: ${error.status}.`;
  }

  private getTextValue(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private getNumberValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (Number.isInteger(value)) {
        return value;
      }
    }

    return null;
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
