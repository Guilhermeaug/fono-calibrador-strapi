module.exports = {
  routes: [
    {
     method: 'POST',
     path: '/email/contact',
     handler: 'email.sendContactEmail',
     config: {
       policies: [],
       middlewares: [],
     },
    },
    {
      method: 'POST',
      path: '/email/terms',
      handler: 'email.sendTermsEmail',
      config: {
        policies: [],
        middlewares: [],
      },
     },
    {
     method: 'POST',
     path: '/email/sendEmailTemplate',
     handler: 'email.sendEmailTemplate',
     config: {
       policies: [],
       middlewares: [],
     },
    },
  ],
};
