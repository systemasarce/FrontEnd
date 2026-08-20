import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { ItemEditDialogComponent } from './item-edit-dialog.component';
import { ItemPageComponent } from './item-page.component';
import { ItemRegisterDialogComponent } from './item-register-dialog.component';

describe('ItemPageComponent', () => {
  let component: ItemPageComponent;
  let fixture: ComponentFixture<ItemPageComponent>;
  let apiServiceMock: {
    getListarItem: jasmine.Spy;
    getListarGrupoItem: jasmine.Spy;
  };
  let matDialogMock: {
    open: jasmine.Spy;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getListarItem: jasmine.createSpy('getListarItem').and.returnValue(
        of({
          elements: [
            { Itm_Id: 1, Itm_Des: 'Laptop', Itm_Grp: 3, Grp_Des: 'Tecnologia', Flg_Est: 'A' },
            { Itm_Id: 2, Itm_Des: 'Mouse', Itm_Grp: 3, Grp_Des: 'Tecnologia', Flg_Est: 'A' }
          ]
        })
      ),
      getListarGrupoItem: jasmine.createSpy('getListarGrupoItem').and.returnValue(
        of({
          elements: [
            { Grp_Id: 3, Grp_Des: 'Tecnologia', Flg_Est: 'A' },
            { Grp_Id: 4, Grp_Des: 'Oficina', Flg_Est: 'A' }
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
      declarations: [ItemPageComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: MatDialog, useValue: matDialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ItemPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load items and grupos on init', () => {
    expect(apiServiceMock.getListarGrupoItem).toHaveBeenCalledWith({});
    expect(apiServiceMock.getListarItem).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.items.length).toBe(2);
    expect(component.gruposItem.length).toBe(2);
  });

  it('should search items using ID, descripcion, grupo and estado filters', () => {
    apiServiceMock.getListarItem.calls.reset();
    component.filtersForm.setValue({
      codigo: '2',
      descripcion: 'Mouse',
      grupo: 'Oficina',
      estado: 'I'
    });

    component.cargarItems();

    expect(apiServiceMock.getListarItem).toHaveBeenCalledWith({
      Itm_Id: 2,
      Itm_Des: 'Mouse',
      Itm_Grp: 4,
      Flg_Est: 'I'
    });
  });

  it('should reset filters and reload active items', () => {
    apiServiceMock.getListarItem.calls.reset();
    component.filtersForm.setValue({
      codigo: '8',
      descripcion: 'Teclado',
      grupo: 'Tecnologia',
      estado: 'I'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      codigo: '',
      descripcion: '',
      grupo: 'Todos',
      estado: 'A'
    });
    expect(apiServiceMock.getListarItem).toHaveBeenCalledWith({ Flg_Est: 'A' });
  });

  it('should open register dialog', () => {
    component.registrarItem();

    expect(matDialogMock.open).toHaveBeenCalledWith(ItemRegisterDialogComponent, jasmine.objectContaining({
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop'
    }));
  });

  it('should open edit dialog for the provided row', () => {
    component.editarItem(component.items[1]);

    expect(matDialogMock.open).toHaveBeenCalledWith(ItemEditDialogComponent, jasmine.objectContaining({
      data: {
        item: jasmine.objectContaining({
          itmId: 2,
          itmDes: 'Mouse',
          itmGrp: 3
        })
      }
    }));
  });
});
