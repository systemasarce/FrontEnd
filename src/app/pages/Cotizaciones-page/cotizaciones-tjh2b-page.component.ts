import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of, startWith, Subscription } from 'rxjs';

import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../inspecciones-page/confirmacion-accion-dialog.component';
import { CotizacionesCancelDialogComponent } from './cotizaciones-cancel-dialog.component';
import { CotizacionesArchivoDialogComponent } from './cotizaciones-archivo-dialog.component';
import { ClienteTjh2bService } from '../inspecciones/cliente-tjh2b/cliente-tjh2b.service';
import { CotizacionTjh2bFilter, CotizacionTjh2bItem } from './cotizaciones-tjh2b.model';
import { CotizacionesTjh2bService } from './cotizaciones-tjh2b.service';

type DataRecord = Record<string, unknown>;

interface ClienteTjh2bOption {
  Cliente_Id: number;
  Cliente_Nombre: string;
}

interface CotizacionPdfAdjunto {
  id: string;
  nombre: string;
  ruta: string;
  esArchivoLocal: boolean;
  archivo?: File;
}

@Component({
  selector: 'app-cotizaciones-tjh2b-page',
  templateUrl: './cotizaciones-tjh2b-page.component.html',
  styleUrls: ['./cotizaciones-tjh2b-page.component.scss']
})
export class CotizacionesTjh2bPageComponent implements OnInit, OnDestroy {
  readonly filtrosForm: FormGroup;
  readonly form: FormGroup;

  clientes: ClienteTjh2bOption[] = [];
  clientesFiltrados: ClienteTjh2bOption[] = [];
  cotizaciones: CotizacionTjh2bItem[] = [];
  archivosPdf: CotizacionPdfAdjunto[] = [];
  mostrarPanel = false;
  editando = false;
  cargando = false;
  cargandoClientes = false;
  guardando = false;
  errorMessage = '';
  archivoActual = '';
  abriendoArchivoId: number | null = null;

  clienteComboOpen = false;
  clienteComboSearch = '';
  clienteSeleccionado: ClienteTjh2bOption | null = null;

  private clienteBusquedaSubscription?: Subscription;
  private filtroActual: CotizacionTjh2bFilter = {
    Numero: '',
    ClienteNombre: '',
    Servicio: '',
    EstadoCotizacion: '',
    Estado: 'A'
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly clienteService: ClienteTjh2bService,
    private readonly cotizacionService: CotizacionesTjh2bService
  ) {
    this.filtrosForm = this.fb.group({
      Numero: [''],
      ClienteNombre: [''],
      Servicio: [''],
      FechaFiltroTipo: [''],
      FechaFiltroValor: [null],
      EstadoCotizacion: [''],
      Estado: ['A']
    });

    this.form = this.fb.group({
      Cotizacion_Id: [0],
      Cotizacion_Numero: ['', [Validators.required]],
      Cliente_Id: [0, [Validators.required]],
      Cliente_Busqueda: [''],
      Cotizacion_Servicio: ['', [Validators.required]],
      Cotizacion_FechaIni: [this.fechaHoyDate(), [Validators.required]],
      Cotizacion_FechaFin: [this.fechaHoyDate(), [Validators.required]],
      Cotizacion_DocumentoPDF: [''],
      Cotizacion_Estado: ['P'],
      Estado: ['A']
    });
  }

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarCotizaciones();
  }

  ngOnDestroy(): void {
    this.clienteBusquedaSubscription?.unsubscribe();
    this.liberarUrlsAdjuntos();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(target)) {
      this.clienteComboOpen = false;
    }
  }

  get clienteDisplay(): string {
    return this.clienteSeleccionado?.Cliente_Nombre?.trim() || 'Seleccionar';
  }

  toggleClienteCombo(): void {
    this.clienteComboOpen = !this.clienteComboOpen;

    if (this.clienteComboOpen) {
      this.clienteComboSearch = '';
      this.clientesFiltrados = [...this.clientes];
    }
  }

  onClienteSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.clienteComboSearch = String(input?.value ?? '');
    this.clientesFiltrados = this.filtrarClientes(this.clienteComboSearch);
  }

  get fechaFiltroTipo(): string {
    return String(this.filtrosForm.get('FechaFiltroTipo')?.value ?? '').trim();
  }

  get mostrarFechaFiltro(): boolean {
    return this.fechaFiltroTipo === 'FECHA_INICIO' || this.fechaFiltroTipo === 'FECHA_FIN';
  }

  get etiquetaFechaFiltro(): string {
    if (this.fechaFiltroTipo === 'FECHA_FIN') {
      return 'Fecha fin';
    }

    return 'Fecha inicio';
  }

  onFechaFiltroTipoChange(): void {
    if (!this.fechaFiltroTipo) {
      this.filtrosForm.patchValue({
        FechaFiltroValor: null
      }, { emitEvent: false });
    }
  }

  seleccionarCliente(cliente: ClienteTjh2bOption | null): void {
    if (!cliente) {
      this.clienteSeleccionado = null;
      this.clienteComboSearch = '';
      this.clientesFiltrados = [...this.clientes];
      this.clienteComboOpen = false;
      this.form.patchValue({
        Cliente_Id: 0,
        Cliente_Busqueda: ''
      }, { emitEvent: false });
      return;
    }

    this.clienteSeleccionado = cliente;
    this.clienteComboSearch = '';
    this.clientesFiltrados = [...this.clientes];
    this.clienteComboOpen = false;

    this.form.patchValue({
      Cliente_Id: cliente.Cliente_Id,
      Cliente_Busqueda: cliente.Cliente_Nombre
    }, { emitEvent: false });
  }

  private sincronizarClienteSeleccionado(): void {
    const clienteId = this.toNumber(this.form.get('Cliente_Id')?.value) ?? 0;
    const clienteNombre = String(this.form.get('Cliente_Busqueda')?.value ?? '').trim();

    if (!clienteId) {
      this.clienteSeleccionado = clienteNombre ? { Cliente_Id: 0, Cliente_Nombre: clienteNombre } : null;
      return;
    }

    const cliente = this.clientes.find((item) => item.Cliente_Id === clienteId)
      ?? (clienteNombre ? { Cliente_Id: clienteId, Cliente_Nombre: clienteNombre } : null);

    this.clienteSeleccionado = cliente;
  }

  abrirNuevo(): void {
    this.editando = false;
    this.mostrarPanel = true;
    this.errorMessage = '';
    this.archivoActual = '';
    this.liberarUrlsAdjuntos();
    this.archivosPdf = [];
    this.clienteComboOpen = false;
    this.clienteComboSearch = '';
    this.clienteSeleccionado = null;

    this.form.reset({
      Cotizacion_Id: 0,
      Cotizacion_Numero: '',
      Cliente_Id: 0,
      Cliente_Busqueda: '',
      Cotizacion_Servicio: '',
      Cotizacion_FechaIni: this.fechaHoyDate(),
      Cotizacion_FechaFin: this.fechaHoyDate(),
      Cotizacion_DocumentoPDF: '',
      Cotizacion_Estado: 'P',
      Estado: 'A'
    });
    this.clientesFiltrados = [...this.clientes];
  }

  editarCotizacion(item: CotizacionTjh2bItem): void {
    if (item.id === null) {
      return;
    }

    this.editando = true;
    this.mostrarPanel = true;
    this.errorMessage = '';
    this.archivoActual = '';
    this.liberarUrlsAdjuntos();
    this.archivosPdf = [];

    this.cotizacionService.consultarDatos(item.id).subscribe({
      next: (response: unknown) => {
        const row = this.extractFirstRecord(response);

        const clienteId = this.toNumber(this.getValue(row, ['Cliente_Id', 'cliente_Id'])) ?? item.clienteId ?? 0;
        const clienteNombre = this.getValue(row, ['Cliente_Nombre', 'cliente_Nombre', 'Nombre', 'nombre']) || item.clienteNombre || '';
        const documentoPdf = this.getValue(row, ['Cotizacion_DocumentoPDF', 'cotizacion_DocumentoPDF', 'documentoPdf', 'DocumentoPdf']) || '';

        this.form.patchValue({
          Cotizacion_Id: this.toNumber(this.getValue(row, ['Cotizacion_Id', 'cotizacion_Id', 'Id', 'id'])) ?? item.id ?? 0,
          Cotizacion_Numero: this.getValue(row, ['Cotizacion_Numero', 'cotizacion_Numero', 'Numero', 'numero']) || item.numero || '',
          Cliente_Id: clienteId,
          Cliente_Busqueda: clienteNombre,
          Cotizacion_Servicio: this.getValue(row, ['Cotizacion_Servicio', 'cotizacion_Servicio', 'Servicio', 'servicio']) || item.servicio || '',
          Cotizacion_FechaIni: this.parsearFechaFlexible(this.getValue(row, ['Cotizacion_FechaIni', 'cotizacion_FechaIni', 'fechaIni', 'FechaIni'])) ?? this.fechaHoyDate(),
          Cotizacion_FechaFin: this.parsearFechaFlexible(this.getValue(row, ['Cotizacion_FechaFin', 'cotizacion_FechaFin', 'fechaFin', 'FechaFin'])) ?? this.fechaHoyDate(),
          Cotizacion_DocumentoPDF: documentoPdf,
          Cotizacion_Estado: this.getValue(row, ['Cotizacion_Estado', 'cotizacion_Estado']) || 'P',
          Estado: this.getValue(row, ['Estado', 'estado']) || 'A'
        });

        this.form.get('Cliente_Busqueda')?.setValue(clienteNombre, { emitEvent: false });
        this.clienteComboOpen = false;
        this.clienteComboSearch = '';
        this.sincronizarClienteSeleccionado();
        this.cargarAdjuntosDesdeTexto(documentoPdf);
      },
      error: (error: unknown) => {
        console.error('Error consultando cotización', error);
        this.errorMessage = 'No se pudo cargar la información de la cotización.';
      }
    });
  }

  cerrarPanel(): void {
    this.mostrarPanel = false;
    this.editando = false;
    this.errorMessage = '';
    this.archivoActual = '';
    this.liberarUrlsAdjuntos();
    this.archivosPdf = [];
    this.clienteComboOpen = false;
    this.clienteComboSearch = '';
    this.clienteSeleccionado = null;
    this.form.reset({
      Cotizacion_Id: 0,
      Cotizacion_Numero: '',
      Cliente_Id: 0,
      Cliente_Busqueda: '',
      Cotizacion_Servicio: '',
      Cotizacion_FechaIni: this.fechaHoyDate(),
      Cotizacion_FechaFin: this.fechaHoyDate(),
      Cotizacion_DocumentoPDF: '',
      Cotizacion_Estado: 'P',
      Estado: 'A'
    });
    this.clientesFiltrados = [...this.clientes];
  }

  confirmarCancelacionCotizacion(): void {
    const dialogRef = this.dialog.open(CotizacionesCancelDialogComponent, {
      width: 'min(30rem, 92vw)',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) {
        this.cerrarPanel();
      }
    });
  }

  onArchivosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    if (!files.length) {
      input.value = '';
      return;
    }

    const nuevosAdjuntos = files
      .filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
      .map((file) => this.crearAdjuntoLocal(file));

    if (!nuevosAdjuntos.length) {
      this.errorMessage = 'Solo se permiten archivos PDF.';
      input.value = '';
      return;
    }

    const existentes = [...this.archivosPdf];
    for (const adjunto of nuevosAdjuntos) {
      const yaExiste = existentes.some((item) => item.nombre.toLowerCase() === adjunto.nombre.toLowerCase() && item.esArchivoLocal && item.archivo?.size === adjunto.archivo?.size);
      if (!yaExiste) {
        existentes.push(adjunto);
      } else {
        URL.revokeObjectURL(adjunto.ruta);
      }
    }

    this.archivosPdf = existentes;
    this.actualizarCampoDocumentos();
    this.errorMessage = '';
    input.value = '';
  }

  verArchivo(adjunto: CotizacionPdfAdjunto): void {
    const url = this.obtenerUrlVistaPrevia(adjunto);
    if (!url) {
      this.errorMessage = 'Este PDF no tiene una ruta de visualización disponible.';
      return;
    }

    const ventana = window.open(url, '_blank', 'noopener,noreferrer');
    if (ventana) {
      ventana.focus();
    }
  }

  verArchivoDeFila(item: CotizacionTjh2bItem): void {
    const ruta = (item.documentoPdf || '').trim();
    if (!ruta) {
      this.errorMessage = 'Esta cotización no tiene un documento adjunto.';
      return;
    }

    this.errorMessage = '';

    this.dialog.open(CotizacionesArchivoDialogComponent, {
      width: 'min(30rem, 92vw)',
      data: {
        nombre: this.extraerNombreArchivo(ruta),
        verArchivo: () => this.abrirDocumentoEnNuevaPestana(ruta, item.id)
      }
    });
  }

  private abrirDocumentoEnNuevaPestana(ruta: string, itemId: number | null): void {
    this.errorMessage = '';
    this.abriendoArchivoId = itemId;

    this.cotizacionService.obtenerArchivo(ruta).subscribe({
      next: (arrayBuffer: ArrayBuffer) => {
        this.abriendoArchivoId = null;
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const ventana = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        if (ventana) {
          ventana.focus();
        }
      },
      error: () => {
        this.abriendoArchivoId = null;
        this.errorMessage = 'No se pudo abrir el documento de la cotización.';
      }
    });
  }

  eliminarArchivo(adjunto: CotizacionPdfAdjunto): void {
    this.archivosPdf = this.archivosPdf.filter((item) => item.id !== adjunto.id);

    if (adjunto.esArchivoLocal && adjunto.ruta.startsWith('blob:')) {
      URL.revokeObjectURL(adjunto.ruta);
    }

    this.actualizarCampoDocumentos();
  }

  aplicarFiltros(): void {
    const fechaFiltroTipo = String(this.filtrosForm.get('FechaFiltroTipo')?.value ?? '').trim();
    const fechaFiltroValor = this.normalizeFechaCotizacion(this.filtrosForm.get('FechaFiltroValor')?.value);

    this.filtroActual = {
      Numero: String(this.filtrosForm.get('Numero')?.value ?? '').trim(),
      ClienteNombre: String(this.filtrosForm.get('ClienteNombre')?.value ?? '').trim(),
      Servicio: String(this.filtrosForm.get('Servicio')?.value ?? '').trim(),
      FechaInicio: fechaFiltroTipo === 'FECHA_INICIO' && fechaFiltroValor ? fechaFiltroValor : null,
      FechaFin: fechaFiltroTipo === 'FECHA_FIN' && fechaFiltroValor ? fechaFiltroValor : null,
      EstadoCotizacion: String(this.filtrosForm.get('EstadoCotizacion')?.value ?? '').trim(),
      Estado: String(this.filtrosForm.get('Estado')?.value ?? 'A').trim() || 'A'
    };

    this.cargarCotizaciones();
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      Numero: '',
      ClienteNombre: '',
      Servicio: '',
      FechaFiltroTipo: '',
      FechaFiltroValor: null,
      EstadoCotizacion: '',
      Estado: 'A'
    });

    this.aplicarFiltros();
  }

  guardar(): void {
    if (this.guardando) {
      return;
    }

    if (!this.validarFormulario()) {
      return;
    }

    const usr = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usr) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    const formData = this.buildFormData(usr);
    this.guardando = true;
    this.errorMessage = '';

    const request$ = this.editando
      ? this.cotizacionService.actualizar(formData)
      : this.cotizacionService.registrar(formData);

    request$.subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarPanel();
        this.cargarCotizaciones();
      },
      error: (error: unknown) => {
        console.error('Error guardando cotización', error);
        this.guardando = false;
        this.errorMessage = this.editando
          ? 'No se pudo actualizar la cotización.'
          : 'No se pudo registrar la cotización.';
      }
    });
  }

  eliminarCotizacion(item: CotizacionTjh2bItem): void {
    if (item.id === null) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar cotización',
        mensaje: `Se eliminará la cotización "${item.numero}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado) {
        return;
      }

      const usrMod = (this.authService.getCurrentUser?.() ?? '').trim();
      if (!usrMod) {
        this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
        return;
      }

      this.cotizacionService.eliminar(item.id as number, usrMod).subscribe({
        next: () => this.cargarCotizaciones(),
        error: (error: unknown) => {
          console.error('Error eliminando cotización', error);
          this.errorMessage = 'No se pudo eliminar la cotización.';
        }
      });
    });
  }

  formatEstado(estado: string): string {
    const value = String(estado ?? '').trim().toUpperCase();

    if (value === 'I' || value === 'INACTIVO') {
      return 'Inactivo';
    }

    if (value === 'A' || value === 'ACTIVO') {
      return 'Activo';
    }

    return value || '-';
  }

  formatCotizacionEstado(estado: string): string {
    const value = this.normalizarCotizacionEstado(estado);

    if (value === 'P') {
      return 'Pendiente';
    }

    if (value === 'F') {
      return 'Finalizado';
    }

    return '-';
  }

  /**
   * El "Estado de cotización" solo maneja 2 opciones: Pendiente (P) y Finalizado (F).
   * Cualquier valor recibido que no sea explícitamente "Pendiente" se considera Finalizado,
   * y un valor vacío se considera sin dato (no aplica filtro).
   */
  private normalizarCotizacionEstado(estado: string): string {
    const value = String(estado ?? '').trim().toUpperCase();

    if (!value) {
      return '';
    }

    if (value === 'P' || value === 'PENDIENTE') {
      return 'P';
    }

    return 'F';
  }

  trackByCotizacion(_index: number, item: CotizacionTjh2bItem): number | null {
    return item.id;
  }

  trackByArchivo(_index: number, item: CotizacionPdfAdjunto): string {
    return item.id;
  }

  private configurarFiltroCliente(): void {
    const control = this.form.get('Cliente_Busqueda');
    if (!control) {
      return;
    }

    this.clienteBusquedaSubscription = control.valueChanges
      .pipe(startWith(control.value ?? ''))
      .subscribe((value) => {
        this.clientesFiltrados = this.filtrarClientes(value);

        if (typeof value === 'string') {
          const texto = value.trim();
          const clienteIdControl = this.form.get('Cliente_Id');
          if (!texto) {
            clienteIdControl?.setValue(0, { emitEvent: false });
          } else {
            const coincidenciaExacta = this.clientes.find((cliente) => cliente.Cliente_Nombre.toLowerCase() === texto.toLowerCase());
            if (!coincidenciaExacta) {
              clienteIdControl?.setValue(0, { emitEvent: false });
            }
          }
        }
      });
  }

  private filtrarClientes(valor: ClienteTjh2bOption | string | null | undefined): ClienteTjh2bOption[] {
    const texto = this.extraerTextoCliente(valor).toLowerCase();

    if (!texto) {
      return [...this.clientes];
    }

    return this.clientes.filter((cliente) => {
      const idTexto = String(cliente.Cliente_Id);
      const nombre = cliente.Cliente_Nombre.toLowerCase();
      return idTexto.includes(texto) || nombre.includes(texto);
    });
  }

  private extraerTextoCliente(valor: ClienteTjh2bOption | string | null | undefined): string {
    if (!valor) {
      return '';
    }

    if (typeof valor === 'string') {
      return valor.trim();
    }

    return valor.Cliente_Nombre?.trim() || '';
  }

  displayCliente = (cliente: ClienteTjh2bOption | string | null): string => {
    if (typeof cliente === 'string') {
      return cliente;
    }

    return cliente?.Cliente_Nombre ?? '';
  };

  onClienteSeleccionado(cliente: ClienteTjh2bOption): void {
    if (!cliente) {
      return;
    }

    this.form.patchValue({
      Cliente_Id: cliente.Cliente_Id,
      Cliente_Busqueda: cliente.Cliente_Nombre
    }, { emitEvent: false });

    this.clientesFiltrados = [...this.clientes];
  }

  private cargarClientes(): void {
    this.cargandoClientes = true;

    this.clienteService.listar({ Id: 0, Nombre: '', Estado: 'A' }).subscribe({
      next: (response: unknown) => {
        this.clientes = this.extractRecords(response).map((item) => ({
          Cliente_Id: this.toNumber(this.getValue(item, ['Cliente_Id', 'cliente_Id', 'Id', 'id'])) ?? 0,
          Cliente_Nombre: this.getValue(item, ['Cliente_Nombre', 'cliente_Nombre', 'Nombre', 'nombre']) || ''
        })).filter((item) => item.Cliente_Id > 0 && item.Cliente_Nombre.trim().length > 0);

        this.clientesFiltrados = [...this.clientes];
        this.sincronizarClienteSeleccionado();
        this.cargandoClientes = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando clientes TJH2B', error);
        this.clientes = [];
        this.clientesFiltrados = [];
        this.cargandoClientes = false;
      }
    });
  }

  private cargarCotizaciones(): void {
    this.cargando = true;
    this.errorMessage = '';

    this.cotizacionService.listar(this.filtroActual).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando cotizaciones', error);
        this.cotizaciones = [];
        this.errorMessage = 'No se pudo cargar la información de Cotizaciones TJH2B.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        this.cotizaciones = this.extractRecords(response).map((item) => this.mapCotizacion(item));
        this.cargando = false;
      }
    });
  }

  private validarFormulario(): boolean {
    if (!this.form.get('Cotizacion_Numero')?.value) {
      this.errorMessage = 'Ingrese el número de cotización.';
      return false;
    }

    if (!this.toNumber(this.form.get('Cliente_Id')?.value)) {
      this.errorMessage = 'Seleccione un cliente.';
      return false;
    }

    if (!this.form.get('Cotizacion_Servicio')?.value) {
      this.errorMessage = 'Ingrese el servicio de cotización.';
      return false;
    }

    if (!this.form.get('Cotizacion_FechaIni')?.value) {
      this.errorMessage = 'Ingrese la fecha de inicio.';
      return false;
    }

    if (!this.form.get('Cotizacion_FechaFin')?.value) {
      this.errorMessage = 'Ingrese la fecha de fin.';
      return false;
    }

    const documentoActual = String(this.form.get('Cotizacion_DocumentoPDF')?.value ?? '').trim();
    if (!this.editando && !this.archivosPdf.length && !documentoActual) {
      this.errorMessage = 'Seleccione al menos un documento PDF de la cotización.';
      return false;
    }

    return true;
  }

  private buildFormData(usr: string): FormData {
    const formData = new FormData();

    const cotizacionId = this.toNumber(this.form.get('Cotizacion_Id')?.value) ?? 0;
    const clienteId = this.toNumber(this.form.get('Cliente_Id')?.value) ?? 0;

    formData.append('Cotizacion_Id', String(cotizacionId));
    formData.append('Cotizacion_Numero', String(this.form.get('Cotizacion_Numero')?.value ?? '').trim());
    formData.append('Cliente_Id', String(clienteId));
    formData.append('Cotizacion_Servicio', String(this.form.get('Cotizacion_Servicio')?.value ?? '').trim());
    formData.append('Cotizacion_FechaIni', this.normalizeFechaCotizacion(this.form.get('Cotizacion_FechaIni')?.value));
    formData.append('Cotizacion_FechaFin', this.normalizeFechaCotizacion(this.form.get('Cotizacion_FechaFin')?.value));
    formData.append('Usr_Reg', usr);
    formData.append('Usr_Mod', usr);
    formData.append('Cotizacion_Estado', String(this.form.get('Cotizacion_Estado')?.value ?? 'P'));
    formData.append('Estado', String(this.form.get('Estado')?.value ?? 'A'));

    const documentos = this.archivosPdf.length > 0
      ? this.archivosPdf
      : this.crearAdjuntosDesdeTexto(String(this.form.get('Cotizacion_DocumentoPDF')?.value ?? ''));

    documentos.forEach((adjunto) => {
      if (adjunto.archivo) {
        formData.append('Cotizacion_DocumentoPDF_File', adjunto.archivo, adjunto.archivo.name);
      }
    });

    formData.append('Cotizacion_DocumentoPDF', documentos.map((adjunto) => adjunto.nombre).join(' | '));

    return formData;
  }

  private mapCotizacion(item: DataRecord): CotizacionTjh2bItem {
    const id = this.toNumber(this.getValue(item, ['Cotizacion_Id', 'cotizacion_Id', 'Id', 'id']));
    const clienteId = this.toNumber(this.getValue(item, ['Cliente_Id', 'cliente_Id']));
    const fechaIni = this.toDateInputValue(this.getValue(item, ['Cotizacion_FechaIni', 'cotizacion_FechaIni', 'fechaIni', 'FechaIni']));
    const fechaFin = this.toDateInputValue(this.getValue(item, ['Cotizacion_FechaFin', 'cotizacion_FechaFin', 'fechaFin', 'FechaFin']));

    return {
      id,
      numero: this.getValue(item, ['Cotizacion_Numero', 'cotizacion_Numero', 'Numero', 'numero']) || '',
      clienteId,
      clienteNombre: this.getValue(item, ['Cliente_Nombre', 'cliente_Nombre']) || '',
      servicio: this.getValue(item, ['Cotizacion_Servicio', 'cotizacion_Servicio', 'Servicio', 'servicio']) || '',
      fechaIni,
      fechaFin,
      documentoPdf: this.getValue(item, ['Cotizacion_DocumentoPDF', 'cotizacion_DocumentoPDF', 'documentoPdf', 'DocumentoPdf']) || '',
      cotizacionEstado: this.getValue(item, ['Cotizacion_Estado', 'cotizacion_Estado']) || '',
      estado: this.getValue(item, ['Estado', 'estado']) || ''
    };
  }

  private cargarAdjuntosDesdeTexto(texto: string): void {
    const adjuntos = this.crearAdjuntosDesdeTexto(texto);
    this.archivosPdf = adjuntos.map((adjunto, index) => ({
      ...adjunto,
      id: `existing-${index}-${adjunto.nombre}`,
      esArchivoLocal: false
    }));
    this.actualizarCampoDocumentos();
  }

  private crearAdjuntosDesdeTexto(texto: string): CotizacionPdfAdjunto[] {
    const contenido = String(texto ?? '').trim();
    if (!contenido) {
      return [];
    }

    return contenido
      .split(/[\r\n|;,]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item, index) => ({
        id: `doc-${index}-${item}`,
        nombre: this.extraerNombreArchivo(item),
        ruta: item,
        esArchivoLocal: false
      }));
  }

  private crearAdjuntoLocal(file: File): CotizacionPdfAdjunto {
    return {
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      nombre: file.name,
      ruta: URL.createObjectURL(file),
      esArchivoLocal: true,
      archivo: file
    };
  }

  private actualizarCampoDocumentos(): void {
    this.form.patchValue({
      Cotizacion_DocumentoPDF: this.archivosPdf.map((adjunto) => adjunto.nombre).join(' | ')
    });

    this.archivoActual = this.archivosPdf.length
      ? this.archivosPdf.map((adjunto) => adjunto.nombre).join(', ')
      : '';
  }

  private obtenerUrlVistaPrevia(adjunto: CotizacionPdfAdjunto): string {
    if (adjunto.esArchivoLocal) {
      return adjunto.ruta;
    }

    const ruta = (adjunto.ruta || '').trim();
    if (!ruta) {
      return '';
    }

    if (/^(blob:|data:|https?:\/\/)/i.test(ruta)) {
      return ruta;
    }

    if (ruta.startsWith('/')) {
      return ruta;
    }

    return '';
  }

  private extraerNombreArchivo(valor: string): string {
    const limpio = String(valor ?? '').trim();
    if (!limpio) {
      return 'archivo.pdf';
    }

    const sinQuery = limpio.split('?')[0].split('#')[0];
    const partes = sinQuery.split(/[\\/]/g);
    return partes[partes.length - 1] || limpio;
  }

  private liberarUrlsAdjuntos(): void {
    for (const adjunto of this.archivosPdf) {
      if (adjunto.esArchivoLocal && adjunto.ruta.startsWith('blob:')) {
        URL.revokeObjectURL(adjunto.ruta);
      }
    }
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

  private extractFirstRecord(response: unknown): DataRecord {
    const registros = this.extractRecords(response);
    return registros.length > 0 ? registros[0] : {};
  }

  private getValue(record: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }

    return '';
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toDateInputValue(value: unknown): string {
    const date = this.parsearFechaFlexible(value);
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatearFechaTabla(value: unknown): string {
    const date = this.parsearFechaFlexible(value);
    if (!date) {
      return '-';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}-${month}-${year}`;
  }

  private parsearFechaFlexible(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (isoDateOnly) {
      const [, year, month, day] = isoDateOnly;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const slashDate = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (slashDate) {
      const [, day, month, year] = slashDate;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private fechaHoyDate(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  private normalizeFechaCotizacion(value: unknown): string {
    if (!value) {
      return '';
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return '';
      }

      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const parsed = this.parsearFechaFlexible(value);
    return parsed ? this.normalizeFechaCotizacion(parsed) : '';
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
