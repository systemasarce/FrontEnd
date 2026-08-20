import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ApprovalUserOption {
  id: number;
  code: string;
  name: string;
  email: string;
}

interface ApprovalUserDialogData {
  users: ApprovalUserOption[];
}

@Component({
  selector: 'app-approval-user-selector-dialog',
  templateUrl: './approval-user-selector-dialog.component.html',
  styleUrls: ['./approval-user-selector-dialog.component.scss']
})
export class ApprovalUserSelectorDialogComponent {
  searchTerm = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ApprovalUserDialogData,
    private readonly dialogRef: MatDialogRef<ApprovalUserSelectorDialogComponent>
  ) {}

  get filteredUsers(): ApprovalUserOption[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.data.users;
    }

    return this.data.users.filter((user) =>
      String(user.id).includes(term)
      || user.code.toLowerCase().includes(term)
      || user.name.toLowerCase().includes(term)
    );
  }

  trackByUser(_: number, user: ApprovalUserOption): number {
    return user.id;
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
  }

  selectUser(user: ApprovalUserOption): void {
    this.dialogRef.close(user);
  }

  close(): void {
    this.dialogRef.close();
  }
}
