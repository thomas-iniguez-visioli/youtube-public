// include and initialize the rollbar library with your access token
var Rollbar = require('rollbar');
var rollbar = new Rollbar({
  accessToken: '',
  captureUncaught: true,
  captureUnhandledRejections: true,
});
console.log(rollbar)
// record a generic message and send it to Rollbar
rollbar.error('Hello world!');
rollbar.critical("test")