import {
  applianceTemplate,
  phoneResaleTemplate,
  type CategoryTemplate
} from "../../domain/catalog/category-template.js";

const defaultTemplates = [phoneResaleTemplate, applianceTemplate];

export class CategoryTemplateRegistry {
  private readonly templates = new Map<string, CategoryTemplate>();

  constructor(seedTemplates: CategoryTemplate[] = defaultTemplates) {
    for (const template of seedTemplates) {
      this.templates.set(template.key, template);
    }
  }

  list(): CategoryTemplate[] {
    return [...this.templates.values()];
  }

  get(templateKey: string): CategoryTemplate {
    const template = this.templates.get(templateKey);

    if (!template) {
      throw new Error(`Unknown category template: ${templateKey}`);
    }

    return template;
  }

  register(template: CategoryTemplate): void {
    this.templates.set(template.key, template);
  }
}
