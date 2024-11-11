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
      path: '/users-progress/alignProgress',
      handler: 'user-progress.alignProgress',
    },
    {
      method: 'POST',
      path: '/users-progress/restartSessions',
      handler: 'user-progress.restartSessions',
    },
    {
      method: 'POST',
      path: '/users-progress/clearTimeout',
      handler: 'user-progress.clearTimeout',
    },
  ]
}
