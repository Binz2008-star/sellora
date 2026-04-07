import type {
  CreateTenantInput,
  CreateTenantResult,
  TenantRepository
} from "../../ports/tenant-repository.js";

const DEFAULT_CURRENCY = "AED";

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class CreateTenantService {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(input: CreateTenantInput): Promise<CreateTenantResult> {
    const currency = normalizeOptionalString(input.currency)?.toUpperCase() ?? DEFAULT_CURRENCY;

    return this.tenantRepository.createTenant({
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
      brandName: input.brandName.trim(),
      slug: input.slug.trim().toLowerCase(),
      whatsappNumber: normalizeOptionalString(input.whatsappNumber),
      currency
    });
  }
}
