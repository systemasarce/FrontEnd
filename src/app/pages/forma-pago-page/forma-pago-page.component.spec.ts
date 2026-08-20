import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { FormaPagoEditDialogComponent } from './forma-pago-edit-dialog.component';
import { FormaPagoPageComponent } from './forma-pago-page.component';
import { FormaPagoRegisterDialogComponent } from './forma-pago-register-dialog.component';

describe('FormaPagoPageComponent', () => {
  let component: FormaPagoPageComponent;
  let fixture: ComponentFixture<FormaPagoPageComponent>;
  let apiServiceMock: {
    getListarFormaPagoActivo: jasmine.Spy;
  };
  let matDialogMock: {
    open: jasmine.Spy;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getListarFormaPagoActivo: jasmine.createSpy('getListarFormaPagoActivo').and.returnValue(
        of({
          elements: [
            { For_Pag_Id: 1, For_Pag_Des: 'Contado', Flg_Est: 'A' },
            { For_Pag_Id: 2, For_Pag_Des: 'Credito 30 dias', Flg_Est: 'A' }
          ]
        })
      )
    };

    matDialogMock = {
      open: jasmine.createSpy('open').and.returnValue({
        afterClosed: () => of(false)
      })
    };

    await TestBed.configureTestingModule({
      declarations: [FormaPagoPageComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: MatDialog, useValue: matDialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FormaPagoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load formas de pago on init', () => {
    expect(apiServiceMock.getListarFormaPagoActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.formasPago.length).toBe(2);
  });

  it('should search formas de pago using ID, descripcion and estado filters', () => {
    apiServiceMock.getListarFormaPagoActivo.calls.reset();
    component.filtersForm.setValue({
      codigo: '2',
      descripcion: 'Credito',
      estado: 'I'
    });

    component.cargarFormasPago();

    expect(apiServiceMock.getListarFormaPagoActivo).toHaveBeenCalledWith({
      For_Pag_Id: 2,
      For_Pag_Des: 'Credito',
      Flg_Est: 'I'
    });
  });

  it('should reset filters and reload active formas de pago', () => {
    apiServiceMock.getListarFormaPagoActivo.calls.reset();
    component.filtersForm.setValue({
      codigo: '5',
      descripcion: 'Adelanto',
      estado: 'I'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      codigo: '',
      descripcion: '',
      estado: 'A'
    });
    expect(apiServiceMock.getListarFormaPagoActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
  });

  it('should open register dialog', () => {
    component.registrarFormaPago();

    expect(matDialogMock.open).toHaveBeenCalledWith(FormaPagoRegisterDialogComponent, jasmine.objectContaining({
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop'
    }));
  });

  it('should open edit dialog for the provided row', () => {
    component.editarFormaPago(component.formasPago[1]);

    expect(matDialogMock.open).toHaveBeenCalledWith(FormaPagoEditDialogComponent, jasmine.objectContaining({
      data: {
        formaPago: jasmine.objectContaining({
          forPagId: 2,
          forPagDes: 'Credito 30 dias'
        })
      }
    }));
  });
});
