/**
 * App Store Connect API response envelope.
 */
export interface APIResponse<TData> {
  data: TData;
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
    clean: boolean;
    containerFilePath: string;
    lastModifiedDate: string;
  };
}

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

export type CiArtifactFileType =
  | 'LOG'
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
