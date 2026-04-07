export interface CreateTenantInput {
  email: string;
  fullName: string;
  brandName: string;
  slug: string;
  whatsappNumber?: string;
  currency?: string;
}

export interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSeller {
  id: string;
  ownerUserId: string;
  slug: string;
  displayName: string;
  status: "active" | "paused" | "archived";
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantResult {
  user: TenantUser;
  seller: TenantSeller;
}

export interface TenantRepository {
  createTenant(input: CreateTenantInput): Promise<CreateTenantResult>;
}
