import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PaymentOption } from '../provider-form.models';

interface PaymentDialogData {
  paymentOptions: PaymentOption[];
}

@Component({
  selector: 'app-payment-selector-dialog',
  templateUrl: './payment-selector-dialog.component.html',
  styleUrls: ['./payment-selector-dialog.component.scss']
})
export class PaymentSelectorDialogComponent {
  searchTerm = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PaymentDialogData,
    private readonly dialogRef: MatDialogRef<PaymentSelectorDialogComponent>
  ) {}

  get filteredPaymentOptions(): PaymentOption[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.data.paymentOptions;
    }

    return this.data.paymentOptions.filter((paymentOption) =>
      String(paymentOption.code).includes(term)
      || paymentOption.description.toLowerCase().includes(term)
    );
  }

  trackByCode(_: number, paymentOption: PaymentOption): number {
    return paymentOption.code;
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  selectPayment(paymentOption: PaymentOption): void {
    this.dialogRef.close(paymentOption);
  }

  close(): void {
    this.dialogRef.close();
  }
}
