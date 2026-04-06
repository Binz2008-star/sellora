import type {
  CreateTenantInput,
  CreateTenantResult,
  TenantRepository
} from "../../ports/tenant-repository.js";

const DEFAULT_CURRENCY = "AED";

export class CreateTenantService {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(input: CreateTenantInput): Promise<CreateTenantResult> {
    return this.tenantRepository.createTenant({
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
      brandName: input.brandName.trim(),
      slug: input.slug.trim().toLowerCase(),
      whatsappNumber: input.whatsappNumber?.trim(),
      currency: input.currency?.trim().toUpperCase() ?? DEFAULT_CURRENCY
    });
  }
}
