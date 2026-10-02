export interface UserAddress {
  id?: string;
  user_id?: string;
  title: string;
  address_type: "billing" | "shipping";
  first_name: string;
  last_name: string;
  company_name?: string;
  phone: string;
  country_id: string;
  state_id?: string;
  city_id?: string;
  address_line: string;
  tax_no_tckn?: string;
  tax_office?: string;
  is_default: boolean;
  country_name?: string;
  state_name?: string;
  city_name?: string;
  postal_code: string;
}

export interface CountryLookup {
  id: string;
  code: string;
  phone_code: number;
  name_tr: string;
  name_en: string;
}

export interface StateLookup {
  id: string;
  country_id: string;
  code: string;
  state_name: string;
}

export interface CityLookup {
  id: string;
  state_id: string;
  code: string;
  name: string;
}
