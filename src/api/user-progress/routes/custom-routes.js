'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/users-progress/submit/assessment',
      handler: 'user-progress.submitAssessment',
    },
    {
      method: 'POST',
      path: '/users-progress/submit/training',
      handler: 'user-progress.submitTraining',
    },
    {
      method: 'POST',
      path: '/users-progress/terms',
      handler: 'user-progress.acceptTerms',
    },
    {
      method: 'POST',
      path: '/users-progress/pac',
      handler: 'user-progress.acceptPac',
    },
    {
      method: 'POST',
      path: '/users-progress/alignProgress',
      handler: 'user-progress.alignProgress',
    },
  ]
}
