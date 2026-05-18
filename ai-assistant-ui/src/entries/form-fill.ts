export { useFormAutoFill } from '../composables/useFormAutoFill';
export type {
  FormAutoFillOptions,
  TableModeOptions,
  TableModeInfo,
  UseFormAutoFillReturn,
  UseFormAutoFillDeps,
} from '../composables/useFormAutoFill';
export {
  parseFormData,
  parseFormDataAsTable,
  splitInlineSegments,
  unquote,
} from '../utils/formAutoFill/parser';
export type {
  ParsedPair,
  ParseFormDataOptions,
  ParsedTable,
  ParseFormDataAsTableOptions,
} from '../utils/formAutoFill/parser';
export { scanFormFields, scanFormRows } from '../utils/formAutoFill/scanner';
export type {
  FormField,
  FormFieldOption,
  FormFieldType,
  ScanFormFieldsOptions,
  FormRow,
  ScanFormRowsOptions,
} from '../utils/formAutoFill/scanner';
export {
  matchFields,
  normalize as normalizeFieldLabel,
  levenshteinDistance,
  levenshteinSimilarity,
  longestCommonSubstring,
} from '../utils/formAutoFill/matcher';
export type { MatchResult, MatchStrategy, MatcherOptions } from '../utils/formAutoFill/matcher';
export {
  fillField,
  undoFills,
  highlightFilledField,
  clearFillHighlights,
} from '../utils/formAutoFill/filler';
export type { FillRecord } from '../utils/formAutoFill/filler';
