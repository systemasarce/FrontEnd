import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, from, Observable, of } from 'rxjs';
import { concatMap, map, switchMap, toArray } from 'rxjs/operators';

import {
  ActualizarEstadoConfirmacionOrdenCompraRequest,
  AsignarOrdenCompraDetallePedidoRequest,
  ActualizarDetallePedidoRequest,
  ActualizarOrdenCompraRequest,
  ActualizarReferenciaGeneralRequest,
  AnularOrdenCompraRequest,
  ApiService,
  DesAsignarOrdenCompraDetallePedidoRequest,
  OrdenCompraFiltro,
  PedidosFiltro,
  RegistrarArchivoAdjuntoOrdenCompraRequest,
  RegistrarOrdenCompraRequest
} from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ProviderSelectorDialogComponent } from 'src/app/features/provider-form/dialogs/provider-selector-dialog.component';
import { PaymentOption, ProviderRecord } from 'src/app/features/provider-form/provider-form.models';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import {
  createOrdenCompraReportPdf,
  mapOrdenCompraReportDisplayDate,
  OrdenCompraReporteDetallePdf,
  OrdenCompraReportePdfData
} from 'src/app/shared/utils/orden-compra-report-pdf.utils';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';
import { OrdenCompraParcialDialogComponent } from './orden-compra-parcial-dialog.component';
import { PedidoArchivoDialogRow, PedidoArchivosDialogComponent } from '../requisiciones-page/pedido-archivos-dialog.component';
import { ConfirmacionAccionDialogComponent, ConfirmacionDialogData } from '../inspecciones-page/confirmacion-accion-dialog.component';

type DataRecord = Record<string, unknown>;
type OrdenCompraListadoModo = 'pendientes' | 'generados';

interface OrdenCompraRow {
  id: number;
  ordenCompraId: number | null;
  correlativo: string;
  pedidoIdAtencion: number | null;
  usuarioRegistro: string;
  usuarioAprobacionPedido: string;
  flgEstCon: number;
  conformidadRegistro: boolean;
  conformidadAprobacion: boolean;
  proveedorId: number;
  monedaId: number;
  proveedor: string;
  proveedorRuc: string;
  proveedorBancoId: number;
  proveedorBancoDescripcion: string;
  proveedorCuenta: string;
  proveedorCci: string;
  descripcionGeneral: string;
  fechaAtencion: string;
  direccionEnvio: string;
  periodoGasto: number;
  proveedorContacto: string;
  proveedorEmail: string;
  proveedorDireccion: string;
  tipoServicio: string;
  monedaAbreviacion: string;
  formaPagoId: number;
  formaPago: string;
  referenciaObra: string;
  referencia: string;
  observacion: string;
  subtotal: number;
  igv: number;
  flgIgvAut: string;
  igvPor: number | null;
  total: number;
  detraccionId: number;
  detraccionDescripcion: string;
  montoDetraccion: number;
  descuento: number;
  descuentoPorcentaje: boolean;
  archivo: string;
  archivoRuta: string;
  fechaRegistro: string;
  estadoCodigo: string;
  estado: string;
  canEdit: boolean;
}

interface OrdenCompraProveedorBancoReporte {
  id: number;
  providerId: number;
  bankId: number;
  bankName: string;
  accountNumber: string;
  cci: string;
  selected: boolean;
}

interface PedidoPendienteRow {
  id: number;
  pedidoId: number;
  proveedor: string;
  tipoServicio: string;
  referencia: string;
  moneda: string;
  total: number;
  estadoCodigo: string;
  estado: string;
}

interface OrdenCompraCentroCostoRow {
  id: number;
  codigo: number;
  descripcion: string;
  selected: boolean;
}

interface OrdenCompraDetallePedidoRow {
  id: number;
  ordenCompraId: number | null;
  itemCodigo: string;
  itemDescripcion: string;
  unidadCodigo: string;
  unidadDescripcion: string;
  centroCostoCodigo: number | null;
  centroCostoDescripcion: string;
  cantidad: number;
  descuento: number;
  descuentoPorcentaje: boolean;
  costoUnitario: number;
  costoUnitarioConDescuento: number;
  subtotal: number;
  observacion: string;
  selected: boolean;
}

interface OrdenCompraArchivoAdjuntoGuardado {
  id: number;
  ordenCompraId: number;
  nombre: string;
  ruta: string;
}

interface OrdenCompraArchivoAdjuntoVista {
  id: number;
  ordenCompraId: number;
  nombre: string;
  ruta: string;
  local: boolean;
  index: number;
}

interface DetraccionOption {
  id: number;
  descripcion: string;
  porcentaje: number;
  label: string;
}

interface MonedaOption {
  id: number;
  descripcion: string;
  abreviacion: string;
}

interface UsuarioRegistroFiltroOption {
  codigo: string;
  nombre: string;
}

@Component({
  selector: 'app-orden-compra-page',
  templateUrl: './orden-compra-page.component.html',
  styleUrls: ['./orden-compra-page.component.scss']
})
export class OrdenCompraPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly form: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  readonly estadoOptions = [
    { codigo: 'A', descripcion: 'Activo' },
    { codigo: 'I', descripcion: 'Inactivo' }
  ];
  readonly listadoOptions: Array<{ codigo: OrdenCompraListadoModo; descripcion: string }> = [
    { codigo: 'pendientes', descripcion: 'Pendientes' },
    { codigo: 'generados', descripcion: 'Generados' }
  ];
  readonly actionButtons = ['Nuevo', 'Cerrar'];
  readonly periodoGastoOptions = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  ordenesCompra: OrdenCompraRow[] = [];
  pedidosPendientes: PedidoPendienteRow[] = [];
  proveedores: ProviderRecord[] = [];
  proveedorBancos: OrdenCompraProveedorBancoReporte[] = [];
  formasPago: PaymentOption[] = [];
  monedas: MonedaOption[] = [];
  centrosCostoCatalogo: OrdenCompraCentroCostoRow[] = [];
  centrosCosto: OrdenCompraCentroCostoRow[] = [];
  pedidoDetalles: OrdenCompraDetallePedidoRow[] = [];
  detracciones: DetraccionOption[] = [];
  usuariosRegistroCatalogo = new Map<string, string>();
  formaPagoSearch = '';
  detraccionSearch = '';
  currentOrdenesCompraPage = 1;
  currentPedidosPendientesPage = 1;
  currentDetallePedidoPage = 1;

  selectedOrdenCompraId: number | null = null;
  mostrarEditor = false;
  isEditingOrdenCompra = false;
  isLoadingOrdenesCompra = false;
  isLoadingProveedores = false;
  isLoadingProveedorBancos = false;
  isLoadingFormasPago = false;
  isLoadingMonedas = false;
  isLoadingCentrosCosto = false;
  isLoadingDetracciones = false;
  isLoadingPedidoCentrosCosto = false;
  isLoadingPedidoDetalle = false;
  isSavingOrdenCompra = false;
  isLoadingReporteOrdenCompraId: number | null = null;
  isUpdatingConformidadOrdenCompraId: number | null = null;
  isLoadingArchivosOrdenCompraListado: number | null = null;
  isUpdatingEstadoOrdenCompraId: number | null = null;
  esParcial = false;
  errorMessage = '';
  saveErrorMessage = '';
  centrosCostoErrorMessage = '';
  detallePedidoErrorMessage = '';
  ordenCompraArchivoAdjunto = 'Sin archivo adjunto';
  ordenCompraArchivoRuta = '';
  ordenCompraArchivoFile: File | null = null;
  ordenCompraArchivoFiles: File[] = [];
  ordenCompraArchivosAdjuntosGuardados: OrdenCompraArchivoAdjuntoGuardado[] = [];
  pedidoArchivoAdjunto = 'Sin archivo adjunto';
  isLoadingPedidoArchivosAdjuntos = false;
  detallesPendientesDesasignacion: OrdenCompraDetallePedidoRow[] = [];
  private ordenCompraLogoBytes: Uint8Array | null | undefined;
  private ordenCompraHeaderImageBytes: Uint8Array | null | undefined;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute
  ) {
    this.filtersForm = this.formBuilder.group({
      modoListado: ['pendientes'],
      ordenCompraId: [''],
      proveedor: [''],
      estado: ['A'],
      palabrasClaveDetalle: [''],
      usuarioRegistro: ['']
    });

    this.form = this.formBuilder.group({
      ordenCompraId: [null],
      pedidoIdAtencion: [null],
      proveedorId: [0],
      proveedorBancoId: [0],
      proveedor: ['', [Validators.required, noWhitespaceValidator()]],
      telefono: [''],
      direccion: [''],
      contacto: [''],
      ruc: [''],
      formaPagoId: [0],
      formaPago: ['', [Validators.required, noWhitespaceValidator()]],
      monedaId: [0],
      descripcionGeneral: [''],
      fechaAtencion: [''],
      direccionEnvio: [''],
      periodoGasto: [0],
      referenciaObra: [''],
      referencia: [''],
      pedidoReferenciaGeneral: [''],
      observacion: [''],
      archivo: ['Sin archivo adjunto'],
      detraccionId: [null],
      montoDetraccion: [0],
      descuento: [0, Validators.min(0)],
      descuentoPorcentaje: [false],
      subtotal: [0, Validators.min(0)],
      usarIgv18: [true],
      porcentajeIgv: [18, Validators.min(0)],
      igv: [0, Validators.min(0)],
      total: [0, Validators.min(0)],
      estado: ['A', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarProveedores();
    this.cargarFormasPago();
    this.cargarMonedas();
    this.cargarCentrosCosto();
    this.cargarDetracciones();
    this.cargarUsuariosRegistroCatalogo();
    this.cargarPedidosPendientes();
    this.resetEditor();
  }

  private get ordenCompraTipoId(): number {
    const routeValue = Number(this.route.snapshot.data?.['ordComTip']);
    return Number.isInteger(routeValue) && routeValue > 0 ? routeValue : 1;
  }

  get isOrdenServicio(): boolean {
    return this.ordenCompraTipoId === 2;
  }

  get paginaTitulo(): string {
    return this.ordenCompraTipoId === 2 ? 'Orden de Servicio' : 'Orden de Compra';
  }

  get numeroOrdenLabel(): string {
    return this.ordenCompraTipoId === 2 ? 'Nro. O/S' : 'Nro. O/C';
  }

  get paginaDescripcion(): string {
    return this.ordenCompraTipoId === 2
      ? 'Registra y actualiza ordenes de servicio con un flujo de trabajo unico y una grilla de centros de costo habilitable para casos parciales.'
      : 'Registra y actualiza ordenes de compra con un flujo de trabajo unico y una grilla de centros de costo habilitable para casos parciales.';
  }

  get proveedorButtonLabel(): string {
    return this.form.controls['proveedor'].value?.trim() || 'Seleccionar proveedor';
  }

  get canModifySelectedOrdenCompra(): boolean {
    return !!this.getOrdenCompraSeleccionada()?.canEdit;
  }

  get formaPagoButtonLabel(): string {
    const formaPagoId = Number(this.form.controls['formaPagoId'].value ?? 0);
    return formaPagoId > 0 ? String(formaPagoId) : 'Seleccionar';
  }

  get subtotalCalculado(): number {
    return this.normalizeDecimal(Math.max(0, this.subtotalSinDescuento - this.descuentoAplicado));
  }

  get subtotalSinDescuento(): number {
    return this.normalizeDecimal(
      this.detallesPedidoSeleccionados.reduce((total, item) => total + item.subtotal, 0)
    );
  }

  get descuentoAplicado(): number {
    const descuento = this.descuentoValorNormalizado;
    return this.form.controls['descuentoPorcentaje'].value
      ? this.normalizeDecimal(this.subtotalSinDescuento * descuento / 100)
      : descuento;
  }

  get descuentoValorNormalizado(): number {
    const descuento = Math.max(0, this.parseMontoControlValue(this.form.controls['descuento'].value));
    const limite = this.form.controls['descuentoPorcentaje'].value ? 100 : this.subtotalSinDescuento;
    return this.normalizeDecimal(Math.min(descuento, limite));
  }

  get igvCalculado(): number {
    const subtotalCuatroDecimales = this.normalizeDecimalPrecision(this.subtotalCalculado, 4);
    const igvCuatroDecimales = this.normalizeDecimalPrecision(
      subtotalCuatroDecimales * this.getPorcentajeIgv() / 100,
      4
    );

    return this.redondearIgvSegunTercerDecimal(igvCuatroDecimales);
  }

  get totalCalculado(): number {
    return this.calcularTotalConDetraccion(
      this.totalConIgvCalculado,
      this.montoDetraccionCalculado,
      this.detraccionSeleccionada?.descripcion ?? ''
    );
  }

  get totalConIgvCalculado(): number {
    return this.normalizeDecimal(this.subtotalCalculado + this.igvCalculado);
  }

  get detraccionSeleccionada(): DetraccionOption | null {
    const detraccionId = this.getDetraccionIdSeleccionada();
    return this.detracciones.find((item) => item.id === detraccionId) ?? null;
  }

  get montoDetraccionCalculado(): number {
    const porcentaje = this.detraccionSeleccionada?.porcentaje ?? 0;
    return this.aplicarRedondeoMontoDetraccion(
      this.normalizeDecimal(this.totalConIgvCalculado * porcentaje / 100),
      this.getDetraccionIdSeleccionada()
    );
  }

  get filteredDetracciones(): DetraccionOption[] {
    const search = this.detraccionSearch.trim().toLowerCase();

    if (!search) {
      return this.detracciones;
    }

    return this.detracciones.filter((item) =>
      item.label.toLowerCase().includes(search) ||
      item.descripcion.toLowerCase().includes(search) ||
      String(item.porcentaje).includes(search)
    );
  }

  get filteredFormasPago(): PaymentOption[] {
    const search = this.formaPagoSearch.trim().toLowerCase();

    if (!search) {
      return this.formasPago;
    }

    return this.formasPago.filter((item) =>
      item.description.toLowerCase().includes(search) ||
      String(item.code).includes(search)
    );
  }

  get centrosCostoSeleccionados(): OrdenCompraCentroCostoRow[] {
    return this.centrosCosto.filter((item) => item.selected);
  }

  get estanTodosLosCentrosSeleccionados(): boolean {
    return !!this.centrosCosto.length && this.centrosCosto.every((item) => item.selected);
  }

  get detallesPedidoSeleccionados(): OrdenCompraDetallePedidoRow[] {
    const idsPendientes = new Set(this.detallesPendientesDesasignacion.map((item) => item.id));
    return this.pedidoDetalles.filter((item) => item.selected && !idsPendientes.has(item.id));
  }

  get paginatedOrdenesCompra(): OrdenCompraRow[] {
    return paginateItems(this.ordenesCompraFiltradasPorUsuario, this.currentOrdenesCompraPage, this.pageSize);
  }

  get ordenesCompraFiltradasPorUsuario(): OrdenCompraRow[] {
    const usuarioRegistro = String(this.filtersForm.controls['usuarioRegistro'].value || '').trim().toLowerCase();

    if (!usuarioRegistro) {
      return this.ordenesCompra;
    }

    return this.ordenesCompra.filter((orden) => orden.usuarioRegistro.trim().toLowerCase() === usuarioRegistro);
  }

  get usuariosRegistroFiltro(): UsuarioRegistroFiltroOption[] {
    return Array.from(new Set(
      this.ordenesCompra
        .map((orden) => String(orden.usuarioRegistro || '').trim())
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

  get paginatedPedidosPendientes(): PedidoPendienteRow[] {
    return paginateItems(this.pedidosPendientes, this.currentPedidosPendientesPage, this.pageSize);
  }

  get isListadoGenerados(): boolean {
    return this.getListadoModo() === 'generados';
  }

  get paginatedPedidoDetalles(): OrdenCompraDetallePedidoRow[] {
    return paginateItems(this.pedidoDetalles, this.currentDetallePedidoPage, this.pageSize);
  }

  get totalCantidadDetallePedido(): number {
    return this.normalizeDecimal(this.pedidoDetalles.reduce((total, item) => total + item.cantidad, 0));
  }

  get totalCostoUnitarioDetallePedido(): number {
    return this.normalizeDecimalPrecision(this.pedidoDetalles.reduce((total, item) => total + item.costoUnitario, 0), 4);
  }

  get totalCostoUnitarioConDescuentoDetallePedido(): number {
    return this.normalizeDecimalPrecision(
      this.pedidoDetalles.reduce((total, item) => total + item.costoUnitarioConDescuento, 0),
      4
    );
  }

  get totalSubtotalDetallePedido(): number {
    return this.normalizeDecimalPrecision(this.subtotalCalculado, 4);
  }

  get estanTodosLosDetallesSeleccionados(): boolean {
    return !!this.pedidoDetalles.length && this.pedidoDetalles.every((item) => item.selected);
  }

  get resumenCentrosCosto(): string {
    if (!this.centrosCosto.length) {
      return 'Ingresa un numero de pedido para cargar los centros de costo vinculados.';
    }

    if (this.esParcial) {
      return this.centrosCostoSeleccionados.length
        ? `${this.centrosCostoSeleccionados.length} centro(s) seleccionado(s) para actualizacion parcial.`
        : 'Selecciona los centros de costo que deben recibir la orden de compra.';
    }

    return `${this.centrosCosto.length} centro(s) incluidos en la orden completa.`;
  }

  aplicarFiltros(): void {
    this.cargarListadoSeleccionado();
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      modoListado: 'pendientes',
      ordenCompraId: '',
      proveedor: '',
      estado: 'A',
      palabrasClaveDetalle: '',
      usuarioRegistro: ''
    });
    this.cargarPedidosPendientes();
  }

  onListadoModoChange(): void {
    this.errorMessage = '';
    this.selectedOrdenCompraId = null;
    this.cargarListadoSeleccionado();
  }

  onUsuarioRegistroFiltroChange(): void {
    this.currentOrdenesCompraPage = 1;
  }

  trackByUsuarioRegistro(_: number, usuario: UsuarioRegistroFiltroOption): string {
    return usuario.codigo;
  }

  generarOrdenCompraDesdePedido(item: PedidoPendienteRow): void {
    if (!item.pedidoId) {
      return;
    }

    this.isEditingOrdenCompra = false;
    this.resetEditor();
    this.esParcial = false;
    this.aplicarModoCentrosCosto();
    this.form.patchValue({
      pedidoIdAtencion: item.pedidoId
    });
    this.mostrarEditor = true;
    this.cargarCentrosCostoDesdePedido();
  }

  ejecutarAccion(action: string): void {
    if (action === 'Nuevo') {
      this.iniciarNuevaOrdenCompra();
      return;
    }

    this.cerrarVistaActual();
  }

  editarOrdenCompraDesdeFila(item: OrdenCompraRow): void {
    this.selectedOrdenCompraId = item.id;
    this.iniciarEdicionOrdenCompra();
  }

  anularOrdenCompraFila(item: OrdenCompraRow, event?: Event): void {
    event?.stopPropagation();

    if (!this.canAnularOrdenCompra(item)) {
      return;
    }

    const dialogData: ConfirmacionDialogData = {
      titulo: 'Anular orden de compra',
      mensaje: `¿Deseas anular la orden ${item.correlativo}?`,
      textoConfirmar: 'Anular',
      textoCancelar: 'Cancelar',
      tipo: 'peligro'
    };

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '28rem',
      maxWidth: '95vw',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean | undefined) => {
      if (confirmado) {
        this.anularOrdenCompra(item);
      }
    });
  }

  verReporteOrdenCompra(item: OrdenCompraRow): void {
    if (!item.ordenCompraId || this.isLoadingReporteOrdenCompraId === item.id) {
      return;
    }

    this.isLoadingReporteOrdenCompraId = item.id;
    this.errorMessage = '';

    this.apiService.getListarOrdenCompraModificar(item.ordenCompraId).pipe(
      switchMap((ordenCompraResponse: unknown) => {
        const ordenCompra = this.extractRecords(ordenCompraResponse)
          .map((record, index) => this.mapOrdenCompra(record, index))
          .find((record): record is OrdenCompraRow => record !== null) ?? item;
        const pedidoId = ordenCompra.pedidoIdAtencion ?? 0;

        return forkJoin({
          ordenCompra: of(ordenCompra),
          detalleResponse: pedidoId
            ? this.apiService.getListarItemsAsignadosPedidoCentroCostoModificar(item.ordenCompraId!, pedidoId)
            : of([] as unknown),
          pedidoResponse: pedidoId
            ? this.apiService.getCargarReportePedido(String(pedidoId))
            : of([] as unknown),
          proveedorResponse: ordenCompra.proveedorId
            ? this.apiService.getListarProveedorActivo({ Prv_Id: ordenCompra.proveedorId, Flg_Est: 'A' })
            : of([] as unknown)
        }).pipe(
          switchMap((context) => {
            const proveedorBancoRequest = ordenCompra.proveedorId
              ? this.apiService.getListarProveedorBanco({
                  Prv_Ban_Id: ordenCompra.proveedorBancoId,
                  Prv_Id: ordenCompra.proveedorId
                })
              : of([] as unknown);

            return proveedorBancoRequest.pipe(map((proveedorBancoResponse: unknown) => ({
              ...context,
              proveedorBancoResponse
            })));
          }),
          switchMap((context) => {
            const cuentaPrincipal = this.resolveProveedorBancoPrincipal(context.proveedorBancoResponse);
            const bancoId = cuentaPrincipal?.bankId || ordenCompra.proveedorBancoId;
            const bancoRequest = bancoId
              ? this.apiService.getListarBanco({ Ban_Id: bancoId, Flg_Est: 'A' })
              : of([] as unknown);

            return bancoRequest.pipe(map((bancoResponse: unknown) => ({
              ...context,
              bancoResponse
            })));
          })
        );
      })
    ).subscribe({
      next: async ({ ordenCompra, detalleResponse, pedidoResponse, proveedorResponse, proveedorBancoResponse, bancoResponse }) => {
        const logoBytes = await this.loadOrdenCompraLogoBytes();
        const headerImageBytes = await this.loadOrdenCompraHeaderImageBytes();
        const pdfBlob = createOrdenCompraReportPdf(
          this.buildOrdenCompraReportePdfData(ordenCompra, detalleResponse, pedidoResponse, proveedorResponse, proveedorBancoResponse, bancoResponse),
          { logoBytes, headerImageBytes }
        );
        const url = URL.createObjectURL(pdfBlob);
        window.open(url, '_blank');
        this.isLoadingReporteOrdenCompraId = null;
      },
      error: (error: unknown) => {
        console.error('Error generando reporte de orden de compra:', error);
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo generar el PDF de la orden de compra.');
        this.isLoadingReporteOrdenCompraId = null;
      }
    });
  }

  seleccionarOrdenCompra(item: OrdenCompraRow): void {
    this.selectedOrdenCompraId = item.id;
  }

  isOrdenCompraSeleccionada(item: OrdenCompraRow): boolean {
    return this.selectedOrdenCompraId === item.id;
  }

  canAnularOrdenCompra(item: OrdenCompraRow): boolean {
    return item.canEdit && item.estadoCodigo === 'A' && !this.isAnulandoOrdenCompra(item);
  }

  isAnulandoOrdenCompra(item: OrdenCompraRow): boolean {
    return this.isUpdatingEstadoOrdenCompraId === item.id;
  }

  trackByOrdenCompra(_: number, item: OrdenCompraRow): number {
    return item.id;
  }

  trackByCentroCosto(_: number, item: OrdenCompraCentroCostoRow): number {
    return item.id;
  }

  trackByDetallePedido(_: number, item: OrdenCompraDetallePedidoRow): number {
    return item.id;
  }

  confirmarConformidadRegistro(item: OrdenCompraRow, event: Event): void {
    event.stopPropagation();

    if (!this.puedeConfirmarConformidadRegistro(item)) {
      return;
    }

    this.confirmarAccionConformidad(item, 1);
  }

  confirmarConformidadAprobacion(item: OrdenCompraRow, event: Event): void {
    event.stopPropagation();

    if (!this.puedeConfirmarConformidadAprobacion(item)) {
      return;
    }

    this.confirmarAccionConformidad(item, 2);
  }

  puedeConfirmarConformidadRegistro(item: OrdenCompraRow): boolean {
    if (item.conformidadRegistro || this.isUpdatingConformidadOrdenCompraId === item.id) {
      return false;
    }

    const usuarioRegistro = this.normalizeUsuarioConformidad(item.usuarioRegistro);

    if (!usuarioRegistro) {
      return false;
    }

    return usuarioRegistro === this.getUsuarioSesionNormalizado();
  }

  puedeConfirmarConformidadAprobacion(item: OrdenCompraRow): boolean {
    if (item.flgEstCon !== 1 || item.conformidadAprobacion || this.isUpdatingConformidadOrdenCompraId === item.id) {
      return false;
    }

    const usuarioAprobacion = this.normalizeUsuarioConformidad(item.usuarioAprobacionPedido);

    if (!usuarioAprobacion) {
      return false;
    }

    return usuarioAprobacion === this.getUsuarioSesionNormalizado();
  }

  private actualizarEstadoConformidadOrdenCompra(item: OrdenCompraRow, flgEstCon: number): void {
    if (!item.ordenCompraId) {
      return;
    }

    const payload: ActualizarEstadoConfirmacionOrdenCompraRequest = {
      Ord_Com_Id: item.ordenCompraId,
      Flg_Est_Con: flgEstCon
    };

    this.isUpdatingConformidadOrdenCompraId = item.id;
    this.errorMessage = '';

    this.apiService.patchActualizarEstadoConfirmacionOrdenCompra(payload).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo actualizar el estado de conformidad.');
        } catch (error: unknown) {
          this.errorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el estado de conformidad.');
          this.isUpdatingConformidadOrdenCompraId = null;
          return;
        }

        this.ordenesCompra = this.ordenesCompra.map((current) =>
          current.id === item.id
            ? {
                ...current,
                flgEstCon,
                conformidadRegistro: flgEstCon >= 1,
                conformidadAprobacion: flgEstCon >= 2
              }
            : current
        );
        this.isUpdatingConformidadOrdenCompraId = null;
      },
      error: (error: unknown) => {
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el estado de conformidad.');
        this.isUpdatingConformidadOrdenCompraId = null;
      }
    });
  }

  private confirmarAccionConformidad(item: OrdenCompraRow, flgEstCon: number): void {
    const esAprobacion = flgEstCon === 2;
    const dialogData: ConfirmacionDialogData = {
      titulo: esAprobacion ? 'Confirmar conformidad de aprobacion' : 'Confirmar conformidad de registro',
      mensaje: esAprobacion
        ? `Se confirmara la conformidad del usuario de aprobacion para la orden ${item.correlativo}.`
        : `Se confirmara la conformidad del usuario de registro para la orden ${item.correlativo}.`,
      textoConfirmar: 'Confirmar',
      textoCancelar: 'Cancelar'
    };

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '28rem',
      maxWidth: '95vw',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean | undefined) => {
      if (confirmado) {
        this.actualizarEstadoConformidadOrdenCompra(item, flgEstCon);
      }
    });
  }

  private anularOrdenCompra(item: OrdenCompraRow): void {
    if (!item.ordenCompraId) {
      this.errorMessage = 'La orden de compra seleccionada no tiene un identificador valido.';
      return;
    }

    const currentUser = this.authService.getCurrentUser().trim();

    if (!currentUser) {
      this.errorMessage = 'No se encontro el usuario actual de la sesion.';
      return;
    }

    this.isUpdatingEstadoOrdenCompraId = item.id;
    this.errorMessage = '';

    const request: AnularOrdenCompraRequest = {
      Ord_Com_Id: item.ordenCompraId,
      Flg_Est: 'I',
      Usr_Mod: currentUser
    };

    this.apiService.patchAnularOrdenCompra(request).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo anular la orden de compra.');
        } catch (error: unknown) {
          this.errorMessage = this.resolveErrorMessage(error, 'No se pudo anular la orden de compra.');
          this.isUpdatingEstadoOrdenCompraId = null;
          return;
        }

        this.isUpdatingEstadoOrdenCompraId = null;
        this.cargarListadoSeleccionado();
      },
      error: (error: unknown) => {
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo anular la orden de compra.');
        this.isUpdatingEstadoOrdenCompraId = null;
      }
    });
  }

  onOrdenesCompraPageChange(page: number): void {
    this.currentOrdenesCompraPage = normalizePaginationPage(page, this.ordenesCompra.length, this.pageSize);
  }

  onPedidosPendientesPageChange(page: number): void {
    this.currentPedidosPendientesPage = normalizePaginationPage(page, this.pedidosPendientes.length, this.pageSize);
  }

  onDetallePedidoPageChange(page: number): void {
    this.currentDetallePedidoPage = normalizePaginationPage(page, this.pedidoDetalles.length, this.pageSize);
  }

  onMontoInput(controlName: 'subtotal' | 'igv' | 'total', event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = input.value.replace(/[^\d.,]/g, '');

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
    }

    this.form.controls[controlName].setValue(sanitizedValue, { emitEvent: false });
  }

  onDetraccionSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.detraccionSearch = input?.value ?? '';
  }

  onDetraccionChange(): void {
    this.syncTotalesCalculados();
  }

  onIgv18Change(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const checked = !!input?.checked;

    this.form.controls['usarIgv18'].setValue(checked, { emitEvent: false });
    this.form.controls['porcentajeIgv'].setValue(checked ? 18 : 0, { emitEvent: false });

    this.syncTotalesCalculados();
  }

  onPorcentajeIgvInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = this.sanitizeDecimalInput(input.value, 4);

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
    }

    this.form.controls['porcentajeIgv'].setValue(sanitizedValue, { emitEvent: false });
    this.syncTotalesCalculados();
  }

  onDescuentoInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = this.sanitizeDecimalInput(input.value.replace(/,/g, '.'), 2);
    input.value = sanitizedValue;
    this.form.controls['descuento'].setValue(sanitizedValue, { emitEvent: false });
    this.syncTotalesCalculados();
  }

  onDescuentoTipoChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.form.controls['descuentoPorcentaje'].setValue(!!input?.checked, { emitEvent: false });
    this.syncTotalesCalculados();
  }

  private getDetraccionIdSeleccionada(): number {
    const value = this.form.controls['detraccionId'].value;
    const detraccionId = Number(value);

    return Number.isInteger(detraccionId) && detraccionId > 0 ? detraccionId : 0;
  }

  actualizarObservacionDetallePedido(item: OrdenCompraDetallePedidoRow, observacion: string): void {
    this.pedidoDetalles = this.pedidoDetalles.map((detalle) =>
      detalle.id === item.id
        ? { ...detalle, observacion }
        : detalle
    );
  }

  actualizarCostoUnitarioDetallePedido(item: OrdenCompraDetallePedidoRow, event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = this.sanitizeDecimalInput(input.value, 4);

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
    }

    const costoUnitario = this.parseMontoControlValue(sanitizedValue, 4);
    const descuento = this.normalizeDetalleDescuento(costoUnitario, item.descuento, item.descuentoPorcentaje);
    const costoUnitarioConDescuento = this.calcularCostoUnitarioDetalle(
      costoUnitario,
      descuento,
      item.descuentoPorcentaje
    );
    const subtotal = this.normalizeDecimalPrecision(item.cantidad * costoUnitarioConDescuento, 4);

    this.pedidoDetalles = this.pedidoDetalles.map((detalle) =>
      detalle.id === item.id
        ? { ...detalle, costoUnitario, costoUnitarioConDescuento, descuento, subtotal }
        : detalle
    );
    this.syncTotalesCalculados();
  }

  actualizarCantidadDetallePedido(item: OrdenCompraDetallePedidoRow, event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = this.sanitizeDecimalInput(input.value);

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
    }

    const cantidad = this.parseMontoControlValue(sanitizedValue);
    const subtotal = this.normalizeDecimalPrecision(cantidad * item.costoUnitarioConDescuento, 4);

    this.pedidoDetalles = this.pedidoDetalles.map((detalle) =>
      detalle.id === item.id
        ? { ...detalle, cantidad, subtotal }
        : detalle
    );
    this.syncTotalesCalculados();
  }

  actualizarTipoDescuentoDetallePedido(item: OrdenCompraDetallePedidoRow, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const descuentoPorcentaje = !!input?.checked;
    const descuento = this.normalizeDetalleDescuento(item.costoUnitario, item.descuento, descuentoPorcentaje);
    const costoUnitarioConDescuento = this.calcularCostoUnitarioDetalle(
      item.costoUnitario,
      descuento,
      descuentoPorcentaje
    );
    const subtotal = this.normalizeDecimalPrecision(item.cantidad * costoUnitarioConDescuento, 4);

    this.pedidoDetalles = this.pedidoDetalles.map((detalle) =>
      detalle.id === item.id
        ? { ...detalle, descuentoPorcentaje, descuento, costoUnitarioConDescuento, subtotal }
        : detalle
    );
    this.syncTotalesCalculados();
  }

  actualizarDescuentoDetallePedido(item: OrdenCompraDetallePedidoRow, event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = this.sanitizeDecimalInput(input.value.replace(/,/g, '.'), 4);
    const descuentoIngresado = this.parseMontoControlValue(sanitizedValue, 4);
    const descuento = this.normalizeDetalleDescuento(
      item.costoUnitario,
      descuentoIngresado,
      item.descuentoPorcentaje
    );
    const costoUnitarioConDescuento = this.calcularCostoUnitarioDetalle(
      item.costoUnitario,
      descuento,
      item.descuentoPorcentaje
    );
    const subtotal = this.normalizeDecimalPrecision(item.cantidad * costoUnitarioConDescuento, 4);
    input.value = descuento === descuentoIngresado ? sanitizedValue : String(descuento);

    this.pedidoDetalles = this.pedidoDetalles.map((detalle) =>
      detalle.id === item.id
        ? { ...detalle, descuento, costoUnitarioConDescuento, subtotal }
        : detalle
    );
    this.syncTotalesCalculados();
  }

  actualizarSubtotalDetallePedido(item: OrdenCompraDetallePedidoRow, event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = this.sanitizeDecimalInput(input.value, 4);

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
    }

    const subtotal = this.parseMontoControlValue(sanitizedValue, 4);

    this.pedidoDetalles = this.pedidoDetalles.map((detalle) =>
      detalle.id === item.id
        ? { ...detalle, subtotal }
        : detalle
    );
    this.syncTotalesCalculados();
  }

  isDetallePendienteDesasignacion(item: OrdenCompraDetallePedidoRow): boolean {
    return this.detallesPendientesDesasignacion.some((detalle) => detalle.id === item.id);
  }

  quitarDetallePedido(item: OrdenCompraDetallePedidoRow): void {
    if (!this.isEditingOrdenCompra || this.isLoadingPedidoDetalle || this.isSavingOrdenCompra) {
      return;
    }

    this.detallePedidoErrorMessage = '';

    if (this.isDetallePendienteDesasignacion(item)) {
      this.detallesPendientesDesasignacion = this.detallesPendientesDesasignacion.filter((detalle) => detalle.id !== item.id);
      this.detallePedidoErrorMessage = this.detallesPendientesDesasignacion.length
        ? 'Hay detalles marcados para desasignacion. Los cambios se aplicaran al actualizar.'
        : '';
      this.syncTotalesCalculados();
      return;
    }

    this.detallesPendientesDesasignacion = [...this.detallesPendientesDesasignacion, item];
    this.syncTotalesCalculados();
    this.detallePedidoErrorMessage = 'El detalle fue marcado para desasignacion. Los cambios se aplicaran al actualizar.';
  }

  onPedidoIdEnter(event: Event): void {
    event.preventDefault();

    if (this.isLoadingPedidoCentrosCosto || this.isLoadingPedidoDetalle) {
      return;
    }

    this.cargarCentrosCostoDesdePedido();
  }

  openFechaAtencionPicker(event: Event): void {
    const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
    input.showPicker?.();
  }

  openProveedorDialog(): void {
    if (this.isLoadingProveedores) {
      return;
    }

    if (!this.proveedores.length) {
      this.saveErrorMessage = 'No hay proveedores activos disponibles.';
      return;
    }

    const dialogRef = this.dialog.open(ProviderSelectorDialogComponent, {
      autoFocus: false,
      width: '40rem',
      data: {
        providers: this.proveedores
      }
    });

    dialogRef.afterClosed().subscribe((provider?: ProviderRecord) => {
      if (!provider) {
        return;
      }

      this.form.patchValue({
        proveedorId: provider.code,
        proveedorBancoId: 0,
        proveedor: provider.name,
        telefono: provider.phone,
        direccion: provider.address,
        contacto: provider.contact,
        ruc: provider.ruc
      });
      this.cargarBancosProveedor(provider.code);
    });
  }

  private cargarBancosProveedor(proveedorId: number, proveedorBancoId = 0): void {
    this.proveedorBancos = [];
    this.form.controls['proveedorBancoId'].setValue(0);

    if (!proveedorId) {
      return;
    }

    this.isLoadingProveedorBancos = true;
    this.apiService.getListarProveedorBanco({ Prv_Id: proveedorId }).subscribe({
      next: (response: unknown) => {
        this.proveedorBancos = this.extractRecords(response)
          .map((item) => this.mapProveedorBancoReporte(item))
          .filter((item): item is OrdenCompraProveedorBancoReporte => item !== null);
        const bancoSeleccionado = this.proveedorBancos.some((item) => item.id === proveedorBancoId)
          ? proveedorBancoId
          : 0;
        this.form.controls['proveedorBancoId'].setValue(bancoSeleccionado);
        this.isLoadingProveedorBancos = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando bancos del proveedor:', error);
        this.proveedorBancos = [];
        this.form.controls['proveedorBancoId'].setValue(0);
        this.isLoadingProveedorBancos = false;
      }
    });
  }

  onFormaPagoChange(formaPagoId: number | null): void {
    const selectedFormaPago = this.formasPago.find((item) => item.code === Number(formaPagoId));

    this.form.patchValue({
      formaPago: selectedFormaPago?.description ?? ''
    });
  }

  toggleCentroCosto(item: OrdenCompraCentroCostoRow): void {
    this.centrosCosto = this.centrosCosto.map((centroCosto) =>
      centroCosto.id === item.id
        ? { ...centroCosto, selected: !centroCosto.selected }
        : centroCosto
    );
  }

  toggleTodosLosCentrosCosto(): void {
    if (!this.centrosCosto.length) {
      return;
    }

    const shouldSelect = !this.estanTodosLosCentrosSeleccionados;

    this.centrosCosto = this.centrosCosto.map((item) => ({
      ...item,
      selected: shouldSelect
    }));
  }

  toggleDetallePedido(item: OrdenCompraDetallePedidoRow): void {
    this.pedidoDetalles = this.pedidoDetalles.map((detalle) =>
      detalle.id === item.id
        ? { ...detalle, selected: !detalle.selected }
        : detalle
    );
    this.syncTotalesCalculados();
  }

  toggleTodosLosDetallesPedido(): void {
    if (!this.pedidoDetalles.length) {
      return;
    }

    const shouldSelect = !this.estanTodosLosDetallesSeleccionados;

    this.pedidoDetalles = this.pedidoDetalles.map((item) => ({
      ...item,
      selected: shouldSelect
    }));
    this.syncTotalesCalculados();
  }

  cargarCentrosCostoDesdePedido(totalOrdenGuardado?: number): void {
    const pedidoId = Number(this.form.controls['pedidoIdAtencion'].value);

    this.centrosCostoErrorMessage = '';
    this.detallePedidoErrorMessage = '';
    this.saveErrorMessage = '';

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      this.centrosCosto = [];
      this.pedidoDetalles = [];
      this.centrosCostoErrorMessage = 'Ingresa un numero de pedido valido para cargar sus centros de costo.';
      return;
    }

    this.isLoadingPedidoCentrosCosto = true;
    this.isLoadingPedidoDetalle = true;
    this.centrosCosto = [];
    this.pedidoDetalles = [];
    this.pedidoArchivoAdjunto = 'Sin archivo adjunto';
    this.currentDetallePedidoPage = 1;

    this.loadPedidoData(pedidoId).subscribe({
      next: ({ centrosCostoResponse, detalleResponse, pedidoResponse }) => {
        this.applyPedidoDataResponse(
          centrosCostoResponse,
          detalleResponse,
          pedidoResponse,
          totalOrdenGuardado
        );
      },
      error: (error: unknown) => {
        this.handlePedidoDataError(error, totalOrdenGuardado);
      }
    });
  }

  guardarOrdenCompra(): void {
    this.saveErrorMessage = '';

    if (this.debeConfirmarRegistroParcial()) {
      this.confirmarRegistroParcial();
      return;
    }

    this.ejecutarGuardarOrdenCompra();
  }

  private ejecutarGuardarOrdenCompra(): void {
    const request$ = this.isEditingOrdenCompra
      ? this.buildActualizarOrdenCompraRequest()
      : this.buildRegistrarOrdenCompraRequest();

    if (!request$) {
      return;
    }

    this.isSavingOrdenCompra = true;

    request$.pipe(
      switchMap((response: unknown) => {
        this.assertSuccessfulResponse(response, 'No se pudo guardar la orden de compra.');
        return this.resolveOrdenCompraIdParaAsignacion(response).pipe(
          switchMap((ordenCompraId) => this.sincronizarArchivosAdjuntosOrdenCompra(ordenCompraId)),
          map(() => response)
        );
      }),
      switchMap((response: unknown) => {
        return this.sincronizarDetallePedidoSeleccionado(response);
      })
    ).subscribe({
      next: () => {
        this.isSavingOrdenCompra = false;
        this.cerrarEditor();
        this.cargarListadoSeleccionado();
        window.dispatchEvent(new CustomEvent('process-notifications-refresh'));
      },
      error: (error: unknown) => {
        this.isSavingOrdenCompra = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo guardar la orden de compra.');
      }
    });
  }

  private debeConfirmarRegistroParcial(): boolean {
    if (this.isEditingOrdenCompra || !this.pedidoDetalles.length) {
      return false;
    }

    const totalDetalles = this.pedidoDetalles.length;
    const totalSeleccionados = this.detallesPedidoSeleccionados.length;

    return totalSeleccionados > 0 && totalSeleccionados < totalDetalles;
  }

  private confirmarRegistroParcial(): void {
    const dialogRef = this.dialog.open(OrdenCompraParcialDialogComponent, {
      autoFocus: false,
      width: '28rem'
    });

    dialogRef.afterClosed().subscribe((confirmado?: boolean) => {
      if (confirmado) {
        this.ejecutarGuardarOrdenCompra();
      }
    });
  }

  cancelarEdicion(): void {
    this.cerrarEditor();
  }

  onOrdenCompraFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files?.length) {
      return;
    }

    const archivosSeleccionados = Array.from(input.files);
    this.ordenCompraArchivoFiles = [
      ...this.ordenCompraArchivoFiles,
      ...archivosSeleccionados.filter((archivo) =>
        !this.ordenCompraArchivosAdjuntosGuardados.some((existente) =>
          existente.nombre.toLowerCase() === archivo.name.toLowerCase()
        ) &&
        !this.ordenCompraArchivoFiles.some((existente) =>
          existente.name === archivo.name &&
          existente.size === archivo.size &&
          existente.lastModified === archivo.lastModified
        )
      )
    ];
    this.ordenCompraArchivoFile = this.ordenCompraArchivoFiles[0] ?? null;
    this.ordenCompraArchivoAdjunto = this.ordenCompraArchivoFile?.name ?? 'Sin archivo adjunto';
    this.ordenCompraArchivoRuta = '';
    this.actualizarOrdenCompraArchivoFormControl();
    input.value = '';
  }

  quitarOrdenCompraArchivoAdjunto(archivo: OrdenCompraArchivoAdjuntoVista, fileInput?: HTMLInputElement): void {
    if (archivo.local) {
      this.ordenCompraArchivoFiles.splice(archivo.index, 1);
      this.ordenCompraArchivoFile = this.ordenCompraArchivoFiles[0] ?? null;
      this.ordenCompraArchivoAdjunto = this.ordenCompraArchivoFile?.name ?? 'Sin archivo adjunto';
      this.actualizarOrdenCompraArchivoFormControl();

      if (fileInput) {
        fileInput.value = '';
      }

      return;
    }

    if (archivo.id > 0) {
      const request: RegistrarArchivoAdjuntoOrdenCompraRequest = {
        Ord_Com_Arc_Id: archivo.id,
        Ord_Com_Id: archivo.ordenCompraId,
        Ord_Com_Arc_Rut: archivo.ruta,
        Ord_Com_Arc_Nom: archivo.nombre
      };

      this.apiService.deleteEliminarArchivoAdjuntoOrdenCompra(request).subscribe({
        next: (response: unknown) => {
          this.assertSuccessfulResponse(response, 'No se pudo eliminar el archivo adjunto de la orden de compra.');
          this.ordenCompraArchivosAdjuntosGuardados = this.ordenCompraArchivosAdjuntosGuardados
            .filter((item) => item.id !== archivo.id);
          this.actualizarOrdenCompraArchivoFormControl();
        },
        error: (error: unknown) => {
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo eliminar el archivo adjunto de la orden de compra.');
        }
      });
    } else {
      this.ordenCompraArchivosAdjuntosGuardados = this.ordenCompraArchivosAdjuntosGuardados
        .filter((item) => item.nombre !== archivo.nombre);
      this.actualizarOrdenCompraArchivoFormControl();
    }

    if (fileInput) {
      fileInput.value = '';
    }
  }

  verOrdenCompraArchivoAdjunto(archivo: OrdenCompraArchivoAdjuntoVista): void {
    this.saveErrorMessage = '';

    if (archivo.local) {
      const archivoLocal = this.ordenCompraArchivoFiles[archivo.index];

      if (!archivoLocal) {
        this.saveErrorMessage = 'No se encontro el archivo para visualizar.';
        return;
      }

      this.openArchivoLocalEnChrome(archivoLocal);
      return;
    }

    const nombreArchivo = archivo.nombre.trim();

    if (nombreArchivo && nombreArchivo !== 'Sin archivo adjunto') {
      this.apiService.getArchivoOrdenCompra(nombreArchivo).subscribe({
        next: (arrayBuffer: ArrayBuffer) => {
          this.openArrayBufferArchivoEnChrome(nombreArchivo, arrayBuffer);
        },
        error: (error: unknown) => {
          console.error('Error abriendo archivo de orden de compra:', error);
          this.saveErrorMessage = 'No se pudo abrir el archivo de la orden de compra.';
        }
      });
      return;
    }

    this.saveErrorMessage = 'No hay archivo adjunto para visualizar.';
  }

  get ordenCompraArchivosAdjuntosVista(): OrdenCompraArchivoAdjuntoVista[] {
    const archivosGuardados = this.ordenCompraArchivosAdjuntosGuardados.map((archivo) => ({
      id: archivo.id,
      ordenCompraId: archivo.ordenCompraId,
      nombre: archivo.nombre,
      ruta: archivo.ruta,
      local: false,
      index: -1
    }));
    const archivosLocales = this.ordenCompraArchivoFiles.map((archivo, index) => ({
      id: 0,
      ordenCompraId: Number(this.form.controls['ordenCompraId'].value) || 0,
      nombre: archivo.name,
      ruta: '',
      local: true,
      index
    }));

    return [...archivosGuardados, ...archivosLocales];
  }

  private actualizarOrdenCompraArchivoFormControl(): void {
    const archivo = this.ordenCompraArchivosAdjuntosVista
      .map((item) => item.nombre)
      .filter((nombre) => !!nombre)
      .join(', ') || 'Sin archivo adjunto';

    this.ordenCompraArchivoAdjunto = archivo;

    this.form.patchValue({ archivo }, { emitEvent: false });
  }

  private cargarArchivosAdjuntosOrdenCompra(ordenCompraId: number): void {
    if (!Number.isInteger(ordenCompraId) || ordenCompraId <= 0) {
      this.ordenCompraArchivosAdjuntosGuardados = [];
      this.actualizarOrdenCompraArchivoFormControl();
      return;
    }

    this.apiService.getListarArchivosAdjuntosOrdenCompra(ordenCompraId).subscribe({
      next: (response: unknown) => {
        const archivos = this.extractRecords(response)
          .map((item) => this.mapOrdenCompraArchivoAdjunto(item, ordenCompraId))
          .filter((item): item is OrdenCompraArchivoAdjuntoGuardado => item !== null);

        console.log('[OrdenCompra][Archivos adjuntos][Respuesta backend]', {
          ordenCompraId,
          response,
          archivos
        });

        this.ordenCompraArchivosAdjuntosGuardados = archivos;
        this.actualizarOrdenCompraArchivoFormControl();
      },
      error: (error: unknown) => {
        console.error('Error cargando archivos adjuntos de orden de compra:', error);
        this.ordenCompraArchivosAdjuntosGuardados = [];
        this.actualizarOrdenCompraArchivoFormControl();
      }
    });
  }

  private sincronizarArchivosAdjuntosOrdenCompra(ordenCompraId: number): Observable<unknown> {
    if (!this.ordenCompraArchivoFiles.length) {
      return of([]);
    }

    return from(this.ordenCompraArchivoFiles).pipe(
      concatMap((archivo) => {
        const request: RegistrarArchivoAdjuntoOrdenCompraRequest = {
          Ord_Com_Arc_Id: 0,
          Ord_Com_Id: ordenCompraId,
          Ord_Com_Arc_Nom: archivo.name,
          Ord_Com_Arc_Rut: ''
        };

        return this.apiService.postRegistrarArchivoAdjuntoOrdenCompra(request, archivo).pipe(
          map((response: unknown) => {
            this.assertSuccessfulResponse(response, `No se pudo registrar el archivo ${archivo.name}.`);
            return response;
          })
        );
      }),
      toArray()
    );
  }

  private mapOrdenCompraArchivoAdjunto(item: DataRecord, fallbackOrdenCompraId: number): OrdenCompraArchivoAdjuntoGuardado | null {
    const id = this.getNumberValue(item, [
      'Ord_Com_Arc_Id',
      'ord_Com_Arc_Id',
      'ordComArcId'
    ]) || 0;
    const ordenCompraId = this.getNumberValue(item, [
      'Ord_Com_Id',
      'ord_Com_Id',
      'ordComId'
    ]) || fallbackOrdenCompraId;
    const nombre = this.getTextValue(item, [
      'Ord_Com_Arc_Nom',
      'ord_Com_Arc_Nom',
      'ordComArcNom',
      'Archivo',
      'archivo',
      'Nombre',
      'nombre'
    ]);
    const ruta = this.getTextValue(item, [
      'Ord_Com_Arc_Rut',
      'ord_Com_Arc_Rut',
      'ordComArcRut',
      'Ruta',
      'ruta'
    ]);

    if (!nombre) {
      return null;
    }

    return {
      id,
      ordenCompraId,
      nombre,
      ruta
    };
  }

  verPedidoArchivo(): void {
    this.saveErrorMessage = '';
    const nombreArchivo = this.pedidoArchivoAdjunto.trim();

    if (!nombreArchivo || nombreArchivo === 'Sin archivo adjunto') {
      this.saveErrorMessage = 'El pedido seleccionado no tiene PDF adjunto para visualizar.';
      return;
    }

    this.apiService.getArchivoPedido(nombreArchivo).subscribe({
      next: (arrayBuffer: ArrayBuffer) => {
        this.openArrayBufferArchivoEnChrome(nombreArchivo, arrayBuffer);
      },
      error: (error: unknown) => {
        console.error('Error abriendo archivo del pedido:', error);
        this.saveErrorMessage = 'No se pudo abrir el archivo asignado al pedido.';
      }
    });
  }

  abrirArchivosPedido(): void {
    this.saveErrorMessage = '';
    const pedidoId = Number(this.form.controls['pedidoIdAtencion'].value);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      this.saveErrorMessage = 'Ingresa un numero de pedido valido para listar sus archivos.';
      this.form.controls['pedidoIdAtencion'].markAsTouched();
      return;
    }

    this.isLoadingPedidoArchivosAdjuntos = true;
    console.log('[OrdenCompra][Archivos adjuntos][Ped_Cab_Id enviado]', pedidoId);

    this.apiService.getListarArchivosAdjuntos(pedidoId).subscribe({
      next: (response: unknown) => {
        console.log('[OrdenCompra][Archivos adjuntos][Respuesta backend]', response);
        const archivos = this.extractRecords(response)
          .map((record) => this.mapPedidoArchivoAdjunto(record))
          .filter((archivo): archivo is PedidoArchivoDialogRow => archivo !== null);
        console.log('[OrdenCompra][Archivos adjuntos][Mapeados popup]', archivos);
        this.isLoadingPedidoArchivosAdjuntos = false;

        this.dialog.open(PedidoArchivosDialogComponent, {
          width: 'min(720px, 96vw)',
          maxWidth: '96vw',
          data: {
            pedidoCodigo: `PED-${pedidoId}`,
            archivos,
            verArchivo: (archivo: PedidoArchivoDialogRow) => this.abrirArchivoPedidoPorNombre(archivo.nombre)
          }
        });
      },
      error: (error: unknown) => {
        console.error('[OrdenCompra][Archivos adjuntos][Error]', error);
        this.isLoadingPedidoArchivosAdjuntos = false;
        this.saveErrorMessage = 'No se pudieron cargar los archivos adjuntos del pedido.';
      }
    });
  }

  private abrirArchivoPedidoPorNombre(nombreArchivo: string): void {
    const nombre = nombreArchivo.trim();

    if (!nombre) {
      this.saveErrorMessage = 'No se encontro el nombre del archivo para visualizar.';
      return;
    }

    this.apiService.getArchivoPedido(nombre).subscribe({
      next: (arrayBuffer: ArrayBuffer) => {
        this.openArrayBufferArchivoEnChrome(nombre, arrayBuffer);
      },
      error: (error: unknown) => {
        console.error('[OrdenCompra][Archivo adjunto][Error]', error);
        this.saveErrorMessage = 'No se pudo abrir el archivo del pedido.';
      }
    });
  }

  abrirArchivosOrdenCompraListado(item: OrdenCompraRow, event?: Event): void {
    event?.stopPropagation();
    this.errorMessage = '';

    const ordenCompraId = item.ordenCompraId ?? 0;

    if (!Number.isInteger(ordenCompraId) || ordenCompraId <= 0) {
      this.errorMessage = 'La orden de compra seleccionada no tiene un identificador valido.';
      return;
    }

    this.isLoadingArchivosOrdenCompraListado = item.id;

    this.apiService.getListarArchivosAdjuntosOrdenCompra(ordenCompraId).subscribe({
      next: (response: unknown) => {
        const archivos = this.extractRecords(response)
          .map((record) => this.mapOrdenCompraArchivoAdjunto(record, ordenCompraId))
          .filter((archivo): archivo is OrdenCompraArchivoAdjuntoGuardado => archivo !== null)
          .map((archivo): PedidoArchivoDialogRow => ({
            id: archivo.id,
            pedidoId: archivo.ordenCompraId,
            nombre: archivo.nombre,
            ruta: archivo.ruta
          }));

        this.isLoadingArchivosOrdenCompraListado = null;

        this.dialog.open(PedidoArchivosDialogComponent, {
          width: 'min(720px, 96vw)',
          maxWidth: '96vw',
          data: {
            pedidoCodigo: `OC-${ordenCompraId}`,
            archivos,
            verArchivo: (archivo: PedidoArchivoDialogRow) => this.abrirArchivoOrdenCompraPorNombre(archivo.nombre)
          }
        });
      },
      error: (error: unknown) => {
        console.error('[OrdenCompra][Archivos adjuntos listado][Error]', error);
        this.isLoadingArchivosOrdenCompraListado = null;
        this.errorMessage = 'No se pudieron cargar los archivos adjuntos de la orden de compra.';
      }
    });
  }

  private abrirArchivoOrdenCompraPorNombre(nombreArchivo: string): void {
    const nombre = nombreArchivo.trim();

    if (!nombre) {
      this.errorMessage = 'No hay archivo adjunto para visualizar.';
      return;
    }

    this.apiService.getArchivoOrdenCompra(nombre).subscribe({
      next: (arrayBuffer: ArrayBuffer) => {
        this.openArrayBufferArchivoEnChrome(nombre, arrayBuffer);
      },
      error: (error: unknown) => {
        console.error('Error abriendo archivo de orden de compra:', error);
        this.errorMessage = 'No se pudo abrir el archivo de la orden de compra.';
      }
    });
  }

  private mapPedidoArchivoAdjunto(item: DataRecord): PedidoArchivoDialogRow | null {
    const nombre = this.getTextValue(item, [
      'Ped_Cab_Arc_Nom',
      'ped_Cab_Arc_Nom',
      'pedCabArcNom',
      'Archivo',
      'archivo',
      'Nombre',
      'nombre'
    ]);

    if (!nombre) {
      return null;
    }

    return {
      id: this.getNumberValue(item, ['Ped_Cab_Arc_Id', 'ped_Cab_Arc_Id', 'pedCabArcId']) ?? 0,
      pedidoId: this.getNumberValue(item, ['Ped_Cab_Id', 'ped_Cab_Id', 'pedCabId']) ?? 0,
      nombre,
      ruta: this.getTextValue(item, [
        'Ped_Cab_Arc_Rut',
        'ped_Cab_Arc_Rut',
        'pedCabArcRut',
        'Ruta',
        'ruta'
      ])
    };
  }

  formatCurrency(value: number): string {
    return this.formatCurrencyWithPrecision(value, 2);
  }

  formatCurrencyWithPrecision(value: number, precision: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }).format(value);
  }

  private iniciarNuevaOrdenCompra(): void {
    this.isEditingOrdenCompra = false;
    this.resetEditor();
    this.esParcial = false;
    this.aplicarModoCentrosCosto();
    this.mostrarEditor = true;
  }

  private iniciarEdicionOrdenCompra(): void {
    const ordenCompra = this.getOrdenCompraSeleccionada();

    if (!ordenCompra || !ordenCompra.canEdit || ordenCompra.ordenCompraId === null) {
      this.errorMessage = 'La orden listada no incluye identificador de O/C para modificarla.';
      return;
    }

    this.isEditingOrdenCompra = true;
    this.errorMessage = '';
    this.cargarOrdenCompraParaModificar(ordenCompra);
  }

  private cerrarVistaActual(): void {
    if (this.mostrarEditor) {
      this.cerrarEditor();
      return;
    }

    this.selectedOrdenCompraId = null;
  }

  private cerrarEditor(): void {
    this.mostrarEditor = false;
    this.isEditingOrdenCompra = false;
    this.saveErrorMessage = '';
    this.resetEditor();
  }

  private resetEditor(): void {
      this.form.reset({
        ordenCompraId: null,
        pedidoIdAtencion: null,
        proveedorId: 0,
        proveedorBancoId: 0,
        proveedor: '',
        telefono: '',
        direccion: '',
        contacto: '',
        ruc: '',
        formaPagoId: 0,
        formaPago: '',
      referenciaObra: '',
      referencia: '',
      pedidoReferenciaGeneral: '',
      observacion: '',
      archivo: 'Sin archivo adjunto',
        monedaId: 0,
        descripcionGeneral: '',
        fechaAtencion: this.getTodayDateInputValue(),
        direccionEnvio: '',
        periodoGasto: 0,
      detraccionId: null,
      montoDetraccion: 0,
      descuento: 0,
      descuentoPorcentaje: false,
      subtotal: 0,
      usarIgv18: true,
      porcentajeIgv: 18,
      igv: 0,
      total: 0,
      estado: 'A'
    });
    this.esParcial = false;
    this.detraccionSearch = '';
    this.proveedorBancos = [];
    this.isLoadingProveedorBancos = false;
    this.centrosCosto = [];
    this.pedidoDetalles = [];
    this.detallesPendientesDesasignacion = [];
    this.centrosCostoErrorMessage = '';
    this.detallePedidoErrorMessage = '';
    this.ordenCompraArchivoAdjunto = 'Sin archivo adjunto';
    this.ordenCompraArchivoRuta = '';
    this.ordenCompraArchivoFile = null;
    this.ordenCompraArchivoFiles = [];
    this.ordenCompraArchivosAdjuntosGuardados = [];
    this.pedidoArchivoAdjunto = 'Sin archivo adjunto';
    this.syncTotalesCalculados();
  }

  private aplicarModoCentrosCosto(): void {
    this.centrosCosto = this.centrosCosto.map((item) => ({
      ...item,
      selected: false
    }));
    this.pedidoDetalles = this.pedidoDetalles.map((item) => ({
      ...item,
      selected: false
    }));
    this.syncTotalesCalculados();
  }

  private buildRegistrarOrdenCompraRequest(): Observable<unknown> | null {
    const payload = this.buildOrdenCompraPayloadBase();

    if (!payload) {
      return null;
    }

    const currentUser = this.authService.getCurrentUser().trim();

    if (!currentUser) {
      this.saveErrorMessage = 'No se encontro el usuario actual de la sesion.';
      return null;
    }

    const request: RegistrarOrdenCompraRequest = {
      ...payload,
      Usr_Reg: currentUser
    };

    return this.apiService.postRegistrarOrdenCompra(request, null);
  }

  private buildActualizarOrdenCompraRequest(): Observable<unknown> | null {
    const payload = this.buildOrdenCompraPayloadBase();

    if (!payload) {
      return null;
    }

    const currentUser = this.authService.getCurrentUser().trim();
    const ordenCompraId = Number(this.form.controls['ordenCompraId'].value);

    if (!currentUser) {
      this.saveErrorMessage = 'No se encontro el usuario actual de la sesion.';
      return null;
    }

    if (!Number.isInteger(ordenCompraId) || ordenCompraId <= 0) {
      this.saveErrorMessage = 'La orden de compra seleccionada no tiene un identificador valido.';
      return null;
    }

    const request: ActualizarOrdenCompraRequest = {
      Ord_Com_Id: ordenCompraId,
      ...payload,
      Ord_Com_Arc_Adj_Nom: this.getArchivoAdjuntoActual(),
      Ord_Com_Arc_Adj_Rut: this.ordenCompraArchivoRuta || undefined,
      Flg_Est: String(this.form.controls['estado'].value || 'A'),
      Usr_Mod: currentUser
    };

    console.log('Actualizar orden de compra - valores enviados:', {
      request,
      archivo: this.ordenCompraArchivoFile
        ? {
            name: this.ordenCompraArchivoFile.name,
            size: this.ordenCompraArchivoFile.size,
            type: this.ordenCompraArchivoFile.type
          }
        : null
    });

    return this.apiService.patchActualizarOrdenCompra(request, null);
  }

  private buildOrdenCompraPayloadBase(): Omit<RegistrarOrdenCompraRequest, 'Usr_Reg'> | null {
    const proveedorId = Number(this.form.controls['proveedorId'].value);
    const proveedorBancoId = Number(this.form.controls['proveedorBancoId'].value) || 0;
    const pedidoIdAtencion = Number(this.form.controls['pedidoIdAtencion'].value);
    const proveedor = String(this.form.controls['proveedor'].value || '').trim();
    const formaPagoId = Number(this.form.controls['formaPagoId'].value);
    const formaPago = String(this.form.controls['formaPago'].value || '').trim();
    const contacto = String(this.form.controls['contacto'].value || '').trim();
    const monedaId = Number(this.form.controls['monedaId'].value);
    const descripcionGeneral = String(this.form.controls['descripcionGeneral'].value || '').trim();
    const fechaAtencion = String(this.form.controls['fechaAtencion'].value || '').trim();
    const direccionEnvio = String(this.form.controls['direccionEnvio'].value || '').trim();
    const periodoGasto = Number(this.form.controls['periodoGasto'].value);
    const descuento = this.descuentoValorNormalizado;
    const descuentoPorcentaje = Boolean(this.form.controls['descuentoPorcentaje'].value);
    const referenciaObra = String(this.form.controls['referenciaObra'].value || '').trim();
    const referencia = String(this.form.controls['referencia'].value || '').trim();
    const observacion = String(this.form.controls['observacion'].value || '').trim();
    const subtotal = this.parseMontoControlValue(this.form.controls['subtotal'].value);
    const igv = this.parseMontoControlValue(this.form.controls['igv'].value, 4);
    const total = this.parseMontoControlValue(this.form.controls['total'].value);
    const detraccionId = this.getDetraccionIdSeleccionada();
    const montoDetraccion = this.aplicarRedondeoMontoDetraccion(
      this.parseMontoControlValue(this.form.controls['montoDetraccion'].value),
      detraccionId
    );
    const usarIgvAutomatico = Boolean(this.form.controls['usarIgv18'].value);
    const porcentajeIgv = this.getPorcentajeIgv();

    if (!proveedorId || !proveedor) {
      this.form.controls['proveedor'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un proveedor antes de guardar.';
      return null;
    }

    if (!Number.isInteger(pedidoIdAtencion) || pedidoIdAtencion <= 0) {
      this.form.controls['pedidoIdAtencion'].markAsTouched();
      this.saveErrorMessage = 'Ingresa un numero de pedido valido antes de guardar.';
      return null;
    }

    if (!formaPagoId || !formaPago) {
      this.form.controls['formaPago'].markAsTouched();
      this.saveErrorMessage = 'Selecciona una forma de pago antes de guardar.';
      return null;
    }

    if (!Number.isInteger(monedaId) || monedaId <= 0) {
      this.form.controls['monedaId'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un tipo de moneda antes de guardar.';
      return null;
    }

    if (!this.detallesPedidoSeleccionados.length && !(this.isEditingOrdenCompra && this.detallesPendientesDesasignacion.length)) {
      this.saveErrorMessage = 'Selecciona al menos una fila del detalle para la orden de compra.';
      return null;
    }

    if (!this.isEditingOrdenCompra && total <= 0) {
      this.saveErrorMessage = 'El total debe ser mayor a cero.';
      return null;
    }

    return {
      Ord_Com_Tip: this.ordenCompraTipoId,
      Ord_Com_Prv: proveedorId,
      Prv_Ban_Id: proveedorBancoId,
      Ord_Com_For_Pag: formaPagoId,
      Con_Nom: contacto,
      Ord_Com_Des_Gral: descripcionGeneral,
      Ord_Com_Fec_Ate: fechaAtencion,
      Ord_Com_Dir_Env: direccionEnvio,
      Ord_Com_Per_Gas: Number.isInteger(periodoGasto) && periodoGasto >= 1 && periodoGasto <= 12 ? periodoGasto : 0,
      Ord_Com_Des: descuento,
      Flg_Des_Por: descuentoPorcentaje ? 1 : 0,
      Ord_Com_Ref_Obr: referenciaObra,
      Ord_Com_Obs: observacion,
      Ord_Com_Ref: referencia,
      Mon_Id: monedaId,
      Ord_Com_Sub_Tot: subtotal,
      Ord_Com_Igv: igv,
      Ord_Com_Tot: total,
      Ord_Com_Ped_Id: pedidoIdAtencion,
      Ord_Com_Det_Id: Number.isInteger(detraccionId) && detraccionId > 0 ? detraccionId : 0,
      Ord_Com_Det_Mon: montoDetraccion > 0 ? montoDetraccion : 0,
      Flg_Igv_Aut: usarIgvAutomatico ? 'S' : 'N',
      Igv_Por: porcentajeIgv >= 0 ? porcentajeIgv : 0
    };
  }

  private sincronizarDetallePedidoSeleccionado(response: unknown): Observable<unknown> {
    if (!this.detallesPedidoSeleccionados.length && !this.detallesPendientesDesasignacion.length) {
      return of(response);
    }

    return this.resolveOrdenCompraIdParaAsignacion(response).pipe(
      switchMap((ordenCompraId) => {
        const currentUser = this.authService.getCurrentUser().trim();
        const actualizarDetalleRequests = this.detallesPedidoSeleccionados.map((item) =>
          this.apiService.patchActualizarDetallePedido(
            this.buildActualizarDetallePedidoPayload(item, currentUser)
          ).pipe(
            switchMap((patchResponse: unknown) => {
              this.assertSuccessfulResponse(patchResponse, 'No se pudo actualizar el costo de un detalle del pedido.');
              return of(patchResponse);
            })
          )
        );
        // Reaplicamos la asignacion incluso en edicion para que el backend
        // sincronice Ped_Obs, que es el campo expuesto por la grilla de O/C.
        const asignarRequests = this.detallesPedidoSeleccionados.map((item) =>
          this.apiService.patchAsignarOrdenCompraADetallePedido(
            this.buildAsignarOrdenCompraDetallePedidoPayload(item, ordenCompraId, currentUser)
          ).pipe(
            switchMap((patchResponse: unknown) => {
              this.assertSuccessfulResponse(patchResponse, 'No se pudo actualizar un detalle del pedido con la orden de compra.');
              return of(patchResponse);
            })
          )
        );

        const desAsignarRequests = this.detallesPendientesDesasignacion.map((item) =>
          this.apiService.patchDesAsignarOrdenCompraADetallePedido({
            Ord_Com_Id: ordenCompraId,
            Ped_Det_Id: item.id
          } as DesAsignarOrdenCompraDetallePedidoRequest).pipe(
            switchMap((patchResponse: unknown) => {
              this.assertSuccessfulResponse(patchResponse, 'No se pudo desasignar un detalle del pedido.');
              return of(patchResponse);
            })
          )
        );

        const requests = [...actualizarDetalleRequests, ...asignarRequests, ...desAsignarRequests];

        return requests.length ? forkJoin(requests) : of([]);
      }),
      switchMap(() => this.actualizarPedidoCuandoDetalleCompleto()),
      switchMap(() => this.actualizarReferenciaGeneralPedido()),
      switchMap(() => this.recargarDetallePedidoDespuesDeGuardar())
    );
  }

  private actualizarPedidoCuandoDetalleCompleto(): Observable<unknown> {
    const pedidoId = Number(this.form.controls['pedidoIdAtencion'].value);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return of(null);
    }

    return this.apiService.patchActualizarPedidoCuandoDetalleCompleto({ Ped_Id: pedidoId }).pipe(
      switchMap((response: unknown) => {
        this.assertSuccessfulResponse(response, 'No se pudo actualizar el estado del pedido.');
        return of(response);
      })
    );
  }

  private actualizarReferenciaGeneralPedido(): Observable<unknown> {
    const pedidoId = Number(this.form.controls['pedidoIdAtencion'].value);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return of(null);
    }

    const referenciaGeneral = String(this.form.controls['pedidoReferenciaGeneral'].value || '').trim();
    const request: ActualizarReferenciaGeneralRequest = {
      Ped_Id: pedidoId,
      Ped_Ref_Gral: referenciaGeneral
    };

    return this.apiService.patchActualizarReferenciaGeneral(request).pipe(
      switchMap((response: unknown) => {
        this.assertSuccessfulResponse(response, 'No se pudo actualizar la referencia del pedido.');
        return of(response);
      })
    );
  }

  private cargarOrdenesCompra(): void {
    this.isLoadingOrdenesCompra = true;
    this.errorMessage = '';

    this.apiService.getListarOrdenCompraActivo(this.getFiltros()).subscribe({
      next: (response: unknown) => {
        this.ordenesCompra = this.extractRecords(response)
          .map((item, index) => this.mapOrdenCompra(item, index))
          .filter((item): item is OrdenCompraRow => item !== null);
        this.currentOrdenesCompraPage = normalizePaginationPage(
          this.currentOrdenesCompraPage,
          this.ordenesCompraFiltradasPorUsuario.length,
          this.pageSize
        );
        this.reconciliarEtiquetasCatalogo();
        this.isLoadingOrdenesCompra = false;
      },
      error: (error: unknown) => {
        this.ordenesCompra = [];
        this.currentOrdenesCompraPage = 1;
        this.isLoadingOrdenesCompra = false;
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudieron cargar las ordenes de compra.');
      }
    });
  }

  private cargarProveedores(): void {
    this.isLoadingProveedores = true;

    this.apiService.getListarProveedorActivo({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.proveedores = this.extractRecords(response)
          .map((item) => this.mapProveedor(item))
          .filter((provider) => provider.code > 0 && !!provider.name);
        this.reconciliarProveedorEditor();
        this.reconciliarEtiquetasCatalogo();
        this.isLoadingProveedores = false;
      },
      error: () => {
        this.proveedores = [];
        this.isLoadingProveedores = false;
      }
    });
  }

  private cargarUsuariosRegistroCatalogo(): void {
    this.apiService.getListarUsuarioActivo().subscribe({
      next: (response: unknown) => {
        this.usuariosRegistroCatalogo = new Map(
          this.extractRecords(response)
            .map((usuario) => {
              const codigo = this.getTextValue(usuario, ['Usr_Cod', 'usr_Cod', 'usrCod']);
              const nombre = this.getTextValue(usuario, ['Usr_Nom', 'usr_Nom', 'usrNom']);
              return [codigo.toLowerCase(), nombre] as const;
            })
            .filter(([codigo]) => Boolean(codigo))
        );
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar el catálogo de usuarios para el filtro de órdenes generadas:', error);
        this.usuariosRegistroCatalogo.clear();
      }
    });
  }

  private cargarFormasPago(): void {
    this.isLoadingFormasPago = true;

    this.apiService.getListarFormaPagoActivo({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.formasPago = this.extractRecords(response)
          .map((item) => this.mapFormaPago(item))
          .filter((paymentOption) => paymentOption.code > 0 && !!paymentOption.description);
        this.reconciliarEtiquetasCatalogo();
        this.isLoadingFormasPago = false;
      },
      error: () => {
        this.formasPago = [];
        this.isLoadingFormasPago = false;
      }
    });
  }

  private cargarMonedas(): void {
    this.isLoadingMonedas = true;

    this.apiService.getListarMoneda({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.monedas = this.extractRecords(response)
          .map((item) => this.mapMonedaOption(item))
          .filter((item): item is MonedaOption => item !== null)
          .sort((left, right) => left.descripcion.localeCompare(right.descripcion));
        this.reconciliarEtiquetasCatalogo();
        this.isLoadingMonedas = false;
      },
      error: () => {
        this.monedas = [];
        this.isLoadingMonedas = false;
      }
    });
  }

  private cargarCentrosCosto(): void {
    this.isLoadingCentrosCosto = true;

    this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.centrosCostoCatalogo = this.extractRecords(response)
          .map((item) => this.mapCentroCosto(item))
          .filter((centroCosto): centroCosto is OrdenCompraCentroCostoRow => centroCosto !== null);
        this.reconciliarDescripcionCentrosCosto();
        this.isLoadingCentrosCosto = false;
      },
      error: () => {
        this.centrosCostoCatalogo = [];
        this.centrosCosto = [];
        this.isLoadingCentrosCosto = false;
      }
    });
  }

  private cargarPedidosPendientes(): void {
    this.isLoadingOrdenesCompra = true;
    this.errorMessage = '';

    this.apiService.getListarPedidoAprobadoParaOC(this.getPedidoPendienteFiltros()).subscribe({
      next: (response: unknown) => {
        this.pedidosPendientes = this.extractRecords(response)
          .map((item, index) => this.mapPedidoPendiente(item, index))
          .filter((item): item is PedidoPendienteRow => item !== null && item.estadoCodigo === 'A');
        this.currentPedidosPendientesPage = normalizePaginationPage(
          this.currentPedidosPendientesPage,
          this.pedidosPendientes.length,
          this.pageSize
        );
        this.isLoadingOrdenesCompra = false;
      },
      error: (error: unknown) => {
        this.pedidosPendientes = [];
        this.currentPedidosPendientesPage = 1;
        this.isLoadingOrdenesCompra = false;
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudieron cargar los pedidos pendientes.');
      }
    });
  }

  private cargarListadoSeleccionado(): void {
    if (this.isListadoGenerados) {
      this.pedidosPendientes = [];
      this.currentPedidosPendientesPage = 1;
      this.cargarOrdenesCompra();
      return;
    }

    this.ordenesCompra = [];
    this.currentOrdenesCompraPage = 1;
    this.cargarPedidosPendientes();
  }

  private getListadoModo(): OrdenCompraListadoModo {
    const value = String(this.filtersForm.controls['modoListado'].value || '').trim();
    return value === 'pendientes' ? 'pendientes' : 'generados';
  }

  private cargarDetracciones(): void {
    this.isLoadingDetracciones = true;

    this.apiService.getListarDetraccion({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.detracciones = this.extractRecords(response)
          .map((item) => this.mapDetraccionOption(item))
          .filter((item): item is DetraccionOption => item !== null)
          .sort((left, right) => left.descripcion.localeCompare(right.descripcion));
        this.isLoadingDetracciones = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando detracciones:', error);
        this.detracciones = [];
        this.isLoadingDetracciones = false;
      }
    });
  }

  private cargarOrdenCompraParaModificar(ordenCompra: OrdenCompraRow): void {
    this.apiService.getListarOrdenCompraModificar(ordenCompra.ordenCompraId ?? 0).subscribe({
      next: (response: unknown) => {
        const detalle = this.extractRecords(response)
          .map((item, index) => this.mapOrdenCompra(item, index))
          .find((item): item is OrdenCompraRow => item !== null) ?? ordenCompra;

        this.abrirEditorOrdenCompra(detalle);
      },
      error: () => {
        this.abrirEditorOrdenCompra(ordenCompra);
      }
    });
  }

  private abrirEditorOrdenCompra(ordenCompra: OrdenCompraRow): void {
    this.populateForm(ordenCompra);
    this.esParcial = false;
    this.aplicarModoCentrosCosto();
    this.mostrarEditor = true;
    this.cargarArchivosAdjuntosOrdenCompra(ordenCompra.ordenCompraId ?? 0);

    if (ordenCompra.pedidoIdAtencion) {
      this.cargarCentrosCostoDesdePedido(ordenCompra.total);
    }
  }

  private populateForm(item: OrdenCompraRow): void {
      this.form.patchValue({
        ordenCompraId: item.ordenCompraId,
        pedidoIdAtencion: item.pedidoIdAtencion,
        proveedorId: item.proveedorId,
        proveedorBancoId: item.proveedorBancoId,
        proveedor: item.proveedor,
        telefono: this.resolveProveedor(item.proveedorId)?.phone || '',
        direccion: this.resolveProveedor(item.proveedorId)?.address || '',
        contacto: item.proveedorContacto || this.resolveProveedor(item.proveedorId)?.contact || '',
        ruc: this.resolveProveedor(item.proveedorId)?.ruc || '',
        formaPagoId: item.formaPagoId,
        formaPago: item.formaPago,
        monedaId: item.monedaId > 0 ? item.monedaId : 0,
        descripcionGeneral: item.descripcionGeneral,
        fechaAtencion: this.toDateInputValue(item.fechaAtencion) || this.getTodayDateInputValue(),
        direccionEnvio: item.direccionEnvio,
        periodoGasto: item.periodoGasto,
        descuento: item.descuento,
        descuentoPorcentaje: item.descuentoPorcentaje,
        referenciaObra: item.referenciaObra,
      referencia: item.referencia,
      observacion: item.observacion,
      archivo: item.archivo || 'Sin archivo adjunto',
      detraccionId: item.detraccionId > 0 ? item.detraccionId : null,
      montoDetraccion: item.montoDetraccion,
      subtotal: item.subtotal,
      usarIgv18: this.isIgv18Porcentaje(item),
      porcentajeIgv: this.resolvePorcentajeIgv(item),
      igv: item.igv,
      total: item.total,
      estado: item.estadoCodigo
    });
    this.cargarBancosProveedor(item.proveedorId, item.proveedorBancoId);
    this.ordenCompraArchivoAdjunto = item.archivo || 'Sin archivo adjunto';
    this.ordenCompraArchivoRuta = item.archivoRuta;
    this.ordenCompraArchivoFile = null;
    this.ordenCompraArchivoFiles = [];
    this.ordenCompraArchivosAdjuntosGuardados = item.archivo && item.archivo !== 'Sin archivo adjunto'
      ? [{
          id: 0,
          ordenCompraId: item.ordenCompraId ?? 0,
          nombre: item.archivo,
          ruta: item.archivoRuta
        }]
      : [];
    this.actualizarOrdenCompraArchivoFormControl();
  }

  private getOrdenCompraSeleccionada(): OrdenCompraRow | null {
    if (this.selectedOrdenCompraId === null) {
      return null;
    }

    return this.ordenesCompra.find((item) => item.id === this.selectedOrdenCompraId) ?? null;
  }

  private async loadOrdenCompraLogoBytes(): Promise<Uint8Array | undefined> {
    if (this.ordenCompraLogoBytes !== undefined) {
      return this.ordenCompraLogoBytes ?? undefined;
    }

    try {
      const response = await fetch('assets/ArceLogo.jpg');

      if (!response.ok) {
        this.ordenCompraLogoBytes = null;
        return undefined;
      }

      this.ordenCompraLogoBytes = new Uint8Array(await response.arrayBuffer());
      return this.ordenCompraLogoBytes;
    } catch (error) {
      console.warn('No se pudo cargar el logo para el PDF de orden de compra:', error);
      this.ordenCompraLogoBytes = null;
      return undefined;
    }
  }

  private async loadOrdenCompraHeaderImageBytes(): Promise<Uint8Array | undefined> {
    if (this.ordenCompraHeaderImageBytes !== undefined) {
      return this.ordenCompraHeaderImageBytes ?? undefined;
    }

    try {
      const assetPath = this.ordenCompraTipoId === 2
        ? 'assets/OrdenServicio.jpg'
        : 'assets/OrdenCompra.jpg';
      const response = await fetch(assetPath);

      if (!response.ok) {
        this.ordenCompraHeaderImageBytes = null;
        return undefined;
      }

      this.ordenCompraHeaderImageBytes = new Uint8Array(await response.arrayBuffer());
      return this.ordenCompraHeaderImageBytes;
    } catch (error) {
      console.warn('No se pudo cargar la imagen de encabezado para el PDF de orden de compra:', error);
      this.ordenCompraHeaderImageBytes = null;
      return undefined;
    }
  }

  private buildOrdenCompraReportePdfData(
    ordenCompra: OrdenCompraRow,
    detalleResponse: unknown,
    pedidoResponse: unknown,
    proveedorResponse: unknown = [],
    proveedorBancoResponse: unknown = [],
    bancoResponse: unknown = []
  ): OrdenCompraReportePdfData {
    const proveedorDesdeRespuesta = this.extractRecords(proveedorResponse)
      .map((item) => this.mapProveedor(item))
      .find((item) => item.code === ordenCompra.proveedorId || item.code > 0) ?? null;
    const proveedor = proveedorDesdeRespuesta ?? this.resolveProveedor(ordenCompra.proveedorId);
    const cuentaPrincipal = this.resolveProveedorBancoPrincipal(proveedorBancoResponse);
    const bancoId = cuentaPrincipal?.bankId || ordenCompra.proveedorBancoId;
    const bancoDescripcion = this.resolveBancoDescripcion(bancoResponse, bancoId, ordenCompra.proveedorBancoDescripcion);
    const pedido = this.extractRecords(pedidoResponse)[0];
    const detalle = this.extractRecords(detalleResponse)
      .map((item) => this.mapDetallePedido(item))
      .filter((item): item is OrdenCompraDetallePedidoRow => item !== null)
      .map((item, index): OrdenCompraReporteDetallePdf => ({
        item: index + 1,
        cantidad: item.cantidad,
        unidad: item.unidadDescripcion,
        especificacion: this.buildDetalleReporteEspecificacion(item),
        centroCosto: item.centroCostoDescripcion,
        precioUnitario: item.costoUnitarioConDescuento,
        importe: item.subtotal
      }));
    const fechaRegistro = ordenCompra.fechaRegistro
      ? mapOrdenCompraReportDisplayDate(ordenCompra.fechaRegistro)
      : mapOrdenCompraReportDisplayDate(new Date().toISOString());
    const fechaRequerida = pedido
      ? mapOrdenCompraReportDisplayDate(this.getTextValue(pedido, ['Ped_Fec_Ent', 'ped_Fec_Ent', 'pedFecEnt']))
      : '-';
    const tipoServicio = pedido
      ? this.getTextValue(pedido, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes', 'Ped_Tip_Com_Des', 'ped_Tip_Com_Des'])
      : '';
    const subtotalReporte = detalle.length
      ? this.normalizeDecimal(detalle.reduce((total, item) => total + item.importe, 0))
      : ordenCompra.subtotal;
    const igvReporte = this.normalizeDecimalPrecision(ordenCompra.igv, 4);
    const totalCalculadoReporte = this.normalizeDecimal(subtotalReporte + igvReporte);
    const totalReporte = totalCalculadoReporte;
    const montoDetraccionReporte = this.normalizeDetraccionReporte(ordenCompra.montoDetraccion, totalReporte);
    const detraccionDescripcionReporte = this.resolveDetraccionReporteLabel(
      ordenCompra.detraccionId,
      ordenCompra.detraccionDescripcion
    );
    const totalPagarReporte = this.calcularTotalConDetraccion(
      totalReporte,
      montoDetraccionReporte,
      detraccionDescripcionReporte
    );

    return {
      ordenCompraId: ordenCompra.ordenCompraId ?? 0,
      correlativo: this.formatOrdenCorrelativo(ordenCompra.ordenCompraId),
      tipoServicio: tipoServicio || ordenCompra.tipoServicio,
      monedaAbreviacion: ordenCompra.monedaAbreviacion || 'S/.',
      fecha: fechaRegistro,
      proveedor: proveedor?.name || ordenCompra.proveedor,
      ruc: proveedor?.ruc || ordenCompra.proveedorRuc || '-',
      banco: bancoDescripcion,
      cuenta: cuentaPrincipal?.accountNumber || ordenCompra.proveedorCuenta || '-',
      cci: cuentaPrincipal?.cci || ordenCompra.proveedorCci || '-',
      contacto: proveedor?.contact || ordenCompra.proveedorContacto || '-',
      email: proveedor?.email || ordenCompra.proveedorEmail || '-',
      direccionProveedor: proveedor?.address || ordenCompra.proveedorDireccion || '-',
      referenciaObra: pedido ? this.getTextValue(pedido, ['Ped_Ref_Gral', 'ped_Ref_Gral', 'pedRefGral']) || '-' : '-',
      observaciones: ordenCompra.observacion || '-',
      fechaRequerida,
      pedido: ordenCompra.pedidoIdAtencion ? `P${ordenCompra.pedidoIdAtencion}` : '-',
      direccionEnvio: pedido ? this.getTextValue(pedido, ['Ped_Ref', 'ped_Ref', 'pedRef']) || '-' : '-',
      solicitadoPor: this.resolvePedidoSolicitadoPor(pedido),
      condicionPago: ordenCompra.formaPago || '-',
      subtotal: subtotalReporte,
      igv: igvReporte,
      total: totalReporte,
      detraccionDescripcion: detraccionDescripcionReporte,
      montoDetraccion: montoDetraccionReporte,
      totalPagar: totalPagarReporte,
      detalle
    };
  }

  private resolvePedidoSolicitadoPor(pedido: DataRecord | undefined): string {
    if (!pedido) {
      return '-';
    }

    return this.getTextValue(pedido, [
      'Usr_Nom',
      'usr_Nom',
      'usrNom',
      'UsuarioRegistro',
      'usuarioRegistro',
      'Usr_Reg_Nom',
      'usr_Reg_Nom',
      'usrRegNom',
      'RegistradoPor',
      'registradoPor',
      'Usr_Reg',
      'usr_Reg',
      'usrReg'
    ]) || '-';
  }

  private getArchivoAdjuntoActual(): string | undefined {
    const archivo = String(this.form.controls['archivo'].value || '').trim();
    return archivo && archivo !== 'Sin archivo adjunto' ? archivo : undefined;
  }

  private getMimeTypeFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'txt':
        return 'text/plain';
      case 'sql':
        return 'text/plain';
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      case 'gif':
        return 'image/gif';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }

  private getFiltros(): OrdenCompraFiltro {
    const ordenCompraId = Number(this.filtersForm.controls['ordenCompraId'].value);
    const proveedor = String(this.filtersForm.controls['proveedor'].value || '').trim();
    const estado = String(this.filtersForm.controls['estado'].value || '').trim();
    const palabrasClaveDetalle = String(this.filtersForm.controls['palabrasClaveDetalle'].value || '').trim();
    const filtros: OrdenCompraFiltro = {
      Ord_Com_Tip: this.ordenCompraTipoId
    };

    if (Number.isInteger(ordenCompraId) && ordenCompraId > 0) {
      filtros.Ord_Com_Id = ordenCompraId;
    }

    if (proveedor) {
      filtros.Ord_Com_Prv = proveedor;
    }

    if (estado) {
      filtros.Flg_Est = estado;
    }

    if (palabrasClaveDetalle) {
      filtros.Itm_Des = palabrasClaveDetalle;
    }

    return filtros;
  }

  private getPedidoPendienteFiltros(): PedidosFiltro {
    return {
      Flg_Est: 'A',
      Ped_Tip_Com: this.ordenCompraTipoId
    };
  }

  private getCorrelativoPrefix(tipoId: number = this.ordenCompraTipoId): string {
    return tipoId === 2 ? 'OSP' : 'OCP';
  }

  private formatOrdenCorrelativo(ordenCompraId: number | null, tipoId: number = this.ordenCompraTipoId): string {
    if (!ordenCompraId || ordenCompraId <= 0) {
      return '-';
    }

    return `${this.getCorrelativoPrefix(tipoId)}${String(ordenCompraId).padStart(5, '0')}`;
  }

  private toDateInputValue(value: string): string {
    const normalizedValue = String(value || '').trim();
    const isoDate = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/);

    if (isoDate) {
      return isoDate[1];
    }

    const displayDate = normalizedValue.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    return displayDate ? `${displayDate[3]}-${displayDate[2]}-${displayDate[1]}` : '';
  }

  private getTodayDateInputValue(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mapOrdenCompra(item: DataRecord, index: number): OrdenCompraRow | null {
    const ordenCompraId = this.getNumberValue(item, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId', 'id', 'Id']);
    const trackingId = ordenCompraId ?? -1 * (index + 1);

    const pedidoIdAtencion = this.getNumberValue(item, ['Ord_Com_Ped_Id', 'ord_Com_Ped_Id', 'ordComPedId']);
    const proveedorId = this.getNumberValue(item, ['Ord_Com_Prv', 'ord_Com_Prv', 'ordComPrv']) ?? 0;
    const formaPagoId = this.getNumberValue(item, ['Ord_Com_For_Pag', 'ord_Com_For_Pag', 'ordComForPag']) ?? 0;
    const estadoCodigo = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']);
    const flgIgvAut = this.getTextValue(item, ['Flg_Igv_Aut', 'Flg_IGV_Aut', 'flg_Igv_Aut', 'flg_igv_aut', 'flgIgvAut']);
    const proveedorFallback = this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom', 'Proveedor', 'proveedor']);
    const formaPagoFallback = this.getTextValue(item, ['For_Pag_Des', 'for_Pag_Des', 'forPagDes', 'FormaPago', 'formaPago']);

    if (!ordenCompraId && !proveedorFallback && !formaPagoFallback) {
      return null;
    }

    return {
      id: trackingId,
      ordenCompraId,
      correlativo: this.formatOrdenCorrelativo(ordenCompraId),
      pedidoIdAtencion,
      usuarioRegistro: this.getTextValue(item, ['Usr_Reg', 'usr_Reg', 'usrReg', 'UsuarioRegistro', 'usuarioRegistro']) || '-',
      usuarioAprobacionPedido: this.getTextValue(item, ['Ped_Usr_Apr', 'ped_Usr_Apr', 'pedUsrApr', 'UsuarioAprobacion', 'usuarioAprobacion']) || '-',
      flgEstCon: this.getNumberValue(item, ['Flg_Est_Con', 'flg_Est_Con', 'flgEstCon', 'FlgEstCon']) ?? 0,
      conformidadRegistro: (this.getNumberValue(item, ['Flg_Est_Con', 'flg_Est_Con', 'flgEstCon', 'FlgEstCon']) ?? 0) >= 1,
      conformidadAprobacion: (this.getNumberValue(item, ['Flg_Est_Con', 'flg_Est_Con', 'flgEstCon', 'FlgEstCon']) ?? 0) >= 2,
      proveedorId,
      monedaId: this.getNumberValue(item, ['Mon_Id', 'mon_Id', 'monId', 'Ped_Tip_Mon', 'ped_Tip_Mon', 'pedTipMon']) ?? 0,
      proveedor: this.resolveProveedorNombre(proveedorId, proveedorFallback),
      proveedorRuc: this.getTextValue(item, ['Prv_Ruc', 'prv_Ruc', 'prvRuc']),
      proveedorBancoId: this.getNumberValue(item, ['Prv_Ban_Id', 'prv_Ban_Id', 'prvBanId', 'Prv_Ban', 'prv_Ban', 'prvBan']) ?? 0,
      proveedorBancoDescripcion: this.getTextValue(item, ['Ban_Des', 'ban_Des', 'banDes', 'Banco', 'banco']),
      proveedorCuenta: this.getTextValue(item, ['Prv_Nro_Cue_Ban', 'prv_Nro_Cue_Ban', 'prvNroCueBan']),
      proveedorCci: this.getTextValue(item, ['Prv_Nro_Cue_Ban_CCI', 'prv_Nro_Cue_Ban_CCI', 'prvNroCueBanCci']),
      descripcionGeneral: this.getTextValue(item, ['Ord_Com_Des_Gral', 'ord_Com_Des_Gral', 'ordComDesGral']),
      fechaAtencion: this.getTextValue(item, ['Ord_Com_Fec_Ate', 'ord_Com_Fec_Ate', 'ordComFecAte']),
      direccionEnvio: this.getTextValue(item, ['Ord_Com_Dir_Env', 'ord_Com_Dir_Env', 'ordComDirEnv']),
      periodoGasto: this.getNumberValue(item, ['Ord_Com_Per_Gas', 'ord_Com_Per_Gas', 'ordComPerGas']) ?? 0,
      descuento: this.getDecimalValue(item, ['Ord_Com_Des', 'ord_Com_Des', 'ordComDes']),
      descuentoPorcentaje: (this.getNumberValue(item, ['Flg_Des_Por', 'flg_Des_Por', 'flgDesPor']) ?? 0) === 1,
      proveedorContacto: this.getTextValue(item, ['Con_Nom', 'con_Nom', 'conNom', 'Prv_Nom_Con', 'prv_Nom_Con', 'prvNomCon']),
      proveedorEmail: this.getTextValue(item, ['Prv_Email', 'prv_Email', 'prvEmail']),
      proveedorDireccion: this.getTextValue(item, ['Prv_Dir', 'prv_Dir', 'prvDir']),
      tipoServicio: this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes', 'Ped_Tip_Com_Des', 'ped_Tip_Com_Des']),
      monedaAbreviacion: this.getTextValue(item, ['Mon_Abr', 'mon_Abr', 'monAbr', 'Mon_Des', 'mon_Des', 'monDes']) || 'S/.',
      formaPagoId,
      formaPago: this.resolveFormaPagoDescripcion(formaPagoId, formaPagoFallback),
      referenciaObra: this.getTextValue(item, ['Ord_Com_Ref_Obr', 'ord_Com_Ref_Obr', 'ordComRefObr']),
      referencia: this.getTextValue(item, ['Ord_Com_Ref', 'ord_Com_Ref', 'ordComRef']),
      observacion: this.getTextValue(item, ['Ord_Com_Obs', 'ord_Com_Obs', 'ordComObs']),
      subtotal: this.getOrdenCompraMoneyValue(item, ['Ord_Com_Sub_Tot', 'ord_Com_Sub_Tot', 'ordComSubTot']),
      igv: this.getOrdenCompraIgvValue(item, ['Ord_Com_Igv', 'ord_Com_Igv', 'ordComIgv']),
      flgIgvAut,
      igvPor: this.normalizePorcentajeIgv(this.getDecimalValue(item, ['Igv_Por', 'IGV_Por', 'igv_Por', 'igv_por', 'igvPor'])),
      total: this.getOrdenCompraMoneyValue(item, ['Ord_Com_Tot', 'ord_Com_Tot', 'ordComTot']),
      detraccionId: this.getNumberValue(item, ['Ord_Com_Det_Id', 'ord_Com_Det_Id', 'ordComDetId']) ?? 0,
      detraccionDescripcion: this.getTextValue(item, ['Det_Des', 'det_Des', 'detDes', 'Ord_Com_Det_Des', 'ord_Com_Det_Des', 'ordComDetDes', 'Detraccion', 'detraccion']),
      montoDetraccion: this.getOrdenCompraMoneyValue(item, ['Ord_Com_Det_Mon', 'ord_Com_Det_Mon', 'ordComDetMon']),
      archivo: this.getTextValue(item, [
        'Ord_Com_Arc_Adj_Nom',
        'ord_Com_Arc_Adj_Nom',
        'ord_com_arc_adj_nom',
        'ordComArcAdjNom',
        'OrdComArcAdjNom',
        'archivo',
        'Archivo'
      ]) || 'Sin archivo adjunto',
      archivoRuta: this.getTextValue(item, [
        'Ord_Com_Arc_Adj_Rut',
        'ord_Com_Arc_Adj_Rut',
        'ord_com_arc_adj_rut',
        'ordComArcAdjRut',
        'OrdComArcAdjRut',
        'archivoRuta',
        'ArchivoRuta'
      ]),
      fechaRegistro: this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg']),
      estadoCodigo,
      estado: estadoCodigo ? this.mapEstadoDescripcion(estadoCodigo) : '-',
      canEdit: ordenCompraId !== null
    };
  }

  private mapProveedor(item: DataRecord): ProviderRecord {
    return {
      code: this.getNumberValue(item, ['Prv_Id', 'prv_Id', 'prvId', 'id', 'Id']) ?? 0,
      name: this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom']),
      phone: this.getTextValue(item, ['Prv_Tel', 'prv_Tel', 'prvTel']),
      address: this.getTextValue(item, ['Prv_Dir', 'prv_Dir', 'prvDir']),
      contact: this.getTextValue(item, ['Prv_Nom_Con', 'prv_Nom_Con', 'prvNomCon']),
      ruc: this.getTextValue(item, ['Prv_Ruc', 'prv_Ruc', 'prvRuc']),
      email: this.getTextValue(item, ['Prv_Email', 'prv_Email', 'prvEmail']),
      bankCode: this.getNumberValue(item, ['Prv_Ban', 'prv_Ban', 'prvBan']) ?? 0,
      bankName: this.getTextValue(item, ['Ban_Des', 'ban_Des', 'banDes', 'Banco', 'banco']),
      bankAccountNumber: this.getTextValue(item, ['Prv_Nro_Cue_Ban', 'prv_Nro_Cue_Ban', 'prvNroCueBan']),
      bankCci: this.getTextValue(item, ['Prv_Nro_Cue_Ban_CCI', 'prv_Nro_Cue_Ban_CCI', 'prvNroCueBanCci'])
    };
  }

  private mapFormaPago(item: DataRecord): PaymentOption {
    return {
      code: this.getNumberValue(item, ['For_Pag_Id', 'for_Pag_Id', 'forPagId', 'id', 'Id']) ?? 0,
      description: this.getTextValue(item, ['For_Pag_Des', 'for_Pag_Des', 'forPagDes', 'description', 'Description'])
    };
  }

  private mapMonedaOption(item: DataRecord): MonedaOption | null {
    const id = this.getNumberValue(item, ['Mon_Id', 'mon_Id', 'monId', 'id', 'Id']) ?? 0;

    if (id <= 0) {
      return null;
    }

    return {
      id,
      descripcion: this.getTextValue(item, ['Mon_Des', 'mon_Des', 'monDes', 'descripcion', 'Descripcion']) || String(id),
      abreviacion: this.getTextValue(item, ['Mon_Abr', 'mon_Abr', 'monAbr', 'abreviatura', 'Abreviatura']) || ''
    };
  }

  private mapCentroCosto(item: DataRecord): OrdenCompraCentroCostoRow | null {
    const codigo = this.getNumberValue(item, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId', 'id', 'Id']);

    if (!codigo) {
      return null;
    }

    const descripcion = this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes', 'descripcion', 'Descripcion']);

    if (!descripcion) {
      return null;
    }

    return {
      id: codigo,
      codigo,
      descripcion,
      selected: false
    };
  }

  private mapCentroCostoPedido(response: unknown): OrdenCompraCentroCostoRow[] {
    const codigosRegistrados = new Set<number>();

    return this.extractRecords(response)
      .map((item) => {
        const codigoDesdeCatalogo = this.getNumberValue(item, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId']);
        const codigoTexto = this.getTextValue(item, ['Ped_Cen_Cos', 'ped_Cen_Cos', 'pedCenCos']);
        const codigo = codigoDesdeCatalogo ?? Number(codigoTexto);

        if (!Number.isInteger(codigo) || codigo <= 0 || codigosRegistrados.has(codigo)) {
          return null;
        }

        codigosRegistrados.add(codigo);

        return {
          id: codigo,
          codigo,
          descripcion: this.resolveCentroCostoDescripcion(codigo),
          selected: false
        };
      })
      .filter((item): item is OrdenCompraCentroCostoRow => item !== null);
  }

  private mapDetallePedido(item: DataRecord): OrdenCompraDetallePedidoRow | null {
    const id = this.getNumberValue(item, ['Ped_Det_Id', 'ped_Det_Id', 'pedDetId', 'Id', 'id']);
    const itemCodigo = this.getTextValue(item, ['Ped_Cod_Itm', 'ped_Cod_Itm', 'pedCodItm']);
    const itemDescripcion = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes', 'descripcionItem', 'DescripcionItem']);

    if (!id || !itemCodigo) {
      return null;
    }

    const unidadCodigo = this.getTextValue(item, ['Ped_Uni_Med', 'ped_Uni_Med', 'pedUniMed']) || '-';
    const unidadDescripcion = this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes']) || unidadCodigo;
    const centroCostoCodigo = this.getNumberValue(item, ['Ped_Cen_Cos_Asg', 'ped_Cen_Cos_Asg', 'pedCenCosAsg']);
    const centroCostoDescripcion = this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']) || '-';
    const cantidad = this.getDecimalValue(item, ['Ped_Can', 'ped_Can', 'pedCan']);
    const costoUnitarioRegistrado = this.getDecimalValue(item, ['Ped_Cos_Uni', 'ped_Cos_Uni', 'pedCosUni'], 4);
    const descuentoPorcentaje = (this.getNumberValue(item, ['Flg_Des_Por', 'flg_Des_Por', 'flgDesPor']) ?? 0) === 1;
    const descuento = this.normalizeDecimalPrecision(
      Math.max(0, this.getDecimalValue(item, ['Ped_Det_Des', 'ped_Det_Des', 'pedDetDes'], 4)),
      4
    );
    const costoUnitarioConDescuentoRegistrado = this.getOptionalDecimalValue(
      item,
      ['Ped_Det_Cos_Uni_Des', 'ped_Det_Cos_Uni_Des', 'pedDetCosUniDes'],
      4
    );
    const costoUnitario = costoUnitarioConDescuentoRegistrado === null
      ? this.calcularCostoBaseDetalle(costoUnitarioRegistrado, descuento, descuentoPorcentaje)
      : costoUnitarioRegistrado;
    const costoUnitarioConDescuento = costoUnitarioConDescuentoRegistrado ?? costoUnitarioRegistrado;
    const subtotalRegistrado = this.getDecimalValue(item, ['Ped_Cos_Tot', 'ped_Cos_Tot', 'pedCosTot'], 4);

    return {
      id,
      ordenCompraId: this.getNumberValue(item, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId']) ?? null,
      itemCodigo,
      itemDescripcion: itemDescripcion || itemCodigo,
      unidadCodigo,
      unidadDescripcion,
      centroCostoCodigo,
      centroCostoDescripcion,
      cantidad,
      descuento,
      descuentoPorcentaje,
      costoUnitario,
      costoUnitarioConDescuento,
      subtotal: subtotalRegistrado,
      observacion: this.getTextValue(item, [
        'Ped_Obs_Ped',
        'ped_Obs_Ped',
        'ped_obs_ped',
        'pedObsPed',
        'PedObsPed',
        'Ped_Obs',
        'ped_Obs',
        'pedObs',
        'Ped_Obs_Det',
        'ped_Obs_Det',
        'pedObsDet',
        'Observacion',
        'observacion',
        'ObservacionPedido',
        'observacionPedido'
      ]),
      selected: false
    };
  }

  private buildDetalleReporteEspecificacion(item: OrdenCompraDetallePedidoRow): string {
    const descripcion = String(item.itemDescripcion || '').trim();
    const observacion = String(item.observacion || '').trim();

    if (!observacion) {
      return descripcion;
    }

    return `${descripcion} - ${observacion}`;
  }

  private loadPedidoData(pedidoId: number): Observable<{ centrosCostoResponse: unknown; detalleResponse: unknown; pedidoResponse: unknown }> {
    const ordenCompraId = Number(this.form.controls['ordenCompraId'].value);
    const detalleRequest = this.isEditingOrdenCompra && Number.isInteger(ordenCompraId) && ordenCompraId > 0
      ? this.apiService.getListarItemsAsignadosPedidoCentroCostoModificar(ordenCompraId, pedidoId)
      // En nuevo solo se listan items pendientes de asignar a una orden de compra.
      : this.apiService.getListarItemsAsignadosPedidoCentroCosto(pedidoId);

    return forkJoin({
      centrosCostoResponse: this.apiService.getListarPedidoRegistradoCentroCosto(pedidoId),
      detalleResponse: detalleRequest,
      pedidoResponse: this.apiService.getListarPedidoModificar(pedidoId)
    });
  }

  private applyPedidoDataResponse(
    centrosCostoResponse: unknown,
    detalleResponse: unknown,
    pedidoResponse?: unknown,
    totalOrdenGuardado?: number
  ): void {
    const centros = this.mapCentroCostoPedido(centrosCostoResponse);
    const seleccionarDetalles = this.debeSeleccionarDetallesAlCargar();
    const pedidoMonedaId = this.resolvePedidoMonedaId(pedidoResponse);
    this.pedidoArchivoAdjunto = this.resolvePedidoArchivoAdjunto(pedidoResponse);
    this.form.controls['pedidoReferenciaGeneral'].setValue(this.resolvePedidoReferenciaGeneral(pedidoResponse), { emitEvent: false });

    if (!this.isEditingOrdenCompra && pedidoMonedaId > 0) {
      this.form.controls['monedaId'].setValue(pedidoMonedaId, { emitEvent: false });
    }

    this.centrosCosto = centros.map((item) => ({
      ...item,
      selected: false
    }));
    this.pedidoDetalles = this.extractRecords(detalleResponse)
      .map((item) => this.mapDetallePedido(item))
      .filter((item): item is OrdenCompraDetallePedidoRow => item !== null)
      .map((item) => ({
        ...item,
        selected: seleccionarDetalles
      }));
    this.currentDetallePedidoPage = normalizePaginationPage(this.currentDetallePedidoPage, this.pedidoDetalles.length, this.pageSize);
    this.centrosCostoErrorMessage = this.centrosCosto.length
      ? ''
      : 'El pedido ingresado no tiene centros de costo vinculados.';
    this.detallePedidoErrorMessage = this.pedidoDetalles.length
      ? ''
      : 'El pedido ingresado no tiene detalle registrado.';
    if (this.detallesPendientesDesasignacion.length) {
      this.detallePedidoErrorMessage = 'Hay detalles marcados para desasignacion. Los cambios se aplicaran al actualizar.';
    }
    this.syncTotalesCalculados();
    this.restaurarTotalOrdenGuardado(totalOrdenGuardado);
    this.isLoadingPedidoCentrosCosto = false;
    this.isLoadingPedidoDetalle = false;
  }

  private debeSeleccionarDetallesAlCargar(): boolean {
    const ordenCompraId = Number(this.form.controls['ordenCompraId'].value);
    return this.isEditingOrdenCompra || (Number.isInteger(ordenCompraId) && ordenCompraId > 0);
  }

  private handlePedidoDataError(error: unknown, totalOrdenGuardado?: number): void {
    this.centrosCosto = [];
    this.pedidoDetalles = [];
    this.pedidoArchivoAdjunto = 'Sin archivo adjunto';
    this.form.controls['pedidoReferenciaGeneral'].setValue('', { emitEvent: false });
    this.currentDetallePedidoPage = 1;
    this.centrosCostoErrorMessage = this.resolveErrorMessage(error, 'No se pudieron cargar los centros de costo del pedido.');
    this.detallePedidoErrorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el detalle del pedido.');
    this.syncTotalesCalculados();
    this.restaurarTotalOrdenGuardado(totalOrdenGuardado);
    this.isLoadingPedidoCentrosCosto = false;
    this.isLoadingPedidoDetalle = false;
  }

  private restaurarTotalOrdenGuardado(totalOrdenGuardado?: number): void {
    if (totalOrdenGuardado === undefined || totalOrdenGuardado === null) {
      return;
    }

    this.form.controls['total'].setValue(
      this.normalizeDecimal(totalOrdenGuardado),
      { emitEvent: false }
    );
  }

  private resolvePedidoArchivoAdjunto(pedidoResponse: unknown): string {
    const record = this.extractRecords(pedidoResponse)[0];

    if (!record) {
      return 'Sin archivo adjunto';
    }

    const archivo = this.getTextValue(record, [
      'Ped_Arc_Adj_Nom',
      'ped_Arc_Adj_Nom',
      'ped_arc_adj_nom',
      'pedArcAdjNom',
      'PedArcAdjNom',
      'archivo',
      'Archivo'
    ]);

    return archivo || 'Sin archivo adjunto';
  }

  private resolvePedidoReferenciaGeneral(pedidoResponse: unknown): string {
    const record = this.extractRecords(pedidoResponse)[0];

    if (!record) {
      return '';
    }

    return this.getTextValue(record, ['Ped_Ref_Gral', 'ped_Ref_Gral', 'pedRefGral']);
  }

  private resolvePedidoMonedaId(pedidoResponse: unknown): number {
    const record = this.extractRecords(pedidoResponse)[0];

    if (!record) {
      return 0;
    }

    return this.getNumberValue(record, ['Ped_Tip_Mon', 'ped_Tip_Mon', 'pedTipMon', 'Mon_Id', 'mon_Id', 'monId']) ?? 0;
  }

  private resolveOrdenCompraIdParaAsignacion(response: unknown): Observable<number> {
    const ordenCompraIdActual = Number(this.form.controls['ordenCompraId'].value);

    if (Number.isInteger(ordenCompraIdActual) && ordenCompraIdActual > 0) {
      return of(ordenCompraIdActual);
    }

    const ordenCompraIdResponse = this.extractOrdenCompraIdFromResponse(response);

    if (ordenCompraIdResponse) {
      this.form.patchValue({ ordenCompraId: ordenCompraIdResponse }, { emitEvent: false });
      return of(ordenCompraIdResponse);
    }

    return this.buscarOrdenCompraGuardadaRecientemente();
  }

  private buildAsignarOrdenCompraDetallePedidoPayload(
    item: OrdenCompraDetallePedidoRow,
    ordenCompraId: number,
    currentUser: string
  ): AsignarOrdenCompraDetallePedidoRequest {
    const observacion = String(item.observacion || '').trim();

    return {
      Ord_Com_Id: ordenCompraId,
      Ped_Det_Id: item.id,
      Ped_Can: this.normalizeDecimal(item.cantidad),
      Ped_Cos_Uni: this.normalizeDecimalPrecision(item.costoUnitario, 4),
      Ped_Obs: observacion || undefined,
      Usr_Mod: currentUser || undefined
    };
  }

  private openArchivoLocalEnChrome(archivo: File): void {
    if (this.isTextPreviewFile(archivo.name, archivo.type)) {
      const reader = new FileReader();
      reader.onload = () => this.openTextoEnChrome(archivo.name, String(reader.result || ''));
      reader.onerror = () => {
        this.saveErrorMessage = 'No se pudo abrir el archivo.';
      };
      reader.readAsText(archivo);
      return;
    }

    if (this.isOfficePreviewFile(archivo.name)) {
      this.openArchivoOfficeEnChrome(archivo.name, URL.createObjectURL(archivo), archivo.type || this.getMimeTypeFromFileName(archivo.name));
      return;
    }

    this.openArchivoEnChrome(archivo.name, URL.createObjectURL(archivo), archivo.type);
  }

  private openArrayBufferArchivoEnChrome(nombreArchivo: string, arrayBuffer: ArrayBuffer): void {
    const mimeType = this.getMimeTypeFromFileName(nombreArchivo);

    if (this.isTextPreviewFile(nombreArchivo, mimeType)) {
      const contenido = new TextDecoder('utf-8').decode(arrayBuffer);
      this.openTextoEnChrome(nombreArchivo, contenido);
      return;
    }

    if (this.isOfficePreviewFile(nombreArchivo)) {
      const blob = new Blob([arrayBuffer], { type: mimeType });
      this.openArchivoOfficeEnChrome(nombreArchivo, URL.createObjectURL(blob), mimeType);
      return;
    }

    const blob = new Blob([arrayBuffer], { type: mimeType });
    this.openArchivoEnChrome(nombreArchivo, URL.createObjectURL(blob), mimeType);
  }

  private isTextPreviewFile(nombreArchivo: string, mimeType?: string): boolean {
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';
    return ['txt', 'sql', 'csv', 'log', 'xml'].includes(extension) ||
      Boolean(mimeType?.startsWith('text/') || mimeType === 'application/xml' || mimeType === 'text/xml');
  }

  private isOfficePreviewFile(nombreArchivo: string): boolean {
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';
    return ['doc', 'docx', 'xls', 'xlsx'].includes(extension);
  }

  private openArchivoOfficeEnChrome(nombreArchivo: string, url: string, mimeType: string): void {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      window.open(url, '_blank');
      return;
    }

    const nombreSeguro = this.escapeHtml(nombreArchivo);
    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${nombreSeguro}</title>
          <style>
            html, body { margin: 0; width: 100%; height: 100%; background: #f5f5f5; font-family: Arial, sans-serif; }
            header { padding: 14px 18px; background: #3f3d39; color: #fff; font-weight: 700; }
            .viewer { width: 100%; height: calc(100% - 52px); border: 0; display: block; }
            .fallback { padding: 24px; color: #555; }
            .fallback a { color: #ff8f22; font-weight: 700; }
          </style>
        </head>
        <body>
          <header>${nombreSeguro}</header>
          <object class="viewer" data="${url}" type="${mimeType}">
            <div class="fallback">
              Chrome no puede previsualizar este tipo de archivo directamente.
              <a href="${url}" target="_blank" rel="noopener">Abrir archivo</a>
            </div>
          </object>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  private openArchivoEnChrome(nombreArchivo: string, url: string, mimeType?: string): void {
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';
    const puedePrevisualizar = ['pdf', 'png', 'jpg', 'jpeg', 'gif'].includes(extension) ||
      Boolean(mimeType?.startsWith('image/') || mimeType === 'application/pdf');

    if (!puedePrevisualizar) {
      window.open(url, '_blank');
      return;
    }

    const ventana = window.open('', '_blank');
    if (!ventana) {
      window.open(url, '_blank');
      return;
    }

    const nombreSeguro = this.escapeHtml(nombreArchivo);
    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${nombreSeguro}</title>
          <style>
            html, body { margin: 0; width: 100%; height: 100%; background: #f5f5f5; }
            .viewer { width: 100%; height: 100%; border: 0; display: block; }
          </style>
        </head>
        <body>
          <iframe class="viewer" src="${url}" title="${nombreSeguro}"></iframe>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  private openTextoEnChrome(nombreArchivo: string, contenido: string): void {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      const blob = new Blob([contenido], { type: 'text/plain' });
      window.open(URL.createObjectURL(blob), '_blank');
      return;
    }

    const nombreSeguro = this.escapeHtml(nombreArchivo);
    const contenidoSeguro = this.escapeHtml(contenido);
    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${nombreSeguro}</title>
          <style>
            body { margin: 0; background: #f7f7f7; color: #2f2f2f; font-family: Consolas, Monaco, monospace; }
            header { padding: 14px 18px; background: #3f3d39; color: #fff; font: 600 14px Arial, sans-serif; }
            pre { margin: 0; padding: 18px; white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.45; }
          </style>
        </head>
        <body>
          <header>${nombreSeguro}</header>
          <pre>${contenidoSeguro}</pre>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private buildActualizarDetallePedidoPayload(
    item: OrdenCompraDetallePedidoRow,
    currentUser: string
  ): ActualizarDetallePedidoRequest {
    const itemCodigo = Number(item.itemCodigo);
    const unidadCodigo = Number(item.unidadCodigo);
    const centroCostoCodigo = Number(item.centroCostoCodigo);

    return {
      Ped_Det_Id: item.id,
      Ped_Cod_Itm: Number.isInteger(itemCodigo) && itemCodigo > 0 ? itemCodigo : 0,
      Ped_Uni_Med: Number.isInteger(unidadCodigo) && unidadCodigo > 0 ? unidadCodigo : 0,
      Ped_Cen_Cos_Asg: Number.isInteger(centroCostoCodigo) && centroCostoCodigo > 0 ? centroCostoCodigo : 0,
      Ped_Can: this.normalizeDecimal(item.cantidad),
      Ped_Cos_Uni: this.normalizeDecimalPrecision(item.costoUnitario, 4),
      Ped_Cos_Tot: this.normalizeDecimalPrecision(item.subtotal, 4),
      Ped_Det_Des: this.normalizeDecimalPrecision(item.descuento, 4),
      Ped_Det_Cos_Uni_Des: this.normalizeDecimalPrecision(item.costoUnitarioConDescuento, 4),
      Flg_Des_Por: item.descuentoPorcentaje ? 1 : 0,
      Usr_Mod: currentUser,
      Ped_Obs_Ped: String(item.observacion || '').trim() || undefined
    };
  }

  private mapPedidoPendiente(item: DataRecord, index: number): PedidoPendienteRow | null {
    const pedidoId = this.getNumberValue(item, ['Ped_Id', 'ped_Id', 'pedId', 'id', 'Id']);
    const proveedor = this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom', 'Proveedor', 'proveedor']);
    const estadoCodigo = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']);

    if (!pedidoId && !proveedor) {
      return null;
    }

    return {
      id: pedidoId ?? -1 * (index + 1),
      pedidoId: pedidoId ?? 0,
      proveedor: proveedor || '-',
      tipoServicio: this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes', 'Ped_Tip_Com_Des', 'ped_Tip_Com_Des']) || '-',
      referencia: this.getTextValue(item, ['Ped_Ref', 'ped_Ref', 'pedRef', 'Referencia', 'referencia']) || '-',
      moneda: this.getTextValue(item, ['Mon_Des', 'mon_Des', 'monDes', 'Mon_Abr', 'mon_Abr', 'monAbr']) || '-',
      total: this.getDecimalValue(item, ['Ped_Can_Tot', 'ped_Can_Tot', 'pedCanTot', 'Total', 'total']),
      estadoCodigo,
      estado: estadoCodigo ? this.mapPedidoEstadoDescripcion(estadoCodigo) : '-'
    };
  }

  private recargarDetallePedidoDespuesDeGuardar(): Observable<unknown> {
    const pedidoId = Number(this.form.controls['pedidoIdAtencion'].value);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return of(null);
    }

    this.isLoadingPedidoCentrosCosto = true;
    this.isLoadingPedidoDetalle = true;

    return new Observable<unknown>((subscriber) => {
      this.loadPedidoData(pedidoId).subscribe({
        next: ({ centrosCostoResponse, detalleResponse, pedidoResponse }) => {
          this.applyPedidoDataResponse(centrosCostoResponse, detalleResponse, pedidoResponse);
          subscriber.next(null);
          subscriber.complete();
        },
        error: (error: unknown) => {
          this.handlePedidoDataError(error);
          subscriber.error(error);
        }
      });
    });
  }

  private extractOrdenCompraIdFromResponse(response: unknown): number | null {
    if (typeof response === 'number' && Number.isInteger(response) && response > 0) {
      return response;
    }

    if (!this.isDataRecord(response)) {
      return null;
    }

    const directId = this.getNumberValue(response, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId', 'Id', 'id']);

    if (directId) {
      return directId;
    }

    const dataAsId = this.getNumberValue(response, ['data', 'Data']);

    if (dataAsId) {
      return dataAsId;
    }

    const nestedKeys = ['ordenCompra', 'OrdenCompra', 'data', 'Data', 'result', 'Result', 'element', 'Element'];

    for (const key of nestedKeys) {
      const nestedValue = response[key];

      if (Array.isArray(nestedValue)) {
        for (const item of nestedValue) {
          if (!this.isDataRecord(item)) {
            continue;
          }

          const nestedId = this.getNumberValue(item, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId', 'Id', 'id']);

          if (nestedId) {
            return nestedId;
          }
        }
      }

      if (!this.isDataRecord(nestedValue)) {
        continue;
      }

      const nestedId = this.getNumberValue(nestedValue, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId', 'Id', 'id']);

      if (nestedId) {
        return nestedId;
      }
    }

    return null;
  }

  private buscarOrdenCompraGuardadaRecientemente(): Observable<number> {
    const pedidoIdAtencion = Number(this.form.controls['pedidoIdAtencion'].value);
    const proveedorId = Number(this.form.controls['proveedorId'].value);
    const formaPagoId = Number(this.form.controls['formaPagoId'].value);
    const referenciaObra = String(this.form.controls['referenciaObra'].value || '').trim();
    const referencia = String(this.form.controls['referencia'].value || '').trim();
    const observacion = String(this.form.controls['observacion'].value || '').trim();
    const subtotal = this.parseMontoControlValue(this.form.controls['subtotal'].value);
    const igv = this.parseMontoControlValue(this.form.controls['igv'].value);
    const total = this.parseMontoControlValue(this.form.controls['total'].value);

    return new Observable<number>((subscriber) => {
      this.apiService.getListarOrdenCompraActivo({ Flg_Est: 'A', Ord_Com_Tip: this.ordenCompraTipoId }).subscribe({
        next: (response: unknown) => {
          const matches = this.extractRecords(response)
            .map((item, index) => this.mapOrdenCompra(item, index))
            .filter((item): item is OrdenCompraRow => item !== null)
            .filter((item) =>
              item.ordenCompraId !== null &&
              item.pedidoIdAtencion === pedidoIdAtencion &&
              item.proveedorId === proveedorId &&
              item.formaPagoId === formaPagoId &&
              item.referenciaObra === referenciaObra &&
              item.referencia === referencia &&
              item.observacion === observacion &&
              item.subtotal === subtotal &&
              item.igv === igv &&
              item.total === total
            )
            .sort((a, b) => (b.ordenCompraId ?? 0) - (a.ordenCompraId ?? 0));

          const ordenCompraId = matches[0]?.ordenCompraId ?? null;

          if (!ordenCompraId) {
            subscriber.error(new Error('Se guardo la orden, pero no se pudo identificar el Ord_Com_Id para actualizar el detalle.'));
            return;
          }

          this.form.patchValue({ ordenCompraId: ordenCompraId }, { emitEvent: false });
          subscriber.next(ordenCompraId);
          subscriber.complete();
        },
        error: (error: unknown) => subscriber.error(error)
      });
    });
  }

  private syncTotalesCalculados(): void {
    if (this.form.controls['usarIgv18'].value) {
      this.form.controls['porcentajeIgv'].setValue(18, { emitEvent: false });
    }

    const detraccionId = this.getDetraccionIdSeleccionada();
    const montoDetraccion = this.aplicarRedondeoMontoDetraccion(this.montoDetraccionCalculado, detraccionId);
    const total = this.calcularTotalConDetraccion(
      this.totalConIgvCalculado,
      montoDetraccion,
      this.detraccionSeleccionada?.descripcion ?? ''
    );

    this.form.patchValue({
      descuento: this.descuentoValorNormalizado,
      subtotal: this.subtotalCalculado,
      igv: this.igvCalculado,
      montoDetraccion,
      total
    }, { emitEvent: false });
  }

  private aplicarRedondeoMontoDetraccion(monto: number, detraccionId: number): number {
    const montoNormalizado = this.normalizeDecimal(monto);

    if (!montoNormalizado || [11, 12, 13].includes(detraccionId)) {
      return montoNormalizado;
    }

    const parteEntera = Math.floor(montoNormalizado);
    const primerDecimal = Math.floor((montoNormalizado - parteEntera) * 10);

    return primerDecimal >= 5 ? parteEntera + 1 : parteEntera;
  }

  private calcularTotalConDetraccion(
    totalBase: number,
    montoDetraccion: number,
    detraccionDescripcion: string
  ): number {
    const operador = this.esPercepcion(detraccionDescripcion) ? 1 : -1;
    return this.normalizeDecimal(totalBase + operador * montoDetraccion);
  }

  private esPercepcion(descripcion: string): boolean {
    return String(descripcion || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .includes('PERCEPCION');
  }

  private redondearIgvSegunTercerDecimal(igv: number): number {
    const igvCuatroDecimales = this.normalizeDecimalPrecision(igv, 4);
    const tercerDecimal = Math.floor(igvCuatroDecimales * 1000 + Number.EPSILON) % 10;

    return tercerDecimal >= 5
      ? this.normalizeDecimal(igvCuatroDecimales)
      : igvCuatroDecimales;
  }

  private getPorcentajeIgv(): number {
    return this.normalizePorcentajeIgv(this.parseMontoControlValue(this.form.controls['porcentajeIgv'].value));
  }

  private resolvePorcentajeIgv(item: OrdenCompraRow): number {
    if (item.igvPor !== null && item.igvPor >= 0) {
      return this.normalizePorcentajeIgv(item.igvPor);
    }

    if (item.subtotal <= 0 || item.igv <= 0) {
      return 18;
    }

    return this.normalizeDecimal(item.igv * 100 / item.subtotal);
  }

  private normalizePorcentajeIgv(value: unknown): number {
    let porcentaje = this.normalizeDecimal(value);

    while (porcentaje > 100) {
      porcentaje = this.normalizeDecimal(porcentaje / 100);
    }

    return porcentaje;
  }

  private isIgv18Porcentaje(item: OrdenCompraRow): boolean {
    if (item.flgIgvAut) {
      return ['S', 'SI', 'Y', 'YES', 'TRUE', '1'].includes(item.flgIgvAut.trim().toUpperCase());
    }

    return Math.abs(this.resolvePorcentajeIgv(item) - 18) < 0.01;
  }

  private mapDetraccionOption(item: DataRecord): DetraccionOption | null {
    const id = this.getNumberValue(item, ['Det_Id', 'det_Id', 'detId', 'id', 'Id']);
    const descripcion = this.getTextValue(item, ['Det_Des', 'det_Des', 'detDes', 'descripcion', 'Descripcion']);
    const porcentaje = this.getDecimalValue(item, ['Det_Por', 'det_Por', 'detPor', 'porcentaje', 'Porcentaje']);

    if (!id || !descripcion) {
      return null;
    }

    return {
      id,
      descripcion,
      porcentaje,
      label: `${descripcion} - ${porcentaje.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
    };
  }

  private parseMontoControlValue(value: unknown, precision: number = 2): number {
    const raw = String(value ?? '').trim();

    if (!raw) {
      return 0;
    }

    const normalized = raw.replace(/,/g, '');
    const parsed = Number(normalized);

    return this.normalizeDecimalPrecision(parsed, precision);
  }

  private normalizeDetalleDescuento(costoBase: number, descuento: number, esPorcentaje: boolean): number {
    const limite = esPorcentaje ? 100 : Math.max(0, costoBase);
    return this.normalizeDecimalPrecision(Math.min(Math.max(0, descuento), limite), 4);
  }

  private calcularCostoUnitarioDetalle(costoBase: number, descuento: number, esPorcentaje: boolean): number {
    const descuentoAplicado = esPorcentaje
      ? costoBase * descuento / 100
      : descuento;
    return this.normalizeDecimalPrecision(Math.max(0, costoBase - descuentoAplicado), 4);
  }

  private calcularCostoBaseDetalle(costoRegistrado: number, descuento: number, esPorcentaje: boolean): number {
    if (descuento <= 0) {
      return costoRegistrado;
    }

    if (!esPorcentaje) {
      return this.normalizeDecimalPrecision(costoRegistrado + descuento, 4);
    }

    const factorRestante = 1 - descuento / 100;
    return factorRestante > 0
      ? this.normalizeDecimalPrecision(costoRegistrado / factorRestante, 4)
      : costoRegistrado;
  }

  private sanitizeDecimalInput(value: string, maxDecimals: number = 2): string {
    const sanitized = String(value || '')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');
    const [integerPart, decimalPart] = sanitized.split('.');

    if (decimalPart === undefined) {
      return integerPart;
    }

    return `${integerPart}.${decimalPart.slice(0, maxDecimals)}`;
  }

  private reconciliarDescripcionCentrosCosto(): void {
    if (!this.centrosCosto.length) {
      return;
    }

    this.centrosCosto = this.centrosCosto.map((item) => ({
      ...item,
      descripcion: this.resolveCentroCostoDescripcion(item.codigo)
    }));
  }

  private resolveCentroCostoDescripcion(codigo: number): string {
    return this.centrosCostoCatalogo.find((item) => item.codigo === codigo)?.descripcion || `Centro de costo ${codigo}`;
  }

  private reconciliarEtiquetasCatalogo(): void {
    if (!this.ordenesCompra.length) {
      return;
    }

    this.ordenesCompra = this.ordenesCompra.map((item) => ({
      ...item,
      proveedor: this.resolveProveedorNombre(item.proveedorId, item.proveedor),
      formaPago: this.resolveFormaPagoDescripcion(item.formaPagoId, item.formaPago),
      monedaAbreviacion: this.resolveMonedaAbreviacion(item.monedaId, item.monedaAbreviacion)
    }));
  }

  private resolveProveedorNombre(proveedorId: number, fallback: string): string {
    return this.proveedores.find((item) => item.code === proveedorId)?.name || fallback || (proveedorId ? String(proveedorId) : '-');
  }

  private resolveProveedor(proveedorId: number): ProviderRecord | null {
    return this.proveedores.find((item) => item.code === proveedorId) ?? null;
  }

  private reconciliarProveedorEditor(): void {
    const proveedorId = Number(this.form.controls['proveedorId'].value);
    const proveedor = this.resolveProveedor(proveedorId);

    if (!proveedor) {
      return;
    }

    this.form.patchValue({
      proveedor: proveedor.name,
      telefono: proveedor.phone,
      direccion: proveedor.address,
      contacto: proveedor.contact,
      ruc: proveedor.ruc
    }, { emitEvent: false });
  }

  private resolveFormaPagoDescripcion(formaPagoId: number, fallback: string): string {
    return this.formasPago.find((item) => item.code === formaPagoId)?.description || fallback || (formaPagoId ? String(formaPagoId) : '-');
  }

  private resolveMonedaAbreviacion(monedaId: number, fallback: string): string {
    const moneda = this.monedas.find((item) => item.id === monedaId);
    const monedaRegistrada = String(fallback || '').trim();

    if (monedaRegistrada) {
      return monedaRegistrada;
    }

    return moneda?.abreviacion || moneda?.descripcion || '-';
  }

  private resolveDetraccionDescripcion(detraccionId: number): string {
    return this.detracciones.find((item) => item.id === detraccionId)?.descripcion || '-';
  }

  private resolveDetraccionReporteLabel(detraccionId: number, descripcionRegistrada: string): string {
    const detraccion = this.detracciones.find((item) => item.id === detraccionId);
    const descripcion = String(descripcionRegistrada || detraccion?.descripcion || '').trim();

    if (!descripcion) {
      return 'DETRACCION';
    }

    if (descripcion.includes('%') || detraccion === undefined) {
      return descripcion;
    }

    const porcentaje = detraccion.porcentaje.toLocaleString('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

    return `${descripcion} - ${porcentaje}%`;
  }

  private resolveProveedorBancoPrincipal(response: unknown): OrdenCompraProveedorBancoReporte | null {
    const cuentas = this.extractRecords(response)
      .map((item) => this.mapProveedorBancoReporte(item))
      .filter((item): item is OrdenCompraProveedorBancoReporte => item !== null);

    return cuentas.find((item) => item.selected) ?? cuentas[0] ?? null;
  }

  private mapProveedorBancoReporte(item: DataRecord): OrdenCompraProveedorBancoReporte | null {
    const id = this.getNumberValue(item, ['Prv_Ban_Id', 'prv_Ban_Id', 'prvBanId', 'id', 'Id']);
    const bankId = this.getNumberValue(item, ['Ban_Id', 'ban_Id', 'banId']);

    if (!id || !bankId) {
      return null;
    }

    return {
      id,
      providerId: this.getNumberValue(item, ['Prv_Id', 'prv_Id', 'prvId']) ?? 0,
      bankId,
      bankName: this.getTextValue(item, ['Ban_Des', 'ban_Des', 'banDes', 'Ban_Abr', 'ban_Abr', 'banAbr']) || `Banco ${bankId}`,
      accountNumber: this.getTextValue(item, ['Prv_Ban_Nro_Cta', 'prv_Ban_Nro_Cta', 'prvBanNroCta']),
      cci: this.getTextValue(item, ['Prv_Ban_Nro_Cta_CCI', 'prv_Ban_Nro_Cta_CCI', 'prvBanNroCtaCci']),
      selected: this.getBooleanValue(item, [
        'Seleccionado',
        'seleccionado',
        'CuentaSeleccionada',
        'cuentaSeleccionada',
        'Prv_Ban_Sel',
        'prv_Ban_Sel',
        'prvBanSel',
        'Flg_Sel',
        'flg_Sel',
        'flgSel'
      ])
    };
  }

  private resolveBancoDescripcion(response: unknown, bancoId: number, fallback: string): string {
    const banco = this.extractRecords(response).find((item) => {
      const id = this.getNumberValue(item, ['Ban_Id', 'ban_Id', 'banId', 'id', 'Id']);
      return id === bancoId || (!bancoId && id !== null);
    });

    if (banco) {
      const descripcion = this.getTextValue(banco, ['Ban_Des', 'ban_Des', 'banDes', 'descripcion', 'Descripcion']);

      if (descripcion) {
        return descripcion;
      }
    }

    return fallback || (bancoId ? String(bancoId) : '-');
  }

  private getBooleanValue(item: DataRecord, keys: string[]): boolean {
    for (const key of keys) {
      const value = item[key];

      if (value === true || value === 1 || value === '1') {
        return true;
      }

      if (typeof value === 'string') {
        const normalizedValue = value.trim().toUpperCase();

        if (['S', 'SI', 'Y', 'YES', 'TRUE', 'A'].includes(normalizedValue)) {
          return true;
        }
      }
    }

    return false;
  }

  private getUsuarioSesionNormalizado(): string {
    return this.normalizeUsuarioConformidad(this.authService.getCurrentUser());
  }

  private normalizeUsuarioConformidad(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
  }

  private mapEstadoDescripcion(value: string): string {
    return this.estadoOptions.find((item) => item.codigo === value)?.descripcion || value || '-';
  }

  private mapPedidoEstadoDescripcion(value: string): string {
    switch (value) {
      case 'P':
        return 'Pendiente';
      case 'A':
        return 'Aprobado';
      case 'C':
        return 'Cancelado';
      default:
        return value || '-';
    }
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = [
      'ordenesCompra',
      'OrdenesCompra',
      'centrosCosto',
      'CentrosCosto',
      'elements',
      'Elements',
      'data',
      'Data',
      'result',
      'Result'
    ];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
  }

  private assertSuccessfulResponse(response: unknown, fallbackMessage: string): void {
    if (!this.isDataRecord(response)) {
      return;
    }

    if (response['success'] === false || response['Success'] === false) {
      const message = this.getTextValue(response, ['message', 'Message']) || fallbackMessage;
      throw new Error(message);
    }

    const codeResult = this.getNumberValue(response, ['codeResult', 'CodeResult']);

    if (codeResult !== null && codeResult >= 400) {
      const message = this.getTextValue(response, ['message', 'Message']) || fallbackMessage;
      throw new Error(message);
    }
  }

  private getTextValue(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = this.findDataValue(item, key);

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private getNumberValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(this.findDataValue(item, key));

      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private getDecimalValue(item: DataRecord, keys: string[], precision: number = 2): number {
    for (const key of keys) {
      const value = Number(this.findDataValue(item, key));

      if (Number.isFinite(value)) {
        return this.normalizeDecimalPrecision(value, precision);
      }
    }

    return 0;
  }

  private getOptionalDecimalValue(item: DataRecord, keys: string[], precision: number = 2): number | null {
    for (const key of keys) {
      const rawValue = this.findDataValue(item, key);

      if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
        continue;
      }

      const value = Number(rawValue);

      if (Number.isFinite(value)) {
        return this.normalizeDecimalPrecision(value, precision);
      }
    }

    return null;
  }

  private findDataValue(item: DataRecord, key: string): unknown {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      return item[key];
    }

    const normalizedKey = this.normalizeDataKey(key);
    const matchingKey = Object.keys(item).find((itemKey) => this.normalizeDataKey(itemKey) === normalizedKey);

    return matchingKey ? item[matchingKey] : undefined;
  }

  private normalizeDataKey(key: string): string {
    return String(key || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  private getOrdenCompraMoneyValue(item: DataRecord, keys: string[]): number {
    return this.normalizeOrdenCompraMoneyValue(this.getDecimalValue(item, keys));
  }

  private getOrdenCompraIgvValue(item: DataRecord, keys: string[]): number {
    return this.normalizeDecimalPrecision(this.getDecimalValue(item, keys, 4), 4);
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private normalizeDecimal(value: unknown): number {
    return this.normalizeDecimalPrecision(value, 2);
  }

  private normalizeDecimalPrecision(value: unknown, precision: number): number {
    const decimal = Number(value);

    if (!Number.isFinite(decimal) || decimal < 0) {
      return 0;
    }

    const factor = 10 ** Math.max(0, precision);
    return Math.round(decimal * factor) / factor;
  }

  private normalizeOrdenCompraMoneyValue(value: unknown): number {
    const monto = this.normalizeDecimal(value);

    if (monto >= 10000 && Number.isInteger(monto)) {
      return this.normalizeDecimal(monto / 100);
    }

    return monto;
  }

  private normalizeDetraccionReporte(value: unknown, totalConIgv: number): number {
    const monto = this.normalizeDecimal(value);

    if (monto <= totalConIgv) {
      return monto;
    }

    const montoConDecimalRestaurado = this.normalizeDecimal(monto / 100);

    if (montoConDecimalRestaurado <= totalConIgv) {
      return montoConDecimalRestaurado;
    }

    return monto;
  }

  private resolveErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error.trim();
      }

      if (this.isDataRecord(error.error)) {
        const message = this.getTextValue(error.error, ['message', 'Message']);

        if (message) {
          return message;
        }
      }
    }

    return fallbackMessage;
  }
}
