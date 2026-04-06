import type { AutonomyPolicyRepository } from "../../ports/autonomy-policy-repository.js";
import type { BrowserAutomationPort } from "../../ports/browser-automation.js";
import type { CatalogPublicationRepository } from "../../ports/catalog-publication-repository.js";
import type { EventBus } from "../../ports/event-bus.js";
import type { OpportunityRepository } from "../../ports/opportunity-repository.js";
import type { SourceListingRepository } from "../../ports/source-listing-repository.js";
import type { WorkflowRunRepository } from "../../ports/workflow-run-repository.js";
import type { AutonomousActionLogRepository } from "../../ports/autonomous-action-log-repository.js";
import { DiscoveryOrchestrator, type DiscoveryOrchestratorInput } from "../discovery/discovery-orchestrator.js";
import { AutonomousPublishService } from "../autonomy/autonomous-publish.service.js";
import { CatalogPublicationService } from "../catalog/catalog-publication.service.js";

export class AutonomousListingPipelineService {
  private readonly discoveryOrchestrator: DiscoveryOrchestrator;
  private readonly autonomousPublishService: AutonomousPublishService;
  private readonly catalogPublicationService: CatalogPublicationService;

  constructor(
    browserAutomation: BrowserAutomationPort,
    sourceListingRepository: SourceListingRepository,
    opportunityRepository: OpportunityRepository,
    workflowRunRepository: WorkflowRunRepository,
    autonomyPolicyRepository: AutonomyPolicyRepository,
    autonomousActionLogRepository: AutonomousActionLogRepository,
    catalogPublicationRepository: CatalogPublicationRepository,
    eventBus: EventBus
  ) {
    this.discoveryOrchestrator = new DiscoveryOrchestrator(
      browserAutomation,
      sourceListingRepository,
      opportunityRepository,
      workflowRunRepository,
      eventBus
    );

    this.autonomousPublishService = new AutonomousPublishService(
      opportunityRepository,
      autonomousActionLogRepository,
      eventBus
    );

    this.catalogPublicationService = new CatalogPublicationService(
      catalogPublicationRepository,
      opportunityRepository,
      eventBus
    );

    this.autonomyPolicyRepository = autonomyPolicyRepository;
  }

  private readonly autonomyPolicyRepository: AutonomyPolicyRepository;

  async run(input: DiscoveryOrchestratorInput) {
    const discovery = await this.discoveryOrchestrator.discover(input);

    const policy = await this.autonomyPolicyRepository.findEnabledPolicyForSeller(
      input.sellerId
    );

    if (!policy) {
      return {
        discovery,
        publishDecision: null,
        publication: null
      };
    }

    const publishDecision = await this.autonomousPublishService.decideAndEmit(
      input.sellerId,
      discovery.sourceListing.sourceType,
      discovery.opportunity,
      policy
    );

    if (!publishDecision.allowed) {
      return {
        discovery,
        publishDecision,
        publication: null
      };
    }

    const publication = await this.catalogPublicationService.publish({
      sellerId: input.sellerId,
      sourceListing: discovery.sourceListing,
      opportunity: {
        ...discovery.opportunity,
        status: publishDecision.status
      }
    });

    return {
      discovery,
      publishDecision,
      publication
    };
  }
}
