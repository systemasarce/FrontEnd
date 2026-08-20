import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export type FotoSourceChoice = 'camera' | 'gallery';

export interface SeleccionCapturaFotoDialogData {
  titulo: string;
  mensaje: string;
  textoOpcionCamara?: string;
  textoOpcionArchivo?: string;
}

@Component({
  selector: 'app-seleccion-captura-foto-dialog',
  templateUrl: './seleccion-captura-foto-dialog.component.html',
  styleUrls: ['./seleccion-captura-foto-dialog.component.scss']
})
export class SeleccionCapturaFotoDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: SeleccionCapturaFotoDialogData,
    private readonly dialogRef: MatDialogRef<SeleccionCapturaFotoDialogComponent>
  ) {}

  elegir(opcion: FotoSourceChoice): void {
    this.dialogRef.close(opcion);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
