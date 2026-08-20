import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

export type ElegirEdicionCentroMonitoreoResultado = 'centro-monitoreo' | 'puntaje' | null;

@Component({
  selector: 'app-elegir-edicion-centro-monitoreo-dialog',
  templateUrl: './elegir-edicion-centro-monitoreo-dialog.component.html',
  styleUrls: ['./elegir-edicion-centro-monitoreo-dialog.component.scss']
})
export class ElegirEdicionCentroMonitoreoDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<ElegirEdicionCentroMonitoreoDialogComponent, ElegirEdicionCentroMonitoreoResultado>
  ) {}

  elegirCentroMonitoreo(): void {
    this.dialogRef.close('centro-monitoreo');
  }

  elegirPuntaje(): void {
    this.dialogRef.close('puntaje');
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
