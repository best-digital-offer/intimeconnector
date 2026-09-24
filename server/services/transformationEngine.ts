import { GoogleGenAI, Type } from '@google/genai';
import { Transformation, TransformationRule } from '../db/schema';

// Helper to safely get nested property via dot-notation (e.g., "customer.name")
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = safePath(path);
  if (!parts) return undefined;
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

// Helper to safely set nested property via dot-notation
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function safePath(path: string): string[] | null {
  const parts = path.split('.').filter(Boolean);
  if (!parts.length || parts.length > 20 || parts.some((part) => FORBIDDEN_PATH_SEGMENTS.has(part))) return null;
  return parts;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = safePath(path);
  if (!parts) return;
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Apply deterministic rules to an input object
 */
export function applyDeterministicRules(
  input: Record<string, unknown>,
  rules: TransformationRule[]
): Record<string, unknown> {
  // Start with a shallow copy or empty target based on rules
  const output: Record<string, unknown> = { ...input };

  for (const rule of rules) {
    switch (rule.type) {
      case 'rename_field': {
        if (rule.source_field && rule.target_field) {
          const val = getNestedValue(output, rule.source_field);
          if (val !== undefined) {
            setNestedValue(output, rule.target_field, val);
            if (rule.source_field !== rule.target_field) {
              delete output[rule.source_field];
            }
          }
        }
        break;
      }

      case 'remove_field': {
        if (rule.source_field) {
          delete output[rule.source_field];
        }
        break;
      }

      case 'create_field':
      case 'constant_value': {
        if (rule.target_field) {
          setNestedValue(output, rule.target_field, rule.value);
        }
        break;
      }

      case 'combine_fields': {
        if (rule.fields && rule.target_field) {
          const combined = rule.fields
            .map((f) => String(getNestedValue(output, f) ?? ''))
            .filter(Boolean)
            .join(rule.separator || ' ');
          setNestedValue(output, rule.target_field, combined);
        }
        break;
      }

      case 'split_fields': {
        if (rule.source_field && rule.fields && rule.separator) {
          const val = String(getNestedValue(output, rule.source_field) ?? '');
          const split = val.split(rule.separator);
          rule.fields.forEach((target, idx) => {
            if (target && split[idx] !== undefined) {
              setNestedValue(output, target, split[idx].trim());
            }
          });
        }
        break;
      }

      case 'trim_text': {
        if (rule.source_field) {
          const val = getNestedValue(output, rule.source_field);
          if (typeof val === 'string') {
            setNestedValue(output, rule.target_field || rule.source_field, val.trim());
          }
        }
        break;
      }

      case 'lowercase': {
        if (rule.source_field) {
          const val = getNestedValue(output, rule.source_field);
          if (typeof val === 'string') {
            setNestedValue(output, rule.target_field || rule.source_field, val.toLowerCase());
          }
        }
        break;
      }

      case 'uppercase': {
        if (rule.source_field) {
          const val = getNestedValue(output, rule.source_field);
          if (typeof val === 'string') {
            setNestedValue(output, rule.target_field || rule.source_field, val.toUpperCase());
          }
        }
        break;
      }

      case 'to_number': {
        if (rule.source_field) {
          const val = getNestedValue(output, rule.source_field);
          const num = Number(val);
          setNestedValue(output, rule.target_field || rule.source_field, isNaN(num) ? 0 : num);
        }
        break;
      }

      case 'to_boolean': {
        if (rule.source_field) {
          const val = getNestedValue(output, rule.source_field);
          const bool = val === true || val === 'true' || val === '1' || val === 1;
          setNestedValue(output, rule.target_field || rule.source_field, bool);
        }
        break;
      }

      case 'format_date': {
        if (rule.source_field) {
          const val = getNestedValue(output, rule.source_field);
          try {
            const date = new Date(String(val));
            setNestedValue(output, rule.target_field || rule.source_field, date.toISOString());
          } catch {
            // Keep original on failure
          }
        }
        break;
      }

      case 'set_default': {
        if (rule.target_field) {
          const existing = getNestedValue(output, rule.target_field);
          if (existing === undefined || existing === null || existing === '') {
            setNestedValue(output, rule.target_field, rule.value);
          }
        }
        break;
      }

      case 'conditional': {
        if (rule.condition_field && rule.target_field) {
          const fieldVal = String(getNestedValue(output, rule.condition_field) ?? '');
          let matched = false;
          if (rule.condition_operator === 'equals') {
            matched = fieldVal === String(rule.condition_value);
          } else if (rule.condition_operator === 'not_equals') {
            matched = fieldVal !== String(rule.condition_value);
          } else if (rule.condition_operator === 'contains') {
            matched = fieldVal.includes(String(rule.condition_value));
          } else if (rule.condition_operator === 'exists') {
            matched = fieldVal.length > 0;
          }

          if (matched) {
            setNestedValue(output, rule.target_field, rule.value);
          }
        }
        break;
      }
    }
  }

  return output;
}

/**
 * Apply template interpolation: e.g. "Hello {{name}}"
 */
export function applyTemplateInterpolation(
  templateString: string,
  variables: Record<string, unknown>
): unknown {
  let rendered = templateString;
  for (const [key, val] of Object.entries(variables)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');');
    const regex = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g');
    rendered = rendered.replace(regex, typeof val === 'object' ? JSON.stringify(val) : String(val ?? ''));
  }

  try {
    return JSON.parse(rendered);
  } catch {
    return { text: rendered };
  }
}

/**
 * AI Natural Language Extraction using Gemini 3.8 Flash
 */
export async function extractWithGemini(
  naturalText: string,
  schemaGuide?: string
): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `You are a high-precision Just-in-Time Connector data transformation engine.
Your job is to convert natural-language user instructions or summaries into a clean, structured JSON object.

User instruction/summary:
"""
${naturalText}
"""

Target schema guidance or field instructions:
${schemaGuide || 'Extract key entities like name, company, email, phone, request/summary, intent, amount, or priority.'}

Return ONLY valid JSON with no markdown backticks, no explanations.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim() || '{}';
      return JSON.parse(text);
    } catch (err) {
      console.warn('[TransformationEngine] Gemini API call error, falling back to local extractor:', err);
    }
  }

  // Resilient heuristic NLP extractor for offline / sandboxed runtime
  return fallbackNlpExtractor(naturalText);
}

function fallbackNlpExtractor(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {
    source: 'Just-in-Time-Connector',
    raw_input: text,
  };

  // Email regex
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }

  // Phone regex
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
  }

  // Name extraction (e.g. "John Smith from ABC", "John Doe wants quote")
  const nameFromMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:from|at)\s+([A-Za-z0-9&.\s]+?)(?:wants|requires|needs|interested|is|,|\.|$)/i);
  if (nameFromMatch) {
    result.name = nameFromMatch[1].trim();
    result.company = nameFromMatch[2].trim();
  } else {
    const simpleNameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (simpleNameMatch) {
      result.name = simpleNameMatch[1].trim();
    }
  }

  // Intent / Request extraction
  const wantsMatch = text.match(/(?:wants|requires|needs|requesting|interested in)\s+([^.]+)/i);
  if (wantsMatch) {
    result.request = wantsMatch[1].trim();
  } else {
    result.summary = text.slice(0, 120);
  }

  return result;
}

/**
 * Execute full transformation pipeline on input payload
 */
export async function executeTransformation(
  transformation: Transformation,
  rawInput: string | Record<string, unknown>
): Promise<Record<string, unknown>> {
  let parsedInput: Record<string, unknown>;

  if (typeof rawInput === 'string') {
    try {
      parsedInput = JSON.parse(rawInput);
    } catch {
      // Natural language input! Use Gemini AI extractor
      parsedInput = await extractWithGemini(rawInput, transformation.ai_system_instructions);
    }
  } else {
    parsedInput = rawInput;
  }

  if (transformation.mode === 'template' && transformation.template_json) {
    return applyTemplateInterpolation(transformation.template_json, parsedInput) as Record<string, unknown>;
  }

  return applyDeterministicRules(parsedInput, transformation.rules || []);
}
