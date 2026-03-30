import React from 'react';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { Transaction } from '@/types/transaction';

interface EditTransactionModalProps {
  visible: boolean;
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}

export function EditTransactionModal({ visible, transaction, onClose, onSave }: EditTransactionModalProps) {
  return (
    <AddTransactionModal
      visible={visible}
      transaction={transaction}
      initialType={transaction.type}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
