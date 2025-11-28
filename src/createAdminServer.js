const { AdminServer } = require("./AdminServer");

function createAdminServer(bot, db, scheduler, options = {}) {
  const {
    port = 3105,
    features = {},
    customRoutes = [],
    customRoutesConfig = [],
    baseUrl,
  } = options;

  const adminServer = new AdminServer(
    bot,
    db,
    scheduler,
    { customRoutes, port },
    {
      ...features,
      base: baseUrl,
      customRoutesConfig,
    }
  );

  return adminServer;
}

module.exports = { createAdminServer };
