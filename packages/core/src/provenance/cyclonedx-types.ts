/**
 * CycloneDX ML-BOM v1.7 types for AIBOM generation.
 * Subset of the full CycloneDX 1.7 schema, covering ML model components.
 */

export type CdxLicense =
  | { readonly license: { readonly id: string } }
  | { readonly license: { readonly name: string } }
  | { readonly expression: string };

export type CdxExternalReference = {
  readonly url: string;
  readonly type: string;
  readonly comment: string | null;
};

export type CdxHash = {
  readonly alg: string;
  readonly content: string;
};

export type CdxOrganization = {
  readonly name: string;
  readonly url: ReadonlyArray<string>;
};

export type CdxPerformanceMetric = {
  readonly type: string;
  readonly value: string;
  readonly slice: string | null;
  readonly confidenceInterval: {
    readonly lowerBound: string;
    readonly upperBound: string;
  } | null;
};

export type CdxDataset = {
  readonly type: "dataset";
  readonly name: string;
  readonly description: string | null;
  readonly "bom-ref": string;
};

export type CdxModelCard = {
  readonly modelParameters: {
    readonly approach: { readonly type: string } | null;
    readonly task: string;
    readonly datasets: ReadonlyArray<CdxDataset>;
  };
  readonly quantitativeAnalysis: {
    readonly performanceMetrics: ReadonlyArray<CdxPerformanceMetric>;
  };
  readonly considerations: {
    readonly ethicalConsiderations: ReadonlyArray<{
      readonly name: string;
      readonly mitigationStrategy: string | null;
    }>;
  };
};

export type CdxComponent = {
  readonly type: "machine-learning-model";
  readonly name: string;
  readonly version: string;
  readonly "bom-ref": string;
  readonly description: string | null;
  readonly supplier: CdxOrganization | null;
  readonly authors: ReadonlyArray<{ readonly name: string }>;
  readonly licenses: ReadonlyArray<CdxLicense>;
  readonly hashes: ReadonlyArray<CdxHash>;
  readonly externalReferences: ReadonlyArray<CdxExternalReference>;
  readonly modelCard: CdxModelCard;
};

export type CdxMetadata = {
  readonly timestamp: string;
  readonly tools: {
    readonly components: ReadonlyArray<{
      readonly type: "application";
      readonly name: string;
      readonly version: string;
    }>;
  };
};

export type CycloneDxBom = {
  readonly $schema: string;
  readonly bomFormat: "CycloneDX";
  readonly specVersion: "1.7";
  readonly serialNumber: string;
  readonly version: number;
  readonly metadata: CdxMetadata;
  readonly components: ReadonlyArray<CdxComponent>;
};

/** Input for generating a CycloneDX BOM from a ModelProvenance record. */
export type GenerateBomInput = {
  /** The provenance record to convert. */
  readonly provenance: import("./model-provenance.js").ModelProvenance;
  /** URN UUID for the BOM serial number (format: urn:uuid:<uuid>). */
  readonly serialNumber: string;
  /** Version of the generating tool. */
  readonly toolVersion: string;
};

export type BomGenerationError = {
  readonly code: "INVALID_SERIAL_NUMBER" | "INVALID_PROVENANCE";
  readonly message: string;
};
