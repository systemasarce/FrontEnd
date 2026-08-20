
import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../confirmacion-accion-dialog.component';

interface InsCliente { Cliente_Id: number; Cliente_Nombre: string; }
interface InsSubEstacion { Subestacion_Id: number; Subestacion_Nombre: string; }
interface UsuarioCombo { Usr_Cod: string; Usr_Nom: string; }
interface TipoRiesgo { Tipo_Riesgo_Id: number; Tipo_Riesgo: string; }

type ComboKey = 'cliente' | 'subestacion' | 'supervisor' | 'inspector' | 'riesgo';

interface DatosPersonal { nombre: string; cargo: string; area: string; }

@Component({
  selector: 'app-stop-report',
  templateUrl: './inspeccion-stop-report.component.html',
  styleUrls: ['./inspeccion-stop-report.component.scss'],
})
export class InspeccionStopReportComponent implements OnInit {
  @Output() volver = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  @Input() modoEdicion = false;
  @Input() stopReportId: number | null = null;
  @Input() weReportCod: string | null = null;

  personal: DatosPersonal = { nombre: '', cargo: '', area: '' };
  readonly form: FormGroup;

  clientes: InsCliente[] = [];
  subestaciones: InsSubEstacion[] = [];
  supervisores: UsuarioCombo[] = [];
  inspectores: UsuarioCombo[] = [];
  tiposRiesgo: TipoRiesgo[] = [];

  clienteSeleccionado: InsCliente | null = null;
  subestacionSeleccionada: InsSubEstacion | null = null;
  supervisorSeleccionado: UsuarioCombo | null = null;
  inspectorSeleccionado: UsuarioCombo | null = null;
  tipoRiesgoSeleccionado: TipoRiesgo | null = null;

  cargandoSubestaciones = false;
  cargandoSupervisores = false;
  cargandoInspectores = false;
  cargandoTiposRiesgo = false;
  cargandoEdicion = false;
  guardando = false;

  comboOpen: Record<ComboKey, boolean> = {
    cliente: false,
    subestacion: false,
    supervisor: false,
    inspector: false,
    riesgo: false,
  };

  comboSearch: Record<ComboKey, string> = {
    cliente: '',
    subestacion: '',
    supervisor: '',
    inspector: '',
    riesgo: '',
  };

  private edicionBase: Record<string, unknown> | null = null;
  // FIX: cada carga de combo (clientes, subestaciones, supervisores, inspectores, riesgos)
  // invoca aplicarDatosEdicion() al terminar. Sin esta guarda, cada vez que el usuario
  // cambiaba un combo (p.ej. Cliente -> dispara recarga de Subestaciones -> vuelve a llamar
  // aplicarDatosEdicion) el método volvía a aplicar los valores ORIGINALES de edicionBase,
  // deshaciendo la selección recién hecha por el usuario. Ahora cada campo solo se aplica
  // una vez de forma automática; después de eso el usuario tiene control total del combo.
  private edicionFormAplicado = false;
  private edicionCombosAplicados: Record<ComboKey, boolean> = {
    cliente: false,
    subestacion: false,
    supervisor: false,
    inspector: false,
    riesgo: false,
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly dialog: MatDialog,
  ) {
    this.form = this.fb.group({
      weReportCod: [''],
      ot: ['', Validators.required],
      trabajoAsignado: ['', Validators.required],
      procedimientoTrabajo: ['', Validators.required],
      inspectorTexto: ['', Validators.required],
      estado: ['A'],
    });
  }

  ngOnInit(): void {
    this.cargarDatosPersonal();
    this.cargarClientes();
    this.cargarSupervisoresResponsables();
    this.cargarInspectoresCliente();
    this.cargarTiposRiesgo();
    this.form.patchValue({ weReportCod: (this.weReportCod ?? '').trim() });

    if (this.modoEdicion && this.stopReportId) {
      this.cargarDatosEdicion(this.stopReportId);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as Node | null) || !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeCombos();
    }
  }

  retroceder(): void {
    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: this.modoEdicion ? 'Cancelar edición' : 'Cancelar Stop Report',
        mensaje: this.modoEdicion
          ? 'Se cancelará la edición del Stop Report. Esta acción cerrará el formulario actual.'
          : 'Se cancelará el registro del Stop Report. Esta acción cerrará el formulario actual.',
        textoConfirmar: 'Confirmar cancelación',
        textoCancelar: 'Volver',
        tipo: 'normal',
      },
    });
    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.volver.emit(); }
    });
  }

  guardar(): void {
    if (this.modoEdicion) {
      this.actualizar();
      return;
    }
    this.registrar();
  }

  private registrar(): void {
    if (this.guardando || !this.validarFormulario()) { return; }

    const usrCod = (this.authService.getCurrentUser?.() ?? '').trim();
    const codigoWeReport = String(this.form.get('weReportCod')?.value ?? this.weReportCod ?? '').trim();
    const weReportCod = codigoWeReport ? codigoWeReport : null;

    const payload: any = {
      We_Report_Cod: weReportCod,
      Usr_Cod: usrCod,
      Cliente_Id: this.clienteSeleccionado!.Cliente_Id,
      Subestacion_Id: this.subestacionSeleccionada!.Subestacion_Id,
      Supervisor_Cod: this.supervisorSeleccionado!.Usr_Cod,
      Stop_Supervisor: this.supervisorSeleccionado!.Usr_Cod,
      Inspector_Cod: String(this.form.get('inspectorTexto')?.value ?? '').trim(),
      Stop_Inspector: String(this.form.get('inspectorTexto')?.value ?? '').trim(),
      OT: String(this.form.get('ot')?.value ?? '').trim(),
      Stop_OP: String(this.form.get('ot')?.value ?? '').trim(),
      Trabajo_Asignado: String(this.form.get('trabajoAsignado')?.value ?? '').trim(),
      Stop_Trabajo: String(this.form.get('trabajoAsignado')?.value ?? '').trim(),
      Procedimiento_Trabajo: String(this.form.get('procedimientoTrabajo')?.value ?? '').trim(),
      Stop_Procedimiento: String(this.form.get('procedimientoTrabajo')?.value ?? '').trim(),
      Tipo_Riesgo_Id: this.tipoRiesgoSeleccionado!.Tipo_Riesgo_Id,
      Usr_Reg: usrCod,
    };

    this.guardando = true;
    this.apiService.postInsertarStopReport(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.volver.emit();
      },
      error: (err: unknown) => {
        this.guardando = false;
        console.error('Error al guardar Stop Report:', err);
        alert('Ocurrió un error al guardar. Intente nuevamente.');
      },
    });
  }

  private actualizar(): void {
    if (this.guardando) { return; }
    if (!this.stopReportId) {
      alert('No se encontró el ID del Stop Report a actualizar.');
      return;
    }
    if (!this.validarFormulario()) { return; }

    const usrCod = (this.authService.getCurrentUser?.() ?? '').trim();
    const estado = String(this.form.get('estado')?.value ?? 'A').toUpperCase() === 'I' ? 'I' : 'A';
    const codigoWeReport = String(this.form.get('weReportCod')?.value ?? this.weReportCod ?? '').trim();
    const weReportCod = codigoWeReport ? codigoWeReport : null;

    const payload: any = {
      Stop_Work_Id: this.stopReportId,
      We_Report_Cod: weReportCod,
      Usr_Cod: usrCod,
      Cliente_Id: this.clienteSeleccionado!.Cliente_Id,
      Subestacion_Id: this.subestacionSeleccionada!.Subestacion_Id,
      Supervisor_Cod: this.supervisorSeleccionado!.Usr_Cod,
      Stop_Supervisor: this.supervisorSeleccionado!.Usr_Cod,
      Inspector_Cod: String(this.form.get('inspectorTexto')?.value ?? '').trim(),
      Stop_Inspector: String(this.form.get('inspectorTexto')?.value ?? '').trim(),
      OT: String(this.form.get('ot')?.value ?? '').trim(),
      Stop_OP: String(this.form.get('ot')?.value ?? '').trim(),
      Trabajo_Asignado: String(this.form.get('trabajoAsignado')?.value ?? '').trim(),
      Stop_Trabajo: String(this.form.get('trabajoAsignado')?.value ?? '').trim(),
      Procedimiento_Trabajo: String(this.form.get('procedimientoTrabajo')?.value ?? '').trim(),
      Stop_Procedimiento: String(this.form.get('procedimientoTrabajo')?.value ?? '').trim(),
      Tipo_Riesgo_Id: this.tipoRiesgoSeleccionado!.Tipo_Riesgo_Id,
      Estado: estado as 'A' | 'I',
      Usr_Mod: usrCod,
    };

    this.guardando = true;
    this.apiService.putActualizarStopReport(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.volver.emit();
      },
      error: (err: unknown) => {
        this.guardando = false;
        console.error('Error al actualizar Stop Report:', err);
        alert('Ocurrió un error al actualizar. Intente nuevamente.');
      },
    });
  }

  private validarFormulario(): boolean {
    if (!this.clienteSeleccionado) { alert('Seleccione un Cliente.'); return false; }
    if (!this.subestacionSeleccionada) { alert('Seleccione una Subestación.'); return false; }
    // El código de We Report es opcional: solo se completa cuando el Stop Work
    // viene originado desde un We Report con "Aplica Stop Work = SI".
    if (!this.supervisorSeleccionado) { alert('Seleccione un Supervisor Responsable.'); return false; }
    if (!String(this.form.get('inspectorTexto')?.value ?? '').trim()) { alert('Ingrese el Inspector del Cliente.'); return false; }
    if (!this.form.get('ot')?.value) { alert('Ingrese OT.'); return false; }
    if (!this.form.get('trabajoAsignado')?.value) { alert('Ingrese Trabajo Asignado.'); return false; }
    if (!this.form.get('procedimientoTrabajo')?.value) { alert('Ingrese Procedimiento de Trabajo.'); return false; }
    if (!this.tipoRiesgoSeleccionado) { alert('Seleccione un Tipo de Riesgo.'); return false; }
    return true;
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
    (Object.keys(this.comboOpen) as ComboKey[]).forEach((k) => (this.comboOpen[k] = false));
  }

  onSearchChange(combo: ComboKey, event: Event): void {
    this.comboSearch[combo] = (event.target as HTMLInputElement).value ?? '';
  }

  selectCliente(cliente: InsCliente | null): void {
    this.clienteSeleccionado = cliente;
    this.subestacionSeleccionada = null;
    this.subestaciones = [];
    this.closeCombos();
    if (cliente) {
      this.cargarSubestaciones(cliente.Cliente_Id);
    }
  }

  selectSubestacion(subestacion: InsSubEstacion | null): void {
    this.subestacionSeleccionada = subestacion;
    this.closeCombos();
  }

  selectSupervisor(supervisor: UsuarioCombo | null): void {
    this.supervisorSeleccionado = supervisor;
    this.closeCombos();
  }

  selectInspector(inspector: UsuarioCombo | null): void {
    this.inspectorSeleccionado = inspector;
    this.closeCombos();
  }

  selectTipoRiesgo(tipo: TipoRiesgo | null): void {
    this.tipoRiesgoSeleccionado = tipo;
    this.closeCombos();
  }

  get personalDisplay(): string { return this.personal.nombre || 'Seleccione'; }
  get cargoDisplay(): string { return this.personal.cargo || 'Seleccione'; }
  get areaDisplay(): string { return this.personal.area || 'Seleccione'; }
  get clienteDisplay(): string { return this.clienteSeleccionado?.Cliente_Nombre || 'Seleccione'; }
  get subestacionDisplay(): string {
    if (!this.clienteSeleccionado) { return 'Primero seleccione cliente'; }
    return this.subestacionSeleccionada?.Subestacion_Nombre || 'Seleccione';
  }
  get supervisorDisplay(): string { return this.supervisorSeleccionado?.Usr_Nom || 'Seleccione'; }
  get inspectorDisplay(): string { return this.inspectorSeleccionado?.Usr_Nom || 'Seleccione'; }
  get tipoRiesgoDisplay(): string { return this.tipoRiesgoSeleccionado?.Tipo_Riesgo || 'Seleccione'; }

  get clientesFiltrados(): InsCliente[] { return this.filtrar(this.clientes, this.comboSearch.cliente, (i) => i.Cliente_Nombre); }
  get subestacionesFiltradas(): InsSubEstacion[] { return this.filtrar(this.subestaciones, this.comboSearch.subestacion, (i) => i.Subestacion_Nombre); }
  get supervisoresFiltrados(): UsuarioCombo[] { return this.filtrar(this.supervisores, this.comboSearch.supervisor, (i) => i.Usr_Nom); }
  get inspectoresFiltrados(): UsuarioCombo[] { return this.filtrar(this.inspectores, this.comboSearch.inspector, (i) => i.Usr_Nom); }
  get tiposRiesgoFiltrados(): TipoRiesgo[] { return this.filtrar(this.tiposRiesgo, this.comboSearch.riesgo, (i) => i.Tipo_Riesgo); }

  private cargarDatosPersonal(): void {
    const usrCod = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usrCod) { return; }

    this.apiService.getConsultaDatosUsuario({ Usr_Cod: usrCod }).subscribe({
      next: (response: unknown) => {
        const record = this.extractFirstRecord(response);
        this.personal = {
          nombre: this.getVal(record, ['Usr_Nom', 'usr_Nom']) || this.authService.getCurrentUserName(),
          cargo: this.getVal(record, ['Cargo_Nombre', 'cargo_Nombre', 'cargoNombre']),
          area: this.getVal(record, ['Cen_Cos_Des', 'cen_Cos_Des', 'Area_Des']),
        };
      },
      error: () => {
        this.personal = { nombre: usrCod, cargo: '', area: '' };
      },
    });
  }

  private cargarClientes(): void {
    this.apiService.getListarInsClientes().subscribe({
      next: (response: unknown) => {
        this.clientes = this.extraerLista<Record<string, unknown>>(response)
          .map((item) => ({
            Cliente_Id: this.toNum(item['Cliente_Id'] ?? item['cliente_Id']),
            Cliente_Nombre: this.getVal(item, ['Cliente_Nombre', 'cliente_Nombre']),
          }))
          .filter((item) => item.Cliente_Id > 0);
        this.aplicarDatosEdicion();
      },
      error: () => { this.clientes = []; },
    });
  }

  private cargarSubestaciones(clienteId: number): void {
    this.cargandoSubestaciones = true;
    this.apiService.getSubEstacionesPorCliente(clienteId).subscribe({
      next: (response: unknown) => {
        this.subestaciones = this.extraerLista<Record<string, unknown>>(response)
          .map((item) => ({
            Subestacion_Id: this.toNum(item['Subestacion_Id'] ?? item['subestacion_Id']),
            Subestacion_Nombre: this.getVal(item, ['Subestacion_Nombre', 'subestacion_Nombre']),
          }))
          .filter((item) => item.Subestacion_Id > 0);
        this.cargandoSubestaciones = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.subestaciones = [];
        this.cargandoSubestaciones = false;
      },
    });
  }
  
  private cargarSupervisoresResponsables(): void {
    this.cargandoSupervisores = true;
    this.apiService.getListarSupervisoresResponsables().subscribe({
      next: (response: unknown) => {
        this.supervisores = this.extraerLista<Record<string, unknown>>(response)
          .map((item) => ({
            Usr_Cod: this.getVal(item, ['Usr_Cod', 'usr_Cod']),
            Usr_Nom: this.getVal(item, ['Usr_Nom', 'usr_Nom']),
          }))
          .filter((item) => !!item.Usr_Cod);
        this.cargandoSupervisores = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.supervisores = [];
        this.cargandoSupervisores = false;
      },
    });
  }

  private cargarInspectoresCliente(): void {
    this.cargandoInspectores = true;
    this.apiService.getListarInspectoresCliente().subscribe({
      next: (response: unknown) => {
        this.inspectores = this.extraerLista<Record<string, unknown>>(response)
          .map((item) => ({
            Usr_Cod: this.getVal(item, ['Usr_Cod', 'usr_Cod']),
            Usr_Nom: this.getVal(item, ['Usr_Nom', 'usr_Nom']),
          }))
          .filter((item) => !!item.Usr_Cod);
        this.cargandoInspectores = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.inspectores = [];
        this.cargandoInspectores = false;
      },
    });
  }

  private cargarTiposRiesgo(): void {
    this.cargandoTiposRiesgo = true;
    this.apiService.getListarTiposRiesgo().subscribe({
      next: (response: unknown) => {
        this.tiposRiesgo = this.extraerLista<Record<string, unknown>>(response)
          .map((item) => ({
            Tipo_Riesgo_Id: this.toNum(item['Tipo_Riesgo_Id'] ?? item['tipo_Riesgo_Id']),
            Tipo_Riesgo: this.getVal(item, ['Tipo_Riesgo', 'tipo_Riesgo']),
          }))
          .filter((item) => item.Tipo_Riesgo_Id > 0);
        this.cargandoTiposRiesgo = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.tiposRiesgo = [];
        this.cargandoTiposRiesgo = false;
      },
    });
  }

  private cargarDatosEdicion(id: number): void {
    this.cargandoEdicion = true;
    this.apiService.getMostrarStopReport(id).subscribe({
      next: (response: unknown) => {
        this.edicionBase = this.extractFirstRecord(response);
        this.cargandoEdicion = false;
        this.aplicarDatosEdicion();
      },
      error: () => {
        this.edicionBase = null;
        this.cargandoEdicion = false;
      },
    });
  }

  private aplicarDatosEdicion(): void {
    if (!this.edicionBase) { return; }
    const r = this.edicionBase;

    if (!this.edicionFormAplicado) {
      this.form.patchValue({
        weReportCod: this.getVal(r, ['We_Report_Cod', 'Codigo_We_Report', 'we_Report_Cod']) || this.weReportCod || '',
        ot: this.getVal(r, ['OT', 'Ot', 'ot', 'Orden_Trabajo', 'orden_Trabajo']),
        trabajoAsignado: this.getVal(r, ['Trabajo_Asignado', 'trabajo_Asignado']),
        procedimientoTrabajo: this.getVal(r, ['Procedimiento_Trabajo', 'procedimiento_Trabajo']),
        inspectorTexto: this.getVal(r, ['Stop_Inspector', 'Inspector_Nom', 'Inspector_Cod', 'inspector_Nom', 'inspector_Cod']),
        estado: this.getVal(r, ['Estado', 'estado']) || 'A',
      });
      this.edicionFormAplicado = true;
    }

    if (!this.edicionCombosAplicados.cliente) {
      const clienteNombre = this.getVal(r, ['Cliente_Nombre', 'cliente_Nombre']);
      if (clienteNombre && this.clientes.length) {
        const cliente = this.clientes.find((x) => this.norm(x.Cliente_Nombre) === this.norm(clienteNombre)) ?? null;
        if (cliente) {
          this.clienteSeleccionado = cliente;
          this.edicionCombosAplicados.cliente = true;
          if (!this.subestaciones.length && !this.cargandoSubestaciones) {
            this.cargarSubestaciones(cliente.Cliente_Id);
          }
        }
      }
    }

    if (!this.edicionCombosAplicados.subestacion) {
      const subNombre = this.getVal(r, ['Subestacion_Nombre', 'subestacion_Nombre']);
      if (subNombre && this.subestaciones.length) {
        const sub = this.subestaciones.find((x) => this.norm(x.Subestacion_Nombre) === this.norm(subNombre)) ?? null;
        if (sub) {
          this.subestacionSeleccionada = sub;
          this.edicionCombosAplicados.subestacion = true;
        }
      }
    }

    if (!this.edicionCombosAplicados.supervisor) {
      const supervisorCod = this.getVal(r, ['Supervisor_Cod', 'supervisor_Cod']);
      const supervisorNombre = this.getVal(r, ['Supervisor_Nom', 'supervisor_Nom']);
      if ((supervisorCod || supervisorNombre) && this.supervisores.length) {
        const item = this.supervisores.find((x) =>
          (supervisorCod && x.Usr_Cod === supervisorCod) ||
          (supervisorNombre && this.norm(x.Usr_Nom) === this.norm(supervisorNombre))
        ) ?? null;
        if (item) {
          this.supervisorSeleccionado = item;
          this.edicionCombosAplicados.supervisor = true;
        }
      }
    }

    if (!this.edicionCombosAplicados.inspector) {
      const inspectorCod = this.getVal(r, ['Inspector_Cod', 'inspector_Cod']);
      const inspectorNombre = this.getVal(r, ['Inspector_Nom', 'inspector_Nom']);
      if ((inspectorCod || inspectorNombre) && this.inspectores.length) {
        const item = this.inspectores.find((x) =>
          (inspectorCod && x.Usr_Cod === inspectorCod) ||
          (inspectorNombre && this.norm(x.Usr_Nom) === this.norm(inspectorNombre))
        ) ?? null;
        if (item) {
          this.inspectorSeleccionado = item;
          this.edicionCombosAplicados.inspector = true;
        }
      }
    }

    if (!this.edicionCombosAplicados.riesgo) {
      const tipoNombre = this.getVal(r, ['Tipo_Riesgo', 'tipo_Riesgo']);
      if (tipoNombre && this.tiposRiesgo.length) {
        const item = this.tiposRiesgo.find((x) => this.norm(x.Tipo_Riesgo) === this.norm(tipoNombre)) ?? null;
        if (item) {
          this.tipoRiesgoSeleccionado = item;
          this.edicionCombosAplicados.riesgo = true;
        }
      }
    }
  }

  private filtrar<T>(list: T[], term: string, fn: (i: T) => string): T[] {
    const t = this.norm(term.trim());
    return t ? list.filter((i) => this.norm(fn(i)).includes(t)) : list;
  }

  private norm(v: string): string {
    return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  private extraerLista<T>(response: unknown): T[] {
    if (Array.isArray(response)) { return response as T[]; }
    if (response && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      for (const k of ['Elements', 'elements', 'Data', 'data', 'Result', 'result', 'items', 'Items']) {
        if (Array.isArray(r[k])) { return r[k] as T[]; }
      }
    }
    return [];
  }

  private extractFirstRecord(response: unknown): Record<string, unknown> {
    const list = this.extraerLista<Record<string, unknown>>(response);
    return list.length > 0 ? list[0] : {};
  }

  private getVal(record: Record<string, unknown>, keys: string[]): string {
    for (const k of keys) {
      const v = record[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') { return String(v).trim(); }
    }
    return '';
  }

  private toNum(value: unknown): number {
    if (value === undefined || value === null || value === '') { return 0; }
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
}
