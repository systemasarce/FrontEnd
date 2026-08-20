import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

import { ApiService, ConsultaDatosUsuarioFiltro } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { CapturaAudioDialogComponent } from '../captura-audio-dialog.component';
import { ConfirmacionAccionDialogComponent } from '../confirmacion-accion-dialog.component';
import { CapturaFotoDialogComponent } from '../captura-foto-dialog.component';
import { FotoSourceChoice, SeleccionCapturaFotoDialogComponent } from '../seleccion-captura-foto-dialog.component';

interface SupervisorDatos {
  nombre: string;
  cargo: string;
  area: string;
  email: string;
}

interface ClienteItem {
  Cliente_Id: number;
  Cliente_Nombre: string;
}

interface AdjuntoItem {
  id: string;
  file?: File;
  url: string;
  nombre: string;
  ruta?: string;
  existente?: boolean;
}

type EstadoCentroMonitoreo = 'A' | 'I';

type EstadoUbicacion = 'buscando' | 'concedida' | 'denegada';

@Component({
  selector: 'app-centro-monitoreo-hse',
  templateUrl: './centro-monitoreo-hse.component.html',
  styleUrls: ['./centro-monitoreo-hse.component.scss']
})
export class CentroMonitoreoHseComponent implements OnInit, OnChanges, OnDestroy {
  @Output() volver = new EventEmitter<void>();
  @Input() modoEdicion = false;
  @Input() centroMonitoreoId: number | null = null;

  @ViewChild('documentosInput') private documentosInput?: ElementRef<HTMLInputElement>;
  @ViewChild('documentosCameraInput') private documentosCameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('audioInput') private audioInput?: ElementRef<HTMLInputElement>;

  readonly form: FormGroup;

  supervisor: SupervisorDatos = { nombre: '', cargo: '', area: '', email: '' };
  clientes: ClienteItem[] = [];
  documentos: AdjuntoItem[] = [];
  audios: AdjuntoItem[] = [];
  audioPreviewUrl: SafeUrl | null = null;
  private audioPreviewEsBlob = false;
  private audioPreviewObjectUrl: string | null = null;

  comboOpen = {
    cliente: false,
  };

  comboSearch = {
    cliente: '',
  };

  private clientePendienteEdicion: string = '';

  cargandoSupervisor = false;
  cargandoClientes = false;
  cargandoEdicion = false;
  guardando = false;

  ubicacionEstado: EstadoUbicacion = 'buscando';
  ubicacionMensaje = '';
  private ubicacionTexto = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly sanitizer: DomSanitizer
  ) {
    this.form = this.fb.group({
      cliente: ['', Validators.required],
      estado: ['A', Validators.required],
    });
  }

  ngOnInit(): void {
    this.cargarSupervisor();
    this.cargarClientes();

    if (!this.modoEdicion) {
      this.solicitarUbicacion();
    }

    if (this.modoEdicion && this.centroMonitoreoId) {
      setTimeout(() => this.cargarDatosEdicion(this.centroMonitoreoId as number), 0);
    }
  }

  get ubicacionBloqueada(): boolean {
    return this.modoEdicion ? false : this.ubicacionEstado !== 'concedida';
  }

  solicitarUbicacion(): void {
    if (this.modoEdicion) {
      this.ubicacionEstado = 'concedida';
      this.ubicacionMensaje = '';
      this.ubicacionTexto = '';
      return;
    }

    if (!('geolocation' in navigator)) {
      this.ubicacionEstado = 'denegada';
      this.ubicacionMensaje = 'Tu navegador no permite obtener la ubicación. Usa un dispositivo o navegador compatible.';
      return;
    }

    this.ubicacionEstado = 'buscando';
    this.ubicacionMensaje = '';

    navigator.geolocation.getCurrentPosition(
      (posicion: GeolocationPosition) => {
        const lat = posicion.coords.latitude.toFixed(6);
        const lng = posicion.coords.longitude.toFixed(6);
        this.ubicacionTexto = `${lat}, ${lng}`;
        this.ubicacionEstado = 'concedida';
        this.ubicacionMensaje = '';
      },
      (error: GeolocationPositionError) => {
        this.ubicacionEstado = 'denegada';
        this.ubicacionMensaje = error.code === error.PERMISSION_DENIED
          ? 'Debes permitir el acceso a tu ubicación para poder ingresar a este formulario.'
          : 'No se pudo obtener tu ubicación. Verifica el GPS o la conexión e inténtalo nuevamente.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['modoEdicion'] || changes['centroMonitoreoId']) && this.modoEdicion && this.centroMonitoreoId) {
      setTimeout(() => this.cargarDatosEdicion(this.centroMonitoreoId as number), 0);
    }
  }

  ngOnDestroy(): void {
    this.liberarAdjuntos(this.documentos);
    this.liberarAdjuntos(this.audios);
    this.cerrarVistaPreviaAudio();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      // sin combos flotantes
    }
  }

  get supervisorDisplay(): string {
    return this.supervisor.nombre || this.authService.getCurrentUserName() || this.obtenerUsuarioActual() || 'Seleccione';
  }

  get clienteSeleccionado(): ClienteItem | null {
    const id = this.toNumber(this.form.get('cliente')?.value);
    return this.clientes.find(item => this.toNumber(item.Cliente_Id) === id) || null;
  }

  get clienteDisplay(): string {
    return this.clienteSeleccionado?.Cliente_Nombre?.trim() || 'Seleccione';
  }

  get clientesActivos(): ClienteItem[] {
    return [...this.clientes].sort((a, b) => (a.Cliente_Nombre || '').localeCompare(b.Cliente_Nombre || ''));
  }

  get archivosTotales(): number {
    return this.documentos.length + this.audios.length;
  }

  trackByArchivoId = (_: number, archivo: AdjuntoItem): string => archivo.id;
  clienteTrackBy = (_: number, cliente: ClienteItem): number => cliente.Cliente_Id;

  toggleCombo(tipo: 'cliente'): void {
    const nuevoEstado = !this.comboOpen[tipo];
    this.comboOpen[tipo] = nuevoEstado;
    if (nuevoEstado) {
      this.comboSearch[tipo] = '';
    }
  }

  onSearchChange(tipo: 'cliente', event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.comboSearch[tipo] = (input?.value ?? '').toString();
  }

  selectCliente(cliente: ClienteItem | null): void {
    if (!cliente) {
      this.form.patchValue({ cliente: '' });
      this.comboSearch.cliente = '';
      this.comboOpen.cliente = false;
      return;
    }

    this.form.patchValue({ cliente: cliente.Cliente_Id });
    this.comboSearch.cliente = cliente.Cliente_Nombre;
    this.comboOpen.cliente = false;
  }

  get clientesFiltrados(): ClienteItem[] {
    const termino = (this.comboSearch.cliente || '').trim().toLowerCase();
    const lista = this.clientesActivos;

    if (!termino) {
      return lista;
    }

    return lista.filter(cliente => {
      const id = String(cliente.Cliente_Id ?? '').toLowerCase();
      const nombre = (cliente.Cliente_Nombre || '').toLowerCase();
      return id.includes(termino) || nombre.includes(termino);
    });
  }

  abrirSelectorDocumentos(): void {
    const dialogRef = this.dialog.open(SeleccionCapturaFotoDialogComponent, {
      width: '420px',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      data: {
        titulo: 'Agregar documento',
        mensaje: 'Elige si deseas tomar una foto con la cámara o seleccionar archivos desde tu dispositivo.',
        textoOpcionCamara: 'Tomar foto',
        textoOpcionArchivo: 'Seleccionar archivos'
      }
    });

    dialogRef.afterClosed().subscribe((opcion: FotoSourceChoice | null) => {
      if (opcion === 'camera') {
        if (this.esDispositivoMovil()) {
          // En celulares se usa la app de cámara nativa del sistema operativo
          this.documentosCameraInput?.nativeElement.click();
        } else {
          this.abrirCapturaCamaraDocumento();
        }
      }
      if (opcion === 'gallery') {
        this.documentosInput?.nativeElement.click();
      }
    });
  }

  abrirSelectorAudio(): void {
    const dialogRef = this.dialog.open(SeleccionCapturaFotoDialogComponent, {
      width: '420px',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      data: {
        titulo: 'Agregar audio',
        mensaje: 'Elige si deseas grabar un audio o seleccionar uno desde tu dispositivo.',
        textoOpcionCamara: 'Grabar audio',
        textoOpcionArchivo: 'Seleccionar audio'
      }
    });

    dialogRef.afterClosed().subscribe((opcion: FotoSourceChoice | null) => {
      if (opcion === 'camera') {
        this.abrirGrabadorAudio();
      }
      if (opcion === 'gallery') {
        this.audioInput?.nativeElement.click();
      }
    });
  }

  private esDispositivoMovil(): boolean {
    const ua = navigator.userAgent || (navigator as any).vendor || '';
    return /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua);
  }

  private abrirCapturaCamaraDocumento(): void {
    const dialogRef = this.dialog.open(CapturaFotoDialogComponent, {
      width: '460px',
      maxWidth: '92vw',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      data: { titulo: 'Tomar foto' }
    });

    dialogRef.afterClosed().subscribe((file: File | null) => {
      if (file) {
        this.documentos.push(this.crearAdjuntoDesdeFile(file));
      }
    });
  }

  onDocumentosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    if (files.length === 0) {
      return;
    }

    const validos = files.filter(file => !this.esVideo(file));
    if (validos.length !== files.length) {
      alert('Se omitieron archivos de video. Solo se permiten documentos, imágenes y audio.');
    }

    for (const file of validos) {
      this.documentos.push(this.crearAdjuntoDesdeFile(file));
    }
  }

  onDocumentosCameraChange(event: Event): void {
    this.onDocumentosChange(event);
  }

  onAudioChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter(item => !!item && !this.esVideo(item));
    input.value = '';

    if (files.length === 0) {
      return;
    }

    const noParecenAudio = files.filter(file => !this.esAudio(file));
    if (noParecenAudio.length > 0) {
      const permitido = confirm('Uno o más archivos seleccionados no parecen ser audio. ¿Deseas guardarlos de todas formas?');
      if (!permitido) {
        return;
      }
    }

    for (const file of files) {
      this.audios.push(this.crearAdjuntoDesdeFile(file));
    }
  }

  private abrirGrabadorAudio(): void {
    const dialogRef = this.dialog.open(CapturaAudioDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      data: { titulo: 'Grabar audio' }
    });

    dialogRef.afterClosed().subscribe((archivos: File[] | null) => {
      if (archivos && archivos.length > 0) {
        for (const archivo of archivos) {
          this.audios.push(this.crearAdjuntoDesdeFile(archivo));
        }
      }
    });
  }

  abrirArchivo(archivo: AdjuntoItem): void {
    if (archivo.existente && archivo.ruta) {
      this.apiService.getArchivoCentroMonitoreoHse(archivo.ruta).subscribe({
        next: (blob: ArrayBuffer) => {
          const mimeType = this.obtenerMimeType(archivo.nombre);
          const fileBlob = new Blob([blob], { type: mimeType });
          const objectUrl = URL.createObjectURL(fileBlob);
          window.open(objectUrl, '_blank', 'noopener,noreferrer');
          setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
        },
        error: () => alert('No se pudo abrir el archivo existente.')
      });
      return;
    }

    if (archivo.url) {
      window.open(archivo.url, '_blank', 'noopener,noreferrer');
    }
  }

  previewAudio(archivo: AdjuntoItem): void {
    if (archivo.existente && archivo.ruta) {
      this.apiService.getArchivoCentroMonitoreoHse(archivo.ruta).subscribe({
        next: (blob: ArrayBuffer) => {
          const mimeType = this.obtenerMimeType(archivo.nombre);
          const fileBlob = new Blob([blob], { type: mimeType });
          this.cerrarVistaPreviaAudio();
          const objectUrl = URL.createObjectURL(fileBlob);
          this.audioPreviewObjectUrl = objectUrl;
          // Angular no permite blob: en un [src] sin marcarlo explícitamente como seguro;
          // si no se hace esto, lo sustituye por "unsafe:blob:..." y no reproduce
          // (ERR_UNKNOWN_URL_SCHEME).
          this.audioPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
          this.audioPreviewEsBlob = true;
        },
        error: () => alert('No se pudo cargar el audio para reproducirlo.')
      });
      return;
    }

    if (archivo.url) {
      this.cerrarVistaPreviaAudio();
      this.audioPreviewObjectUrl = archivo.url;
      this.audioPreviewUrl = this.sanitizer.bypassSecurityTrustUrl(archivo.url);
      this.audioPreviewEsBlob = false;
    }
  }

  cerrarVistaPreviaAudio(): void {
    if (this.audioPreviewObjectUrl && this.audioPreviewEsBlob) {
      URL.revokeObjectURL(this.audioPreviewObjectUrl);
    }
    this.audioPreviewObjectUrl = null;
    this.audioPreviewUrl = null;
    this.audioPreviewEsBlob = false;
  }

  eliminarArchivo(tipo: 'documento' | 'audio', id: string): void {
    if (tipo === 'documento') {
      this.documentos = this.removerAdjunto(this.documentos, id);
      return;
    }
    this.audios = this.removerAdjunto(this.audios, id);
    if (this.audios.length === 0) {
      this.cerrarVistaPreviaAudio();
    }
  }

  descargarPdf(): void {
    if (!this.modoEdicion || !this.centroMonitoreoId) {
      return;
    }

    this.apiService.getReportePdfCentroMonitoreoHse(this.centroMonitoreoId).subscribe({
      next: (data: ArrayBuffer) => {
        const blob = new Blob([data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `Centro_HSE_${this.centroMonitoreoId}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: () => alert('No se pudo generar el PDF del Centro de Monitoreo HSE.')
    });
  }

  guardar(): void {
    if (!this.modoEdicion && this.ubicacionBloqueada) {
      alert('Debes permitir el acceso a tu ubicación para continuar.');
      this.solicitarUbicacion();
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      alert('Completa los datos obligatorios antes de continuar.');
      return;
    }

    const usuario = this.obtenerUsuarioActual();
    if (!usuario) {
      alert('No se encontró el usuario autenticado.');
      return;
    }

    const clienteId = this.toNumber(this.form.get('cliente')?.value);
    if (!clienteId) {
      alert('Selecciona un cliente.');
      return;
    }

    const documentosNuevos = this.documentos.filter(item => !item.existente && !!item.file && item.file.size > 0);
    const documentosExistentes = this.documentos
      .filter(item => item.existente && !!item.ruta)
      .map(item => item.ruta!.trim())
      .filter(item => item.length > 0);

    const audiosNuevos = this.audios.filter(item => !item.existente && !!item.file && item.file.size > 0);
    const audiosExistentes = this.audios
      .filter(item => item.existente && !!item.ruta)
      .map(item => item.ruta!.trim())
      .filter(item => item.length > 0);

    const formData = new FormData();

    formData.append('Usr_Cod', usuario);
    formData.append('Cliente_Id', String(clienteId));
    formData.append('Estado', this.normalizarEstado(this.form.get('estado')?.value));
    formData.append('Usr_Reg', usuario);

    if (!this.modoEdicion) {
      formData.append('Centro_Ubicacion', this.ubicacionTexto);
    }

    if (this.modoEdicion && this.centroMonitoreoId) {
      formData.append('Centro_Monitoreo_Id', String(this.centroMonitoreoId));
      formData.append('Usr_Mod', usuario);
    }

    for (const archivo of documentosNuevos) {
      formData.append('Monitoreo_Documentos', archivo.file!, archivo.file!.name);
    }

    for (const ruta of documentosExistentes) {
      formData.append('Monitoreo_Documentos_Ubicacion', ruta);
    }

    for (const archivo of audiosNuevos) {
      formData.append('Monitoreo_Audio', archivo.file!, archivo.file!.name);
    }

    for (const ruta of audiosExistentes) {
      formData.append('Monitoreo_Audio_Ubicacion', ruta);
    }

    this.guardando = true;
    const peticion$ = this.modoEdicion
      ? this.apiService.postActualizarCentroMonitoreoHse(formData)
      : this.apiService.postInsertarCentroMonitoreoHse(formData);

    peticion$.subscribe({
      next: (response: unknown) => {
        this.guardando = false;
        if (this.esRespuestaExitosa(response)) {
          this.volver.emit();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo guardar el Centro de Monitoreo HSE.');
        }
      },
      error: (error: unknown) => {
        this.guardando = false;
        alert(this.getErrorMessage(error, 'No se pudo guardar el Centro de Monitoreo HSE.'));
      }
    });
  }

  retroceder(): void {
    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      data: {
        titulo: 'Cancelar Centro de Monitoreo HSE',
        mensaje: 'Se cerrará el formulario de Centro de Monitoreo HSE y se perderán los cambios no guardados.',
        textoConfirmar: 'Confirmar cancelación',
        textoCancelar: 'Volver',
        tipo: 'normal'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.volver.emit(); }
    });
  }

  private cargarSupervisor(): void {
    this.cargandoSupervisor = true;
    const usuario = this.obtenerUsuarioActual();
    if (!usuario) {
      this.cargandoSupervisor = false;
      return;
    }

    const filtro: ConsultaDatosUsuarioFiltro = { Usr_Cod: usuario };
    this.apiService.getConsultaDatosUsuario(filtro).subscribe({
      next: (response: unknown) => {
        this.cargandoSupervisor = false;
        const item = this.extraerPrimerRegistro<Record<string, unknown>>(response);
        if (!item) {
          this.supervisor.nombre = this.authService.getCurrentUserName() || usuario;
          return;
        }

        this.supervisor = {
          nombre: this.texto(item['Usr_Nom'] ?? item['usr_Nom']) || this.authService.getCurrentUserName() || usuario,
          cargo: this.texto(item['Cargo_Nombre'] ?? item['cargo_Nombre']),
          area: this.texto(item['Cen_Cos_Des'] ?? item['cen_Cos_Des']),
          email: this.texto(item['Usr_Corr'] ?? item['usr_Corr']),
        };
      },
      error: () => {
        this.cargandoSupervisor = false;
        this.supervisor.nombre = this.authService.getCurrentUserName() || usuario;
      }
    });
  }

  private cargarClientes(): void {
    this.cargandoClientes = true;
    this.apiService.getListarCliente({ Estado: 'A' }).subscribe({
      next: (response: unknown) => {
        this.cargandoClientes = false;
        const items = this.extraerLista<Record<string, unknown>>(response);
        this.clientes = items.map(item => ({
          Cliente_Id: this.toNumber(
            item['Cliente_Id'] ?? item['cliente_Id'] ?? item['Id'] ?? item['id']
          ),
          Cliente_Nombre: this.texto(
            item['Cliente_Nombre'] ?? item['cliente_Nombre'] ?? item['Nombre'] ?? item['nombre']
          ),
        })).filter(item => !!item.Cliente_Id && !!item.Cliente_Nombre);

        this.sincronizarClienteEdicion();
      },
      error: () => {
        this.cargandoClientes = false;
        alert('No se pudo cargar la lista de clientes.');
      }
    });
  }
  private cargarDatosEdicion(id: number): void {
    this.cargandoEdicion = true;
    this.apiService.getMostrarActualizarCentroMonitoreoHse(id).subscribe({
      next: (response: unknown) => {
        this.cargandoEdicion = false;
        const item = this.extraerPrimerRegistro<Record<string, unknown>>(response);
        if (!item) {
          alert('No se pudo cargar la información del Centro de Monitoreo HSE para editar.');
          return;
        }

        // El SP devuelve Usr_Nom, Cliente_Nombre, Centro_Hse_Documento, Centro_HSE_Audio y Estado.
        // Si aún no llega Cliente_Id, usamos el nombre como respaldo para resolverlo contra la lista cargada.
        const documentos = this.texto(item['Centro_Hse_Documento'] ?? item['centro_Hse_Documento']);
        const audio = this.texto(item['Centro_HSE_Audio'] ?? item['centro_HSE_Audio']);

        const clienteId = this.toNumber(item['Cliente_Id'] ?? item['cliente_Id']);
        const clienteNombre = this.texto(item['Cliente_Nombre'] ?? item['cliente_Nombre']);
        const estado = this.normalizarEstado(item['Estado'] ?? item['estado']);
        const supervisorNombre = this.texto(item['Usr_Nom'] ?? item['usr_Nom']);

        if (supervisorNombre) {
          this.supervisor.nombre = supervisorNombre;
        }

        this.form.patchValue({
          cliente: clienteId || '',
          estado,
        });

        this.clientePendienteEdicion = clienteNombre;
        this.sincronizarClienteEdicion();

        this.documentos = this.crearAdjuntosDesdeTexto(documentos, 'Documento');
        this.audios = this.crearAdjuntosDesdeTexto(audio, 'Audio', true);
      },
      error: () => {
        this.cargandoEdicion = false;
        alert('No se pudo cargar la información del Centro de Monitoreo HSE.');
      }
    });
  }
  private sincronizarClienteEdicion(): void {
    const clienteId = this.toNumber(this.form.get('cliente')?.value);

    if (clienteId) {
      const seleccionado = this.clientes.find(cliente => this.toNumber(cliente.Cliente_Id) === clienteId);
      if (seleccionado) {
        this.comboSearch.cliente = seleccionado.Cliente_Nombre;
        this.clientePendienteEdicion = '';
        return;
      }
    }

    const nombrePendiente = (this.clientePendienteEdicion || '').trim().toLowerCase();
    if (!nombrePendiente) {
      return;
    }

    const seleccionadoPorNombre = this.clientes.find(cliente => {
      const nombre = (cliente.Cliente_Nombre || '').trim().toLowerCase();
      return nombre === nombrePendiente;
    });

    if (seleccionadoPorNombre) {
      this.form.patchValue({ cliente: seleccionadoPorNombre.Cliente_Id });
      this.comboSearch.cliente = seleccionadoPorNombre.Cliente_Nombre;
      this.clientePendienteEdicion = '';
      return;
    }

    this.comboSearch.cliente = this.clientePendienteEdicion;
  }

  private crearAdjuntoDesdeFile(file: File): AdjuntoItem {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      url: URL.createObjectURL(file),
      nombre: file.name,
      existente: false
    };
  }

  private crearAdjuntosDesdeTexto(textoRutas: string, prefijo: string, esAudio = false): AdjuntoItem[] {
    if (!textoRutas) {
      return [];
    }

    return textoRutas
      .split(/[\r\n|;,]+/g)
      .map((ruta: string) => ruta.trim())
      .filter((ruta: string) => ruta.length > 0)
      .map((ruta: string, index: number) => {
        const nombre = ruta.split(/[\\\/]/).pop()?.trim() || `${prefijo} ${index + 1}`;
        return {
          id: `${prefijo}-${index}-${ruta}`,
          url: ruta,
          nombre,
          ruta,
          existente: true,
          file: undefined
        } as AdjuntoItem;
      });
  }

  private removerAdjunto(lista: AdjuntoItem[], id: string): AdjuntoItem[] {
    const removido = lista.find(item => item.id === id);
    if (removido && removido.url && !removido.existente) {
      URL.revokeObjectURL(removido.url);
    }
    return lista.filter(item => item.id !== id);
  }

  private liberarAdjuntos(lista: AdjuntoItem[]): void {
    for (const item of lista) {
      if (item.url && !item.existente) {
        URL.revokeObjectURL(item.url);
      }
    }
  }

  private obtenerUsuarioActual(): string {
    return (this.authService.getCurrentUser?.() ?? '').trim();
  }

  private normalizarEstado(valor: unknown): EstadoCentroMonitoreo {
    return String(valor ?? 'A').trim().toUpperCase() === 'I' ? 'I' : 'A';
  }

  private texto(valor: unknown): string {
    if (typeof valor === 'string') {
      return valor.trim();
    }

    if (valor === null || valor === undefined) {
      return '';
    }

    return String(valor).trim();
  }

  private toNumber(valor: unknown): number {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.trunc(numero) : 0;
  }

  private extraerLista<T extends Record<string, unknown>>(response: unknown): T[] {
    if (Array.isArray(response)) {
      return response as T[];
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const obj = response as Record<string, unknown>;
    for (const key of ['Elements', 'elements', 'Data', 'data', 'Result', 'result', 'items', 'Items']) {
      const value = obj[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }

    return [];
  }

  private extraerPrimerRegistro<T extends Record<string, unknown>>(response: unknown): T | null {
    if (Array.isArray(response)) {
      return (response[0] as T) ?? null;
    }

    if (!response || typeof response !== 'object') {
      return null;
    }

    const obj = response as Record<string, unknown>;
    for (const key of ['Elements', 'elements', 'Data', 'data', 'Result', 'result', 'items', 'Items']) {
      const value = obj[key];
      if (Array.isArray(value) && value.length > 0) {
        return value[0] as T;
      }
    }

    return obj as T;
  }

  private esVideo(file: File): boolean {
    const tipo = (file.type || '').toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return tipo.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v'].includes(extension);
  }

  private esAudio(file: File): boolean {
    const tipo = (file.type || '').toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return tipo.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac'].includes(extension);
  }

  private esRespuestaExitosa(response: unknown): boolean {
    if (!response) {
      return false;
    }

    if (typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      if (obj['Success'] === true || obj['success'] === true) {
        return true;
      }
      if (obj['Success'] === false || obj['success'] === false) {
        return false;
      }
    }

    return true;
  }

  private getRespuestaMensaje(response: unknown): string {
    if (!response || typeof response !== 'object') {
      return '';
    }

    const obj = response as Record<string, unknown>;
    return this.texto(obj['Message'] ?? obj['message'] ?? obj['Mensaje'] ?? obj['mensaje']);
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    const err = error as Record<string, unknown> | null;
    const mensaje = this.texto(err?.['error'] && typeof err?.['error'] === 'object'
      ? (err['error'] as Record<string, unknown>)?.['message']
      : err?.['message']);
    return mensaje || fallback;
  }

  private obtenerMimeType(nombreArchivo: string): string {
    const nombre = (nombreArchivo || '').toLowerCase();
    if (nombre.endsWith('.pdf')) return 'application/pdf';
    if (nombre.endsWith('.doc')) return 'application/msword';
    if (nombre.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (nombre.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (nombre.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (nombre.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
    if (nombre.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (nombre.endsWith('.txt')) return 'text/plain';
    if (nombre.endsWith('.csv')) return 'text/csv';
    if (nombre.endsWith('.jpg') || nombre.endsWith('.jpeg')) return 'image/jpeg';
    if (nombre.endsWith('.png')) return 'image/png';
    if (nombre.endsWith('.gif')) return 'image/gif';
    if (nombre.endsWith('.webp')) return 'image/webp';
    if (nombre.endsWith('.bmp')) return 'image/bmp';
    if (nombre.endsWith('.mp3')) return 'audio/mpeg';
    if (nombre.endsWith('.wav')) return 'audio/wav';
    if (nombre.endsWith('.m4a')) return 'audio/mp4';
    if (nombre.endsWith('.ogg')) return 'audio/ogg';
    if (nombre.endsWith('.webm')) return 'audio/webm';
    return 'application/octet-stream';
  }
}
