const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsRoot = path.resolve(__dirname, '../uploads/verification');
const fraudUploadsRoot = path.resolve(__dirname, '../uploads/fraud-reports');
fs.mkdirSync(uploadsRoot, { recursive: true });
fs.mkdirSync(fraudUploadsRoot, { recursive: true });

const safePropertyId = (value) => /^[a-f\d]{24}$/i.test(String(value || '')) ? String(value) : 'pending';

const filename = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const baseName = path.basename(file.originalname, extension).replace(/[^a-z0-9_-]/gi, '-').slice(0, 60);
  callback(null, `${Date.now()}-${baseName || 'document'}${extension}`);
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const directory = path.join(uploadsRoot, safePropertyId(req.body.propertyId || req.query.propertyId));
    fs.mkdirSync(directory, { recursive: true });
    callback(null, directory);
  },
  filename,
});

const fileFilter = (req, file, callback) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const extension = path.extname(file.originalname).toLowerCase();
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
    return callback(null, true);
  }
  callback(new Error('Only PDF, JPG, and PNG files are allowed'));
};

const verificationUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
});

const fraudStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const directory = path.join(fraudUploadsRoot, safePropertyId(req.body.propertyId || req.query.propertyId));
    fs.mkdirSync(directory, { recursive: true });
    callback(null, directory);
  },
  filename,
});

const evidenceUpload = multer({
  storage: fraudStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

module.exports = { verificationUpload, evidenceUpload, uploadsRoot, fraudUploadsRoot };
