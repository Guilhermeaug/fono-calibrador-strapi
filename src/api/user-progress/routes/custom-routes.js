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
  ]
}
