import { AuthManager } from './auth.js';
import { ArtifactsClient } from './resources/artifacts.js';
import { BuildsClient } from './resources/builds.js';
import { ProductsClient } from './resources/products.js';
import { WorkflowsClient } from './resources/workflows.js';

/**
 * High-level App Store Connect client.
 */
export class AppStoreConnectClient {
  readonly products: ProductsClient;
  readonly workflows: WorkflowsClient;
  readonly builds: BuildsClient;
  readonly artifacts: ArtifactsClient;

  constructor(auth: AuthManager) {
    this.products = new ProductsClient(auth);
    this.workflows = new WorkflowsClient(auth);
    this.builds = new BuildsClient(auth);
    this.artifacts = new ArtifactsClient(auth);
  }
}
