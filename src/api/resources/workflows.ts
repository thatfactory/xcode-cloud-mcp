import { BaseAPIClient } from '../base-client.js';
import type {
  CiWorkflow,
  CiWorkflowAction,
  WorkflowIncludedResource,
} from '../types.js';

type WorkflowAttributeUpdate = Partial<CiWorkflow['attributes']>;

/**
 * Workflow endpoints.
 */
export class WorkflowsClient extends BaseAPIClient {
  /**
   * List all workflows belonging to a product, paginating through all results.
   */
  async listForProduct(productId: string): Promise<CiWorkflow[]> {
    return this.listAll<CiWorkflow>(
      `/v1/ciProducts/${productId}/workflows`,
      { limit: '200' },
    );
  }

  /**
   * Fetch one workflow with repository and environment details.
   */
  async getById(
    workflowId: string,
  ): Promise<{
    included: WorkflowIncludedResource[];
    workflow: CiWorkflow;
  }> {
    const response = await this.get<CiWorkflow, WorkflowIncludedResource>(
      `/v1/ciWorkflows/${workflowId}`,
      {
        include: 'repository,xcodeVersion,macOsVersion',
      },
    );

    return {
      workflow: response.data,
      included: response.included ?? [],
    };
  }

  /**
   * Update one workflow.
   */
  async updateById(
    workflowId: string,
    attributes: WorkflowAttributeUpdate,
  ): Promise<CiWorkflow> {
    const response = await this.patch<
      CiWorkflow,
      {
        data: {
          type: 'ciWorkflows';
          id: string;
          attributes: WorkflowAttributeUpdate;
        };
      }
    >(`/v1/ciWorkflows/${workflowId}`, {
      data: {
        type: 'ciWorkflows',
        id: workflowId,
        attributes,
      },
    });

    return response.data;
  }

  /**
   * Enable or disable one workflow.
   */
  async setEnabled(workflowId: string, isEnabled: boolean): Promise<CiWorkflow> {
    return this.updateById(workflowId, { isEnabled });
  }

  /**
   * Update general workflow fields.
   */
  async updateGeneral(
    workflowId: string,
    attributes: Pick<
      WorkflowAttributeUpdate,
      'clean' | 'description' | 'name'
    >,
  ): Promise<CiWorkflow> {
    return this.updateById(workflowId, attributes);
  }

  /**
   * Update workflow start conditions.
   */
  async updateStartConditions(
    workflowId: string,
    attributes: Pick<
      WorkflowAttributeUpdate,
      | 'branchStartCondition'
      | 'manualBranchStartCondition'
      | 'manualPullRequestStartCondition'
      | 'manualTagStartCondition'
      | 'pullRequestStartCondition'
      | 'scheduledStartCondition'
      | 'tagStartCondition'
    >,
  ): Promise<CiWorkflow> {
    return this.updateById(workflowId, attributes);
  }

  /**
   * Replace workflow actions explicitly.
   */
  async updateActions(
    workflowId: string,
    actions: CiWorkflowAction[],
  ): Promise<CiWorkflow> {
    return this.updateById(workflowId, { actions });
  }
}