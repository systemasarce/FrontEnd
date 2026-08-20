import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { GrupoItemEditDialogComponent } from './grupo-item-edit-dialog.component';
import { GrupoItemPageComponent } from './grupo-item-page.component';
import { GrupoItemRegisterDialogComponent } from './grupo-item-register-dialog.component';

describe('GrupoItemPageComponent', () => {
  let component: GrupoItemPageComponent;
  let fixture: ComponentFixture<GrupoItemPageComponent>;
  let apiServiceMock: {
    getListarGrupoItem: jasmine.Spy;
  };
  let matDialogMock: {
    open: jasmine.Spy;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getListarGrupoItem: jasmine.createSpy('getListarGrupoItem').and.returnValue(
        of({
          elements: [
            { Grp_Id: 1, Grp_Des: 'Tecnologia', Flg_Est: 'A' },
            { Grp_Id: 2, Grp_Des: 'Oficina', Flg_Est: 'A' }
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
      declarations: [GrupoItemPageComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: MatDialog, useValue: matDialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GrupoItemPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load grupos de item on init', () => {
    expect(apiServiceMock.getListarGrupoItem).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.gruposItem.length).toBe(2);
  });

  it('should search grupos de item using ID, descripcion and estado filters', () => {
    apiServiceMock.getListarGrupoItem.calls.reset();
    component.filtersForm.setValue({
      codigo: '2',
      descripcion: 'Oficina',
      estado: 'I'
    });

    component.cargarGrupoItem();

    expect(apiServiceMock.getListarGrupoItem).toHaveBeenCalledWith({
      Grp_Id: 2,
      Grp_Des: 'Oficina',
      Flg_Est: 'I'
    });
  });

  it('should reset filters and reload active grupos de item', () => {
    apiServiceMock.getListarGrupoItem.calls.reset();
    component.filtersForm.setValue({
      codigo: '5',
      descripcion: 'Logistica',
      estado: 'I'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      codigo: '',
      descripcion: '',
      estado: 'A'
    });
    expect(apiServiceMock.getListarGrupoItem).toHaveBeenCalledWith({ Flg_Est: 'A' });
  });

  it('should open register dialog', () => {
    component.registrarGrupoItem();

    expect(matDialogMock.open).toHaveBeenCalledWith(GrupoItemRegisterDialogComponent, jasmine.objectContaining({
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop'
    }));
  });

  it('should open edit dialog for the provided row', () => {
    component.editarGrupoItem(component.gruposItem[1]);

    expect(matDialogMock.open).toHaveBeenCalledWith(GrupoItemEditDialogComponent, jasmine.objectContaining({
      data: {
        grupoItem: jasmine.objectContaining({
          grpId: 2,
          grpDes: 'Oficina'
        })
      }
    }));
  });
});
