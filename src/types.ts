export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
}

export interface TransactionItem {
  id?: number;
  transaction_id?: number;
  item_type: 'shoe' | 'bag';
  service_type: string;
  quantity: number;
  unit: string;
  amount: number;
}

export interface Transaction {
  id: number;
  ticket_number: string;
  customer_id: number;
  customer_name?: string;
  total_amount: number;
  status: 'pending' | 'lunas' | 'cicilan';
  pickup_date: string;
  created_at: string;
  items: TransactionItem[];
}

export interface Settings {
  logo?: string;
  favicon?: string;
  business_name?: string;
  address?: string;
  phone?: string;
}
