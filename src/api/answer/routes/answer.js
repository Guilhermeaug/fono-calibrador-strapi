module.exports = {
  routes: [
    {
      method: "POST",
      path: "/answer",
      handler: "answer.index",
      config: {
        auth: false,
      },
    },
  ],
};
