import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormGroup } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ApprovalUserSelectorDialogComponent } from './approval-user-selector-dialog.component';
import { CentroCostoSelectorDialogComponent } from './centro-costo-selector-dialog.component';
import { RequisicionesPageComponent } from './requisiciones-page.component';

@Component({
  selector: 'app-provider-form',
  template: ''
})
class ProviderFormStubComponent {
  @Input() embedded = false;
  readonly form = new FormGroup({
    supplierCode: new FormControl(0, { nonNullable: true }),
    supplierName: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
    contact: new FormControl('', { nonNullable: true }),
    ruc: new FormControl('', { nonNullable: true }),
    paymentCode: new FormControl(0, { nonNullable: true }),
    paymentDescription: new FormControl('', { nonNullable: true }),
    isEventual: new FormControl(false, { nonNullable: true })
  });

  hydrateForm(data: ReturnType<ProviderFormStubComponent['form']['getRawValue']>): void {
    this.form.patchValue(data);
  }

  resetForm(): void {
    this.form.reset({
      supplierCode: 0,
      supplierName: '',
      phone: '',
      address: '',
      contact: '',
      ruc: '',
      paymentCode: 0,
      paymentDescription: '',
      isEventual: false
    });
  }
}

describe('RequisicionesPageComponent', () => {
  let component: RequisicionesPageComponent;
  let fixture: ComponentFixture<RequisicionesPageComponent>;
  let matDialogMock: { open: jasmine.Spy };
  let apiServiceMock: {
    getListarPedido: jasmine.Spy;
    getListarPedidoModificar: jasmine.Spy;
    getListarPedidoRegistradoCentroCosto: jasmine.Spy;
    getListarDetallePedido: jasmine.Spy;
    getListarDetallePedidoModificar: jasmine.Spy;
    getListarPedidoCorrelativoNuevo: jasmine.Spy;
    getListarUsuarioActivo: jasmine.Spy;
    getListarCentroCostoActivo: jasmine.Spy;
    getListarItem: jasmine.Spy;
    getListarUnidadMedida: jasmine.Spy;
    getListarMoneda: jasmine.Spy;
    postRegistrarPedido: jasmine.Spy;
    patchActualizarPedidoEstado: jasmine.Spy;
    patchActualizarPedido: jasmine.Spy;
    postRegistrarDetallePedido: jasmine.Spy;
    patchActualizarDetallePedido: jasmine.Spy;
    deleteEliminarDetallePedido: jasmine.Spy;
    postRegistrarCentroCostoPedidoRegistrado: jasmine.Spy;
    deleteEliminarCentroCostoPedidoRegistrado: jasmine.Spy;
  };
  let authServiceMock: { getCurrentUser: jasmine.Spy };

  beforeEach(async () => {
    matDialogMock = {
      open: jasmine.createSpy('open').and.returnValue({
        afterClosed: () => of(false)
      })
    };

    apiServiceMock = {
      getListarPedido: jasmine.createSpy('getListarPedido').and.returnValue(
        of({
          elements: [
            {
              Ped_Id: 1042,
              Prv_Nom: 'Mirko Supplies',
              Ped_Tip_Mon: 1,
              Ped_Tot: 1850.5,
              Flg_Est: 'P',
              Usr_Reg: 'USR018',
              Ped_Usr_Apr: 'mramirez',
              Fec_Reg: '2026-04-26T00:00:00',
              Ped_Arc_Adj_Nom: 'pedido-1042.pdf'
            },
            {
              Ped_Id: 1015,
              Prv_Nom: 'Andes Equipos',
              Ped_Tip_Mon: 2,
              Ped_Tot: 2140,
              Flg_Est: 'A',
              Usr_Reg: 'USR027',
              Ped_Usr_Apr: 'mramirez',
              Fec_Reg: '2026-04-20T00:00:00',
              Ped_Arc_Adj_Nom: 'pedido-1015.xlsx'
            }
          ]
        })
      ),
      getListarPedidoModificar: jasmine.createSpy('getListarPedidoModificar').and.returnValue(
        of({
          elements: [
            {
              Ped_Id: 1042,
              Ped_Usr_Apr: 'mramirez',
              Ped_Lug_Ent: 'Santa Anita',
              Ped_Ref: 'Compra de prueba',
              Ped_Tip_Com: 'CO',
              Ped_Tip_Mon: 1,
              Ped_Fec_Ent: '2026-04-30T00:00:00',
              Ped_Sus: 'Sustento de prueba',
              Ped_Arc_Adj_Nom: 'pedido-1042.pdf',
              Ped_Prv_Cod: 1024,
              Ped_For_Pag_Cod: 3
            }
          ]
        })
      ),
      getListarPedidoRegistradoCentroCosto: jasmine.createSpy('getListarPedidoRegistradoCentroCosto').and.returnValue(
        of({
          elements: [
            {
              Ped_Cen_Cos_Id: 2,
              Ped_Id: 1042,
              Ped_Cen_Cos: '1',
              Ped_Can: 3
            }
          ]
        })
      ),
      getListarDetallePedido: jasmine.createSpy('getListarDetallePedido').and.returnValue(
        of({
          elements: [
            {
              Ped_Det_Id: 11,
              Ped_Cod_Itm: '1',
              Ped_Uni_Med: 'UND',
              Ped_Can: 2,
              Ped_Cos_Uni: 15.5,
              Ped_Cos_Tot: 31
            }
          ]
        })
      ),
      getListarDetallePedidoModificar: jasmine.createSpy('getListarDetallePedidoModificar').and.returnValue(
        of({
          elements: [
            {
              Ped_Det_Id: 11,
              Ped_Cod_Itm: '1',
              Ped_Uni_Med: 'UND',
              Ped_Can: 2,
              Ped_Cos_Uni: 15.5,
              Ped_Cos_Tot: 31
            }
          ]
        })
      ),
      getListarPedidoCorrelativoNuevo: jasmine.createSpy('getListarPedidoCorrelativoNuevo').and.returnValue(
        of({
          elements: [
            { Ped_Id: 1043 }
          ]
        })
      ),
      getListarUsuarioActivo: jasmine.createSpy('getListarUsuarioActivo').and.returnValue(
        of({
          elements: [
            { Usr_Id: 7, Usr_Cod: 'mramirez', Usr_Nom: 'Miguel Ramirez', Flg_Est: 'A' },
            { Usr_Id: 9, Usr_Cod: 'agarcia', Usr_Nom: 'Ana Garcia', Flg_Est: 'A' }
          ]
        })
      ),
      getListarCentroCostoActivo: jasmine.createSpy('getListarCentroCostoActivo').and.returnValue(
        of({
          elements: [
            { Cen_Cos_Id: 1, Cen_Cos_Des: 'CC-80 Obras', Flg_Est: 'A' },
            { Cen_Cos_Id: 2, Cen_Cos_Des: 'CC-21 Logistica', Flg_Est: 'A' }
          ]
        })
      ),
      getListarItem: jasmine.createSpy('getListarItem').and.returnValue(
        of({
          elements: [
            { Itm_Id: 1, Itm_Des: 'Lapicero', Itm_Grp: 1, Grp_Des: 'Utiles', Flg_Est: 'A' },
            { Itm_Id: 2, Itm_Des: 'Escoba', Itm_Grp: 1, Grp_Des: 'Limpieza', Flg_Est: 'A' }
          ]
        })
      ),
      getListarUnidadMedida: jasmine.createSpy('getListarUnidadMedida').and.returnValue(
        of({
          elements: [
            { Uni_Med_Id: 1, Uni_Med_Des: 'Unidad', Uni_Med_Abr: 'UND', Flg_Est: 'A' },
            { Uni_Med_Id: 2, Uni_Med_Des: 'Docena', Uni_Med_Abr: 'DOC', Flg_Est: 'A' }
          ]
        })
      ),
      getListarMoneda: jasmine.createSpy('getListarMoneda').and.returnValue(
        of({
          elements: [
            { Mon_Id: 1, Mon_Des: 'Soles', Mon_Abr: 'PEN', Flg_Est: 'A' },
            { Mon_Id: 2, Mon_Des: 'Dolares', Mon_Abr: 'USD', Flg_Est: 'A' }
          ]
        })
      ),
      postRegistrarPedido: jasmine.createSpy('postRegistrarPedido').and.returnValue(
        of({
          Success: true,
          Message: 'Pedido registrado correctamente'
        })
      ),
      patchActualizarPedidoEstado: jasmine.createSpy('patchActualizarPedidoEstado').and.returnValue(
        of({
          Success: true,
          Message: 'Estado actualizado correctamente'
        })
      ),
      patchActualizarPedido: jasmine.createSpy('patchActualizarPedido').and.returnValue(
        of({
          Success: true,
          Message: 'Pedido actualizado correctamente'
        })
      ),
      postRegistrarDetallePedido: jasmine.createSpy('postRegistrarDetallePedido').and.returnValue(
        of({
          Success: true,
          Message: 'Detalle registrado correctamente'
        })
      ),
      patchActualizarDetallePedido: jasmine.createSpy('patchActualizarDetallePedido').and.returnValue(
        of({
          Success: true,
          Message: 'Detalle actualizado correctamente'
        })
      ),
      deleteEliminarDetallePedido: jasmine.createSpy('deleteEliminarDetallePedido').and.returnValue(
        of({
          Success: true,
          Message: 'Detalle eliminado correctamente'
        })
      ),
      postRegistrarCentroCostoPedidoRegistrado: jasmine.createSpy('postRegistrarCentroCostoPedidoRegistrado').and.returnValue(
        of({
          Success: true,
          Message: 'Centro de costo registrado correctamente'
        })
      ),
      deleteEliminarCentroCostoPedidoRegistrado: jasmine.createSpy('deleteEliminarCentroCostoPedidoRegistrado').and.returnValue(
        of({
          Success: true,
          Message: 'Centro de costo eliminado correctamente'
        })
      )
    };

    authServiceMock = {
      getCurrentUser: jasmine.createSpy('getCurrentUser').and.returnValue('admin@demo.com')
    };

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [RequisicionesPageComponent, ProviderFormStubComponent],
      providers: [
        {
          provide: ApiService,
          useValue: apiServiceMock
        },
        {
          provide: MatDialog,
          useValue: matDialogMock
        },
        {
          provide: AuthService,
          useValue: authServiceMock
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RequisicionesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load registered orders from api on init', () => {
    expect(apiServiceMock.getListarPedido).toHaveBeenCalledWith({ Flg_Est: 'P' });
    expect(apiServiceMock.getListarUsuarioActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(apiServiceMock.getListarCentroCostoActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(apiServiceMock.getListarItem).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(apiServiceMock.getListarUnidadMedida).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(apiServiceMock.getListarMoneda).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.requisiciones.length).toBe(2);
    expect(component.requisiciones[0].codigo).toBe('PED-1042');
    expect(component.requisiciones[0].proveedor).toBe('Mirko Supplies');
    expect(component.requisiciones[0].archivo).toBe('PDF');
  });

  it('should load approval users from the current usuarios list', () => {
    expect(component.approvalUsers).toEqual([
      { id: 7, code: 'mramirez', name: 'Miguel Ramirez' },
      { id: 9, code: 'agarcia', name: 'Ana Garcia' }
    ]);
  });

  it('should load center cost options from api', () => {
    expect(component.centroCostoOptions).toEqual([
      { id: 1, descripcion: 'CC-80 Obras' },
      { id: 2, descripcion: 'CC-21 Logistica' }
    ]);
  });

  it('should load moneda options from api using code-description format', () => {
    expect(component.tipoMoneda).toEqual([
      { codigo: 1, descripcion: 'PEN' },
      { codigo: 2, descripcion: 'USD' }
    ]);
  });

  it('should keep the editor hidden until Nuevo is clicked', () => {
    expect(component.mostrarEditorPedido).toBeFalse();

    component.ejecutarAccion('Nuevo');

    expect(component.mostrarEditorPedido).toBeTrue();
    expect(component.cabeceraForm.value.requisicionCompra).toBe(1043);
  });

  it('should enable modificar only after selecting a pedido row', () => {
    expect(component.isActionDisabled('Modificar')).toBeTrue();

    component.seleccionarPedido(component.requisiciones[0]);

    expect(component.isActionDisabled('Modificar')).toBeFalse();
  });

  it('should load pedido data with getListarPedidoModificar when modifying the selected row', () => {
    component.seleccionarPedido(component.requisiciones[0]);

    component.ejecutarAccion('Modificar');
    fixture.detectChanges();

    expect(apiServiceMock.getListarPedidoModificar).toHaveBeenCalledWith(1042);
    expect(apiServiceMock.getListarPedidoRegistradoCentroCosto).toHaveBeenCalledWith(1042);
    expect(component.mostrarEditorPedido).toBeTrue();
    expect(component.isEditingPedido).toBeTrue();
    expect(component.cabeceraForm.value.requisicionCompra).toBe(1042);
    expect(component.cabeceraForm.value.usuarioAprobacion).toBe('mramirez');
    expect(component.detalleForm.value.lugarEntrega).toBe('Santa Anita');
    expect(component.detalleForm.value.referencia).toBe('Compra de prueba');
    expect(component.detalleForm.value.oc).toBe('CO');
    expect(component.detalleForm.value.moneda).toBe(1);
    expect(component.centrosCosto).toEqual([
      { id: 1, codigo: 1, costo: 'CC-80 Obras', cantidad: 3, persistedId: 2 }
    ]);
  });

  it('should open a dedicated detail view with linked center costs and registered detail items', () => {
    const pedido = component.requisiciones[0];

    component.toggleDetallePedido(pedido);

    expect(component.mostrarDetallePedido).toBeTrue();
    expect(apiServiceMock.getListarDetallePedido).toHaveBeenCalledWith(1042);
    expect(apiServiceMock.getListarPedidoRegistradoCentroCosto).toHaveBeenCalledWith(1042);
    expect(component.detallePedidoCantidadLimite).toBe(3);
    expect(component.getCentroCostoPedidoExpandido()).toEqual([
      { id: 1, codigo: 1, costo: 'CC-80 Obras', cantidad: 3, persistedId: 2 }
    ]);
    expect(component.getDetallePedidoExpandido()).toEqual([
      {
        id: 11,
        persistedId: 11,
        item: '1',
        codigoItem: '1',
        descripcion: 'Lapicero',
        unidadCodigo: 'UND',
        unidad: 'Unidad',
        cantidad: 2,
        precioUnitario: 15.5,
        subtotal: 31
      }
    ]);
  });

  it('should block saving detail items when the proposed quantity exceeds the allowed total', () => {
    component.toggleDetallePedido(component.requisiciones[0]);
    component.detallePedidoForm.patchValue({
      codigoItem: '3',
      unidad: 'UND',
      cantidad: 2,
      precioUnitario: 1
    });

    component.guardarPedidoDetalle();

    expect(apiServiceMock.getListarPedidoRegistradoCentroCosto).toHaveBeenCalledWith(1042);
    expect(apiServiceMock.postRegistrarDetallePedido).not.toHaveBeenCalled();
    expect(component.detallePedidoErrorMessage).toContain('no puede ser mayor que la cantidad total permitida');
  });

  it('should keep the editor open when cancel confirmation is rejected', () => {
    component.iniciarNuevoPedido();
    matDialogMock.open.and.returnValue({
      afterClosed: () => of(false)
    });

    component.confirmarCancelacionPedido();

    expect(component.mostrarEditorPedido).toBeTrue();
  });

  it('should close the editor when cancel confirmation is accepted', () => {
    component.iniciarNuevoPedido();
    matDialogMock.open.and.returnValue({
      afterClosed: () => of(true)
    });

    component.confirmarCancelacionPedido();

    expect(component.mostrarEditorPedido).toBeFalse();
  });

  it('should open the cancel dialog when cancel is requested', () => {
    component.iniciarNuevoPedido();

    component.confirmarCancelacionPedido();

    expect(matDialogMock.open).toHaveBeenCalled();
  });

  it('should request filtered requisitions by provider name', () => {
    component.filtersForm.patchValue({
      proveedor: 'andes',
      estado: 'Pendiente'
    });

    component.aplicarFiltros();

    expect(apiServiceMock.getListarPedido).toHaveBeenCalledWith({ Prv_Nom: 'andes', Flg_Est: 'P' });
  });

  it('should reset requisition filters to the default values', () => {
    component.filtersForm.patchValue({
      nroRequisicion: '1032',
      proveedor: 'tech',
      estado: 'Cancelado',
      gn: 'GC',
      tipo: 'Sin O/C'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      nroRequisicion: '',
      proveedor: '',
      estado: 'Pendiente',
      gn: 'Todos',
      tipo: 'Todos'
    });
    expect(apiServiceMock.getListarPedido).toHaveBeenCalledWith({ Flg_Est: 'P' });
  });

  it('should show the empty database message when there are no registered orders', () => {
    apiServiceMock.getListarPedido.and.returnValue(of({ elements: [] }));

    fixture = TestBed.createComponent(RequisicionesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('No se han encontrado pedidos en la base de datos.');
  });

  it('should initialize with no center cost rows', () => {
    expect(component.centrosCosto.length).toBe(0);
    expect(component.totalPorcentaje).toBe(0);
    expect(component.cabeceraForm.value.requisicionCompra).toBeNull();
    expect(component.cabeceraForm.value.usuarioAprobacionId).toBe(0);
    expect(component.cabeceraForm.value.usuarioAprobacion).toBe('');
    expect(component.centroCostoForm.value.centroCostoId).toBe(0);
    expect(component.centroCostoForm.value.centroCosto).toBe('');
    expect(component.detalleForm.value.oc).toBe('');
    expect(component.detalleForm.value.moneda).toBeNull();
    expect(component.detalleForm.value.sustento).toBe('');
  });

  it('should load the requisition number automatically when starting a new order', () => {
    component.iniciarNuevoPedido();

    expect(apiServiceMock.getListarPedidoCorrelativoNuevo).toHaveBeenCalled();
    expect(component.cabeceraForm.value.requisicionCompra).toBe(1043);
  });

  it('should open the approval user dialog and apply the selected user code', () => {
    matDialogMock.open.and.returnValue({
      afterClosed: () => of({ id: 9, code: 'agarcia', name: 'Ana Garcia' })
    });

    component.openApprovalUserDialog();

    expect(matDialogMock.open).toHaveBeenCalledWith(ApprovalUserSelectorDialogComponent, jasmine.objectContaining({
      data: {
        users: component.approvalUsers
      }
    }));
    expect(component.cabeceraForm.value.usuarioAprobacionId).toBe(9);
    expect(component.cabeceraForm.value.usuarioAprobacion).toBe('agarcia');
  });

  it('should open the center cost dialog and apply the selected center cost', () => {
    component.centrosCosto = [];
    matDialogMock.open.and.returnValue({
      afterClosed: () => of({ id: 2, descripcion: 'CC-21 Logistica' })
    });

    component.openCentroCostoDialog();

    expect(matDialogMock.open).toHaveBeenCalledWith(CentroCostoSelectorDialogComponent, jasmine.objectContaining({
      data: {
        centrosCosto: component.centroCostoOptions
      }
    }));
    expect(component.centrosCosto[0].codigo).toBe(2);
    expect(component.centrosCosto[0].costo).toBe('CC-21 Logistica');
    expect(component.centrosCosto[0].cantidad).toBe(0);
    expect(component.centrosCosto[0].persistedId).toBeNull();
    expect(component.centroCostoForm.value.centroCosto).toBe('');
  });

  it('should add a new cost center row', () => {
    component.iniciarNuevoPedido();
    component.centrosCosto = [];

    component.agregarCentroCosto({ id: 55, descripcion: 'Proyectos' });

    expect(component.centrosCosto[0].codigo).toBe(55);
    expect(component.centrosCosto[0].costo).toBe('Proyectos');
    expect(component.centrosCosto[0].cantidad).toBe(0);
    expect(component.centrosCosto[0].persistedId).toBeNull();
  });

  it('should update quantity only after edit mode is activated', () => {
    component.centrosCosto = [
      { id: 1, codigo: 14, costo: 'Sistemas', cantidad: 0, persistedId: null }
    ];

    component.editarCentroCosto(component.centrosCosto[0]);
    component.editandoCentroCostoCantidad = 12.345;
    component.guardarCantidadCentroCosto(1);

    expect(component.centrosCosto[0].cantidad).toBe(12.345);
    expect(component.editandoCentroCostoId).toBeNull();
  });

  it('should remove a cost center row', () => {
    component.iniciarNuevoPedido();
    component.centrosCosto = [
      { id: 1, codigo: 80, costo: 'Mantenimiento planta', cantidad: 0, persistedId: null },
      { id: 2, codigo: 21, costo: 'Despacho y almacen', cantidad: 0, persistedId: null }
    ];
    component.eliminarCentroCosto(2);

    expect(component.centrosCosto.some((item) => item.id === 2)).toBeFalse();
  });

  it('should save pedido first and then save each center cost row with requisition id', () => {
    component.iniciarNuevoPedido();
    fixture.detectChanges();

    component.cabeceraForm.patchValue({
      requisicionCompra: 1043,
      usuarioAprobacion: 'mramirez'
    });
    component.detalleForm.patchValue({
      lugarEntrega: 'Santa Anita',
      referencia: 'Compra de prueba',
      oc: 'CO',
      moneda: 1,
      fechaEntrega: '04-30-2026',
      sustento: 'Sustento de prueba'
    });
    component.centrosCosto = [
      { id: 1, codigo: 80, costo: 'Obras', cantidad: 10.125, persistedId: null },
      { id: 2, codigo: 21, costo: 'Logistica', cantidad: 3, persistedId: null }
    ];

    component.guardarPedido();

    expect(apiServiceMock.postRegistrarPedido).toHaveBeenCalledWith(jasmine.objectContaining({
      Ped_Id: 1043,
      Ped_Usr_Apr: 'mramirez',
      Ped_Lug_Ent: 'Santa Anita',
      Ped_Ref: 'Compra de prueba',
      Ped_Tip_Com: 'CO',
      Ped_Tip_Mon: 1,
      Ped_Fec_Ent: '2026-04-30T00:00:00',
      Ped_Prv_Cod: 0,
      Ped_For_Pag_Cod: 0,
      Ped_Can_Tot: 13.125,
      Usr_Reg: 'admin@demo.com'
    }));
    expect(apiServiceMock.patchActualizarPedidoEstado).toHaveBeenCalledWith({
      Ped_Id: 1043,
      Flg_Est: 'P'
    });
    expect(apiServiceMock.postRegistrarCentroCostoPedidoRegistrado).toHaveBeenCalledTimes(2);
    expect(apiServiceMock.postRegistrarCentroCostoPedidoRegistrado.calls.argsFor(0)[0]).toEqual({
      Ped_Id: 1043,
      Ped_Cen_Cos: '80',
      Ped_Can: 10.125
    });
    expect(apiServiceMock.postRegistrarCentroCostoPedidoRegistrado.calls.argsFor(1)[0]).toEqual({
      Ped_Id: 1043,
      Ped_Cen_Cos: '21',
      Ped_Can: 3
    });
  });

  it('should save pedido with provider code 0 when no provider is selected', () => {
    component.iniciarNuevoPedido();
    fixture.detectChanges();

    component.cabeceraForm.patchValue({
      requisicionCompra: 1044,
      usuarioAprobacion: 'mramirez'
    });
    component.detalleForm.patchValue({
      lugarEntrega: 'Santa Anita',
      referencia: 'Pedido sin proveedor',
      oc: 'CO',
      moneda: 1,
      fechaEntrega: '04-30-2026',
      sustento: 'Sustento de prueba'
    });
    component.centrosCosto = [
      { id: 1, codigo: 80, costo: 'Obras', cantidad: 10, persistedId: null }
    ];

    component.guardarPedido();

    expect(apiServiceMock.postRegistrarPedido).toHaveBeenCalledWith(jasmine.objectContaining({
      Ped_Id: 1044,
      Ped_Prv_Cod: 0,
      Ped_For_Pag_Cod: 0
    }));
    expect(apiServiceMock.patchActualizarPedidoEstado).toHaveBeenCalledWith({
      Ped_Id: 1044,
      Flg_Est: 'P'
    });
  });

  it('should update pedido with patchActualizarPedido in edit mode', () => {
    component.seleccionarPedido(component.requisiciones[0]);
    component.ejecutarAccion('Modificar');
    fixture.detectChanges();

    component.cabeceraForm.patchValue({
      usuarioAprobacion: 'mramirez'
    });
    component.detalleForm.patchValue({
      lugarEntrega: 'Lurin',
      referencia: 'Pedido actualizado',
      oc: 'SO',
      moneda: 2,
      fechaEntrega: '05-01-2026',
      sustento: 'Actualizacion'
    });
    component.centrosCosto = [
      { id: 1, codigo: 1, costo: 'CC-80 Obras', cantidad: 5, persistedId: 2 },
      { id: 2, codigo: 2, costo: 'CC-21 Logistica', cantidad: 7, persistedId: null }
    ];

    component.guardarPedido();

    expect(apiServiceMock.patchActualizarPedido).toHaveBeenCalledWith(jasmine.objectContaining({
      Ped_Id: 1042,
      Ped_Usr_Apr: 'mramirez',
      Ped_Lug_Ent: 'Lurin',
      Ped_Ref: 'Pedido actualizado',
      Ped_Tip_Com: 'SO',
      Ped_Tip_Mon: 2,
      Ped_Fec_Ent: '2026-05-01T00:00:00',
      Ped_Prv_Cod: 0,
      Ped_For_Pag_Cod: 0,
      Ped_Can_Tot: 12,
      Usr_Mod: 'admin@demo.com'
    }));
    expect(apiServiceMock.deleteEliminarCentroCostoPedidoRegistrado).toHaveBeenCalledWith({ Ped_Cen_Cos_Id: 2 });
    expect(apiServiceMock.postRegistrarCentroCostoPedidoRegistrado).toHaveBeenCalledTimes(2);
    expect(apiServiceMock.postRegistrarCentroCostoPedidoRegistrado.calls.argsFor(0)[0]).toEqual({
      Ped_Id: 1042,
      Ped_Cen_Cos: '1',
      Ped_Can: 5
    });
    expect(apiServiceMock.postRegistrarCentroCostoPedidoRegistrado.calls.argsFor(1)[0]).toEqual({
      Ped_Id: 1042,
      Ped_Cen_Cos: '2',
      Ped_Can: 7
    });
  });


  it('should delete removed persisted center costs before re-registering current rows in edit mode', () => {
    component.seleccionarPedido(component.requisiciones[0]);
    component.ejecutarAccion('Modificar');
    fixture.detectChanges();

    component.eliminarCentroCosto(1);
    component.guardarPedido();

    expect(apiServiceMock.deleteEliminarCentroCostoPedidoRegistrado).toHaveBeenCalledWith({ Ped_Cen_Cos_Id: 2 });
    expect(apiServiceMock.postRegistrarCentroCostoPedidoRegistrado).not.toHaveBeenCalled();
  });
});
