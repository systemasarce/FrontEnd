import { Component, Inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface AlmacenSalidaReporteItemOption {
  id: number;
  code: string;
  description: string;
}

export interface AlmacenSalidaReporteDialogData {
  items: AlmacenSalidaReporteItemOption[];
}

export interface AlmacenSalidaReporteDialogResult {
  fechaInicio: Date;
  fechaFin: Date;
  itemId: number;
  itemLabel: string;
}

@Component({
  selector: 'app-almacen-salidas-reporte-dialog',
  template: `
    <h2 mat-dialog-title>Reporte de salidas</h2>

    <form [formGroup]="form" (ngSubmit)="exportar()">
      <div mat-dialog-content class="reporte-salidas-dialog__content">
        <p>Selecciona el rango de fechas y el material que deseas incluir.</p>

        <div class="reporte-salidas-dialog__dates">
          <mat-form-field appearance="outline">
            <mat-label>Fecha inicial</mat-label>
            <input matInput [matDatepicker]="fechaInicioPicker" formControlName="fechaInicio">
            <mat-datepicker-toggle matSuffix [for]="fechaInicioPicker"></mat-datepicker-toggle>
            <mat-datepicker #fechaInicioPicker></mat-datepicker>
            <mat-error>Selecciona la fecha inicial.</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha final</mat-label>
            <input matInput [matDatepicker]="fechaFinPicker" formControlName="fechaFin">
            <mat-datepicker-toggle matSuffix [for]="fechaFinPicker"></mat-datepicker-toggle>
            <mat-datepicker #fechaFinPicker></mat-datepicker>
            <mat-error>Selecciona la fecha final.</mat-error>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Ítem</mat-label>
          <mat-select formControlName="itemId" (openedChange)="onItemSelectOpened($event)">
            <mat-option>
              <input
                type="text"
                class="reporte-salidas-dialog__search"
                placeholder="Buscar ítem..."
                [formControl]="itemSearchControl"
                (click)="$event.stopPropagation()"
                (keydown)="$event.stopPropagation()">
            </mat-option>
            <mat-option [value]="0">Todos los ítems</mat-option>
            <mat-option *ngFor="let item of filteredItems" [value]="item.id">
              {{ item.code }} - {{ item.description }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <p *ngIf="dateRangeError" class="reporte-salidas-dialog__error">
          La fecha final no puede ser menor que la fecha inicial.
        </p>
      </div>

      <div mat-dialog-actions align="end" class="reporte-salidas-dialog__actions">
        <button mat-stroked-button type="button" (click)="cancelar()">Cancelar</button>
        <button mat-flat-button color="primary" type="submit">Exportar Excel</button>
      </div>
    </form>
  `,
  styles: [`
    .reporte-salidas-dialog__content {
      display: grid;
      gap: 1rem;
      min-width: min(38rem, 100%);
      padding-top: 0.5rem;
    }

    .reporte-salidas-dialog__content > p {
      margin: 0;
      color: var(--text-secondary);
    }

    .reporte-salidas-dialog__dates {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .reporte-salidas-dialog__search {
      width: 100%;
      border: 0;
      outline: 0;
      box-sizing: border-box;
      padding: 0.65rem 0.75rem;
      font: inherit;
    }

    .reporte-salidas-dialog__error {
      color: #c62828 !important;
      font-size: 0.875rem;
    }

    .reporte-salidas-dialog__actions {
      gap: 0.75rem;
    }

    @media (max-width: 640px) {
      .reporte-salidas-dialog__dates {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AlmacenSalidasReporteDialogComponent {
  readonly itemSearchControl = new FormControl('', { nonNullable: true });
  readonly form = this.formBuilder.group({
    fechaInicio: [this.getFirstDayOfCurrentMonth(), Validators.required],
    fechaFin: [this.getToday(), Validators.required],
    itemId: [0, { nonNullable: true }]
  });

  dateRangeError = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly dialogRef: MatDialogRef<
      AlmacenSalidasReporteDialogComponent,
      AlmacenSalidaReporteDialogResult | undefined
    >,
    @Inject(MAT_DIALOG_DATA) readonly data: AlmacenSalidaReporteDialogData
  ) {}

  get filteredItems(): AlmacenSalidaReporteItemOption[] {
    const search = this.itemSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.data.items;
    }

    return this.data.items.filter((item) =>
      [item.code, item.description].some((value) => value.toLowerCase().includes(search))
    );
  }

  onItemSelectOpened(opened: boolean): void {
    if (opened) {
      this.itemSearchControl.setValue('');
    }
  }

  exportar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const fechaInicio = this.form.controls.fechaInicio.value;
    const fechaFin = this.form.controls.fechaFin.value;

    if (!fechaInicio || !fechaFin) {
      return;
    }

    this.dateRangeError = fechaFin.getTime() < fechaInicio.getTime();

    if (this.dateRangeError) {
      return;
    }

    const itemId = Number(this.form.controls.itemId.value || 0);
    const selectedItem = this.data.items.find((item) => item.id === itemId);

    this.dialogRef.close({
      fechaInicio,
      fechaFin,
      itemId,
      itemLabel: selectedItem ? selectedItem.code || selectedItem.description : 'todos'
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }

  private getToday(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  private getFirstDayOfCurrentMonth(): Date {
    const today = this.getToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
}
