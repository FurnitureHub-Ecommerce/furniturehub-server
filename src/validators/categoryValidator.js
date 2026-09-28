const { z } = require("zod");

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),

  description: z.string().trim().optional(),
}).strict();

const updateCategorySchema = createCategorySchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );

module.exports = {
  createCategorySchema,
  updateCategorySchema,
};