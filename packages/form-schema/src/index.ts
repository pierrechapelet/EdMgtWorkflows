import { z } from 'zod';

// ─── Multilingual string ──────────────────────────────────────────────────────

export const multilingualString = z
  .object({
    en: z.string().optional(),
    ar: z.string().optional(),
    fr: z.string().optional(),
    es: z.string().optional(),
  })
  .refine((val) => Object.values(val).some(Boolean), {
    message: 'At least one language translation must be provided',
  });

// ─── Component types ──────────────────────────────────────────────────────────

export const componentType = z.enum([
  'text',
  'number',
  'date',
  'datetime',
  'dropdown',
  'multi_select',
  'file_upload',
  'signature',
  'geo_coordinates',
  'table',
  'section',
  'conditional_group',
]);

// ─── Validation rules ─────────────────────────────────────────────────────────

export const validationSchema = z
  .object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    pattern: z.string().optional(),
    accept: z.string().optional(),      // MIME types e.g. "image/*,application/pdf"
    maxSize: z.number().int().positive().optional(), // bytes
  })
  .optional();

// ─── Dropdown options ─────────────────────────────────────────────────────────

export const selectOption = z.object({
  value: z.string().min(1),
  label: multilingualString,
});

// ─── Table column definition ──────────────────────────────────────────────────

export const tableColumn = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Column key must be snake_case'),
  label: multilingualString,
  type: componentType,
  required: z.boolean().optional(),
  options: z.array(selectOption).optional(), // only for dropdown cell type
  validation: validationSchema,
});

export const tableSchema = z.object({
  allowAddRows: z.boolean().default(true),
  maxRows: z.number().int().positive().optional(),
  columns: z.array(tableColumn).min(1),
});

// ─── Conditional display rules ────────────────────────────────────────────────

export const conditionalRule = z.object({
  field: z.string().min(1),        // key of another component
  operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in', 'not_in']),
  value: z.unknown(),
  logicGroup: z.enum(['and', 'or']).optional(),
});

// ─── Form component (recursive — sections contain children) ───────────────────

export type FormComponentSchema = z.infer<typeof formComponentSchema>;

export const formComponentSchema: z.ZodType<FormComponentSchema> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    componentType,
    key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Component key must be snake_case'),
    label: multilingualString,
    placeholder: multilingualString.optional(),
    helpText: multilingualString.optional(),
    validation: validationSchema,
    options: z.array(selectOption).optional(),    // dropdown, multi_select
    tableSchema: tableSchema.optional(),           // table
    conditions: z.array(conditionalRule).optional(),
    isRequired: z.boolean().optional(),
    orderIndex: z.number().int().nonnegative(),
    children: z.array(formComponentSchema).optional(), // section, conditional_group
    metadata: z.record(z.unknown()).optional(),
  })
);

// ─── Full form schema (stored in form_versions.schema) ────────────────────────

export const formVersionSchema = z.object({
  version: z.string().min(1),           // semver e.g. "1.0.0"
  components: z.array(formComponentSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type FormVersionSchema = z.infer<typeof formVersionSchema>;

// ─── Submission value validators ──────────────────────────────────────────────

export const submissionGeoValue = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().optional(),
  captureMethod: z.enum(['gps', 'map_selection']),
  capturedAt: z.string().datetime(),
});

export const submissionSignatureValue = z.object({
  type: z.enum(['drawn', 'typed', 'both']),
  drawnDataUrl: z.string().optional(),   // base64 canvas image
  typedName: z.string().optional(),
  // SHA-256 computed server-side: hash(deterministic JSON + signature bytes)
  hash: z.string().length(64).optional(),
});

export const submissionTableValue = z.array(z.record(z.unknown()));

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  z,
  type z as Zod,
};
