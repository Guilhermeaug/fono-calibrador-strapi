module.exports = {
  validateYupSchema: async (schema, data) => {
    try {
      await schema.validate(data, { abortEarly: false });
    } catch (error) {
      return error.inner.map((e) => e.message);
    }
  },
}