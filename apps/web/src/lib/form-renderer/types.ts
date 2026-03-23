export type ComponentType =
  | 'text' | 'number' | 'date' | 'datetime' | 'dropdown' | 'multi_select'
  | 'file_upload' | 'signature' | 'geo_coordinates' | 'table' | 'section' | 'conditional_group';

export interface MultilingualString { en?: string; ar?: string; fr?: string; es?: string }

export interface TableColumn {
  key: string;
  label: MultilingualString;
  type: 'text' | 'number' | 'date' | 'dropdown';
  required?: boolean;
  options?: Array<{ value: string; label: MultilingualString }>;
}

export interface RendererComponent {
  id: string;
  key: string;
  type: ComponentType;
  label: MultilingualString;
  placeholder?: MultilingualString;
  helpText?: MultilingualString;
  isRequired: boolean;
  validation?: {
    min?: number; max?: number;
    minLength?: number; maxLength?: number;
    pattern?: string; accept?: string; maxSize?: number;
  };
  options?: Array<{ value: string; label: MultilingualString }>;
  tableSchema?: { allow_add_rows?: boolean; max_rows?: number; columns: TableColumn[] };
  conditions?: { show_if?: Array<{ field: string; operator: string; value?: unknown }>; logic?: 'and' | 'or' };
  children?: RendererComponent[];
}

/** Flat map of componentId → current value (what we pass around in the fill form) */
export type FieldValues = Record<string, FieldValue>;

export type FieldValue =
  | string
  | number
  | string[]          // multi_select
  | TableRow[]        // table
  | GeoValue          // geo_coordinates
  | null
  | undefined;

export interface TableRow { [colKey: string]: string | number | null }
export interface GeoValue {
  lat: number; lng: number;
  accuracy?: number;
  captureMethod: 'gps' | 'map_selection';
  capturedAt: string;
}
