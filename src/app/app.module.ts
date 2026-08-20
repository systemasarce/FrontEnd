import { NgModule } from '@angular/core';
import { Overlay } from '@angular/cdk/overlay';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule, MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_SCROLL_STRATEGY, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
//Import API
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { PaymentSelectorDialogComponent } from './features/provider-form/dialogs/payment-selector-dialog.component';
import { ProviderSelectorDialogComponent } from './features/provider-form/dialogs/provider-selector-dialog.component';
import { ProviderFormComponent } from './features/provider-form/provider-form.component';
import { AppLayoutComponent } from './layouts/app-layout/app-layout.component';
import { AlmacenPageComponent } from './pages/almacen-page/almacen-page.component';
import { AlmacenSalidasReporteDialogComponent } from './pages/almacen-page/almacen-salidas-reporte-dialog.component';
import { BancoEditDialogComponent } from './pages/banco-page/banco-edit-dialog.component';
import { BancoPageComponent } from './pages/banco-page/banco-page.component';
import { BancoRegisterDialogComponent } from './pages/banco-page/banco-register-dialog.component';
import { CentroCostoEditDialogComponent } from './pages/centro-costos-page/centro-costo-edit-dialog.component';
import { CentroCostoRegisterDialogComponent } from './pages/centro-costos-page/centro-costo-register-dialog.component';
import { CentroCostosPageComponent } from './pages/centro-costos-page/centro-costos-page.component';
import { DetraccionEditDialogComponent } from './pages/detraccion-page/detraccion-edit-dialog.component';
import { DetraccionPageComponent } from './pages/detraccion-page/detraccion-page.component';
import { DetraccionRegisterDialogComponent } from './pages/detraccion-page/detraccion-register-dialog.component';
import { DireccionEntregaEditDialogComponent } from './pages/direccion-entrega-page/direccion-entrega-edit-dialog.component';
import { DireccionEntregaPageComponent } from './pages/direccion-entrega-page/direccion-entrega-page.component';
import { DireccionEntregaRegisterDialogComponent } from './pages/direccion-entrega-page/direccion-entrega-register-dialog.component';
import { FormaPagoEditDialogComponent } from './pages/forma-pago-page/forma-pago-edit-dialog.component';
import { FormaPagoPageComponent } from './pages/forma-pago-page/forma-pago-page.component';
import { FormaPagoRegisterDialogComponent } from './pages/forma-pago-page/forma-pago-register-dialog.component';
import { GrupoItemEditDialogComponent } from './pages/grupo-item-page/grupo-item-edit-dialog.component';
import { GrupoItemPageComponent } from './pages/grupo-item-page/grupo-item-page.component';
import { GrupoItemRegisterDialogComponent } from './pages/grupo-item-page/grupo-item-register-dialog.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { ItemEditDialogComponent } from './pages/item-page/item-edit-dialog.component';
import { ItemPageComponent } from './pages/item-page/item-page.component';
import { ItemRegisterDialogComponent } from './pages/item-page/item-register-dialog.component';
import { ItemTreePageComponent } from './pages/item-tree-page/item-tree-page.component';
import { ItemDetalleMaterialEditDialogComponent } from './pages/item-detalle-material-page/item-detalle-material-edit-dialog.component';
import { ItemDetalleMaterialPageComponent } from './pages/item-detalle-material-page/item-detalle-material-page.component';
import { ItemDetalleMaterialRegisterDialogComponent } from './pages/item-detalle-material-page/item-detalle-material-register-dialog.component';
import { MonedaEditDialogComponent } from './pages/moneda-page/moneda-edit-dialog.component';
import { MonedaPageComponent } from './pages/moneda-page/moneda-page.component';
import { MonedaRegisterDialogComponent } from './pages/moneda-page/moneda-register-dialog.component';
import { OrdenCompraPageComponent } from './pages/orden-compra-page/orden-compra-page.component';
import { OrdenCompraParcialDialogComponent } from './pages/orden-compra-page/orden-compra-parcial-dialog.component';
import { PerfilAccesosDialogComponent } from './pages/perfil-page/perfil-accesos-dialog.component';
import { PerfilPageComponent } from './pages/perfil-page/perfil-page.component';
import { ProviderPageComponent } from './pages/provider-page/provider-page.component';
import { ProviderBanksDialogComponent } from './pages/provider-page/provider-banks-dialog.component';
import { ProviderEditDialogComponent } from './pages/provider-page/provider-edit-dialog.component';
import { ProviderRegisterDialogComponent } from './pages/provider-page/provider-register-dialog.component';
import { StockPageComponent } from './pages/stock-page/stock-page.component';
import { CotizacionesCancelDialogComponent } from './pages/Cotizaciones-page/cotizaciones-cancel-dialog.component';
import { CotizacionesArchivoDialogComponent } from './pages/Cotizaciones-page/cotizaciones-archivo-dialog.component';
import { ApprovalUserSelectorDialogComponent } from './pages/requisiciones-page/approval-user-selector-dialog.component';
import { CentroCostoSelectorDialogComponent } from './pages/requisiciones-page/centro-costo-selector-dialog.component';
import { PedidosBPageComponent } from './pages/requisiciones-page/pedidos-b-page.component';
import { CotizacionesTjh2bPageComponent } from './pages/Cotizaciones-page/cotizaciones-tjh2b-page.component';
import { PedidoApprovalDialogComponent } from './pages/requisiciones-page/pedido-approval-dialog.component';
import { PedidoDetalleDeleteDialogComponent } from './pages/requisiciones-page/pedido-detalle-delete-dialog.component';
import { PedidoDetalleDialogComponent } from './pages/requisiciones-page/pedido-detalle-dialog.component';
import { PedidoDetalleImageSourceDialogComponent } from './pages/requisiciones-page/pedido-detalle-image-source-dialog.component';
import { PedidoDetalleItemSelectorDialogComponent } from './pages/requisiciones-page/pedido-detalle-item-selector-dialog.component';
import { PedidoDetalleUnidadSelectorDialogComponent } from './pages/requisiciones-page/pedido-detalle-unidad-selector-dialog.component';
import { PedidoArchivosDialogComponent } from './pages/requisiciones-page/pedido-archivos-dialog.component';
import { PedidoRechazoDialogComponent } from './pages/requisiciones-page/pedido-rechazo-dialog.component';
import { RequisicionesPageComponent } from './pages/requisiciones-page/requisiciones-page.component';
import { SubGrupoItemEditDialogComponent } from './pages/sub-grupo-item-page/sub-grupo-item-edit-dialog.component';
import { SubGrupoItemPageComponent } from './pages/sub-grupo-item-page/sub-grupo-item-page.component';
import { SubGrupoItemRegisterDialogComponent } from './pages/sub-grupo-item-page/sub-grupo-item-register-dialog.component';
import { TipoServicioEditDialogComponent } from './pages/tipo-servicio-page/tipo-servicio-edit-dialog.component';
import { TipoServicioPageComponent } from './pages/tipo-servicio-page/tipo-servicio-page.component';
import { TipoServicioRegisterDialogComponent } from './pages/tipo-servicio-page/tipo-servicio-register-dialog.component';
import { UnidadMedidaEditDialogComponent } from './pages/unidad-medida-page/unidad-medida-edit-dialog.component';
import { UnidadMedidaPageComponent } from './pages/unidad-medida-page/unidad-medida-page.component';
import { UnidadMedidaRegisterDialogComponent } from './pages/unidad-medida-page/unidad-medida-register-dialog.component';
import { TipoReportePageComponent } from './pages/inspecciones/tipo-reporte/tipo-reporte-page.component';
import { ClientePageComponent } from './pages/inspecciones/cliente/cliente-page.component';
import { ClienteTjh2bPageComponent } from './pages/inspecciones/cliente-tjh2b/cliente-tjh2b-page.component';
import { TipoInspeccionPageComponent } from './pages/inspecciones/tipo-inspeccion/tipo-inspeccion-page.component';
import { PreguntasHsePageComponent } from './pages/inspecciones/preguntas-hse/preguntas-hse-page.component';
import { TipoRiesgoPageComponent } from './pages/inspecciones/tipo-riesgo/tipo-riesgo-page.component';
import { RiesgoPageComponent } from './pages/inspecciones/riesgo/riesgo-page.component';
import { ReportePageComponent } from './pages/inspecciones/reporte/reporte-page.component';
import { MotivoPageComponent } from './pages/inspecciones/motivo/motivo-page.component';
import { SubestacionPageComponent } from './pages/inspecciones/subestacion/subestacion-page.component';
import { TipoReporteRegisterDialogComponent } from './pages/inspecciones/tipo-reporte/tipo-reporte-register-dialog.component';
import { ClienteRegisterDialogComponent } from './pages/inspecciones/cliente/cliente-register-dialog.component';
import { ClienteTjh2bRegisterDialogComponent } from './pages/inspecciones/cliente-tjh2b/cliente-tjh2b-register-dialog.component';
import { TipoReporteService } from './pages/inspecciones/tipo-reporte/tipo-reporte.service';
import { UsuariosPageComponent } from './pages/usuarios-page/usuarios-page.component';
import { UsuarioEditDialogComponent } from './pages/usuarios-page/usuario-edit-dialog.component';
import { UsuarioRegisterDialogComponent } from './pages/usuarios-page/usuario-register-dialog.component';
import { GridPaginationComponent } from './shared/components/grid-pagination/grid-pagination.component';
import { InspeccionesPageComponent } from './pages/inspecciones-page/inspecciones-page.component';
import { ConfirmacionAccionDialogComponent } from './pages/inspecciones-page/confirmacion-accion-dialog.component';
import { ElegirEdicionCentroMonitoreoDialogComponent } from './pages/inspecciones-page/elegir-edicion-centro-monitoreo-dialog.component';
import { CentroMonitoreoHsePuntajeDialogComponent } from './pages/inspecciones-page/centro-monitoreo-hse-puntaje-dialog.component';
import { CentroMonitoreoHseMotivoDialogComponent } from './pages/inspecciones-page/centro-monitoreo-hse-motivo-dialog.component';
import { ObservacionesPlaneadasComponent } from './pages/inspecciones-page/observaciones-planeadas/observaciones-planeadas.component';
import { InspeccionMedioAmbienteComponent } from './pages/inspecciones-page/inspeccion-medio-ambiente/inspeccion-medio-ambiente.component';
import { InspeccionPrevencionComponent } from './pages/inspecciones-page/inspeccion-prevencion/inspeccion-prevencion.component';
import { InspeccionStopReportComponent } from './pages/inspecciones-page/inspeccion-stop-report/inspeccion-stop-report.component';
import { WeReportComponent } from './pages/inspecciones-page/we-report/we-report.component';
import { WeReportArchivosDialogComponent } from './pages/inspecciones-page/we-report-archivos-dialog.component';
import { SeleccionCapturaFotoDialogComponent } from './pages/inspecciones-page/seleccion-captura-foto-dialog.component';
import { CapturaFotoDialogComponent } from './pages/inspecciones-page/captura-foto-dialog.component';
import { CapturaAudioDialogComponent } from './pages/inspecciones-page/captura-audio-dialog.component';
import { CentroMonitoreoHseComponent } from './pages/inspecciones-page/centro-monitoreo-hse/centro-monitoreo-hse.component';
import { CentroMonitoreoHseNotaDialogComponent } from './pages/inspecciones-page/centro-monitoreo-hse-nota-dialog.component';
import { ReportesPageComponent } from './pages/reportes-page/reportes-page.component';
import { KardexGeneralReportePageComponent } from './pages/reportes-page/kardex-general-reporte-page.component';
import { IngresoSalidasAlmacenReportePageComponent } from './pages/reportes-page/ingreso-salidas-almacen-reporte-page.component';
import { OrdenesCompraServicioReportePageComponent } from './pages/reportes-page/ordenes-compra-servicio-reporte-page.component';
import { AsignacionesUsuariosReportePageComponent } from './pages/reportes-page/asignaciones-usuarios-reporte-page.component';
import { ReporteOcosPageComponent } from './pages/reportes-page/reporte-ocos-page.component';
import { AsignacionPageComponent } from './pages/asignacion-page/asignacion-page.component';
import { ObraPageComponent } from './pages/obra-page/obra-page.component';
import { TransferenciaAlmacenPageComponent } from './pages/transferencia-almacen-page/transferencia-almacen-page.component';

export function dialogScrollStrategyFactory(overlay: Overlay) {
  return () => overlay.scrollStrategies.reposition();
}

const APP_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY'
  },
  display: {
    dateInput: 'dd/MM/yyyy',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'dd/MM/yyyy',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

@NgModule({
  declarations: [
    AppComponent,
    AppLayoutComponent,
    AlmacenPageComponent,
    AlmacenSalidasReporteDialogComponent,
    BancoPageComponent,
    BancoRegisterDialogComponent,
    BancoEditDialogComponent,
    CentroCostosPageComponent,
    CentroCostoRegisterDialogComponent,
    CentroCostoEditDialogComponent,
    DireccionEntregaPageComponent,
    DireccionEntregaRegisterDialogComponent,
    DireccionEntregaEditDialogComponent,
    DetraccionPageComponent,
    DetraccionRegisterDialogComponent,
    DetraccionEditDialogComponent,
    MonedaPageComponent,
    MonedaRegisterDialogComponent,
    MonedaEditDialogComponent,
    OrdenCompraPageComponent,
    OrdenCompraParcialDialogComponent,
    PerfilAccesosDialogComponent,
    PerfilPageComponent,
    FormaPagoPageComponent,
    FormaPagoRegisterDialogComponent,
    FormaPagoEditDialogComponent,
    GrupoItemPageComponent,
    GrupoItemRegisterDialogComponent,
    GrupoItemEditDialogComponent,
    SubGrupoItemPageComponent,
    SubGrupoItemRegisterDialogComponent,
    SubGrupoItemEditDialogComponent,
    ItemPageComponent,
    ItemRegisterDialogComponent,
    ItemEditDialogComponent,
    ItemTreePageComponent,
    ItemDetalleMaterialPageComponent,
    ItemDetalleMaterialRegisterDialogComponent,
    ItemDetalleMaterialEditDialogComponent,
    HomePageComponent,
    ProviderPageComponent,
    ProviderBanksDialogComponent,
    ProviderEditDialogComponent,
    ProviderRegisterDialogComponent,
    StockPageComponent,
    ProviderFormComponent,
    ProviderSelectorDialogComponent,
    PaymentSelectorDialogComponent,
    CotizacionesCancelDialogComponent,
    CotizacionesArchivoDialogComponent,
    PedidoApprovalDialogComponent,
    ApprovalUserSelectorDialogComponent,
    CentroCostoSelectorDialogComponent,
    PedidoDetalleDeleteDialogComponent,
    PedidoDetalleDialogComponent,
    PedidoDetalleImageSourceDialogComponent,
    PedidoDetalleItemSelectorDialogComponent,
    PedidoDetalleUnidadSelectorDialogComponent,
    PedidoArchivosDialogComponent,
    PedidoRechazoDialogComponent,
    RequisicionesPageComponent,
    PedidosBPageComponent,
    CotizacionesTjh2bPageComponent,
    TipoServicioPageComponent,
    TipoServicioRegisterDialogComponent,
    TipoServicioEditDialogComponent,
    UnidadMedidaPageComponent,
    UnidadMedidaRegisterDialogComponent,
    UnidadMedidaEditDialogComponent,
    TipoReportePageComponent,
    ClientePageComponent,
    ClienteTjh2bPageComponent,
    TipoInspeccionPageComponent,
    PreguntasHsePageComponent,
    TipoRiesgoPageComponent,
    RiesgoPageComponent,
    ReportePageComponent,
    MotivoPageComponent,
    SubestacionPageComponent,
    TipoReporteRegisterDialogComponent,
    ClienteRegisterDialogComponent,
    ClienteTjh2bRegisterDialogComponent,
    LoginPageComponent,
    UsuariosPageComponent,
    UsuarioEditDialogComponent,
    UsuarioRegisterDialogComponent,
    InspeccionesPageComponent,
    ConfirmacionAccionDialogComponent,
    ElegirEdicionCentroMonitoreoDialogComponent,
    ObservacionesPlaneadasComponent,
    InspeccionMedioAmbienteComponent,
    InspeccionPrevencionComponent,
    InspeccionStopReportComponent,
    WeReportComponent,
    WeReportArchivosDialogComponent,
    SeleccionCapturaFotoDialogComponent,
    CapturaFotoDialogComponent,
    CapturaAudioDialogComponent,
    CentroMonitoreoHseComponent,
    CentroMonitoreoHseNotaDialogComponent,
    CentroMonitoreoHsePuntajeDialogComponent,
    CentroMonitoreoHseMotivoDialogComponent,
    GridPaginationComponent,
    ReportesPageComponent,
    KardexGeneralReportePageComponent,
    IngresoSalidasAlmacenReportePageComponent,
    OrdenesCompraServicioReportePageComponent,
    AsignacionesUsuariosReportePageComponent,
    ReporteOcosPageComponent,
    AsignacionPageComponent,
    ObraPageComponent,
    TransferenciaAlmacenPageComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatOptionModule,
    MatSelectModule,
    MatSnackBarModule,
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [
    {
      provide: MAT_DIALOG_SCROLL_STRATEGY,
      deps: [Overlay],
      useFactory: dialogScrollStrategyFactory
    },
    {
      provide: MAT_DATE_LOCALE,
      useValue: 'es-PE'
    },
    {
      provide: MAT_DATE_FORMATS,
      useValue: APP_DATE_FORMATS
    },
    TipoReporteService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
