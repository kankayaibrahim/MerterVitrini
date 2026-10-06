export interface DashboardFinancials {
  total_revenue: number;
  total_orders: number;
  pending_orders: number;
  approved_orders: number;
  shipped_orders: number;
  avg_order_value: number;
}

export interface DashboardCatalog {
  active_products: number;
  total_stock_units: number;
  active_brands: number;
  pending_apps: number;
}

export interface DashboardTraffic {
  live_visitors_15m: number;
  today_visitors: number;
  today_pageviews: number;
}

export interface DashboardExchangeRate {
  currency_code: string;
  buying_rate: number;
  selling_rate: number;
  publication_date: string;
}

export interface DashboardOrderSummary {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  currency: string;
  payment_method: string;
  order_status: string;
  created_at: string;
}

export interface DashboardApplicationSummary {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  category: string;
  status: string;
  created_at: string;
}

export interface ExecutiveDashboardStats {
  financials: DashboardFinancials;
  catalog: DashboardCatalog;
  traffic: DashboardTraffic;
  exchange_rates: DashboardExchangeRate[];
  recent_orders: DashboardOrderSummary[];
  pending_applications: DashboardApplicationSummary[];
}
