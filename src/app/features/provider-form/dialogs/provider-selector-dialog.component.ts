import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ProviderRecord } from '../provider-form.models';

interface ProviderDialogData {
  providers: ProviderRecord[];
}

@Component({
  selector: 'app-provider-selector-dialog',
  templateUrl: './provider-selector-dialog.component.html',
  styleUrls: ['./provider-selector-dialog.component.scss']
})
export class ProviderSelectorDialogComponent {
  searchTerm = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ProviderDialogData,
    private readonly dialogRef: MatDialogRef<ProviderSelectorDialogComponent>
  ) {}

  get filteredProviders(): ProviderRecord[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.data.providers;
    }

    return this.data.providers.filter((provider) =>
      String(provider.code).includes(term)
      || provider.name.toLowerCase().includes(term)
      || provider.ruc.toLowerCase().includes(term)
      || provider.contact.toLowerCase().includes(term)
      || provider.phone.toLowerCase().includes(term)
    );
  }

  trackByCode(_: number, provider: ProviderRecord): number {
    return provider.code;
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  selectProvider(provider: ProviderRecord): void {
    this.dialogRef.close(provider);
  }

  close(): void {
    this.dialogRef.close();
  }
}
