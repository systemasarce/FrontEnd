import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  ActualizarProveedorBancoRequest,
  ApiService,
  RegistrarProveedorBancoRequest
} from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { GlobalVariable } from 'src/app/VarGlobals';

interface DataRecord extends Record<string, unknown> {}

interface BankOption {
  id: number;
  description: string;
}

interface CurrencyOption {
  id: number;
  description: string;
}

interface ProviderBankRow {
  id: number;
  providerId: number;
  bankId: number;
  bankName: string;
  currencyId: number;
  currencyName: string;
  accountNumber: string;
  cci: string;
  selected: boolean;
}

export interface ProviderBanksDialogData {
  providerId: number;
  providerName: string;
  providerRuc: string;
  selectedProviderBankId?: number | null;
  selectedBankId?: number | null;
  selectedAccountNumber?: string;
  selectedCci?: string;
}

@Component({
  selector: 'app-provider-banks-dialog',
  templateUrl: './provider-banks-dialog.component.html',
  styleUrls: ['./provider-banks-dialog.component.scss']
})
export class ProviderBanksDialogComponent implements OnInit {
  readonly form: FormGroup;
  banks: ProviderBankRow[] = [];
  bankOptions: BankOption[] = [];
  currencyOptions: CurrencyOption[] = [];
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  mode: 'list' | 'form' = 'list';
  editingBank: ProviderBankRow | null = null;
  selectedProviderBankId: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ProviderBanksDialogData,
    private readonly dialogRef: MatDialogRef<ProviderBanksDialogComponent>,
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      bankId: ['', [Validators.required, Validators.min(1)]],
      currencyId: ['', [Validators.required, Validators.min(1)]],
      accountNumber: ['', [Validators.maxLength(40)]],
      cci: ['', [Validators.maxLength(40)]]
    });
  }

  ngOnInit(): void {
    this.loadCatalogs();
    this.loadProviderBanks();
  }

  nuevo(): void {
    this.editingBank = null;
    this.errorMessage = '';
    this.form.reset({
      bankId: '',
      currencyId: '',
      accountNumber: '',
      cci: ''
    });
    this.mode = 'form';
  }

  editar(bank: ProviderBankRow): void {
    this.editingBank = bank;
    this.errorMessage = '';
    this.form.reset({
      bankId: bank.bankId || '',
      currencyId: bank.currencyId || '',
      accountNumber: bank.accountNumber,
      cci: bank.cci
    });
    this.mode = 'form';
  }

  cancelarFormulario(): void {
    if (this.isSaving) {
      return;
    }

    this.mode = 'list';
    this.editingBank = null;
    this.errorMessage = '';
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.value as {
      bankId: number | string;
      currencyId: number | string;
      accountNumber: string;
      cci: string;
    };
    const bankId = Number(values.bankId);
    const currencyId = Number(values.currencyId);

    if (!Number.isInteger(bankId) || bankId <= 0 || !Number.isInteger(currencyId) || currencyId <= 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    if (this.editingBank) {
      const payload: ActualizarProveedorBancoRequest = {
        Prv_Ban_Id: this.editingBank.id,
        Prv_Id: this.data.providerId,
        Ban_Id: bankId,
        Tip_Mon: currencyId,
        Prv_Ban_Nro_Cta: values.accountNumber.trim(),
        Prv_Ban_Nro_Cta_CCI: values.cci.trim(),
        Usr_Mod: this.getCurrentOperator()
      };

      this.apiService.actualizarProveedorBanco(payload).subscribe({
        next: () => this.afterSave(),
        error: (error: unknown) => this.handleSaveError(error, 'No se pudo actualizar el banco del proveedor.')
      });
      return;
    }

    const payload: RegistrarProveedorBancoRequest = {
      Prv_Id: this.data.providerId,
      Ban_Id: bankId,
      Tip_Mon: currencyId,
      Prv_Ban_Nro_Cta: values.accountNumber.trim(),
      Prv_Ban_Nro_Cta_CCI: values.cci.trim(),
      Usr_Reg: this.getCurrentOperator()
    };

    this.apiService.registrarProveedorBanco(payload).subscribe({
      next: () => this.afterSave(),
      error: (error: unknown) => this.handleSaveError(error, 'No se pudo registrar el banco del proveedor.')
    });
  }

  eliminar(bank: ProviderBankRow): void {
    if (this.isSaving || !bank.id) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    this.apiService.eliminarProveedorBanco({
      Prv_Ban_Id: bank.id,
      Prv_Id: this.data.providerId
    }).subscribe({
      next: () => {
        if (this.selectedProviderBankId === bank.id) {
          this.selectedProviderBankId = null;
        }
        this.isSaving = false;
        this.loadProviderBanks();
      },
      error: (error: unknown) => this.handleSaveError(error, 'No se pudo eliminar el banco del proveedor.')
    });
  }

  seleccionarCuenta(bank: ProviderBankRow): void {
    if (this.isSaving || this.selectedProviderBankId === bank.id) {
      return;
    }

    const previousSelectedProviderBankId = this.selectedProviderBankId;
    this.selectedProviderBankId = bank.id;
    this.banks = this.banks.map((item) => ({
      ...item,
      selected: item.id === bank.id
    }));
    this.isSaving = true;
    this.errorMessage = '';

    this.apiService.actualizarCuentaBancariaProveedor({
      Prv_Ban_Id: bank.id,
      Prv_Id: this.data.providerId
    }).subscribe({
      next: () => {
        this.data.selectedProviderBankId = bank.id;
        this.data.selectedBankId = bank.bankId;
        this.data.selectedAccountNumber = bank.accountNumber;
        this.data.selectedCci = bank.cci;
        this.isSaving = false;
      },
      error: (error: unknown) => {
        this.selectedProviderBankId = previousSelectedProviderBankId;
        this.banks = this.banks.map((item) => ({
          ...item,
          selected: item.id === previousSelectedProviderBankId
        }));
        this.handleSaveError(error, 'No se pudo actualizar la cuenta bancaria principal del proveedor.');
      }
    });
  }

  cerrar(): void {
    if (!this.isSaving) {
      this.dialogRef.close();
    }
  }

  private loadCatalogs(): void {
    this.apiService.getListarBanco({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.bankOptions = this.extractRecords(response)
          .map((item) => ({
            id: this.getNumberValue(item, ['Ban_Id', 'ban_Id', 'banId', 'id', 'Id']) ?? 0,
            description: this.getTextValue(item, ['Ban_Des', 'ban_Des', 'banDes', 'descripcion', 'Descripcion'])
          }))
          .filter((bank) => bank.id > 0 && !!bank.description)
          .sort((left, right) => left.id - right.id);
      },
      error: (error: unknown) => {
        console.error('Error cargando bancos:', error);
        this.bankOptions = [];
      }
    });

    this.apiService.getListarMoneda({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.currencyOptions = this.extractRecords(response)
          .map((item) => ({
            id: this.getNumberValue(item, ['Mon_Id', 'mon_Id', 'monId', 'id', 'Id']) ?? 0,
            description: this.getTextValue(item, ['Mon_Des', 'mon_Des', 'monDes', 'descripcion', 'Descripcion'])
          }))
          .filter((currency) => currency.id > 0 && !!currency.description)
          .sort((left, right) => left.id - right.id);
      },
      error: (error: unknown) => {
        console.error('Error cargando monedas:', error);
        this.currencyOptions = [];
      }
    });
  }

  private loadProviderBanks(): void {
    this.isLoading = true;

    this.apiService.getListarProveedorBanco({
      Prv_Ban_Id: 0,
      Prv_Id: this.data.providerId
    }).subscribe({
      next: (response: unknown) => {
        this.banks = this.extractRecords(response)
          .map((item) => this.mapProviderBank(item))
          .filter((bank) => !bank.providerId || bank.providerId === this.data.providerId)
          .sort((left, right) => left.id - right.id);
        this.selectedProviderBankId = this.getSelectedProviderBankId(this.banks);
        this.banks = this.banks.map((bank) => ({
          ...bank,
          selected: bank.id === this.selectedProviderBankId
        }));
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando bancos del proveedor:', error);
        this.banks = [];
        this.errorMessage = 'No se pudo cargar los bancos del proveedor.';
        this.isLoading = false;
      }
    });
  }

  private afterSave(): void {
    this.isSaving = false;
    this.mode = 'list';
    this.editingBank = null;
    this.loadProviderBanks();
  }

  private handleSaveError(error: unknown, fallbackMessage: string): void {
    console.error(fallbackMessage, error);
    this.errorMessage = fallbackMessage;
    this.isSaving = false;
  }

  private mapProviderBank(item: DataRecord): ProviderBankRow {
    const bankId = this.getNumberValue(item, ['Ban_Id', 'ban_Id', 'banId']) ?? 0;
    const currencyId = this.getNumberValue(item, ['Tip_Mon', 'tip_Mon', 'tipMon', 'Mon_Id', 'mon_Id', 'monId']) ?? 0;

    return {
      id: this.getNumberValue(item, ['Prv_Ban_Id', 'prv_Ban_Id', 'prvBanId', 'id', 'Id']) ?? 0,
      providerId: this.getNumberValue(item, ['Prv_Id', 'prv_Id', 'prvId']) ?? 0,
      bankId,
      bankName: this.getTextValue(item, ['Ban_Des', 'ban_Des', 'banDes', 'Ban_Abr', 'ban_Abr', 'banAbr']) || this.getBankDescription(bankId),
      currencyId,
      currencyName: this.getTextValue(item, ['Mon_Des', 'mon_Des', 'monDes']) || this.getCurrencyDescription(currencyId),
      accountNumber: this.getTextValue(item, ['Prv_Ban_Nro_Cta', 'prv_Ban_Nro_Cta', 'prvBanNroCta']),
      cci: this.getTextValue(item, ['Prv_Ban_Nro_Cta_CCI', 'prv_Ban_Nro_Cta_CCI', 'prvBanNroCtaCci']),
      selected: this.getBooleanValue(item, [
        'Seleccionado',
        'seleccionado',
        'CuentaSeleccionada',
        'cuentaSeleccionada',
        'Prv_Ban_Sel',
        'prv_Ban_Sel',
        'prvBanSel',
        'Flg_Sel',
        'flg_Sel',
        'flgSel'
      ])
    };
  }

  private getSelectedProviderBankId(banks: ProviderBankRow[]): number | null {
    const selectedProviderBankId = Number(this.data.selectedProviderBankId);
    const selectedByProviderBankId = banks.find((bank) => selectedProviderBankId > 0 && bank.id === selectedProviderBankId);

    if (selectedByProviderBankId) {
      return selectedByProviderBankId.id;
    }

    const selectedByFlag = banks.find((bank) => bank.selected);

    if (selectedByFlag) {
      return selectedByFlag.id;
    }

    const selectedBankId = Number(this.data.selectedBankId);
    const selectedAccountNumber = String(this.data.selectedAccountNumber || '').trim();
    const selectedCci = String(this.data.selectedCci || '').trim();
    const selectedByCurrentProvider = banks.find((bank) => {
      const sameBank = selectedBankId > 0 && bank.bankId === selectedBankId;
      const sameAccount = selectedAccountNumber && bank.accountNumber === selectedAccountNumber;
      const sameCci = selectedCci && bank.cci === selectedCci;

      return sameBank && (sameAccount || sameCci);
    });

    return selectedByCurrentProvider?.id ?? null;
  }

  private getBankDescription(bankId: number): string {
    return this.bankOptions.find((bank) => bank.id === bankId)?.description || String(bankId || '');
  }

  private getCurrencyDescription(currencyId: number): string {
    return this.currencyOptions.find((currency) => currency.id === currencyId)?.description || String(currencyId || '');
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = ['proveedorBanco', 'ProveedorBanco', 'bancos', 'Bancos', 'monedas', 'Monedas', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
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

  private getBooleanValue(item: DataRecord, keys: string[]): boolean {
    for (const key of keys) {
      const value = item[key];

      if (value === true || value === 1 || value === '1') {
        return true;
      }

      if (typeof value === 'string') {
        const normalizedValue = value.trim().toUpperCase();

        if (['S', 'SI', 'Y', 'YES', 'TRUE', 'A'].includes(normalizedValue)) {
          return true;
        }
      }
    }

    return false;
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
}
