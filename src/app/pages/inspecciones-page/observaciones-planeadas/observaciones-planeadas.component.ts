import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, ActualizarObservacionPlaneadaRequest, RegistrarObservacionPlaneadaRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../confirmacion-accion-dialog.component';

interface ObservadorDatos {
  nombre: string;
  cargo: string;
  area: string;
  dni: string;
}

interface InsCliente {
  Cliente_Id: number;
  Cliente_Nombre: string;
}

interface InsSubEstacion {
  Subestacion_Id: number;
  Subestacion_Nombre: string;
}

interface InsMotivo {
  Motivo_Id: number;
  Motivo_Nombre: string;
}

interface InsClima {
  Clima_Id: number;
  Clima_Nombre: string;
}

interface InsTarea {
  Tarea_Id: number;
  Tarea_Nombre: string;
}

interface InsSubContrata {
  SubContrata_Id: number;
  SubContrata_Nombre: string;
}

// El Jefe se identifica por Usr_Cod (string); área y DNI se cargan con SP_Mostrar_Jefe
interface InsJefeArea {
  Usr_Cod: string;
  Usr_Nom: string;
}

type ComboKey = 'cliente' | 'subestacion' | 'subcontrata' | 'jefeArea' | 'motivo' | 'clima' | 'tarea';

interface ObservacionFormularioValores {
  usrCodTexto: string;
  clienteId: number;
  subestacionId: number;
  subContrataId: number;
  jefeCod: string;
  motivoId: number;
  climaId: number;
  tareaId: number;
  obsDetalle: string;
  obsActividad: string;
  estado: 'A' | 'I';
}

@Component({
  selector: 'app-observaciones-planeadas',
  templateUrl: './observaciones-planeadas.component.html',
  styleUrls: ['./observaciones-planeadas.component.scss']
})
export class ObservacionesPlaneadasComponent implements OnInit {
  @Output() volver = new EventEmitter<void>();

  @Input() observacionIdSeleccionado: number | null = null;
  @Input() codigoObsSeleccionado: string | null = null;
  @Input() modoEdicion = false;

  observador: ObservadorDatos = {
    nombre: '',
    cargo: '',
    area: '',
    dni: ''
  };

  readonly observacionForm: FormGroup;

  clientes: InsCliente[] = [];
  subestaciones: InsSubEstacion[] = [];
  motivos: InsMotivo[] = [];
  climas: InsClima[] = [];
  tareas: InsTarea[] = [];
  subContratas: InsSubContrata[] = [];
  jefesArea: InsJefeArea[] = [];

  subestacionesFiltradas: InsSubEstacion[] = [];
  clienteSeleccionado: InsCliente | null = null;
  subestacionSeleccionada: InsSubEstacion | null = null;
  motivoSeleccionado: InsMotivo | null = null;
  climaSeleccionado: InsClima | null = null;
  tareaSeleccionada: InsTarea | null = null;
  subContrataSeleccionada: InsSubContrata | null = null;
  jefeAreaSeleccionado: InsJefeArea | null = null;

  comboOpen: Record<ComboKey, boolean> = {
    cliente: false,
    subestacion: false,
    subcontrata: false,
    jefeArea: false,
    motivo: false,
    clima: false,
    tarea: false
  };

  comboSearch: Record<ComboKey, string> = {
    cliente: '',
    subestacion: '',
    subcontrata: '',
    jefeArea: '',
    motivo: '',
    clima: '',
    tarea: ''
  };

  cargandoClientes = false;
  cargandoSubestaciones = false;
  cargandoMotivos = false;
  cargandoClimas = false;
  cargandoTareas = false;
  cargandoSubContratas = false;
  cargandoJefesArea = false;
  cargandoObservacion = false;
  registrandoObservacion = false;
  private observacionEdicionBase: Record<string, unknown> | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly dialog: MatDialog
  ) {
    this.observacionForm = this.fb.group({
      cliente: [''],
      subestacion: [''],
      subcontrata: [''],
      jefeEquipo: [''],
      areaJefeEquipo: [''],
      dniJefeEquipo: [''],
      motivo: [''],
      detalleMotivo: [''],
      clima: [''],
      tipoTarea: [''],
      actividadObservada: [''],
      estado: ['A']
    });
  }

  ngOnInit(): void {
    this.cargarDatosObservador();
    this.cargarClientes();
    this.cargarSubContratas();
    this.cargarJefesArea();
    this.cargarMotivos();
    this.cargarClimas();
    this.cargarTareas();

    if (this.codigoObsSeleccionado?.trim()) {
      this.cargarDatosObservacionSeleccionada(this.codigoObsSeleccionado.trim());
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.closeCombos();
    }
  }

  retroceder(): void {
    const titulo = this.modoEdicion ? 'Cancelar edición' : 'Cancelar observación';
    const mensaje = this.modoEdicion
      ? `Se cancelará la edición de la observación ${this.codigoObsSeleccionado ?? ''}. Esta acción cerrará el formulario actual.`
      : 'Se cancelará el registro de la nueva observación. Esta acción cerrará el formulario actual.';

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo,
        mensaje,
        textoConfirmar: 'Confirmar cancelación',
        textoCancelar: 'Volver',
        tipo: 'normal'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.volverSinConfirmacion();
      }
    });
  }

  private volverSinConfirmacion(): void {
    this.volver.emit();
  }

  toggleCombo(combo: ComboKey): void {
    const willOpen = !this.comboOpen[combo];
    this.closeCombos();
    if (willOpen) {
      this.comboOpen[combo] = true;
      this.comboSearch[combo] = '';
    }
  }

  closeCombos(): void {
    this.comboOpen = {
      cliente: false,
      subestacion: false,
      subcontrata: false,
      jefeArea: false,
      motivo: false,
      clima: false,
      tarea: false
    };
  }

  onSearchChange(combo: ComboKey, event: Event): void {
    this.comboSearch[combo] = (event.target as HTMLInputElement).value ?? '';
  }

  selectCliente(cliente: InsCliente | null): void {
    this.clienteSeleccionado = cliente;
    this.observacionForm.patchValue({ cliente: cliente?.Cliente_Id ?? '' });

    this.subestacionSeleccionada = null;
    this.subestaciones = [];
    this.subestacionesFiltradas = [];
    this.observacionForm.patchValue({ subestacion: '' });

    this.comboSearch.cliente = '';
    this.closeCombos();

    if (cliente) {
      this.cargarSubestaciones(cliente.Cliente_Id);
    }
  }

  selectSubestacion(subestacion: InsSubEstacion | null): void {
    this.subestacionSeleccionada = subestacion;
    this.observacionForm.patchValue({ subestacion: subestacion?.Subestacion_Id ?? '' });
    this.comboSearch.subestacion = '';
    this.closeCombos();
  }

  selectSubContrata(subContrata: InsSubContrata | null): void {
    this.subContrataSeleccionada = subContrata;
    this.observacionForm.patchValue({ subcontrata: subContrata?.SubContrata_Id ?? '' });
    this.comboSearch.subcontrata = '';
    this.closeCombos();
  }

  selectJefeArea(jefe: InsJefeArea | null): void {
    this.jefeAreaSeleccionado = jefe;

    this.observacionForm.patchValue({
      jefeEquipo: jefe?.Usr_Cod ?? '',
      areaJefeEquipo: '',
      dniJefeEquipo: ''
    });

    this.comboSearch.jefeArea = '';
    this.closeCombos();

    if (jefe?.Usr_Cod) {
      this.apiService.getMostrarJefe(jefe.Usr_Cod).subscribe({
        next: (response: unknown) => {
          const data = this.extraerDatosJefe(response);
          this.observacionForm.patchValue({
            areaJefeEquipo: data?.cenCosDes ?? '',
            dniJefeEquipo: data?.dni ?? ''
          });
        },
        error: () => { }
      });
    }
  }

  private extraerDatosJefe(response: unknown): { cenCosDes: string; dni: string } | null {
    if (!response || typeof response !== 'object') { return null; }
    const resp = response as Record<string, unknown>;

    const elements = resp['Elements'] ?? resp['elements'];
    let record: Record<string, unknown> | null = null;

    if (Array.isArray(elements) && elements.length > 0) {
      record = elements[0] as Record<string, unknown>;
    } else {
      record = resp;
    }

    if (!record) { return null; }
    const cenCosDes = String(record['Cen_Cos_Des'] ?? record['cen_Cos_Des'] ?? '').trim();
    const dni = String(record['Usr_Doc_Nro'] ?? record['usr_Doc_Nro'] ?? '').trim();
    return { cenCosDes, dni };
  }

  selectMotivo(motivo: InsMotivo | null): void {
    this.motivoSeleccionado = motivo;
    this.observacionForm.patchValue({ motivo: motivo?.Motivo_Id ?? '' });
    this.comboSearch.motivo = '';
    this.closeCombos();
  }

  selectClima(clima: InsClima | null): void {
    this.climaSeleccionado = clima;
    this.observacionForm.patchValue({ clima: clima?.Clima_Id ?? '' });
    this.comboSearch.clima = '';
    this.closeCombos();
  }

  selectTarea(tarea: InsTarea | null): void {
    this.tareaSeleccionada = tarea;
    this.observacionForm.patchValue({ tipoTarea: tarea?.Tarea_Id ?? '' });
    this.comboSearch.tarea = '';
    this.closeCombos();
  }

  get clientesFiltrados(): InsCliente[] {
    return this.filtrarLista(this.clientes, this.comboSearch.cliente, item => `${item.Cliente_Id} ${item.Cliente_Nombre}`);
  }

  get subestacionesFiltradasCombo(): InsSubEstacion[] {
    return this.filtrarLista(this.subestaciones, this.comboSearch.subestacion, item => `${item.Subestacion_Id} ${item.Subestacion_Nombre}`);
  }

  get subContratasFiltradas(): InsSubContrata[] {
    return this.filtrarLista(this.subContratas, this.comboSearch.subcontrata, item => `${item.SubContrata_Nombre} ${item.SubContrata_Id}`);
  }

  get jefesAreaFiltrados(): InsJefeArea[] {
    return this.filtrarLista(this.jefesArea, this.comboSearch.jefeArea, item => `${item.Usr_Cod} ${item.Usr_Nom}`);
  }

  get motivosFiltrados(): InsMotivo[] {
    return this.filtrarLista(this.motivos, this.comboSearch.motivo, item => `${item.Motivo_Id} ${item.Motivo_Nombre}`);
  }

  get climasFiltrados(): InsClima[] {
    return this.filtrarLista(this.climas, this.comboSearch.clima, item => `${item.Clima_Nombre} ${item.Clima_Id}`);
  }

  get tareasFiltradas(): InsTarea[] {
    return this.filtrarLista(this.tareas, this.comboSearch.tarea, item => `${item.Tarea_Id} ${item.Tarea_Nombre}`);
  }

  get clienteDisplay(): string {
    return this.clienteSeleccionado?.Cliente_Nombre || 'Seleccionar';
  }

  get subestacionDisplay(): string {
    if (!this.clienteSeleccionado) {
      return 'Primero seleccione cliente';
    }
    return this.subestacionSeleccionada?.Subestacion_Nombre || 'Seleccionar';
  }

  get subContrataDisplay(): string {
    return this.subContrataSeleccionada?.SubContrata_Nombre || 'Seleccionar';
  }

  get jefeAreaDisplay(): string {
    return this.jefeAreaSeleccionado?.Usr_Nom || 'Seleccionar';
  }

  get motivoDisplay(): string {
    return this.motivoSeleccionado?.Motivo_Nombre || 'Seleccionar';
  }

  get climaDisplay(): string {
    return this.climaSeleccionado?.Clima_Nombre || 'Seleccionar';
  }

  get tareaDisplay(): string {
    return this.tareaSeleccionada?.Tarea_Nombre || 'Seleccionar';
  }

  private filtrarLista<T>(items: T[], term: string, extractor: (item: T) => string): T[] {
    const normalizedTerm = this.normalizarTexto(term.trim());
    if (!normalizedTerm) {
      return items;
    }

    return items.filter(item => this.normalizarTexto(extractor(item)).includes(normalizedTerm));
  }

  private normalizarTexto(value: string): string {
    return value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private cargarClientes(): void {
    this.cargandoClientes = true;
    this.apiService.getListarInsClientes().subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.clientes = raw.map(item => ({
          Cliente_Id: this.toNumber(item['Cliente_Id'] ?? item['cliente_Id']),
          Cliente_Nombre: this.getFirstNonEmptyText(item, ['Cliente_Nombre', 'cliente_Nombre', 'Cliente_Des', 'cliente_Des'])
        })).filter(x => x.Cliente_Id > 0 || x.Cliente_Nombre !== '');
        this.cargandoClientes = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.clientes = [];
        this.cargandoClientes = false;
      }
    });
  }

  private cargarSubestaciones(clienteId: number): void {
    this.cargandoSubestaciones = true;
    this.apiService.getSubEstacionesPorCliente(clienteId).subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.subestaciones = raw.map(item => ({
          Subestacion_Id: this.toNumber(item['Subestacion_Id'] ?? item['subestacion_Id']),
          Subestacion_Nombre: this.getFirstNonEmptyText(item, ['Subestacion_Nombre', 'subestacion_Nombre', 'Subestacion_Des', 'subestacion_Des'])
        })).filter(x => x.Subestacion_Id > 0 || x.Subestacion_Nombre !== '');
        this.subestacionesFiltradas = [...this.subestaciones];
        this.cargandoSubestaciones = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.subestaciones = [];
        this.subestacionesFiltradas = [];
        this.cargandoSubestaciones = false;
      }
    });
  }

  private cargarMotivos(): void {
    this.cargandoMotivos = true;
    this.apiService.getListarMotivos().subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.motivos = raw.map(item => ({
          Motivo_Id: this.toNumber(item['Id'] ?? item['id'] ?? item['Motivo_Id'] ?? item['motivo_Id']),
          Motivo_Nombre: this.getFirstNonEmptyText(item, ['Nombre', 'nombre', 'Motivo_Nombre', 'motivo_Nombre', 'Motivo_Des', 'motivo_Des'])
        }));
        this.cargandoMotivos = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.motivos = [];
        this.cargandoMotivos = false;
      }
    });
  }

  private cargarClimas(): void {
    this.cargandoClimas = true;
    this.apiService.getListarClimas().subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.climas = raw.map(item => ({
          Clima_Id: this.toNumber(item['Id'] ?? item['id'] ?? item['Clima_Id'] ?? item['clima_Id']),
          Clima_Nombre: this.getFirstNonEmptyText(item, ['Nombre', 'nombre', 'Clima_Nombre', 'clima_Nombre', 'Clima_Des', 'clima_Des', 'Clima', 'clima'])
        }));
        this.cargandoClimas = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.climas = [];
        this.cargandoClimas = false;
      }
    });
  }

  private cargarTareas(): void {
    this.cargandoTareas = true;
    this.apiService.getListarTareas().subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.tareas = raw.map(item => ({
          Tarea_Id: this.toNumber(item['Id'] ?? item['id'] ?? item['Tarea_Id'] ?? item['tarea_Id']),
          Tarea_Nombre: this.getFirstNonEmptyText(item, ['Nombre', 'nombre', 'Tarea_Nombre', 'tarea_Nombre', 'Tarea_Des', 'tarea_Des'])
        }));
        this.cargandoTareas = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.tareas = [];
        this.cargandoTareas = false;
      }
    });
  }

  private cargarSubContratas(): void {
    this.cargandoSubContratas = true;
    this.apiService.getListarSubContratas().subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.subContratas = raw.map(item => ({
          SubContrata_Id: this.toNumber(item['SubContrata_Id'] ?? item['subContrata_Id'] ?? item['SubContrata'] ?? item['subContrata']),
          SubContrata_Nombre: this.getFirstNonEmptyText(item, ['SubContrata_Nombre', 'subContrata_Nombre', 'SubContrata_Des', 'subContrata_Des', 'SubContrata'])
        }));
        this.cargandoSubContratas = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.subContratas = [];
        this.cargandoSubContratas = false;
      }
    });
  }

  private cargarJefesArea(): void {
    this.cargandoJefesArea = true;
    this.apiService.getListarJefesArea().subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.jefesArea = raw.map(item => ({
          Usr_Cod: this.getFirstNonEmptyText(item, ['Usr_Cod', 'usr_Cod']),
          Usr_Nom: this.getFirstNonEmptyText(item, ['Usr_Nom', 'usr_Nom'])
        })).filter(x => !!x.Usr_Cod);
        this.cargandoJefesArea = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.jefesArea = [];
        this.cargandoJefesArea = false;
      }
    });
  }

  private cargarDatosObservacionSeleccionada(codigoObs: string): void {
    this.cargandoObservacion = true;
    this.apiService.getMostrarObservacionPlaneada(codigoObs).subscribe({
      next: (response: unknown) => {
        this.observacionEdicionBase = this.extractFirstRecord(response);
        this.cargandoObservacion = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.observacionEdicionBase = null;
        this.cargandoObservacion = false;
      }
    });
  }

  private aplicarDatosEdicion(): void {
    if (!this.observacionEdicionBase) {
      return;
    }

    const record = this.observacionEdicionBase;

    const clienteId = this.toNumber(this.getRecordValue(record, ['Cliente_Id', 'cliente_Id']));
    if (clienteId > 0) {
      const cliente = this.clientes.find(item => item.Cliente_Id === clienteId) ?? {
        Cliente_Id: clienteId,
        Cliente_Nombre: this.getRecordValue(record, ['Cliente_Nombre', 'cliente_Nombre']) || `Cliente ${clienteId}`
      };
      this.clienteSeleccionado = cliente;
      this.observacionForm.patchValue({ cliente: clienteId });

      if (!this.subestaciones.length && !this.cargandoSubestaciones) {
        this.cargarSubestaciones(clienteId);
      }
    }

    const subestacionNombre = this.getRecordValue(record, ['Subestacion_Nombre', 'subestacion_Nombre']);
    if (subestacionNombre) {
      const subestacion = this.subestaciones.find(item =>
        this.normalizarTexto(item.Subestacion_Nombre) === this.normalizarTexto(subestacionNombre)
      ) ?? null;
      if (subestacion) {
        this.subestacionSeleccionada = subestacion;
        this.observacionForm.patchValue({ subestacion: subestacion.Subestacion_Id });
      }
    }

    const subContrataNombre = this.getRecordValue(record, ['SubContrata_Nombre', 'subContrata_Nombre']);
    if (subContrataNombre) {
      const subContrata = this.subContratas.find(item =>
        this.normalizarTexto(item.SubContrata_Nombre) === this.normalizarTexto(subContrataNombre)
      ) ?? null;
      if (subContrata) {
        this.subContrataSeleccionada = subContrata;
        this.observacionForm.patchValue({ subcontrata: subContrata.SubContrata_Id });
      }
    }

    // FIX: ahora el backend devuelve Jef_Nombre (alias) y Jefe_Cod
    const jefeNombre = this.getRecordValue(record, ['Jef_Nombre', 'jef_Nombre']);
    const jefeCod = this.getRecordValue(record, ['Jefe_Cod', 'jefe_Cod', 'Jef_Cod', 'jef_Cod']);
    if (jefeNombre || jefeCod) {
      const jefeArea = this.jefesArea.find(item =>
        (jefeCod && item.Usr_Cod === jefeCod) ||
        (jefeNombre && this.normalizarTexto(item.Usr_Nom) === this.normalizarTexto(jefeNombre))
      ) ?? null;
      if (jefeArea) {
        this.jefeAreaSeleccionado = jefeArea;
        this.observacionForm.patchValue({
          jefeEquipo: jefeArea.Usr_Cod,
          // FIX: el área del jefe viene como Jef_Area (alias), el DNI como Jef_DNI
          areaJefeEquipo: this.getRecordValue(record, ['Jef_Area', 'jef_Area', 'Cen_Cos_Des', 'cen_Cos_Des']),
          dniJefeEquipo: this.getRecordValue(record, ['Jef_DNI', 'jef_DNI', 'Usr_Doc_Nro', 'usr_Doc_Nro'])
        });
      }
    }

    const motivoNombre = this.getRecordValue(record, ['Motivo_Nombre', 'motivo_Nombre']);
    if (motivoNombre) {
      const motivo = this.motivos.find(item =>
        this.normalizarTexto(item.Motivo_Nombre) === this.normalizarTexto(motivoNombre)
      ) ?? null;
      if (motivo) {
        this.motivoSeleccionado = motivo;
        this.observacionForm.patchValue({ motivo: motivo.Motivo_Id });
      }
    }

    const climaNombre = this.getRecordValue(record, ['Clima_Nombre', 'clima_Nombre']);
    if (climaNombre) {
      const clima = this.climas.find(item =>
        this.normalizarTexto(item.Clima_Nombre) === this.normalizarTexto(climaNombre)
      ) ?? null;
      if (clima) {
        this.climaSeleccionado = clima;
        this.observacionForm.patchValue({ clima: clima.Clima_Id });
      }
    }

    const tareaNombre = this.getRecordValue(record, ['Tarea_Nombre', 'tarea_Nombre']);
    if (tareaNombre) {
      const tarea = this.tareas.find(item =>
        this.normalizarTexto(item.Tarea_Nombre) === this.normalizarTexto(tareaNombre)
      ) ?? null;
      if (tarea) {
        this.tareaSeleccionada = tarea;
        this.observacionForm.patchValue({ tipoTarea: tarea.Tarea_Id });
      }
    }

    this.observacionForm.patchValue({
      detalleMotivo: this.getRecordValue(record, ['Obs_Detalle', 'obs_Detalle']),
      actividadObservada: this.getRecordValue(record, ['Obs_Actividad', 'obs_Actividad']),
      estado: (this.getRecordValue(record, ['Estado', 'estado']) || 'A') as 'A' | 'I'
    });
  }

  private cargarDatosObservador(): void {
    const usrCod = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usrCod) {
      return;
    }

    this.apiService.getConsultaDatosUsuario({ Usr_Cod: usrCod }).subscribe({
      next: (response: unknown) => {
        const record = this.extractFirstRecord(response);
        this.observador = {
          nombre: this.getRecordValue(record, ['usr_Nom', 'Usr_Nom']) || this.authService.getCurrentUserName(),
          cargo: this.getRecordValue(record, ['cargo_Nombre', 'cargoNombre', 'Cargo_Nombre']),
          area: this.getRecordValue(record, ['cen_Cos_Des', 'Cen_Cos_Des', 'areaDescripcion', 'Area_Des']),
          dni: this.getRecordValue(record, ['usr_Doc_Nro', 'Usr_Doc_Nro', 'dni', 'DNI'])
        };
      },
      error: () => {
        this.observador = { nombre: usrCod, cargo: '', area: '', dni: '' };
      }
    });
  }

  guardarObservacion(): void {
    if (this.modoEdicion) {
      this.actualizarObservacion();
      return;
    }

    this.registrarObservacion();
  }

  registrarObservacion(): void {
    if (this.registrandoObservacion) {
      return;
    }

    const valores = this.obtenerValoresFormularioComunes(
      'Completa todos los campos antes de registrar la observación planeada.'
    );
    if (!valores) {
      return;
    }

    const payload: RegistrarObservacionPlaneadaRequest = {
      Usr_Cod: valores.usrCodTexto,
      Cliente_Id: valores.clienteId,
      Subestacion_Id: valores.subestacionId,
      SubContrata_Id: valores.subContrataId,
      Jefe_Cod: valores.jefeCod,
      Motivo_Id: valores.motivoId,
      Clima_Id: valores.climaId,
      Tarea_Id: valores.tareaId,
      Obs_Detalle: valores.obsDetalle,
      Obs_Actividad: valores.obsActividad,
      Usr_Reg: valores.usrCodTexto
    };

    this.registrandoObservacion = true;
    this.apiService.registrarObservacionPlaneada(payload).subscribe({
      next: (response: unknown) => {
        this.registrandoObservacion = false;
        const success = this.esRespuestaExitosa(response);

        if (success) {
          this.volverSinConfirmacion();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo registrar la observación planeada.');
        }
      },
      error: (error: unknown) => {
        this.registrandoObservacion = false;
        alert(this.getErrorMessage(error, 'No se pudo registrar la observación planeada.'));
      }
    });
  }

  actualizarObservacion(): void {
    if (this.registrandoObservacion) {
      return;
    }

    const codigoObs = (this.codigoObsSeleccionado ?? '').trim();
    if (!codigoObs) {
      alert('No se encontró el código de la observación a actualizar.');
      return;
    }

    const valores = this.obtenerValoresFormularioComunes(
      'Completa todos los campos antes de actualizar la observación planeada.'
    );
    if (!valores) {
      return;
    }

    const payload: ActualizarObservacionPlaneadaRequest = {
      Codigo_Obs: codigoObs,
      Cliente_Id: valores.clienteId,
      Subestacion_Id: valores.subestacionId,
      SubContrata_Id: valores.subContrataId,
      Jefe_Cod: valores.jefeCod,
      Motivo_Id: valores.motivoId,
      Clima_Id: valores.climaId,
      Tarea_Id: valores.tareaId,
      Obs_Detalle: valores.obsDetalle,
      Obs_Actividad: valores.obsActividad,
      Estado: valores.estado,
      Usr_Mod: valores.usrCodTexto
    };

    this.registrandoObservacion = true;
    this.apiService.actualizarObservacionPlaneada(payload).subscribe({
      next: (response: unknown) => {
        this.registrandoObservacion = false;
        const success = this.esRespuestaExitosa(response);

        if (success) {
          this.volverSinConfirmacion();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo actualizar la observación planeada.');
        }
      },
      error: (error: unknown) => {
        this.registrandoObservacion = false;
        alert(this.getErrorMessage(error, 'No se pudo actualizar la observación planeada.'));
      }
    });
  }

  private obtenerValoresFormularioComunes(mensajeError: string): ObservacionFormularioValores | null {
    const usrCodTexto = this.authService.getCurrentUser().trim();

    if (!usrCodTexto) {
      alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.');
      return null;
    }

    const clienteId = this.clienteSeleccionado?.Cliente_Id ?? 0;
    const subestacionId = this.subestacionSeleccionada?.Subestacion_Id ?? 0;
    const subContrataId = this.subContrataSeleccionada?.SubContrata_Id ?? 0;
    const jefeCod = (this.jefeAreaSeleccionado?.Usr_Cod ?? '').trim();
    const motivoId = this.motivoSeleccionado?.Motivo_Id ?? 0;
    const climaId = this.climaSeleccionado?.Clima_Id ?? 0;
    const tareaId = this.tareaSeleccionada?.Tarea_Id ?? 0;
    const obsDetalle = (this.observacionForm.get('detalleMotivo')?.value ?? '').toString().trim();
    const obsActividad = (this.observacionForm.get('actividadObservada')?.value ?? '').toString().trim();
    const estado = ((this.observacionForm.get('estado')?.value ?? 'A').toString().trim() || 'A') as 'A' | 'I';

    if (!clienteId || !subestacionId || !subContrataId || !jefeCod || !motivoId || !climaId || !tareaId || !obsDetalle || !obsActividad) {
      alert(mensajeError);
      return null;
    }

    return {
      usrCodTexto,
      clienteId,
      subestacionId,
      subContrataId,
      jefeCod,
      motivoId,
      climaId,
      tareaId,
      obsDetalle,
      obsActividad,
      estado
    };
  }

  private esRespuestaExitosa(response: unknown): boolean {
    if (response && typeof response === 'object') {
      const record = response as Record<string, unknown>;
      if (record['success'] !== undefined) {
        return record['success'] === true;
      }
      if (record['Success'] !== undefined) {
        return record['Success'] === true;
      }
    }

    return true;
  }

  private getRespuestaMensaje(response: unknown): string {
    if (response && typeof response === 'object') {
      const record = response as Record<string, unknown>;
      for (const key of ['message', 'Message']) {
        const value = record[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          return String(value);
        }
      }
    }

    return '';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const errorBody = record['error'];
      if (errorBody && typeof errorBody === 'object') {
        const bodyRecord = errorBody as Record<string, unknown>;
        for (const key of ['message', 'Message']) {
          const value = bodyRecord[key];
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value);
          }
        }
      }

      for (const key of ['message', 'Message']) {
        const value = record[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          return String(value);
        }
      }
    }

    return fallback;
  }

  private extraerLista<T>(response: unknown): T[] {
    if (Array.isArray(response)) {
      return response as T[];
    }

    if (response && typeof response === 'object') {
      const anyResponse = response as Record<string, unknown>;
      const candidates = [
        anyResponse['Elements'],
        anyResponse['elements'],
        anyResponse['Data'],
        anyResponse['data'],
        anyResponse['Result'],
        anyResponse['result']
      ];

      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          return candidate as T[];
        }
      }
    }

    return [];
  }

  private extractFirstRecord(response: unknown): Record<string, unknown> {
    const lista = this.extraerLista<Record<string, unknown>>(response);
    return lista.length > 0 ? lista[0] : {};
  }

  private getRecordValue(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }
    return '';
  }

  private getFirstNonEmptyText(record: Record<string, unknown>, keys: string[]): string {
    return this.getRecordValue(record, keys).trim();
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null || value === '') {
      return 0;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? 0 : numeric;
  }
}
