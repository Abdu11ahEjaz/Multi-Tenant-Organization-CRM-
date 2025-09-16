export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Access Denied" });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Role middleware error", error });
    }
  };
};
