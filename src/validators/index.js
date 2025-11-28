const Joi = require("joi");

const daysSchema = Joi.object({
  days: Joi.number().integer().positive().required(),
});

const reportReplySchema = Joi.object({
  text: Joi.string().required(),
});

const promoCodeSchema = Joi.object({
  promoCode: Joi.string().required(),
});

const broadcastValidationSchema = Joi.object({
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
      })
    )
    .default([]),
});

const promoCreateSchema = Joi.object({
  code: Joi.string().required(),
  description: Joi.string().optional(),
  discountPercent: Joi.number().min(0).max(100).required(),
  price: Joi.number().positive().optional(),
  activeFrom: Joi.date().iso().required(),
  activeTo: Joi.date().iso().required(),
  isActive: Joi.boolean().default(true),
  segments: Joi.array().items(Joi.string()).default([]).optional(),
});

const validators = {
  validateDays: (req, res, next) => {
    const { error, value } = daysSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    req.body = value;
    next();
  },
  validateReply: (req, res, next) => {
    const { error, value } = reportReplySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    req.body = value;
    next();
  },
  validatePromoCode: (req, res, next) => {
    const { error, value } = promoCodeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    req.body = value;
    next();
  },
  validatePromoCreate: (req, res, next) => {
    const { error, value } = promoCreateSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error)
      return res
        .status(400)
        .json({ error: error.details.map((d) => d.message) });
    req.body = value;
    next();
  },
  broadcastValidationSchema,
};

module.exports = validators;
