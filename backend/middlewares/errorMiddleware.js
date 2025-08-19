const errorHandler = (err, req, res, next) => {
    // Sometimes an error might come in with a 200 status code, default to 500
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        // Show stack trace only in development mode for security
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { errorHandler };