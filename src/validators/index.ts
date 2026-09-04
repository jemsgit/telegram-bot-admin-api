import { Request, Response, NextFunction } from "express";
import Joi from "joi";

// Типы для валидируемых данных
export interface DaysBody {
  days: number;
}

export interface ReportReplyBody {
  text: string;
}

export interface PromoCodeBody {
  promoCode: string;
}

export interface BroadcastCreateBody {
  title?: string;
  type: "text" | "photo" | "video";
  text?: string;
  mediaUrl?: string;
  scheduledAt?: string;
  excludePaid?: boolean;
  linkButtons?: Array<{ text: string; url: string }>;
}

export interface PromoCreateBody {
  code: string;
  description?: string;
  discountPercent: number;
  price?: number;
  activeFrom: string;
  activeTo: string;
  isActive?: boolean;
  segments?: string[];
}

// Joi схемы
const daysSchema = Joi.object<DaysBody>({
  days: Joi.number().integer().positive().required(),
});

const reportReplySchema = Joi.object<ReportReplyBody>({
  text: Joi.string().required(),
});

const promoCodeSchema = Joi.object<PromoCodeBody>({
  promoCode: Joi.string().required(),
});

export const broadcastValidationSchema = Joi.object<BroadcastCreateBody>({
  title: Joi.string().optional(),
  type: Joi.string().valid("text", "photo", "video").default("text"),
  text: Joi.alternatives().conditional("type", {
    is: "text",
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  mediaUrl: Joi.alternatives().conditional("type", {
    is: Joi.valid("photo", "video"),
    then: Joi.string().uri().required(),
    otherwise: Joi.string().optional(),
  }),
  scheduledAt: Joi.date().iso().optional(),
  excludePaid: Joi.boolean().default(true),
  linkButtons: Joi.array()
    .items(
      Joi.object({
        text: Joi.string().required(),
        url: Joi.string().uri().required(),
      }),
    )
    .default([]),
});

const promoCreateSchema = Joi.object<PromoCreateBody>({
  code: Joi.string().required(),
  description: Joi.string().optional(),
  discountPercent: Joi.number().min(0).max(100).required(),
  price: Joi.number().positive().optional(),
  activeFrom: Joi.date().iso().required(),
  activeTo: Joi.date().iso().required(),
  isActive: Joi.boolean().default(true),
  segments: Joi.array().items(Joi.string()).default([]).optional(),
});

// Типизированные middleware
export const validateDays = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { error, value } = daysSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }
  req.body = value;
  next();
};

export const validateReply = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { error, value } = reportReplySchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }
  req.body = value;
  next();
};

export const validatePromoCode = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { error, value } = promoCodeSchema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }
  req.body = value;
  next();
};

export const validatePromoCreate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { error, value } = promoCreateSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    res.status(400).json({
      error: error.details.map((d: Joi.ValidationErrorItem) => d.message),
    });
    return;
  }
  req.body = value;
  next();
};

export default {
  validateDays,
  validateReply,
  validatePromoCode,
  validatePromoCreate,
  broadcastValidationSchema,
};
