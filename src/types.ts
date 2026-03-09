export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  category: string;
}

export interface BillItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
}

export interface Bill {
  billId: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  timestamp: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentMethod: 'Cash' | 'UPI';
  customerName?: string;
  customerPhone?: string;
}
