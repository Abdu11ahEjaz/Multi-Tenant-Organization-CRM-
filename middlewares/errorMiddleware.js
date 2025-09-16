const notFound = (req, res, next) => {
  res.status(404);
  res.json({ message: `Not Found - ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({ message: err.message || 'Server Error', stack: process.env.NODE_ENV === 'production' ? undefined : err.stack });
};

export {notFound,errorHandler};