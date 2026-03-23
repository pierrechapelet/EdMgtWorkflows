export type ComponentType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'dropdown'
  | 'multi_select'
  | 'file_upload'
  | 'signature'
  | 'geo_coordinates'
  | 'table'
  | 'section'
  | 'conditional_group';

export interface MultilingualString {
  en: string;
  ar?: string;
  fr?: string;
  es?: string;
}

export interface TableColumn {
  key: string;
  label: MultilingualString;
  type: 'text' | 'number' | 'date' | 'dropdown';
  required?: boolean;
  options?: Array<{ value: string; label: MultilingualString }>;
}

export interface TableSchema {
  allow_add_rows?: boolean;
  max_rows?: number;
  columns: TableColumn[];
}

export interface ConditionalRule {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'empty' | 'not_empty';
  value?: unknown;
}

export interface FormComponentDef {
  id: string;
  parentId: string | null;
  orderIndex: number;
  componentType: ComponentType;
  key: string;
  label: MultilingualString;
  placeholder?: MultilingualString;
  helpText?: MultilingualString;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    accept?: string; // file_upload MIME types
    maxSize?: number; // bytes
  };
  options?: Array<{ value: string; label: MultilingualString }>;
  tableSchema?: TableSchema;
  conditions?: { show_if?: ConditionalRule[]; logic?: 'and' | 'or' };
  isRequired: boolean;
  children?: FormComponentDef[];
}

export interface FormVersionDef {
  id: string;
  templateId: string;
  versionNumber: number;
  isPublished: boolean;
  isDraft: boolean;
  publishedAt: string | null;
  createdAt: string;
  components: FormComponentDef[];
  schema: unknown;
}

export interface FormTemplateDef {
  id: string;
  code: string;
  title: MultilingualString;
  ownerNodeId: string;
  ownerNode?: { id: string; code: string; name: MultilingualString; nodeType: string };
  currentVersionId: string | null;
  currentVersion?: FormVersionDef | null;
  versions?: Pick<FormVersionDef, 'id' | 'versionNumber' | 'isPublished' | 'isDraft' | 'publishedAt' | 'createdAt'>[];
  _count?: { versions: number };
  createdAt: string;
}
