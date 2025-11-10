// Sets strong security-related HTTP headers for every response.
// - Content-Security-Policy (CSP) helps prevent XSS and data injection attacks.
const headerSet = (req, res, next) => { 
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://trusted.cdn.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';");
  next();
};

const Security = (req, res, next) => { 
  if (req.headers.origin !== process.env.FRONTEND_ORIGIN && process.env.ENV === 'dev') { 
    return res.status(400).send('Forbidden');
  }
  next();
};
module.exports = {headerSet , Security};