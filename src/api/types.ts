/**
 * App Store Connect API response envelope.
 */
export interface APIResponse<TData, TIncluded = never> {
  data: TData;
  included?: TIncluded[];
  links?: {
    self?: string;
    next?: string;
  };
  meta?: {
    paging?: {
      total?: number;
      limit?: number;
    };
  };
}

/**
 * App Store Connect API error response.
 */
export interface APIErrorResponse {
  errors: Array<{
    status: string;
    code: string;
    title: string;
    detail: string;
  }>;
}

/**
 * Xcode Cloud product.
 */
export interface CiProduct {
  type: 'ciProducts';
  id: string;
  attributes: {
    name: string;
    createdDate: string;
    productType: string;
  };
}

/**
 * Xcode Cloud workflow.
 */
export interface CiWorkflow {
  type: 'ciWorkflows';
  id: string;
  attributes: {
    name: string;
    description?: string;
    isEnabled: boolean;
    isLockedForEditing?: boolean;
    clean: boolean;
    containerFilePath: string;
    lastModifiedDate: string;
    branchStartCondition?: Record<string, unknown>;
    manualBranchStartCondition?: Record<string, unknown>;
    pullRequestStartCondition?: Record<string, unknown>;
    manualPullRequestStartCondition?: Record<string, unknown>;
    tagStartCondition?: Record<string, unknown>;
    manualTagStartCondition?: Record<string, unknown>;
    scheduledStartCondition?: Record<string, unknown>;
    actions?: CiWorkflowAction[];
  };
  relationships?: {
    repository?: {
      data?: {
        type: 'scmRepositories';
        id: string;
      } | null;
    };
    xcodeVersion?: {
      data?: {
        type: 'ciXcodeVersions';
        id: string;
      } | null;
    };
    macOsVersion?: {
      data?: {
        type: 'ciMacOsVersions';
        id: string;
      } | null;
    };
  };
}

/**
 * Xcode Cloud workflow action.
 */
export interface CiWorkflowAction {
  actionType: string;
  buildDistributionAudience?: string | null;
  destination?: string | null;
  isRequiredToPass?: boolean | null;
  name: string;
  platform?: string | null;
  scheme?: string | null;
  testConfiguration?: {
    kind?: string | null;
    testDestinations?: Array<Record<string, unknown>>;
    testPlanName?: string | null;
  } | null;
}

/**
 * Xcode Cloud source repository.
 */
export interface ScmRepository {
  type: 'scmRepositories';
  id: string;
  attributes: {
    defaultBranch?: string;
    httpCloneUrl?: string;
    ownerName?: string;
    repositoryName?: string;
    scmProvider?: string;
    sshCloneUrl?: string;
  };
}

/**
 * Xcode version used by a workflow.
 */
export interface CiXcodeVersion {
  type: 'ciXcodeVersions';
  id: string;
  attributes: {
    name?: string;
    testDestinations?: Array<Record<string, unknown>>;
    version?: string;
  };
}

/**
 * macOS version used by a workflow.
 */
export interface CiMacOsVersion {
  type: 'ciMacOsVersions';
  id: string;
  attributes: {
    name?: string;
    version?: string;
  };
}

export type WorkflowIncludedResource =
  | CiMacOsVersion
  | CiXcodeVersion
  | ScmRepository;

export interface CiIssueCounts {
  analyzerWarnings: number;
  errors: number;
  testFailures: number;
  warnings: number;
}

/**
 * Xcode Cloud build run.
 */
export interface CiBuildRun {
  type: 'ciBuildRuns';
  id: string;
  attributes: {
    number: number;
    createdDate: string;
    startedDate?: string;
    finishedDate?: string;
    executionProgress: 'PENDING' | 'RUNNING' | 'COMPLETE';
    completionStatus?: 'SUCCEEDED' | 'FAILED' | 'ERRORED' | 'CANCELED';
    isPullRequestBuild: boolean;
    issueCounts?: CiIssueCounts;
    sourceCommit?: {
      commitSha: string;
      message?: string;
    };
  };
  relationships?: {
    workflow?: {
      data: {
        type: 'ciWorkflows';
        id: string;
      };
    };
  };
}

/**
 * Xcode Cloud build action.
 */
export interface CiBuildAction {
  type: 'ciBuildActions';
  id: string;
  attributes: {
    actionType: 'BUILD' | 'TEST' | 'ANALYZE' | 'ARCHIVE';
    issueCounts?: CiIssueCounts | null;
    executionProgress: 'PENDING' | 'RUNNING' | 'COMPLETE';
    name: string;
    startedDate?: string;
    completionStatus?: 'SUCCEEDED' | 'FAILED' | 'ERRORED' | 'CANCELED' | 'SKIPPED';
    finishedDate?: string;
    isRequiredToPass?: boolean;
  };
}

export type CiArtifactFileType =
  | 'LOG'
  | 'LOG_BUNDLE'
  | 'ARCHIVE'
  | 'XCODEBUILD_ARCHIVE'
  | 'RESULT_BUNDLE'
  | 'TEST_PRODUCTS'
  | 'SCREENSHOT'
  | 'VIDEO';

/**
 * Xcode Cloud artifact.
 */
export interface CiArtifact {
  type: 'ciArtifacts';
  id: string;
  attributes: {
    fileName: string;
    fileType: CiArtifactFileType;
    fileSize?: number;
    downloadUrl?: string;
  };
}
