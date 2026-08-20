import { Component, OnInit } from '@angular/core';
import { catchError, EMPTY, of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';

type DataRecord = Record<string, unknown>;

type FormMode = 'nuevo' | 'editar';

interface SubestacionItem {
  id: number | null;
  nombre: string;
  cliente: string;
  clienteId: number;
  estado: string;
}

interface ClienteOption {
  id: number;
  nombre: string;
}

interface SubestacionForm {
  Subestacion_Id: number | null;
  Subestacion_Nombre: string;
  Cliente_Id: number;
  Estado: 'A' | 'I';
}

@Component({
  selector: 'app-subestacion-page',
  templateUrl: './subestacion-page.component.html',
  styleUrls: ['./subestacion-page.component.scss']
})
export class SubestacionPageComponent implements OnInit {
  readonly filtros = {
    Id: undefined as number | undefined,
    Nombre: '',
    Cliente_Id: 0,
    Estado: 'A'
  };

  clientes: ClienteOption[] = [];
  subestaciones: SubestacionItem[] = [];
  cargando = false;
  cargandoClientes = false;
  cargandoFormulario = false;
  panelVisible = false;
  guardando = false;
  errorMessage = '';
  mensajeFormulario = '';
  modoFormulario: FormMode = 'nuevo';

  formulario: SubestacionForm = this.crearFormularioVacio();

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.subestaciones.length / this.pageSize));
  }

  get subestacionesPaginadas(): SubestacionItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.subestaciones.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarSubestaciones();
  }

  abrirNuevo(): void {
    this.modoFormulario = 'nuevo';
    this.formulario = this.crearFormularioVacio();
    this.mensajeFormulario = '';
    this.panelVisible = true;
  }

  editarSubestacion(subestacion: SubestacionItem): void {
    if (!subestacion.id) {
      return;
    }

    this.modoFormulario = 'editar';
    this.panelVisible = true;
    this.cargandoFormulario = true;
    this.mensajeFormulario = '';
    this.formulario = {
      Subestacion_Id: subestacion.id,
      Subestacion_Nombre: '',
      Cliente_Id: 0,
      Estado: 'A'
    };

    this.apiService.getConsultarEditarSubEstaciones(subestacion.id).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando datos de edición', error);
        this.mensajeFormulario = 'No se pudo cargar la subestación seleccionada.';
        this.cargandoFormulario = false;
        return EMPTY;
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        const data = registros[0] ?? {};
        const nombre = this.getText(data, 'Subestacion_Nombre', 'subestacion_Nombre', 'Nombre', 'nombre');
        const clienteNombre = this.getText(data, 'Cliente_Nombre', 'cliente_Nombre', 'Cliente', 'cliente');
        const clienteId = this.getNumber(data, 'Cliente_Id', 'cliente_Id', 'IdCliente', 'idCliente') || this.obtenerClienteIdPorNombre(clienteNombre);
        const estado = this.normalizarEstado(this.getText(data, 'Estado', 'estado', 'Flg_Est', 'Flg_Estado'));

        this.formulario = {
          Subestacion_Id: subestacion.id,
          Subestacion_Nombre: nombre,
          Cliente_Id: clienteId,
          Estado: estado
        };
        this.cargandoFormulario = false;
      },
      error: () => {
        this.cargandoFormulario = false;
      }
    });
  }

  cerrarPanel(): void {
    if (this.guardando || this.cargandoFormulario) {
      return;
    }

    this.panelVisible = false;
    this.mensajeFormulario = '';
    this.formulario = this.crearFormularioVacio();
    this.modoFormulario = 'nuevo';
  }

  eliminarSubestacion(subestacion: SubestacionItem): void {
    console.log('Eliminar subestación', subestacion);
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }

    this.paginaActual = pagina;
  }

  buscar(): void {
    this.cargarSubestaciones();
  }

  limpiar(): void {
    this.filtros.Id = undefined;
    this.filtros.Nombre = '';
    this.filtros.Cliente_Id = 0;
    this.filtros.Estado = 'A';
    this.cargarSubestaciones();
  }

  cargarClientes(): void {
    this.cargandoClientes = true;

    this.apiService.getListarInsClientes().pipe(
      catchError((error: unknown) => {
        console.error('Error cargando clientes', error);
        this.clientes = [];
        this.cargandoClientes = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.clientes = registros
          .map((item) => this.mapCliente(item))
          .filter((item) => item.id > 0 && item.nombre.length > 0);
        this.cargandoClientes = false;
      },
      error: () => {
        this.clientes = [];
        this.cargandoClientes = false;
      }
    });
  }

  cargarSubestaciones(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.apiService.getListarSubEstaciones(this.normalizarFiltros()).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando subestaciones', error);
        this.subestaciones = [];
        this.errorMessage = 'No se pudo cargar la información de Subestaciones.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        const registros = this.extractRecords(response);
        this.subestaciones = registros.map((item) => this.mapSubestacion(item));
        this.cargando = false;
      },
      error: () => {
        this.subestaciones = [];
        this.cargando = false;
      }
    });
  }

  guardarFormulario(): void {
    if (this.guardando) {
      return;
    }

    const nombre = this.formulario.Subestacion_Nombre.trim();
    if (!nombre) {
      this.mensajeFormulario = 'Ingresa el nombre de la subestación.';
      return;
    }

    if (!this.formulario.Cliente_Id) {
      this.mensajeFormulario = 'Selecciona un cliente.';
      return;
    }

    this.guardando = true;
    this.mensajeFormulario = '';

    const usrMod = this.obtenerUsrMod();
    const request$ = this.modoFormulario === 'editar' && this.formulario.Subestacion_Id
      ? this.apiService.patchEditarSubEstaciones({
          Subestacion_Id: this.formulario.Subestacion_Id,
          Subestacion_Nombre: nombre,
          Cliente_Id: this.formulario.Cliente_Id,
          Usr_Mod: usrMod,
          Estado: this.formulario.Estado
        })
      : this.apiService.registrarSubEstacion({
          Subestacion_Nombre: nombre,
          Cliente_Id: this.formulario.Cliente_Id,
          Usr_Reg: usrMod
        });

    request$.pipe(
      catchError((error: unknown) => {
        console.error('Error guardando subestación', error);
        this.mensajeFormulario = 'No se pudo guardar la subestación.';
        this.guardando = false;
        return EMPTY;
      })
    ).subscribe({
      next: () => {
        this.guardando = false;
        this.panelVisible = false;
        this.formulario = this.crearFormularioVacio();
        this.cargarSubestaciones();
      },
      error: () => {
        this.guardando = false;
      }
    });
  }

  trackBySubestacion(_index: number, subestacion: SubestacionItem): number | null {
    return subestacion.id;
  }

  formatEstado(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }

    const normalized = text.toUpperCase();
    if (normalized === 'A' || normalized === 'ACTIVO' || normalized === '1' || normalized === 'TRUE') {
      return 'Activo';
    }

    if (normalized === 'I' || normalized === 'INACTIVO' || normalized === '0' || normalized === 'FALSE') {
      return 'Inactivo';
    }

    return text;
  }

  private crearFormularioVacio(): SubestacionForm {
    return {
      Subestacion_Id: null,
      Subestacion_Nombre: '',
      Cliente_Id: 0,
      Estado: 'A'
    };
  }

  private normalizarFiltros(): { Id: number; Nombre: string; Cliente_Id: number; Estado: string } {
    return {
      Id: this.normalizarEntero(this.filtros.Id),
      Nombre: this.normalizarTexto(this.filtros.Nombre),
      Cliente_Id: this.normalizarEntero(this.filtros.Cliente_Id),
      Estado: this.normalizarEstado(this.filtros.Estado)
    };
  }

  private normalizarEntero(value: unknown): number {
    const numero = Number(value);
    return Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 0;
  }

  private normalizarTexto(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizarEstado(value: unknown): 'A' | 'I' {
    const texto = String(value ?? '').trim().toUpperCase();
    return texto === 'I' ? 'I' : 'A';
  }

  private mapCliente(item: DataRecord): ClienteOption {
    const rawId = item['Cliente_Id'] ?? item['cliente_Id'] ?? item['Id'] ?? item['id'];
    const rawNombre = item['Cliente_Nombre'] ?? item['cliente_Nombre'] ?? item['Nombre'] ?? item['nombre'];

    return {
      id: rawId === null || rawId === undefined || rawId === '' ? 0 : Number(rawId),
      nombre: String(rawNombre ?? '').trim()
    };
  }

  private mapSubestacion(item: DataRecord): SubestacionItem {
    const rawId = item['Subestacion_Id'] ?? item['subestacion_Id'] ?? item['Id'] ?? item['id'];
    const rawNombre = item['Subestacion_Nombre'] ?? item['subestacion_Nombre'] ?? item['Nombre'] ?? item['nombre'];
    const rawCliente = item['Cliente_Nombre'] ?? item['cliente_Nombre'] ?? item['Cliente'] ?? item['cliente'];
    const rawClienteId = item['Cliente_Id'] ?? item['cliente_Id'] ?? item['Id_Cliente'] ?? item['idCliente'];
    const rawEstado = item['Estado'] ?? item['estado'] ?? item['Flg_Est'] ?? item['Flg_Estado'];

    return {
      id: rawId === null || rawId === undefined || rawId === '' ? null : Number(rawId),
      nombre: String(rawNombre ?? '').trim(),
      cliente: String(rawCliente ?? '').trim(),
      clienteId: rawClienteId === null || rawClienteId === undefined || rawClienteId === '' ? 0 : Number(rawClienteId),
      estado: String(rawEstado ?? '').trim()
    };
  }

  private obtenerClienteIdPorNombre(nombre: string): number {
    const limpio = String(nombre ?? '').trim().toLowerCase();
    if (!limpio) {
      return 0;
    }

    const encontrado = this.clientes.find((cliente) => cliente.nombre.trim().toLowerCase() === limpio);
    return encontrado?.id ?? 0;
  }

  private getText(item: DataRecord, ...keys: string[]): string {
    for (const key of keys) {
      const value = item[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private getNumber(item: DataRecord, ...keys: string[]): number {
    for (const key of keys) {
      const value = item[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        const numero = Number(value);
        if (Number.isFinite(numero)) {
          return numero;
        }
      }
    }
    return 0;
  }

  private obtenerUsrMod(): string {
    const candidateKeys = [
      'Usr_Mod',
      'usr_mod',
      'Usr_Cod',
      'usr_cod',
      'usuario',
      'Usuario',
      'user',
      'User',
      'nombreUsuario',
      'NombreUsuario',
      'usuarioActivo',
      'UsuarioActivo'
    ];

    const storages: Array<Storage | null> = [];
    try {
      storages.push(localStorage);
    } catch {
      storages.push(null);
    }
    try {
      storages.push(sessionStorage);
    } catch {
      storages.push(null);
    }

    for (const storage of storages) {
      if (!storage) {
        continue;
      }

      for (const key of candidateKeys) {
        const raw = storage.getItem(key);
        const parsed = this.extraerUsrMod(raw);
        if (parsed) {
          return parsed;
        }
      }
    }

    return 'dmachaca';
  }

  private extraerUsrMod(raw: string | null): string {
    if (!raw) {
      return '';
    }

    const limpio = raw.trim();
    if (!limpio) {
      return '';
    }

    try {
      const json = JSON.parse(limpio) as Record<string, unknown>;
      const posibles = [
        json['Usr_Mod'],
        json['Usr_Cod'],
        json['usr_mod'],
        json['usr_cod'],
        json['usuario'],
        json['Usuario'],
        json['user'],
        json['User'],
        json['nombreUsuario'],
        json['NombreUsuario']
      ];

      for (const valor of posibles) {
        const extraido = this.extraerUsrMod(typeof valor === 'string' ? valor : '');
        if (extraido) {
          return extraido;
        }
      }
    } catch {
      // no es JSON
    }

    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length > 1) {
      return partes[partes.length - 1];
    }

    return limpio;
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
