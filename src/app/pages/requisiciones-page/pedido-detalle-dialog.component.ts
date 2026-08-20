import { Component, Inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';

import { CentroCostoOption } from './centro-costo-selector-dialog.component';
import { PedidoDetalleItemSelectorDialogComponent } from './pedido-detalle-item-selector-dialog.component';
import { PedidoDetalleUnidadSelectorDialogComponent } from './pedido-detalle-unidad-selector-dialog.component';
import { PedidoDetalleDialogValue, PedidoDetalleItemOption, PedidoDetalleUnidadOption } from './pedido-detalle-dialog.models';

export interface PedidoDetalleDialogData {
  pedidoCodigo: string;
  itemNumber: string;
  moneda: string;
  cantidadDisponible: number;
  isEditing: boolean;
  omitirCentroCosto?: boolean;
  modoPedidoB?: boolean;
  centrosCosto: CentroCostoOption[];
  items: PedidoDetalleItemOption[];
  units: PedidoDetalleUnidadOption[];
  initialValue?: Partial<PedidoDetalleDialogValue>;
}

@Component({
  selector: 'app-pedido-detalle-dialog',
  templateUrl: './pedido-detalle-dialog.component.html',
  styleUrls: ['./pedido-detalle-dialog.component.scss']
})
export class PedidoDetalleDialogComponent {
  private readonly pedidoBCostPrecision = 4;
  readonly form: FormGroup;
  readonly itemSearchControl = new FormControl('', { nonNullable: true });
  readonly unitSearchControl = new FormControl('', { nonNullable: true });
  readonly centroCostoSearchControl = new FormControl('', { nonNullable: true });
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: PedidoDetalleDialogData,
    private readonly dialogRef: MatDialogRef<PedidoDetalleDialogComponent>
  ) {
    const initialUnitPrice = data.modoPedidoB
      ? this.normalizeMoney(Number(data.initialValue?.unitPrice ?? 0), this.pedidoBCostPrecision)
      : this.normalizeDecimal(Number(data.initialValue?.unitPrice ?? 0));

    this.form = this.formBuilder.group({
      itemCode: [String(data.initialValue?.itemCode ?? '').trim()],
      itemDescription: [String(data.initialValue?.itemDescription ?? '').trim()],
      unitCode: [String(data.initialValue?.unitCode ?? '').trim()],
      unitDescription: [String(data.initialValue?.unitDescription ?? '').trim()],
      centroCostoId: [Number(data.initialValue?.centroCostoId ?? 0)],
      centroCostoDescripcion: [String(data.initialValue?.centroCostoDescripcion ?? '').trim()],
      centroCostoCantidadRequerida: [this.normalizeDecimal(Number(data.initialValue?.centroCostoCantidadRequerida ?? 0))],
      quantity: [this.normalizeDecimal(Number(data.initialValue?.quantity ?? 0))],
      unitPrice: [initialUnitPrice]
    });

    this.resolveInitialLabels();
  }

  get subtotal(): number {
    const quantity = this.normalizeDecimal(Number(this.form.controls['quantity'].value));
    const unitPrice = this.normalizeDecimal(Number(this.form.controls['unitPrice'].value));
    return this.normalizeDecimal(quantity * unitPrice);
  }

  get pedidoBCostoTotal(): number {
    const quantity = this.normalizeDecimal(Number(this.form.controls['quantity'].value));
    const unitPrice = this.normalizeMoney(Number(this.form.controls['unitPrice'].value), this.pedidoBCostPrecision);
    return this.normalizeMoney(quantity * unitPrice, this.pedidoBCostPrecision);
  }

  get itemButtonLabel(): string {
    return String(this.form.controls['itemCode'].value ?? '').trim() || 'Seleccionar item';
  }

  get unitButtonLabel(): string {
    const unitCode = String(this.form.controls['unitCode'].value ?? '').trim();

    if (!unitCode) {
      return 'Seleccionar unidad';
    }

    return unitCode;
  }

  get filteredItems(): PedidoDetalleItemOption[] {
    const search = this.itemSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.data.items;
    }

    return this.data.items.filter((item) =>
      [
        item.code,
        item.description,
        item.groupDescription,
        item.unitDescription,
        item.unitCode,
        String(item.unitId ?? '')
      ].some((value) => String(value || '').toLowerCase().includes(search))
    );
  }

  get filteredUnits(): PedidoDetalleUnidadOption[] {
    const search = this.unitSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.data.units;
    }

    return this.data.units.filter((unit) =>
      [
        unit.code,
        unit.description,
        unit.abbreviation,
        String(unit.id)
      ].some((value) => String(value || '').toLowerCase().includes(search))
    );
  }

  get filteredCentrosCosto(): CentroCostoOption[] {
    const search = this.centroCostoSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.data.centrosCosto;
    }

    return this.data.centrosCosto.filter((centroCosto) =>
      [
        String(centroCosto.id),
        centroCosto.descripcion
      ].some((value) => String(value || '').toLowerCase().includes(search))
    );
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    }).format(value);
  }

  formatMoney(value: number, precision = 2): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }).format(value);
  }

  get cantidadRestanteCentroCosto(): number {
    if (this.data.omitirCentroCosto) {
      return this.data.cantidadDisponible;
    }

    return this.normalizeDecimal(Number(this.form.controls['centroCostoCantidadRequerida'].value ?? 0));
  }

  openItemSelectorDialog(): void {
    if (!this.data.items.length) {
      return;
    }

    const dialogRef = this.dialog.open(PedidoDetalleItemSelectorDialogComponent, {
      autoFocus: false,
      width: '38rem',
      data: {
        items: this.data.items
      }
    });

    dialogRef.afterClosed().subscribe((selectedItem?: PedidoDetalleItemOption) => {
      if (!selectedItem) {
        return;
      }

      const selectedValues: Partial<PedidoDetalleDialogValue> = {
        itemCode: selectedItem.code,
        itemDescription: selectedItem.description
      };

      if (this.data.modoPedidoB) {
        selectedValues.unitCode = selectedItem.unitCode || String(selectedItem.unitId ?? '').trim();
        selectedValues.unitDescription = selectedItem.unitDescription || '';
      }

      this.form.patchValue(selectedValues);
      this.errorMessage = '';
    });
  }

  onItemSelectOpened(opened: boolean): void {
    if (opened) {
      this.itemSearchControl.setValue('');
    }
  }

  onUnitSelectOpened(opened: boolean): void {
    if (opened) {
      this.unitSearchControl.setValue('');
    }
  }

  onCentroCostoSelectOpened(opened: boolean): void {
    if (opened) {
      this.centroCostoSearchControl.setValue('');
    }
  }

  onItemChange(itemCode: string): void {
    const selectedItem = this.data.items.find((item) => item.code === String(itemCode || '').trim());

    if (!selectedItem) {
      this.form.patchValue({
        itemCode: '',
        itemDescription: ''
      });
      return;
    }

    const selectedValues: Partial<PedidoDetalleDialogValue> = {
      itemCode: selectedItem.code,
      itemDescription: selectedItem.description
    };

    if (this.data.modoPedidoB) {
      selectedValues.unitCode = selectedItem.unitCode || String(selectedItem.unitId ?? '').trim();
      selectedValues.unitDescription = selectedItem.unitDescription || '';
    }

    this.form.patchValue(selectedValues);
    this.errorMessage = '';
  }

  onUnitChange(unitCode: string): void {
    const selectedUnit = this.data.units.find((unit) => unit.code === String(unitCode || '').trim());

    if (!selectedUnit) {
      this.form.patchValue({
        unitCode: '',
        unitDescription: ''
      });
      return;
    }

    this.form.patchValue({
      unitCode: selectedUnit.code,
      unitDescription: selectedUnit.description
    });
    this.errorMessage = '';
  }

  openUnitSelectorDialog(): void {
    if (!this.data.units.length) {
      return;
    }

    const dialogRef = this.dialog.open(PedidoDetalleUnidadSelectorDialogComponent, {
      autoFocus: false,
      width: '36rem',
      data: {
        units: this.data.units
      }
    });

    dialogRef.afterClosed().subscribe((selectedUnit?: PedidoDetalleUnidadOption) => {
      if (!selectedUnit) {
        return;
      }

      this.form.patchValue({
        unitCode: String(selectedUnit.id),
        unitDescription: selectedUnit.description
      });
      this.errorMessage = '';
    });
  }

  onCentroCostoChange(centroCostoIdRaw: number | string): void {
    const centroCostoId = Number(centroCostoIdRaw);
    const centroCosto = this.data.centrosCosto.find((option) => option.id === centroCostoId);
    const cantidadRequerida = this.normalizeDecimal(Number(centroCosto?.cantidadRequerida ?? 0));

    this.form.patchValue({
      centroCostoId,
      centroCostoDescripcion: centroCosto?.descripcion || '',
      centroCostoCantidadRequerida: cantidadRequerida,
      quantity: cantidadRequerida > 0 ? cantidadRequerida : this.normalizeDecimal(Number(this.form.controls['quantity'].value ?? 0))
    });
    this.errorMessage = '';
  }

  onCostoInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const normalizedValue = this.limitToDecimals(input.value, this.pedidoBCostPrecision);

    if (normalizedValue !== input.value) {
      input.value = normalizedValue;
      this.form.controls['unitPrice'].setValue(normalizedValue, { emitEvent: false });
    }
  }

  save(): void {
    const itemCode = String(this.form.controls['itemCode'].value ?? '').trim();
    const itemDescription = String(this.form.controls['itemDescription'].value ?? '').trim();
    const unitCode = String(this.form.controls['unitCode'].value ?? '').trim();
    const unitDescription = String(this.form.controls['unitDescription'].value ?? '').trim();
    const centroCostoId = Number(this.form.controls['centroCostoId'].value ?? 0);
    const centroCostoSeleccionado = this.data.centrosCosto.find((option) => option.id === centroCostoId);
    const centroCostoDescripcion = centroCostoSeleccionado?.descripcion
      || String(this.form.controls['centroCostoDescripcion'].value ?? '').trim();
    const centroCostoCantidadRequerida = this.normalizeDecimal(Number(centroCostoSeleccionado?.cantidadRequerida ?? this.form.controls['centroCostoCantidadRequerida'].value ?? 0));
    const quantity = this.normalizeDecimal(Number(this.form.controls['quantity'].value));
    const unitPriceRaw = String(this.form.controls['unitPrice'].value ?? '').trim();
    const unitPrice = this.data.modoPedidoB
      ? this.normalizeMoney(Number(unitPriceRaw), this.pedidoBCostPrecision)
      : this.normalizeDecimal(Number(this.form.controls['unitPrice'].value));

    if (!itemCode) {
      this.errorMessage = 'Selecciona un item.';
      return;
    }

    if (!unitCode) {
      this.errorMessage = 'Selecciona una unidad de medida.';
      return;
    }

    if (!this.data.omitirCentroCosto && !this.data.isEditing && !this.data.centrosCosto.length) {
      this.errorMessage = 'No hay centros de costo ligados al pedido seleccionado.';
      return;
    }

    if (this.data.modoPedidoB && (!Number.isInteger(centroCostoId) || centroCostoId <= 0)) {
      this.errorMessage = 'Selecciona un centro de costo.';
      return;
    }

    if (!this.data.modoPedidoB && !this.data.omitirCentroCosto && !this.data.isEditing && (!Number.isInteger(centroCostoId) || centroCostoId <= 0)) {
      this.errorMessage = 'Selecciona un centro de costo ligado al pedido.';
      return;
    }

    if (!this.data.modoPedidoB && !this.data.omitirCentroCosto && !this.data.isEditing && centroCostoCantidadRequerida <= 0) {
      this.errorMessage = 'El centro de costo seleccionado no tiene cantidad restante disponible.';
      return;
    }

    if (quantity <= 0) {
      this.errorMessage = 'La cantidad debe ser mayor a cero.';
      return;
    }

    if (!this.data.modoPedidoB && !this.data.omitirCentroCosto && !this.data.isEditing && quantity > centroCostoCantidadRequerida) {
      this.errorMessage = `La cantidad no puede ser mayor a la cantidad restante del centro de costo: ${this.formatNumber(centroCostoCantidadRequerida)}.`;
      return;
    }

    if (quantity > this.data.cantidadDisponible) {
      this.errorMessage = `La cantidad no puede ser mayor a ${this.formatNumber(this.data.cantidadDisponible)}.`;
      return;
    }

    if (this.data.modoPedidoB) {
      if (!this.isMoneyWithMaxDecimals(unitPriceRaw, this.pedidoBCostPrecision)) {
        this.errorMessage = `El campo Costo debe tener como maximo ${this.pedidoBCostPrecision} decimales.`;
        return;
      }

      if (unitPrice < 0) {
        this.errorMessage = 'El costo no puede ser menor a cero.';
        return;
      }

      this.dialogRef.close({
        itemCode,
        itemDescription,
        unitCode,
        unitDescription,
        centroCostoId,
        centroCostoDescripcion,
        centroCostoCantidadRequerida,
        quantity,
        unitPrice,
        subtotal: this.normalizeMoney(quantity * unitPrice, this.pedidoBCostPrecision)
      } as PedidoDetalleDialogValue);
      return;
    }

    if (unitPrice <= 0) {
      this.errorMessage = 'El precio unitario debe ser mayor a cero.';
      return;
    }

    if (this.subtotal <= 0) {
      this.errorMessage = 'El subtotal debe ser mayor a cero.';
      return;
    }

    this.dialogRef.close({
      itemCode,
      itemDescription,
      unitCode,
      unitDescription,
      centroCostoId,
      centroCostoDescripcion,
      centroCostoCantidadRequerida,
      quantity,
      unitPrice
    } as PedidoDetalleDialogValue);
  }

  close(): void {
    this.dialogRef.close();
  }

  private resolveInitialLabels(): void {
    const itemCode = String(this.form.controls['itemCode'].value ?? '').trim();
    const unitCode = String(this.form.controls['unitCode'].value ?? '').trim();
    const centroCostoId = Number(this.form.controls['centroCostoId'].value ?? 0);

    if (itemCode && !String(this.form.controls['itemDescription'].value ?? '').trim()) {
      const item = this.data.items.find((option) => option.code === itemCode);

      if (item) {
        this.form.patchValue({
          itemDescription: item.description
        });
      }
    }

    if (unitCode && !String(this.form.controls['unitDescription'].value ?? '').trim()) {
      const unit = this.data.units.find((option) => option.code === unitCode);

      if (unit) {
        this.form.patchValue({
          unitDescription: unit.description
        });
      }
    }

    if (Number.isInteger(centroCostoId) && centroCostoId > 0 && !String(this.form.controls['centroCostoDescripcion'].value ?? '').trim()) {
      const centroCosto = this.data.centrosCosto.find((option) => option.id === centroCostoId);

      if (centroCosto) {
        this.form.patchValue({
          centroCostoDescripcion: centroCosto.descripcion,
          centroCostoCantidadRequerida: this.normalizeDecimal(Number(centroCosto.cantidadRequerida ?? 0))
        });
      }
    }
  }

  private normalizeDecimal(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Number(value.toFixed(3));
  }

  private normalizeMoney(value: number, precision = 2): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Number(value.toFixed(precision));
  }

  private isMoneyWithMaxDecimals(value: string, maxDecimals: number): boolean {
    return new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`).test(value);
  }

  private limitToDecimals(value: string, maxDecimals: number): string {
    const [integerPart, decimalPart] = value.split('.');

    if (decimalPart === undefined) {
      return value;
    }

    return `${integerPart}.${decimalPart.slice(0, maxDecimals)}`;
  }
}
