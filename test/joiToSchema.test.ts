import { describe, it, expect } from "vitest";
import Joi from "joi";
import { joiSchemaToOpenApi } from "../src/http/joiToSchema";

describe("joiSchemaToOpenApi", () => {
  it("required number с rules integer/positive", () => {
    const schema = Joi.object({
      days: Joi.number().integer().positive().required(),
    });
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: {
        days: { type: "integer", exclusiveMinimum: 0 },
      },
      required: ["days"],
    });
  });

  it("string .valid() -> enum, uri rule -> format, default", () => {
    const schema = Joi.object({
      type: Joi.string().valid("text", "photo", "video").default("text"),
      mediaUrl: Joi.string().uri().optional(),
    });
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: {
        type: { type: "string", enum: ["text", "photo", "video"], default: "text" },
        mediaUrl: { type: "string", format: "uri" },
      },
    });
  });

  it("date().iso() -> string/date-time", () => {
    const schema = Joi.object({ activeFrom: Joi.date().iso().required() });
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: { activeFrom: { type: "string", format: "date-time" } },
      required: ["activeFrom"],
    });
  });

  it("array of objects — вложенные required", () => {
    const schema = Joi.object({
      linkButtons: Joi.array()
        .items(
          Joi.object({
            text: Joi.string().required(),
            url: Joi.string().uri().required(),
          }),
        )
        .default([]),
    });
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: {
        linkButtons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              url: { type: "string", format: "uri" },
            },
            required: ["text", "url"],
          },
        },
      },
    });
  });

  it("array of strings", () => {
    const schema = Joi.object({ segments: Joi.array().items(Joi.string()) });
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: { segments: { type: "array", items: { type: "string" } } },
    });
  });

  it("alternatives().conditional() с одинаковыми then/otherwise -> схлопывается", () => {
    const schema = Joi.object({
      text: Joi.alternatives().conditional("type", {
        is: "text",
        then: Joi.string().required(),
        otherwise: Joi.string().optional(),
      }),
    });
    // then/otherwise оба "string" без доп. rules -> одна и та же схема после describe
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: { text: { type: "string" } },
    });
  });

  it("boolean с default", () => {
    const schema = Joi.object({ excludePaid: Joi.boolean().default(true) });
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: { excludePaid: { type: "boolean", default: true } },
    });
  });

  it("неизвестный/непокрытый тип -> {} без падения", () => {
    const schema = Joi.object({ anything: Joi.any() });
    expect(joiSchemaToOpenApi(schema)).toEqual({
      type: "object",
      properties: { anything: {} },
    });
  });
});
