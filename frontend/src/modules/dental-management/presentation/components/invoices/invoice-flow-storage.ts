export const PENDING_INVOICE_VISIT_ID_KEY = 'sourire.pendingInvoiceVisitId';
export const PENDING_INVOICE_FLOW_KEY = 'sourire.pendingInvoiceFlow';

export const readPendingInvoiceVisitId = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(PENDING_INVOICE_VISIT_ID_KEY)?.trim() ?? '';
};

export const readPendingInvoiceFlow = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(PENDING_INVOICE_FLOW_KEY)?.trim() ?? '';
};

export const writePendingInvoiceFlow = (visitId: string, flow: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PENDING_INVOICE_VISIT_ID_KEY, visitId);
  window.sessionStorage.setItem(PENDING_INVOICE_FLOW_KEY, flow);
};

export const clearPendingInvoiceFlow = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PENDING_INVOICE_VISIT_ID_KEY);
  window.sessionStorage.removeItem(PENDING_INVOICE_FLOW_KEY);
};
