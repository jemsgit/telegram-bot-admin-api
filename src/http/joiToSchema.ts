import type Joi from "joi";

/**
 * Joi → OpenAPI-совместимая JSON Schema, через официальный `schema.describe()`
 * (публичный API joi для интроспекции, не парсинг внутреннего AST). Покрывает
 * ровно то, что реально используется в `validators/index.ts`: string/number/
 * boolean/date/array/object, `.valid()` → enum, `.required()`, `.default()`,
 * основные rules (`integer`, `positive`/`negative`, `uri`), `alternatives`
 * (через `.conditional()`) → `oneOf`. Всё остальное — `{}` (permissive),
 * не наша цель дать 100%-покрытие joi, только то, что тут написано руками.
 */

/**
 * Точный (для нужного подмножества) слепок того, что возвращает
 * `schema.describe()`. `Joi.Description` из типов joi объявлен как
 * `flags?: object` + `[key: string]: any` — работать с ним не легче, чем
 * с голым `any`; описываем ровно поля, которые читаем.
 */
interface JoiRule {
  name?: string;
  args?: Record<string, unknown>;
}
interface JoiDescribe {
  type?: string;
  keys?: Record<string, JoiDescribe>;
  items?: JoiDescribe[];
  matches?: Array<{
    then?: JoiDescribe;
    otherwise?: JoiDescribe;
    schema?: JoiDescribe;
  }>;
  rules?: JoiRule[];
  flags?: { presence?: string; only?: boolean; default?: unknown; format?: string };
  allow?: unknown[];
}
type JsonSchema = Record<string, unknown>;

function hasRule(desc: JoiDescribe, name: string): boolean {
  return !!desc.rules?.some((r) => r.name === name);
}

function describeToSchema(desc: JoiDescribe): JsonSchema {
  if (!desc || typeof desc !== "object") return {};

  switch (desc.type) {
    case "object": {
      const properties: JsonSchema = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries<JoiDescribe>(desc.keys ?? {})) {
        properties[key] = describeToSchema(child);
        if (child?.flags?.presence === "required") required.push(key);
      }
      const schema: JsonSchema = { type: "object", properties };
      if (required.length) schema.required = required;
      return schema;
    }

    case "array": {
      const itemDescs: JoiDescribe[] = desc.items ?? [];
      const items =
        itemDescs.length === 1
          ? describeToSchema(itemDescs[0])
          : itemDescs.length > 1
            ? { oneOf: itemDescs.map(describeToSchema) }
            : {};
      return { type: "array", items };
    }

    case "string": {
      const schema: JsonSchema = { type: "string" };
      if (desc.flags?.only && Array.isArray(desc.allow)) {
        schema.enum = desc.allow;
      }
      if (hasRule(desc, "uri")) schema.format = "uri";
      if (desc.flags?.default !== undefined) schema.default = desc.flags.default;
      return schema;
    }

    case "number": {
      const rules = desc.rules ?? [];
      const schema: JsonSchema = { type: "number" };
      if (hasRule(desc, "integer")) schema.type = "integer";
      const signRule = rules.find((r) => r.name === "sign");
      if (signRule?.args?.sign === "positive") schema.exclusiveMinimum = 0;
      if (signRule?.args?.sign === "negative") schema.exclusiveMaximum = 0;
      const minRule = rules.find((r) => r.name === "min");
      if (minRule) schema.minimum = minRule.args?.limit;
      const maxRule = rules.find((r) => r.name === "max");
      if (maxRule) schema.maximum = maxRule.args?.limit;
      if (desc.flags?.default !== undefined) schema.default = desc.flags.default;
      return schema;
    }

    case "boolean": {
      const schema: JsonSchema = { type: "boolean" };
      if (desc.flags?.default !== undefined) schema.default = desc.flags.default;
      return schema;
    }

    case "date": {
      const schema: JsonSchema = { type: "string" };
      schema.format = desc.flags?.format === "iso" ? "date-time" : "date";
      return schema;
    }

    case "alternatives": {
      const branches: JsonSchema[] = [];
      for (const match of desc.matches ?? []) {
        if (match.then) branches.push(describeToSchema(match.then));
        if (match.otherwise) branches.push(describeToSchema(match.otherwise));
        if (match.schema) branches.push(describeToSchema(match.schema));
      }
      if (!branches.length) return {};
      // убираем структурно одинаковые ветки (частый случай: then/otherwise — одна строка)
      const unique = Array.from(new Set(branches.map((b) => JSON.stringify(b)))).map(
        (s) => JSON.parse(s) as JsonSchema,
      );
      return unique.length === 1 ? unique[0] : { oneOf: unique };
    }

    default:
      return {};
  }
}

/** Публичная точка входа: joi-схема тела запроса → OpenAPI Schema Object. */
export function joiSchemaToOpenApi(schema: Joi.Schema): JsonSchema {
  // Joi.Description.flags объявлен как `object` — несовместим по структуре
  // с нашим точечным JoiDescribe, поэтому один каст на границе.
  return describeToSchema(schema.describe() as unknown as JoiDescribe);
}
