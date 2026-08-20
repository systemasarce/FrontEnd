import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { TipoServicioEditDialogComponent } from './tipo-servicio-edit-dialog.component';
import { TipoServicioPageComponent } from './tipo-servicio-page.component';
import { TipoServicioRegisterDialogComponent } from './tipo-servicio-register-dialog.component';

describe('TipoServicioPageComponent', () => {
  let component: TipoServicioPageComponent;
  let fixture: ComponentFixture<TipoServicioPageComponent>;
  let apiServiceMock: {
    getListarTipoServicioActivo: jasmine.Spy;
  };
  let matDialogMock: {
    open: jasmine.Spy;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getListarTipoServicioActivo: jasmine.createSpy('getListarTipoServicioActivo').and.returnValue(
        of({
          elements: [
            { Tip_Ser_Id: 1, Tip_Ser_Des: 'Transporte', Flg_Est: 'A' },
            { Tip_Ser_Id: 2, Tip_Ser_Des: 'Mantenimiento', Flg_Est: 'A' }
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
      declarations: [TipoServicioPageComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: MatDialog, useValue: matDialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TipoServicioPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load tipos de servicio on init', () => {
    expect(apiServiceMock.getListarTipoServicioActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.tiposServicio.length).toBe(2);
  });

  it('should search tipos de servicio using ID, descripcion and estado filters', () => {
    apiServiceMock.getListarTipoServicioActivo.calls.reset();
    component.filtersForm.setValue({
      codigo: '2',
      descripcion: 'Mant',
      estado: 'I'
    });

    component.cargarTiposServicio();

    expect(apiServiceMock.getListarTipoServicioActivo).toHaveBeenCalledWith({
      Tip_Ser_Id: 2,
      Tip_Ser_Des: 'Mant',
      Flg_Est: 'I'
    });
  });

  it('should reset filters and reload active tipos de servicio', () => {
    apiServiceMock.getListarTipoServicioActivo.calls.reset();
    component.filtersForm.setValue({
      codigo: '5',
      descripcion: 'Soporte',
      estado: 'I'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      codigo: '',
      descripcion: '',
      estado: 'A'
    });
    expect(apiServiceMock.getListarTipoServicioActivo).toHaveBeenCalledWith({ Flg_Est: 'A' });
  });

  it('should open register dialog', () => {
    component.registrarTipoServicio();

    expect(matDialogMock.open).toHaveBeenCalledWith(TipoServicioRegisterDialogComponent, jasmine.objectContaining({
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop'
    }));
  });

  it('should open edit dialog for the provided row', () => {
    component.editarTipoServicio(component.tiposServicio[1]);

    expect(matDialogMock.open).toHaveBeenCalledWith(TipoServicioEditDialogComponent, jasmine.objectContaining({
      data: {
        tipoServicio: jasmine.objectContaining({
          tipSerId: 2,
          tipSerDes: 'Mantenimiento'
        })
      }
    }));
  });
});
