export interface PublicWorkshop {
  trade_name: string;
  legal_name: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  business_hours: string;
  logo: string;
  address_line: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface PublicService {
  name: string;
  description: string;
}

export interface LandingData {
  workshop: PublicWorkshop;
  services: PublicService[];
}
