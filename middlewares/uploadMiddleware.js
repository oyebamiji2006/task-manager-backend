const multer = require('multer');
const path = require('path');

//Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

//File filter to allow only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if(allowedTypes.includes(file.mimetype)){
        cb(null, true);
    } else { 
        cb(new Error('Only .jpeg, .png and .gif formats are allowed'), false);
    }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;