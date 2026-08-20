import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';

export interface WeReportListadoDialogData {
  We_Report_Id: number;
  Codigo_We_Report: string;
  Usr_Nom: string;
  Reporte_Tipo: string;
  Cen_Cos_Des: string;
  Cliente_Nombre: string;
  Report_Descripcion: string;
  Report_Acciones_Inmediata: string;
  Report_Foto1_Ubicacion?: string | null;
  Report_Foto2_Ubicacion?: string | null;
  Report_Potencial: string;
  Report_Aplica: string;
}

interface ArchivoVistaItem {
  nombre: string;
  ruta: string;
}

@Component({
  selector: 'app-we-report-archivos-dialog',
  templateUrl: './we-report-archivos-dialog.component.html',
  styleUrls: ['./we-report-archivos-dialog.component.scss']
})
export class WeReportArchivosDialogComponent implements OnInit, OnDestroy {
  archivosFoto1: ArchivoVistaItem[] = [];
  archivosFoto2: ArchivoVistaItem[] = [];

  private readonly suscripciones: Subscription[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: WeReportListadoDialogData,
    private readonly dialogRef: MatDialogRef<WeReportArchivosDialogComponent>,
    private readonly apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.archivosFoto1 = this.crearArchivos('Foto 1', this.data.Report_Foto1_Ubicacion);
    this.archivosFoto2 = this.crearArchivos('Foto 2', this.data.Report_Foto2_Ubicacion);
  }

  ngOnDestroy(): void {
    this.suscripciones.forEach(sub => sub.unsubscribe());
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  verArchivo(ruta: string): void {
    if (!ruta) {
      alert('No hay ruta de archivo.');
      return;
    }

    const sub = this.apiService.getArchivoWeReport(ruta).subscribe({
      next: (buffer: ArrayBuffer) => {
        const blob = new Blob([buffer], { type: this.obtenerMimeType(ruta) });
        const url = URL.createObjectURL(blob);
        const ventana = window.open(url, '_blank', 'noopener,noreferrer');
        if (ventana) {
          ventana.focus();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => {
        alert('No se pudo abrir el archivo. Verifica que exista en disco.');
      }
    });

    this.suscripciones.push(sub);
  }

  trackByRuta(_index: number, item: ArchivoVistaItem): string {
    return item.ruta;
  }

  private crearArchivos(prefijo: string, rutas?: string | null): ArchivoVistaItem[] {
    if (!rutas) {
      return [];
    }

    return rutas
      .split(/[\r\n|;,]+/g)
      .map((r: string) => r.trim())
      .filter((r: string) => r.length > 0)
      .map((ruta: string, index: number) => {
        const nombre = ruta.split(/[\\\/]/).pop()?.trim() || `${prefijo} ${index + 1}`;
        return { nombre, ruta };
      });
  }

  private obtenerMimeType(nombreArchivo: string): string {
    const nombre = (nombreArchivo || '').toLowerCase();
    if (nombre.endsWith('.png')) return 'image/png';
    if (nombre.endsWith('.jpg') || nombre.endsWith('.jpeg')) return 'image/jpeg';
    if (nombre.endsWith('.webp')) return 'image/webp';
    if (nombre.endsWith('.gif')) return 'image/gif';
    if (nombre.endsWith('.bmp')) return 'image/bmp';
    if (nombre.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  }
}
