'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/user-sessions-progress/invalidate',
      handler: 'user-session-progress.invalidateUserSession',
    },
  ]
}
