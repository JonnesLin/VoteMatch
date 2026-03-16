/**
 * Shared types for the VoteMatch data pipeline.
 * Covers collector output, verifier results, analyzer output, and orchestration.
 */

// --- Collector types ---

export type SourceType = "official_website" | "voting_record" | "news" | "social_media";

export interface CollectorInput {
  candidateId: string;
  candidateName: string;
  office: string;
  district: string;
  incumbent: boolean;
  officialWebsite?: string | null;
}

export interface CollectedMaterial {
  sourceUrl: string;
  sourceType: SourceType;
  rawText: string;
  accessDate: Date;
}

export interface CollectorOutput {
  candidateId: string;
  materials: CollectedMaterial[];
  notFound: SourceType[];
}

// --- Verifier types ---

export interface VerificationResult {
  rawMaterialId: string;
  sourceUrl: string;
  urlVerified: boolean;
  contentVerified: boolean;
  failureReason?: string;
}

// --- Analyzer types ---

export interface AnalyzerInput {
  candidateId: string;
  candidateName: string;
  issueCategories: Array<{
    id: string;
    name: string;
    displayNameEn: string;
    level: string;
  }>;
  rawMaterials: Array<{
    id: string;
    sourceUrl: string;
    sourceType: string;
    rawText: string;
  }>;
}

export interface ExtractedPosition {
  issueId: string;
  positionSummary: string;
  positionScore: number;
  confidence: "high" | "medium" | "low";
  supportingEvidence: Array<{
    rawMaterialId: string;
    relevantQuote: string;
  }>;
  notes?: string;
}

export interface AnalyzerOutput {
  candidateId: string;
  positions: ExtractedPosition[];
}

// --- Orchestrator types ---

export type PipelineStage = "collect" | "verify" | "analyze";

export interface PipelineResult {
  candidateId: string;
  candidateName: string;
  collectResult: {
    materialsCreated: number;
    notFound: SourceType[];
  };
  verifyResult: {
    urlVerified: number;
    urlFailed: number;
    contentVerified: number;
    contentFailed: number;
  };
  analyzeResult: {
    positionsCreated: number;
    positionsUpdated: number;
  };
  errors: string[];
}

export interface BatchPipelineResult {
  electionId: string;
  candidates: PipelineResult[];
  totalErrors: number;
}
