import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { ClienteTjh2bFilter, ClienteTjh2bItem } from './cliente-tjh2b.model';
import { ClienteTjh2bRegisterDialogComponent } from './cliente-tjh2b-register-dialog.component';
import { ClienteTjh2bService } from './cliente-tjh2b.service';

type DataRecord = Record<string, unknown>;

@Component({
  selector: 'app-cliente-tjh2b-page',
  templateUrl: './cliente-tjh2b-page.component.html',
  styleUrls: ['./cliente-tjh2b-page.component.scss']
})
export class ClienteTjh2bPageComponent implements OnInit {
  readonly filtros: ClienteTjh2bFilter = {
    Id: 0,
    Nombre: '',
    Estado: 'A'
  };

  clientes: ClienteTjh2bItem[] = [];
  cargando = false;
  eliminandoCliente = false;
  errorMessage = '';

  // ── Paginación ──────────────────────────────────────────────────
  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.clientes.length / this.pageSize));
  }

  get clientesPaginados(): ClienteTjh2bItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.clientes.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
  }
  // ────────────────────────────────────────────────────────────────

  constructor(
    private readonly clienteService: ClienteTjh2bService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(ClienteTjh2bRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || ''
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarClientes();
      }
    });
  }

  editarCliente(cliente: ClienteTjh2bItem): void {
    if (cliente.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ClienteTjh2bRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        cliente
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarClientes();
      }
    });
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
    this.cargarClientes();
  }

  eliminarCliente(cliente: ClienteTjh2bItem): void {
    if (cliente.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar cliente',
        mensaje: `Se eliminará al cliente "${cliente.nombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionCliente(cliente.id as number);
      }
    });
  }

  private ejecutarEliminacionCliente(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminandoCliente = true;

    this.clienteService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminandoCliente = false;
        this.cargarClientes();
      },
      error: (error: unknown) => {
        console.error('Error eliminando cliente', error);
        this.eliminandoCliente = false;
        this.errorMessage = 'No se pudo eliminar el cliente.';
      }
    });
  }

  limpiar(): void {
    this.filtros.Id = 0;
    this.filtros.Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarClientes();
  }

  cargarClientes(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1; // resetear al buscar/limpiar

    this.clienteService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando clientes', error);
        this.clientes = [];
        this.errorMessage = 'No se pudo cargar la información de Clientes.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.clientes = registros.map((item) => this.mapCliente(item));
        this.cargando = false;
      },
      error: () => {
        this.clientes = [];
        this.cargando = false;
      }
    });
  }

  trackByCliente(_index: number, cliente: ClienteTjh2bItem): number | null {
    return cliente.id;
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

  private mapCliente(item: DataRecord): ClienteTjh2bItem {
    const rawId =
      item['id'] ??
      item['Id'] ??
      item['Cliente_Id'] ??
      item['cliente_Id'];

    const rawNombre =
      item['nombre'] ??
      item['Nombre'] ??
      item['Cliente_Nombre'] ??
      item['cliente_Nombre'];

    const rawEstado =
      item['estado'] ??
      item['Estado'];

    return {
      id: rawId === null || rawId === undefined || rawId === '' ? null : Number(rawId),
      nombre: String(rawNombre ?? ''),
      estado: String(rawEstado ?? '')
    };
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DataRecord => this.isRecord(item));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    const elements = response['Elements'] ?? response['elements'];
    if (Array.isArray(elements)) {
      return elements.filter((item): item is DataRecord => this.isRecord(item));
    }

    const data = response['Data'] ?? response['data'];
    if (Array.isArray(data)) {
      return data.filter((item): item is DataRecord => this.isRecord(item));
    }

    return [response];
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}