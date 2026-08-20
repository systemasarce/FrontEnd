import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface PedidoDetalleImageSourceDialogData {
  titulo?: string;
  mensaje?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export type PedidoDetalleImageSourceDialogResult = 'camera' | 'file' | 'cancel';

@Component({
  selector: 'app-pedido-detalle-image-source-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.titulo || 'Agregar imagen' }}</h2>
    <div mat-dialog-content class="pedido-detalle-image-source-dialog__content">
      <p>{{ data.mensaje || 'Selecciona como deseas agregar la imagen.' }}</p>
      <div *ngIf="data.imageUrl" class="pedido-detalle-image-source-dialog__preview">
        <img [src]="data.imageUrl" [alt]="data.imageAlt || 'Imagen del producto'">
      </div>
    </div>
    <div mat-dialog-actions align="end" class="pedido-detalle-image-source-dialog__actions">
      <button mat-stroked-button type="button" (click)="close('cancel')">Cancelar</button>
      <button mat-stroked-button type="button" (click)="close('camera')">Camara</button>
      <button mat-flat-button color="primary" type="button" (click)="close('file')">Archivo</button>
    </div>
  `,
  styles: [`
    .pedido-detalle-image-source-dialog__content {
      min-width: min(26rem, 80vw);
      color: var(--text-secondary, #475569);
      line-height: 1.6;
    }

    .pedido-detalle-image-source-dialog__content p {
      margin: 0;
    }

    .pedido-detalle-image-source-dialog__preview {
      margin-top: 1rem;
      padding: 0.75rem;
      border: 1px solid var(--line-soft, #e2e8f0);
      border-radius: 10px;
      background: #f8fafc;
      display: flex;
      justify-content: center;
    }

    .pedido-detalle-image-source-dialog__preview img {
      max-width: 100%;
      max-height: 14rem;
      border-radius: 8px;
      object-fit: contain;
    }

    .pedido-detalle-image-source-dialog__actions {
      gap: 0.75rem;
      padding: 0 1.5rem 1.25rem;
    }
  `]
})
export class PedidoDetalleImageSourceDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PedidoDetalleImageSourceDialogData,
    private readonly dialogRef: MatDialogRef<PedidoDetalleImageSourceDialogComponent, PedidoDetalleImageSourceDialogResult>
  ) {}

  close(result: PedidoDetalleImageSourceDialogResult): void {
    this.dialogRef.close(result);
  }
}
