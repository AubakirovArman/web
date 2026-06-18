export interface EnvConfig {
  chatUrl: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface StructuredNpaSection {
  id: string;
  sectionType?: string | null;
  headingNumber?: string | null;
  title?: string | null;
  text: string;
}

export interface StructuredNpaDocument {
  id: string;
  title: string;
  domain: string;
  kind: string;
  number?: string | null;
  date?: string | null;
  fileName: string;
  sections: StructuredNpaSection[];
}

export interface UploadedNpaMetadata {
  name?: string;
  actType?: string;
  number?: string;
  date?: string;
  revision?: string;
}
