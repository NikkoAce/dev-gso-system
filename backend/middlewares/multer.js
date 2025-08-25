const multer = require('multer');

// Use memory storage to process file data in the controller without saving to disk
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = { upload };

