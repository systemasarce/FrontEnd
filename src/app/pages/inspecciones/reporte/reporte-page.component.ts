import { Component } from '@angular/core';

type DataRecord = {
  id: number | null;
  nombre: string;
  estado: string;
};

@Component({
  selector: 'app-reporte-page',
  templateUrl: './reporte-page.component.html',
  styleUrls: ['./reporte-page.component.scss']
})
export class ReportePageComponent {
  readonly filtros = {
    Id: 0,
    Nombre: '',
    Estado: 'A'
  };

  readonly registros: DataRecord[] = [
    {
        "id": 1,
        "nombre": "Reporte Diario",
        "estado": "A"
    },
    {
        "id": 2,
        "nombre": "Reporte Semanal",
        "estado": "A"
    },
    {
        "id": 3,
        "nombre": "Reporte Mensual",
        "estado": "I"
    }
];

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.registros.length / this.pageSize));
  }

  get registrosPaginados(): DataRecord[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.registros.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  abrirNuevo(): void {
    // Sin acción
  }

  editarRegistro(_registro: DataRecord): void {
    // Sin acción
  }

  eliminarRegistro(_registro: DataRecord): void {
    // Sin acción
  }

  actualizarFiltroId(valor: unknown): void {
    if (valor === null || valor === undefined || valor === '') {
      this.filtros.Id = 0;
      return;
    }

    const numero = Number(valor);
    this.filtros.Id = Number.isFinite(numero) ? numero : 0;
  }

  buscar(): void {
    // Sin acción
  }

  limpiar(): void {
    this.filtros.Id = 0;
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
  }

  trackByRegistro(_index: number, registro: DataRecord): number | null {
    return registro.id;
  }

  formatEstado(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }

    const normalized = text.toUpperCase();
    if (normalized === 'A' || normalized === 'ACTIVO') {
      return 'Activo';
    }

    if (normalized === 'I' || normalized === 'INACTIVO') {
      return 'Inactivo';
    }

    return text;
  }
}
