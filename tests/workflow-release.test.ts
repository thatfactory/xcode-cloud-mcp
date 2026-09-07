import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppStoreConnectClient } from '../src/api/client.js';
import type { CiWorkflow } from '../src/api/types.js';
import { registerWorkflowUpdateTools } from '../src/tools/workflow-updates.js';
import { formatWorkflowDetailsResponse } from '../src/utils/workflow-details.js';

function fixture() {
  const workflow: CiWorkflow = {
    id: 'workflow-1', type: 'ciWorkflows',
    attributes: { name: 'Existing', isEnabled: false, clean: false,
      containerFilePath: 'App.xcodeproj', lastModifiedDate: null,
      branchStartCondition: { source: { isAllMatch: true } },
      pullRequestStartCondition: {}, scheduledStartCondition: {}, tagStartCondition: {},
      manualPullRequestStartCondition: {}, manualTagStartCondition: {},
      actions: [{ name: 'Tests', actionType: 'TEST' }],
    },
  };
  const writes: any[] = [];
  const registry = new Map<string, { schema: z.ZodObject; handler: (args: any) => Promise<any> }>();
  const server = { registerTool(name: string, config: any, handler: any) {
    registry.set(name, { schema: z.object(config.inputSchema), handler });
  }};
  const client = { workflows: {
    async updateById(id: string, attributes: any) {
      writes.push({ id, attributes }); Object.assign(workflow.attributes, attributes); return workflow;
    },
    async updateActions(id: string, actions: any) { writes.push({ id, actions }); },
    async getById() { return { workflow, included: [] }; },
  }};
  registerWorkflowUpdateTools(server as unknown as McpServer, client as unknown as AppStoreConnectClient);
  return { workflow, writes, registry };
}

for (const audience of ['APP_STORE_ELIGIBLE', 'INTERNAL_ONLY']) {
  test(`manual archive preset uses ${audience} and clears every other trigger in one update`, async () => {
    const { registry, workflow, writes } = fixture();
    const tool = registry.get('configure_manual_release_candidate')!;
    const result = await tool.handler(tool.schema.parse({ workflowId: workflow.id,
      scheme: 'Headroom', branch: 'main', buildDistributionAudience: audience }));
    assert.notEqual(result.isError, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].id, workflow.id);
    const a = writes[0].attributes;
    for (const key of ['branchStartCondition', 'pullRequestStartCondition', 'scheduledStartCondition',
      'tagStartCondition', 'manualPullRequestStartCondition', 'manualTagStartCondition']) assert.equal(a[key], null);
    assert.deepEqual(a.manualBranchStartCondition, { source: { isAllMatch: false,
      patterns: [{ pattern: 'main', isPrefix: false }] } });
    assert.deepEqual(a.actions, [{ name: 'Release Candidate', actionType: 'ARCHIVE',
      platform: 'MACOS', destination: 'ANY_MAC', scheme: 'Headroom',
      buildDistributionAudience: audience, isRequiredToPass: true }]);
    assert.equal(workflow.attributes.isEnabled, false);
    assert.equal(workflow.attributes.name, 'Existing');
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.workflow.actions[0].deploymentPreparation, audience === 'INTERNAL_ONLY'
      ? 'TestFlight internal testing only' : 'TestFlight and App Store');
    assert.equal(payload.workflow.testFlightDistribution.status, 'UNSUPPORTED_BY_APPLE_API');
    assert.equal(payload.workflow.testFlightDistribution.automaticTesterGroupAssignment, 'UNKNOWN');
  });
}

test('release candidate rejects missing, null, invalid audience and blank scheme/branch before writes', async () => {
  const { registry, writes } = fixture();
  const tool = registry.get('configure_manual_release_candidate')!;
  const valid = { workflowId: 'workflow-1', scheme: 'App', branch: 'main', buildDistributionAudience: 'INTERNAL_ONLY' };
  for (const change of [{ buildDistributionAudience: null }, { buildDistributionAudience: undefined },
    { buildDistributionAudience: 'TESTFLIGHT' }, { scheme: ' ' }, { branch: '' }]) {
    const args = { ...valid, ...change };
    assert.equal(tool.schema.safeParse(args).success, false);
    assert.equal((await tool.handler(args)).isError, true);
  }
  assert.equal(writes.length, 0);
});

test('general action edits accept nullable enum but reject arbitrary audiences', async () => {
  const { registry, writes } = fixture();
  const tool = registry.get('update_workflow_actions')!;
  for (const audience of [null, undefined, 'INTERNAL_ONLY', 'APP_STORE_ELIGIBLE']) {
    const args = { workflowId: 'workflow-1', actions: [{ name: 'Archive', actionType: 'ARCHIVE', buildDistributionAudience: audience }] };
    assert.equal(tool.schema.safeParse(args).success, true);
    assert.notEqual((await tool.handler(args)).isError, true);
  }
  const invalid = { workflowId: 'workflow-1', actions: [{ name: 'Archive', actionType: 'ARCHIVE', buildDistributionAudience: 'TYPO' }] };
  assert.equal(tool.schema.safeParse(invalid).success, false);
  assert.equal((await tool.handler(invalid)).isError, true);
  assert.equal(writes.length, 4);
});

test('read-back reports None for omitted/null preparation and Unknown for future values', () => {
  const { workflow } = fixture();
  for (const audience of [null, undefined, 'FUTURE']) {
    workflow.attributes.actions = [{ name: 'Archive', actionType: 'ARCHIVE', buildDistributionAudience: audience as any }];
    const result = formatWorkflowDetailsResponse(workflow, []);
    assert.equal(result.workflow.actions[0].deploymentPreparation, audience === 'FUTURE' ? 'Unknown' : 'None');
  }
});
