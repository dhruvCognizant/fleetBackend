function authorize(allowedRoles) {
  return (req, res, next) => {
    // Extract user role from authenticated request
    const userRole = req.user && req.user.role;
    // Check if user has a role and if it's allowed
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(400).json({
        message: 'Forbidden: You do not have access to this resource',
        userRole,
        requiredRoles: allowedRoles // roles required to access this route
      });
    }
    next();
  };
}
module.exports = { authorize };