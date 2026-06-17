export { TemplatePicker } from "./TemplatePicker";
export { messageTemplates } from "./messageTemplates";
export { searchTemplates, groupByCategory } from "./templateSearch";
export {
  templateToDraft,
  draftIdForTemplate,
  isTemplateInserted,
  insertTemplate,
  removeDraft,
  type InsertResult,
} from "./templateToDraft";
export { TEMPLATE_CATEGORY_LABEL, type MessageTemplate, type TemplateCategory } from "./types";
