import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface PedidoArchivoDialogRow {
  id: number;
  pedidoId: number;
  nombre: string;
  ruta: string;
}

export interface PedidoArchivosDialogData {
  pedidoCodigo: string;
  archivos: PedidoArchivoDialogRow[];
  verArchivo: (archivo: PedidoArchivoDialogRow) => void;
}

@Component({
  selector: 'app-pedido-archivos-dialog',
  template: `
    <section class="pedido-archivos-dialog">
      <div class="pedido-archivos-dialog__table-shell">
        <table class="pedido-archivos-dialog__table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let archivo of data.archivos">
              <td>
                <div class="pedido-archivos-dialog__file">
                  <span class="pedido-archivos-dialog__file-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-.7 1.8L18.2 8H14a.7.7 0 0 1-.7-.7V3.8ZM6 4h5.8v3.3A2.2 2.2 0 0 0 14 9.5h4.5V20c0 .3-.2.5-.5.5H6a.5.5 0 0 1-.5-.5V4.5c0-.3.2-.5.5-.5Z"/>
                    </svg>
                  </span>
                  <span class="pedido-archivos-dialog__file-name">{{ archivo.nombre }}</span>
                </div>
              </td>
              <td>
                <button type="button" class="pedido-archivos-dialog__icon-button" aria-label="Ver archivo" (click)="verArchivo(archivo)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5c-5.4 0-9.4 4.7-10.7 6.4a1 1 0 0 0 0 1.2C2.6 14.3 6.6 19 12 19s9.4-4.7 10.7-6.4a1 1 0 0 0 0-1.2C21.4 9.7 17.4 5 12 5Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-2A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5.5Z"/>
                  </svg>
                </button>
              </td>
            </tr>
            <tr *ngIf="!data.archivos.length">
              <td colspan="2" class="pedido-archivos-dialog__empty">No hay archivos adjuntos.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pedido-archivos-dialog__actions">
        <button type="button" class="pedido-archivos-dialog__close" (click)="cerrar()">Cerrar</button>
      </footer>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      max-width: 100%;
      box-sizing: border-box;
    }

    .pedido-archivos-dialog {
      width: 100%;
      max-width: 100%;
      max-height: calc(100vh - 4rem);
      padding: 0.25rem;
      box-sizing: border-box;
      color: #5f5f5f;
      overflow: hidden;
    }

    .pedido-archivos-dialog__table-shell {
      max-width: 100%;
      max-height: min(52vh, 420px);
      overflow-x: auto;
      overflow-y: auto;
      border: 1px solid #dedbd7;
      border-radius: 10px;
      background: #fff;
    }

    .pedido-archivos-dialog__table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .pedido-archivos-dialog__table th {
      padding: 1rem;
      background: #6f6d68;
      color: #fff;
      font-weight: 800;
      text-align: left;
    }

    .pedido-archivos-dialog__table td {
      padding: 0.95rem 1rem;
      border-top: 1px solid #e7e2dc;
      color: #666;
      vertical-align: middle;
    }

    .pedido-archivos-dialog__table tbody tr:nth-child(even) {
      background: #fbf7f1;
    }

    .pedido-archivos-dialog__table th:last-child,
    .pedido-archivos-dialog__table td:last-child {
      width: 7.5rem;
      text-align: center;
    }

    .pedido-archivos-dialog__file {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .pedido-archivos-dialog__file-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 2rem;
      height: 2rem;
      border-radius: 8px;
      background: #fff1df;
      color: #ff9826;
    }

    .pedido-archivos-dialog__file-icon svg {
      width: 1rem;
      height: 1rem;
      fill: currentColor;
    }

    .pedido-archivos-dialog__file-name {
      overflow-wrap: anywhere;
      line-height: 1.35;
    }

    .pedido-archivos-dialog__icon-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.2rem;
      height: 2.35rem;
      border: 1px solid #dedbd7;
      border-radius: 10px;
      background: #fff;
      color: #ff9826;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }

    .pedido-archivos-dialog__icon-button:hover {
      border-color: #ff9826;
      box-shadow: 0 8px 18px rgba(255, 152, 38, 0.16);
      transform: translateY(-1px);
    }

    .pedido-archivos-dialog__icon-button svg {
      width: 1rem;
      height: 1rem;
      fill: currentColor;
    }

    .pedido-archivos-dialog__empty {
      padding: 1.4rem;
      text-align: center;
      color: #888;
    }

    .pedido-archivos-dialog__actions {
      display: flex;
      justify-content: flex-end;
      width: 100%;
      margin-top: 1.25rem;
      box-sizing: border-box;
    }

    .pedido-archivos-dialog__close {
      min-width: 6.25rem;
      min-height: 2.8rem;
      border: 1px solid #dedbd7;
      border-radius: 10px;
      background: #f7f5f2;
      color: #66625e;
      font-weight: 800;
      cursor: pointer;
    }

    .pedido-archivos-dialog__close:hover {
      filter: brightness(0.98);
    }

    @media (max-width: 640px) {
      .pedido-archivos-dialog {
        max-height: calc(100vh - 2rem);
        padding: 0;
      }

      .pedido-archivos-dialog__table th,
      .pedido-archivos-dialog__table td {
        padding: 0.8rem;
      }

      .pedido-archivos-dialog__table th:last-child,
      .pedido-archivos-dialog__table td:last-child {
        width: 5.8rem;
      }

      .pedido-archivos-dialog__file {
        gap: 0.55rem;
      }

      .pedido-archivos-dialog__file-icon {
        width: 1.8rem;
        height: 1.8rem;
      }
    }
  `]
})
export class PedidoArchivosDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PedidoArchivosDialogData,
    private readonly dialogRef: MatDialogRef<PedidoArchivosDialogComponent>
  ) {}

  verArchivo(archivo: PedidoArchivoDialogRow): void {
    this.data.verArchivo(archivo);
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
