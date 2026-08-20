import { Component } from '@angular/core';
import { FormBuilder, FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { from, of } from 'rxjs';
import { catchError, concatMap, switchMap, toArray } from 'rxjs/operators';

import { ActualizarDetallePedidoRequest, ActualizarPedidoRequest, ApiService, EliminarDetallePedidoRequest, EnviarCorreoPedidoGeneradoProductoRequest, EnviarCorreoPedidoGeneradoRequest, RegistrarArchivoAdjuntoPedidoRequest, RegistrarDetallePedidoRequest, RegistrarPedidoRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent, ConfirmacionDialogData } from '../inspecciones-page/confirmacion-accion-dialog.component';
import { ApprovalUserOption } from './approval-user-selector-dialog.component';
import { PedidoDetalleDialogComponent, PedidoDetalleDialogData } from './pedido-detalle-dialog.component';
import {
  PedidoDetalleImageSourceDialogComponent,
  PedidoDetalleImageSourceDialogResult
} from './pedido-detalle-image-source-dialog.component';
import { PedidoDetalleDialogValue } from './pedido-detalle-dialog.models';
import { PedidoRechazoDialogComponent, PedidoRechazoDialogData, PedidoRechazoDialogResult } from './pedido-rechazo-dialog.component';
import { RequisicionesPageComponent } from './requisiciones-page.component';

type DataRecord = Record<string, unknown>;

interface DireccionEntregaOption {
  id: number;
  descripcion: string;
  ubicacion: string;
}

interface PedidoBDetalleTemporal {
  id: number;
  persistedId: number | null;
  itemCode: string;
  itemDescription: string;
  unitCode: string;
  unitDescription: string;
  centroCostoId: number;
  centroCostoDescripcion: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  observaciones: string;
  comentarios: string;
  requisitos: string;
  imageFile: File | null;
  imagePreviewUrl: string;
  storedImageName: string;
  markedForDelete?: boolean;
}

interface UsuarioRegistroFiltroOption {
  codigo: string;
  nombre: string;
}

type PedidoBListadoRow = {
  requisicion: number;
  usrAprobacion?: string | null;
};

@Component({
  selector: 'app-pedidos-b-page',
  templateUrl: './pedidos-b-page.component.html',
  styleUrls: ['./requisiciones-page.component.scss']
})
export class PedidosBPageComponent extends RequisicionesPageComponent {
  readonly approvalUserSearchControl = new FormControl('', { nonNullable: true });
  direccionesEntrega: DireccionEntregaOption[] = [];
  usuariosRegistroCatalogo = new Map<string, string>();
  pedidoBDetalles: PedidoBDetalleTemporal[] = [];
  isLoadingDireccionesEntrega = false;
  isPreviewPedido = false;
  private nextPedidoBDetalleId = 1;
  private detalleImagenPendienteId: number | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly pedidosBDialog: MatDialog,
    private readonly pedidosBApiService: ApiService,
    private readonly pedidosBAuthService: AuthService
  ) {
    super(formBuilder, pedidosBDialog, pedidosBApiService, pedidosBAuthService);
    if (!this.detalleForm.contains('proveedorReferencia')) {
      this.detalleForm.addControl('proveedorReferencia', new FormControl(''));
    }
    if (!this.detalleForm.contains('aclaraciones')) {
      this.detalleForm.addControl('aclaraciones', new FormControl(''));
    }
    if (!this.filtersForm.contains('usuarioRegistro')) {
      this.filtersForm.addControl('usuarioRegistro', new FormControl(''));
    }
    if (!this.filtersForm.contains('palabrasClaveDetalle')) {
      this.filtersForm.addControl('palabrasClaveDetalle', new FormControl(''));
    }
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.normalizeLugarEntregaControlValue();
    this.syncDireccionEntregaControl();
    this.detalleForm.controls['lugarEntrega'].valueChanges.subscribe(() => {
      this.normalizeLugarEntregaControlValue();
      this.syncDireccionEntregaControl(true);
    });
    this.detalleForm.controls['fechaEntrega'].valueChanges.subscribe((value) => {
      this.setPedidoBFechaEntregaLocalDate(value);
    });
    this.detalleForm.controls['sustento'].valueChanges.subscribe((value) => {
      const providerReferenceControl = this.detalleForm.controls['proveedorReferencia'];
      const providerReference = String(providerReferenceControl.value ?? '');
      const sustento = String(value ?? '');

      if (providerReference !== sustento) {
        providerReferenceControl.setValue(sustento, { emitEvent: false });
      }
    });
    this.cargarDireccionesEntrega();
    this.cargarUsuariosRegistroCatalogo();
    this.setPedidoBFechaEntregaLocalDate(this.detalleForm.controls['fechaEntrega'].value);
  }

  trackByApprovalUser(_: number, user: ApprovalUserOption): number {
    return user.id;
  }

  get filteredApprovalUsers(): ApprovalUserOption[] {
    const search = this.approvalUserSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.approvalUsers;
    }

    return this.approvalUsers.filter((user) =>
      [user.code, user.name].some((value) => value.toLowerCase().includes(search))
    );
  }

  get usuariosRegistroFiltro(): UsuarioRegistroFiltroOption[] {
    return Array.from(new Set(
      this.requisiciones
        .map((pedido) => String(pedido.codigoUsr || '').trim())
        .filter((codigo) => Boolean(codigo) && codigo !== '-')
    ))
      .map((codigo) => ({
        codigo,
        nombre: this.usuariosRegistroCatalogo.get(codigo.toLowerCase()) || ''
      }))
      .sort((left, right) => {
        const leftText = left.nombre || left.codigo;
        const rightText = right.nombre || right.codigo;
        return leftText.localeCompare(rightText, 'es', { sensitivity: 'base' });
      });
  }

  override get requisicionesFiltradasPorOrden() {
    const pedidos = super.requisicionesFiltradasPorOrden;
    const usuarioRegistro = String(this.filtersForm.controls['usuarioRegistro']?.value || '').trim().toLowerCase();

    if (!usuarioRegistro) {
      return pedidos;
    }

    return pedidos.filter((pedido) => String(pedido.codigoUsr || '').trim().toLowerCase() === usuarioRegistro);
  }

  onUsuarioRegistroFiltroChange(): void {
    this.currentPedidosPage = 1;
  }

  trackByUsuarioRegistro(_: number, usuario: UsuarioRegistroFiltroOption): string {
    return usuario.codigo;
  }

  override limpiarFiltros(): void {
    super.limpiarFiltros();
    this.filtersForm.controls['usuarioRegistro']?.setValue('');
    this.filtersForm.controls['palabrasClaveDetalle']?.setValue('');
  }

  private cargarUsuariosRegistroCatalogo(): void {
    this.pedidosBApiService.getListarUsuarioActivo().subscribe({
      next: (response: unknown) => {
        const usuarios = this.extractPedidoBRecords(response, ['Usr_Cod', 'usr_Cod', 'usrCod']);
        this.usuariosRegistroCatalogo = new Map(
          usuarios
            .map((usuario) => {
              const codigo = this.getDireccionEntregaTextValue(usuario, ['Usr_Cod', 'usr_Cod', 'usrCod']);
              const nombre = this.getDireccionEntregaTextValue(usuario, ['Usr_Nom', 'usr_Nom', 'usrNom']);
              return [codigo.toLowerCase(), nombre] as const;
            })
            .filter(([codigo]) => Boolean(codigo))
        );
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar el catálogo de usuarios para el filtro de Pedidos B:', error);
        this.usuariosRegistroCatalogo.clear();
      }
    });
  }

  trackByDireccionEntrega(_: number, direccion: DireccionEntregaOption): number {
    return direccion.id;
  }

  onApprovalUserSelected(userId: number): void {
    const selectedUser = this.approvalUsers.find((user) => user.id === Number(userId));

    this.cabeceraForm.patchValue({
      usuarioAprobacionId: selectedUser?.id ?? 0,
      usuarioAprobacion: selectedUser?.code ?? ''
    });
    this.cabeceraForm.controls['usuarioAprobacion'].markAsTouched();
  }

  onApprovalUserSelectOpened(opened: boolean): void {
    if (opened) {
      this.approvalUserSearchControl.setValue('');
    }
  }

  abrirReportePedidoFila(item: PedidoBListadoRow, event?: Event): void {
    event?.stopPropagation();
    this.seleccionarPedido(item as never);
    this.verReportePedido(item as never);
  }

  modificarPedidoFila(item: PedidoBListadoRow, event?: Event): void {
    event?.stopPropagation();
    this.seleccionarPedido(item as never);
    this.modificarPedidoSeleccionado();
  }

  previsualizarPedidoFila(item: PedidoBListadoRow, event?: Event): void {
    event?.stopPropagation();
    this.seleccionarPedido(item as never);
    this.abrirPrevisualizacionPedidoSeleccionado();
  }

  aprobarPedidoFila(item: PedidoBListadoRow, event?: Event): void {
    event?.stopPropagation();
    if (this.isActionRowBusy(item) || !this.canDecidirPedidoFila(item)) {
      return;
    }

    this.seleccionarPedido(item as never);
    this.confirmarAccionPedidoB({
      titulo: 'Aprobar pedido',
      mensaje: `¿Deseas aprobar el pedido ${this.detallePedidoSeleccionado?.codigo || item.requisicion}?`,
      textoConfirmar: 'Aprobar',
      textoCancelar: 'Cancelar'
    }, () => this.ejecutarAccion('Aprobar'));
  }

  rechazarPedidoFila(item: PedidoBListadoRow, event?: Event): void {
    event?.stopPropagation();
    if (this.isActionRowBusy(item) || !this.canDecidirPedidoFila(item)) {
      return;
    }

    this.seleccionarPedido(item as never);
    this.ejecutarAccion('Rechazar');
  }

  eliminarPedidoFila(item: PedidoBListadoRow, event?: Event): void {
    event?.stopPropagation();
    this.seleccionarPedido(item as never);
    this.confirmarAccionPedidoB({
      titulo: 'Eliminar pedido',
      mensaje: `¿Deseas eliminar el pedido ${this.detallePedidoSeleccionado?.codigo || item.requisicion}?`,
      textoConfirmar: 'Eliminar',
      textoCancelar: 'Cancelar',
      tipo: 'peligro'
    }, () => this.ejecutarAccion('Eliminar'));
  }

  isActionRowBusy(item: PedidoBListadoRow): boolean {
    return this.isLoadingPedidoDetalle || this.isUpdatingPedidoEstado || this.isLoadingReportePedidoId === item.requisicion;
  }

  canApprovePedidoFila(item: PedidoBListadoRow): boolean {
    const usuarioAprobacion = this.normalizePedidoBUsuario(String(item.usrAprobacion ?? ''));
    const usuarioActual = this.normalizePedidoBUsuario(this.pedidosBAuthService.getCurrentUser());

    return !!usuarioAprobacion && usuarioAprobacion === usuarioActual;
  }

  canDecidirPedidoFila(item: PedidoBListadoRow): boolean {
    if (this.isPedidoPendienteFila(item)) {
      return this.canApprovePedidoFila(item);
    }

    if (this.isPedidoAprobadoFila(item)) {
      return this.canAdministrarPedidoAprobado();
    }

    return true;
  }

  isPedidoPendienteFila(item: any): boolean {
    const estado = String(item.estado ?? '').trim().toLowerCase();
    return estado === 'pendiente' || estado === 'p';
  }

  isPedidoAprobadoFila(item: any): boolean {
    const estado = String(item.estado ?? '').trim().toLowerCase();
    return estado === 'aprobado';
  }

  revertirPedidoFila(item: PedidoBListadoRow, event?: Event): void {
    event?.stopPropagation();
    if (!this.isPedidoAprobadoFila(item) || this.isActionRowBusy(item)) return;

    this.seleccionarPedido(item as never);
    this.confirmarAccionPedidoB({
      titulo: 'Revertir pedido',
      mensaje: `¿Deseas revertir el pedido ${this.detallePedidoSeleccionado?.codigo || item.requisicion} a pendiente?`,
      textoConfirmar: 'Revertir',
      textoCancelar: 'Cancelar'
    }, () => this.ejecutarReversionPedido(item));
  }

  private ejecutarReversionPedido(item: PedidoBListadoRow): void {
    this.isUpdatingPedidoEstado = true;
    this.pedidosBApiService.patchActualizarPedidoEstado({ Ped_Id: item.requisicion, Flg_Est: 'P' }).subscribe({
      next: () => { this.isUpdatingPedidoEstado = false; (this as any).cargarPedidos(); },
      error: (error: unknown) => { console.error('No se pudo revertir el pedido:', error); this.isUpdatingPedidoEstado = false; }
    });
  }

  canAdministrarPedidoAprobado(): boolean {
    return this.normalizePedidoBUsuario(this.pedidosBAuthService.getCurrentUser()) === 'dayala';
  }

  override modificarPedidoSeleccionado(): void {
    const pedidoId = this.selectedPedidoId;

    if (pedidoId === null) {
      return;
    }

    this.isPreviewPedido = false;
    this.pedidoBDetalles = [];
    this.nextPedidoBDetalleId = 1;
    super.modificarPedidoSeleccionado();
    this.cargarCabeceraPedidoB(pedidoId);
    this.cargarDetallePedidoB(pedidoId);
  }

  override iniciarNuevoPedido(): void {
    this.isPreviewPedido = false;
    super.iniciarNuevoPedido();
  }

  cerrarVistaPreviaPedido(): void {
    this.isPreviewPedido = false;
    this.cerrarEditorPedido();
  }

  abrirModalDetallePedidoB(): void {
    if (this.isPreviewPedido) {
      return;
    }

    const primerDetalleRegistrado = this.pedidoBDetalles.find((detalle) => !detalle.markedForDelete);

    if (primerDetalleRegistrado) {
      const dialogRef = this.pedidosBDialog.open(ConfirmacionAccionDialogComponent, {
        width: 'min(28rem, 92vw)',
        disableClose: true,
        panelClass: 'animated-dialog-pane',
        backdropClass: 'animated-dialog-backdrop',
        autoFocus: false,
        data: {
          titulo: 'Agregar producto',
          mensaje: `Se seleccionara por defecto el centro de costo "${primerDetalleRegistrado.centroCostoDescripcion}". ¿Deseas usarlo?`,
          textoConfirmar: 'Si',
          textoCancelar: 'No'
        } as ConfirmacionDialogData
      });

      dialogRef.afterClosed().subscribe((usarCentroCosto: boolean) => {
        this.openPedidoBDetalleDialog(usarCentroCosto ? primerDetalleRegistrado : undefined);
      });
      return;
    }

    this.openPedidoBDetalleDialog();
  }

  private openPedidoBDetalleDialog(detalleBase?: Pick<PedidoBDetalleTemporal, 'centroCostoId' | 'centroCostoDescripcion'>): void {
    const dialogData: PedidoDetalleDialogData = {
      pedidoCodigo: 'Auto',
      itemNumber: String(this.pedidoBDetalles.length + 1),
      moneda: this.getPedidoBMonedaLabel(),
      cantidadDisponible: 999999999,
      isEditing: false,
      modoPedidoB: true,
      centrosCosto: this.centroCostoOptions,
      items: this.detalleItemOptions,
      units: this.detalleUnidadOptions,
      initialValue: {
        itemCode: '',
        itemDescription: '',
        unitCode: '',
        unitDescription: '',
        centroCostoId: Number(detalleBase?.centroCostoId ?? 0),
        centroCostoDescripcion: String(detalleBase?.centroCostoDescripcion ?? '').trim(),
        centroCostoCantidadRequerida: 0,
        quantity: 0,
        unitPrice: 0
      }
    };

    const dialogRef = this.pedidosBDialog.open(PedidoDetalleDialogComponent, {
      width: 'min(44rem, 94vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result?: PedidoDetalleDialogValue) => {
      if (!result) {
        return;
      }

      this.pedidoBDetalles = [
        ...this.pedidoBDetalles,
        {
          id: this.nextPedidoBDetalleId++,
          persistedId: null,
          itemCode: result.itemCode,
          itemDescription: result.itemDescription,
          unitCode: result.unitCode,
          unitDescription: result.unitDescription,
          centroCostoId: result.centroCostoId,
          centroCostoDescripcion: result.centroCostoDescripcion,
          quantity: result.quantity,
          unitPrice: result.unitPrice,
          subtotal: this.normalizePedidoBCosto(result.subtotal ?? result.quantity * result.unitPrice),
          observaciones: '',
          comentarios: '',
          requisitos: '',
          imageFile: null,
          imagePreviewUrl: '',
          storedImageName: ''
        }
      ];
    });
  }

  editarDetallePedidoB(detalle: PedidoBDetalleTemporal, index: number): void {
    if (this.isPreviewPedido || detalle.markedForDelete) {
      return;
    }

    const dialogData: PedidoDetalleDialogData = {
      pedidoCodigo: 'Auto',
      itemNumber: String(index + 1),
      moneda: this.getPedidoBMonedaLabel(),
      cantidadDisponible: 999999999,
      isEditing: true,
      modoPedidoB: true,
      centrosCosto: this.centroCostoOptions,
      items: this.detalleItemOptions,
      units: this.detalleUnidadOptions,
      initialValue: {
        itemCode: detalle.itemCode,
        itemDescription: detalle.itemDescription,
        unitCode: detalle.unitCode,
        unitDescription: detalle.unitDescription,
        centroCostoId: detalle.centroCostoId,
        centroCostoDescripcion: detalle.centroCostoDescripcion,
        centroCostoCantidadRequerida: 0,
        quantity: detalle.quantity,
        unitPrice: detalle.unitPrice,
        subtotal: detalle.subtotal
      }
    };

    const dialogRef = this.pedidosBDialog.open(PedidoDetalleDialogComponent, {
      width: 'min(44rem, 94vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result?: PedidoDetalleDialogValue) => {
      if (!result) {
        return;
      }

      this.pedidoBDetalles = this.pedidoBDetalles.map((current) =>
        current.id === detalle.id
          ? {
              ...current,
              itemCode: result.itemCode,
              itemDescription: result.itemDescription,
              unitCode: result.unitCode,
              unitDescription: result.unitDescription,
              centroCostoId: result.centroCostoId,
              centroCostoDescripcion: result.centroCostoDescripcion,
              quantity: result.quantity,
              unitPrice: result.unitPrice,
              subtotal: this.normalizePedidoBCosto(result.subtotal ?? result.quantity * result.unitPrice),
              imageFile: current.imageFile,
              imagePreviewUrl: current.imagePreviewUrl,
              storedImageName: current.storedImageName,
              markedForDelete: false
            }
          : current
      );
    });
  }

  abrirDialogoImagenDetallePedidoB(
    detalle: PedidoBDetalleTemporal,
    cameraInput: HTMLInputElement,
    fileInput: HTMLInputElement
  ): void {
    if (this.isPreviewPedido || detalle.markedForDelete) {
      return;
    }

    const dialogRef = this.pedidosBDialog.open(PedidoDetalleImageSourceDialogComponent, {
      width: 'min(28rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: {
        titulo: 'Agregar imagen',
        mensaje: `Selecciona si deseas usar la camara o elegir un archivo para ${detalle.itemDescription}.`,
        imageUrl: this.resolveDetalleImagenPreviewUrl(detalle),
        imageAlt: `Imagen de ${detalle.itemDescription}`
      }
    });

    dialogRef.afterClosed().subscribe((result?: PedidoDetalleImageSourceDialogResult) => {
      if (!result || result === 'cancel') {
        this.detalleImagenPendienteId = null;
        return;
      }

      this.detalleImagenPendienteId = detalle.id;

      if (result === 'camera') {
        cameraInput.click();
        return;
      }

      fileInput.click();
    });
  }

  onDetalleImagenSeleccionada(event: Event, source: 'camera' | 'file'): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    const detalleId = this.detalleImagenPendienteId;

    this.detalleImagenPendienteId = null;

    if (!input) {
      return;
    }

    if (!detalleId || !files.length) {
      input.value = '';
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (!imageFiles.length) {
      input.value = '';
      return;
    }

    const imageFile = imageFiles[0];

    this.readDetalleImagenPreview(imageFile)
      .then((imagePreviewUrl) => {
        this.pedidoBDetalles = this.pedidoBDetalles.map((detalle) =>
          detalle.id === detalleId
            ? {
                ...detalle,
                imageFile,
                imagePreviewUrl
              }
            : detalle
        );

        console.log('[Pedidos B][Detalle imagen] imagen agregada', {
          detalleId,
          source,
          file: {
            name: imageFile.name,
            size: imageFile.size,
            type: imageFile.type
          }
        });
      })
      .catch((error: unknown) => {
        console.warn('[Pedidos B][Detalle imagen] no se pudo generar la vista previa', error);
      })
      .finally(() => {
        input.value = '';
      });
  }

  getDetalleImagenTooltip(detalle: PedidoBDetalleTemporal): string {
    return this.hasDetalleImagen(detalle) ? 'Imagen agregada' : 'Agregar imagen';
  }

  onPedidoBObservacionInput(detalleId: number, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const observaciones = input?.value ?? '';

    this.pedidoBDetalles = this.pedidoBDetalles.map((detalle) =>
      detalle.id === detalleId
        ? { ...detalle, observaciones }
        : detalle
    );
  }

  abrirEditorTextoDetallePedidoB(detalle: PedidoBDetalleTemporal, campo: 'observaciones' | 'comentarios' | 'requisitos'): void {
    if (this.isPreviewPedido || detalle.markedForDelete) {
      return;
    }

    const labelMap: Record<'observaciones' | 'comentarios' | 'requisitos', string> = {
      observaciones: 'Observaciones',
      comentarios: 'Comentarios',
      requisitos: 'Requisitos'
    };

    const errorMap: Record<'observaciones' | 'comentarios' | 'requisitos', string> = {
      observaciones: 'Ingresa una observacion valida.',
      comentarios: 'Ingresa un comentario valido.',
      requisitos: 'Ingresa un requisito valido.'
    };

    const dialogData: PedidoRechazoDialogData = {
      titulo: `Editar ${labelMap[campo].toLowerCase()}`,
      etiquetaMotivo: labelMap[campo],
      textoError: errorMap[campo],
      textoConfirmar: 'Guardar',
      valorInicial: detalle[campo],
      requerido: false
    };

    const dialogRef = this.pedidosBDialog.open(PedidoRechazoDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result?: PedidoRechazoDialogResult) => {
      if (!result) {
        return;
      }

      this.pedidoBDetalles = this.pedidoBDetalles.map((current) =>
        current.id === detalle.id
          ? { ...current, [campo]: result.motivo }
          : current
      );
    });
  }

  toggleEliminarDetallePedidoB(detalleId: number): void {
    if (this.isPreviewPedido) {
      return;
    }

    const detalle = this.pedidoBDetalles.find((item) => item.id === detalleId);

    if (!detalle) {
      return;
    }

    if (!detalle.persistedId) {
      this.pedidoBDetalles = this.pedidoBDetalles.filter((item) => item.id !== detalleId);
      return;
    }

    this.pedidoBDetalles = this.pedidoBDetalles.map((item) =>
      item.id === detalleId
        ? { ...item, markedForDelete: !item.markedForDelete }
        : item
    );
  }

  trackByPedidoBDetalle(_: number, detalle: PedidoBDetalleTemporal): number {
    return detalle.id;
  }

  formatPedidoBNumero(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    }).format(value);
  }

  formatPedidoBCosto(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(value);
  }

  override guardarPedido(): void {
    if (this.isSavingPedido) {
      return;
    }

    const payload = this.buildPedidoBPayload();

    if (!payload) {
      return;
    }

    this.isSavingPedido = true;
    this.saveErrorMessage = '';
    const isUpdatingPedido = this.isEditingPedido && this.selectedPedidoId !== null;

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    formData.append('archivo', new File([], 'sin-archivo-adjunto.txt'), 'sin-archivo-adjunto.txt');

    console.log('[Pedidos B][Guardar] Inicio', {
      modo: isUpdatingPedido ? 'actualizacion' : 'registro',
      pedidoId: this.selectedPedidoId,
      cabecera: payload,
      archivosLocales: this.archivoFiles.map((archivo) => ({
        name: archivo.name,
        size: archivo.size,
        type: archivo.type
      })),
      archivosGuardados: this.archivosAdjuntosGuardados,
      detalles: this.pedidoBDetalles
    });

    const saveRequest = isUpdatingPedido
      ? this.actualizarPedidoB(this.selectedPedidoId!, payload)
      : this.registrarPedidoB(formData);

    saveRequest.pipe(
      switchMap((response: unknown) => {
        this.assertPedidoBSuccessfulResponse(response, 'No se pudo guardar la cabecera del pedido.');
        const pedId = isUpdatingPedido
          ? this.selectedPedidoId
          : this.extractPedidoBPedId(response);

        if (!pedId) {
          throw new Error('No se recibio el codigo del pedido registrado.');
        }

        console.log('[Pedidos B][Guardar] Cabecera OK', {
          modo: isUpdatingPedido ? 'actualizacion' : 'registro',
          pedId,
          response
        });

        return this.sincronizarArchivosAdjuntosPedidoB(pedId).pipe(
          switchMap((adjuntosResponse) => {
            console.log('[Pedidos B][Guardar] Adjuntos OK', {
              pedId,
              response: adjuntosResponse
            });
            return this.sincronizarDetallePedidoB(pedId);
          }),
          switchMap((detalleResponse) => {
            console.log('[Pedidos B][Guardar] Detalle OK', {
              pedId,
              response: detalleResponse
            });
            if (isUpdatingPedido) {
              return of(detalleResponse);
            }
            return this.enviarCorreoPedidoGeneradoB(pedId, payload);
          }),
          switchMap((correoResponse) => {
            console.log('[Pedidos B][Guardar] Correo OK', {
              pedId,
              response: correoResponse
            });
            return of(correoResponse);
          })
        );
      })
    ).subscribe({
      next: () => {
        this.isSavingPedido = false;
        this.pedidoBDetalles = [];
        this.nextPedidoBDetalleId = 1;
        this.cerrarEditorPedido();
        this.aplicarFiltros();
      },
      error: (error: unknown) => {
        console.error('Error guardando pedido B:', error);
        this.saveErrorMessage = this.resolvePedidoBErrorMessage(
          error,
          isUpdatingPedido
            ? 'No se pudo actualizar el pedido. Intenta nuevamente.'
            : 'No se pudo registrar el pedido. Intenta nuevamente.'
        );
        this.isSavingPedido = false;
      }
    });
  }

  private cargarDireccionesEntrega(): void {
    this.isLoadingDireccionesEntrega = true;

    this.pedidosBApiService.getListarDireccionEntregaActivo({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.direccionesEntrega = this.extractDireccionEntregaRecords(response)
          .map((item) => this.mapDireccionEntrega(item))
          .filter((item): item is DireccionEntregaOption => item !== null)
          .sort((left, right) => left.id - right.id);
        this.normalizeLugarEntregaControlValue();
        this.syncDireccionEntregaControl();
        this.isLoadingDireccionesEntrega = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando direcciones de entrega:', error);
        this.direccionesEntrega = [];
        this.isLoadingDireccionesEntrega = false;
      }
    });
  }

  private cargarDetallePedidoB(pedidoId: number): void {
    this.pedidosBApiService.getListarDetallePedido(pedidoId).subscribe({
      next: (response: unknown) => {
        this.pedidoBDetalles = this.extractPedidoBRecords(response)
          .map((item, index) => this.mapDetallePedidoB(item, index))
          .filter((item): item is PedidoBDetalleTemporal => item !== null);
        this.nextPedidoBDetalleId = this.pedidoBDetalles.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
      },
      error: (error: unknown) => {
        console.error('Error cargando detalle de pedido B:', error);
        this.pedidoBDetalles = [];
        this.nextPedidoBDetalleId = 1;
        this.saveErrorMessage = this.resolvePedidoBErrorMessage(error, 'No se pudo cargar el detalle del pedido seleccionado.');
      }
    });
  }

  private cargarCabeceraPedidoB(pedidoId: number): void {
    this.pedidosBApiService.getListarPedidoModificar(pedidoId).subscribe({
      next: (response: unknown) => {
        const [item] = this.extractPedidoBRecords(response, ['Ped_Id', 'ped_Id', 'pedId']);

        if (!item) {
          return;
        }

        this.detalleForm.controls['aclaraciones']?.setValue(
          this.getDireccionEntregaTextValue(item, ['Ped_Acl', 'ped_Acl', 'pedAcl']),
          { emitEvent: false }
        );
      },
      error: (error: unknown) => {
        console.warn('No se pudo cargar la cabecera extendida del pedido B:', error);
      }
    });
  }

  private mapDetallePedidoB(item: DataRecord, index: number): PedidoBDetalleTemporal | null {
    const persistedId = this.getDireccionEntregaNumberValue(item, ['Ped_Det_Id', 'ped_Det_Id', 'pedDetId']);
    const itemCode = this.getDireccionEntregaTextValue(item, ['Ped_Cod_Itm', 'ped_Cod_Itm', 'pedCodItm', 'Itm_Cod', 'itm_Cod', 'itmCod']);
    const unitCode = this.getDireccionEntregaTextValue(item, ['Ped_Uni_Med', 'ped_Uni_Med', 'pedUniMed', 'Uni_Med_Id', 'uni_Med_Id', 'uniMedId']);
    const centroCostoId = this.getDireccionEntregaNumberValue(item, ['Ped_Cen_Cos_Asg', 'ped_Cen_Cos_Asg', 'pedCenCosAsg', 'Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId']) ?? 0;
    const quantity = this.getPedidoBDecimalValue(item, ['Ped_Can', 'ped_Can', 'pedCan']) ?? 0;
    const unitPrice = this.getPedidoBDecimalValue(item, ['Ped_Cos_Uni', 'ped_Cos_Uni', 'pedCosUni']) ?? 0;
    const subtotal = this.getPedidoBDecimalValue(item, ['Ped_Cos_Tot', 'ped_Cos_Tot', 'pedCosTot']);

    if (!itemCode && !unitCode && !centroCostoId && !quantity) {
      return null;
    }

    return {
      id: persistedId ?? index + 1,
      persistedId,
      itemCode,
      itemDescription: this.getDireccionEntregaTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes', 'Ped_Des_Itm', 'ped_Des_Itm', 'pedDesItm']) || this.resolvePedidoBItemDescription(itemCode),
      unitCode,
      unitDescription: this.getDireccionEntregaTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr']) || this.resolvePedidoBUnitDescription(unitCode),
      centroCostoId,
      centroCostoDescripcion: this.getDireccionEntregaTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']) || this.resolvePedidoBCentroCostoDescription(centroCostoId),
      quantity,
      unitPrice,
      subtotal: this.normalizePedidoBCosto(subtotal ?? quantity * unitPrice),
      observaciones: this.getDireccionEntregaTextValue(item, ['Ped_Obs_Ped', 'ped_Obs_Ped', 'pedObsPed', 'Ped_Obs', 'ped_Obs', 'pedObs']),
      comentarios: this.getDireccionEntregaTextValue(item, ['Ped_Com', 'ped_Com', 'pedCom']),
      requisitos: this.getDireccionEntregaTextValue(item, ['Ped_Req', 'ped_Req', 'pedReq']),
      imageFile: null,
      imagePreviewUrl: '',
      storedImageName: this.getDireccionEntregaTextValue(item, ['Ped_Det_Img', 'ped_Det_Img', 'pedDetImg'])
    };
  }

  private mapDireccionEntrega(item: DataRecord): DireccionEntregaOption | null {
    const id = this.getDireccionEntregaNumberValue(item, ['Dir_Id', 'dir_Id', 'dirId', 'id', 'Id']);
    const descripcion = this.getDireccionEntregaTextValue(item, ['Dir_Des', 'dir_Des', 'dirDes', 'descripcion', 'Descripcion']);
    const ubicacion = this.getDireccionEntregaTextValue(item, ['Dir_Ubi', 'dir_Ubi', 'dirUbi', 'ubicacion', 'Ubicacion']);

    if (!id || !descripcion) {
      return null;
    }

    return {
      id,
      descripcion,
      ubicacion
    };
  }

  private extractDireccionEntregaRecords(response: unknown): DataRecord[] {
    return this.extractPedidoBRecords(response, ['Dir_Id', 'dir_Id', 'dirId', 'Dir_Des', 'dir_Des', 'dirDes']);
  }

  private extractPedidoBRecords(response: unknown, fallbackKeys: string[] = ['Ped_Det_Id', 'ped_Det_Id', 'pedDetId', 'Ped_Cod_Itm', 'ped_Cod_Itm', 'pedCodItm']): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDireccionEntregaDataRecord(value));
    }

    if (!this.isDireccionEntregaDataRecord(response)) {
      return [];
    }

    if (response['Success'] === false || response['success'] === false) {
      return [];
    }

    const possibleArrayKeys = ['direccionesEntrega', 'DireccionesEntrega', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDireccionEntregaDataRecord(item));
      }
    }

    return fallbackKeys.some((key) => response[key] !== undefined && response[key] !== null) ? [response] : [];
  }

  private getDireccionEntregaTextValue(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private normalizePedidoBUsuario(value: string): string {
    return value.trim().toLowerCase();
  }

  private getDireccionEntregaNumberValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private getPedidoBDecimalValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (!Number.isNaN(value)) {
        return value;
      }
    }

    return null;
  }

  private isDireccionEntregaDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasDireccionEntregaFields(item: DataRecord): boolean {
    const recordKeys = ['Dir_Id', 'dir_Id', 'dirId', 'Dir_Des', 'dir_Des', 'dirDes'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private resolvePedidoBItemDescription(itemCode: string): string {
    return this.detalleItemOptions.find((item) => item.code === String(itemCode || '').trim())?.description || '';
  }

  private resolvePedidoBUnitDescription(unitCode: string): string {
    return this.detalleUnidadOptions.find((unit) => unit.code === String(unitCode || '').trim())?.description || '';
  }

  private resolvePedidoBCentroCostoDescription(centroCostoId: number): string {
    return this.centroCostoOptions.find((centroCosto) => centroCosto.id === centroCostoId)?.descripcion || '';
  }

  private getPedidoBMonedaLabel(): string {
    const monedaCodigo = Number(this.detalleForm.controls['moneda'].value);
    return this.tipoMoneda.find((moneda) => moneda.codigo === monedaCodigo)?.descripcion || 'S/.';
  }

  private normalizeLugarEntregaControlValue(): void {
    const control = this.detalleForm.controls['lugarEntrega'];
    const rawValue = control.value;

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return;
    }

    if (typeof rawValue === 'number') {
      return;
    }

    const numericValue = Number(rawValue);

    if (Number.isInteger(numericValue) && numericValue > 0) {
      control.setValue(numericValue, { emitEvent: false });
    }
  }

  private syncDireccionEntregaControl(clearDireccionOtro = false): void {
    const lugarEntregaControl = this.detalleForm.controls['lugarEntrega'];
    const direccionEntregaControl = this.detalleForm.controls['referencia'];
    const lugarEntregaId = Number(lugarEntregaControl.value);

    if (!Number.isInteger(lugarEntregaId) || lugarEntregaId <= 0) {
      direccionEntregaControl.disable({ emitEvent: false });
      direccionEntregaControl.setValue('', { emitEvent: false });
      return;
    }

    const direccionSeleccionada = this.direccionesEntrega.find((direccion) => direccion.id === lugarEntregaId);

    if (!direccionSeleccionada) {
      direccionEntregaControl.disable({ emitEvent: false });
      return;
    }

    if (this.isDireccionEntregaOtro(direccionSeleccionada)) {
      direccionEntregaControl.enable({ emitEvent: false });
      if (clearDireccionOtro) {
        direccionEntregaControl.setValue('', { emitEvent: false });
      }
      return;
    }

    direccionEntregaControl.disable({ emitEvent: false });
    direccionEntregaControl.setValue(direccionSeleccionada.ubicacion, { emitEvent: false });
  }

  private isDireccionEntregaOtro(direccion: DireccionEntregaOption): boolean {
    return direccion.descripcion.trim().toLowerCase() === 'otro';
  }

  private setPedidoBFechaEntregaLocalDate(value: unknown): void {
    const localDate = this.parsePedidoBLocalDate(value);

    if (!localDate) {
      return;
    }

    this.detalleForm.controls['fechaEntrega'].setValue(localDate, { emitEvent: false });
  }

  private parsePedidoBLocalDate(value: unknown): Date | null {
    if (!value || value instanceof Date) {
      return null;
    }

    const rawValue = String(value).trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(rawValue);

    if (isoMatch) {
      return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }

    const separatedMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(rawValue);

    if (separatedMatch) {
      return new Date(Number(separatedMatch[3]), Number(separatedMatch[2]) - 1, Number(separatedMatch[1]));
    }

    return null;
  }

  private buildPedidoBPayload(): RegistrarPedidoRequest | null {
    const usuarioAprobacion = String(this.cabeceraForm.controls['usuarioAprobacion'].value || '').trim();
    const lugarEntrega = Number(this.detalleForm.controls['lugarEntrega'].value);
    const referencia = String(this.detalleForm.controls['referencia'].value || '').trim();
    const tipoServicio = String(this.detalleForm.controls['oc'].value || '').trim();
    const moneda = Number(this.detalleForm.controls['moneda'].value);
    const fechaEntrega = this.normalizePedidoBFechaEntrega(this.detalleForm.controls['fechaEntrega'].value);
    const referenciaGeneral = String(this.detalleForm.controls['referenciaGeneral'].value || '').trim();
    const proveedorReferencia = String(this.detalleForm.controls['proveedorReferencia'].value || '').trim();
    const aclaraciones = String(this.detalleForm.controls['aclaraciones']?.value || '').trim();
    const usuarioRegistro = this.pedidosBAuthService.getCurrentUser().trim();
    const attachmentName = this.archivoAdjunto !== 'Sin archivo adjunto' ? this.archivoAdjunto : '';
    const detallesActivos = this.pedidoBDetalles.filter((detalle) => !detalle.markedForDelete);
    const cantidadTotal = detallesActivos.reduce((total, detalle) => total + Number(detalle.quantity || 0), 0);

    if (!usuarioAprobacion) {
      this.cabeceraForm.controls['usuarioAprobacion'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un usuario de aprobacion antes de guardar.';
      return null;
    }

    if (!Number.isInteger(lugarEntrega) || lugarEntrega <= 0) {
      this.detalleForm.controls['lugarEntrega'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un lugar de entrega antes de guardar.';
      return null;
    }

    if (!referencia) {
      this.detalleForm.controls['referencia'].markAsTouched();
      this.saveErrorMessage = 'Ingresa una direccion de entrega antes de guardar.';
      return null;
    }

    if (!tipoServicio) {
      this.detalleForm.controls['oc'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un tipo de servicio antes de guardar.';
      return null;
    }

    if (!Number.isInteger(moneda) || moneda <= 0) {
      this.saveErrorMessage = 'No se encontro una moneda valida para registrar el pedido.';
      return null;
    }

    if (!fechaEntrega) {
      this.detalleForm.controls['fechaEntrega'].markAsTouched();
      this.saveErrorMessage = 'Ingresa una fecha de entrega valida antes de guardar.';
      return null;
    }

    if (!detallesActivos.length && !this.pedidoBDetalles.some((detalle) => detalle.persistedId && detalle.markedForDelete)) {
      this.saveErrorMessage = 'Agrega al menos un producto antes de guardar.';
      return null;
    }

    if (detallesActivos.some((detalle) => Number(detalle.quantity || 0) <= 0)) {
      this.saveErrorMessage = 'Todas las cantidades del detalle deben ser mayores a cero.';
      return null;
    }

    if (!usuarioRegistro) {
      this.saveErrorMessage = 'No se encontro el usuario actual de la sesion.';
      return null;
    }

    return {
      Ped_Id: 0,
      Ped_Usr_Apr: usuarioAprobacion,
      Ped_Lug_Ent: lugarEntrega,
      Ped_Ref: referencia,
      Ped_Ref_Gral: referenciaGeneral,
      Ped_Acl: aclaraciones,
      Ped_Tip_Com: tipoServicio,
      Ped_Tip_Mon: moneda,
      Ped_Fec_Ent: fechaEntrega,
      Ped_Sus: proveedorReferencia,
      Ped_Arc_Adj_Nom: attachmentName,
      Ped_Arc_Adj_Rut: '',
      Ped_Prv_Cod: 0,
      Ped_For_Pag_Cod: 0,
      Ped_Can_Tot: cantidadTotal,
      Usr_Reg: usuarioRegistro
    };
  }

  private registrarPedidoB(formData: FormData) {
    return this.pedidosBApiService.postRegistrarPedido(formData);
  }

  private enviarCorreoPedidoGeneradoB(pedId: number, payload: RegistrarPedidoRequest) {
    const usuarioRegistroNombre = this.resolveCurrentUserDisplayName();
    const usuarioAprobacionNombre = this.resolveApprovalUserDisplayName(payload.Ped_Usr_Apr);
    const usuarioAprobacionCorreo = this.resolveApprovalUserEmail(payload.Ped_Usr_Apr);
    const tipoServicioDescripcion = this.resolveTipoServicioDescripcion(payload.Ped_Tip_Com);
    const productos = this.buildCorreoPedidoProductos();

    const correoPayload: EnviarCorreoPedidoGeneradoRequest = {
      Ped_Id: pedId,
      CorreoDestino: usuarioAprobacionCorreo || 'systemas@arceperu.pe',
      UsuarioRegistro: usuarioRegistroNombre,
      UsuarioAprobacion: usuarioAprobacionNombre,
      Referencia: payload.Ped_Ref,
      TipoServicio: tipoServicioDescripcion,
      Productos: productos
    };

    return this.pedidosBApiService.postEnviarCorreoPedidoGenerado(correoPayload).pipe(
      catchError((error: unknown) => {
        console.warn('No se pudo enviar el correo de pedido generado:', error);
        return of(null);
      })
    );
  }

  private resolveCurrentUserDisplayName(): string {
    const currentUserName = this.pedidosBAuthService.getCurrentUserName().trim();
    return currentUserName || this.pedidosBAuthService.getCurrentUser().trim();
  }

  private resolveApprovalUserDisplayName(userCode: string): string {
    const normalizedCode = String(userCode || '').trim().toLowerCase();

    if (!normalizedCode) {
      return '';
    }

    const approvalUser = this.approvalUsers.find((user) => user.code.trim().toLowerCase() === normalizedCode);
    return approvalUser?.name?.trim() || userCode;
  }

  private resolveApprovalUserEmail(userCode: string): string {
    const normalizedCode = String(userCode || '').trim().toLowerCase();

    if (!normalizedCode) {
      return '';
    }

    return this.approvalUsers.find((user) => user.code.trim().toLowerCase() === normalizedCode)?.email?.trim() || '';
  }

  private resolveTipoServicioDescripcion(tipoServicioCodigo: string): string {
    const normalizedCode = String(tipoServicioCodigo || '').trim();

    if (!normalizedCode) {
      return '';
    }

    return this.tipoServicioOptions.find((option) => option.codigo === normalizedCode)?.descripcion || normalizedCode;
  }

  private buildCorreoPedidoProductos(): EnviarCorreoPedidoGeneradoProductoRequest[] {
    return this.pedidoBDetalles
      .filter((detalle) => !detalle.markedForDelete)
      .map((detalle, index) => ({
        Item: index + 1,
        DescripcionProducto: detalle.itemDescription,
        DescripcionUnidad: detalle.unitDescription,
        CentroCosto: detalle.centroCostoDescripcion,
        Cantidad: detalle.quantity
      }));
  }

  private confirmarAccionPedidoB(data: ConfirmacionDialogData, onConfirm: () => void): void {
    const dialogRef = this.pedidosBDialog.open(ConfirmacionAccionDialogComponent, {
      width: 'min(28rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        onConfirm();
      }
    });
  }

  private actualizarPedidoB(pedId: number, payload: RegistrarPedidoRequest) {
    const updatePayload: ActualizarPedidoRequest = {
      Ped_Id: pedId,
      Ped_Usr_Apr: payload.Ped_Usr_Apr,
      Ped_Lug_Ent: payload.Ped_Lug_Ent,
      Ped_Ref: payload.Ped_Ref,
      Ped_Ref_Gral: payload.Ped_Ref_Gral,
      Ped_Acl: payload.Ped_Acl,
      Ped_Tip_Com: payload.Ped_Tip_Com,
      Ped_Tip_Mon: payload.Ped_Tip_Mon,
      Ped_Fec_Ent: payload.Ped_Fec_Ent,
      Ped_Sus: payload.Ped_Sus,
      Ped_Arc_Adj_Nom: payload.Ped_Arc_Adj_Nom,
      Ped_Arc_Adj_Rut: payload.Ped_Arc_Adj_Rut,
      Ped_Prv_Cod: payload.Ped_Prv_Cod,
      Ped_For_Pag_Cod: payload.Ped_For_Pag_Cod,
      Ped_Can_Tot: payload.Ped_Can_Tot,
      Usr_Mod: this.pedidosBAuthService.getCurrentUser().trim()
    };

    console.log('Pedidos B - actualizar pedido payload', {
      cabecera: updatePayload,
      archivos: this.archivoFiles.map((archivo) => ({
        name: archivo.name,
        size: archivo.size,
        type: archivo.type
      })),
      detallesExistentes: this.pedidoBDetalles
        .filter((detalle) => detalle.persistedId && !detalle.markedForDelete)
        .map((detalle) => this.buildPedidoBDetalleActualizarPayload(detalle)),
      detallesNuevos: this.pedidoBDetalles
        .filter((detalle) => !detalle.persistedId && !detalle.markedForDelete)
        .map((detalle) => this.buildPedidoBDetallePayload(pedId, detalle)),
      detallesEliminados: this.pedidoBDetalles
        .filter((detalle) => detalle.persistedId && detalle.markedForDelete)
        .map((detalle) => ({ Ped_Det_Id: Number(detalle.persistedId) }))
    });

    return this.pedidosBApiService.patchActualizarPedido(updatePayload, null);
  }

  private sincronizarArchivosAdjuntosPedidoB(pedId: number) {
    console.log('[Pedidos B][Adjuntos] Estado previo a sincronizar', {
      pedId,
      archivosLocales: this.archivoFiles.map((archivo) => ({
        name: archivo.name,
        size: archivo.size,
        type: archivo.type
      })),
      archivosGuardados: this.archivosAdjuntosGuardados
    });

    if (!this.archivoFiles.length) {
      console.log('[Pedidos B][Adjuntos] No hay archivos locales nuevos por registrar.');
      return of([]);
    }

    return from(this.archivoFiles).pipe(
      concatMap((archivo) => {
        const payload: RegistrarArchivoAdjuntoPedidoRequest = {
          Ped_Cab_Arc_Id: 0,
          Ped_Cab_Id: pedId,
          Ped_Cab_Arc_Rut: '',
          Ped_Cab_Arc_Nom: archivo.name
        };

        console.log('[Pedidos B][Adjuntos] Registrando archivo nuevo', payload);

        return this.pedidosBApiService.postRegistrarArchivoAdjuntoPedido(payload, archivo).pipe(
          switchMap((response: unknown) => {
            this.assertPedidoBSuccessfulResponse(response, `No se pudo registrar el archivo ${archivo.name}.`);
            return of(response);
          })
        );
      }),
      toArray()
    );
  }

  private sincronizarDetallePedidoB(pedId: number) {
    const detallesActivos = this.pedidoBDetalles.filter((detalle) => !detalle.markedForDelete);

    return from(detallesActivos).pipe(
      concatMap((detalle) => {
        const request = detalle.persistedId
          ? this.pedidosBApiService.patchActualizarDetallePedido(this.buildPedidoBDetalleActualizarPayload(detalle), detalle.imageFile)
          : this.pedidosBApiService.postRegistrarDetallePedido(this.buildPedidoBDetallePayload(pedId, detalle), detalle.imageFile);

        return request.pipe(
          switchMap((response: unknown) => {
            this.assertPedidoBSuccessfulResponse(response, `No se pudo registrar el detalle ${detalle.itemDescription || detalle.itemCode}.`);
            return from([response]);
          })
        );
      }),
      toArray(),
      switchMap(() => this.eliminarDetallesPedidoBMarcados())
    );
  }

  private eliminarDetallesPedidoBMarcados() {
    const detallesMarcados = this.pedidoBDetalles.filter((detalle) => detalle.persistedId && detalle.markedForDelete);

    if (!detallesMarcados.length) {
      return of([]);
    }

    return from(detallesMarcados).pipe(
      concatMap((detalle) =>
        this.pedidosBApiService.deleteEliminarDetallePedido({
          Ped_Det_Id: Number(detalle.persistedId)
        } as EliminarDetallePedidoRequest).pipe(
          switchMap((response: unknown) => {
            this.assertPedidoBSuccessfulResponse(response, `No se pudo eliminar el detalle ${detalle.itemDescription || detalle.itemCode}.`);
            return from([response]);
          })
        )
      ),
      toArray()
    );
  }

  private buildPedidoBDetallePayload(pedId: number, detalle: PedidoBDetalleTemporal): RegistrarDetallePedidoRequest {
    return {
      Ped_Cab_Id: pedId,
      Ped_Cod_Itm: Number(detalle.itemCode),
      Ped_Uni_Med: Number(detalle.unitCode),
      Ped_Cen_Cos_Asg: Number(detalle.centroCostoId),
      Ped_Can: Number(detalle.quantity),
      Ped_Cos_Uni: this.normalizePedidoBCosto(detalle.unitPrice),
      Ped_Cos_Tot: this.normalizePedidoBCosto(detalle.quantity * detalle.unitPrice),
      Usr_Reg: this.pedidosBAuthService.getCurrentUser().trim(),
      Ped_Obs_Ped: detalle.observaciones.trim(),
      Ped_Com: detalle.comentarios.trim(),
      Ped_Req: detalle.requisitos.trim(),
      Ped_Det_Img: detalle.storedImageName.trim()
    };
  }

  private buildPedidoBDetalleActualizarPayload(detalle: PedidoBDetalleTemporal): ActualizarDetallePedidoRequest {
    return {
      Ped_Det_Id: Number(detalle.persistedId),
      Ped_Cod_Itm: Number(detalle.itemCode),
      Ped_Uni_Med: Number(detalle.unitCode),
      Ped_Cen_Cos_Asg: Number(detalle.centroCostoId),
      Ped_Can: Number(detalle.quantity),
      Ped_Cos_Uni: this.normalizePedidoBCosto(detalle.unitPrice),
      Ped_Cos_Tot: this.normalizePedidoBCosto(detalle.quantity * detalle.unitPrice),
      Usr_Mod: this.pedidosBAuthService.getCurrentUser().trim(),
      Ped_Obs_Ped: detalle.observaciones.trim(),
      Ped_Com: detalle.comentarios.trim(),
      Ped_Req: detalle.requisitos.trim(),
      Ped_Det_Img: detalle.storedImageName.trim()
    };
  }

  private hasDetalleImagen(detalle: PedidoBDetalleTemporal): boolean {
    return !!detalle.imageFile || !!detalle.imagePreviewUrl || !!detalle.storedImageName.trim();
  }

  private resolveDetalleImagenPreviewUrl(detalle: PedidoBDetalleTemporal): string {
    if (detalle.imagePreviewUrl) {
      return detalle.imagePreviewUrl;
    }

    const storedImageName = detalle.storedImageName.trim();

    if (!storedImageName) {
      return '';
    }

    return `${this.pedidosBApiService.baseUrl}Pedido/getArchivoDetallePedido?nombreArchivo=${encodeURIComponent(storedImageName)}`;
  }

  private readDetalleImagenPreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';

        if (!result) {
          reject(new Error('No se pudo leer la imagen seleccionada.'));
          return;
        }

        resolve(result);
      };

      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen seleccionada.'));
      reader.readAsDataURL(file);
    });
  }

  private normalizePedidoBCosto(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Number(value.toFixed(4));
  }

  private normalizePedidoBFechaEntrega(value: unknown): string {
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

    const rawValue = String(value).trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(rawValue);

    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    const separatedMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(rawValue);

    if (separatedMatch) {
      return `${separatedMatch[3]}-${separatedMatch[2].padStart(2, '0')}-${separatedMatch[1].padStart(2, '0')}`;
    }

    const date = new Date(rawValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractPedidoBPedId(response: unknown): number | null {
    if (!this.isDireccionEntregaDataRecord(response)) {
      return null;
    }

    return this.getDireccionEntregaNumberValue(response, ['Ped_Id', 'ped_Id', 'pedId', 'Element', 'element', 'Data', 'data']);
  }

  private assertPedidoBSuccessfulResponse(response: unknown, fallbackMessage: string): void {
    if (!this.isDireccionEntregaDataRecord(response)) {
      return;
    }

    if (response['Success'] === false || response['success'] === false) {
      throw new Error(this.extractPedidoBResponseMessage(response) || fallbackMessage);
    }
  }

  private extractPedidoBResponseMessage(response: DataRecord): string {
    const message = response['Message'] ?? response['message'];
    return typeof message === 'string' ? message.trim() : '';
  }

  private resolvePedidoBErrorMessage(error: unknown, fallbackMessage: string): string {
    if (typeof error === 'object' && error !== null) {
      const errorRecord = error as Record<string, unknown>;
      const backendError = errorRecord['error'];

      if (typeof backendError === 'object' && backendError !== null) {
        const backendRecord = backendError as Record<string, unknown>;
        const backendDetail = typeof backendRecord['detail'] === 'string' ? backendRecord['detail'].trim() : '';
        const backendMessage = typeof backendRecord['message'] === 'string' ? backendRecord['message'].trim() : '';

        if (backendDetail) {
          return backendDetail;
        }

        if (backendMessage) {
          return backendMessage;
        }
      }

      const topLevelMessage = typeof errorRecord['message'] === 'string' ? errorRecord['message'].trim() : '';
      if (topLevelMessage) {
        return topLevelMessage;
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return fallbackMessage;
  }

  private abrirPrevisualizacionPedidoSeleccionado(): void {
    const pedidoId = this.selectedPedidoId;

    if (pedidoId === null || this.isLoadingPedidoDetalle) {
      return;
    }

    this.isPreviewPedido = true;
    this.pedidoBDetalles = [];
    this.nextPedidoBDetalleId = 1;
    super.modificarPedidoSeleccionado();
    this.cargarCabeceraPedidoB(pedidoId);
    this.cargarDetallePedidoB(pedidoId);
  }
}

